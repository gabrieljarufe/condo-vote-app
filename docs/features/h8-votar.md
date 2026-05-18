# H8 — Morador registra voto (smoke E2E)

## Problema da jornada (antes)

O morador não tinha como participar das votações criadas pelo síndico. O produto existia apenas do ponto de vista do síndico — criar, agendar e abrir votações — sem que o lado do eleitor fosse funcional. Sem voto, o caso de uso central não se fecha.

## Solução (depois)

O morador elegível acessa a área "Minhas votações" no dashboard, visualiza as cédulas pendentes e registra o voto. O sistema:

- Verifica elegibilidade contra o snapshot imutável gerado na abertura da poll.
- Garante 1 voto por apartamento por poll (unicidade via índice + trigger de imutabilidade SQL).
- Suporta fluxo bulk: morador com N apartamentos elegíveis vota no 1º e aplica a mesma opção aos demais via "Revisar e aplicar a todos".
- Permite override individual antes da submissão bulk.
- Tolera falhas parciais no bulk: mostra quantos enviados e permite retry dos falhados.
- Fecha a poll automaticamente quando todos os elegíveis votaram (auto-close 100%).
- Exibe breakdown por opção (%, barra, badge "Vencedora") na tela de detalhe do síndico quando a poll está CLOSED ou INVALIDATED.

## Como usar

### Fluxo do morador

1. Faça login como morador e selecione o condomínio.
2. No dashboard, localize o tile **"Minhas votações"** (visível apenas para residentes) com badge mostrando o número de cédulas pendentes.
3. Clique no tile → lista de polls abertas com cédulas pendentes.
4. Clique em uma poll → **BallotVotePage** com a 1ª cédula pendente.
5. Selecione uma opção e clique em **"Votar"** (ou **"Revisar e aplicar a todos"** se houver N>1 cédulas).
6. Confirme. A UI mostra sucesso.

### Fluxo bulk

1. Na BallotVotePage com N>1 cédulas: selecione opção no 1º apartamento → clique **"Revisar e aplicar a todos"**.
2. Na **BallotReviewPage**: N cards exibem o apartamento + opção selecionada.
3. Para trocar a opção de um card específico: clique no card → override individual → confirme.
4. Clique **"Confirmar e enviar"** → N POSTs paralelos.
5. Em caso de falha parcial: UI mostra "X/N enviados" + botão **"Tentar novamente"** só dos falhados.

## O que já foi validado em smoke

- ✅ Backend: 127 testes verdes (11 UT + 33 IT cobrindo VoteController, MyBallotsController, VoteService, VoteRepository), incluindo:
  - 14 cenários em `VoteControllerIT`: happy path 201, 409 duplicado, 403 não elegível, 403 eligible_voter_user_id ≠ JWT.sub, 422 opção inválida, auto-close 100%, audit VOTE_CAST + POLL_CLOSED, imutabilidade SQL, cross-tenant 403.
  - 13 cenários em `MyBallotsControllerIT`: ballots 0/1/N cédulas, pending-polls, cédulas já votadas.
  - 6 cenários em `VoteRepositoryIT`: INSERT, tally por opção, trigger de imutabilidade.
  - 11 UT em `VoteServiceTest`: auto-close, dedup, elegibilidade, bulk, mocks de `PollCloser`.
- ✅ Frontend: 285 testes Vitest verdes, ESLint zero warnings.
- ✅ `./mvnw verify` no worktree (BUILD SUCCESS + JaCoCo + CPD).

## Roteiro de smoke manual (E2E)

Roteiro acionável para validar H8 ponta-a-ponta no stack local.

### Pré-requisitos do ambiente

```bash
# 1. Supabase local (banco + auth)
cd infra/supabase && supabase start

# 2. Backend + Redis via docker compose
cd backend && docker compose up --build backend

# 3. Frontend dev server
cd frontend && npm install && npm start
```

