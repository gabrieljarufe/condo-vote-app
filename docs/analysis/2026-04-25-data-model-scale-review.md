# Análise de Escala do Data Model — 2026-04-25

> **Atualização 2026-04-26:** documento histórico — decisões já aplicadas. Issues #1, #2, #3 estão refletidas em `data-model.md`. Issue #4 teve **escopo expandido**: UUID v7 virou padrão do projeto (todas as PKs UUID geradas pelo app), não apenas as 3 tabelas hot originalmente propostas; além disso, decidiu-se remover `DEFAULT gen_random_uuid()` das colunas PK para evitar heterogeneidade silenciosa. Issue #5 conscientemente adiada. Fonte de verdade atual: `docs/data-model.md` seção "UUID v7 como padrão do projeto".
>
> **Status original:** decisões pendentes de aprovação. Aguarda decisão antes de aplicar nas migrations da Fase 2.
> **Contexto:** análise feita durante a Fase 2 (Schema e Migrations), após criar V1 (`enums.sql`). V2+ ainda não escritas — janela ideal para incorporar otimizações.

---

## Sumário

A modelagem é estruturalmente sólida (RLS por tenant, composite FKs, snapshot imutável, transactional outbox). Foram identificados **5 ajustes táticos** que custam pouco trabalho e evitam degradação progressiva ao longo de 2-3 anos de uso.

---

## 1. Cenário avaliado: 5 condomínios votando ao mesmo tempo

**Veredito:** passa com folga. Gargalo está em índices ausentes para queries cross-tenant dos jobs `@Scheduled`, não na arquitetura.

### Por quê passa

- RLS particiona logicamente queries por tenant
- HikariCP pool 10 atende ~1000 req/s; voto custa ~10ms
- 5 condos × 100 votos simultâneos ≈ 500 INSERTs em ~5s. Trivial.

### Onde dói

#### 1.1 Jobs cross-tenant fazem seq scan em `poll`

```sql
-- PollOpenerJob a cada 60s
SELECT * FROM poll WHERE status = 'SCHEDULED' AND scheduled_start <= now() FOR UPDATE;
```

Os índices atuais (`condominium_id`, `condominium_id+status`) **não ajudam** essa query — não há filtro por tenant. Postgres faz seq scan.

| Volume                       | Polls totais | Custo do scan                  |
| ---------------------------- | ------------ | ------------------------------ |
| v1 piloto                    | ~50          | <1ms                           |
| 1 ano (50 condos × 30 polls) | ~1500        | ~5ms                           |
| 3 anos (200 condos)          | ~18k         | ~50ms × 3 jobs × 60/min = real |

#### 1.2 `AllVotedCheckerJob` é N+1

Para cada poll OPEN: 2 COUNT queries. Para 25 polls = 51 queries/min. Não morre, mas é gritante.

---

## 2. Análise de UUIDs

**Veredito:** UUID v4 aceitável para v1, mas é dívida técnica nas tabelas hot.

### Problema

`gen_random_uuid()` produz valores 100% aleatórios. Em B-tree:

- Page splits constantes
- Cache miss alto
- Fragmentação progressiva
- Throughput de INSERT cai com volume (25k/s → 10-15k/s após índice > RAM)

### Comparação para `vote`

| Volume          | UUID v4                | UUID v7 (timestamp-ordered) |
| --------------- | ---------------------- | --------------------------- |
| ~10k votos (v1) | OK                     | OK (idêntico)               |
| ~500k votos     | Degradação perceptível | Mantém perf                 |
| ~10M+ votos     | Latência 2-3× pior     | Mantém perf                 |

### Solução

UUID v7 (RFC 9562, 2024) tem 48 bits de timestamp no início → INSERTs quase ordenados. Hibernate 6.6+ suporta via `@UuidGenerator(style = TIME)`.

**Onde adotar:**
| Tabela | Volume | Recomendação |
|---|---|---|
| `condominium`, `apartment`, `poll` | baixo | UUID v4 default — ok |
| `vote`, `audit_event`, `email_notification` | alto | **UUID v7 desde o dia 1** |

Não vale "manter v4 e migrar depois" — migrar PK com FKs apontando é trabalho real.

---

## 3. Stress tests mapeados

