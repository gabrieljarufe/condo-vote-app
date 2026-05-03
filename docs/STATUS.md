# Status do projeto

**Fase atual:** Fase 3 — Walking Skeleton Backend (em andamento)

**Próximo passo:** T3.8 (deploy Coolify) → T3.9 (smoke test prod). Playbook
completo em `docs/runbooks/validate-fase-3.md` Bloco 8.

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
  - ⏳ T3.8 — Deploy Coolify (aguardando merge `develop` → `main`)
  - ⏳ T3.9 — Smoke test prod (depende de T3.8)
  - ✅ T3.10 — Comandos do `CLAUDE.md` atualizados
- ⬜ **Fase 4** — Frontend Skeleton
- ⬜ **Fase 5** — CI/CD
- ⬜ **Fase 6** — Observabilidade & bootstrap formal de condomínio
- ⬜ **Fase 7** — Domain Index

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

## Convenção: atualizar este arquivo

Ao concluir uma task ou descobrir algo não-óbvio, atualizar `STATUS.md` no
mesmo PR. Detalhes técnicos da implementação ficam no código + commit
message; este arquivo é o índice navegável de progresso.
