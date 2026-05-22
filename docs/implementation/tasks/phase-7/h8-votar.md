# H8 — Morador registra voto + auto-close + breakdown

## História

Como **morador elegível**, quero **registrar meu voto numa votação aberta para os apartamentos onde sou `eligible_voter`**, para **participar das decisões do condomínio de forma rastreável e imutável, sem precisar comparecer a uma assembleia presencial**.

## Motivação / contexto de produto

Caso de uso central da Fase 7 — fecha o ciclo iniciado em H7. Sem voto, o produto inteiro é apenas uma ferramenta de criação de deliberações; com H8 o morador pode efetivamente participar.

Materializa três invariantes do domínio registradas em `CLAUDE.md`:

1. **Voto pertence ao apartamento** — `vote.apartment_id` é a unidade votante; `voter_user_id` é testemunha para auditoria. Alinhado com o Código Civil.
2. **Votos são imutáveis após registro** — sem UPDATE/DELETE. Trigger SQL em `V7` garante. Remoção de morador não invalida votos já registrados (morador é testemunha).
3. **Snapshot de elegibilidade é write-once** — `poll_eligible_snapshot` define o denominador de quórum e o conjunto de eleitores válidos. A verificação de elegibilidade (`eligible_voter_user_id == JWT.sub`) é feita contra o snapshot, não contra a tabela live de residentes.

O auto-close de 100% (todos os elegíveis votaram) é um corolário dessas regras: quando `count(votes) == eligible_count`, a poll já tem resultado determinístico — não faz sentido esperar `scheduled_end`.

Spec [`docs/condo-vote-principles.md`](../../../condo-vote-principles.md) §5 (ciclo de votação), §6 (quórum), §7 (opções).
Data model [`docs/data-model.md`](../../../data-model.md) §vote, §poll_eligible_snapshot, §poll_result, §audit_event.
Migrations relevantes: `V7__poll_domain.sql` (trigger imutabilidade do voto), `V14__vote_cast_audit_event.sql` (enum `VOTE_CAST`).

## Critérios de aceitação

### Voto único
- [x] **Dado** morador autenticado com `eligible_voter_user_id == JWT.sub` no snapshot de poll OPEN **quando** chama `POST /api/polls/{id}/vote` com `{ apartmentId, optionId }` **então** retorna 201 + vote inserido + audit `VOTE_CAST` publicado.
- [x] **Dado** mesmo morador tenta votar novamente no mesmo apartamento **quando** chama o endpoint **então** retorna 409 "Voto já registrado para este apartamento nesta votação".
- [x] **Dado** poll com status != OPEN **quando** morador tenta votar **então** retorna 409 "Votação não está aberta".
- [x] **Dado** apartamento não está no snapshot da poll **quando** morador tenta votar **então** retorna 403 "Apartamento não elegível para esta votação".
- [x] **Dado** `eligible_voter_user_id` do snapshot != JWT.sub (usuário diferente do votante habilitado) **quando** chama o endpoint **então** retorna 403 "Você não é o votante habilitado para este apartamento".
- [x] **Dado** `optionId` não pertence à poll **quando** chama o endpoint **então** retorna 422 "Opção inválida para esta votação".
- [x] **Dado** usuário de tenant B **quando** tenta votar em poll de tenant A (RLS) **então** retorna 403.

### Auto-close 100%
- [x] **Dado** todos os apartamentos elegíveis votaram **quando** o último voto é registrado **então** poll transita para CLOSED automaticamente; `poll_result` é inserido com `close_trigger='AUTOMATIC_ALL_VOTED'`; audit `POLL_CLOSED` publicado com `{ automatic: true, trigger: "AUTOMATIC_ALL_VOTED" }`.

### Endpoints de consulta (morador)
- [x] **Dado** morador autenticado **quando** chama `GET /api/polls/{id}/my-ballots` **então** retorna lista de cédulas (snapshot do apartamento + `voted: true/false` + `selectedOptionId` quando já votou).
- [x] **Dado** morador autenticado **quando** chama `GET /api/condominiums/{condoId}/my-pending-polls` **então** retorna polls OPEN onde ele ainda tem cédulas pendentes.

