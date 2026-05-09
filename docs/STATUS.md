# Status do projeto

**Fase atual:** Fase 7 — Domain Index (Convites e Onboarding)

**Próximo passo:** planejar Fase 7 — primeiro aggregate de domínio (Convites).

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
  - ✅ T5.3 — Job `publish-image` (GHCR) + webhook Coolify autenticado + branch protection em `main`/`develop` (`test` + `frontend-test` obrigatórios) + `README.md` seção Deploy
  - ✅ `auto-pr.yml` — PR `develop → main` criado automaticamente após push em `develop`
  - ✅ Rollback de container — Coolify retém automaticamente as últimas N imagens buildadas localmente (configurável em Rollback → "Images to keep"). UI: Deployments → versão anterior → Redeploy (~30s). GHCR (`:sha` + `:latest` publicados a cada push em `main`) funciona como backup extra caso as imagens locais não alcancem a versão desejada. Migração para pull-from-GHCR adiada conscientemente para v2.
- 🚧 **Fase 5.6** — SemVer com release-please (PR #49 aberto, aguardando merge)
  - `release-please-config.json` + `.release-please-manifest.json` na raiz (manifest mode, 2 componentes independentes)
  - `.github/workflows/release.yml` criado: release-please-action v4, jobs condicionais `publish-backend` e `deploy-frontend-prod`
  - `backend.yml`: job `publish-image` removido (deploy de prod migrou para `release.yml`)
  - `frontend.yml`: `build-and-deploy` → `deploy-staging`, staging-only, bug do `skipped` corrigido
  - Secret `RELEASE_PLEASE_TOKEN` criado no repositório (PAT clássico, escopos `repo` + `workflow`)
- ✅ **Fase 5.5** — Quality Gate (ver seção abaixo)
- ✅ **Fase 6** — Observabilidade & bootstrap formal de condomínio
- ⬜ **Fase 7** — Domain Index (Convites e Onboarding)

---

## Fase 6 — Observabilidade & Bootstrap (concluída)

### O que foi implementado

- **T6.1 — Logging JSON estruturado:**
  - `logback-spring.xml`: profile `prod` delega ao ECS do Spring Boot; profile `local` usa padrão colorido human-readable
  - `SensitiveDataMaskingCustomizer`: mascara CPF (últimos 3 dígitos), Bearer tokens, Supabase keys; paths sensíveis → `[REDACTED]`
  - `TenantInterceptor`: adiciona `tenant_id`, `user_id`, `request_id` (X-Request-Id → cf-ray → UUID gerado) ao MDC; devolve `X-Request-Id` no response; limpa no `afterCompletion`

- **T6.2 — Actuator:**
  - Cadeia Spring Security separada (`@Order(1)`) para `/actuator/**`: `/actuator/health` público; demais exigem HTTP Basic
  - `InMemoryUserDetailsManager` com credenciais `ACTUATOR_USER`/`ACTUATOR_PASSWORD` via env vars
  - `git-commit-id-maven-plugin` 9.0.1: branch, commit abreviado, timestamp e dirty flag em `/actuator/info`
  - Health probes: `liveness` (apenas `livenessState`, sem DB) + `readiness` (`readinessState` + `db` + `redis`)
  - `RedisHealthIndicator`: PING → UP; falha → DOWN

- **T6.3a — CpfEncryptor AES-256-SIV:**
  - `CpfEncryptor` (@Component): `org.cryptomator:siv-mode:1.6.0`; dois subkeys de 16 bytes (CTR + MAC); ciphertext em hex maiúsculo
  - `CpfEncryptorCli`: main class standalone (sem Spring) para scripts de bootstrap
  - `scripts/encrypt-cpf.sh`: localiza JAR em `target/` e invoca a CLI; requer `CPF_ENCRYPTION_KEY` do cofre

- **T6.3 — Bootstrap de condomínio:**
  - `V1001__bootstrap_TEMPLATE.sql.example`: template com INSERTs para `condominium`, `app_user`, `condominium_admin`, `audit_event`; `cpf_encrypted` via `decode(hex, 'hex')`
  - `BootstrapTemplateIT`: 2 cenários em @Transactional + @Rollback (SQL completo + hex↔BYTEA)
  - `docs/runbooks/bootstrap-condominio.md`: 8 passos (Auth → CPF → UUID → template → validate → PR → merge → comunicar)

- **T6.3b + T6.4 — Runbooks operacionais:**
  - `docs/runbooks/data-api-monthly-check.md`: checklist mensal de verificação que a Data API permanece desabilitada
  - `docs/runbooks/backup-restore.md`: backup manual semanal (Dashboard + CLI), restore step-by-step, critérios de migração para Supabase Pro

### Pendente (Fase 6)

- **Validação do MDC em request real:** o `TenantInterceptor` já popula `tenant_id`, `user_id` e `request_id` no MDC, mas nenhum controller de domínio loga ainda. A validação real acontece quando o primeiro `logger.info(...)` for adicionado em um service/controller na Fase 7 — não é necessário criar log artificial agora.

### Não-óbvio (Fase 6)

- **Spring Boot 4 + HealthIndicator:** a interface moveu para `org.springframework.boot.health.contributor` (novo módulo `spring-boot-health`). `@MockBean` foi removido; substituto é `@MockitoBean` (`org.springframework.test.context.bean.override.mockito`).
- **Cadeia Actuator separada com `@Order(1)`** é necessária para coexistir com `oauth2ResourceServer` na cadeia principal — sem ela, o Basic Auth conflita com o JWT resource server.
- **`git-commit-id-maven-plugin` + `build-info`** exigem que o goal seja declarado explicitamente nas `<executions>` do `spring-boot-maven-plugin` — sem o goal, `/actuator/info` retorna objeto vazio.
- **`siv-mode` 1.6.0**: `SivMode.encrypt(byte[], byte[], byte[])` não lança checked exceptions; `decrypt` lança `UnauthenticCiphertextException` + `IllegalBlockSizeException` (não `InvalidKeyException`). AES-256-SIV requer 64 bytes divididos em 2 subkeys de 32 bytes (CTR + MAC); a chave é fornecida como 128 hex chars via `CPF_ENCRYPTION_KEY`.
- **`docs/runbooks/` é gitignored** (contém runbooks com IPs/OCIDs). O `bootstrap-condominio.md` foi forçado via `git add -f` por não conter dados sensíveis.

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
  - Padrão `changes`/`test-backend`/`test` (backend) e `changes`/`frontend-test` (frontend)
  - Leaf jobs garantem que branch protection não trava em PRs docs-only
  - Reviewdog anota violações inline no PR
  - `madrapps/jacoco-report` e `davelosert/vitest-coverage-report-action` postam sticky comments de coverage

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

## Fase 5.6 — SemVer com release-please (não-óbvios)

- **`googleapis/release-please-action@v4`** — não confundir com `google-github-actions/release-please-action@v4` (nome errado que circula em tutoriais antigos).
- **`bootstrap-sha` é obrigatório** — sem ele, o release-please considera todos os commits desde o início do repo e gera um Release PR gigantesco na primeira execução. Deve ser preenchido com o SHA do HEAD de `origin/main` no momento da implementação.
- **Flags pre-major obrigatórias em 0.x** — sem `bump-minor-pre-major: true` e `bump-patch-for-minor-pre-major: true`, qualquer `feat:` em 0.x bumpa direto para 1.0.0 (comportamento padrão do release-please). Com as flags: `fix:` → patch, `feat:` → minor, `feat!:` → major.
- **`GITHUB_TOKEN` padrão não dispara workflows** — quando o release-please usa o token padrão para criar o Release PR, o evento `pull_request` não dispara `backend.yml`/`frontend.yml` (proteção anti-loop do GitHub). Solução: PAT clássico armazenado como `RELEASE_PLEASE_TOKEN`.
- **Outputs com bracket notation** — `${{ steps.rp.outputs['backend--release_created'] }}` (dot notation quebra com `--` no nome do output).
- **Commits fora de `backend/**` e `frontend/**` não geram bump** — mudanças em `.github/`, `docs/`, `infra/` são intencionalmente ignoradas pelo release-please.
- **Deploy de prod só acontece ao mergear o Release PR** — não é automático. O Release PR acumula commits, gera CHANGELOG, e o desenvolvedor decide quando mergear.
- **`include-component-in-tag: true` + `separate-pull-requests: true`** — sem o primeiro, tags de backend e frontend colidem; sem o segundo, um único PR acumula ambos os componentes (indesejável para deploys independentes).

---

## Convenção: atualizar este arquivo

Ao concluir uma task ou descobrir algo não-óbvio, atualizar `STATUS.md` no
mesmo PR. Detalhes técnicos da implementação ficam no código + commit
message; este arquivo é o índice navegável de progresso.
