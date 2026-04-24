# Plano de Implementação — Condo Vote v1

> Arquivo destino final (após aprovação): `plan.md` na raiz do repositório.
> Stack, decisões e invariantes já estão congelados em `docs/architecture.md`, `docs/data-model.md` e `docs/condo-vote-principles.md`. Este plano ordena **como chegar lá**, começando pelo chão antes do domínio.

---

## Contexto

O repositório está em fase pós-Plan do SDD: spec e arquitetura completas, zero código. O usuário pediu um roadmap **fundações-primeiro**: subir os componentes de infraestrutura (Supabase, Redis, CI/CD, deploy, skeletons de backend/frontend) antes de escrever qualquer feature de domínio. A motivação é evitar o anti-padrão clássico de escrever lógica de votação sem ter migrations versionadas, RLS testada, auth ligada ponta-a-ponta e deploy funcionando — o que produz retrabalho quando cada feature descobre problemas de plataforma.

Diretriz orientadora: **cada fase termina com algo que roda e pode ser demonstrado**. Nenhuma fase entrega "código pronto mas sem deploy" ou "deploy pronto mas sem banco".

---

## Princípios de Sequenciamento

1. **Infra antes de código de negócio.** Banco, auth e deploy funcionando com um hello-world antes da primeira entity.
2. **Walking skeleton ponta-a-ponta primeiro.** Login real + 1 endpoint protegido + 1 tela Angular antes de qualquer feature de votação.
3. **RLS desde o primeiro schema.** Não adicionar RLS "depois" — migrations V1 já criam policies. Erros de isolamento em produção são catastróficos.
4. **Convenções antes de volume.** Exception handler global, padrão de DTO, TenantInterceptor, CpfEncryptor existem antes da 3ª feature para não virarem débito.
5. **Respeitar o que a arquitetura já decidiu.** Oracle Cloud + Coolify + Cloudflare Pages + Upstash + Supabase + Flyway + Bucket4j + Resend — não re-avaliar.

---

## Fase 0 — Preparação do Repositório (0,5 dia)

**Objetivo:** repositório saindo de "só docs" para "projeto com estrutura".

- Criar estrutura de diretórios: `backend/`, `frontend/`, `infra/`, `.github/workflows/`
- `backend/.gitignore`, `frontend/.gitignore`, `.editorconfig` na raiz
- Criar branches `develop` (a partir de `main`) e configurar no GitHub:
  - Branch protection em `main` (1 approval + status check `test`, no force-push, no direct push)
  - Branch protection em `develop` (status check obrigatório, no force-push)
- Atualizar `README.md` com: stack, como rodar local (placeholder), link para docs
- Adicionar seção "Comandos" ao `CLAUDE.md` conforme o setup for ficando pronto

**Critério de saída:** PR workflow configurado e testado com um commit trivial via `feature/repo-bootstrap`.

---

## Fase 1 — Fundação de Infraestrutura (1–2 dias)

**Objetivo:** contas, projetos e secrets provisionados. Nenhuma linha de código de app ainda.

### 1.1 Supabase
- Criar projeto Supabase (região mais próxima, ex: São Paulo)
- Desabilitar confirmação de email nas settings de Auth (spec §3 decidiu isso)
- Anotar: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT secret`, `DATABASE_URL` (connection string Postgres)
- Criar usuário superadmin no Dashboard (para rodar o runbook de bootstrap de condomínio — Seção 0 do architecture.md)

### 1.2 Upstash Redis
- Criar database Redis (free tier, região alinhada com Oracle `us-ashburn-1`)
- Anotar: `REDIS_URL` (formato Redis protocol: `rediss://:password@host:port`)

### 1.3 Resend (e-mail)
- Criar conta, verificar domínio de envio (pode ser domínio temporário na v1)
- Anotar: `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`

