# H7 — Síndico cria votação (lifecycle completo)

## Problema da jornada (antes)

O síndico não tinha como criar votações pela interface. Sem isso, o produto não cumpre seu propósito central: deliberações coletivas ficavam dependentes de assembleia presencial ou planilha paralela, sem rastreabilidade nem garantia de quórum. Não havia também como fixar o universo eleitoral no momento da abertura — mudanças de inadimplência ou de morador durante a votação podiam alterar quem podia votar, abrindo brecha para contestação.

## Solução (depois)

O síndico cria votações pela UI com ciclo de vida completo:
- **Rascunho** (DRAFT) para iniciar com calma e revisar antes de publicar.
- **Agendada** (SCHEDULED) com início e fim definidos — automaticamente abre na hora marcada via job, ou pode ser aberta manualmente antes do horário.
- **Aberta** (OPEN) gera o snapshot de elegibilidade imutável (todos os apartamentos não-inadimplentes com votante habilitado naquele instante). Snapshot é write-once protegido por trigger SQL.
- **Encerrada** (CLOSED ou INVALIDATED) automaticamente ao atingir a data de fim, ou manualmente pelo síndico. Resultado calculado conforme convocação (Primeira/Segunda) e modo de quórum (Maioria simples / Maioria absoluta / Qualificado 2/3 / Qualificado 3/4).
- **Cancelada** (CANCELLED) com motivo obrigatório (mínimo 10 caracteres), preservando votos já registrados para auditoria.

Toda transição é registrada em `audit_event` (POLL_CREATED, POLL_UPDATED, POLL_SCHEDULED, POLL_OPENED_MANUALLY, POLL_OPENED_AUTO, POLL_CLOSED, POLL_INVALIDATED, POLL_CANCELLED).

## Como usar

### Criar votação

1. Faça login como síndico e selecione o condomínio.
2. Clique em **Votações** no cabeçalho (visível apenas para síndicos) ou no tile do dashboard.
3. Clique em **+ Nova votação**.
4. Preencha:
   - **Título** (obrigatório).
   - **Descrição** (opcional).
   - **Convocação**: Primeira (exige quórum de presença ≥ 50%) ou Segunda (sem quórum de presença).
   - **Modo de quórum**: Maioria simples, Maioria absoluta, 2/3 qualificada ou 3/4 qualificada.
   - **Início agendado** e **fim agendado** (datetime-local).
   - **Opções** (mínimo 2, máximo 10) — labels não-duplicados.
5. Clique em **Criar rascunho** — você é redirecionado para a tela de detalhe da votação em DRAFT.

### Publicar e abrir

- Em DRAFT: clique em **Publicar** → status muda para SCHEDULED. O job `PollOpenerJob` (a cada 5min) abre a votação automaticamente ao atingir `scheduled_start`.
- Em SCHEDULED, antes do horário: clique em **Abrir agora** para forçar abertura manual — gera o snapshot na hora.
- Se a abertura falhar (nenhum apartamento elegível: todos inadimplentes ou sem votante habilitado), a UI mostra "Não há eleitores elegíveis para abrir a votação".

### Editar

- Em DRAFT ou SCHEDULED, clique em **Editar** — você pode alterar todos os campos (título, descrição, opções, datas, quórum, convocação). Opções são substituídas integralmente (delete + insert).
- Em OPEN, CLOSED, INVALIDATED ou CANCELLED: edição bloqueada.

### Cancelar

- Em DRAFT, SCHEDULED ou OPEN: clique em **Cancelar**, informe motivo (10 a 500 caracteres) e confirme.
- O motivo fica registrado em `poll.cancellation_reason` e no payload do `audit_event POLL_CANCELLED`.

### Encerrar

- Em OPEN: clique em **Encerrar** para fechar manualmente.
- O job `PollCloserJob` (5min) fecha automaticamente ao atingir `scheduled_end`.
- Em ambos os casos, o `PollResultCalculator` decide o desfecho:
  - **CLOSED**: uma opção atingiu o limiar exigido pelo modo de quórum (vencedora declarada).
  - **INVALIDATED**: quórum de presença não atingido (FIRST) ou nenhuma opção atingiu o limiar.

## O que já foi validado em smoke

- ✅ Backend: 120 ITs (Testcontainers) verdes, incluindo:
  - Lifecycle completo via PollControllerIT (31 cenários cobrindo todos os endpoints, RLS cross-tenant, trigger write-once do snapshot, 401/403/409/422 conforme spec).
  - Jobs `PollOpenerJob` e `PollCloserJob` abrindo/fechando polls automaticamente em ITs com 2 condos simultâneos.
  - 198 UTs incluindo `PollResultCalculatorTest` com 17 cenários cobrindo SIMPLE/ABSOLUTE/QUALIFIED × FIRST/SECOND × vencedor/empate/sem quórum.