Dados necessários:
- Síndico (`sindico@local.dev` / `password123`, condomínio `019dd4f8-57fa-77b1-ace2-c9f6a3d9811e`).
- **Pelo menos 3 apartamentos** com `eligible_voter_user_id != NULL` e `is_delinquent = false` (para cobrir fluxo bulk e auto-close).
- **1 morador** com acesso a 3 desses apartamentos como `eligible_voter_user_id` (mesmo usuário para simplificar o smoke; em prod são usuários distintos).
- **1 apartamento marcado como inadimplente** (para Bloco 4 — elegibilidade heterogênea).
- **Poll OPEN** criada pelo síndico com `convocationType=FIRST`, `quorumMode=SIMPLE_MAJORITY`, 2 opções, e `eligible_count ≥ 3`.
- Bruno collection: `auth/get-token.bru` para obter `{{access_token}}` — necessário para chamadas diretas ao backend.
- Acesso ao psql local: `psql postgresql://postgres:postgres@localhost:54322/postgres`.

> Como obter o UUID da poll: após criar via UI, copiar o trecho de URL `/polls/{uuid}`. Substituir `:pollId` nas queries abaixo.

---

### Bloco 1 — Voto único (1 apartamento)

**Pré-condição:** Morador com 1 único apartamento elegível; poll OPEN com `eligible_count = 1`.

| # | Ação | Onde | Resultado esperado |
|---|---|---|---|
| 1.1 | Login como morador, acessar dashboard | UI | Tile "Minhas votações" aparece com badge "1" |
| 1.2 | Clicar no tile | UI | Lista de polls com 1 item mostrando a poll OPEN |
| 1.3 | Clicar na poll | UI | BallotVotePage com 1 cédula (nenhum CTA bulk — apenas 1 apto) |
| 1.4 | Selecionar opção "Sim" → clicar "Votar" | UI | Confirmação de sucesso; badge do tile some (pendências = 0) |
| 1.5 | Verificar vote inserido | psql | 1 linha com `option_id` correspondente a "Sim" |
| 1.6 | Verificar audit gravado | psql | Linha `VOTE_CAST` com `bulk_operation: false` |
| 1.7 | Tentar votar de novo | UI ou Bruno | 409 "Voto já registrado para este apartamento nesta votação" |

**Validação SQL:**

```sql
-- 1.5: confirmar voto inserido
SELECT v.apartment_id, po.label, v.bulk_operation, v.voted_at
FROM vote v
JOIN poll_option po ON po.id = v.option_id
WHERE v.poll_id = ':pollId';
-- Espera: 1 linha, label="Sim", bulk_operation=false

-- 1.6: confirmar audit VOTE_CAST
SELECT event_type, payload
FROM audit_event
WHERE entity_id = ':pollId' AND event_type = 'VOTE_CAST'
ORDER BY occurred_at;
-- Espera: 1 linha, payload.bulkOperation=false
```

---

### Bloco 2 — Bulk N apartamentos (caminho feliz)

**Pré-condição:** Morador com 3 apartamentos elegíveis na poll; poll OPEN com `eligible_count = 3`; nenhum voto registrado ainda.

| # | Ação | Onde | Resultado esperado |
|---|---|---|---|
| 2.1 | Acessar BallotVotePage | UI | Exibe 1ª cédula + CTA "Revisar e aplicar a todos" visível |
| 2.2 | Selecionar opção "Não" no 1º apto → clicar "Revisar e aplicar a todos" | UI | Navega para BallotReviewPage com 3 cards (1º votado + 2 pendentes com opção pré-selecionada "Não") |
| 2.3 | Sem alterar nada → clicar "Confirmar e enviar" | UI | Progress: 3 POSTs paralelos; tela mostra "3/3 enviados" → sucesso |
| 2.4 | Verificar votos inseridos | psql | 3 linhas com `bulk_operation=true` para 2 dos aptos (1º teve bulk_operation=false pois foi via BallotVotePage) |
| 2.5 | Verificar tile desapareceu | UI | Badge "Minhas votações" = 0 ou tile some |

**Validação SQL:**

```sql
-- 2.4: confirmar 3 votos na poll
SELECT v.apartment_id, po.label, v.bulk_operation
FROM vote v
JOIN poll_option po ON po.id = v.option_id
WHERE v.poll_id = ':pollId'
ORDER BY v.voted_at;
-- Espera: 3 linhas, label="Não" em todas, bulk_operation: false no 1º, true nos demais

-- 2.5: confirmar pending-polls vazio
SELECT count(*)
FROM vote v
JOIN poll_eligible_snapshot s ON s.poll_id = v.poll_id AND s.apartment_id = v.apartment_id
WHERE s.poll_id = ':pollId';
-- Espera: 3 (todos votaram)
```

