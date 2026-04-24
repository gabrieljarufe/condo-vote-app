# Fase 2 — Schema e Migrations

**Objetivo:** banco com schema v1 completo, RLS ligada, rodando local e em prod via Flyway.

**Pré-requisitos:** Fase 1 (Supabase provisionado + CLI local).

> **Regra inegociável:** cada tabela com `condominium_id` nasce com RLS na mesma ou em migration subsequente da mesma PR. Nunca "adicionar RLS depois".

---

## T2.1 — Setup Flyway no Spring

> **⚠️ Pré-requisito bloqueante:** T3.1a (Spring Initializr) precisa ter rodado primeiro. Gera `backend/pom.xml`, `backend/mvnw`, `backend/src/main/resources/application*.yml`, `CondoVoteApplication.java`. Sem isto, esta task não executa.

- [ ] Adicionar dependência `flyway-core` + `flyway-database-postgresql` no `backend/pom.xml`
- [ ] `application.yml` (default, prod): `spring.flyway.enabled=true`, `locations=classpath:db/migration`, `baseline-on-migrate=true`
- [ ] `application-local.yml`: adicionar `classpath:db/seed` em `spring.flyway.locations` para ativar `R__seed_dev.sql`. **Jamais** adicionar em `application-prod.yml`.
- [ ] `spring.jpa.properties.hibernate.jdbc.time_zone=UTC` — todos os timestamps armazenados em UTC; UI converte para timezone local.
- [ ] Criar diretório `backend/src/main/resources/db/migration/`
- [ ] **Decisão registrada:** Flyway roda no startup do Spring na v1 (migrado para CI-driven quando time ≥ 3 devs)

**Aceite:** `./mvnw spring-boot:run` não falha por configuração Flyway (ainda sem migrations).

---

## T2.2 — Migration V1: enums
- [ ] `V1__enums.sql` com todos os enums de `docs/data-model.md`: `resident_role`, `resident_end_reason`, `convocation_type`, `quorum_mode`, `poll_status`, `invitation_status`, `poll_invalidation_reason`, `poll_close_trigger`, `audit_event_type`, `email_type`, `email_status`
- [ ] Habilitar extensão `pgcrypto` para `gen_random_uuid()`

**Aceite:** `\dT` no psql lista todos os enums previstos.

---

## T2.3 — Migration V2: condominium
- [ ] `V2__condominium.sql`: tabela conforme spec (id, name, address, created_at)
- [ ] Sem RLS (tabela cross-tenant acessada por superadmin)

---

## T2.4 — Migration V3: app_user
- [ ] `V3__app_user.sql`: tabela com `cpf_encrypted BYTEA UNIQUE`, `email VARCHAR(320) UNIQUE`, `is_active`, `consent_accepted_at`, `consent_policy_version`
- [ ] Sem FK para `auth.users` (decisão arquitetural — validação no service)
- [ ] Sem RLS (perfil é cross-tenant)

---

## T2.5 — Migration V4: apartment + apartment_resident
- [ ] `V4__apartment_and_residents.sql`:
  - [ ] `apartment` com UNIQUE `(condominium_id, COALESCE(block, ''), unit_number)` e UNIQUE `(id, condominium_id)`
  - [ ] `apartment_resident` com partial unique index `(apartment_id) WHERE role = 'OWNER' AND ended_at IS NULL`
  - [ ] Usar `TIMESTAMPTZ` (não `TIMESTAMP`) em `joined_at`, `ended_at` e em **todas** as colunas de data/hora em todas as migrations — regra global: todos os timestamps são `TIMESTAMPTZ` armazenados em UTC.
  - [ ] CHECK constraints de coerência de encerramento
  - [ ] Índices: `idx_apartment_condominium_id`, `idx_apartment_resident_condominium_id`, `idx_apartment_resident_user_id`

**Aceite:** inserir 2 OWNERs ativos no mesmo apt é rejeitado pelo partial unique.

---

## T2.6 — Migration V5: condominium_admin
- [ ] `V5__condominium_admin.sql`: tabela com partial unique `(condominium_id, user_id) WHERE revoked_at IS NULL`
- [ ] CHECK `revoked_at IS NULL OR revoked_by_user_id IS NOT NULL`

---

## T2.7 — Migration V6: invitation
- [ ] `V6__invitation.sql`: tabela + partial unique `(condominium_id, apartment_id, email, role) WHERE status = 'PENDING'`
- [ ] CHECKs de coerência para ACCEPTED/REVOKED
- [ ] **Sem** coluna de token (vive no Redis — `docs/data-model.md` "Token storage")

---

