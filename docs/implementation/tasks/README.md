# Tasks — Condo Vote v1

Roadmap executável derivado de [`../plan.md`](../plan.md). Cada arquivo abaixo corresponde a uma fase do plano e lista tasks acionáveis, na ordem de execução, com critério de aceite por task.

> **Metodologia:** SDD — esta é a fase **Tasks** (Specify → Plan → **Tasks** → Implement). Nenhuma task aqui adiciona decisão nova; todas apenas executam o que já foi decidido em `docs/architecture.md`, `docs/data-model.md` e `docs/condo-vote-principles.md`.

## Como usar
- Execute fases em ordem (0 → 6). Dentro de cada fase, siga a ordem das tasks — há dependências implícitas.
- Cada task tem um ID (`T<fase>.<n>`), entregável claro e critério de aceite. Marque `[x]` quando concluída.
- Quando uma task virar PR, referenciar o ID no título (ex: `T2.5 — Migration V4: apartment + residents`).
- Se uma task descobrir inconsistência com a spec, **parar e atualizar a spec antes** (regra do `CLAUDE.md`).

## Índice

| Fase | Arquivo | Tasks | Duração estimada | Status |
|------|---------|-------|------------------|--------|
| 0 | [phase-0-repo-bootstrap.md](phase-0-repo-bootstrap.md) | 3 | 0,5 dia | ✅ Concluída |
| 1 | [phase-1-infrastructure.md](phase-1-infrastructure.md) | 6 | 1–2 dias | ✅ Concluída |
| 2 | [phase-2-schema-migrations.md](phase-2-schema-migrations.md) | 13 | 2–3 dias | ⏳ Próxima (aguarda T3.1a) |
| 3 | [phase-3-backend-skeleton.md](phase-3-backend-skeleton.md) | 10 | 2–3 dias | ⏳ T3.1a é pré-req da Fase 2 |
| 4 | [phase-4-frontend-skeleton.md](phase-4-frontend-skeleton.md) | 5 | 2 dias | ⏳ |
| 5 | [phase-5-cicd.md](phase-5-cicd.md) | 3 | 0,5–1 dia | ⏳ |
| 6 | [phase-6-observability.md](phase-6-observability.md) | 4 | 0,5 dia | ⏳ |
| 7 | [phase-7-domain-index.md](phase-7-domain-index.md) | 8 features (índice) | ~3–4 semanas | 📋 Planejada |

**Total:** 44 tasks de fundação (Fases 0–6) + 8 features de domínio indexadas (Fase 7), ~10–14 dias úteis de trabalho focado para fundação.

## Convenções

- **Branch por task ou grupo coeso:** `feature/t2.5-apartment-residents-migration`
- **Commits em português**, imperativo curto: "cria migration V4 para apartment e residents"
- **PR alvo:** `develop` (CI verde → merge). Promoção para `main` só com agrupamento demonstrável (ex: fase completa)
- **Nenhuma migration ad-hoc:** sempre via Flyway. Schema manual no Supabase Studio é proibido em ambientes compartilhados