---

### Bloco 3 — Override individual antes do bulk

**Pré-condição:** Morador com 3 apartamentos elegíveis; poll OPEN com `eligible_count = 3`; nenhum voto registrado.

| # | Ação | Onde | Resultado esperado |
|---|---|---|---|
| 3.1 | BallotVotePage: selecionar "Sim" no 1º apto → "Revisar e aplicar a todos" | UI | BallotReviewPage com 3 cards, todos mostrando "Sim" |
| 3.2 | Clicar no card do 2º apartamento → selecionar "Não" → confirmar override | UI | Card 2 atualiza para "Não"; cards 1 e 3 permanecem "Sim" |
| 3.3 | Confirmar e enviar | UI | 3 POSTs paralelos; sucesso |
| 3.4 | Verificar opções diferentes | psql | Apto 1 = "Sim", Apto 2 = "Não", Apto 3 = "Sim" |

**Validação SQL:**

```sql
-- 3.4: confirmar opções diferentes por apartamento
SELECT a.unit_number, po.label
FROM vote v
JOIN poll_option po ON po.id = v.option_id
JOIN apartment a ON a.id = v.apartment_id
WHERE v.poll_id = ':pollId'
ORDER BY a.unit_number;
-- Espera: 3 linhas; apto1=Sim, apto2=Não, apto3=Sim
```

---

### Bloco 4 — Elegibilidade heterogênea (1 apto inadimplente)

**Pré-condição:** Morador com 3 apartamentos, mas 1 marcado como `is_delinquent = true` quando a poll foi aberta; snapshot gerado com `eligible_count = 2`.

| # | Ação | Onde | Resultado esperado |
|---|---|---|---|
| 4.1 | Acessar BallotVotePage | UI | Exibe 2 cédulas pendentes (não 3) |
| 4.2 | Tentar chamar `POST /api/polls/:pollId/vote` com `apartmentId` do apto inadimplente via Bruno | HTTP | 403 "Apartamento não elegível para esta votação" |
| 4.3 | Verificar snapshot | psql | 2 linhas em `poll_eligible_snapshot`, nenhuma com `is_delinquent=true` |

> **Falta testar:** banner de inadimplência na UI informando ao morador qual apto ficou fora — não implementado no frontend em H8.

**Validação SQL:**

```sql
-- 4.3: confirmar snapshot sem inadimplentes
SELECT s.apartment_id, a.unit_number, a.is_delinquent
FROM poll_eligible_snapshot s
JOIN apartment a ON a.id = s.apartment_id
WHERE s.poll_id = ':pollId';
-- Espera: 2 linhas, todas com is_delinquent=false
```

---

### Bloco 5 — Bulk parcial com falha

**Pré-condição:** Morador com 3 aptos elegíveis; 1 voto já registrado fora da UI (simulando falha de concorrência); poll OPEN.

> Este bloco pode ser testado forçando um 409 via SQL (inserindo 1 vote manualmente antes do bulk) ou via mock de rede no browser DevTools (Network → bloquear 1 requisição).

| # | Ação | Onde | Resultado esperado |
|---|---|---|---|
| 5.1 | Inserir 1 voto direto via psql para 1 dos aptos | psql | `INSERT INTO vote ...` bem-sucedido |
| 5.2 | Acessar BallotVotePage → selecionar opção → "Revisar e aplicar a todos" → confirmar | UI | Progress mostra: 2 enviados com sucesso, 1 falhou (409) |
| 5.3 | UI mostra "2/3 enviados" + botão "Tentar novamente" | UI | Botão retry visível |
| 5.4 | Clicar "Tentar novamente" | UI | Retry do voto falhado → também 409 → UI informa que aquele apto já votou |

**Validação SQL (pré-condição — inserir voto direto):**

```sql
-- Inserir voto diretamente para simular concorrência
-- Substituir todos os UUIDs pelos valores reais
INSERT INTO vote (id, poll_id, apartment_id, condominium_id, option_id, voter_user_id, bulk_operation, voted_at)
VALUES (
  gen_random_uuid(),
  ':pollId',
  ':apartmentIdAlvo',
  ':condominiumId',
  ':optionId',
  ':voterUserId',
  false,
  now()
);
```