## T2.8 — Migration V7: poll domain
- [ ] `V7__poll_domain.sql`: `poll` (com UNIQUE `(id, condominium_id)` para composite FKs), `poll_option`, `poll_eligible_snapshot`, `vote`, `poll_result`
- [ ] Todos os índices listados no data model
- [ ] CHECK constraints de `poll` para coerência de status ↔ timestamps
- [ ] UNIQUE `(poll_id, apartment_id)` em `vote` (1 voto por apt por poll)

**Aceite:** inserir 2º voto do mesmo apt no mesmo poll é rejeitado.

---

## T2.9 — Migration V8: audit e notifications
- [ ] `V8__audit_and_notifications.sql`: `audit_event` (com índices por entity, event_type, timeline) + `email_notification` (com index partial em PENDING)

---

## T2.10 — Migration V9: RLS policies
- [ ] `V9__rls_policies.sql`: para cada tabela com `condominium_id`:
  - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
  - `CREATE POLICY tenant_isolation ON <table> USING (condominium_id = current_setting('app.current_tenant')::uuid)`
- [ ] Tabelas: `apartment`, `apartment_resident`, `condominium_admin`, `invitation`, `poll`, `poll_eligible_snapshot`, `vote`, `poll_result`, `audit_event`
- [ ] `poll_option` herda filtro via JOIN com `poll` (sem RLS direta)
- [ ] Documentar no arquivo da migration (comentário SQL) o comportamento quando `app.current_tenant` não está setado — esperado: query retorna 0 linhas (a policy `current_setting('app.current_tenant')::uuid` falha com erro se a variável não existe; usar `current_setting('app.current_tenant', true)` com default para evitar erro ou tratar no service).

**Aceite:** psql autenticado como role app executa `SET LOCAL app.current_tenant = '<uuid>'` e vê só dados do tenant; sem SET LOCAL → retorna 0 linhas.

---

## T2.11 — Migration V10: composite FKs
- [ ] `V10__composite_foreign_keys.sql`:
  - `vote (poll_id, condominium_id) → poll`
  - `vote (apartment_id, condominium_id) → apartment`
  - `apartment_resident (apartment_id, condominium_id) → apartment`
  - `poll_eligible_snapshot (poll_id, condominium_id) → poll`
  - `poll_eligible_snapshot (apartment_id, condominium_id) → apartment`
  - `invitation (apartment_id, condominium_id) → apartment`

**Aceite:** tentativa de INSERT com `condominium_id` ≠ do pai é rejeitada por FK.

---

## T2.12 — Seed repeatable para dev local
- [ ] Arquivo: `backend/src/main/resources/db/seed/R__seed_dev.sql` — separado do diretório `db/migration`
- [ ] Picked-up pelo Flyway **somente** quando `spring.flyway.locations` inclui `classpath:db/seed` (configurado em `application-local.yml`; nunca em `application-prod.yml`)
- [ ] Popula: 1 condomínio teste, 1 `app_user` síndico com **UUID fixo** (o mesmo UUID deve existir em `auth.users` do Supabase local)
- [ ] Documentar em `infra/supabase/supabase/seed.sql` (arquivo oficial do Supabase CLI): INSERT em `auth.users` para criar o user do síndico seed com UUID fixo:
  ```sql
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role)
  VALUES ('<uuid-fixo>', 'sindico@local.dev', crypt('password', gen_salt('bf')), now(), 'authenticated')
  ON CONFLICT (id) DO NOTHING;
  ```
  O Supabase CLI executa `seed.sql` automaticamente após `supabase start`.

**Aceite:** após `./mvnw spring-boot:run` com profile `local`, Studio mostra dados seed; em profile `prod` seed não roda.

---

## T2.13 — Teste de integração RLS

> **Pré-requisito:** Docker Desktop instalado e rodando (requerido pelo Testcontainers).

- [ ] `backend/src/test/java/com/condovote/shared/tenant/RlsIsolationIT.java`
- [ ] Usa `@Testcontainers` com `PostgreSQLContainer:16`
- [ ] Setup: Flyway aplica todas as migrations
- [ ] Cenários:
  - [ ] Insere condo A e condo B; com `SET LOCAL app.current_tenant = A`, `SELECT * FROM apartment` retorna só de A
  - [ ] Sem `SET LOCAL`: query retorna 0 (a policy exige tenant setado) — documentar comportamento observado
  - [ ] Insere `vote` com `condominium_id` divergente entre vote e apartment → FK rejeita
- [ ] Configurar como `@Tag("integration")` para rodar no `verify` (não em `test` unitário)

**Aceite:** suite roda verde local (`./mvnw verify`) e em CI (Fase 5).