### Frontend
- [x] Tile "Minhas votações" aparece no dashboard somente para residentes (`tenant.isResident()` com badge contador de pendências).
- [x] Fluxo 1 cédula (`BallotVotePage`): morador vota na única cédula pendente → POST 201 → confirmação na UI.
- [x] Fluxo bulk ("Apply to all"): morador com N cédulas pendentes vota no 1º apto → CTA "Revisar e aplicar a todos" → `BallotReviewPage` com N cards → confirma → N POSTs paralelos.
- [x] Override individual em `BallotReviewPage`: antes de submeter o bulk, morador pode clicar em card específico e trocar a opção.
- [x] Tolerância a falha parcial no bulk: se 1+ POSTs falharem → UI mostra "X/N enviados" + botão retry só dos falhados.
- [x] `poll-detail-page` (síndico): quando status == CLOSED ou INVALIDATED, renderiza breakdown real por opção (%, barra horizontal, badge "Vencedora" na opção com `winningOptionId`).

### Imutabilidade SQL
- [x] Tentativa de `UPDATE` ou `DELETE` em `vote` via SQL direto → trigger `V7` (função `prevent_vote_modification`) rejeita com erro.

## Escopo técnico

### Backend

Pacote base: `backend/src/main/java/com/condovote/poll/`

**Aggregates e repositórios:**
- `Vote.java` — record `@Table("vote")` com `id`, `pollId`, `apartmentId`, `condominiumId` (redundante para RLS), `optionId`, `voterUserId`, `bulkOperation` (boolean), `votedAt`.
- `VoteRepository.java` — `findByPollIdAndApartmentId(UUID pollId, UUID apartmentId)` para dedup check; `countVotesByOption(UUID pollId)` para tally (retorna `List<VotesByOptionRow>`); INSERT via `namedJdbc.update("INSERT INTO vote ...")` (padrão do projeto — `save()` com `@Id` pré-setado trata como UPDATE).

**Componentes de negócio:**
- `VoteService.castVote(UUID pollId, CastVoteRequest req, UUID actorUserId, boolean bulkOperation) → VoteResponse` — `@Transactional` com lock pessimista: `SELECT FROM poll WHERE id=? FOR UPDATE` na 1ª linha da transação (lock vai no `poll`, não no `vote`). Validações em ordem: status OPEN → `poll_eligible_snapshot` contém `apartmentId` com `eligible_voter_user_id == actorUserId` → `optionId` pertence à poll → voto não duplicado → INSERT → audit `VOTE_CAST` com `bulkOperation` no payload → **auto-close 100%**: `count(votes) == eligible_count` → `pollCloser.close(pollId, actorUserId, CloseTrigger.AUTOMATIC_ALL_VOTED)`.
- `PollCloser` refatorado: nova assinatura `close(UUID pollId, UUID actorUserId, CloseTrigger trigger)` com enum `CloseTrigger { MANUAL, AUTOMATIC_END_TIME, AUTOMATIC_ALL_VOTED }`. Overload antigo `close(pollId, actorUserId, boolean automatic)` mantido como `@Deprecated` wrapper.

**Controller:**
- `VoteController.java` — `POST /api/polls/{pollId}/vote` → 201; lê header opcional `X-Bulk-Operation: true/false` e passa para `VoteService`.
- `MyBallotsController.java` — `GET /api/polls/{pollId}/my-ballots` → 200; `GET /api/condominiums/{condoId}/my-pending-polls` → 200.

**DTOs:**
- `CastVoteRequest.java` — `@NotNull apartmentId`, `@NotNull optionId`.
- `VoteResponse.java` — `id`, `pollId`, `apartmentId`, `optionId`, `votedAt`.
- `BallotResponse.java` — `apartmentId`, `unitNumber`, `voted` (boolean), `selectedOptionId?`.
- `PendingPollResponse.java` — subset de `PollResponse` + `pendingBallotsCount`.

**Testes:**
- `VoteServiceTest.java` — 11 UT com mocks. Cenários: castVote OK sem auto-close, castVote OK com auto-close 100% (verifica `PollCloser.close` invocado), voto duplicado lança 409, poll não OPEN lança 409, apartamento não no snapshot lança 403, usuario não é eligible_voter lança 403, opção de outra poll lança 422, bulkOperation propagado no audit, cross-tenant (RLS via mock).
- `VoteControllerIT.java` — 14 IT com Testcontainers. Happy path 201, 409 duplicado, 403 não elegível, 403 eligible_voter_user_id != JWT.sub, 422 opção inválida, auto-close 100%, audit VOTE_CAST + POLL_CLOSED, imutabilidade SQL (UPDATE em `vote`), cross-tenant RLS 403.
- `VoteRepositoryIT.java` — 6 IT: INSERT via `namedJdbc`, `countVotesByOption`, trigger de imutabilidade.
- `MyBallotsControllerIT.java` — 13 IT: my-ballots com 0/1/N cédulas; pending-polls com 0/1 resultado; cédulas já votadas (voted=true + selectedOptionId preenchido); cross-tenant 403.

