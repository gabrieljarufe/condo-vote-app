# Fase 2 — Schema e Migrations

**Objetivo:** banco com schema v1 completo, RLS ligada, rodando local e em prod via Flyway.

**Pré-requisitos:** Fase 1 (Supabase provisionado + CLI local).

> **Regra inegociável:** cada tabela com `condominium_id` nasce com RLS na mesma ou em migration subsequente da mesma PR. Nunca "adicionar RLS depois".

> **Convenção UUID (todas as migrations desta fase):** colunas PK UUID **não** declaram `DEFAULT gen_random_uuid()`. App gera UUID v7 via Hibernate `@UuidGenerator(style = TIME)`. Para SQL puro (seed `R__seed_dev.sql` em T2.12 e bootstrap `V1001+`), gerar UUID v7 offline e hardcodar (ver `docs/data-model.md` seção "UUID v7 como padrão do projeto" → "Geração offline"). Decisão expandida em 2026-04-26.

---

## T2.1 — Setup Flyway no Spring ✅

> **⚠️ Pré-requisito bloqueante:** T3.1a (Spring Initializr) precisa ter rodado primeiro. Gera `backend/pom.xml`, `backend/mvnw`, `backend/src/main/resources/application*.yml`, `CondoVoteApplication.java`. Sem isto, esta task não executa.

- [x] Adicionar dependência `flyway-core` + `flyway-database-postgresql` no `backend/pom.xml`
- [x] `application.yaml` (default): `spring.flyway.enabled=true`, `locations=classpath:db/migration`, `baseline-on-migrate=true`, `validate-on-migrate=true`, `out-of-order=false`
- [x] `application-local.yaml`: adiciona `classpath:db/seed` em `spring.flyway.locations` para ativar `R__seed_dev.sql`. **Jamais** adicionar em prod.
- [x] `spring.jpa.properties.hibernate.jdbc.time_zone=UTC` — todos os timestamps armazenados em UTC; UI converte para timezone local.
- [x] Criar diretório `backend/src/main/resources/db/migration/`
- [x] Criar diretório `backend/src/main/resources/db/seed/`
- [x] **Decisão registrada:** Flyway roda no startup do Spring na v1 (migrado para CI-driven quando time ≥ 3 devs)

**Aceite:** `./mvnw spring-boot:run` não falha por configuração Flyway (ainda sem migrations).

---

## T2.2 — Migration V1: enums ✅
- [x] `V1__enums.sql` com todos os enums de `docs/data-model.md`: `resident_role`, `resident_end_reason`, `convocation_type`, `quorum_mode`, `poll_status`, `invitation_status`, `poll_invalidation_reason`, `poll_close_trigger`, `audit_event_type`, `email_type`, `email_status`
- [x] Habilitar extensão `pgcrypto` para `gen_random_uuid()`

**Aceite:** `\dT` no psql lista todos os enums previstos.

---

## T2.2a — Aplicar otimizações de escala no `data-model.md`

> **Pré-requisito bloqueante das migrations V4, V7 e V8.** A análise de escala (`docs/analysis/2026-04-25-data-model-scale-review.md`) aprovou 5 otimizações que precisam refletir na fonte da verdade antes das migrations serem escritas. Sem isto, há risco de divergência entre `data-model.md` e o schema real.

**Referência:** `docs/analysis/2026-04-25-data-model-scale-review.md`

- [x] Issue #1 — adicionar em `data-model.md` (seção `poll`): índices parciais `idx_poll_due_to_open ON (scheduled_start) WHERE status='SCHEDULED'` e `idx_poll_due_to_close ON (scheduled_end) WHERE status='OPEN'`
- [x] Issue #2 — adicionar em `data-model.md` (seção `poll`): coluna `eligible_count INT NULL` (denormalização de `|snapshot|`, preenchida na transição SCHEDULED→OPEN). Documentar invariante: `eligible_count = COUNT(poll_eligible_snapshot WHERE poll_id = poll.id)` no momento da abertura
- [x] Issue #3 — atualizar em `data-model.md` (seção `email_notification`): trocar `INDEX ON (scheduled_for) WHERE status='PENDING'` por `idx_email_pending_fifo (scheduled_for, created_at) WHERE status='PENDING'`
- [x] Issue #4 — UUID v7 documentado como padrão do projeto em `data-model.md` (escopo expandido 2026-04-26). Migrations **não** usam `DEFAULT gen_random_uuid()` — app gera via `@UuidGenerator(style = TIME)` em todas as entities de domínio (implementação na Fase 3 — entities). Única exceção: entity de `app_user`, cujo ID vem do Supabase Auth.
- [ ] Issue #5 — adiada conscientemente — pode ser aplicada como índice retroativo quando a rotatividade de moradores justificar; baixo custo de adicionar depois

**Aceite:** `data-model.md` reflete todas as 5 mudanças. Cada mudança tem nota inline referenciando o doc de análise. Próximas migrations podem ser escritas usando o `data-model.md` como fonte única.

---

## T2.3 — Migration V2: condominium ✅
- [x] `V2__condominium.sql`: tabela conforme spec (id, name, address, created_at)
- [x] Sem RLS (tabela cross-tenant acessada por superadmin)

---

## T2.4 — Migration V3: app_user ✅
- [x] `V3__app_user.sql`: tabela com `cpf_encrypted BYTEA UNIQUE`, `email VARCHAR(320) UNIQUE`, `is_active`, `consent_accepted_at`, `consent_policy_version`
- [x] Sem FK para `auth.users` (decisão arquitetural — validação no service)
- [x] Sem RLS (perfil é cross-tenant)

