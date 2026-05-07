# Status do projeto

**Fase atual:** Fase 6 — Observabilidade & bootstrap formal de condomínio

**Próximo passo:** T6.1 — definir escopo de observabilidade (métricas, alertas, runbook bootstrap condomínio).

---

## Progresso por fase

- ✅ **Fase 0** — Repo bootstrap
- ✅ **Fase 1** — Infraestrutura (Oracle Cloud + Coolify + Cloudflare + Supabase + Upstash)
- ✅ **Fase 2** — Schema e Migrations
  - V1–V10 aplicadas; RLS via `(SELECT current_setting(...))` em V9 (elimina warning `auth_rls_initplan`)
  - Otimizações de escala: Issues #1–#4 aplicadas; #5 adiada conscientemente
  - `RlsIsolationIT` com 3 cenários cobre policies
- 🚧 **Fase 3** — Walking Skeleton Backend
  - ✅ T3.1 — Spring Boot 4 scaffold + dependências (Web, Security, OAuth2, JDBC, Flyway, Actuator, springdoc, lettuce)
  - ✅ T3.2 — `SecurityConfig`: JWKS Supabase, CORS, HSTS, CSRF off
  - ✅ T3.3 — `AuthGateway` interface + `SupabaseAuthGateway`
  - ✅ T3.4 — `TenantContext` + `TenantInterceptor` + `TenantTransactionAspect` (14 testes)
  - ✅ T3.5 — `GlobalExceptionHandler` + `ApiError` record
  - ✅ T3.6 — `GET /api/me/condominiums` + Spring Data JDBC + `Condominium` aggregate (13 testes)
  - ✅ T3.7 — `Dockerfile` multi-stage validado localmente
  - ✅ T3.8 — Deploy Coolify + Let's Encrypt + `api.condovote.com.br` respondendo
  - 🔶 T3.9 — Smoke test prod: JWT auth via Supabase Cloud ✅; endpoint `/api/me/condominiums` pendente (sem condomínio de teste em prod ainda — fluxo real será testado no bootstrap formal da Fase 6)
  - ✅ T3.10 — Comandos do `CLAUDE.md` atualizados
- 🚧 **Fase 4** — Frontend Skeleton (branch `feat/phase-4-frontend`)
  - ✅ T4.0 — Fundamentos: `coding-patterns.md` §Frontend expandido (SOLID, smart/dumb, design tokens, DoD), `frontend-feature-checklist.md` criado
  - ✅ T4.1 — Angular **21.2** + Vitest + Tailwind v4 (`@theme` tokens em `styles.scss`) + Supabase JS SDK + envs com `inject-env.mjs`
  - ✅ T4.2 — Core auth (Supabase client singleton, `AuthService` com signal de session, `authGuard`) + `TenantService` (signal **em memória**, sem localStorage)
  - ✅ T4.3 — `authInterceptor` + `tenantInterceptor` (excluindo `/api/me/**` e `/api/register/**`) + `MeApiService`
  - ✅ T4.4 — `LandingComponent` (rota pública `/`) com refinamento UX: testimonial fake removido, seção administradoras removida, hero com SVG inline (sem CDN externa), FAQ componentizado em `<app-faq-item>`
  - ✅ T4.5 — `LoginComponent` (Reactive Form + `<app-form-field>` reusável), `HomeComponent` com 0/1/N condos, `<app-app-header>` com seletor + sair
  - ✅ Smoke test local: stack completo (Supabase CLI + backend docker-compose + ng serve) → login GoTrue OK, CORS preflight 200, `/api/me/condominiums` retorna 2 condos com Bearer, 401 sem token
  - 🔶 T4.6 — `_redirects` SPA fallback OK no `dist/`. Env vars no dashboard Cloudflare Pages ✅. Workflow GitHub Actions corrigido (`npm ci` + `build:prod` + `NG_APP_*` via repository secrets) ✅. Deploy de preview validado ✅. Pendente: merge em `main` e validar prod
