# Fluxo de Autenticação e Autorização

Este documento explica como a autenticação e autorização funcionam no projeto,
onde cada peça é configurada e por que as decisões foram tomadas dessa forma.
Cobre tanto o fluxo de produção quanto as particularidades do ambiente local de
desenvolvimento.

---

## Visão geral da arquitetura

```
Frontend (Angular)          Supabase Auth (GoTrue)        Backend (Spring Boot)
        │                           │                              │
        │── signUp() / signIn() ──▶ │                              │
        │                           │── gera JWT (ES256) ─────────▶│
        │◀── JWT ───────────────────│                              │
        │                           │                              │
        │── GET /api/... ──────────────────────────────────────── ▶│
        │     Authorization: Bearer <JWT>                          │
        │                           │                   valida JWT │
        │                           │◀── GET /.well-known/jwks ────│
        │                           │─── retorna chave pública ───▶│
        │                           │                   JWT válido │
        │◀─────────────────────────────────────────── resposta ────│
```

Dois sistemas independentes colaboram:

- **Supabase Auth (GoTrue):** emite tokens JWT assinados com chave privada EC P-256
- **Spring Boot (Spring Security):** valida tokens usando apenas a chave pública, obtida via JWKS

O backend **nunca** vê a chave privada — só a pública. Isso é a decisão de segurança
central descrita em `docs/architecture.md §1`.

---

## GoTrue — o que é e o que gerencia

GoTrue é o microserviço de autenticação interno do Supabase. Ele gerencia o schema
`auth.*` no banco PostgreSQL:

| Tabela | O que guarda |
|---|---|
| `auth.users` | Usuário: email, senha (bcrypt), metadados, confirmação |
| `auth.identities` | Vínculo usuário ↔ provider (email, Google, GitHub…) |
| `auth.sessions` | Sessões ativas e refresh tokens |
| `auth.refresh_tokens` | Tokens de rotação automática (7 dias) |

### Por que `auth.identities` existe

Um mesmo usuário pode se autenticar por múltiplos providers (email + Google, por
exemplo). O `auth.identities` guarda cada vínculo. **Para autenticação via
email/password, GoTrue exige que exista um registro em `auth.identities` além do
`auth.users`.**

Quando você cria um usuário pelo SDK (`supabase.auth.signUp()`), o GoTrue cria
ambos atomicamente. Ao fazer INSERT direto via SQL (como no seed local), apenas
`auth.users` é criado — e o login falha com `"Database error querying schema"`.

---

## JWT — estrutura e algoritmos

Um JWT tem três partes separadas por `.`:

```
eyJhbGciOiJFUzI1NiIsImtpZCI6Ii4uLiIsInR5cCI6IkpXVCJ9   ← header (base64)
.eyJzdWIiOiJmYWE4NjkuLi4iLCJlbWFpbCI6Ii4uLiJ9          ← payload (base64)
.ZGxzb8zsSiKJ_Wkv...                                     ← assinatura
```

**Header** declara o algoritmo e o ID da chave usada para assinar:
```json
{ "alg": "ES256", "kid": "b81269f1-...", "typ": "JWT" }
```

**Payload** contém os claims do usuário:
```json
{
  "sub": "faa86997-...",        ← ID do usuário (auth.users.id)
  "email": "sindico@local.dev",
  "role": "authenticated",
  "iss": "http://127.0.0.1:54321/auth/v1",
  "exp": 1777666847
}
```

### Os três grupos de algoritmos

**ES256 / ES384 / ES512 — ECDSA (curva elíptica)**

- Par de chaves assimétrico: chave privada assina, chave pública verifica
- Curvas: P-256 (ES256), P-384 (ES384), P-521 (ES512)
- Chaves pequenas (256 bits = segurança equivalente a RSA 3072 bits)
- Operações rápidas, tokens menores
- **O Supabase usa ES256** — escolha moderna e eficiente
- Quando usar: sistemas modernos, alta performance

**RS256 / RS384 / RS512 — RSA**

- Par de chaves assimétrico: mesma lógica, chave RSA
- Chaves grandes (2048–4096 bits), operações mais lentas
- Suporte universal — toda biblioteca JWT em toda linguagem entende RSA
- Quando usar: integração com sistemas legados ou bibliotecas antigas

**HS256 / HS384 / HS512 — HMAC (chave simétrica)**

- Um único segredo compartilhado: quem pode verificar também pode forjar
- Simples e rápido, mas inseguro quando o receptor é um serviço externo
- **Nunca usar** quando o backend valida tokens emitidos por terceiros
- Quando usar: apenas em sistemas fechados onde emissor = receptor

### Por que o projeto usa JWKS em vez de `SUPABASE_JWT_SECRET`

Com HS256 + `SUPABASE_JWT_SECRET`, qualquer processo com o segredo pode criar
tokens válidos. Se a VM for comprometida, o atacante forja tokens de qualquer
usuário.

Com ES256 + JWKS, o backend tem apenas a chave pública — matematicamente inútil
para criar tokens. A chave privada fica no GoTrue (Supabase). Comprometer a VM
não compromete a autenticação.