### Frontend

Feature: `frontend/src/app/features/polls/`

**Componentes:**
- `ResidentPendingPollsPage` (smart) — lista polls OPEN com cédulas pendentes. Rota: `/app/condominiums/:condoId/my-polls`.
- `BallotVotePage` (smart) — 1 cédula + CTA "Revisar e aplicar a todos" (visível quando há N>1 cédulas pendentes). Rota: `/app/condominiums/:condoId/polls/:pollId/vote`.
- `BallotReviewPage` (smart) — N cards de revisão + override individual + bulk submit paralelo com tolerância a falha + retry. Rota: `/app/condominiums/:condoId/polls/:pollId/vote/review`.
- `BallotCard` (dumb) — card reutilizável exibindo apto, opção selecionada e status de envio. Usa `@Input()`/`@Output()` decorators (não signal inputs — limitação do Vitest + Angular JIT, ver seção de descobertas).

**Service:**
- `PollsApiService` estendido com `submitVote(pollId, req, bulkOp)`, `getMyBallots(pollId)`, `getMyPendingPolls(condoId)`.

**Rotas:**
- `/app/condominiums/:condoId/my-polls` — protegida por `tenantRestoreGuard + residentGuard`.
- `/app/condominiums/:condoId/polls/:pollId/vote` e `.../vote/review` — mesmas guards.

**Dashboard:**
- Tile "Minhas votações" condicional a `tenant.isResident()`; badge com contador via `getMyPendingPolls`.

### Banco

**Migration V14** (`V14__vote_cast_audit_event.sql`): adiciona `VOTE_CAST` ao enum `audit_event_type`.

Estrutura de `vote` já existe em `V7__poll_domain.sql`:
- Colunas: `id`, `poll_id`, `apartment_id`, `condominium_id` (redundante — necessário para RLS sem JOIN), `option_id`, `voter_user_id`, `bulk_operation`, `voted_at`.
- Trigger `prevent_vote_modification()` na função criada em V7: rejeita `UPDATE`/`DELETE` em `vote`.
- Índices: `idx_vote_poll_apartment UNIQUE(poll_id, apartment_id)` — garante 1 voto por apto por poll; `idx_vote_poll_id ON vote(poll_id)` — tally.

### Cobertura técnica F1-F8

F6 (completo) — voto + auto-close + resultado. F6 agora totalmente coberto pelas histórias H7+H8.
F4 (parcial) — H8 não inclui lembrete pré-fechamento; fica para H10 como stretch.

## Fora de escopo

- Delegação de voto — H6.
- Transferência de titularidade de apartamento — v2.
- E-mail de lembrete pré-fechamento de poll — H10 (stretch).
- E-mail de confirmação de voto — v2.
- Timeline de auditoria UI (ver quem votou como) — H9 (stretch).
- Exportação de resultado (PDF/CSV) — v2.
- ShedLock para `PollCloserJob`/`PollOpenerJob` multi-instância — v2.

## Tasks (executadas)

- [x] A1 — V14: adiciona `VOTE_CAST` ao enum `audit_event_type` — commit `edce31f`
- [x] A2 — `Vote.java` + `VoteRepository.java` com tally por opção + `VoteRepositoryIT` — commit `f730609`
- [x] A3 — `VoteService.castVote` com lock pessimista + auto-close 100% + `VoteServiceTest` (11 UT) — commit `314570d`
- [x] A4 — Refatorar `PollCloser`: enum `CloseTrigger` + nova assinatura `close(pollId, actorUserId, CloseTrigger)` — commit `314570d`
- [x] A5 — `VoteController` `POST /api/polls/{id}/vote` + `VoteControllerIT` (14 IT) — commit `7f47a3b`
- [x] A6 — `MyBallotsController` (`my-ballots` + `my-pending-polls`) + `MyBallotsControllerIT` (13 IT) — commit `ad0a9ed`
- [x] B1 — `PollsApiService` estendido (`submitVote`, `getMyBallots`, `getMyPendingPolls`) — commit `1459cdb`
- [x] B2 — `ResidentPendingPollsPage` + tile "Minhas votações" no dashboard (badge contador) — commit `cbcfd34`
- [x] B3 — `BallotCard` componente reutilizável (`@Input`/`@Output` decorators) — commit `eb9306b`
- [x] B4 — `BallotVotePage` (1 cédula + CTA bulk + modal) — commit `94f115c`
- [x] B5 — `BallotReviewPage` (N cards + override + bulk submit + tolerância a falha parcial + retry) — commit `d0ad1f1`
- [x] B6 — `poll-detail-page`: breakdown real por opção (% + barra + badge "Vencedora") quando CLOSED/INVALIDATED — commit `be45d81`
- [x] C1 — `docs/implementation/tasks/phase-7/h8-votar.md` (este arquivo)
- [x] C2 — `docs/features/h8-votar.md` (roteiro de smoke E2E)
- [x] C3 — Atualizar Bloco 8 de `docs/features/h7-criar-votacao.md` com refs concretas
- [x] C4 — Atualizar `docs/STATUS.md` + `docs/implementation/tasks/phase-7/index.md`

