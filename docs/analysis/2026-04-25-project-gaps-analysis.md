# Gap Analysis do Projeto — 2026-04-25 (noite)

> **Status:** levantamento de inconsistências e pendências encontradas após Fase 2 começar (V1 migration concluída).
> **Contexto:** análise complementar à `2026-04-25-data-model-scale-review.md`. Foco em desalinhamentos entre **plan/docs** e o **estado real do repo**.

---

## Sumário

7 gaps encontrados. 4 são correções triviais e seguras. 1 é segurança (verificar gitignore). 1 demanda decisão consciente. 1 pode ficar para a Fase 3.

---

## Gap #1 — Inconsistência `APP_PORT` vs `SERVER_PORT` 🔴

**Arquivos:** `.env.example`, `backend/src/main/resources/application.yaml`

**Problema:**
- `.env.example` define `APP_PORT=8080`
- `application.yaml` lê `${SERVER_PORT:8080}`
- A variável do `.env` **nunca chega no Spring** — qualquer mudança de porta no `.env` é silenciosamente ignorada

**Impacto:** debug noise no futuro (alguém vai mudar `APP_PORT` e ficar perdido por horas).

**Correção:** trocar `APP_PORT` → `SERVER_PORT` no `.env.example`.

**Trade-off:** nenhum.

---

## Gap #2 — `data-model.md` desatualizado vs análise de escala 🔴

**Arquivo:** `docs/data-model.md`

**Problema:** a análise de hoje (`2026-04-25-data-model-scale-review.md`) aprovou 5 otimizações, mas o `data-model.md` ainda mostra o schema antigo, sem:

- Coluna `poll.eligible_count INT NULL` (denormalização — Issue #2)
- Índices parciais `idx_poll_due_to_open` e `idx_poll_due_to_close` (Issue #1)
- Índice FIFO `idx_email_pending_fifo` (Issue #3)
- Nota sobre UUID v7 em tabelas hot (Issue #4)
- Índice parcial `idx_apartment_resident_active` (Issue #5)

**Impacto:** ao escrever V4/V7/V8 amanhã, terei dois docs divergentes para reconciliar. `data-model.md` é a fonte da verdade — se ela estiver desatualizada, o risco é a migration ser escrita conforme o doc errado.

**Correção:** atualizar `data-model.md` adicionando as 5 mudanças nos lugares certos. Cada mudança fica inline na tabela afetada + nota referenciando a análise.

**Trade-off:** nenhum (alinha doc com decisão).

---

## Gap #3 — `phase-2-schema-migrations.md` sem checkboxes para os 5 ajustes 🔴

**Arquivo:** `docs/implementation/tasks/phase-2-schema-migrations.md`

**Problema:** as tasks T2.5 (V4), T2.8 (V7), T2.9 (V8) não mencionam os índices/colunas novos da análise. Risco operacional: ao escrever cada migration amanhã, esquecer de aplicar a otimização.

**Impacto:** retrabalho — descobrir tarde que faltou índice → criar migration compensatória V9xxx.

**Correção:** adicionar checkboxes nas tasks afetadas:

- T2.5 (V4): `[ ] idx_apartment_resident_active ON (apartment_id) WHERE ended_at IS NULL` (Issue #5)
- T2.8 (V7): `[ ] coluna poll.eligible_count INT NULL` (Issue #2) + `[ ] idx_poll_due_to_open` + `[ ] idx_poll_due_to_close` (Issue #1)
- T2.9 (V8): `[ ] idx_email_pending_fifo (scheduled_for, created_at) WHERE PENDING` (Issue #3)

Cada checkbox cita o doc da análise como referência.

**Trade-off:** nenhum.

---

## Gap #4 — `CLAUDE.md` "Estado atual" desatualizado 🟡

**Arquivo:** `CLAUDE.md` (seção "Estado atual do projeto")

**Problema:** diz literalmente:

> *"Fase 0 (repo bootstrap) e Fase 1 (infraestrutura + landing estática) concluídas. Backend ainda não iniciado. Próximo passo: Fase 2 (schema + migrations) — mas T3.1 (Spring Initializr) é pré-requisito bloqueante."*

Mas:
- Backend já tem scaffold (`pom.xml`, `CondoVoteApplication.java`, `application.yaml`)
- T3.1a (Spring Initializr) já foi executado e commitado
- T2.1 (Setup Flyway) e T2.2 (V1__enums.sql) já estão concluídos

**Impacto:** ao reabrir a sessão amanhã, o `CLAUDE.md` é carregado automaticamente como contexto inicial. Informação errada → orientação errada.

**Correção:** atualizar para refletir estado real:

```
Fase 2 (Schema e Migrations) em andamento. Scaffold Spring Boot + V1__enums.sql
concluídos. Análise de escala do data model identificou 5 otimizações pendentes
(ver docs/analysis/2026-04-25-data-model-scale-review.md). Próximo passo:
aplicar as otimizações no data-model.md e seguir para V2 (condominium).
```

**Trade-off:** nenhum.

---

## Gap #5 — T3.1b lista dependências ausentes do `pom.xml` 🟡

**Arquivos:** `docs/implementation/tasks/phase-3-backend-skeleton.md`, `backend/pom.xml`

**Problema:** T3.1b lista como pendentes:
- `lettuce-core` (Redis client)
- `springdoc-openapi-starter-webmvc-ui` (Swagger)

Mas o pom.xml já tem várias dependências (Spring Web, Security, OAuth2, JPA, Flyway, Postgres, Validation, Thymeleaf, Actuator). As duas faltantes acima são reais.

**Impacto:** zero hoje (Fase 2 é só SQL — não usa Redis nem Swagger). Vai virar tarefa concreta na Fase 3.

**Correção:** **adiar para a Fase 3**. Sinalizado aqui para não se perder.

**Trade-off:** nenhum.

---

## Gap #6 — `application-prod.yml` mencionado mas não existe ✅ resolvido (2026-04-25)

**Decisão:** **aceitar a ausência**. `application.yaml` base é o "perfil produção" implícito — todas as configs sensíveis vêm de env vars do Coolify. `application-local.yaml` sobrescreve apenas o que difere em dev. Criar arquivo prod vazio seria poluição.

**Aplicado:** menções a `application-prod.yml` removidas de T3.1a/T3.1b. Decisão documentada como nota explícita no header de T3.1a.

---

## Gap #7 — `.env` no disco — verificar gitignore 🔴 (segurança)

**Arquivos:** raiz do repo

**Problema:** `ls` revelou `.env` e `.env.local` no diretório do projeto. Se não estiverem no `.gitignore`, **podem estar commitados no histórico** com secrets reais (Supabase keys, CPF encryption key, Resend API key, etc.).

**Impacto:** vazamento crítico se commitado. Mesmo que removido depois, fica no histórico do git para sempre.

**Correção:**
1. Conferir `.gitignore` na raiz e garantir entradas `.env`, `.env.local`, `.env.*` (exceto `.env.example`)
2. Rodar `git log --all --full-history -- .env .env.local` para confirmar que nunca foram commitados
3. Se foram: rotacionar TODOS os secrets afetados imediatamente

**Trade-off:** nenhum.

---

## Plano de ação para amanhã

### Trivial (executar sem discussão)

- [ ] Gap #1 — alinhar `SERVER_PORT` no `.env.example`
- [ ] Gap #4 — atualizar "Estado atual" no `CLAUDE.md`
- [ ] Gap #3 — adicionar checkboxes em `phase-2-schema-migrations.md` para os 5 ajustes
- [ ] Gap #7 — verificar `.env*` no `.gitignore` + git log

### Aprovação curta

- [ ] Gap #2 — atualizar `data-model.md` com os 5 ajustes da análise (recomendação: fazer agora, é fonte da verdade)

### Roadmap (não bloqueador)

- 📌 Gap #5 — adicionar Redis + Swagger ao `pom.xml` (Fase 3, T3.1b)
- ✅ Gap #6 — resolvido: aceitar ausência de `application-prod.yml` (Spring Boot funciona com default + env vars)

---

## Como retomar

Em sessão futura:

```
Aplicar gaps do doc 2026-04-25-project-gaps-analysis.md
```

A memória vai me direcionar para os 2 docs de análise (escala + gaps). Se quiser ir direto ao trabalho, mencionar o número do gap ("aplica gap #1 e #3").