---

### Bloco 6 — Auto-close ao 100% + audit `automatic:true`

**Pré-condição:** Poll OPEN com `eligible_count = 3`; 2 votos já registrados; 1 apartamento pendente. O morador do 3º apto é o usuário atual.

| # | Ação | Onde | Resultado esperado |
|---|---|---|---|
| 6.1 | Registrar o 3º e último voto | UI ou Bruno (`POST /api/polls/:pollId/vote`) | 201 Created |
| 6.2 | Verificar status da poll | UI (síndico) ou psql | Status = "Encerrada" (CLOSED); `close_trigger = 'AUTOMATIC_ALL_VOTED'`; `closed_at` preenchido |
| 6.3 | Verificar `poll_result` inserido | psql | `outcome='CLOSED'`, `close_trigger='AUTOMATIC_ALL_VOTED'`, vencedor determinado |
| 6.4 | Verificar audit `POLL_CLOSED` com `automatic:true` | psql | Linha `POLL_CLOSED` com `payload.automatic=true`, `payload.trigger='AUTOMATIC_ALL_VOTED'` |

**Validação SQL:**

```sql
-- 6.2: status e close_trigger
SELECT status, close_trigger, closed_at, eligible_count
FROM poll
WHERE id = ':pollId';
-- Espera: status='CLOSED', close_trigger='AUTOMATIC_ALL_VOTED', closed_at IS NOT NULL

-- 6.3: resultado
SELECT outcome, close_trigger, winning_option_id, total_votes, quorum_denominator
FROM poll_result
WHERE poll_id = ':pollId';
-- Espera: outcome='CLOSED', close_trigger='AUTOMATIC_ALL_VOTED', winning_option_id IS NOT NULL (se houve vencedor)

-- 6.4: audit POLL_CLOSED com automatic:true
SELECT event_type, payload
FROM audit_event
WHERE entity_id = ':pollId' AND event_type = 'POLL_CLOSED';
-- Espera: payload contém "automatic":true e "trigger":"AUTOMATIC_ALL_VOTED"
```

---

### Bloco 7 — Breakdown UI quando CLOSED

**Pré-condição:** Poll no estado CLOSED (do Bloco 6 ou qualquer poll fechada manualmente pelo síndico com votos registrados).

| # | Ação | Onde | Resultado esperado |
|---|---|---|---|
| 7.1 | Síndico acessa detalhe da poll CLOSED | UI | Seção de resultado exibe tabela de opções |
| 7.2 | Verificar breakdown por opção | UI | Cada opção exibe: label + contagem de votos + percentual + barra horizontal |
| 7.3 | Verificar badge "Vencedora" | UI | Opção com `winningOptionId` tem badge destacado |
| 7.4 | Verificar com poll INVALIDATED (quórum não atingido) | UI | Tabela exibida sem badge "Vencedora"; motivo de invalidação aparece |

> **Como criar poll INVALIDATED para Bloco 7.4:** abrir poll manualmente sem registrar votos → clicar "Encerrar" → status = INVALIDATED (quórum de presença = 0 < ceil(N/2)).

**Validação SQL:**

```sql
-- 7.3: confirmar winning_option_id
SELECT pr.winning_option_id, po.label
FROM poll_result pr
LEFT JOIN poll_option po ON po.id = pr.winning_option_id
WHERE pr.poll_id = ':pollId';
-- Espera: winning_option_id preenchido, label = opção com mais votos

-- 7.4: invalidação sem vencedor
SELECT outcome, invalidation_reason
FROM poll_result
WHERE poll_id = ':pollIdInvalidada';
-- Espera: outcome='INVALIDATED', invalidation_reason='PRESENCE_QUORUM_NOT_REACHED'
```

---

### Bloco 8 — Cross-tenant 403 + imutabilidade SQL

**Pré-condição:** 2 condomínios disponíveis (condo A e condo B). Usuário é morador elegível no condo A.

| # | Ação | Onde | Resultado esperado |
|---|---|---|---|
| 8.1 | Via Bruno: `POST /api/polls/:pollIdCondoA/vote` com header `X-Tenant-Id` = UUID do condo B | HTTP | 403 Forbidden (RLS oculta a poll do condo A quando tenant = condo B) |
| 8.2 | Tentar UPDATE direto em `vote` | psql | Erro do trigger `prevent_vote_modification` |
| 8.3 | Tentar DELETE direto em `vote` | psql | Mesmo erro do trigger |