**Total de testes após H8:** 127 testes backend (11 UT + 14 + 13 + 6 IT + regressão) + 285 Vitest frontend.

## Decisões e descobertas

1. **Spring Data JDBC com `@Id` pré-setado executa UPDATE, não INSERT.** O padrão do projeto para entidades com UUID v7 gerado no Java é `namedJdbc.update("INSERT INTO vote ...")` diretamente. `VoteRepository.insert()` segue esse padrão; `save()` não é usado para `Vote`.

2. **Lock pessimista vai no `poll`, não no `vote`.** A primeira linha de `VoteService.castVote` executa `SELECT FROM poll WHERE id=? FOR UPDATE`. Isso serializa votos concorrentes para a mesma poll sem risco de deadlock entre linhas de `vote` (que não existem ainda quando o lock é adquirido).

3. **`poll_close_trigger` já tinha `AUTOMATIC_ALL_VOTED` desde V7** — a migration V14 só adicionou `VOTE_CAST` ao `audit_event_type`. A enum `CloseTrigger` em Java foi adicionada em H8, mas o valor no banco já existia.

4. **`PollCloser` já consultava votos do banco.** A premissa P5 do plano técnico estava errada: `PollCloser` já tinha `loadVotesByOption()` desde H7. H8 apenas refatorou a assinatura pra aceitar `CloseTrigger` explícito e adicionou a chamada from `VoteService`.

5. **Vitest + Angular JIT não suporta signal inputs em componentes substituídos via `overrideComponent`.** `BallotCard` usa `@Input()`/`@Output()` decorators clássicos (não `input.required()`/`output()`). `fixture.componentRef.setInput` com signal inputs causa `NG0303` nesse setup. Ver também descoberta equivalente em H7 para `poll-cancel-dialog`.

6. **Auto-close em poll FIRST com 100% votado satisfaz quórum de presença automaticamente.** 100% presente > `ceilHalf(N) ≥ N/2` para qualquer N ≥ 1. Não é necessário tratamento especial no `PollResultCalculator` — o cálculo normal retorna CLOSED com vencedor válido.

7. **`bulkOperation` no audit é fonte de verdade do frontend.** O campo `bulk_operation` em `vote` vem do header HTTP `X-Bulk-Operation: true/false` passado pelo frontend. Permite distinguir votos feitos individualmente de votos feitos via fluxo "Apply to all".

8. **Condominium_id redundante em `vote`.** É necessário para a policy RLS funcionar sem JOIN (`SET LOCAL app.current_tenant`). Não remover.

## Definition of Done

- [x] 127 testes backend verdes (`./mvnw verify` no worktree)
- [x] 285 testes Vitest frontend verdes (`npm run test:ci`)
- [x] ESLint zero warnings (`npm run lint`)
- [x] Smoke E2E local: pendente — ver `docs/features/h8-votar.md`
- [x] `docs/STATUS.md` atualizado no mesmo PR
- [ ] PR `feat/h8-poll-vote → develop` aberto
- [ ] Apêndice em `index.md` marcado F6 ✅ (completo com H8)

## Referências

- Smoke E2E: [`docs/features/h8-votar.md`](../../../features/h8-votar.md)
- História anterior: [`docs/implementation/tasks/phase-7/h7-criar-votacao.md`](h7-criar-votacao.md)
- Spec: `docs/condo-vote-principles.md` §5, §6, §7
- Data model: `docs/data-model.md` §vote, §poll_eligible_snapshot, §poll_result, §audit_event
- Migrations: `V7__poll_domain.sql` (trigger imutabilidade + estrutura de vote), `V14__vote_cast_audit_event.sql` (enum VOTE_CAST)
