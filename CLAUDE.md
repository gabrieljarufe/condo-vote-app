# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado atual do projeto

Fase 2 (Schema e Migrations) **concluída**. Fase 3 em andamento — T3.1–T3.6 concluídas.

**Concluído até agora:**
- Fase 2 completa: Setup Flyway (T2.1), V1–V10 migrations (T2.2–T2.11), seed dev (T2.12), RlsIsolationIT (T2.13), reescrita V9 com `auth_rls_initplan` (T2.14–T2.19). Issues #1–#4 da análise de escala aplicadas; Issue #5 adiada.
- T3.1 — Scaffold Spring Boot 4 + dependências completas (Web, JPA, Security, OAuth2 Resource Server, Flyway, Actuator, springdoc, lettuce)
- T3.2 — `SecurityConfig`: JWKS Supabase, `/actuator/health` + `/v3/api-docs/**` + `/swagger-ui/**` públicos, `/api/**` exige JWT, CORS, HSTS, CSRF off
- T3.3 — `AuthGateway` interface + `SupabaseAuthGateway` (extrai `sub` e `email` do JWT)
- T3.4 — `TenantContext` (ThreadLocal), `TenantInterceptor` (valida `X-Tenant-Id` + pertencimento), `TenantTransactionAspect` (`set_config` via AOP), `WebMvcConfig` (`@EnableTransactionManagement(order=0)` + registro do interceptor). 14 testes (10 unit + 4 IT).
- T3.5 — `GlobalExceptionHandler` (`@RestControllerAdvice`): `ForbiddenException` → 403, `NotFoundException` → 404, `DataIntegrityViolationException` → 409, `MethodArgumentNotValidException` → 400 com lista de campos, fallback `Exception` → 500 sem stacktrace. `ApiError` record `{code, message, details?, timestamp}`. 6 testes unitários via `standaloneSetup`.
- T3.6 — `GET /api/me/condominiums`: `CondominiumController` (thin) + `CondominiumService` (query UNION cross-tenant via JdbcTemplate) + `CondominiumSummary` record + `UserRoleInCondo` enum (ADMIN/OWNER/TENANT/MULTIPLE). 13 testes (3 unit + 10 IT).

**Adicionados ao longo das fases:** `UuidV7.java` (RFC 9562), `AbstractIntegrationTest` (Singleton Testcontainers), `RlsIsolationIT` (3 cenários RLS).

**Próximo passo:** T3.7 — Dockerfile multi-stage.

Metodologia adotada: **Spec-Driven Development** (Specify → Plan → Tasks → Implement). As fases **Specify**, **Plan** e **Tasks** estão concluídas. Fase atual: **Implement** (Fases 2–6 das tasks).

Toda a documentação é escrita em **português** — mantenha o idioma ao editar docs existentes ou criar novos.

## Docs canônicos (onde as decisões vivem)

| Arquivo | Propósito |
|---------|-----------|
| `docs/condo-vote-principles.md` | Spec de produto. Fonte da verdade para **regras de negócio, atores, ciclo de vida de votações, quórum, LGPD** |
| `docs/data-model.md` | ERD, enums PostgreSQL, tabelas, índices e política de RLS. Fonte para **schema do banco** |
| `docs/architecture.md` | Decisões arquiteturais — **todas as 10 seções preenchidas**: auth (Supabase), backend (monolito modular DDD-lite), banco (Supabase Postgres + Flyway), jobs (@Scheduled), e-mail (Resend + outbox), frontend↔backend (REST + springdoc), infra (Oracle Cloud + Coolify + Cloudflare DNS/Pages + Upstash + GHCR + GitHub Actions), segurança (Bucket4j, AES-256-SIV, audit_event), observabilidade (JSON logging + Actuator + UptimeRobot) |

Ao responder perguntas sobre o domínio, **leia a spec** antes de deduzir — ela é detalhada e já cobriu muitos edge cases.

## Invariantes do domínio (não-negociáveis)

Estas decisões parecem de implementação mas são **estruturais**. Não mude sem discutir explicitamente com o usuário.