| #   | Cenário                                              | Risco                                               | Validação           |
| --- | ---------------------------------------------------- | --------------------------------------------------- | ------------------- |
| S1  | Cadastro em massa de 200 apartamentos (~1000 ops/tx) | Transação longa segura conexão                      | Teste de integração |
| S2  | 100 votantes em 5s no mesmo poll                     | UNIQUE (poll_id, apt_id) é único ponto de contenção | EXPLAIN do INSERT   |
| S3  | 5 polls fechando simultâneos                         | FOR UPDATE serializa — aceitável                    | Validar latência    |
| S4  | 5 condos × 100 votos paralelos                       | Limitado pelo pool, não pelo banco                  | Métricas HikariCP   |
| S5  | Auditoria histórica (50 últimos eventos)             | OK com índice atual                                 | EXPLAIN             |
| S6  | Dashboard síndico (5 queries)                        | Cada <5ms se índices certos                         | Smoke test          |
| S7  | Reminder Job — `NOT EXISTS` em snapshot              | OK com UNIQUE existente                             | EXPLAIN             |
| S8  | EmailSenderJob drenando outbox                       | **Falta índice FIFO** (ver #3 abaixo)               | Issue confirmado    |

---

## 4. Issues priorizadas

### 🔴 ALTO — resolver antes de fechar Fase 2

#### Issue #1 — Índices parciais para jobs cross-tenant

**Problema:** PollOpenerJob/PollCloserJob fazem seq scan em `poll`.

**Solução:** adicionar em V7 (poll domain):

```sql
CREATE INDEX idx_poll_due_to_open ON poll (scheduled_start)
    WHERE status = 'SCHEDULED';

CREATE INDEX idx_poll_due_to_close ON poll (scheduled_end)
    WHERE status = 'OPEN';
```

**Trade-off:** custo zero (índices parciais minúsculos — polls passam ~99% da vida fora desses estados).

---

#### Issue #2 — `AllVotedCheckerJob` N+1

**Problema:** 51 queries/min com 25 polls abertos.

**Solução:** denormalizar `eligible_count` em `poll`, setado na transição SCHEDULED→OPEN. Adicionar coluna em V7:

```sql
ALTER TABLE poll ADD COLUMN eligible_count INT NULL;
-- preenchido pelo PollOpenerJob junto com opened_at
```

Query do AllVotedCheckerJob vira 1 query agregada:

```sql
SELECT p.id
FROM poll p
JOIN vote v ON v.poll_id = p.id
WHERE p.status = 'OPEN'
GROUP BY p.id, p.eligible_count
HAVING COUNT(v.id) = p.eligible_count;
```

**Trade-off:** redundância controlada (snapshot continua write-once; `eligible_count` é derivado dele e setado uma vez).

---

#### Issue #3 — Índice FIFO em `email_notification`

**Problema:** índice atual `(scheduled_for) WHERE status='PENDING'` não cobre o ORDER BY `created_at` do EmailSenderJob → sort em memória.

**Solução:** trocar em V8:

```sql
CREATE INDEX idx_email_pending_fifo
    ON email_notification (scheduled_for, created_at)
    WHERE status = 'PENDING';
```

**Trade-off:** nenhum (substitui o existente).

---

### 🟡 MÉDIO — bom resolver na Fase 2

#### Issue #4 — UUID v7 em tabelas hot

**Problema:** UUID v4 fragmenta índices em `vote`, `audit_event`, `email_notification` ao longo do tempo.

**Solução:**

- Schema (V7, V8): manter `UUID DEFAULT gen_random_uuid()` por compatibilidade
- Aplicação (Fase 3): nas entities Hibernate dessas 3 tabelas, usar `@UuidGenerator(style = TIME)` para que o **app** gere UUID v7 antes do INSERT

```java
@Id
@UuidGenerator(style = UuidGenerator.Style.TIME)
private UUID id;
```

**Trade-off:** vaza timestamp no ID (irrelevante — domínio já tem `voted_at`/`occurred_at` públicos).

---

#### Issue #5 — Partial index para residents ativos

**Problema:** query "moradores ativos do apt X" varre histórico encerrado.

**Solução:** adicionar em V4:

```sql
CREATE INDEX idx_apartment_resident_active
    ON apartment_resident (apartment_id)
    WHERE ended_at IS NULL;
```

**Trade-off:** nenhum — índice parcial pequeno, hot path comum.

---

### 🟢 BAIXO — roadmap v2

| #   | Problema                                  | Solução                                                |
| --- | ----------------------------------------- | ------------------------------------------------------ |
| 6   | `audit_event` cresce indefinidamente      | Particionar por `occurred_at` quando passar de 1M rows |
| 7   | `email_notification` sem `condominium_id` | Adicionar coluna NULLABLE para reports por condo       |
| 8   | `vote` sem índice em `voted_at`           | Adicionar se virar uso real                            |

---

## 5. Plano de aplicação

### Onde cada mudança entra

| Mudança                          | Migration         | Arquivo                                   |
| -------------------------------- | ----------------- | ----------------------------------------- |
| Issue #1 (índices parciais poll) | V7                | `V7__poll_domain.sql`                     |
| Issue #2 (`eligible_count`)      | V7                | `V7__poll_domain.sql`                     |
| Issue #3 (índice FIFO email)     | V8                | `V8__audit_and_notifications.sql`         |
| Issue #4 (UUID v7)               | Fase 3 (entities) | nenhuma migration — só anotação Hibernate |
| Issue #5 (residents ativos)      | V4                | `V4__apartment_and_residents.sql`         |

### O que **não** muda

- Estrutura de RLS, composite FKs, snapshot write-once, transactional outbox
- Particionamento de `audit_event` (espera massa crítica)
- `condominium_id` em `email_notification` (só se virar requisito)

### Próximo passo concreto

1. Atualizar `docs/data-model.md` adicionando seção "Otimizações de Índice" + nota sobre UUID v7
2. Aplicar issues #1, #2, #3, #5 nas migrations correspondentes ao escrevê-las
3. Aplicar issue #4 nas entities Hibernate na Fase 3

---

## Como retomar essa análise

Em uma próxima sessão, basta abrir este arquivo. Ele contém:

- O contexto completo da análise
- Os 5 issues priorizados com solução pronta
- O mapeamento de onde cada um entra nas migrations da Fase 2

Memória do projeto aponta para este arquivo (entrada `project_data_model_review_pending.md`).

---

### Prompt para seguir com a task

> Estamos na Fase 2 (Schema e Migrations). Ontem terminamos V1\_\_enums.sql
> e fiz uma análise de escala do data model que ficou em
> docs/analysis/2026-04-25-data-model-scale-review.md com 5 otimizações
> aprovadas pendentes de aplicar.
> Releia o doc de análise + docs/implementation/tasks/phase-2-schema-migrations.md
> e me diga o próximo passo concreto.
