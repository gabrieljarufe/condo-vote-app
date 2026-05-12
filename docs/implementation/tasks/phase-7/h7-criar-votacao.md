# H7 — Síndico cria votação com snapshot de elegibilidade

## História

Como **síndico**, quero **criar uma votação no condomínio com título, opções e snapshot de quem pode votar fixado no momento da abertura** para **garantir que mudanças posteriores (delegação, inadimplência) não afetem o universo eleitoral daquela votação**.

## Motivação / contexto de produto

Coração do produto. Materializa duas invariantes do domínio:
1. **Snapshot write-once** ([`CLAUDE.md`](../../../../CLAUDE.md) §Invariantes): `poll_eligible_snapshot` é gerado na transição que abre a votação e nunca alterado. Trigger SQL da V7 (Pré-Wave 1) garante via banco.
2. **Voto pertence ao apartamento, não ao usuário** (refletido pelo snapshot mapeando `apartment_id`).

Spec [`docs/condo-vote-principles.md`](../../../condo-vote-principles.md) §Ciclo de votação §Quórum. Data model [`docs/data-model.md`](../../../data-model.md) §poll §poll_option §poll_eligible_snapshot.

V1: poll nasce direto em `OPEN` (sem agendamento). Síndico fecha manualmente via endpoint dedicado. Quórum apenas modo `SIMPLE` (maioria simples — service implementa, outros modos só visíveis enum/disabled no frontend).

## Critérios de aceitação

- [ ] **Dado** síndico autenticado com tenant ativo e `≥1 apartamento elegível` (não inadimplente, com `eligible_voter_user_id` setado) **quando** chama `POST /api/condominiums/{id}/polls` com `{ title, description?, options: ["Sim","Não"] }` **então** retorna 201 + body com `id`, `status="OPEN"`, `eligibleCount > 0`, `options[]` com display_order.
- [ ] **Dado** poll criada **então** `poll_eligible_snapshot` recebe 1 linha por apartamento elegível, com `condominium_id` consistente.
- [ ] **Dado** síndico tenta abrir poll sem nenhum apartamento elegível **então** retorna 422 com mensagem "Nenhum apartamento elegível para votação".
- [ ] **Dado** poll OPEN **quando** chama `POST /api/polls/{id}/close` **então** retorna 200 + `status="CLOSED"`, `closedAt` setado.
- [ ] **Dado** poll já CLOSED **quando** chama `close` de novo **então** 409 "Votação já encerrada".
- [ ] **Dado** síndico **quando** chama `GET /api/condominiums/{id}/polls` **então** retorna 200 com lista ordenada `created_at DESC`.
- [ ] **Dado** alguém tenta `UPDATE/DELETE` em `poll_eligible_snapshot` via SQL **então** trigger V7 rejeita com "write-once".
- [ ] **Dado** poll criada **então** `audit_event` recebe `POLL_CREATED` com payload `{ title, optionsCount, eligibleCount }`.
- [ ] **Dado** poll fechada **então** `audit_event` recebe `POLL_CLOSED` com payload `{ totalVotes }`.

## Escopo técnico

### Backend

Arquivos a criar (espelhar padrão `com.condovote.condominium`):

- `backend/src/main/java/com/condovote/poll/Poll.java` — record `@Table("poll")` com campos correspondentes à V7 (id, condominium_id, title, description, convocation, quorum_mode, status, scheduled_start, scheduled_end, opened_at, opened_by_user_id, eligible_count, closed_at, created_by_user_id, created_at, updated_at). Constants enum-like para `convocation_type=GENERAL`, `quorum_mode=SIMPLE`.
- `backend/src/main/java/com/condovote/poll/PollOption.java` — record `@Table("poll_option")`.
- `backend/src/main/java/com/condovote/poll/PollEligibleSnapshot.java` — record `@Table("poll_eligible_snapshot")`.
- `backend/src/main/java/com/condovote/poll/PollRepository.java` — query `findByCondominiumId` ordenado.
- `backend/src/main/java/com/condovote/poll/PollOptionRepository.java`.
- `backend/src/main/java/com/condovote/poll/PollEligibleSnapshotRepository.java`.
- `backend/src/main/java/com/condovote/poll/PollService.java`:
  - `createPoll(condoId, title, description, optionLabels[]) → PollResponse`: dentro de `@Transactional`:
    1. Valida role MANAGER (como em H2)
    2. `INSERT poll` com status=OPEN, scheduled_start/end=now() (CHECK exige NOT NULL após DRAFT), opened_at=now(), opened_by=current user
    3. `INSERT poll_option` para cada label (display_order 0..N-1)
    4. `INSERT poll_eligible_snapshot ... SELECT` apartamentos elegíveis. Conta linhas afetadas → `UPDATE poll SET eligible_count=?`
    5. Se eligible_count=0: throw `UnprocessableEntityException` (rollback)
    6. `AuditEventPublisher.publish("POLL_CREATED", "poll", pollId, ...)`
  - `closePoll(pollId) → PollResponse`: valida role, valida status=OPEN, `UPDATE poll SET status='CLOSED', closed_at=now()`. Audit. Cálculo de `poll_result` fica para H8 (PR de votação encerra ciclo com resultado real); aqui só muda status.
  - `listByCondominium(condoId) → List<PollResponse>`.