- ✅ **Fase 5** — CI/CD
  - ✅ Pré-requisitos: secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GHCR_TOKEN` e `NG_APP_*` configurados em GitHub → Settings → Repository secrets
  - ✅ T5.1 — Job `test` real no `backend.yml` (setup-java, `./mvnw verify`, surefire upload)
  - ✅ T5.2 — Job `frontend-test` no `frontend.yml` (nome alinhado com branch protection)
  - ✅ T5.3 — Job `publish-image` (GHCR) + webhook Coolify autenticado + branch protection em `main`/`develop` (`backend-quality-gate` + `frontend-quality-gate` obrigatórios) + `README.md` seção Deploy
  - ✅ `auto-pr.yml` — PR `develop → main` criado automaticamente após push em `develop`
  - ✅ `release-readiness.yml` — em PRs `develop → main`, posta comment sticky com (a) commits a promover agrupados por tipo conventional commit e (b) migrations Flyway novas (`V*.sql` adicionadas). Reusa o padrão marker HTML do `post-coverage-comment.py` para evitar duplicação. Decisão: quality gates de coverage/duplicação ficam restritos a PRs `feat → develop` (onde são acionáveis); em `develop → main` só vive informação cumulativa que não existe em outro lugar.
  - ✅ Rollback de container — Coolify retém automaticamente as últimas N imagens buildadas localmente (configurável em Rollback → "Images to keep"). UI: Deployments → versão anterior → Redeploy (~30s). GHCR (`:sha` + `:latest` publicados a cada push em `main`) funciona como backup extra caso as imagens locais não alcancem a versão desejada. Migração para pull-from-GHCR adiada conscientemente para v2.
- ✅ **Fase 5.5** — Quality Gate (ver seção abaixo)
- 🚧 **Fase 6** — Observabilidade & bootstrap formal de condomínio
- ⬜ **Fase 7** — Domain Index

---

## Fase 5.5 — Quality Gate (concluída)

**Motivação:** dar autonomia à IA para escrever código sem revisão linha-a-linha, bloqueando PRs com qualidade abaixo do mínimo.

### O que foi implementado

- **Backend** (`./mvnw verify`):
  - Spotless check (google-java-format 1.22.0, estilo GOOGLE)
  - Surefire (testes unitários, exclui `*IT.java`)
  - Failsafe (testes de integração, Testcontainers)
  - JaCoCo 0.8.12 (thresholds: 50% linha / 40% branch; exclui dto, config, Application)
  - PMD CPD 3.22.0 (minimumTokens: 100; exclui fontes de teste)

- **Frontend** (`npm run lint && npm run test:ci && npm run cpd`):
  - ESLint + @angular-eslint + sonarjs (flat config, max-warnings 0)
  - Vitest coverage v8 (thresholds: 50% linhas/funções/statements, 40% branches)
  - jscpd (threshold 5%, minTokens 50)

- **CI** (`.github/workflows/`):
  - Padrão `changes`/`test-backend`/`backend-quality-gate` (backend) e `changes`/`frontend-test`/`frontend-quality-gate` (frontend)
  - Leaf jobs garantem que branch protection não trava em PRs docs-only
  - Reviewdog anota violações inline no PR
  - Backend: script próprio `.github/scripts/post-coverage-comment.py` (UT+IT em tabela adaptativa, marker HTML para evitar duplicação) — substituiu `madrapps/jacoco-report` que escondia arquivos sem cobertura
  - Frontend: `davelosert/vitest-coverage-report-action` posta sticky comment

### Não-óbvio

- **Commit isolado de Spotless apply** (antes de ligar o check) é obrigatório — evita misturar mudanças de formatação em massa com mudanças lógicas.
- **`fetch-depth: 0`** nos jobs de test é obrigatório para o reviewdog mapear o diff do PR. Sem isso, comentários inline não aparecem.
- **`if: always()`** no leaf job + allowlist `success || skipped` no deploy são necessários — `!= 'failure'` deixa passar runs `cancelled`.
- **Frontend**: `vitest.config.ts` + `test-setup.ts` criados do zero — o CLI do Angular 21 não gera automaticamente.

---

## Componentes adicionados ao longo das fases

- `UuidV7.java` — geração offline RFC 9562 (padrão do projeto para PKs UUID)
- `AbstractIntegrationTest` — Singleton Testcontainers (Postgres 16)
- `RlsIsolationIT` — testa isolamento de tenants via `SET LOCAL app.current_tenant`
- `docker-compose.yml` — backend containerizado contra Supabase CLI local
- `docs/context-docs/auth-flow.md` — fluxo GoTrue/JWT/JWKS
- `docs/context-docs/flyway-migrations.md` — ciclo de vida de migrations
- `docs/runbooks/validate-fase-3.md` — validação manual T3.1–T3.9 (Blocos 1-8)

---

## Descobertas pós-deploy T3.8 (não óbvias)

- **`DATABASE_URL` deve ser JDBC**, não PostgreSQL URL — o driver Java exige prefixo `jdbc:` e credenciais como query params (`?user=...&password=...`), não embutidas no host
- **Supabase Cloud só expõe IPv6** no endpoint direto `db.<ref>.supabase.co` — VMs Oracle não têm IPv6 por padrão; solução: usar o **Session Pooler** (`aws-1-<região>.pooler.supabase.com:5432`) que aceita IPv4 gratuitamente. Username vira `postgres.<project-ref>`
- **Coolify usa porta 3000 por padrão** — precisa configurar explicitamente a porta 8080 no campo Port do serviço; sem isso o Traefik roteia para a porta errada (502)
- **Let's Encrypt só emite com domínio HTTPS** configurado no Coolify — `http://` no campo Domains não dispara emissão; precisa ser `https://`
- **`acme.json` fica em `/traefik/acme.json`** na VM, não em `/etc/traefik/acme/acme.json`
- **Cloudflare Full (strict) bloqueia emissão** do Let's Encrypt via HTTP-01 — temporariamente mudar para Full durante a primeira emissão, depois voltar para strict

