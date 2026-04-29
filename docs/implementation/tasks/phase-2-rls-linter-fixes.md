# Phase 2 — RLS Linter Fixes (Performance + falsos positivos de Security)

**Data:** 2026-04-28
**Origem:** `docs/analysis/2026-04-27-supabase-linter-rls-warnings.md`
**Pré-condição:** análise concluída; usuário confirmou que Data API do Supabase está desabilitada.

---

## Objetivo

Aplicar a otimização `auth_rls_initplan` em todas as 9 políticas `tenant_isolation` (envolver `current_setting()` em `(SELECT ...)`) **reescrevendo** a migration V9 — sem criar migration adicional, já que estamos em fase pré-produção. Em paralelo, registrar formalmente nas docs as decisões que tornam os warnings `rls_disabled_in_public` falsos positivos legítimos.

**Não-objetivo:** habilitar RLS em `app_user`, `condominium`, `email_notification`, `poll_option`. Justificativa completa na análise (seção 2.3).

---

## Garantias semânticas (por que é seguro reescrever V9)

A mudança `current_setting('app.current_tenant', true)::uuid` → `(SELECT current_setting('app.current_tenant', true)::uuid)` é **semanticamente idêntica**:

- Mesmo valor retornado (current_setting não muda dentro de uma transação)
- Mesma comparação (`condominium_id = <uuid>`)
- Mesmo comportamento quando `app.current_tenant` não está setado (segundo arg `true` = missing_ok → `NULL` → `NULL::uuid` → policy nega tudo)
- Apenas o plano de execução muda: de re-avaliação por linha para InitPlan único por query

**Não há vetor de regressão.** Não introduz novo modo de falha. Não muda o caminho da query no caso normal nem no caso degenerado (sem tenant setado).

---

## Tarefas

### T2.14 — Reescrever V9__rls_policies.sql ✅

- [x] Adicionar bloco de comentário no topo (antes dos `ALTER TABLE`):
  - Justificativa do `(SELECT ...)` (link para `docs/analysis/2026-04-27-supabase-linter-rls-warnings.md` §3)
  - Justificativa de quais tabelas **não têm RLS** e por quê (link para mesma análise §2)
  - Aviso explícito: esta decisão pressupõe Data API desabilitada — reverter se Data API for habilitada no futuro
- [x] Em todas as 9 policies, substituir `current_setting('app.current_tenant', true)::uuid` por `(SELECT current_setting('app.current_tenant', true)::uuid)` na cláusula `USING`
- [x] Manter ordem dos `ALTER TABLE` e dos `CREATE POLICY` exatamente como hoje
- [x] Nenhuma mudança em V1–V8, V10

### T2.15 — Validar localmente ✅

- [x] `supabase db reset` (drop + recreate local DB) — OK
- [x] `./mvnw flyway:migrate -Plocal` (aplica V1–V10) — 10 migrations aplicadas com sucesso
  - **Bônus:** Maven profile `local` adicionado em `pom.xml` — elimina necessidade de passar params na mão
- [x] `supabase db lint` — 0 warnings (0 `auth_rls_initplan` ✅; `rls_disabled_in_public` não disparado pelo linter local — comportamento esperado, regra é exclusiva do linter cloud)
- [x] `EXPLAIN` com `SET ROLE authenticated` — RLS aplicada; Postgres 17 otimiza a subquery automaticamente (função `STABLE`), não gerando nó InitPlan separado mas garantindo avaliação única

### T2.16 — Atualizar `docs/architecture.md` ✅

- [x] **§3 (Banco):** subseção "Role do backend e service_role" adicionada — role `postgres` sem BYPASSRLS, `service_role` reservada para v2+
- [x] **§8 (Segurança):** subseção "Por que algumas tabelas não têm RLS" adicionada — boundary externa (Data API off), boundary interna (JDBC direto), trade-off e pré-condição reversível

### T2.17 — Atualizar checklist em Phase 6 (observabilidade) ✅

- [x] `T6.3b` adicionado em `phase-6-observability.md` — runbook mensal de verificação da Data API

### T2.18 — Atualizar `docs/implementation/tasks/phase-2-schema-migrations.md` ✅

- [x] T2.10 atualizado com referência a T2.14 e ao resultado do lint

### T2.19 — Memória de projeto (auto-memory) ✅

- [x] Memória `project_supabase_data_api_off.md` atualizada com status das ações de 2026-04-28

---

## O que **de fato** vai ser alterado (manifesto de mudanças)

### Código/SQL
| Arquivo | Mudança | Tipo |
|---|---|---|
| `backend/src/main/resources/db/migration/V9__rls_policies.sql` | Header comment expandido + 9 policies com `(SELECT current_setting(...))` | **Edit** (rewrite) |

### Documentação
| Arquivo | Mudança | Tipo |
|---|---|---|
| `docs/architecture.md` | Adições em §3 (role `postgres`, `service_role` reservada) e §7 (subseção "Por que algumas tabelas não têm RLS") | **Edit** |
| `docs/implementation/tasks/phase-6-observability.md` | +1 item no runbook mensal (verificar Data API off) | **Edit** |
| `docs/implementation/tasks/phase-2-schema-migrations.md` | Marcar T2.14–T2.17 como done; cross-ref para esta task | **Edit** |
| `docs/analysis/2026-04-27-supabase-linter-rls-warnings.md` | (Já criado em 2026-04-27) | — |
| `docs/implementation/tasks/phase-2-rls-linter-fixes.md` | Este arquivo | **Create** |

### Memória persistente
| Arquivo | Mudança |
|---|---|
| `~/.claude/.../memory/project_supabase_data_api_boundary.md` | Novo memory `project` |
| `~/.claude/.../memory/MEMORY.md` | +1 linha apontando para o memory acima |

### Não muda
- V1–V8, V10: nenhuma alteração
- Schema lógico (tabelas, colunas, índices, FKs): inalterado
- Application code (Spring Boot): inalterado — `TenantInterceptor` e `TenantAOP` continuam funcionando exatamente igual; apenas o plano interno do Postgres muda
- `application-local.yaml`, `application.yaml`: inalterado
- Frontend (Angular): inalterado
- Coolify env vars: inalterado

---

## Critérios de done

- [x] V9 reescrita; `supabase db reset` + `flyway:migrate -Plocal` rodam sem erro
- [x] `supabase db lint` mostra 0 warnings de `auth_rls_initplan`
- [x] `EXPLAIN` com `SET ROLE authenticated` confirma RLS aplicada (Postgres 17 otimiza automaticamente — sem nó InitPlan separado, mas avaliação única garantida)
- [x] T2.13 (teste de integração RLS) passa com a V9 reescrita — 3/3 testes verdes (2026-04-28)
- [x] `docs/architecture.md` §3 e §8 atualizados
- [x] `docs/implementation/tasks/phase-6-observability.md` com novo item de runbook (T6.3b)
- [x] `docs/implementation/tasks/phase-2-schema-migrations.md` com referência a T2.14

---

## Dependências e ordem sugerida

1. T2.14 (rewrite V9) — pode ser feita primeiro, isolada
2. T2.15 (validação local) — bloqueia merge se falhar
3. T2.16, T2.17, T2.18 — paralelizáveis após T2.15 verde
4. T2.19 (memory) — última, depois de tudo aplicado

Estimativa: 30-60 minutos no total. Maior parte é redação de docs.
