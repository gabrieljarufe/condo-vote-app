# Condo Vote — Arquitetura do Sistema

> Este documento define as decisões arquiteturais do projeto.
> Cada seção contém perguntas que devem ser respondidas antes de avançar para implementação.
> As seções estão ordenadas por **dependência** — decisões anteriores influenciam as posteriores.

---

## 0. Restrições e Contexto

Antes de qualquer decisão técnica, é preciso entender os limites reais do projeto.

### Perguntas

- **Tamanho do time:** quantas pessoas vão desenvolver e manter o sistema? (1 dev solo? time pequeno?)
- **Budget de infraestrutura:** há orçamento mensal definido? Qual a faixa aceitável? (ex: R$0, R$50, R$200+)
- **Timeline:** existe pressão de prazo para v1? (ex: precisa estar no ar em 3 meses, ou é projeto pessoal sem deadline?)
- **Domínio técnico do time:** onde o time tem mais experiência? Onde tem menos? (ex: forte em Java/Spring, fraco em DevOps)
- **Escala esperada na v1:** quantos condomínios simultâneos? (1? 10? 100?)

### Decisões

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Tamanho do time | 2-3 devs | Time pequeno; decisões devem minimizar overhead operacional |
| Budget mensal de infra | R$0 (free tier), escalando conforme necessidade | Supabase Free + Railway/Fly.io Free + Upstash Free cobrem a fase piloto. Supabase Pro (~$25/mês) quando necessário |
| Deadline v1 | ~3 meses (Jul 2026) | Meta realista com Supabase acelerando infra e time fullstack experiente |
| Expertise principal | Forte em Java/Spring + Angular; desafio é DevOps/infra | Supabase e PaaS (Railway) mitigam a fraqueza em DevOps. Backend e frontend não são gargalos |
| Escala v1 | 1-5 condomínios (piloto) | Free tier suficiente. Foco em validar o produto com poucos usuários reais |

---

## 1. Autenticação e Identidade

Esta é a decisão de maior impacto. Muda o schema do banco (a tabela `refresh_token` existe ou não?), os endpoints, o fluxo de onboarding, e o modelo de autorização inteiro.

### Perguntas

**1.1 — Quem gerencia identidade e login?**

O sistema será responsável por autenticar usuários (signup, login, reset de senha, emissão de tokens), ou isso será delegado a um Identity Provider externo?

| Opção | O que implica |
|-------|---------------|
| **Auth própria (Spring Security + JWT)** | Controle total. Tabelas `app_user`, `refresh_token` no schema. Implementar signup, login, refresh rotation, reset de senha manualmente. Mais código, mais responsabilidade de segurança |
| **Keycloak self-hosted** | Identity server dedicado. Gerencia users, tokens, roles. O app Spring só valida tokens. Elimina `refresh_token` do schema. Adiciona complexidade de deploy (mais um serviço) |
| **Auth0 / Clerk / Supabase Auth (SaaS)** | Mesma ideia do Keycloak mas gerenciado. Zero infra adicional. Custo mensal. Vendor lock-in potencial |

Perguntas de follow-up dependendo da escolha:
- Se auth própria: quem é responsável por auditar a segurança da implementação?
- Se Keycloak: o time tem experiência em operar Keycloak? Sabe configurar realms, clients, mappers?
- Se SaaS: o free tier comporta a escala v1? O que acontece quando escalar?

**1.2 — Onde vivem os papéis (síndico, owner, tenant)?**

Independente de quem autentica, alguém precisa saber que "este usuário é síndico do condomínio X".

| Opção | O que implica |
|-------|---------------|
| **No identity provider** | Roles como claims no JWT. O app não precisa consultar o banco para verificar permissões. Mas: trocar role exige atualizar o IdP, não só o banco |
| **Na aplicação (tabela `condominium_admin`)** | O app consulta o banco para cada verificação de permissão. Mas: controle total, alinhado com RLS, sem dependência externa |
| **Híbrido** | IdP sabe que o user existe e está ativo. App sabe quais papéis ele tem em cada condo. JWT tem só user_id, app resolve o resto |

**1.3 — Fluxo de convite e onboarding**

O síndico envia convite por e-mail. O morador clica no link e cria conta.

- Se auth própria: o link leva para uma tela de cadastro do app. O app cria o user.
- Se IdP externo: o link leva para onde? O IdP precisa saber sobre o convite? Ou o morador cria conta no IdP e depois o app vincula via callback?

**Pergunta crítica:** o fluxo de convite é a primeira experiência do morador com o sistema. Quanto atrito é aceitável? (1 tela? 2 telas? redirecionamento para domínio externo?)

### Decisões

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Gestão de identidade | **Supabase Auth (SaaS)** | Elimina ~500-800 linhas de código de auth. Rate limiting, brute-force protection, hashing, refresh rotation vêm prontos. Lock-in mitigado: (1) não usar PostgREST nem Edge Functions, (2) camada `AuthGateway` no Spring Boot abstrai validação de JWT — se migrar para Keycloak no futuro, só essa camada muda |
| Onde vivem os papéis | **Híbrido** | JWT do Supabase contém apenas `sub` (user_id) + `email`. Papéis (síndico, owner, tenant) vivem no banco (`condominium_admin`, `apartment_resident`) e são resolvidos pelo Spring por request, baseado no tenant ativo. Motivo: papéis são por condomínio, não por user — não cabem no JWT |
| Fluxo de onboarding | **Validação pública → signUp no Supabase → complete no Spring** | Ver detalhamento abaixo |

### Detalhamento do fluxo de onboarding

**Pré-condição:** síndico já criou o convite (`invitation` + token no Redis + email na fila).

```
1. Morador clica link do email
   → Angular carrega rota /invite?token=abc123

2. Angular → GET /api/invitations/validate?token=abc123 (PÚBLICO, sem auth)
   → Spring: Redis GET invitation:token:abc123 → invitation_id
   → Spring: SELECT invitation WHERE id=... AND status='PENDING' AND expires_at > now()
   → Retorna: {email, condominium_name, unit_number, role}

3. Morador preenche formulário
   → Campos: nome, CPF, senha, aceite LGPD
   → Email é read-only (veio do passo 2)
   → CPF é obrigatório para TODOS (OWNER e TENANT). O CPF informado aqui
     será validado contra o `invitation.cpf_encrypted` (que o síndico
     registrou ao criar o convite) no passo 5 — anti-fraude

4. Angular → supabase.auth.signUp({email, password})
   → Supabase cria auth.users, retorna session com access_token (JWT)
   → Confirmação de email DESABILITADA (convite já validou o email)

5. Angular → POST /api/register/complete (AUTENTICADO via JWT do passo 4)
   → Header: Authorization: Bearer <jwt_supabase>
   → Body: {invitation_token, name, cpf, consent_policy_version}

   Spring executa em transação:
   a. Valida JWT via JWKS do Supabase → extrai user_id (sub)
   b. Redis GET invitation:token → invitation_id
   c. Valida invitation (PENDING, não expirado, email confere com JWT)
   d. Valida que o CPF informado confere com invitation.cpf_encrypted (anti-fraude)
      — Regra vale para OWNER e TENANT; todo convite tem CPF
   e. INSERT app_user (id = jwt.sub, name, email, cpf_encrypted=AES256(cpf))
      — OU se app_user já existe (segundo+ convite): pula INSERT, valida que CPF confere
   e. INSERT apartment_resident (user_id, apartment_id, role)
   f. UPDATE apartment SET eligible_voter_user_id = user_id (se OWNER)
   g. UPDATE invitation SET status='ACCEPTED', accepted_at=now()
   h. INSERT audit_event
   i. COMMIT
   j. Redis DEL invitation:token:abc123

6. Morador autenticado — JWT em memória, refresh gerenciado pelo Supabase SDK
```

### User já existente (múltiplos apartamentos)

Uma mesma pessoa pode ser convidada para mais de um apartamento no mesmo condomínio (ex: proprietário de apt 101 e apt 201). Nesse caso, na segunda vez o user já tem conta no Supabase e `app_user` no banco.

O frontend detecta isso no passo 4:

```
4a. Angular tenta supabase.auth.signUp({email, password})
    → Se SUCESSO: user novo, segue para passo 5 normalmente
    → Se ERRO "User already registered":
       → Angular mostra tela de login (email + senha)
       → User loga: supabase.auth.signInWithPassword({email, password})
       → Recebe JWT → segue para passo 5

5. POST /api/register/complete (mesmo endpoint, idempotente)
   → Spring detecta que app_user já existe (SELECT por jwt.sub)
   → Pula INSERT app_user
   → Cria apenas apartment_resident para o novo apartamento
   → Aceita invitation normalmente
```

O endpoint `/register/complete` é **idempotente em relação ao app_user** — funciona tanto para user novo quanto para user existente. A lógica é:
- `app_user` existe? → usa o existente
- `app_user` não existe? → cria

**Ponto de atenção — orphan no Supabase:** se o passo 4 (signUp) funcionar mas o passo 5 (complete) falhar, existe um `auth.users` sem `app_user` correspondente. Mitigação:
- `/register/complete` é **idempotente**: se chamado de novo com o mesmo JWT e token válido, completa o cadastro
- Para a v1 piloto, isso é suficiente. Job de cleanup fica como melhoria futura se necessário

### Validação de JWT no Spring Boot

```yaml
# application.yml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          jwk-set-uri: https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json
```

O Spring cacheia a chave pública do Supabase em memória. Nenhuma chamada de rede ao Supabase por request — validação é local.

### Camada AuthGateway

Interface que abstrai "quem é o usuário autenticado":

```java
public interface AuthGateway {
    UUID getCurrentUserId();    // extrai do SecurityContext
    String getCurrentEmail();   // extrai do JWT claims
}
```

Implementação v1 lê claims do JWT do Supabase. Se migrar para Keycloak, só a implementação muda.

### Refresh de tokens

Gerenciado inteiramente pelo Supabase JS SDK no Angular:
- Access token expira em ~1h (configurável no Dashboard)
- SDK detecta expiração e usa refresh token para obter novo access token
- Angular não precisa de interceptor manual para refresh
- Evento `onAuthStateChange('TOKEN_REFRESHED')` disponível se necessário

### Bootstrap operacional v1 (novo condomínio + primeiro síndico)

A criação de um novo condomínio + seu primeiro síndico é feita via **migration Flyway versionada**, não por operação ad-hoc no Studio. Motivos:

- **Auditabilidade total:** cada bootstrap vira commit no git → reviewable via PR, rastreável por blame
- **Reprodutibilidade:** o mesmo artefato aplica em local, CI (Testcontainers) e prod
- **Consistência com o resto do schema:** Flyway já é a fonte da verdade de DDL e seed — não inventar um canal paralelo
- **Rollback documentado:** se errar, migration compensatória (ver "Estratégia de rollback" na Seção 3)

### Runbook: adicionar um novo condomínio + síndico

```
1. Operador cria o user no Supabase Auth (projeto prod)
   - Dashboard → Auth → Users → "Invite user" (envia email de set-password)
   - Ou CLI: supabase auth admin create-user --email sindico@condo.com
   - Copiar o UUID gerado (será o app_user.id)

2. Operador gera o ciphertext do CPF localmente
   ./scripts/encrypt-cpf.sh 12345678901
   → retorna BYTEA em hex: \x7a3f...

   O script usa a mesma CPF_ENCRYPTION_KEY da prod
   (lida de um cofre — 1Password/Bitwarden; nunca committar a chave).

3. Operador cria o arquivo de migration no repo:

   src/main/resources/db/migration/
   └── bootstrap/
       └── V1001__bootstrap_condo_piloto_rua_x.sql

   Naming: V1001+ reservado para bootstraps de condomínio
   (1-999 reservados para DDL do schema; evita conflito de numeração
   se um PR de schema for mergeado enquanto o bootstrap está em review).

   Conteúdo:
   -- V1001__bootstrap_condo_piloto_rua_x.sql
   -- Bootstrap: Condomínio Piloto, síndico: <nome>
   -- Autorizado por: <operador>, em <data>

   INSERT INTO condominium (id, name, address) VALUES
     ('<uuid_gerado_offline>', 'Condomínio Piloto', 'Rua X, 123');

   INSERT INTO app_user (
     id, name, email, cpf_encrypted,
     consent_accepted_at, consent_policy_version
   ) VALUES (
     '<uuid_do_passo_1>',
     'Nome do Síndico',
     'sindico@condo.com',
     '\x7a3f...',   -- ciphertext do passo 2
     now(), 'v1'
   );

   INSERT INTO condominium_admin (condominium_id, user_id) VALUES
     ('<uuid_condominium>', '<uuid_do_passo_1>');

   INSERT INTO audit_event (
     condominium_id, actor_user_id, event_type,
     entity_type, entity_id, payload
   ) VALUES (
     '<uuid_condominium>',
     '00000000-0000-0000-0000-000000000001',  -- system user
     'ADMIN_GRANTED', 'CONDOMINIUM_ADMIN', '<uuid_do_passo_1>',
     jsonb_build_object(
       'source', 'BOOTSTRAP_MIGRATION',
       'migration', 'V1001',
       'operator', '<nome_do_operador>'
     )
   );

4. PR: feature/bootstrap-condo-piloto → develop
   - CI roda: Flyway aplica a migration em Postgres Testcontainer
   - Review por outro dev (revisa dados, confere UUIDs, valida CPF encrypted)
   - Merge

5. PR: develop → main
   - Deploy em Railway → Flyway aplica V1001 em prod
   - Spring sobe → síndico já consegue logar

6. Operador comunica ao síndico: URL + credenciais iniciais
   Síndico loga → troca senha → usa "Cadastro em massa de convites"
```

**Por que não via app/endpoint:** elimina necessidade de modelar superadmin + autorização especial + UI administrativa na v1. Para o piloto (1-5 condos em ~3 meses), uma migration por condo é trivial e dá rastreabilidade total.

**Por que CPF encrypted no git é aceitável:** o ciphertext é AES-256; sem a chave (guardada em cofre + env var de prod), não é reversível. Trade-off consciente: migration fica reproduzível sem precisar de mecanismo externo de injeção de dados.

**Script auxiliar `encrypt-cpf.sh`:** utilitário CLI em `/scripts/` que lê a `CPF_ENCRYPTION_KEY` de env local e imprime o ciphertext em hex. Mesma implementação que a classe `CpfEncryptor` do Spring — idealmente extraída para um pacote compartilhado ou um main class executável (`java -jar cpf-encryptor.jar <cpf>`).

### Configurações no Supabase Dashboard

### Configurações no Supabase Dashboard

| Configuração | Valor | Motivo |
|-------------|-------|--------|
| Email confirmations | OFF | Todos os users chegam via convite — email já validado |
| JWT expiry | 3600s (1h) | Padrão do Supabase, suficiente para v1 |
| Minimum password length | 8 | Padrão razoável para v1 |
| Refresh token rotation | ON (padrão) | Previne reuso de refresh tokens vazados |
| SMTP customizado | Resend (SMTP credentials) | Todos os emails do Supabase Auth (reset de senha) saem pelo mesmo domínio/remetente que os emails transacionais do app. Configurado em Auth → SMTP Settings no Dashboard |

---

## 2. Arquitetura do Backend

### Perguntas

**2.1 — Monolito ou serviços?**

| Opção | Quando faz sentido |
|-------|-------------------|
| **Monolito Spring Boot** | Time pequeno, v1, domínio coeso. Um artefato para deploy, um banco, menos overhead operacional |
| **Monolito modular** | Monolito mas com módulos bem separados (auth, polls, apartments). Permite extrair para serviços no futuro sem reescrever |
| **Microserviços** | Time grande, domínios muito diferentes, necessidade de escalar componentes independentemente. Overhead operacional alto |

**2.2 — Estrutura interna do projeto**

Como o código é organizado dentro do monolito?

| Opção | Descrição |
|-------|-----------|
| **Package by layer** | `controller/`, `service/`, `repository/` — simples, familiar, mas acopla domínios diferentes |
| **Package by feature** | `poll/`, `apartment/`, `auth/` — cada feature tem seu controller, service, repository. Melhor isolamento |
| **Hexagonal / Ports & Adapters** | Domain core sem dependência de framework. Adapters para HTTP, DB, email. Mais abstração, mais boilerplate |

