# Status do projeto

**Fase atual:** Fase 7 — Histórias de Domínio

**Próximo passo:** executar **H5 — Morador vê apartamentos onde reside** (H1/H2/H3/H4 concluídas; `apartment_resident` já é populado pelo aceite de convite da H4).

> **Mudança de abordagem (2026-05-09):** o antigo `phase-7-domain-index.md` (8 features técnicas F1–F8) foi substituído pela pasta [`docs/implementation/tasks/phase-7/`](implementation/tasks/phase-7/index.md), que organiza o trabalho como **10 histórias de usuário fatiadas verticalmente** (H1–H10). Cada história vira um PR demonstrável; F1–F8 viraram cobertura técnica que cada história consome. Apêndice em `phase-7/index.md` audita que nada caiu na transição.

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
  - ✅ T3.9 — Smoke test prod: condomínio piloto Pitufos bootstrapado em prod, síndico real loga em `https://condovote.com.br`, home renderiza Pitufos, `/api/me/condominiums` retorna 200 (validado 2026-05-11)
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
- ✅ **Fase 5.5** — Quality Gate (ver seção abaixo)
- ✅ **Fase 5.6** — SemVer com release-please (ver seção abaixo)
- ✅ **Fase 6** — Observabilidade & bootstrap formal de condomínio
- 🚧 **Fase 7** — Histórias de Domínio — **em execução**
  - ✅ **H1** — Login + Home com seletor de condomínios (smoke prod com piloto Pitufos validado 2026-05-11)
  - ✅ **Foundations Fase 7** — edição inline V6 (índice parcial invitation), V7 (triggers write-once snapshot + immutable vote), V8 (índice composto audit cursor `(condo, occurred DESC, id DESC)`), V9 (WITH CHECK em policies); `AuditEventPublisher` e `SupabaseAdminGateway`; `SecurityConfig` permitAll `/api/public/**`. Requer `supabase db reset` local e DROP/CREATE schema em prod antes do próximo deploy. Decisão: `CPF_ENCRYPTION_KEY` deve ser **idêntica** em staging↔prod (sem rotação v1 — ciphertext determinístico não decifra cross-env se chaves divergirem)
  - ✅ **H2** — Síndico cadastra apartamento (e marca inadimplência) — backend CRUD + audit_event + batch endpoint; frontend lista + form individual + wizard em lote com 4 presets de numeração (incl. compacto com térreo), grade editável Step 2, ORDER BY natural (LENGTH+alfa), centralização de tabela, fix layout shift inadimplência, fix preset "Personalizado" + tooltip de tokens. PR #70 (mergeado 2026-05-12)
  - ✅ **H2.1** — Paginação server-side da lista de apartamentos — `GET /api/condominiums/{id}/apartments` agora retorna `PageResponse<T>` (`{content, page, size, totalElements, totalPages}`); query params `page` (default 0) e `size` (default 10, clamp [1, 100]); novo DTO genérico `shared/web/PageResponse` reutilizável. Frontend: novo componente `app-paginator` (shared/ui, prev/next + selector 10/20/50/100) e re-fetch da página após criar. Breaking change consumido só por este repo — invitations-page/invitation-bulk fetch with `size=100` (TODO para >100 unidades)

### Descobertas não-óbvias da H3 (2026-05-12)

- **CpfEncryptor + BYTEA:** `encrypt()` retornava `String` hex, mas as colunas `app_user.cpf_encrypted` e `invitation.cpf_encrypted` são `BYTEA`. Spring Data JDBC não converte automaticamente. Solução: métodos paralelos `encryptToBytes()/decryptFromBytes()` (sem alterar API existente que serve o `CpfEncryptorCli`). Resolveu o gap sem migration de dados.
- **Mailpit não é necessário em dev — usamos Inbucket do Supabase:** o Supabase CLI já sobe um Inbucket interno (UI em `localhost:54324`); basta descomentar `smtp_port = 54325` em `infra/supabase/supabase/config.toml`. Backend dentro do docker-compose alcança via `host.docker.internal:54325`. Para ITs, usamos `greenmail-junit5` (SMTP in-memory, scope test).
- **`ObjectMapper` não é auto-injetado em Spring Boot 4 com starter-webmvc:** `InvitationService` inicialmente injetava via construtor, mas o bean não estava no contexto, quebrando `contextLoads` em ITs pré-existentes. Solução: instanciar localmente com `new ObjectMapper().registerModule(new JavaTimeModule())` (mesmo padrão de `AuditEventPublisher`).
- **`email_notification.user_id`** não tem FK para `app_user` (verificado em V8/V10) — usamos o `created_by_user_id` (síndico) como proxy. Funciona para invitations; ao adicionar templates POLL_*, reavaliar.
- **`docs/runbooks/` está gitignored** por convenção (contém IPs/OCIDs em outros arquivos). Para o `resend-dns-setup.md` ser público, adicionado `!docs/runbooks/resend-dns-setup.md` no `.gitignore`. O git ignora pais antes de descer, então whitelist precisa `git add -f` na primeira vez.
- **Frontend XLSX:** projeto não tinha lib de parse — H2 bulk gera padrão em memória, não lê arquivo. Adicionado `read-excel-file` 5.8.7 (2 kB gzipped) só em H3. Bulk também aceita CSV como fallback (parsing inline).
- **`@MockitoBean` para Redis no `AbstractIntegrationTest`** simplifica ITs: qualquer chamada em `redisCommands.setex(...)` é aceita sem stub manual. ITs de invitations não validam Redis side-effect (cobertura via UT em `InvitationServiceTest`).
- **Bucket4j (rate-limit) adiado para H4:** endpoints de H3 são todos autenticados (síndico). Risco de força-bruta só aparece em `/api/invitations/validate` e `/api/register/complete` (H4 — endpoints públicos).
  - ✅ **H3** — Síndico convida morador (com e-mail) — backend completo: `InvitationService` (criar/listar/revoke/resend/fix-email + bulk ACID com bloco+unidade), `EmailGateway` polymorfa (SMTP Inbucket dev / GreenMail test / Resend prod via WebClient), `EmailSenderJob @Scheduled(30s)` com outbox FIFO + backoff exponencial, `InvitationExpirerJob @Scheduled(1h)`, template Thymeleaf `invitation.html`. Frontend: página de convites com lista filtrada + form individual + wizard XLSX 2-step espelhando H2. PR #75 mergeado; validação prod fim-a-fim depende de DNS Resend configurado (ver `docs/runbooks/resend-dns-setup.md`)
  - ✅ **H4** — Morador completa cadastro via magic link — endpoints públicos `GET /api/public/invitations/validate?token=` (retorna `state` enum) e `POST /api/public/register/complete` (cria `auth.users` via `SupabaseAdminGateway`, popula `app_user` + `apartment_resident`, marca `invitation.ACCEPTED`, publica audit). Rate-limit Bucket4j 20 req/min/IP in-memory em `/api/public/**`. Frontend: rota pública `/invitations/:token` com tela de aceite (form e-mail readonly + CPF mascarado + senha) e estados LOADING/VALID/EXPIRED/REVOKED/NOT_FOUND/ALREADY_ACCEPTED; redirect `/login?registered=1` no sucesso. Payload Redis dos convites mudou para JSON `{invitationId,condominiumId}` para endpoint público resolver tenant + setar RLS. PR #83 mergeado; smoke E2E prod pendente — ver `docs/features/h4-onboarding-magic-link.md`