- **Multi-tenant por RLS:** toda tabela de domínio tem `condominium_id`; queries rodam com `SET LOCAL app.current_tenant = '<uuid>'`. O `condominium_id` **redundante** em `vote` e `apartment_resident` é intencional — é necessário para a política RLS funcionar sem JOINs. Não remova.
- **Snapshot de elegibilidade é write-once:** `poll_eligible_snapshot` é gerado na transição `SCHEDULED → OPEN` e **nunca** alterado depois. Define o denominador de quórum para os modos Absoluto e Qualificado.
- **Voto pertence ao apartamento**, não ao usuário. `voter_user_id` é apenas testemunha para auditoria. Alinhado com o Código Civil.
- **Votos são imutáveis** após registro. Sem UPDATE/DELETE. Alinhado com Código Civil — voto pertence ao apartamento, não ao usuário. Remoção de morador **não invalida** votos já registrados em polls abertos (morador é testemunha apenas) — não existe coluna `is_nullified` neste schema.
- **Delegação de voto é bloqueada durante polls OPEN** — previne o vetor "delegar, votar, revogar". Mesma regra deve valer para transferência de titularidade quando ela for implementada.
- **CPF mora em `app_user`, não em `apartment_resident`** — é identificador nacional único por pessoa, independente do condomínio. Armazenado criptografado (AES-256). Algoritmo: **AES-256-SIV** (determinístico + autenticado). Determinismo é requisito da `UNIQUE(cpf_encrypted)` — CPFs iguais produzem ciphertext igual.
- **Síndicos têm paridade total** dentro de um condomínio; auditoria via `created_by_user_id` nas tabelas de domínio.

## Convenções de trabalho neste repo

- **Respeite as decisões arquiteturais documentadas.** `docs/architecture.md` foi preenchido interativamente com o usuário. As decisões são finais para v1 — siga-as ao implementar. Se surgir conflito entre uma decisão e a realidade da implementação, **discuta com o usuário** antes de mudar.
- **Não invente alternativas ao que já foi decidido.** Exemplo: hosting é Oracle Cloud `us-ashburn-1` + Coolify (backend) + Cloudflare Pages (frontend) + Cloudflare DNS + Upstash (Redis) — não proponha AWS/Render/Railway/Vercel/etc. sem discussão.
- **Transferência de titularidade** (venda, herança, inquilino comprando): na v1 é tratada via **remoção + convite/promoção** pelo síndico. Fluxo formal (solicitação iniciada pelo proprietário) fica para v2. Ver `condo-vote-principles.md` seção 4 ("Transferência de titularidade") e ponto 4 em "Pontos em Aberto".
- Ao propor mudanças em regras de negócio, **atualize a spec** — não só o código. A spec é a fonte da verdade.

## Stack decidida (ainda sem código)