**2.3 — Como o app gerencia transações e RLS?**

O data model usa RLS com `SET LOCAL app.current_tenant`. Isso implica:

- Cada request precisa abrir uma transação e setar o tenant antes de qualquer query
- Onde isso acontece? Filter? Interceptor? AOP?
- O que acontece em operações cross-tenant? (ex: um user logado precisa ver em quais condos está vinculado — isso é uma query sem tenant)

**2.4 — Validação e error handling**

- Validação de domínio (ex: mínimo 2 opções por poll) — onde vive? Na entity? No service? Em um domain validator separado?
- Erros de constraint do banco (ex: voto duplicado) — como são mapeados para HTTP? (ex: `DataIntegrityViolationException` → `409 Conflict`)
- Existe uma estratégia unificada ou cada endpoint trata individualmente?

### Decisões

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Arquitetura geral | **Monolito modular** | Um artefato Spring Boot com módulos bem separados (`auth/`, `poll/`, `apartment/`, `notification/`, `shared/`). Microserviços é overhead injustificável para 2-3 devs e 3 meses. A "peça de User/Email" virou módulo interno (`auth/`) — com Supabase Auth, restam apenas ~4-5 classes (AuthGateway, RegisterController, RegisterService, app_user CRUD). Não justifica serviço separado. Fronteira de módulo permite extração futura sem reescrita |
| Estrutura de packages | **Package by feature + DDD-lite** | Cada módulo contém seu controller, service, repository, DTOs. Entities têm comportamento (não anêmicas): `poll.canBeOpened()`, `poll.isQuorumReached()`. Controllers são finos (valida → service → response). Services orquestram (chamam entity methods + repositories + outros services). Sem maquinaria formal de DDD (sem aggregate roots, domain events, bounded contexts, specification pattern). Estrutura: `auth/`, `poll/`, `apartment/`, `condominium/`, `notification/`, `shared/` |
| Estratégia de RLS no app | **Interceptor + @Transactional** | `HandlerInterceptor` extrai `X-Tenant-Id` do header e guarda em `TenantContext` (ThreadLocal). Um `TransactionInterceptor` customizado (AOP) executa `SET LOCAL app.current_tenant = :id` no início de cada transação. Para operações **cross-tenant** (ex: listar condomínios do user), o controller não envia `X-Tenant-Id` e o interceptor não seta tenant — a query roda sem RLS filtering. Ver detalhamento abaixo |
| Estratégia de validação | **Bean Validation + @ControllerAdvice** | DTOs de entrada usam `@Valid` com annotations (`@NotBlank`, `@Size`, `@Email`). Regras de domínio vivem no Service (ex: "mínimo 2 opções por poll", "user é síndico deste condo"). `@RestControllerAdvice` global mapeia exceções para HTTP: `ConstraintViolationException` → 400, `DataIntegrityViolationException` (voto duplicado) → 409, `ForbiddenException` (custom) → 403, `NotFoundException` (custom) → 404 |

### Detalhamento: Estratégia de RLS no app

```
── Request com tenant (maioria dos endpoints) ──

  Angular envia:
    Authorization: Bearer <jwt>
    X-Tenant-Id: <condominium_uuid>

  Spring:
    1. TenantInterceptor.preHandle()
       → Extrai X-Tenant-Id do header
       → Valida que é UUID válido
       → Valida que o user autenticado pertence a esse condo
         (SELECT 1 FROM condominium_admin WHERE user_id=? AND condominium_id=? AND revoked_at IS NULL
          UNION
          SELECT 1 FROM apartment_resident WHERE user_id=? AND condominium_id=? AND ended_at IS NULL)
       → Se nenhum resultado: 403 Forbidden
       → Guarda em TenantContext.set(condominiumId)  // ThreadLocal
       → NÃO resolve papel (síndico/owner/tenant) — isso é responsabilidade de cada endpoint

    2. @Transactional no Service method
       → AOP intercepta, abre transação
       → Executa: SET LOCAL app.current_tenant = :condominiumId
       → Todas as queries subsequentes são filtradas por RLS
       → Ao commit/rollback, SET LOCAL é automaticamente desfeito

    3. TenantInterceptor.afterCompletion()
       → TenantContext.clear()  // limpa ThreadLocal


── Request sem tenant (cross-tenant) ──

  Endpoints que NÃO operam num condo específico:
    GET /api/me/condominiums  → lista condos do user
    POST /api/register/complete → cadastro (ainda sem condo ativo)

  Angular NÃO envia X-Tenant-Id.
  TenantInterceptor detecta ausência → não seta tenant.
  Transação roda sem SET LOCAL → RLS não filtra.
  Estes endpoints usam queries explícitas com WHERE user_id = :userId.
```

### Autorização por endpoint

O papel do user (síndico, owner, tenant) **não é resolvido no interceptor**. Cada endpoint verifica individualmente a permissão necessária:

- **Endpoints de síndico** (criar poll, cancelar, convidar, alterar inadimplência): o service consulta `condominium_admin` para verificar se o user é síndico ativo do condo.
- **Endpoints de morador** (votar, delegar): o service consulta `apartment_resident` e/ou `poll_eligible_snapshot`.
- **Endpoints de leitura** (listar polls, ver resultado): acessíveis a qualquer membro do condo (o interceptor já validou pertencimento).

Isso permite que um user seja **síndico e morador simultaneamente** sem conflito de papel — cada endpoint verifica exatamente o que precisa. Exemplo: o mesmo user pode criar uma votação (verifica `condominium_admin`) e votar nela (verifica `poll_eligible_snapshot`).

### Estrutura de packages (DDD-lite)

```
src/main/java/com/condovote/
├── auth/                         ← autenticação e cadastro
│   ├── AuthGateway.java              interface (abstrair provider de auth)
│   ├── SupabaseAuthGateway.java      implementação (extrai claims do JWT)
│   ├── RegisterController.java       POST /register/complete (thin)
│   ├── RegisterService.java          orquestra: valida invitation + cria user + vincula apt
│   └── dto/
│       └── RegisterRequest.java
├── poll/                         ← votações
│   ├── PollController.java           thin: valida input, chama service
│   ├── PollService.java              orquestra: cria poll, abre, fecha, gera snapshot
│   ├── PollRepository.java           interface Spring Data
│   ├── Poll.java                     entity com comportamento:
│   │                                   poll.canBeOpened()
│   │                                   poll.isQuorumReached(snapshotCount)
│   │                                   poll.transition(newStatus)
│   ├── PollOption.java
│   ├── VoteController.java
│   ├── VoteService.java
│   ├── Vote.java                     entity: vote.belongsToApartment(aptId)
│   └── dto/
├── apartment/                    ← apartamentos e moradores
│   ├── ApartmentController.java
│   ├── ApartmentResidentService.java
│   ├── DelegationService.java        lógica de delegação de voto
│   ├── Apartment.java                entity: apt.isEligible(), apt.currentOwner()
│   ├── ApartmentResident.java        entity: resident.isActive(), resident.end(reason)
│   └── dto/
├── condominium/                  ← condomínios e síndicos
│   ├── CondominiumController.java
│   ├── CondominiumAdminService.java
│   └── dto/
├── invitation/                   ← convites (lifecycle próprio)
│   ├── InvitationController.java
│   ├── InvitationService.java        orquestra: cria, reenvia, expira, valida token
│   ├── Invitation.java               entity: inv.accept(), inv.revoke(userId), inv.isExpired()
│   ├── InvitationRepository.java
│   └── dto/
├── notification/                 ← email outbox
│   ├── EmailNotificationService.java  enfileira emails na mesma transação
│   ├── EmailSenderJob.java            job assíncrono: processa PENDING, retry com backoff
│   └── dto/
├── shared/                       ← infraestrutura transversal
│   ├── tenant/
│   │   ├── TenantContext.java         ThreadLocal holder
│   │   ├── TenantInterceptor.java     HandlerInterceptor
│   │   └── TenantTransactionAspect.java  AOP: SET LOCAL
│   ├── exception/
│   │   ├── GlobalExceptionHandler.java   @RestControllerAdvice
│   │   ├── ForbiddenException.java
│   │   └── NotFoundException.java
│   └── config/
│       └── SecurityConfig.java        Spring Security + JWKS
└── CondoVoteApplication.java
```