- ✅ Frontend: 237 testes Vitest verdes, ESLint zero warnings.
- ✅ `./mvnw verify` no worktree (BUILD SUCCESS + JaCoCo + CPD).

## O que ainda falta testar (smoke manual prod-like)

- ⏳ **End-to-end no stack local** (`supabase start` + `docker compose up --build backend` + `npm start`):
  - Criar DRAFT, editar opções/datas/quórum, publicar, abrir manualmente, ver snapshot populado, cancelar com motivo.
  - Criar DRAFT, publicar com `scheduled_start` próximo (+2min), aguardar `PollOpenerJob` abrir, aguardar `PollCloserJob` fechar com 0 votos → INVALIDATED.
  - Validar que F5 (refresh) preserva navegação dentro de `/app/condominiums/:id/polls`.
- ⏳ **Trigger write-once em prod** — confirmar manualmente via psql: `UPDATE poll_eligible_snapshot SET apartment_id='...' WHERE id='...'` deve falhar.
- ⏳ **Smoke E2E em produção** após merge — criar poll real no condomínio piloto Pitufos.
- ⏳ **Comportamento com calculadora real de quórum** — em H7 todos os fechamentos resultam em INVALIDATED por 0 votos (esperado). Os caminhos CLOSED com vencedor só serão exercitados em produção depois que H8 (registrar voto) estiver no ar.

## Pendências e bugs conhecidos não bloqueantes

- **Breakdown por opção no resultado** está renderizado como placeholder ("Detalhe do voto disponível em H8/H9"). O `PollResult.optionsBreakdown` JSONB já é populado pelo backend; falta UI exibir a tabela.
- **ShedLock para jobs `@Scheduled`** fica para v2 (alinhado com `InvitationExpirerJob`/`EmailSenderJob`/Bucket4j da H4 — backend v1 é single-instance).
- **Edição em DRAFT/SCHEDULED**: opções são deletadas e re-inseridas a cada update (não tem diff). Funciona; impacto só se a coluna `poll_option.id` for referenciada em algum lugar futuro (em DRAFT/SCHEDULED não há votos, então sem impacto agora).
- **Sem detalhamento de votos por apartamento na UI do síndico** — auditoria voto-a-voto é H9.

## Pré-requisitos para o teste em produção

- Migration V12 + V13 aplicadas (parte do mesmo PR; Flyway aplica em ordem).
- Pelo menos 1 apartamento por condomínio com `eligible_voter_user_id != NULL` e `is_delinquent = false`. Senão a abertura da poll retorna 422.
- Síndico autenticado (Supabase Auth) com role `condominium_admin` no condomínio alvo (igual H2/H3/H4/H5).

## Endpoints / rotas

- Backend:
  - `POST /api/condominiums/{condoId}/polls` — cria DRAFT
  - `PUT /api/polls/{id}` — edita DRAFT/SCHEDULED
  - `POST /api/polls/{id}/publish` — DRAFT → SCHEDULED
  - `POST /api/polls/{id}/open` — SCHEDULED → OPEN (manual)
  - `POST /api/polls/{id}/cancel` — DRAFT/SCHEDULED/OPEN → CANCELLED
  - `POST /api/polls/{id}/close` — OPEN → CLOSED/INVALIDATED (manual)
  - `GET /api/condominiums/{condoId}/polls?status=&page=&size=` — lista paginada com filtro
  - `GET /api/polls/{id}` — detalhe com options + result
- Frontend (todas em `/app/condominiums/:condoId/polls/**`, protegidas por `tenantRestoreGuard + adminGuard`):
  - `/polls` — lista
  - `/polls/new` — criar
  - `/polls/:pollId` — detalhe com ações condicionais
  - `/polls/:pollId/edit` — editar (só DRAFT/SCHEDULED)

## Referências

- Spec: `docs/condo-vote-principles.md` §5 (Ciclo de votação), §6 (Quórum), §7 (Opções)
- Data model: `docs/data-model.md` §poll, §poll_eligible_snapshot, §poll_result, §audit_event
- História canônica: `docs/implementation/tasks/phase-7/h7-criar-votacao.md`
- Migrations: `V7__poll_domain.sql` (schema + triggers write-once + immutable vote), `V12__poll_lifecycle_support.sql` (enum values + index), `V13__poll_manual_close_trigger.sql` (`MANUAL` em `poll_close_trigger`)
