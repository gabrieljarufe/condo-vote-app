# H7 — Síndico cria votação com ciclo completo de vida

## História

Como **síndico**, quero **criar votações com ciclo completo (rascunho → agendada → aberta → encerrada/cancelada/invalidada) com snapshot de elegibilidade fixado na abertura**, para **conduzir deliberações com transparência e rastreabilidade, garantindo que mudanças posteriores (delegação, inadimplência, remoção) não afetem o universo eleitoral daquela votação**.

## Motivação / contexto de produto

Coração do produto. Materializa três invariantes do domínio registradas em `CLAUDE.md`:

1. **Snapshot write-once** — `poll_eligible_snapshot` é gerado na transição `SCHEDULED→OPEN` (ou `DRAFT→OPEN` via abertura manual antecipada) e **nunca alterado**. Trigger SQL da V7 (linhas 101-111) garante via banco. Denominador de quórum para os modos Absoluto e Qualificado.
2. **Voto pertence ao apartamento** — snapshot registra `apartment_id` + `eligible_voter_user_id`; o votante é testemunha para auditoria, não o dono do voto.
3. **Delegação bloqueada durante poll OPEN** — polling de `eligible_voter_user_id` é bloqueado enquanto o apartamento constar no snapshot de poll aberto.

Spec [`docs/condo-vote-principles.md`](../../../condo-vote-principles.md) §5 (ciclo de vida), §6 (quórum), §7 (opções de voto).
Data model [`docs/data-model.md`](../../../data-model.md) §poll, §poll_option, §poll_eligible_snapshot, §poll_result.
Migrations relevantes: `V7__poll_domain.sql` (schema completo), `V1__enums.sql` (enums), `V12__poll_lifecycle_support.sql` (POLL_PUBLISHED, POLL_UPDATED, idx parcial OPEN).

**Por que ciclo completo agora:** a versão anterior desta spec previa H7 somente com criação direta em OPEN. A revisão (PR chore/h7-0-foundations) alinha com a spec §5 que define DRAFT e SCHEDULED como estados obrigatórios. Jobs agendados (`PollOpenerJob`, `PollCloserJob`) viabilizam o agendamento automaticamente, eliminando a necessidade de uma H10 separada para este ciclo.

## Critérios de aceitação

### Criar rascunho
- [ ] **Dado** síndico autenticado com tenant ativo **quando** chama `POST /api/condominiums/{id}/polls` com `{ title, description?, options: ["Sim","Não"], convocationType: "FIRST", quorumMode: "SIMPLE_MAJORITY", scheduledStart?, scheduledEnd? }` **então** retorna 201 + body com `id`, `status="DRAFT"`, `eligibleCount=null`, `options[]` com `displayOrder`.
- [ ] **Dado** payload com `options` com menos de 2 itens **então** retorna 422 com mensagem de validação.
- [ ] **Dado** payload com `options` com mais de 10 itens **então** retorna 422 com mensagem de validação.
- [ ] **Dado** payload com labels de opção duplicados (case-insensitive) **então** retorna 422.
- [ ] **Dado** poll criada em DRAFT **então** `audit_event` recebe `POLL_CREATED` com payload `{ title, optionsCount }`.

### Editar rascunho e agendada
- [ ] **Dado** poll em DRAFT **quando** síndico chama `PUT /api/polls/{id}` com campos alterados **então** retorna 200 + poll atualizada; `audit_event` recebe `POLL_UPDATED`.
- [ ] **Dado** poll em SCHEDULED **quando** síndico edita (título, descrição, opções, datas, quórum, convocação) **então** retorna 200; `audit_event` recebe `POLL_UPDATED`.
- [ ] **Dado** poll em OPEN **quando** síndico tenta editar **então** retorna 409 "Votação não pode ser editada no estado atual".
- [ ] **Dado** poll em CLOSED **quando** síndico tenta editar **então** retorna 409.

### Publicar (DRAFT → SCHEDULED)
- [ ] **Dado** poll em DRAFT com `scheduledStart` e `scheduledEnd` válidos **quando** síndico chama `POST /api/polls/{id}/publish` **então** retorna 200 + `status="SCHEDULED"`; `audit_event` recebe `POLL_PUBLISHED`.
- [ ] **Dado** poll em DRAFT com `scheduledStart` no passado **quando** publica **então** retorna 422 com mensagem "Data de início deve ser futura".
- [ ] **Dado** poll em DRAFT sem `scheduledStart` ou `scheduledEnd` **quando** publica **então** retorna 422.