**Princípios DDD-lite aplicados:**
- Entities vivem dentro do módulo que as "dono" — não numa pasta `entity/` global
- Entities têm métodos de negócio (não são apenas getters/setters)
- Services orquestram: chamam entity methods → repositories → outros services
- Controllers são finos: deserializa → `@Valid` → service → serializa
- Comunicação entre módulos é direta (service chama service), sem event bus
- DTOs de request/response nunca são a entity JPA

### Endpoints de ação do síndico (não cobertos nos jobs)

Ações manuais do síndico que não são automáticas (jobs):

| Endpoint | Método | Requer | O que faz |
|----------|--------|--------|-----------|
| `/api/polls/{id}/open` | POST | Síndico | Abertura manual: SCHEDULED → OPEN. Gera snapshot, enfileira emails, audit_event `POLL_OPENED_MANUALLY` |
| `/api/polls/{id}/cancel` | POST | Síndico | Cancelamento: SCHEDULED/OPEN → CANCELLED. Body: `{reason}`. Atualiza `cancelled_at/by/reason`, audit_event `POLL_CANCELLED`, enfileira email |
| `/api/apartments/{id}/delegate` | POST | Proprietário | Delega voto ao inquilino. Body: `{tenant_user_id}`. Atualiza `eligible_voter_user_id`. Bloqueado se apt tem poll OPEN no snapshot |
| `/api/apartments/{id}/delegate` | DELETE | Proprietário | Revoga delegação. Proprietário volta a ser votante. Bloqueado se apt tem poll OPEN no snapshot |
| `/api/apartments/{id}/residents/{residentId}/promote` | POST | Síndico | Promove inquilino a proprietário. Encerra vínculo TENANT (`PROMOTED_TO_OWNER`), cria novo OWNER, atualiza `eligible_voter_user_id`. Bloqueado se apt tem poll OPEN no snapshot |
| `/api/invitations/bulk` | POST | Síndico | **Cadastro em massa de convites.** Body: CSV (ou JSON array) com linhas `{block, unit_number, email, cpf, role}`. Na mesma transação: cria/reusa apartamentos inexistentes (audit `APARTMENT_CREATED`), cria invitations (audit `INVITATION_SENT`), enfileira e-mails. Resposta: `{created: N, skipped: [{line, reason}]}` — linhas inválidas (email duplicado já PENDING, CPF inválido, etc.) são reportadas sem abortar as demais |

### Edição de poll agendada

Enquanto o poll está no estado **SCHEDULED**, **todos os campos são editáveis**: título, descrição, opções, datas (`scheduled_start`/`scheduled_end`), `quorum_mode`, `convocation`. A partir do momento em que transita para **OPEN**, nenhum campo é editável.

### Verificação de elegibilidade no voto (VoteService)

```
1. Poll está OPEN? → Se não: 400
2. apartment_id está no poll_eligible_snapshot? → Se não: 403
3. voter_user_id == snapshot.eligible_voter_user_id? → Se não: 403
4. Já existe vote para (poll_id, apartment_id)? → Se sim: 409
5. INSERT vote
```

Verificação é **100% contra o snapshot**. Se o votante habilitado for removido durante a votação, o apartamento perde o voto nesta votação. O snapshot é imutável e define tanto quais apartamentos quanto quem pode votar.

---

## 3. Banco de Dados e Persistência

### Perguntas

**3.1 — Banco gerenciado ou self-hosted?**

| Opção | Trade-off |
|-------|-----------|
| **Self-hosted (Docker/VPS)** | Custo menor, controle total, responsabilidade de backup/recovery/upgrade é sua |
| **Gerenciado (RDS, Supabase, Neon)** | Backup automático, scaling, patching. Custo mensal. Menos controle sobre extensões e configs |

**3.2 — Estratégia de migrations**

O data model está definido em Markdown. Como vira schema real?

| Opção | Descrição |
|-------|-----------|
| **Flyway** | Migrations SQL versionadas (`V1__create_condominium.sql`, `V2__...`). Controle total do SQL |
| **Liquibase** | Migrations em XML/YAML/SQL. Mais features (rollback, diff), mais complexidade |
| **JPA/Hibernate auto-DDL** | Gera schema a partir das entities. Conveniente para dev, perigoso em produção |

**3.3 — Ambiente de desenvolvimento local**

- Docker Compose com PostgreSQL para dev local?
- Seed de dados para dev (síndico, condo, apartments) — existe ou precisa criar?
- Testcontainers para testes de integração?

### Decisões

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Hosting do banco | **Supabase (Postgres gerenciado)** | Decidido na Seção 1. Backup automático, patching, dashboard Studio. Free tier suficiente para piloto. Mesmo Postgres da auth, schema `public` para tabelas de domínio |
| Ferramenta de migrations | **Flyway** | Migrations SQL versionadas (`V1__create_condominium.sql`). Controle total do SQL — necessário para criar RLS policies, enums PostgreSQL, índices parciais, triggers. Integração nativa com Spring Boot (`spring.flyway.url`). Roda tanto contra Supabase remoto quanto contra Postgres local |
| Setup local | **Supabase CLI + Testcontainers** | Ver detalhamento abaixo |
| Ambientes | **Local + Produção** | Staging remoto fica para quando o time crescer. Para piloto com 2-3 devs, local + prod é suficiente |

### Detalhamento: Ambientes

```
┌────────────────────────────────────────────────────────────┐
│  LOCAL (máquina do dev)                                    │
│                                                            │
│  Supabase CLI: supabase init + supabase start              │
│  ├── Postgres (porta 54322) — Flyway aplica migrations     │
│  ├── GoTrue / Auth (porta 54321) — testa signUp/signIn     │
│  └── Studio (porta 54323) — dashboard web para inspecionar │
│                                                            │
│  Spring Boot: ./mvnw spring-boot:run (profile "local")     │
│  Angular: ng serve                                         │
│  Redis: Docker (redis:7-alpine) ou Upstash free            │
│                                                            │
│  Seed de dados (Flyway repeatable migration R__seed.sql):  │
│  ├── 1 condomínio de teste                                 │
│  ├── 1 síndico (condominium_admin + app_user)              │
│  │   → User criado manualmente no Supabase (Dashboard ou   │
│  │     supabase auth admin create-user). UUID copiado       │
│  │     para o seed SQL.                                     │
│  ├── 3-5 apartamentos                                      │
│  └── 1 proprietário + 1 inquilino cadastrados              │
├────────────────────────────────────────────────────────────┤
│  TESTES AUTOMATIZADOS (CI ou local: ./mvnw test)           │
│                                                            │
│  Testcontainers:                                           │
│  ├── PostgreSQL container efêmero por test suite           │
│  ├── Flyway aplica migrations (mesmas da prod)             │
│  ├── Testa: RLS policies, constraints, índices parciais    │
│  └── Redis Testcontainer para testes de invitation token   │
│                                                            │
│  JWT mockado: SecurityContext injetado com user_id fake     │
│  (não depende de Supabase para rodar testes)               │
├────────────────────────────────────────────────────────────┤
│  PRODUÇÃO (remoto)                                         │
│                                                            │
│  Supabase (projeto principal) — Postgres + Auth            │
│  Spring Boot em Railway/Fly.io                             │
│  Angular em Vercel                                         │
│  Redis em Upstash                                          │
└────────────────────────────────────────────────────────────┘
```

### Flyway + Supabase: como funciona

Flyway conecta direto no Postgres do Supabase (connection string do Dashboard). As migrations são SQL puro:

```
src/main/resources/db/migration/
├── V1__create_enums.sql              ← resident_role, poll_status, etc.
├── V2__create_condominium.sql        ← tabela + RLS policy
├── V3__create_apartment.sql          ← tabela + RLS + índice funcional UNIQUE
├── V4__create_app_user.sql           ← tabela (sem RLS — cross-tenant)
├── V5__create_apartment_resident.sql ← tabela + RLS + constraints
├── V6__create_invitation.sql         ← tabela + RLS + CHECK + índice parcial
├── V7__create_poll.sql               ← tabela + RLS + lifecycle constraints
├── V8__create_poll_option.sql
├── V9__create_vote.sql               ← tabela + RLS + UNIQUE (poll_id, apartment_id), imutável
├── V10__create_poll_eligible_snapshot.sql
├── V11__create_poll_result.sql
├── V12__create_audit_event.sql
├── V13__create_email_notification.sql
└── R__seed_dev_data.sql              ← repeatable migration (só roda em profile local)
```