### 1.4 Oracle Cloud + Coolify + Cloudflare Pages
- Oracle Cloud `us-ashburn-1`: VM ARM Ampere A1 (2 OCPU / 8GB, Always Free) provisionada, Coolify instalado, GitHub App conectado ao repo
- Coolify: application `condo-vote-backend` criada (branch `main`, Dockerfile, `/backend/`), domínio `api.condovote.com.br` — sem deploy (Dockerfile chega na Fase 3)
- Cloudflare Pages: projeto `condo-vote-frontend` criado, conectado ao repo, branch `main`, root `frontend/` — sem build ainda (Angular chega na Fase 4)

### 1.5 Supabase CLI local
- Instalar `supabase` CLI localmente (documentar no README)
- `supabase init` dentro de `infra/supabase/` (gera config local)
- `supabase start` precisa rodar sem erro (Docker requerido)

### 1.6 Gerenciamento de secrets
- **Local:** `.env.example` no repo, `.env` no `.gitignore`
- **CI:** GitHub Actions Secrets para valores de teste (se necessário Testcontainers)
- **Prod:** variáveis no Dashboard Coolify (backend) + Cloudflare Pages (frontend)
- Gerar `CPF_ENCRYPTION_KEY` (32 bytes base64) — chave AES-256-GCM determinística. Armazenar em cofre pessoal (Bitwarden) + injetar no Coolify

**Critério de saída:** todas as contas provisionadas; README tem a lista de variáveis de ambiente necessárias; `supabase start` local funciona.

---

## Fase 2 — Schema e Migrations (2–3 dias)

**Objetivo:** banco com schema completo de v1, RLS ligada, rodando local (Supabase CLI) e em prod (Supabase remoto) via Flyway.

### 2.1 Setup do Flyway
- Decidir se Flyway roda **fora** do Spring (CLI dedicado em CI) ou **dentro** no startup. Recomendação: **dentro do Spring** para v1 (simplifica), migrado para CI-driven quando time crescer. Sinalizar essa decisão ao usuário.
- Criar `backend/src/main/resources/db/migration/` com estrutura

### 2.2 Migrations incrementais (uma por agrupamento lógico)

Quebrar em arquivos pequenos e revisáveis — cada um com `Vn__descricao.sql`:

1. `V1__enums.sql` — todos os enums de `docs/data-model.md` (resident_role, poll_status, etc.)
2. `V2__condominium.sql` — tabela `condominium` (sem RLS, cross-tenant)
3. `V3__app_user.sql` — tabela `app_user` + UNIQUE em `cpf_encrypted` e `email` (sem RLS)
4. `V4__apartment_and_residents.sql` — `apartment`, `apartment_resident` + composite uniques + partial indexes (1 owner ativo)
5. `V5__condominium_admin.sql` — tabela + partial unique
6. `V6__invitation.sql` — tabela + partial unique de PENDING
7. `V7__poll_domain.sql` — `poll`, `poll_option`, `poll_eligible_snapshot`, `vote`, `poll_result`
8. `V8__audit_and_notifications.sql` — `audit_event`, `email_notification`
9. `V9__rls_policies.sql` — `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `CREATE POLICY tenant_isolation ...` para todas as tabelas com `condominium_id`
10. `V10__composite_foreign_keys.sql` — FKs compostas (vote, snapshot, resident, invitation) — em migration separada para facilitar revisão
11. `R__seed_dev.sql` — **repeatable migration**, só roda em profile local: 1 condo teste, 1 síndico, alguns apartments. Guardada por check `current_database() LIKE '%local%'` OU aplicada só via profile `local`

### 2.3 Validação da RLS
Antes de escrever código de app, escrever **um teste de integração** (JUnit + Testcontainers) que:
- Sobe Postgres com migrations aplicadas
- Insere 2 condomínios com dados
- `SET LOCAL app.current_tenant = <condo1>` → confirma que query vê só dados do condo1
- Sem `SET LOCAL` → confirma comportamento esperado (depende do usuário do Postgres; documentar)
- Tenta inserir cross-tenant com FK composta → confirma erro

Este teste é a garantia de que a RLS foi instalada corretamente. Sem ele, bugs de isolamento só aparecem em produção.

**Critério de saída:** `./mvnw flyway:migrate` aplica tudo sem erro local e contra Supabase remoto. Teste de RLS passa. Superadmin consegue ver dados no Supabase Studio.

---

## Fase 3 — Walking Skeleton Backend (2–3 dias)

**Objetivo:** Spring Boot mínimo, validando JWT Supabase, com 1 endpoint protegido cross-tenant, deployado via Coolify em `api.condovote.com.br`.

### 3.1 Projeto Spring Boot
- Spring Initializr: Java 21, Spring Boot 3.x, dependências: Web, Data JPA, Security, Flyway, PostgreSQL Driver, Actuator, Validation, OAuth2 Resource Server (para JWKS), Thymeleaf
- Estrutura de packages conforme `docs/architecture.md` §2 (package by feature): `auth/`, `shared/`, ainda vazios
- `application.yml` com profiles `local` e `prod` — datasource, Flyway, JWKS URL do Supabase
- Configurar HikariCP (pool size inicial 10)

### 3.2 Segurança base (`shared/config/SecurityConfig.java`)
- Spring Security + OAuth2 Resource Server
- JWKS endpoint: `${supabase.url}/auth/v1/.well-known/jwks.json`
- Cache local de chaves (`NimbusJwtDecoder` com `cache-duration`)
- Todas as rotas `/api/**` exigem JWT válido; `/actuator/health`, `/v3/api-docs`, `/swagger-ui/**` públicas
- Headers de segurança: `X-Content-Type-Options`, `X-Frame-Options: DENY`, HSTS
- CORS com whitelist: `http://localhost:4200`, `https://app.condovote.com.br`

### 3.3 AuthGateway (`auth/AuthGateway.java`)
- Interface que abstrai extração de claims do JWT — protege contra lock-in Supabase
- Implementação `SupabaseAuthGateway`: extrai `sub` (user_id), `email`
- Bean Spring injetável em services

### 3.4 TenantContext + TenantInterceptor (`shared/tenant/`)
- `TenantContext`: ThreadLocal<UUID>
- `TenantInterceptor implements HandlerInterceptor`: preHandle extrai `X-Tenant-Id`, valida pertencimento, guarda em ThreadLocal; afterCompletion limpa
- `TenantTransactionAspect`: `@Around` em métodos `@Transactional` que executa `SET LOCAL app.current_tenant = :tenant`
- Endpoint sentinela: `GET /api/me/condominiums` (cross-tenant, sem header `X-Tenant-Id`) — retorna condos do user logado via query explícita `WHERE user_id = :uid`

### 3.5 Exception handling (`shared/exception/`)
- `GlobalExceptionHandler` (@RestControllerAdvice) mapeando:
  - `MethodArgumentNotValidException` → 400 + payload estruturado
  - `DataIntegrityViolationException` → 409 (vote duplicado, invitation duplicada)
  - `ForbiddenException`, `NotFoundException` (custom) → 403 / 404
  - `Exception` fallback → 500 com log mas sem stacktrace para o cliente

### 3.6 Dockerfile + Coolify
- `backend/Dockerfile` multi-stage conforme `docs/architecture.md` §7
- Push em `main` → Coolify detecta via webhook, builda e deploya automaticamente
- Vars já configuradas no Coolify Dashboard (Fase 1): `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`, `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, `CPF_ENCRYPTION_KEY`, `CORS_ALLOWED_ORIGINS` — JWT é validado via JWKS (sem segredo no backend, ver `architecture.md` §1)
- Validar health check `/actuator/health` retornando 200 em `https://api.condovote.com.br/actuator/health`

### 3.7 Smoke test
- Criar um usuário pelo Supabase Dashboard
- Obter JWT via curl ao endpoint Supabase Auth
- Chamar `GET /api/me/condominiums` com o JWT → deve responder (lista vazia)

**Critério de saída:** backend deployado, login via Supabase funciona, JWT é validado, endpoint cross-tenant responde. RLS está ativa quando há `X-Tenant-Id` (verificável com curl).

---

## Fase 4 — Walking Skeleton Frontend (2 dias)

**Objetivo:** Angular deployado no Cloudflare Pages em `app.condovote.com.br`, login via Supabase, chamada ao backend com JWT + X-Tenant-Id.

### 4.1 Projeto Angular
- Angular CLI: `ng new frontend --standalone --routing --style=scss`
- Instalar `@supabase/supabase-js`
- `src/environments/` com `environment.ts` (local) e `environment.prod.ts` (Cloudflare Pages)

### 4.2 Supabase Auth no cliente
- Service `AuthService`: `signIn(email, password)`, `signOut()`, `getSession()`
- Tela de login + logout
- Guarda de rota (`authGuard`) redirecionando para `/login` se sem sessão

### 4.3 HttpInterceptor
- Injeta `Authorization: Bearer <access_token>` em toda request para o backend
- Injeta `X-Tenant-Id: <condominiumId>` quando há condomínio ativo selecionado (armazenado em localStorage + signal)
- Ignora header para endpoints cross-tenant (`/api/me/**`, `/api/register/**`)

### 4.4 Tela pós-login
- Chama `GET /api/me/condominiums` → lista condos do user
- Seletor de condomínio ativo (para usuários multi-condo — spec §10)
- Placeholder de dashboard

### 4.5 Deploy Cloudflare Pages
- Build command: `ng build --configuration=production`
- Output: `dist/frontend/browser`
- Root directory: `frontend/`
- Env vars (já configuradas no Pages Dashboard — Fase 1): `NG_APP_SUPABASE_URL`, `NG_APP_SUPABASE_ANON_KEY`, `NG_APP_API_URL=https://api.condovote.com.br`
- Arquivo `frontend/public/_redirects`: `/* /index.html 200` (necessário para SPA Angular — rotas client-side)

**Critério de saída:** usuário real loga no frontend `https://app.condovote.com.br`, vê sua lista (vazia) de condos vinda do backend `https://api.condovote.com.br`. Ponta-a-ponta validado.

---

## Fase 5 — CI/CD Completa (0,5–1 dia)

**Objetivo:** `.github/workflows/ci.yml` rodando em todo PR conforme `docs/architecture.md` §7.

- Job `test`: checkout, setup Java 21 Temurin, `./mvnw verify` com Testcontainers (Docker disponível no runner)
- Job `frontend-test` (opcional na v1): `npm ci && npm run test -- --watch=false --browsers=ChromeHeadless` e `npm run build`
- Proteção de branches configurada para exigir jobs verdes
- Coolify auto-deploy de `main` via webhook (backend); Cloudflare Pages auto-deploy de `main` (frontend)

**Critério de saída:** PR com erro de teste é bloqueado; PR verde faz merge e deploya automaticamente.

---

## Fase 6 — Observabilidade Mínima e Runbook de Bootstrap (0,5 dia)

**Objetivo:** antes de escrever a primeira feature de domínio, garantir que dá para diagnosticar problemas em produção e onboardar o primeiro condomínio.

- Logging JSON estruturado (Logback + `logstash-logback-encoder`) — conforme §9
- Actuator: `/actuator/health`, `/actuator/info`, `/actuator/metrics` (expostos só internamente ou com auth básico)
- UptimeRobot monitorando `/actuator/health` (free tier)
- **Runbook de bootstrap** em `docs/runbooks/bootstrap-condominio.md` conforme §0 de architecture.md: script SQL transacional de criar condomínio + síndico + app_user, com placeholders. Testar executando contra Supabase staging/local.

**Critério de saída:** operador consegue criar um condomínio novo seguindo o runbook. Logs em prod chegam estruturados. Monitor básico ativo.

---

## Fase 7 — Primeira Feature de Domínio: Convites e Onboarding (próxima etapa, fora deste plano)

**Não detalhar aqui.** Esta é a primeira feature real — o plano específico dela (incluindo Redis integration, CpfEncryptor, fluxo `/register/complete`, transactional outbox de e-mail) entra em um `tasks.md` separado conforme a metodologia SDD (Tasks → Implement). É a entrada para a fase de `features`.

A razão de parar aqui: este plano é sobre **fundações**, não domínio. Com as Fases 0–6 completas, qualquer feature pode ser construída sem descobrir problemas de plataforma no meio do caminho.

---

## Critérios Gerais de Qualidade (válidos em toda fase)

- Toda alteração de schema passa por Flyway — nunca SQL manual em produção
- Todo endpoint novo tem teste de integração Testcontainers que exerce RLS
- Toda decisão que conflite com `docs/architecture.md` ou `docs/data-model.md` **para antes de codar** e atualiza a spec primeiro
- PRs pequenos (< 500 linhas) — cada migration numerada é um PR ou parte de um PR temático
- Commits em português, mensagens descritivas

---

## Arquivos Críticos a Serem Criados Nesta Ordem

| Ordem | Arquivo | Fase |
|-------|---------|------|
| 1 | `.github/workflows/ci.yml` | 0 / 5 |
| 2 | `infra/supabase/config.toml` | 1 |
| 3 | `backend/pom.xml` + `backend/Dockerfile` | 3 |
| 4 | `backend/src/main/resources/db/migration/V1__enums.sql` ... `V10__*.sql` | 2 |
| 5 | `backend/src/main/java/com/condovote/shared/config/SecurityConfig.java` | 3 |
| 6 | `backend/src/main/java/com/condovote/shared/tenant/*` | 3 |
| 7 | `backend/src/main/java/com/condovote/auth/AuthGateway.java` | 3 |
| 8 | `backend/src/test/java/com/condovote/shared/tenant/RlsIsolationIT.java` | 2 / 3 |
| 9 | `frontend/src/app/auth/auth.service.ts` + `auth.interceptor.ts` | 4 |
| 10 | `docs/runbooks/bootstrap-condominio.md` | 6 |

---

## Verificação End-to-End (após Fase 6)

1. Operador cria condomínio de teste via runbook SQL no Supabase Studio
2. Operador cria user síndico no Supabase Auth Dashboard e vincula em `condominium_admin`
3. Síndico faz login em `https://app.condovote.com.br` com email + senha
4. Frontend chama `GET /api/me/condominiums` → retorna o condomínio de teste
5. Síndico seleciona o condomínio → frontend começa a enviar `X-Tenant-Id`
6. Chamada a um endpoint RLS-scoped retorna dados do tenant correto; trocar header → 403 ou lista vazia
7. Forçar um erro (ex: JWT expirado) → resposta 401 estruturada no formato do GlobalExceptionHandler
8. Verificar log estruturado no Coolify (logs do container) com `trace_id` da request

Se tudo passa, a plataforma está pronta para receber features de domínio.

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| RLS mal configurada passa despercebida | Teste de integração dedicado na Fase 2; rodar em toda PR |
| Lock-in Supabase cresce silenciosamente | AuthGateway desde o dia 1; revisar trimestralmente se algum código chama SDK Supabase fora de `auth/` |
| Flyway rodando no startup falha em prod | Sempre rodar localmente contra snapshot da prod antes de merge em `main`; baseline em repositórios existentes |
| Secrets vazam em logs | Logback filtra campos `password`, `token`, `key`, `cpf` — configurar já na Fase 6 |
| Desalinhamento entre `docs/` e código | Regra: mudança de comportamento → spec primeiro, código depois (CLAUDE.md) |
