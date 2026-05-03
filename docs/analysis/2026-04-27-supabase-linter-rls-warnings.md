# Análise: Warnings do Supabase Linter (RLS) — 2026-04-27

## Contexto

Após subir as migrations V1–V10 localmente (Supabase CLI), o linter do Supabase reportou:

- **5 erros SECURITY** `rls_disabled_in_public`: tabelas `email_notification`, `flyway_schema_history`, `app_user`, `condominium`, `poll_option` sem RLS no schema `public`.
- **9 warnings PERFORMANCE** `auth_rls_initplan`: políticas `tenant_isolation` em `apartment`, `apartment_resident`, `condominium_admin`, `invitation`, `poll`, `poll_eligible_snapshot`, `vote`, `poll_result`, `audit_event` re-avaliam `current_setting()` por linha.

A premissa inicial do usuário era "todos são falsos positivos". Após análise estrutural do projeto, o veredito é mais nuançado.

---

## 1. Estado arquitetural relevante (ground truth)

Decisões já fechadas em `architecture.md` e `condo-vote-principles.md`:

| Item | Estado | Fonte |
|---|---|---|
| **Data API (PostgREST) do Supabase** | **DESABILITADA** ("No schemas can be queried"). Frontend/qualquer cliente externo **não consegue** chamar `/rest/v1/*` para esse projeto. | Confirmado pelo usuário em 2026-04-27 |
| **Backend → Postgres** | Conexão JDBC direta via `DATABASE_URL` com role `postgres`. Não passa por PostgREST. | `application-local.yaml` (`username: postgres`); `architecture.md §3` Coolify env vars |
| **Anon key no frontend** | Usada **exclusivamente** para Supabase Auth API (signUp, signIn, refresh, reset). Não usada para queries de domínio. | `architecture.md §1` "não usar PostgREST/Edge Functions"; `condo-vote-principles.md §3` "Lock-in mitigado" |
| **JWT validation** | Local no Spring via JWKS (chaves públicas ECC P-256), sem `SUPABASE_JWT_SECRET`. | `architecture.md §1` "Por que JWKS em vez de HS256" |
| **Service role key** | Configurada no Coolify, mas **uso ainda não definido**. Provável uso: bootstrap de condomínio (Phase 6) e operações administrativas que precisam bypassar RLS. | `architecture.md §3` env vars; `condo-vote-principles.md §13` |
| **Tenant isolation** | RLS em todas as tabelas com `condominium_id` + `SET LOCAL app.current_tenant` injetado pelo `TenantInterceptor`. Tabelas cross-tenant (`app_user`, `condominium`, `email_notification`) sem RLS — acessadas pelo backend com queries explícitas. | `V9__rls_policies.sql`; `architecture.md §1` TenantInterceptor |

### Implicação direta sobre os warnings

Com **Data API desabilitada**, a superfície externa (`facing: EXTERNAL` reportada pelo linter) é **fictícia**. O linter assume PostgREST ativo; no nosso caso, ele não está. Os roles `anon` e `authenticated` **não conseguem alcançar nenhuma tabela do schema `public`** porque o gateway PostgREST está fechado no nível do projeto Supabase.

Isso muda materialmente a avaliação dos erros SECURITY.

---

## 2. SECURITY — `rls_disabled_in_public`

### 2.1 Veredito por tabela (revisado)

| Tabela | Veredito | Justificativa |
|---|---|---|
| `flyway_schema_history` | **Falso positivo definitivo** | Tabela operacional do Flyway, sem PII. Mesmo se exposta, não há vetor de dano. |
| `app_user` | **Falso positivo no contexto atual** | Contém `cpf_encrypted` e e-mail. Mas com Data API off, nenhum cliente externo alcança a tabela. Backend usa role `postgres` — RLS não adiciona barreira contra o próprio backend. |
| `condominium` | **Falso positivo no contexto atual** | Cross-tenant por design. Sem PostgREST, sem exposição. |
| `email_notification` | **Falso positivo no contexto atual** | Outbox de e-mails — só o job `EmailSender` do backend escreve/lê. |
| `poll_option` | **Falso positivo no contexto atual** | Filtro via JOIN com `poll` (que tem RLS). Backend nunca expõe `poll_option` sem o JOIN. |