Cada migration inclui a RLS policy da tabela:

```sql
-- V2__create_condominium.sql
CREATE TABLE condominium (...);

ALTER TABLE condominium ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON condominium
    USING (id = current_setting('app.current_tenant')::uuid);
```

### Convenções de numeração de migrations

| Faixa | Uso |
|-------|-----|
| `V1` – `V999` | DDL do schema de domínio (tabelas, índices, enums, RLS, constraints) |
| `V1001` – `V1999` | Bootstraps de condomínio (um arquivo por condomínio — ver Seção 1) |
| `V9000+` | Migrations compensatórias (rollback via forward) |
| `R__*.sql` | Repeatable (seed de dev, views recalculadas). Só em profile `local` |

Faixas reservadas evitam que um PR de schema e um PR de bootstrap colidam na próxima versão disponível.

### Estratégia de rollback de migrations

Flyway Community **não suporta undo nativo** (é feature do Flyway Teams). Política adotada:

- **Migrations são forward-only.** Nunca editar uma migration já aplicada em prod — mesmo que ainda não tenha saído do `develop`, se outro dev aplicou localmente, a edição gera `checksum mismatch`
- **Correção de bug em migration = nova migration compensatória.** Ex: se `V42__add_column.sql` usou tipo errado, criar `V9042__fix_v42_column_type.sql`
- **Migrations destrutivas** (`DROP TABLE`, `DROP COLUMN`, `ALTER ... TYPE` que perde dados) seguem ritual especial:
  1. PR dedicado (nunca junto com feature) — facilita revert
  2. Review por 2 devs (em vez de 1)
  3. Backup manual do Supabase **antes** do deploy (Dashboard → Database → Backups → "Create backup")
  4. Janela de deploy fora de horário de uso do piloto
  5. Migration compensatória pronta no branch, para o caso de precisar reverter (não recupera dados deletados, mas restaura schema)
- **Rollback de aplicação ≠ rollback de banco.** Se o deploy do Spring quebrar pós-migration, Railway faz rollback do container mas a migration **permanece aplicada**. O app anterior precisa continuar compatível com o schema novo — regra prática: separar mudanças de schema em duas fases quando necessário (ex: adicionar coluna nullable → deploy app que popula → PR posterior torna NOT NULL)
- **Config Flyway:**
  - `spring.flyway.validate-on-migrate=true` (detecta checksum mismatch)
  - `spring.flyway.out-of-order=false` (obriga ordem estrita de versões)
  - `spring.flyway.baseline-on-migrate=true` + `baseline-version=0` (só no primeiro deploy)

### Estratégia de testes (pirâmide)

Pirâmide clássica adaptada ao stack:

```
         ╱  E2E  ╲              ~10% — Playwright: jornadas críticas ponta a ponta
        ╱─────────╲                    (onboarding, criar poll, votar, ver resultado)
       ╱  Integr.  ╲            ~30% — @SpringBootTest + Testcontainers:
      ╱─────────────╲                  controllers + service + DB real.
     ╱    Unit       ╲          ~60% — JUnit 5 puro: entities com comportamento,
    ╱─────────────────╲               services com mocks, utilitários (CpfEncryptor)
```

**Unit tests (backend):**
- Alvo: entity methods (`poll.canBeOpened()`, `poll.isQuorumReached()`), services com dependências mockadas (Mockito), utilitários (criptografia, validação)
- Sem Spring context — rápidos (<1s por teste)
- Regra: toda regra de negócio documentada na spec deve ter teste unit explícito citando a regra (ex: `@DisplayName("quórum qualificado 2/3 não atinge com 60% de votos favoráveis")`)

**Integration tests (backend):**
- Alvo: fluxos de service que tocam DB, incluindo **RLS policies** (crítico — RLS quebrada vaza tenant)
- Stack: `@SpringBootTest` + Testcontainers (Postgres + Redis) + Flyway aplicando as migrations reais
- Teste mandatório por tabela com RLS: "usuário do tenant A não consegue ler/escrever registros do tenant B"
- JWT mockado via `@WithMockJwtUser` (custom annotation) — não depende do Supabase
- Também cobrem: jobs `@Scheduled` (chamar o método diretamente), transactional outbox, idempotência

**E2E (frontend + backend):**
- Alvo: 5-10 jornadas críticas. Não cobrir tudo — custo alto, manutenção cara
- Stack: Playwright contra ambiente local (Supabase CLI + Spring + Angular)
- Jornadas v1:
  1. Síndico aceita bootstrap → entra no app → cadastro em massa de convites
  2. Morador recebe email → aceita convite → loga
  3. Síndico cria poll (DRAFT → SCHEDULED) → abre manualmente
  4. Morador vota em poll OPEN
  5. Poll fecha automaticamente → todos veem resultado
  6. Poll invalidado por quórum não atingido (Primeira Convocação)
  7. Proprietário delega voto ao inquilino → inquilino vota
  8. Síndico cancela poll com motivo

**Frontend unit/component (Angular):**
- Jest + Angular Testing Library: componentes críticos (formulários de voto, telas de criação de poll)
- Não perseguir cobertura alta — priorizar componentes com lógica

**Cobertura:** sem meta numérica global. Meta qualitativa: **100% das regras de negócio da spec têm pelo menos 1 teste unit ou integration explícito**. Jacoco gera relatório no CI para visibilidade, sem gate de merge.

**CI:**
- PR abre → GitHub Actions roda `./mvnw verify` (unit + integration com Testcontainers)
- E2E roda em cron noturno (caro pra rodar em cada PR no piloto); pode ser promovido a gate quando o time crescer

---

## 4. Jobs e Automação

O ciclo de vida do poll depende de ações automáticas: abrir na `scheduled_start`, fechar na `scheduled_end` ou quando todos votaram, gerar snapshot na abertura.

### Perguntas

**4.1 — Como os jobs automáticos são executados?**

| Opção | Trade-off |
|-------|-----------|
| **Spring `@Scheduled`** | Simples. Roda dentro do mesmo processo. Não sobrevive a restart. Problemático com múltiplas instâncias (execução duplicada) |
| **Spring + ShedLock** | `@Scheduled` com lock distribuído via banco. Resolve duplicação em múltiplas instâncias. Simples de adicionar |
| **Fila de mensagens (RabbitMQ, SQS)** | Eventos agendados como mensagens com delay. Mais robusto, mais infraestrutura |
| **Cron externo (GitHub Actions, AWS EventBridge)** | Job externo chama um endpoint do app. Desacoplado, mas adiciona dependência externa |

**4.2 — Granularidade do polling**

- Com que frequência o job verifica se um poll deve abrir/fechar? (a cada minuto? 5 minutos? 30 segundos?)
- Qual a tolerância de atraso aceitável? (se o poll deveria abrir às 14:00, abrir às 14:01 é ok?)

**4.3 — Idempotência**

- Se o job rodar duas vezes para o mesmo poll, o resultado deve ser o mesmo (snapshot não duplica, status não transita duas vezes)
- Como garantir isso? (status check antes de transitar? lock pessimista?)

### Decisões

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Mecanismo de jobs | **Spring `@Scheduled`** | v1 roda 1 instância do Spring Boot — @Scheduled é suficiente. Se escalar para 2+ instâncias, adicionar ShedLock (lock via banco, ~30min de setup). Fila de mensagens é overkill para piloto |
| Frequência de polling | **1 minuto** | Poll agendado para 14:00 abre entre 14:00 e 14:01. Tolerância aceitável para votação condominial. Baixo custo de CPU (~1 query leve por minuto) |
| Estratégia de idempotência | **Status check + SELECT FOR UPDATE** | Job faz `SELECT FOR UPDATE WHERE status='SCHEDULED' AND scheduled_start <= now()`. Se já transitou, retorna 0 rows. Lock pessimista garante atomicidade mesmo sob retry |

### Jobs previstos

