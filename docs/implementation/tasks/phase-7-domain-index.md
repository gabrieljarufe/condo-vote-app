# Fase 7 — Features de Domínio (índice)

> **Status:** Planejada, não iniciada. Cada feature será detalhada em arquivo próprio de tasks quando chegar sua vez.

**Pré-requisitos:** Fases 0–6 completas (walking skeleton verde ponta-a-ponta: backend deployado, migrations aplicadas, auth ligada, CI/CD verde, observabilidade ativa).

> Antes de iniciar qualquer feature, consulte **[`docs/coding-patterns.md`](../../coding-patterns.md)**. Cada feature segue o padrão Controller → Service → Repository (Spring Data JDBC). SQL nunca sai da camada Repository; aggregates têm métodos de negócio; Services orquestram. Padrões de testes, naming e multi-tenant estão documentados lá.

---

## Features (ordem sugerida de implementação)

| # | Feature | Arquivo de tasks | Depende de |
|---|---------|------------------|------------|
| F1 | CpfEncryptor (AES-256-SIV) + chave + CLI | phase-7-f1-cpf-encryption.md | Fase 3 |
| F2 | Invitations + Redis token + /register/complete | phase-7-f2-onboarding.md | F1 + Fase 2 |
| F3 | Email outbox + EmailSender + 7 templates Thymeleaf | phase-7-f3-email-outbox.md | F2 |
| F4 | Jobs @Scheduled (6 jobs + RetentionPrunerJob placeholder) | phase-7-f4-jobs.md | F3 |
| F5 | Apartment + Resident CRUD + Delegação + Promoção | phase-7-f5-apartment.md | F2 |
| F6 | Poll CRUD + snapshot + vote + result | phase-7-f6-poll.md | F5, F4 |
| F7 | Audit timeline (queries read-only) | phase-7-f7-audit.md | F6 |
| F8 | Rate limiting Bucket4j (/invitations/validate, /register/complete) | phase-7-f8-rate-limit.md | F2 |

---

## Notas de escopo

- Todas as features devem incluir teste de integração com Testcontainers + RLS isolada.
- `RetentionPrunerJob` entra como placeholder no-op em v1 (volume negligenciável com 1-5 condos em piloto). Ativar em v2.
- Fluxo formal de transferência de titularidade fica para v2 (ver `condo-vote-principles.md` "Pontos em Aberto" #4).
- `scripts/encrypt-cpf.sh` é criado em T6.3a (Fase 6) — depende de F1 estar buildável.
- Bucket4j (F8) pode ser implementado junto com F2 (os endpoints que protege existem em F2).