---

## T2.5 — Migration V4: apartment + apartment_resident ✅
- [x] `V4__apartment_and_residents.sql`:
  - [x] `apartment` com UNIQUE `(condominium_id, COALESCE(block, ''), unit_number)` e UNIQUE `(id, condominium_id)`
  - [x] `apartment_resident` com partial unique index `(apartment_id) WHERE role = 'OWNER' AND ended_at IS NULL`
  - [x] Usar `TIMESTAMPTZ` (não `TIMESTAMP`) em `joined_at`, `ended_at` e em **todas** as colunas de data/hora em todas as migrations — regra global: todos os timestamps são `TIMESTAMPTZ` armazenados em UTC.
  - [x] CHECK constraints de coerência de encerramento
  - [x] Índices: `idx_apartment_condominium_id`, `idx_apartment_resident_condominium_id`, `idx_apartment_resident_user_id`
  - [ ] **[Otimização Issue #5]** `idx_apartment_resident_active ON (apartment_id) WHERE ended_at IS NULL` — adiada conscientemente; adicionar como índice retroativo quando rotatividade justificar

**Aceite:** inserir 2 OWNERs ativos no mesmo apt é rejeitado pelo partial unique.

---

## T2.6 — Migration V5: condominium_admin ✅
- [x] `V5__condominium_admin.sql`: tabela com partial unique `(condominium_id, user_id) WHERE revoked_at IS NULL`
- [x] CHECK `revoked_at IS NULL OR revoked_by_user_id IS NOT NULL`

---

## T2.7 — Migration V6: invitation ✅
- [x] `V6__invitation.sql`: tabela + partial unique `(condominium_id, apartment_id, email, role) WHERE status = 'PENDING'`
- [x] CHECKs de coerência para ACCEPTED/REVOKED
- [x] **Sem** coluna de token (vive no Redis — `docs/data-model.md` "Token storage")

---

## T2.8 — Migration V7: poll domain ✅
- [x] `V7__poll_domain.sql`: `poll` (com UNIQUE `(id, condominium_id)` para composite FKs), `poll_option`, `poll_eligible_snapshot`, `vote`, `poll_result`
- [x] Todos os índices listados no data model
- [x] CHECK constraints de `poll` para coerência de status ↔ timestamps
- [x] UNIQUE `(poll_id, apartment_id)` em `vote` (1 voto por apt por poll)
- [x] **[Otimização Issue #2]** coluna `poll.eligible_count INT NULL`
- [x] **[Otimização Issue #1]** índices parciais `idx_poll_due_to_open` e `idx_poll_due_to_close`

**Aceite:** inserir 2º voto do mesmo apt no mesmo poll é rejeitado.

---

## T2.9 — Migration V8: audit e notifications ✅
- [x] `V8__audit_and_notifications.sql`: `audit_event` + `email_notification`
- [x] **[Otimização Issue #3]** `idx_email_pending_fifo ON email_notification (scheduled_for, created_at) WHERE status = 'PENDING'`

---

## T2.10 — Migration V9: RLS policies ✅
- [x] `V9__rls_policies.sql`: 9 tabelas com `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY tenant_isolation`
- [x] `poll_option` herda filtro via JOIN com `poll` (sem RLS direta)
- [x] Usa `current_setting('app.current_tenant', true)` (missing_ok=true) — sem tenant → retorna NULL → 0 linhas (documentado no arquivo)

**Aceite:** psql autenticado como role app executa `SET LOCAL app.current_tenant = '<uuid>'` e vê só dados do tenant; sem SET LOCAL → retorna 0 linhas.

---

## T2.11 — Migration V10: composite FKs ✅
- [x] `V10__composite_foreign_keys.sql`:
  - [x] `vote (poll_id, condominium_id) → poll`
  - [x] `vote (apartment_id, condominium_id) → apartment`
  - [x] `apartment_resident (apartment_id, condominium_id) → apartment`
  - [x] `poll_eligible_snapshot (poll_id, condominium_id) → poll`
  - [x] `poll_eligible_snapshot (apartment_id, condominium_id) → apartment`
  - [x] `invitation (apartment_id, condominium_id) → apartment`

**Aceite:** tentativa de INSERT com `condominium_id` ≠ do pai é rejeitada por FK.

---

## T2.12 — Seed repeatable para dev local
- [ ] Arquivo: `backend/src/main/resources/db/seed/R__seed_dev.sql` — separado do diretório `db/migration`
- [ ] Picked-up pelo Flyway **somente** quando `spring.flyway.locations` inclui `classpath:db/seed` (configurado em `application-local.yml`; nunca em `application-prod.yml`)
- [ ] **UUIDs hardcoded como v7** — não usar `gen_random_uuid()` (geraria v4, violando o padrão do projeto). Gerar UUIDs v7 offline (ver `data-model.md` seção "UUID v7 como padrão do projeto" → "Geração offline") e hardcodar. Adicionar comentário SQL com a data de geração para rastreabilidade.
- [ ] Popula: 1 condomínio teste, 1 `app_user` síndico com **UUID fixo** (o mesmo UUID deve existir em `auth.users` do Supabase local). O UUID do `app_user`/síndico segue o formato gerado pelo Supabase Auth (v4 atualmente) — única exceção ao padrão v7 do projeto.
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