| Camada | Tecnologia | Detalhes |
|--------|-----------|----------|
| Backend | Java 21 + Spring Boot | Monolito modular, DDD-lite, package by feature |
| Frontend | Angular | Supabase JS SDK para auth, HttpInterceptor para JWT + X-Tenant-Id |
| Banco | PostgreSQL (Supabase) + Flyway | RLS por tenant, migrations SQL versionadas |
| Auth | Supabase Auth | JWT validado via JWKS, AuthGateway abstrai provider |
| Redis | Upstash | Apenas invitation tokens (24h TTL) |
| E-mail | Resend + Thymeleaf | Transactional outbox, EmailSender interface |
| CI/CD | GitHub Actions | test → build → push imagem GHCR → webhook Coolify. Branching: main ← develop ← feature/* |
| Hosting backend | Oracle Cloud `us-ashburn-1` (VM ARM Ampere A1 Always Free) + Coolify | Dockerfile multi-stage, push-to-deploy via webhook, Caddy + Cloudflare Origin CA |
| Hosting frontend | Cloudflare Pages | Bandwidth ilimitado, auto-deploy do repo, SPA via `_redirects` |
| DNS / edge | Cloudflare (free) | Zona `condovote.com.br`; `api.` (proxied) + `app.` (proxied); DDoS, TLS edge |
| Artefato backend | GitHub Container Registry (GHCR) | Imagem por SHA + `latest`; backup de rollback independente da VM |

## Comandos

Os comandos abaixo serão populados ao longo das fases 0–3.

### Backend
```bash
# Desenvolvimento (em fase 3)
cd backend && ./mvnw spring-boot:run

# Testes (em fase 3)
cd backend && ./mvnw verify

# Build Docker (em fase 3)
cd backend && ./mvnw package -DskipTests && docker build -t condo-vote-backend .
```

### Frontend
```bash
# Desenvolvimento (em fase 4)
cd frontend && npm install && npm start

# Build produção (em fase 4)
cd frontend && npm run build
```

### Infraestrutura
```bash
# Supabase local (em fase 1)
cd infra/supabase && supabase start

# Testar migrate Flyway (em fase 2)
cd backend && ./mvnw flyway:migrate
```

> **Bootstrap de condomínio:** criar migration Flyway `V1001+` no repo, não SQL ad-hoc no Studio. Ver `docs/architecture.md §1` (Bootstrap operacional v1) + runbook em `docs/runbooks/bootstrap-condominio.md` (Fase 6).

### VM Oracle (acesso SSH)

O acesso à VM de produção é via **Tailscale** — obrigatório estar com o cliente Tailscale ativo no Mac.

```bash
# Conectar na VM (IP Tailscale em docs/private/phase-1-state.md)
ssh -i ~/.ssh/condo-vote/oracle.key ubuntu@<VM_TAILSCALE_IP>

# Verificar regras de firewall da VM
ssh -i ~/.ssh/condo-vote/oracle.key ubuntu@<VM_TAILSCALE_IP> "sudo iptables -L INPUT --line-numbers -n"

# Atualizar Security List OCI (ex: após mudar IP Tailscale)
oci network security-list update \
  --security-list-id <DEFAULT_SL_OCID> \
  --ingress-security-rules file://infra/oci/security-list-rules.json \
  --force
```

**IPs e OCIDs:** ver `docs/private/phase-1-state.md` (gitignored)

**Chave SSH:** `~/.ssh/condo-vote/oracle.key` — Bitwarden: `condo-vote-oracle-ssh-private-key`

**Security List versionada em:** `infra/oci/security-list-rules.json` — editar e reaplicar via `oci-cli`. Nunca alterar diretamente no console OCI.

**Tutorial completo de SSH:** `docs/runbooks/ssh-vm.md` (gitignored)

### Coolify (painel de deploy)

- **Acesso normal:** `https://coolify.condovote.com.br` (porta 443 → Caddy → Coolify internamente na 8000)
- **Acesso direto (fallback):** `http://<VM_TAILSCALE_IP>:8000` via Tailscale — bypassa o Caddy, útil se o domínio estiver com problema
- **Credenciais:** Bitwarden → `condo-vote-coolify-admin`
- **Webhook GitHub App:** `https://coolify.condovote.com.br`
- **Porta 8000 NÃO está aberta na OCI Security List** — acesso direto só funciona via Tailscale.


## Decisões arquiteturais chave (resumo rápido)

Para detalhes completos, ver `docs/architecture.md`. Aqui o mínimo necessário para não errar ao implementar:

- **Auth:** Supabase Auth gerencia signup/login/senhas/refresh. Spring valida JWT via **JWKS** (chaves públicas assimétricas ECC P-256 em `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, cache local 1h). **Nenhum segredo de JWT no backend** — zero `SUPABASE_JWT_SECRET`; se a VM for comprometida, atacante não consegue forjar tokens. Interface `AuthGateway` abstrai extração de claims. `app_user.id` = `auth.users.id` (mesmo UUID). Confirmação de email desabilitada no Supabase. Ver `architecture.md` §1 "Por que JWKS em vez de HS256".
- **Onboarding:** validação pública do convite → signUp no Supabase → POST /register/complete no Spring (na mesma transação: cria app_user + apartment_resident + aceita invitation + DEL Redis token). Endpoint idempotente para user existente (múltiplos apartamentos).
- **RLS:** `TenantInterceptor` extrai `X-Tenant-Id` do header → `TenantContext` (ThreadLocal) → AOP executa `SET LOCAL app.current_tenant` antes de cada @Transactional. Sem header = cross-tenant (queries explícitas com WHERE user_id).
- **Jobs:** 6 jobs @Scheduled (PollOpener, PollCloser, AllVotedChecker, InvitationExpirer, EmailSender, ReminderEnqueuer). SELECT FOR UPDATE para idempotência. Sem ShedLock na v1 (1 instância).
- **E-mail:** Transactional outbox (`email_notification` table). `EmailSender` interface → `ResendEmailSender`. Thymeleaf templates. Retry 3x com backoff.
- **Branching:** `main` (protegida, 1 approval + CI verde) ← `develop` (CI verde) ← `feature/*`. Coolify auto-deploy de main via webhook (backend); Cloudflare Pages auto-deploy de main (frontend).

## Como o Claude deve raciocinar

Você deve atuar como um **Staff/Principal Engineer**, não como um executor.

### Postura esperada
- Questione decisões implícitas
- Aponte inconsistências entre spec e data model
- Não aceite o modelo atual como correto por padrão
- Priorize clareza, consistência e evolução futura do sistema

### Framework de análise (use sempre)

Ao analisar qualquer coisa, pense em:

1. **Corretude do domínio**
   - O modelo representa fielmente as regras da spec?

2. **Performance**
   - Existem joins desnecessários?
   - Há risco de N+1?
   - Índices estão implícitos ou ausentes?

3. **Escalabilidade**
   - Quais tabelas podem crescer sem controle?
   - Há risco de hotspots?

4. **Manutenibilidade**
   - O modelo é fácil de evoluir?
   - Há acoplamento excessivo?

5. **Segurança e isolamento**
   - As decisões respeitam RLS?
   - Há risco de vazamento entre tenants?

### Regra de ouro

Sempre que sugerir algo:
- Explique o problema
- Explique o impacto
- Explique por que sua solução é melhor

## Formato de resposta esperado

Prefira respostas estruturadas com:
- Problema
- Impacto
- Solução
- Trade-off

Evite respostas genéricas ou superficiais.