---

## Descobertas pós-validação relevantes (não óbvias)

Itens que custaram tempo para descobrir e que afetam decisões futuras:

- `pom.xml` precisa explicitar `**/*IT.java` no scan do Surefire — sem isso,
  `./mvnw test -Dgroups="integration"` retorna 0 testes silenciosamente
- `application*.yaml` precisa declarar `jws-algorithms: ES256` — Supabase
  assina JWT com ECDSA P-256 e Spring Boot rejeita com "Another algorithm
  expected, or no matching key(s) found" se não declarado explicitamente
- `infra/supabase/supabase/seed.sql` exige `INSERT INTO auth.identities`
  além de `auth.users` (GoTrue não autentica sem identity) e token columns
  (`confirmation_token`, `recovery_token`, `email_change`) como `''` em vez
  de NULL (GoTrue faz scan dessas colunas como `string` Go)
- Cada `supabase db reset` regenera as chaves EC do JWKS — backend precisa
  reiniciar para invalidar o cache do `NimbusJwtDecoder`

---

## Descobertas Fase 4 (não óbvias)

- **Angular CLI default mudou para v21.2** — patterns documentados como "Angular 20+" continuam válidos, mas o CLI agora gera arquivos sem sufixo `.component` (`app.ts` em vez de `app.component.ts`) e usa **Vitest** em vez de Karma/Jasmine. Seguimos a convenção do CLI; o `coding-patterns.md` não exige sufixo.
- **Tailwind v4 + Angular** integra via `.postcssrc.json` com `@tailwindcss/postcss` — não precisa `tailwind.config.js`. Tokens vivem em `@theme { ... }` direto no `styles.scss` e viram CSS variables runtime.
- **`UserRoleInCondo` retorna `ADMIN | OWNER | TENANT | MULTIPLE`**, não `SINDICO | MORADOR` como assumido. `MULTIPLE` indica usuário com mais de um vínculo no mesmo condomínio (raro).
- **Output do build Angular 21 é `dist/<project>/browser/`** — alinhado com Cloudflare config existente. O `_redirects` em `frontend/public/` é copiado automaticamente para o output.
- **`environment.prod.ts` é gerado em build time** por `scripts/inject-env.mjs` a partir de `NG_APP_*` env vars; arquivo fica gitignored. Build falha cedo se var obrigatória estiver ausente — preferimos quebrar do que deployar config quebrada.
- **GitHub Actions requer repository secrets** (não environment secrets) para jobs sem `environment:` declarado. Secrets configurados em environment (Production/Preview) são ignorados nesses jobs — devem estar em Settings → Secrets → Repository secrets.
- **`NG_APP_*` vars são públicas por design** — qualquer valor injetado no bundle Angular fica visível no browser. Secrets reais (service role key, DATABASE_URL, CPF_ENCRYPTION_KEY) ficam exclusivamente no backend. A anon key do Supabase é segura no frontend porque a Data API está desabilitada e o RLS cobre todas as tabelas.
- **`TenantService.activeCondominiumId` em memória** (não localStorage). Reset no F5 é intencional: força nova seleção explícita, evita ambiguidade quando user troca de condomínio. Documentado em `architecture.md §6` (canônico) e atualizado em `phase-4-frontend-skeleton.md`.

---

## Convenção: atualizar este arquivo

Ao concluir uma task ou descobrir algo não-óbvio, atualizar `STATUS.md` no
mesmo PR. Detalhes técnicos da implementação ficam no código + commit
message; este arquivo é o índice navegável de progresso.