### Abrir manualmente (SCHEDULED → OPEN)
- [ ] **Dado** poll em SCHEDULED **quando** síndico chama `POST /api/polls/{id}/open` **então** retorna 200 + `status="OPEN"`, `openedAt`, `eligibleCount > 0`; `poll_eligible_snapshot` contém 1 linha por apartamento elegível (não inadimplente, com `eligible_voter_user_id IS NOT NULL`); `audit_event` recebe `POLL_OPENED_MANUALLY`.
- [ ] **Dado** poll em SCHEDULED mas nenhum apartamento elegível no momento da abertura **quando** síndico abre manualmente **então** retorna 422 "Nenhum apartamento elegível para votação" (rollback; poll permanece SCHEDULED).
- [ ] **Dado** poll em DRAFT **quando** síndico tenta abrir manualmente **então** retorna 409 "Votação deve ser publicada antes de abrir".

### Abertura automática (job)
- [ ] **Dado** poll em SCHEDULED com `scheduledStart <= now()` **quando** `PollOpenerJob` executa **então** poll transita para OPEN com snapshot gerado; `audit_event` recebe `POLL_OPENED_AUTO` com `actorUserId = SystemUser.ID`.
- [ ] **Dado** poll SCHEDULED sem elegíveis **quando** job tenta abrir **então** poll permanece SCHEDULED (tentativa logada como WARN — não cancela nem invalida automaticamente); outras polls do mesmo ciclo não são afetadas.

### Encerrar (OPEN → CLOSED ou INVALIDATED)
- [ ] **Dado** poll em OPEN **quando** síndico chama `POST /api/polls/{id}/close` **então** retorna 200; status = `CLOSED` se alguma opção atingiu o limiar + quórum de presença (quando FIRST); `INVALIDATED` caso contrário; `poll_result` é gerado e persistido; `audit_event` recebe `POLL_CLOSED` ou `POLL_INVALIDATED`.
- [ ] **Dado** poll em CLOSED **quando** síndico chama `close` de novo **então** 409 "Votação já encerrada".

### Encerramento automático (job)
- [ ] **Dado** poll em OPEN com `scheduledEnd <= now()` **quando** `PollCloserJob` executa **então** poll transita para CLOSED ou INVALIDATED; `poll_result` é gerado; `audit_event` recebe `POLL_CLOSED` ou `POLL_INVALIDATED`.

### Cancelar
- [ ] **Dado** poll em SCHEDULED ou OPEN **quando** síndico chama `POST /api/polls/{id}/cancel` com `{ reason: "texto com ao menos 10 chars" }` **então** retorna 200 + `status="CANCELLED"`, `cancellationReason`; `audit_event` recebe `POLL_CANCELLED`.
- [ ] **Dado** cancelamento sem `reason` ou com menos de 10 caracteres **então** retorna 422.
- [ ] **Dado** poll em CLOSED **quando** síndico tenta cancelar **então** retorna 409 "Votação já encerrada, cancelamento não permitido".
- [ ] **Dado** poll em DRAFT **quando** síndico tenta cancelar **então** retorna 409 "Rascunho não pode ser cancelado — exclua ou publique a votação".

### Listagem e detalhe
- [ ] **Dado** síndico autenticado **quando** chama `GET /api/condominiums/{id}/polls?status=OPEN&page=0&size=20` **então** retorna 200 com lista paginada ordenada por `created_at DESC`; filtragem por status opcional.
- [ ] **Dado** síndico **quando** chama `GET /api/polls/{id}` **então** retorna 200 com detalhes incluindo opções e resultado (quando disponível).

### Isolamento RLS e write-once
- [ ] **Dado** usuário de tenant B **quando** acessa poll de tenant A **então** retorna 404 (RLS oculta linha).
- [ ] **Dado** tentativa de `UPDATE` ou `DELETE` em `poll_eligible_snapshot` via SQL direto **então** trigger V7 (linhas 109-111) rejeita com `check_violation`.
- [ ] **Dado** usuário sem role `MANAGER` no tenant **quando** chama qualquer endpoint de escrita **então** retorna 403.