**Validação SQL:**

```sql
-- 8.2: trigger de imutabilidade
UPDATE vote SET option_id = gen_random_uuid() WHERE poll_id = ':pollId' LIMIT 1;
-- Espera: ERROR: votes are immutable (ou similar da função prevent_vote_modification)

-- 8.3: trigger bloqueia delete
DELETE FROM vote WHERE poll_id = ':pollId' LIMIT 1;
-- Espera: mesmo erro do trigger
```

---

### Bloco 9 — Pendências (falta testar / requisitos de produção)

#### O que ainda falta testar

- ✅ **Banner de inadimplência na UI do morador** — implementado em `ballot-vote-page.ts`; `MyBallotsResponse.excludedApartments` lista aptos do morador fora do snapshot, e a UI exibe banner amarelo com a lista. Resolvido na entrega `feat: unifica votações no dashboard`.
- ✅ **Painel "Sua participação" no detalhe da poll** — `poll-detail-page.ts` mostra, para morador, status por apto (votado, pendente com CTA "Votar →", não-elegível) + total elegível em pollas OPEN (sem totalVotesSoFar, por sigilo §5).
- ⏳ **Retry parcial em rede flaky real** — o Bloco 5 usa 409 simulado; comportamento com timeout de rede (504/502) não exercitado.
- ⏳ **Fluxo quando morador tem acesso a >10 apartamentos** — sem cap de paginação testado no bulk.
- ⏳ **Integração com H9 (timeline de auditoria)** — quando H9 entrar, o evento `VOTE_CAST` deve aparecer na timeline do síndico; não validado ainda.
- ⏳ **Validação com delegação (H6)** — quando H6 entrar, `eligible_voter_user_id` pode ser diferente do OWNER do apto; smoke completo depende de H6.

#### Pré-requisitos para o teste em produção

- Migration V14 aplicada (Flyway aplica automaticamente no deploy).
- Pelo menos 1 apartamento por condomínio com `eligible_voter_user_id != NULL` e `is_delinquent = false`.
- Morador autenticado com role `RESIDENT` em pelo menos 1 apartamento elegível.
- Poll OPEN criada e com snapshot gerado (H7 completa).

---

## Critérios de aprovação deste roteiro

- ✅ **Blocos 1-4 e 6-8 todos verdes** em ambiente local = H8 funcionalmente pronta para prod.
- ⚠️ **Bloco 5** (falha parcial) requer setup manual — validar antes de abrir PR para prod.
- ⏳ **Bloco 9** (pendências) não bloqueia merge, mas deve ser resolvido antes do primeiro condomínio real votar.

---

## Endpoints / rotas

**Backend:**
- `POST /api/polls/{pollId}/vote` — registrar voto (header opcional `X-Bulk-Operation: true`)
- `GET /api/polls/{pollId}/my-ballots` — cédulas do morador para a poll
- `GET /api/condominiums/{condoId}/my-pending-polls` — polls OPEN com cédulas pendentes

**Frontend (todas em `/app/condominiums/:condoId/...`, protegidas por `tenantRestoreGuard`):**
- `/polls` — lista unificada com chips (Pendentes • Em andamento • Encerradas • Todas); default `Pendentes` para morador
- `/my-polls` — **redirect** para `/polls?tab=pendentes` (compat com links antigos)
- `/polls/:pollId` — PollDetailPage (com painel "Sua participação" para morador)
- `/polls/:pollId/vote` — BallotVotePage (com banner de inadimplência)
- `/polls/:pollId/vote/review` — BallotReviewPage

## Referências

- Spec: `docs/condo-vote-principles.md` §5 (Ciclo de votação), §6 (Quórum), §7 (Opções)
- Data model: `docs/data-model.md` §vote, §poll_eligible_snapshot, §poll_result, §audit_event
- História canônica: `docs/implementation/tasks/phase-7/h8-votar.md`
- História anterior: `docs/features/h7-criar-votacao.md`
- Migrations: `V7__poll_domain.sql` (trigger imutabilidade), `V14__vote_cast_audit_event.sql` (enum VOTE_CAST)