---

## JWKS — como o backend obtém a chave pública

JWKS (JSON Web Key Set) é um endpoint público que expõe as chaves públicas de
verificação. O Spring Boot busca esse endpoint ao iniciar e usa as chaves para
validar assinaturas JWT.

**Endpoint local:**
```
http://localhost:54321/auth/v1/.well-known/jwks.json
```

**Resposta:**
```json
{
  "keys": [{
    "alg": "ES256",
    "crv": "P-256",
    "kid": "b81269f1-21d8-4f2e-b719-c2240a840d90",
    "kty": "EC",
    "use": "sig",
    "x": "M5Sjqn5zwC9Kl1zVfUUGvv9boQjCGd45G8sdopBExB4",
    "y": "P6IXMvA2WYXSHSOMTBH2jsw_9rrzGy89FjPf6oOsIxQ"
  }]
}
```

O `kid` no header do JWT deve bater com o `kid` de uma das chaves do JWKS.
Spring Security usa esse ID para selecionar a chave correta quando há múltiplas.

**Atenção:** cada `supabase db reset` gera novas chaves. O backend precisa ser
reiniciado para buscar o JWKS atualizado — o cache do `NimbusJwtDecoder` não
auto-refresca quando o `kid` permanece o mesmo mas a chave mudou.

---

## Onde cada configuração vive

### `application.yaml` (produção)

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          jwk-set-uri: ${SUPABASE_URL}/auth/v1/.well-known/jwks.json
          jws-algorithms: ES256   # declara explicitamente EC; sem isso, Spring
                                  # pode priorizar RSA e rejeitar tokens ES256
```

`SUPABASE_URL` é injetada pelo Coolify como env var — nunca commitada.

### `application-local.yaml` (desenvolvimento)

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          jwk-set-uri: http://localhost:54321/auth/v1/.well-known/jwks.json
          jws-algorithms: ES256
```

URL hardcoded do Supabase CLI local. Sem `jws-algorithms: ES256`, o
`NimbusJwtDecoder` do Spring Boot falha com
`"Signed JWT rejected: Another algorithm expected, or no matching key(s) found"`.

### `SecurityConfig.java`

```java
.oauth2ResourceServer(oauth2 -> oauth2
    .jwt(jwt -> {}))
```

Configuração mínima — delega tudo ao auto-configure do Spring Boot, que lê
`application.yaml`. O `NimbusJwtDecoder` é criado automaticamente com a
`jwk-set-uri` e `jws-algorithms` declarados.

### `SupabaseAuthGateway.java`

```java
public UUID getCurrentUserId() {
    return UUID.fromString(jwt().getSubject());  // claim "sub"
}
public String getCurrentUserEmail() {
    return jwt().getClaimAsString("email");       // claim "email"
}
```

Único ponto do código que toca o JWT diretamente. Toda outra camada usa a
interface `AuthGateway`, sem saber que o provider é Supabase.

---

## Fluxo completo de uma requisição autenticada

```
1. Cliente envia:
   GET /api/me/condominiums
   Authorization: Bearer eyJhbGciOiJFUzI1NiIsImtpZCI6Ii4uLiJ9...

2. Spring Security intercepta:
   BearerTokenAuthenticationFilter extrai o token do header

3. NimbusJwtDecoder valida:
   a. Busca JWKS em ${SUPABASE_URL}/auth/v1/.well-known/jwks.json
   b. Encontra a chave com kid correspondente
   c. Verifica assinatura ES256 com a chave pública EC P-256
   d. Valida exp (expiração)

4. SecurityContext populado:
   Authentication = JwtAuthenticationToken { principal: Jwt }

5. TenantInterceptor executa (se X-Tenant-Id presente):
   a. Extrai X-Tenant-Id do header
   b. Chama AuthGateway.getCurrentUserId() → lê "sub" do JWT
   c. Verifica se o user pertence ao tenant (query no banco)
   d. Seta TenantContext (ThreadLocal)

6. Controller executa:
   CondominiumService.listForCurrentUser()
   → AuthGateway.getCurrentUserId() → UUID do "sub"
   → Query SQL cross-tenant

7. TenantContext.clear() no afterCompletion do interceptor
```

---

## Particularidades do seed local

O `infra/supabase/supabase/seed.sql` insere o usuário síndico diretamente via
SQL, simulando o que o GoTrue faria em produção. Três cuidados necessários:

1. **`auth.identities`** — inserir além de `auth.users` (GoTrue exige para login)
2. **Token columns não-null** — `confirmation_token`, `recovery_token`,
   `email_change`, etc. devem ser `''` (string vazia), não NULL. GoTrue
   tenta fazer scan dessas colunas como `string` (não ponteiro Go) e falha
   com `"Scan error on column index N"` se encontrar NULL
3. **Restart após `db reset`** — novas chaves EC são geradas; o backend precisa
   reiniciar para buscar o JWKS atualizado

Em produção, nenhum desses problemas existe — o GoTrue gerencia tudo via API.