### Cálculo de quórum (PollResultCalculator)
- [ ] **Dado** poll SECOND + SIMPLE_MAJORITY: vencedor é a opção com mais votos dentre os computados (independente de presença).
- [ ] **Dado** poll FIRST + SIMPLE_MAJORITY: vencedor requer presença ≥ CEIL(snapshot/2.0) + opção > ⌊votos/2⌋+1.
- [ ] **Dado** poll FIRST + ABSOLUTE_MAJORITY: vencedor requer opção ≥ ⌊snapshot/2⌋+1.
- [ ] **Dado** poll FIRST + QUALIFIED_2_3: vencedor requer opção ≥ ⌈snapshot×2/3⌉.
- [ ] **Dado** poll FIRST + QUALIFIED_3_4: vencedor requer opção ≥ ⌈snapshot×3/4⌉.
- [ ] **Dado** empate (50-50 em SIMPLE_MAJORITY): status = INVALIDATED, reason = NO_OPTION_REACHED_THRESHOLD.
- [ ] **Dado** quórum de presença não atingido (FIRST): status = INVALIDATED, reason = PRESENCE_QUORUM_NOT_REACHED.

## Escopo técnico

### Backend

Pacote base: `backend/src/main/java/com/condovote/poll/`

**Aggregates e repositórios:**
- `Poll.java` — record `@Table("poll")` com todos os campos da V7. Sem enum constants para `convocation_type=GENERAL` — enum válido é `FIRST` / `SECOND`. Método de negócio: `canBeEdited()`, `canBeOpened()`, `canBeCancelled()`.
- `PollOption.java` — record `@Table("poll_option")`.
- `PollEligibleSnapshot.java` — record `@Table("poll_eligible_snapshot")`.
- `PollResult.java` — record `@Table("poll_result")`.
- `PollRepository.java` — `findByCondominiumId(UUID condoId, Pageable pageable)`, `findCandidatesToOpen(Instant now)` (status=SCHEDULED, scheduled_start <= now), `findCandidatesToClose(Instant now)` (status=OPEN, scheduled_end <= now). Queries via `@Query` nomeadas. **SQL nunca sai do repository.**
- `PollOptionRepository.java` — `findByPollIdOrderByDisplayOrder(UUID pollId)`.
- `PollEligibleSnapshotRepository.java` — `findByPollId(UUID pollId)`, `countByPollId(UUID pollId)`.
- `PollResultRepository.java` — `save(PollResult)`.

**Componentes de negócio:**
- `PollOpener.java` — componente `@Component` (não `@Service`) que encapsula a transição para OPEN. Chamado por `PollService.openManually()` e `PollOpenerJob`. Ordem obrigatória: (1) INSERT snapshot via `SELECT` de apartamentos elegíveis, (2) contar linhas → se 0, lança `UnprocessableEntityException` + rollback, (3) `UPDATE poll SET status='OPEN', opened_at=now(), opened_by_user_id=actorId, eligible_count=count` em um único UPDATE para satisfazer `chk_poll_opened` e `chk_poll_eligible_count` atomicamente. **Nunca** INSERT poll com status=OPEN e eligible_count=NULL.
- `PollCloser.java` — componente `@Component` que encapsula a transição de encerramento. Chama `PollResultCalculator`, persiste `poll_result`, atualiza status para CLOSED ou INVALIDATED, publica audit_event.
- `PollResultCalculator.java` — classe final com método estático puro (sem dependências Spring) `calculate(PollResultInput input)`. Cobre todas as combinações de `convocation_type × quorum_mode`. Recebe `snapshotSize`, `votesPerOption`, `convocation`, `quorumMode`. Retorna `PollResultOutput` (status CLOSED|INVALIDATED, winningOptionId|null, invalidationReason|null).