| Job | Frequência | O que faz |
|-----|-----------|-----------|
| `PollOpenerJob` | @Scheduled(fixedRate = 60s) | `SELECT polls WHERE status='SCHEDULED' AND scheduled_start <= now()` → para cada: gera snapshot, transita para OPEN, enfileira emails "votação aberta" |
| `PollCloserJob` | @Scheduled(fixedRate = 60s) | `SELECT polls WHERE status='OPEN' AND scheduled_end <= now()` → para cada: computa resultado, transita para CLOSED ou INVALIDATED, enfileira emails |
| `AllVotedCheckerJob` | @Scheduled(fixedRate = 60s) | `SELECT polls WHERE status='OPEN'` → para cada: compara `COUNT(votes)` com `COUNT(snapshot)`. Se iguais, fecha antecipadamente (trigger = `AUTOMATIC_ALL_VOTED`) |
| `InvitationExpirerJob` | @Scheduled(fixedRate = 3600s) | `UPDATE invitations SET status='EXPIRED' WHERE status='PENDING' AND expires_at < now()`. Sincroniza PG com Redis (token já expirou via TTL) |
| `EmailSenderJob` | @Scheduled(fixedRate = 30s) | `SELECT email_notifications WHERE status='PENDING' AND scheduled_for <= now()` → envia via provider. Retry com backoff em FAILED |
| `ReminderEnqueuerJob` | @Scheduled(cron = "0 0 * * * *") | 1x por hora: verifica polls OPEN com `scheduled_end` em < 24h e sem lembrete enviado → enfileira emails de lembrete para não-votantes |

### Detalhamento: idempotência por job

```
PollOpenerJob (exemplo):

  @Scheduled(fixedRate = 60_000)
  @Transactional
  public void openScheduledPolls() {
      // SELECT FOR UPDATE garante que 2 execuções não abrem o mesmo poll
      List<Poll> polls = pollRepository
          .findScheduledReadyToOpen(now());  // status=SCHEDULED AND start <= now()
                                              // com FOR UPDATE

      for (Poll poll : polls) {
          // 1. Gerar snapshot (write-once, UNIQUE (poll_id, apartment_id) impede duplicata)
          snapshotService.generateForPoll(poll);

          // 2. Transitar status
          poll.transition(PollStatus.OPEN);  // entity method valida transição
          poll.setOpenedAt(now());

          // 3. Enfileirar emails (mesma transação)
          notificationService.enqueuePollOpened(poll);
      }
  }
```

### Nota sobre carga

A v1 piloto (1-5 condos, ~100 users) gera carga trivial:
- Auth (login/signup) vai direto para Supabase — não toca o Spring Boot
- Votos, cadastros, leituras: ~320 requests/4min no pico = ~1.3 TPS
- Capacidade do Spring Boot (HikariCP 10 conn): ~2000 TPS
- Jobs @Scheduled: 1 query leve/minuto, independente da carga de requests

Para escalar além (1000+ users simultâneos): aumentar HikariCP pool, migrar para Supabase Pro, considerar ShedLock se >1 instância.

---

## 5. E-mail e Notificações

A spec define 8 tipos de notificação por e-mail na v1.

### Perguntas

**5.1 — Provider de e-mail transacional**

| Opção | Free tier | Custo |
|-------|-----------|-------|
| **Amazon SES** | 62K/mês (se no EC2) | ~$0.10/1000 emails |
| **SendGrid** | 100/dia | A partir de $20/mês |
| **Resend** | 3K/mês | $20/mês para 50K |
| **Mailgun** | Sem free tier | $35/mês |
| **SMTP próprio** | Ilimitado | Alto risco de cair em spam |

**5.2 — Envio síncrono ou assíncrono?**

- **Síncrono:** o endpoint que cria o poll também envia os e-mails na mesma request. Simples, mas lento e frágil (se o SMTP falhar, a request falha?)
- **Assíncrono:** o endpoint cria o poll e publica um evento. Um listener/worker envia os e-mails. Resiliente, mas mais complexidade

**5.3 — Templates**

- Quem renderiza o HTML do e-mail? (Thymeleaf? FreeMarker? Template no provider?)
- Os templates ficam no código ou são editáveis externamente?

### Decisões

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Provider de e-mail | **Resend** | 3K emails/mês grátis (suficiente para piloto). API moderna com SDK Java. Developer experience boa. $20/mês para 50K quando escalar. Sem overhead de setup como SES (sem sandbox, sem IAM) |
| Síncrono vs assíncrono | **Assíncrono via transactional outbox** | Já definido no data model: `email_notification` (tabela outbox). Service enfileira na mesma transação da operação de domínio. `EmailSenderJob` (@Scheduled cada 30s) processa PENDING. Se Resend estiver fora, emails ficam na fila — sem perda. Retry com backoff para FAILED |
| Renderização de templates | **Thymeleaf no Spring Boot** | Templates `.html` no classpath (`src/main/resources/templates/email/`), versionados no git. Spring renderiza com variáveis (poll_title, voter_name, link). Mesma engine que o Spring já integra nativamente |
| Abstração de provider | **Interface `EmailSender` + `ResendEmailSender`** | Interface abstrai o envio; v1 tem apenas Resend. Se Resend cair ou precisar trocar, implementa outro provider sem mudar `EmailSenderJob`. Evita over-engineering de multi-provider agora |

### Abstração de provider: EmailSender

```java
public interface EmailSender {
    void send(String to, String subject, String htmlBody);
}
```

Implementação v1: `ResendEmailSender` — chama a API do Resend. `EmailSenderJob` depende apenas da interface.

Para adicionar fallback futuro:
1. Criar `MailgunEmailSender` (ou qualquer provider)
2. Criar `FallbackEmailSender` que tenta o primário e, se falhar, tenta o secundário
3. Trocar o bean `@Primary` — zero mudanças no job ou nos services

### Templates de e-mail (v1)

```
src/main/resources/templates/email/
├── invitation.html           ← link de convite + nome do condo + apt
├── poll-scheduled.html       ← nova votação publicada (título, datas)
├── poll-opened.html          ← votação aberta (link para votar)
├── poll-reminder-24h.html    ← lembrete para não-votantes
├── poll-closed-result.html   ← resultado (opção vencedora, percentuais)
├── poll-invalidated.html     ← quórum não atingido
├── poll-cancelled.html       ← cancelada + motivo
└── password-reset.html       ← NÃO USADO na v1 (Supabase Auth cuida)
```

> **Nota:** `password-reset.html` não é necessário na v1 — Supabase Auth tem seu próprio template de reset configurável no Dashboard. Mantido como placeholder caso migre para auth própria no futuro.

> **SMTP unificado:** Supabase Auth é configurado com SMTP customizado apontando para Resend (Auth → SMTP Settings no Dashboard). Isso garante que **todos** os emails do sistema (transacionais do app + reset de senha do Supabase Auth) saem pelo mesmo domínio e remetente, evitando inconsistência e risco de spam.

### Fluxo de envio

```
  Operação de domínio (ex: síndico cria poll)
        │
        ▼
  PollService.create()
        │
        ├── INSERT poll                          ─┐
        ├── INSERT poll_options                    │ mesma transação
        └── notificationService.enqueue(          │
              type=POLL_SCHEDULED,                 │
              recipients=allResidents,             │
              payload={poll_title, dates})         │
            → INSERT email_notification (PENDING) ─┘
        │
        ▼
  COMMIT ← atomicidade garantida: poll + emails na mesma tx

        ... 30 segundos depois ...

  EmailSenderJob (@Scheduled)
        │
        ├── SELECT FROM email_notification
        │     WHERE status='PENDING' AND scheduled_for <= now()
        │     ORDER BY created_at LIMIT 50
        │
        ├── Para cada email:
        │     1. Thymeleaf renderiza HTML com payload
        │     2. Resend API envia
        │     3. Se OK: status='SENT', sent_at=now()
        │     4. Se ERRO: attempts++, last_error=msg
        │        Se attempts >= 3: status='FAILED'
        │        Se bounce hard: status='BOUNCED'
        │          → atualiza invitation.status='BOUNCED' se aplicável
        │
        └── Backoff: 1ª retry imediata, 2ª após 5min, 3ª após 30min
```

---

## 6. Frontend ↔ Backend

### Perguntas