**Conclusão:** com Data API desabilitada, **todos os 5 erros SECURITY são falsos positivos legítimos**. O linter não tem como saber que a Data API está off — ele dispara o alerta com base apenas na ausência de `ROW LEVEL SECURITY` na tabela.

### 2.2 Impacto de remover/desativar a anon key

A anon key **não pode ser removida sem quebrar o fluxo de auth**. Onde ela é usada:

| Operação | Quem usa | Substituível? |
|---|---|---|
| `supabase.auth.signUp(...)` | Angular (passo 4 do onboarding em `architecture.md §1`) | Não — Supabase Auth API exige `apikey` header com anon key |
| `supabase.auth.signInWithPassword(...)` | Angular (login) | Não |
| `supabase.auth.refreshSession()` | Angular (refresh automático do JS SDK) | Não |
| `supabase.auth.resetPasswordForEmail(...)` | Angular (recuperação de senha) | Não |
| Queries em tabelas via `.from('xxx').select()` | **Ninguém neste projeto** | N/A |

Conclusão: **a anon key é obrigatória para o fluxo de auth, mas seu único uso é Supabase Auth API**. A blindagem efetiva contra "anon key vazada faz query no DB" já existe via Data API desabilitada. **Não há ação adicional de revogação a tomar.**

Se em algum momento futuro precisarmos habilitar a Data API (ex: realtime subscriptions na v2), aí sim será necessário:
- Revogar `GRANT` em `public.*` para `anon` e `authenticated`, OU
- Habilitar RLS defensiva nas tabelas cross-tenant.

### 2.3 Impacto de habilitar RLS nas tabelas cross-tenant

**Custo na jornada de auth/queries do backend é alto** se feito ingenuamente, e a justificativa é fraca dado que Data API está off. Análise:

#### Como RLS interage com o role `postgres` (Supabase)

Diferente de superusers do Postgres puro, o role `postgres` no **Supabase Cloud não tem `BYPASSRLS`**. Significa: se ligarmos RLS em `app_user`, `condominium`, etc., as queries do backend **vão começar a respeitar a política**.

Cenários que **quebrariam imediatamente**:

| Operação | Tabela | Por que quebra |
|---|---|---|
| `/register/complete` valida invitation por email | `app_user` (SELECT por email antes de criar/atualizar) | Sem `current_tenant` setado (não há tenant no signup); RLS bloqueia. |
| Listar condomínios do user logado (`GET /me/condominiums`) | `condominium` | Endpoint cross-tenant por design (não tem header `X-Tenant-Id`); RLS bloqueia. |
| Job `EmailSender` faz `SELECT FROM email_notification WHERE status='PENDING'` | `email_notification` | Job não tem tenant; RLS bloqueia. |
| Bootstrap de condomínio (V1001+ migrations) | `condominium`, `app_user`, `condominium_admin` | Migration roda sem tenant context; RLS bloqueia. |

Para fazer funcionar com RLS habilitada nessas tabelas, três caminhos:

1. **Policies permissivas (`USING (true)` para essas tabelas):** equivale a não ter RLS. Engana o linter, agrega zero segurança real, adiciona ruído de manutenção.
2. **Backend usa `service_role` (BYPASSRLS) para queries cross-tenant:** exige separar pools de conexão (um para tenant queries, outro para cross-tenant). Adiciona complexidade significativa no `JdbcTemplate`/JPA config. Quebra simplicidade do `TenantAOP`.
3. **Funções `SECURITY DEFINER`:** encapsular cada query cross-tenant numa função SQL dona pelo `postgres`. Verboso, espalha lógica entre Java e SQL.