**Service:**
- `PollService.java` — métodos `@Transactional`:
  - `createDraft(UUID condoId, CreatePollRequest req, UUID actorUserId) → PollResponse`
  - `updateDraft(UUID pollId, UpdatePollRequest req, UUID actorUserId) → PollResponse`
  - `publish(UUID pollId, UUID actorUserId) → PollResponse`
  - `openManually(UUID pollId, UUID actorUserId) → PollResponse`
  - `cancel(UUID pollId, CancelPollRequest req, UUID actorUserId) → PollResponse`
  - `closeManually(UUID pollId, UUID actorUserId) → PollResponse`
  - `listByCondominium(UUID condoId, PollStatus statusFilter, Pageable pageable) → Page<PollResponse>`
  - `getById(UUID pollId) → PollDetailResponse`
  - Valida role MANAGER em todos os métodos de escrita (mesma abordagem de `ApartmentService`).

**Jobs:**
- `PollOpenerJob.java` — `@Scheduled(fixedDelay = 5 * 60 * 1000)`. Sem RLS: lista candidatos via `JdbcTemplate` (sem `SET LOCAL app.current_tenant`) para ver todos os tenants. Itera por poll, configura `TenantContext` e chama `PollOpener` dentro de `@Transactional` para herdar o `SET LOCAL` via `TenantTransactionAspect`. Try/catch por iteração — uma poll falhar não bloqueia as demais. Sem ShedLock (single-instance na v1, alinhado com `InvitationExpirerJob`).
- `PollCloserJob.java` — análogo ao `PollOpenerJob`, usa `PollCloser`.

**Controller:**
- `PollController.java` — 8 endpoints:
  - `POST /api/condominiums/{condoId}/polls` → 201 (createDraft)
  - `PUT /api/polls/{id}` → 200 (updateDraft)
  - `POST /api/polls/{id}/publish` → 200
  - `POST /api/polls/{id}/open` → 200
  - `POST /api/polls/{id}/cancel` → 200
  - `POST /api/polls/{id}/close` → 200
  - `GET /api/condominiums/{condoId}/polls` → 200 (paginado, filtro `?status=`)
  - `GET /api/polls/{id}` → 200 (detalhe)

**DTOs:**
- `CreatePollRequest.java` — `@NotBlank title`, `description?`, `@Size(min=2, max=10) options`, `convocationType` (default FIRST), `quorumMode` (default SIMPLE_MAJORITY), `scheduledStart?`, `scheduledEnd?`.
- `UpdatePollRequest.java` — mesmos campos de `CreatePollRequest`, todos opcionais (PATCH semântico via PUT).
- `CancelPollRequest.java` — `@NotBlank @Size(min=10) reason`.
- `PollResponse.java` — campos públicos da poll sem snapshot.
- `PollDetailResponse.java` — PollResponse + `options[]` + `result?`.
- `PollOptionResponse.java` — `id`, `label`, `displayOrder`.
- `PollResultResponse.java` — `quorumDenominator`, `totalVotesComputed`, `winningOptionId?`, `quorumReached`, `invalidationReason?`, `votesPerOption` (Map<UUID, Integer>).

**Testes obrigatórios:**
- `PollResultCalculatorTest.java` — UT, 12+ cenários cobrindo todas as combinações convocação × modo × empate × quórum presença insuficiente. **Sem Spring.**
- `PollServiceTest.java` — UT com mocks de `PollRepository`, `PollOpener`, `PollCloser`, `AuditEventPublisher`, `AuthGateway`. Cobre: createDraft OK, updateDraft OK, update em OPEN lança 409, publish sem datas lança 422, cancel sem motivo lança 422, cancel em CLOSED lança 409, role check negativo.
- `PollControllerIT.java` — IT estende `AbstractIntegrationTest`. Cenários: 201 happy path, 422 opções insuficientes, 200 publish, 200 openManually + snapshot populado (count via JdbcTemplate), 422 sem elegíveis, 200 cancel, 200 close CLOSED/INVALIDATED, 409 double-close, 404 RLS cross-tenant, trigger write-once (tentativa de UPDATE em `poll_eligible_snapshot`).
- `PollOpenerJobIT.java` — IT: poll SCHEDULED com `scheduledStart` no passado → job abre; poll sem elegíveis → permanece SCHEDULED.
- `PollCloserJobIT.java` — IT: poll OPEN com `scheduledEnd` no passado → job fecha; verifica `poll_result` gerado.

### Frontend

Feature: `frontend/src/app/features/polls/`

