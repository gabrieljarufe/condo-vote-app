# Fase 7 — Histórias de Domínio (índice)

> **Status:** Em execução. Cada história é fatiada **verticalmente** (migration + repository + service + controller + tela + testes) e vira um PR demonstrável.

**Pré-requisitos:** Fases 0–6 completas (walking skeleton verde ponta-a-ponta: backend deployado, migrations aplicadas, auth ligada, CI/CD verde, observabilidade ativa, bootstrap formal de condomínio).

---

## Por que histórias e não features técnicas

A versão anterior deste índice (commit anterior, "phase-7-domain-index.md") organizava o trabalho por **agregados/camadas técnicas** (F1 encryption → F2 invitations → F3 email → … → F8 rate-limit). Tecnicamente correto, mas:

- Nada chegava à mão do usuário até F2+F3+F5 fecharem juntos.
- Gaps de UX só apareciam na integração final.
- PRs viravam grandes demais para um ciclo de feedback rápido.

A virada é **fatiar por história de usuário**: cada PR materializa um caminho ponta-a-ponta. Os antigos F1–F8 **não desapareceram** — viraram cobertura técnica que cada história consome. O apêndice no fim deste documento garante que nenhum requisito caiu na transição.

---

## Antes de iniciar uma história

1. **Spec do produto:** consulte [`docs/condo-vote-principles.md`](../../../condo-vote-principles.md) — atores, ciclo de votação, quórum, LGPD.
2. **Padrões de código:** consulte [`docs/coding-patterns.md`](../../../coding-patterns.md) — Controller → Service → Repository, Spring Data JDBC, aggregates, DTOs, testes, naming, multi-tenant.
3. **Template de história:** copie [`template.md`](template.md) ao iniciar uma história nova. Não invente formato.
4. **Invariantes do domínio:** revise a seção "Invariantes do domínio" em `CLAUDE.md` (multi-tenant por RLS, snapshot write-once, voto pertence ao apartamento, voto imutável, delegação bloqueada em poll OPEN, CPF em `app_user`, paridade de síndicos).

---

## Histórias (ordem de implementação)

| # | História | Arquivo | Cobertura técnica (antigos F1–F8) | Depende de |
|---|----------|---------|-----------------------------------|------------|
| H1 | Como síndico bootstrapado, logo no sistema e vejo meus condomínios | [h1-login-home.md](h1-login-home.md) | (validação do walking skeleton) | — |
| H2 | Como síndico, cadastro um apartamento no meu condomínio | `h2-apartment-create.md` _(a criar)_ | F5 (parte) | H1 |
| H3 | Como síndico, convido um morador para um apartamento (com e-mail) | `h3-invite-resident.md` _(a criar)_ | F2 + F3 (parte) + F8 + F4 (expiração) | H2, F1 ✅ |
| H4 | Como convidado, valido o link e completo cadastro com CPF | `h4-onboarding-complete.md` _(a criar)_ | F2 (resto) + F1 ✅ + F8 | H3 |
| H5 | Como morador logado, vejo os apartamentos onde sou residente | `h5-resident-view.md` _(a criar)_ | F5 (read) | H4 |
| H6 | Como síndico, promovo morador a co-síndico ou delego voto | `h6-promote-delegate.md` _(a criar)_ | F5 (resto) | H5 |
| H7 | Como síndico, crio uma votação (CRUD + snapshot ao abrir) | `h7-poll-create.md` _(a criar)_ | F6 (parte) + F4 (fechamento) | H6 |
| H8 | Como morador, voto numa votação aberta e vejo o resultado | `h8-poll-vote.md` _(a criar)_ | F6 (resto) + F4 (lembretes) | H7 |
| H9 | Como síndico, vejo a timeline de auditoria do condomínio | `h9-audit-timeline.md` _(a criar)_ | F7 | H8 |
| H10 | Jobs agendados residuais (RetentionPrunerJob placeholder) | `h10-jobs-residual.md` _(a criar)_ | F4 (resto) | H8 |

> **Observações:**
>
> - **F1 (CpfEncryptor)** já está implementado desde a Fase 6 (T6.3a). H4 apenas o consome.
> - **F4 (jobs)** foi distribuído entre H3 (expiração de convite), H7 (fechamento automático de poll), H8 (lembretes pré-fechamento) e H10 (placeholder de retenção).
> - **F8 (rate-limit Bucket4j)** entra junto de H3/H4 — endpoints públicos (`/invitations/validate`, `/register/complete`) sem rate-limit em prod é risco real, não pode ser deixado pra depois.
> - **`scripts/encrypt-cpf.sh`** já existe desde a Fase 6 (T6.3a).
> - Cada história deve incluir teste de integração com Testcontainers + isolamento RLS.

---

## Notas de escopo

- **`RetentionPrunerJob`** entra como placeholder no-op em v1 (volume negligenciável com 1–5 condos em piloto). Ativar em v2.
- **Fluxo formal de transferência de titularidade** fica para v2 (ver [`condo-vote-principles.md`](../../../condo-vote-principles.md) "Pontos em Aberto" #4). Em v1, transferência se resolve via remoção + convite/promoção pelo síndico.
- **Cobertura mínima:** 70% nos arquivos alterados (CI bloqueia). UT + IT obrigatórios em toda classe com lógica.

---

## Apêndice — Cobertura técnica vs histórias (auditoria F1–F8)

Tabela inversa para confirmar que nenhum requisito técnico caiu na transição de fatias para histórias.

| Antigo F | Descrição | Histórias que cobrem |
|----------|-----------|----------------------|
| F1 | CpfEncryptor (AES-256-SIV) + chave + CLI | ✅ Concluído na Fase 6 (T6.3a). Consumido em H4. |
| F2 | Invitations + Redis token + `/register/complete` | H3 (criar/listar/expirar) + H4 (validar/completar) |
| F3 | Email outbox + EmailSender + 7 templates Thymeleaf | H3 (template de convite + outbox) + templates restantes distribuídos quando o caso de uso aparecer (H7 abrir/encerrar poll, H8 lembrete de votação, etc.) |
| F4 | Jobs `@Scheduled` (6 jobs + RetentionPrunerJob placeholder) | H3 (expirar convite) + H7 (fechar poll) + H8 (lembrete pré-fechamento) + H10 (RetentionPruner placeholder + qualquer job residual) |
| F5 | Apartment + Resident CRUD + Delegação + Promoção | H2 (apartment CRUD) + H5 (resident read) + H6 (promoção + delegação) |
| F6 | Poll CRUD + snapshot + vote + result | H7 (CRUD + snapshot ao abrir) + H8 (voto + resultado) |
| F7 | Audit timeline (queries read-only) | H9 |
| F8 | Rate limiting Bucket4j | H3 + H4 (endpoints públicos de convite/register) |

> Ao concluir cada história, marcar a linha correspondente nesta tabela com ✅ no PR final.