**6.1 — Contrato da API**

- REST puro com convenções próprias, ou um padrão formal? (OpenAPI/Swagger gerado pelo Spring?)
- Versionamento de API: via path (`/v1/polls`), header, ou não versionar na v1?
- Paginação: offset-based ou cursor-based?

**6.2 — Contexto de tenant no frontend**

O morador pode estar em múltiplos condomínios. Como o frontend comunica qual condo está ativo?

| Opção | Descrição |
|-------|-----------|
| **Header customizado** | `X-Tenant-Id: <uuid>` em toda request. Angular interceptor injeta automaticamente |
| **Path prefix** | `/api/condominiums/{id}/polls`. Tenant explícito na URL. Mais RESTful, mais verboso |
| **Sessão/cookie** | Tenant selecionado é salvo server-side. Menos flexível |

**6.3 — Token refresh no Angular**

- Interceptor automático que detecta 401 e renova o access token?
- Se auth própria: implementar refresh rotation. Se IdP: o SDK do provider faz isso?
- Queue de requests durante o refresh para evitar múltiplas renovações simultâneas?

### Decisões

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Contrato de API | **REST + springdoc-openapi (Swagger UI)** | springdoc gera OpenAPI spec a partir dos controllers (annotations do Spring). Swagger UI em `/swagger-ui.html` para dev. Sem versionamento formal na v1 — prefixo `/api/` é suficiente. Versionar (`/v1/`) quando houver clientes externos |
| Tenant context | **Header `X-Tenant-Id`** | Já decidido na Seção 2 (TenantInterceptor). Angular HttpInterceptor injeta o header com o condomínio ativo. Endpoints cross-tenant (ex: `GET /api/me/condominiums`) não enviam o header |
| Token refresh | **Supabase JS SDK** | Já decidido na Seção 1. SDK gerencia refresh automático. Angular não precisa de interceptor de retry 401 — SDK resolve antes. `onAuthStateChange('TOKEN_REFRESHED')` para sincronizar estado |
| Paginação | **Offset-based (Page/Size)** | Spring Data `Pageable` nativo. Suficiente para v1 (listas pequenas: polls, apartments, residents). Cursor-based só se necessário por performance em tabelas grandes (audit_event futuramente) |
| Formato de resposta | **Envelope simples** | Sucesso: `{ data: {...} }` ou array direto. Erro: `{ error: "code", message: "..." }`. Sem envelope complexo (HATEOAS, JSON:API). `@ControllerAdvice` garante formato consistente de erro |

### Detalhamento: HttpInterceptor Angular

```typescript
// Angular interceptor — injeta JWT + tenant em toda request para o backend
intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
  const session = this.supabaseService.session();
  let headers = req.headers;

  if (session?.access_token) {
    headers = headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  if (this.tenantService.activeTenantId) {
    headers = headers.set('X-Tenant-Id', this.tenantService.activeTenantId);
  }

  return next.handle(req.clone({ headers }));
}
```

### Seleção de tenant no frontend

```
Após login:
  1. Angular → GET /api/me/condominiums (cross-tenant, sem X-Tenant-Id)
     → Retorna lista de {condominium_id, name, role}

  2a. Se 1 condo → auto-seleciona como tenant ativo
  2b. Se N condos → tela de seleção ("Em qual condomínio deseja entrar?")

  3. Tenant ativo armazenado em memória (TenantService)
     → NÃO em cookie/localStorage (reseta no refresh = mais seguro)
     → HttpInterceptor injeta X-Tenant-Id automaticamente
     → Troca de condo: usuário volta à tela de seleção
```

---

## 7. Infraestrutura e Deploy

### Perguntas

**7.1 — Onde o sistema roda?**

| Opção | Custo | Complexidade |
|-------|-------|-------------|
| **VPS simples (Hetzner, DigitalOcean)** | ~$5-20/mês | Baixa. Docker Compose, Nginx, Certbot |
| **AWS (ECS/EKS + RDS)** | ~$30-100/mês | Média-alta. Mais serviços gerenciados, mais config |
| **PaaS (Railway, Fly.io, Render)** | ~$10-30/mês | Baixa. Push-to-deploy, menos controle |
| **Vercel (frontend) + separado (backend)** | Variável | Frontend simples, backend precisa de outro host |

**7.2 — Como o deploy acontece?**

- Push to main → deploy automático?
- Pipeline CI/CD (GitHub Actions, GitLab CI)?
- Ambientes: só produção, ou staging também?

**7.3 — Containerização**

- Docker para o backend Spring Boot?
- Docker Compose para dev local (app + postgres + keycloak se aplicável)?
- Mesmo Dockerfile para dev e prod?

### Decisões

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Hosting backend | **Railway** | PaaS push-to-deploy. Free tier → Hobby ($5/mês). Suporta Java/Docker. Variáveis de ambiente via Dashboard. Menos controle que VPS, mas 2-3 devs sem experiência em DevOps não devem operar VPS |
| Hosting frontend | **Vercel** | Angular com static export. Deploy automático via GitHub. CDN global. Free tier generoso |
| Hosting Redis | **Upstash** | Redis serverless. Free tier 10K commands/dia (suficiente para invitation tokens). Pay-as-you-go depois |
| Pipeline CI/CD | **GitHub Actions** | Workflow: push → test → build → deploy. PR checks obrigatórios em `develop` e `main`. Railway auto-deploy a partir de `main` |
| Branching strategy | **Git Flow simplificado** | `main` (produção, protegida) ← `develop` (integração, protegida) ← `feature/*` (trabalho diário). Ver detalhamento abaixo |
| Containerização | **Dockerfile multi-stage** | Stage 1: Maven build. Stage 2: Eclipse Temurin JRE 21 slim. Railway detecta Dockerfile automaticamente. Mesmo Dockerfile para local e prod (env vars mudam) |
| Docker Compose local | **Sim** | `docker-compose.yml` para dev: Redis (redis:7-alpine). Supabase CLI gerencia Postgres + Auth separadamente (`supabase start`). Spring Boot roda fora do compose (`./mvnw spring-boot:run`) |

### Estratégia de branches e proteções

```
main (produção)
 ↑ PR obrigatório (merge de develop → main)
 │   - Requer: CI verde + 1 approval
 │   - Bloqueia: push direto, force push
 │
develop (integraç��o)
 ↑ PR obrigatório (merge de feature/* → develop)
 │   - Requer: CI verde
 │   - Bloqueia: push direto, force push
 │
feature/nome-funcional-reduzido
   └── branches de trabalho do dia-a-dia
       Naming: feature/invitation-flow, feature/poll-lifecycle, feature/rls-setup
```

**Branch protection rules (GitHub Settings → Branches):**

| Branch | Regra | Configuração |
|--------|-------|-------------|
| `main` | Require pull request before merging | ON — Require approvals: 1 |
| `main` | Require status checks to pass | ON — `test` job do GitHub Actions |
| `main` | Restrict who can push | ON — ninguém (push direto bloqueado) |
| `main` | Do not allow force pushes | ON |
| `main` | Do not allow deletions | ON |
| `develop` | Require pull request before merging | ON — Require approvals: 0 (auto-merge permitido se CI verde, time pequeno) |
| `develop` | Require status checks to pass | ON — `test` job |
| `develop` | Do not allow force pushes | ON |

**Fluxo de deploy:**

```
1. Dev cria feature/poll-lifecycle a partir de develop
2. Dev faz commits e abre PR: feature/poll-lifecycle → develop
3. GitHub Actions roda testes no PR
4. CI verde → merge em develop
5. Quando pronto para prod: PR develop → main
6. CI verde + 1 approval → merge em main
7. Railway detecta push em main → deploy automático
```

### Pipeline GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { java-version: '21', distribution: 'temurin' }
      - run: ./mvnw verify  # testes + Testcontainers (precisa Docker)
    services:
      redis:
        image: redis:7-alpine
  # Deploy: Railway auto-deploy no push para main (configurado no Dashboard Railway)
```

### Dockerfile (multi-stage)

```dockerfile
# Stage 1: build
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .
RUN ./mvnw dependency:go-offline   # cache de dependências
COPY src ./src
RUN ./mvnw package -DskipTests

# Stage 2: runtime
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

---

