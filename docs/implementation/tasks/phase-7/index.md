# Fase 7 — Histórias de Domínio (índice)

> **Status:** Em execução. Cada história é fatiada **verticalmente** (migration + repository + service + controller + tela + testes) e vira um PR demonstrável.

> 📖 **Antes de iniciar qualquer história, leia [`workflow.md`](workflow.md)** — guia canônico das 6 fases de desenvolvimento (escrever história → audit de coerência → tasks → plano → implementar → PR). Destilado da experiência da H0 (PRs #56 + #57).

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

| # | História | Arquivo | Cobertura técnica (antigos F1–F8) | Depende de | Prioridade MVP |
|---|----------|---------|-----------------------------------|------------|----------------|
| H1 | Como síndico bootstrapado, logo no sistema e vejo meus condomínios | [h1-login-home.md](h1-login-home.md) | (validação do walking skeleton) | — | ✅ feito |
| H2 | Como síndico, cadastro um apartamento no meu condomínio | [h2-cadastrar-apartamento.md](h2-cadastrar-apartamento.md) | F5 (parte) ✅ | H1 | ✅ feito |
| H3 | Como síndico, convido um morador para um apartamento (com e-mail) | [h3-convite-morador.md](h3-convite-morador.md) | F2 ✅ + F3 (parte) ✅ + F4 (expiração) ✅ | H2, F1 ✅ | ✅ feito |
| H4 | Como convidado, valido o link e completo cadastro com CPF | [h4-onboarding-magic-link.md](h4-onboarding-magic-link.md) | F2 (resto) ✅ + F1 ✅ + F8 ✅ | H3 | ✅ feito |
| H5 | Como morador logado, vejo os apartamentos onde sou residente | `h5-resident-view.md` _(a criar)_ — ver [`docs/features/h5-resident-view.md`](../../../features/h5-resident-view.md) | F5 (read) ✅ | H4 | ✅ feito |
| H7 | Como síndico, crio votação com lifecycle completo (DRAFT/SCHEDULED/OPEN/CLOSED/INVALIDATED/CANCELLED) + snapshot ao abrir + jobs de abertura/fechamento | [h7-criar-votacao.md](h7-criar-votacao.md) — ver [`docs/features/h7-criar-votacao.md`](../../../features/h7-criar-votacao.md) | F6 ✅ + F4 (abertura/fechamento) ✅ | H5 | 🔶 em review |
| **H8** | **Como morador, voto numa votação aberta e vejo o resultado** | `h8-poll-vote.md` _(a criar)_ | F6 (resto) + F4 (lembretes) | H7 | 🎯 **MVP** |
| H6 | Como síndico, promovo morador a co-síndico ou delego voto | `h6-promote-delegate.md` _(a criar)_ | F5 (resto) | H5 | 🕒 stretch |
| H9 | Como síndico, vejo a timeline de auditoria do condomínio | `h9-audit-timeline.md` _(a criar)_ | F7 | H8 | 🕒 stretch |
| H10 | Jobs agendados residuais (RetentionPrunerJob placeholder) | `h10-jobs-residual.md` _(a criar)_ | F4 (resto) | H8 | 🕒 stretch |

> **Observações:**
>
> - **🎯 Repriorização MVP (3 dias de prazo):** **H7 e H8 são as únicas histórias obrigatórias restantes** — entregam o caso de uso central de votação digital, sem o qual o produto não existe. **H6 (promoção/delegação), H9 (timeline) e H10 (jobs residuais) viram _stretch_** — só entram se houver folga depois de H7+H8 verdes. A dependência declarada "H7 → H6" é fraca e foi relaxada: H7 pode usar votante default = morador OWNER do apto (sem configuração de delegação); bloqueio de delegação durante poll OPEN vira problema só quando H6 entrar.
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
| F2 | Invitations + Redis token + `/register/complete` | ✅ H3 (criar/listar/expirar/revoke/resend/fix-email + token Redis 24h) + H4 (validar/completar) |
| F3 | Email outbox + EmailSender + 7 templates Thymeleaf | ✅ H3 (transactional outbox + `EmailGateway` SMTP/Resend + `EmailSenderJob` 30s + template `invitation.html`) + templates restantes distribuídos quando o caso de uso aparecer (H7 abrir/encerrar poll, H8 lembrete de votação, etc.) |
| F4 | Jobs `@Scheduled` (6 jobs + RetentionPrunerJob placeholder) | ✅ H3 (`InvitationExpirerJob` 1h + `EmailSenderJob` 30s) + ✅ H7 (`PollOpenerJob` + `PollCloserJob` 5min) + H8 (lembrete pré-fechamento) + H10 (RetentionPruner placeholder + qualquer job residual) |
| F5 | Apartment + Resident CRUD + Delegação + Promoção | H2 (apartment CRUD) + H5 (resident read) + H6 (promoção + delegação) |
| F6 | Poll CRUD + snapshot + vote + result | ✅ H7 (CRUD lifecycle completo + snapshot ao abrir + cálculo de quórum) + H8 (voto) |
| F7 | Audit timeline (queries read-only) | H9 |
| F8 | Rate limiting Bucket4j | ✅ H4 (in-memory, single-instance; endpoints de H3 são autenticados — rate-limit por JWT) |

> Ao concluir cada história, marcar a linha correspondente nesta tabela com ✅ no PR final.