**Componentes:**
- `polls-page.ts` (smart) — lista paginada com filtro por status; botão "Nova votação" navega para `poll-create-page`. Rota: `/condominiums/:id/polls`.
- `poll-create-page.ts` (smart) — Reactive Form com: `title`, `description`, `FormArray options` (≥2, ≤10, botão "+ Adicionar opção"), `convocationType` dropdown (FIRST/SECOND), `quorumMode` dropdown (4 opções), `scheduledStart` + `scheduledEnd` datepickers. Submete e navega para detalhe.
- `poll-edit-page.ts` (smart) — reusa o mesmo componente de form de `poll-create-page`; carrega poll existente em DRAFT ou SCHEDULED.
- `poll-detail-page.ts` (smart) — exibe detalhes com ações condicionais por status (publicar, abrir, cancelar, encerrar — cada uma com confirmação ou dialog).
- `poll-cancel-dialog.ts` (dumb) — `MatDialog` com textarea obrigatória ≥10 chars.
- `poll-card.ts` (dumb) — exibe título, `poll-status-badge`, `eligibleCount`, `scheduledStart`.
- `poll-status-badge.ts` (dumb) — chip colorido por status.

**Service:**
- `frontend/src/app/core/api/polls-api.service.ts` — wrapper HTTP com todos os 8 endpoints.

**Rotas:**
- Adicionadas em `home.routes.ts` com `tenantRestoreGuard` + `adminGuard`.
- Link "Votações" no header condicional a `tenantService.activeRoles().has('MANAGER')`.

**Testes Vitest:**
- `polls-api.service.spec.ts` — mock HttpClient, cobre todos os endpoints.
- `polls-page.spec.ts` — render + signal updates.
- `poll-create-page.spec.ts` — validação do form (min/max opções, datas).
- `poll-cancel-dialog.spec.ts` — validação ≥10 chars.

### Banco

Sem migration nova além de `V12__poll_lifecycle_support.sql` (já criada em chore/h7-0-foundations):
- Novos valores de enum: `POLL_PUBLISHED`, `POLL_UPDATED`.
- Novo índice parcial `idx_poll_open_by_condo ON poll(condominium_id) WHERE status='OPEN'` — resolve query do H6 "esse apartamento tem poll OPEN no snapshot?".

Índices existentes (V7):
- `idx_poll_condominium_id`, `idx_poll_status` — lista por condomínio + filtro.
- `idx_poll_due_to_open ON poll(scheduled_start) WHERE status='SCHEDULED'` — PollOpenerJob.
- `idx_poll_due_to_close ON poll(scheduled_end) WHERE status='OPEN'` — PollCloserJob.

### Cobertura técnica F1-F8

F6 (completo) — Poll lifecycle + snapshot + cálculo de quórum + PollResult. Voto fica em H8.

## Fora de escopo

- Registrar voto — H8.
- Timeline de auditoria UI — H9.
- Delegação/promoção/remoção durante poll OPEN — H6 (enforcement no `ApartmentService`).
- ShedLock para multi-instância — v2 quando Coolify escalar para 2+ réplicas.
- Exportação de resultado (PDF/CSV) — v2.
- Notificações por e-mail disparadas por transições de estado — integração com `EmailSenderJob` (definir em task ou história separada após H7 estabilizar).
- `previous_poll_id` (vínculo entre 1ª e 2ª Convocação) — campo existe no schema, mas sem UI para vínculo em v1.

## Tasks

- [ ] T7.1 — Backend: aggregates (`Poll`, `PollOption`, `PollEligibleSnapshot`, `PollResult`) + repositórios + DTOs
- [ ] T7.2 — `PollResultCalculator` + `PollResultCalculatorTest` (12+ cenários UT sem Spring)
- [ ] T7.3 — `PollOpener` + `PollCloser` + `PollService` + `PollServiceTest` (UT com mocks)
- [ ] T7.4 — `PollController` + `PollControllerIT` (RLS + write-once trigger + paginação)
- [ ] T7.5 — `PollOpenerJob` + `PollCloserJob` + `PollOpenerJobIT` + `PollCloserJobIT`
- [ ] T7.6 — Frontend: `polls-api.service` + `polls-page` + `poll-card` + `poll-status-badge`
- [ ] T7.7 — Frontend: `poll-create-page` + `poll-edit-page` (form compartilhado com FormArray)
- [ ] T7.8 — Frontend: `poll-detail-page` + `poll-cancel-dialog` + ações condicionais por status
- [ ] T7.9 — Frontend: rotas em `home.routes.ts` + link "Votações" no header + Vitest
- [ ] T7.10 — Smoke local: criar DRAFT → publicar → abrir manual → cancelar; jobs abrirem/fecharem automaticamente
- [ ] T7.11 — `docs/features/h7-criar-votacao.md` + atualizar `docs/STATUS.md`
- [ ] T7.12 — `./mvnw verify` + `npm run lint && npm run test:ci` verdes
- [ ] T7.13 — PR `feat/h7-poll-lifecycle → develop`