## 8. Segurança (além de auth)

### Perguntas

- **Rate limiting:** endpoints públicos (login, signup, reset password) precisam de rate limit? (ex: Spring Cloud Gateway, Bucket4j, ou Nginx)
- **CORS:** quais origens são permitidas?
- **Criptografia do CPF:** AES-256 com qual gerenciamento de chave? (variável de ambiente? AWS KMS? Vault?)
- **Auditoria de ações do síndico:** log simples no banco, ou event sourcing formal?
- **HTTPS:** TLS terminado onde? (Nginx? Load balancer? PaaS gerencia?)

### Decisões

| Decis��o | Escolha | Justificativa |
|---------|---------|---------------|
| Rate limiting | **Bucket4j no Spring (endpoints públicos)** | Rate limit em `/api/invitations/validate` e `/api/register/complete` (públicos ou semi-públicos). Supabase já protege seus endpoints de auth (login, signup, reset). Bucket4j armazena contadores em memória (suficiente para 1 instância v1) |
| CORS | **Whitelist de origens** | Local: `http://localhost:4200`. Prod: `https://<domínio-final>`. Configurado em `SecurityConfig`. Sem wildcard `*` — apenas origens explícitas |
| Gestão de chave de criptografia | **AES-256 determinístico (SIV), chave em variável de ambiente** | `CPF_ENCRYPTION_KEY` como env var no Railway (secrets). Criptografia determinística: mesmo CPF → mesmo ciphertext (necessário para UNIQUE constraint no banco e comparação no onboarding). Classe utilitária `CpfEncryptor` com `encrypt()`/`decrypt()`. Para v1, env var é suficiente. Migrar para AWS KMS ou HashiCorp Vault se/quando houver requisito de compliance |
| Auditoria | **Tabela `audit_event` (append-only)** | Já definida no data model. Todas as ações de síndico (criar poll, cancelar, convidar, remover morador) geram um INSERT na mesma transação. Não é event sourcing — é log append-only para rastreabilidade. Campos: `event_type`, `actor_user_id`, `target_entity`, `payload` (JSONB) |
| TLS termination | **PaaS gerencia** | Railway e Vercel emitem certificados TLS automaticamente. Zero config. Comunicação Angular (Vercel) → Spring (Railway) → Supabase é sempre HTTPS |
| Headers de segurança | **Spring Security defaults + customização** | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`. CSP básico. Configurado em `SecurityConfig` |

### Detalhamento: Rate limiting com Bucket4j

```
Endpoints protegidos:
  /api/invitations/validate   → 10 requests/minuto por IP
  /api/register/complete      → 5 requests/minuto por IP

Implementação:
  - Bucket4j com Caffeine cache (in-memory)
  - Filter no Spring Security chain (antes do controller)
  - Se exceder limite: HTTP 429 Too Many Requests

Nota: endpoints autenticados (ex: /api/polls) não precisam de rate limit
explícito — o JWT já limita o acesso a users válidos. Se necessário no
futuro, adicionar por user_id em vez de por IP.
```

### Detalhamento: Criptografia do CPF

```
CpfEncryptor (classe utilitária em shared/crypto/):
  - Algoritmo: AES-256-SIV (determinístico + autenticado)
    Alternativa se SIV não estiver disponível: AES-256-CBC com IV
    derivado do conteúdo (IV = HMAC(key, cpf)[:16]) + HMAC para
    autenticação (encrypt-then-MAC)
  - Chave: derivada de CPF_ENCRYPTION_KEY (env var) via HKDF
  - Determinístico: mesmo CPF → mesmo ciphertext, sempre
    Necessário para:
      (1) UNIQUE constraint em app_user.cpf_encrypted (anti-duplicata)
      (2) Comparação direta no onboarding (CPF do convite vs informado)
  - Armazenamento: app_user.cpf_encrypted = ciphertext (BYTEA)
  - Trade-off aceito: CPFs iguais geram ciphertext igual, mas CPF é
    único por pessoa — o UNIQUE index já expõe essa informação.
    Sem a chave, o ciphertext permanece opaco.

Rotação de chave (futura):
  - Adicionar campo cpf_encryption_version
  - Decrypta com chave antiga, re-encrypta com nova
  - Batch migration offline
```

---

## 9. Observabilidade

### Perguntas

- **Logging:** estruturado (JSON) ou texto? Onde os logs são armazenados? (stdout + agregador? arquivo local?)
- **Métricas:** Micrometer + Prometheus? Ou não na v1?
- **Alertas:** quem é notificado se o sistema cair? Como? (e-mail, Slack, PagerDuty?)
- **Health checks:** endpoint `/actuator/health` exposto? O que ele verifica? (banco, fila, SMTP?)

### Decisões

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Formato de logging | **JSON estruturado (Logback + logstash-logback-encoder)** | Logs em JSON para stdout. Railway captura stdout e oferece busca/filtro no Dashboard. Campos: timestamp, level, logger, message, tenant_id (MDC), user_id (MDC), request_id. Sem arquivo de log — stdout only |
| Métricas v1 | **Spring Boot Actuator apenas** | `/actuator/health`, `/actuator/info`, `/actuator/metrics` (JVM, HikariCP, HTTP). Sem Prometheus/Grafana na v1 — overkill para piloto. Adicionar Micrometer + Prometheus quando escalar |
| Alertas | **UptimeRobot + email** | UptimeRobot (free tier) pinga `GET /actuator/health` a cada 5 minutos. Se falhar 2x seguidas → alerta por email para o time. Sem PagerDuty/OpsGenie na v1 |
| Health checks | **Actuator com checks customizados** | `/actuator/health` verifica: DB (automático via Spring), Redis (custom `HealthIndicator`). Se qualquer um DOWN → status 503. Railway usa esse endpoint para readiness probe |
| Contexto por request | **MDC (Mapped Diagnostic Context)** | `TenantInterceptor` já existe — adicionar `MDC.put("tenant_id", ...)` e `MDC.put("user_id", ...)`. Todo log dentro da request carrega o contexto. Limpa no `afterCompletion` |
| Request tracing | **Correlation ID** | Header `X-Request-Id` (gerado pelo Angular ou pelo Spring se ausente). Propagado via MDC. Permite rastrear uma request do frontend ao log do backend |

### Detalhamento: Logging estruturado

```xml
<!-- logback-spring.xml -->
<configuration>
  <appender name="STDOUT" class="ch.qos.logback.core.ConsoleAppender">
    <encoder class="net.logstash.logback.encoder.LogstashEncoder">
      <includeMdcKeyName>tenant_id</includeMdcKeyName>
      <includeMdcKeyName>user_id</includeMdcKeyName>
      <includeMdcKeyName>request_id</includeMdcKeyName>
    </encoder>
  </appender>

  <root level="INFO">
    <appender-ref ref="STDOUT" />
  </root>
</configuration>
```

Exemplo de log JSON produzido:
```json
{
  "@timestamp": "2026-07-15T14:30:22.123Z",
  "level": "INFO",
  "logger": "com.condovote.poll.PollService",
  "message": "Poll created: Assembleia Ordinária 2026",
  "tenant_id": "a1b2c3d4-...",
  "user_id": "e5f6a7b8-...",
  "request_id": "req-xyz-123"
}
```

### Detalhamento: MDC no TenantInterceptor

```java
// Já existente no TenantInterceptor — adicionar MDC
@Override
public boolean preHandle(HttpServletRequest request, ...) {
    String tenantId = request.getHeader("X-Tenant-Id");
    String requestId = Optional.ofNullable(request.getHeader("X-Request-Id"))
        .orElse(UUID.randomUUID().toString());

    if (tenantId != null) {
        TenantContext.set(tenantId);
        MDC.put("tenant_id", tenantId);
    }

    // user_id extraído do JWT (via SecurityContext)
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth != null && auth.isAuthenticated()) {
        MDC.put("user_id", auth.getName());  // sub claim = user_id
    }

    MDC.put("request_id", requestId);
    return true;
}

@Override
public void afterCompletion(...) {
    TenantContext.clear();
    MDC.clear();
}
```

---

## Status do Documento

Todas as 10 seções (0-9) estão preenchidas. O documento está pronto para servir como referência durante a fase de **Tasks** (roadmap de implementação).