**Conclusão:** habilitar RLS nas tabelas cross-tenant tem custo arquitetural alto e ganho de segurança marginal **enquanto a Data API estiver off**. Não compensa.

### 2.4 Decisão final SECURITY

**Não habilitar RLS** em `app_user`, `condominium`, `email_notification`, `poll_option`, `flyway_schema_history`. Manter o desenho atual.

Ações concretas:
1. **Documentar** em `architecture.md §7` (Segurança) que Data API está desabilitada e isso é o boundary externo do schema. Esta decisão deve ser revertida (revogar grants ou habilitar RLS defensiva) **antes** de qualquer ativação futura de Data API.
2. **Suprimir os warnings do linter** com comentário SQL no início do `V9__rls_policies.sql`, justificando a decisão (linkando esta análise).
3. **Adicionar checklist em Phase 6** (observabilidade/runbook): verificar mensalmente se Data API continua off no Dashboard Supabase.

---

## 3. PERFORMANCE — `auth_rls_initplan`

### 3.1 O que o warning está apontando

Política atual (V9):
```sql
CREATE POLICY tenant_isolation ON apartment
    USING (condominium_id = current_setting('app.current_tenant', true)::uuid);
```

`current_setting()` é uma função `STABLE` (resultado constante dentro de uma transação). **Em teoria**, o planner do Postgres poderia avaliar uma vez e reusar. **Na prática**, o planner trata expressões em RLS de forma conservadora e re-avalia por linha em muitos casos — especialmente quando a política é aplicada via `SeqScan` ou em parte de subqueries inlined.

Recomendação do linter (e da doc oficial Supabase/Postgres):
```sql
CREATE POLICY tenant_isolation ON apartment
    USING (condominium_id = (SELECT current_setting('app.current_tenant', true)::uuid));
```

### 3.2 Por que `(SELECT ...)` é melhor

Wrapping em `(SELECT ...)` força o planner a tratar a expressão como uma **subquery não-correlacionada**. Subqueries não-correlacionadas viram **InitPlan**: executadas **uma única vez** por query, resultado materializado como constante para o restante do plano.

Comparação no `EXPLAIN`:

**Sem otimização:**
```
Filter: (condominium_id = (current_setting('app.current_tenant', true))::uuid)
  rows: re-evaluates current_setting() per row scanned
```

**Com otimização:**
```
InitPlan 1 (returns $0):
  -> Result (cost=0.00..0.01 rows=1)
       Output: (current_setting('app.current_tenant', true))::uuid
Filter: (condominium_id = $0)
  rows: $0 is a constant, evaluated 1x total
```

### 3.3 Magnitude do ganho neste schema

O custo de uma chamada `current_setting()` é da ordem de microssegundos. Em queries pequenas (10-100 linhas), o ganho é imperceptível. Onde **aparece**:

| Tabela | Cardinalidade prevista | Impacto da otimização |
|---|---|---|
| `apartment` | dezenas a centenas por condomínio | Negligível |
| `apartment_resident` | similar a `apartment` | Negligível |
| `vote` | apartments × polls (por condomínio) | Mensurável em queries de auditoria |
| `poll_eligible_snapshot` | apartments × polls (cross-poll) | Mensurável em listagens históricas |
| **`audit_event`** | **cresce sem teto** (todas as ações do sistema) | **Significativo** em listagens longas (>10k linhas) |
| `poll_result` | 1 linha por opção × polls | Negligível |
| `email_notification` | N/A (sem RLS) | — |

A CLAUDE.md explicitamente pede no framework de análise: *"Quais tabelas podem crescer sem controle?"* — `audit_event` é a resposta. Essa otimização é particularmente relevante para ela.

### 3.4 Trade-off

**Nenhum.** O comportamento semântico é idêntico — só muda o plano de execução. Não há regressão possível. É a recomendação oficial do PostgreSQL para RLS em escala.

### 3.5 Decisão final PERFORMANCE

**Aplicar a otimização.**

---

## 4. Estratégia de aplicação — reescrever vs. nova migration