## Definition of Done

- [ ] Todos os critérios de aceitação verdes em IT (Testcontainers + RLS isolada)
- [ ] UT cobrindo `PollResultCalculator` (12+ cenários), `PollService` (mocks), `PollOpener`/`PollCloser` (mocks)
- [ ] Cobertura ≥ 70% nos arquivos alterados (`./mvnw verify` localmente antes do PR)
- [ ] Quality gates verdes no CI: Spotless, JaCoCo, PMD CPD, ESLint, jscpd, sonarjs
- [ ] Lint e tipos do frontend passando (`npm run lint && npm run test:ci`)
- [ ] `docs/features/h7-criar-votacao.md` no PR
- [ ] PR `feat/h7-poll-lifecycle` aberto contra `develop`
- [ ] Apêndice em [`index.md`](index.md) marcado F6 ✅

## Notas para o implementer

1. **Ler primeiro:** `CLAUDE.md §Invariantes`, `condo-vote-principles.md §5/§6/§7`, `data-model.md §poll/§poll_eligible_snapshot/§audit_event`, `V7__poll_domain.sql`, `V1__enums.sql`, `AuditEventPublisher.java`, `ApartmentService.java` (referência de fatia vertical), `InvitationExpirerJob.java` (padrão @Scheduled), `TenantTransactionAspect.java` (como RLS é aplicado), `apartments-page.ts` (padrão page Angular).

2. **`convocation_type` enum é `('FIRST','SECOND')`** — usar `'FIRST'` como default. **NUNCA** `'GENERAL'` (não existe no enum).

3. **Ordem obrigatória de INSERT/UPDATE na abertura (PollOpener):**
   - INSERT snapshot via SELECT (apartamentos elegíveis: `is_delinquent=false` AND `eligible_voter_user_id IS NOT NULL`)
   - Contar linhas afetadas → se 0, lança `UnprocessableEntityException` → rollback
   - Um único `UPDATE poll SET status='OPEN', opened_at=now(), opened_by_user_id=actorId, eligible_count=count WHERE id=?`
   - Esse UPDATE satisfaz `chk_poll_opened` e `chk_poll_eligible_count` atomicamente. **NUNCA** UPDATE somente o status e depois o eligible_count em passos separados.

4. **Jobs usam `SystemUser.ID`** em `opened_by_user_id` e `actor_user_id` do audit. Não há INSERT em `app_user` — `actor_user_id` em `audit_event` não tem FK (verificado no V8).

5. **Jobs listam candidatos via JdbcTemplate sem RLS** (precisam ver todos os tenants). Após obter a poll, configuram TenantContext e delegam a `PollOpener`/`PollCloser` dentro de `@Transactional` para que o `TenantTransactionAspect` aplique `SET LOCAL app.current_tenant`.

6. **Try/catch por iteração no job** — uma poll falhando (ex: elegíveis=0 no opener) não pode bloquear as outras. Log `WARN` com pollId e motivo.

7. **Limite de opções: 2 ≤ N ≤ 10**. Labels não-duplicados (comparação case-insensitive antes de persistir). Validar no service, não só no controller (defensive).

8. **`PollResultCalculator` é função pura** — sem anotações Spring, sem dependências injetadas. Facilita UT isolado cobrindo todos os 12+ casos de borda.

9. **Regras de estado para edição:** DRAFT e SCHEDULED aceitam PUT. OPEN, CLOSED, CANCELLED, INVALIDATED rejeitam com 409. A transição SCHEDULED→OPEN via `openManually` apenas (não via PUT).

10. **Commit em português, imperativo curto. SEM `Co-Authored-By`.** PR alvo `develop` via `gh pr create --base develop`.