- `backend/src/main/java/com/condovote/poll/PollController.java` — endpoints conforme critérios.
- DTOs: `CreatePollRequest` (com `@NotBlank title`, `@Size(min=2) options`), `PollResponse`, `PollOptionResponse`.

Testes:
- `backend/src/test/java/com/condovote/poll/PollServiceTest.java` — mocks repos e publisher. Cobre create OK, create sem elegíveis lança 422, close OK, close em CLOSED lança 409, role check.
- `backend/src/test/java/com/condovote/poll/PollControllerIT.java` — extends `AbstractIntegrationTest`. Cenários: 201 happy path + snapshot populated (count via SQL direto no JdbcTemplate), 422 sem elegíveis, 200 close, 409 double close, trigger write-once verificado via tentativa de UPDATE direto que falha.

### Frontend

- `frontend/src/app/features/polls/polls-page.ts` (+ html/scss) — lista de polls + botão "Nova votação". Rota `/condominiums/:id/polls`.
- `frontend/src/app/features/polls/poll-create.ts` — Reactive Form: título, descrição opcional, lista dinâmica de opções (FormArray ≥2, botão "+ adicionar opção"). Dropdown quorum_mode default "Maioria simples" (outros disabled). Botão "Abrir votação".
- `frontend/src/app/features/polls/poll-list.ts` — dumb, recebe polls via input, link para cada uma (rota `/polls/:pollId` virá em H8).
- `frontend/src/app/features/polls/poll-card.ts` — dumb, mostra título + status badge + eligibleCount.
- `frontend/src/app/core/api/polls-api.service.ts`.
- Rota adicionada + link "Votações" no header condicional a `MANAGER`.

### Cobertura técnica F1-F8

F6 (parte) — Poll CRUD + snapshot ao abrir. Voto + resultado ficam em H8.

## Fora de escopo

- Votar — H8.
- Resultado computado — H8 (`closePoll` no v1 só muda status; cálculo+gravação de `poll_result` JSONB acontece em H8 quando contagem real existe).
- Modos de quórum Absoluto/Qualificado — v2.
- Cancelar votação (`status=CANCELLED`) — v2.
- Agendamento (`SCHEDULED` → auto `OPEN`) — H10 cortável.
- Editar poll após criada — não permitido por design.
- Anexar arquivos à votação — v2.

## Tasks

- [ ] T7.1 — Backend: aggregates + repos + service + controller + DTOs
- [ ] T7.2 — UT `PollServiceTest`
- [ ] T7.3 — IT `PollControllerIT` (incluindo verificação do trigger write-once)
- [ ] T7.4 — Frontend: pages + components + service + rota
- [ ] T7.5 — Vitest do service + page
- [ ] T7.6 — `docs/features/h7-criar-votacao.md`
- [ ] T7.7 — `./mvnw verify` + `npm run lint && npm run test:ci` verde
- [ ] T7.8 — Smoke local: criar poll → confirmar snapshot via SQL → fechar → ver status mudou
- [ ] T7.9 — PR `feat/h7-poll-create → develop`
- [ ] T7.10 — `docs/STATUS.md` atualizado

## Definition of Done

- [ ] Critérios de aceitação verdes em IT
- [ ] Cobertura ≥ 70% nos arquivos alterados
- [ ] Quality gates verdes
- [ ] `docs/features/h7-criar-votacao.md` no PR
- [ ] PR `feat/h7-poll-create` aberto contra `develop`
- [ ] Apêndice marcado: F6 (parte) ✅

## Notas para o implementer (Sonnet 4.6)

1. Ler PRIMEIRO: `CLAUDE.md` §Invariantes (snapshot write-once + voto imutável), `docs/data-model.md` §poll §poll_eligible_snapshot, `backend/src/main/resources/db/migration/V7__poll_domain.sql`, `Condominium.java`, `CondominiumService.java`, `AuditEventPublisher.java` (recém criado).
2. **Snapshot é INSERT...SELECT direto no service, na mesma `@Transactional` do create poll.** Não tem trigger SQL populando — só protegendo imutabilidade após criação.
3. CHECK constraints na V7 são exigentes (`chk_poll_dates`, `chk_poll_opened`): definir `scheduled_start = scheduled_end = now()` ao criar como OPEN para satisfazer NOT NULL implícito.
4. `convocation_type` é enum — usar valor padrão `GENERAL` (ou primeiro valor do enum em V1 — confirmar via leitura).
5. Tentar `UPDATE poll_eligible_snapshot ... SET ...` no IT para verificar que o trigger lança exception — vale uns 5 pontos de robustez.
6. **Commit em português, imperativo. SEM `Co-Authored-By`.** PR contra `develop`.
