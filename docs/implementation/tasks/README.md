# Tasks — Condo Vote v1

Roadmap executável derivado de [`../plan.md`](../plan.md). Cada arquivo abaixo corresponde a uma fase do plano e lista tasks acionáveis, na ordem de execução, com critério de aceite por task.

> **Metodologia:** SDD — esta é a fase **Tasks** (Specify → Plan → **Tasks** → Implement). Nenhuma task aqui adiciona decisão nova; todas apenas executam o que já foi decidido em `docs/architecture.md`, `docs/data-model.md` e `docs/condo-vote-principles.md`.

## Como usar
- Execute fases em ordem (0 → 6). Dentro de cada fase, siga a ordem das tasks — há dependências implícitas.
- Cada task tem um ID (`T<fase>.<n>`), entregável claro e critério de aceite. Marque `[x]` quando concluída.
- Quando uma task virar PR, referenciar o ID no título (ex: `T2.5 — Migration V4: apartment + residents`).
- Se uma task descobrir inconsistência com a spec, **parar e atualizar a spec antes** (regra do `CLAUDE.md`).

## Índice

| Fase | Arquivo | Tasks | Duração estimada |
|------|---------|-------|------------------|
| 0 | [phase-0-repo-bootstrap.md](phase-0-repo-bootstrap.md) | 3 | 0,5 dia |
| 1 | [phase-1-infrastructure.md](phase-1-infrastructure.md) | 6 | 1–2 dias |
| 2 | [phase-2-schema-migrations.md](phase-2-schema-migrations.md) | 13 | 2–3 dias |
| 3 | [phase-3-backend-skeleton.md](phase-3-backend-skeleton.md) | 9 | 2–3 dias |
| 4 | [phase-4-frontend-skeleton.md](phase-4-frontend-skeleton.md) | 5 | 2 dias |
| 5 | [phase-5-cicd.md](phase-5-cicd.md) | 3 | 0,5–1 dia |
| 6 | [phase-6-observability.md](phase-6-observability.md) | 3 | 0,5 dia |

**Total:** 42 tasks, ~8–12 dias úteis de trabalho focado.

## Convenções

- **Branch por task ou grupo coeso:** `feature/t2.5-apartment-residents-migration`
- **Commits em português**, imperativo curto: "cria migration V4 para apartment e residents"
- **PR alvo:** `develop` (CI verde → merge). Promoção para `main` só com agrupamento demonstrável (ex: fase completa)
- **Nenhuma migration ad-hoc:** sempre via Flyway. Schema manual no Supabase Studio é proibido em ambientes compartilhados