### 4.1 Critério geral

A decisão depende de **se as migrations já foram aplicadas em produção**. Se sim, reescrever quebra checksum do Flyway e exige `repair`. Se não, reescrever é mais limpo.

### 4.2 Estado atual do projeto

Confirmado pela CLAUDE.md ("Estado atual: Fase 2 em andamento") e por `phase-2-schema-migrations.md`:

- Migrations V1–V10 aplicadas **apenas em dev local** (Supabase CLI local).
- **Não há ambiente de produção ainda** — Phase 1 (infra Coolify/Oracle) está em estado parcial; Phase 5 (CI/CD) não rodou em main.
- T2.13 (teste de integração RLS) ainda não foi feito — ou seja, as policies nem foram validadas em integração.

**Conclusão:** estamos no momento ideal para reescrever. Não há checksum em produção, não há migrations dependendo do estado atual da V9. CLAUDE.md inclusive diz: *"podemos reescrever migrations já existente para se adaptarem ao nosso contexto"* (instrução do usuário, 2026-04-27).

### 4.3 Plano de reescrita

**Arquivo a alterar:** `backend/src/main/resources/db/migration/V9__rls_policies.sql`

**Mudança:** envolver `current_setting('app.current_tenant', true)::uuid` em `(SELECT ...)` em todas as 9 policies. Adicionar também o `WITH CHECK` (não estava no V9 original, mas é boa prática para garantir que INSERTs/UPDATEs também respeitem a política — atualmente sem `WITH CHECK` o Postgres usa o `USING` como fallback, o que funciona, mas é menos explícito).

Adicionar no topo do arquivo um bloco de comentário:
- Justificativa do `(SELECT ...)` (link para esta análise)
- Justificativa de por que algumas tabelas não têm RLS (link para esta análise)
- Aviso: esta decisão depende de Data API desabilitada — reverter se Data API for habilitada.

### 4.4 Verificação pós-rewrite

Antes de marcar o rewrite como done:
1. `supabase db reset` (drop + recriar local)
2. Rodar linter: `supabase db lint` — confirmar 0 warnings de `auth_rls_initplan`
3. Confirmar que os 5 warnings de `rls_disabled_in_public` continuam (esperado — falsos positivos documentados)
4. Aguardar T2.13 (integração RLS) para validar comportamento sob queries reais

---

## 5. Pendências documentais

Para fechar o ciclo, atualizar:

1. **`docs/architecture.md` §7 (Segurança):** adicionar subseção "Por que sem RLS em tabelas cross-tenant" com o raciocínio desta análise. Citar Data API off como pré-condição.
2. **`docs/architecture.md` §3 (Banco):** registrar que o backend conecta como role `postgres` (sem BYPASSRLS) e que `service_role` está reservado para operações administrativas futuras (bootstrap, jobs sem tenant — não usado na v1 ainda).
3. **`docs/implementation/tasks/phase-6-observability.md`:** adicionar item de runbook — verificar mensalmente que Data API permanece off no Dashboard.
4. **MEMORY auto:** registrar como `project` que (a) Data API está off e essa é a fronteira externa do DB, (b) anon key é apenas Auth API, (c) decisão revisitar quando/se Data API for habilitada.

---

## 6. Resumo executivo

| Categoria | Veredito | Ação |
|---|---|---|
| 5x `rls_disabled_in_public` | Falso positivo (Data API off) | Documentar + suprimir warning. **Não habilitar RLS.** |
| 9x `auth_rls_initplan` | Otimização legítima | **Reescrever V9** envolvendo `current_setting()` em `(SELECT ...)`. |

**Não há trade-off real** em nenhuma das duas decisões. A primeira economiza complexidade arquitetural (RLS em tabelas cross-tenant exigiria pools separados ou policies fictícias). A segunda é puro ganho de performance sem custo.

**Pré-condição crítica:** se Data API for habilitada no futuro (v2, realtime), esta análise precisa ser revisitada — o veredito de SECURITY muda completamente.