### Descobertas não-óbvias da H4 (2026-05-14)

- **Bucket4j in-memory por design:** rate-limit de 20 req/min/IP é implementado em memória JVM (`PublicEndpointsRateLimitFilter`), sem Redis — suficiente para single-instance v1. Quando virar multi-instância, migrar para bucket distribuído no Redis.
- **Payload Redis do token mudou para JSON:** o valor da chave `invitation:token:{token}` passou de `invitation_id` (UUID puro) para `{"invitationId":"...","condominiumId":"..."}`. Necessário porque o endpoint público `/api/public/invitations/validate` precisa setar `SET LOCAL app.current_tenant` antes de consultar o banco — e para isso precisa do `condominiumId` antes de carregar o convite.
- **`SupabaseAdminGateway` com `service_role` key:** criação de `auth.users` exige a chave `SUPABASE_SERVICE_ROLE_KEY` (não a anon key). Em prod essa variável precisa estar configurada no Coolify; o app falha cedo se ausente. Ver `docs/features/h4-onboarding-magic-link.md` para pré-requisitos completos.

  - ⏳ H5 — Morador vê apartamentos onde reside
  - ⏳ H6 — Síndico promove morador / delega voto
  - ⏳ H7 — Síndico cria votação (CRUD + snapshot)
  - ⏳ H8 — Morador vota e vê resultado
  - ⏳ H9 — Timeline de auditoria
  - ⏳ H10 — Jobs residuais (RetentionPruner placeholder)

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

## Fase 5.6 — SemVer com release-please (concluída)

### O que foi implementado

- `release-please-config.json` na raiz: manifest mode, 2 componentes independentes (`backend` Maven + `frontend` Node), `bootstrap-sha` preenchido, flags pre-major ativas
- `.release-please-manifest.json`: versão inicial `0.0.0` para ambos os componentes
- `.github/workflows/release.yml`: `googleapis/release-please-action@v4`, jobs condicionais `publish-backend` (imagem Docker com tag semântica + Coolify webhook) e `deploy-frontend-prod` (Cloudflare Pages branch=main)
- `backend.yml`: job `publish-image` removido — deploy de prod migrou para `release.yml`
- `frontend.yml`: `build-and-deploy` → `deploy-staging`, staging-only, bug do `skipped` corrigido
- Secret `RELEASE_PLEASE_TOKEN` criado no repositório (PAT clássico, escopos `repo` + `workflow`)

### Fluxo de deploy de prod (pós-implementação)

1. Commits convencionais em `backend/**` ou `frontend/**` → merge em develop → merge PR #53 (develop→main)
2. `release.yml` roda → release-please cria Release PR por componente afetado
3. Desenvolvedor revisa CHANGELOG e mergeia o Release PR quando quiser lançar
4. Tag criada → `publish-backend` ou `deploy-frontend-prod` dispara automaticamente

### Pendente (operacional, não bloqueia features)

- PR #53 (`develop → main`) aberto — mergear quando a primeira feature de domínio estiver pronta
- Better Stack configurado monitorando `/actuator/health/liveness` _(manual)_
- Primeiro backup manual Supabase executado _(manual)_

### Não-óbvios críticos

- `GITHUB_TOKEN` padrão não dispara quality gates no Release PR — por isso usa PAT
- Para Maven, release-please cria um PR de SNAPSHOT (`autorelease: snapshot`) após cada push em main — isso é housekeeping, não release. Produção só dispara ao mergear PR com label `autorelease: pending`
- Outputs usam bracket notation: `steps.rp.outputs['backend--release_created']`
- Commits fora de `backend/**` e `frontend/**` não geram bump de versão

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
- **`CondominiumSummary` retorna `roles: Set<UserRoleInCondo>`** — `MULTIPLE` foi eliminado em H0 (história zero de Fase 7); papéis aditivos agora são contrato explícito.
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
