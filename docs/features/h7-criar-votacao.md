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

## Roteiro de smoke manual (E2E)

Roteiro acionável para validar H7 ponta-a-ponta no stack local antes de mergear em prod. Cada passo tem ação concreta, resultado esperado e como validar. Passos que dependem de H8 (registrar voto) estão no Bloco 8 marcados como `⏳ TODO` — destravar quando H8 entrar.

### Pré-requisitos do ambiente

```bash
# 1. Supabase local (banco + auth)
cd infra/supabase && supabase start

# 2. Backend + Redis via docker compose
cd backend && docker compose up --build backend

# 3. Frontend dev server
cd frontend && npm install && npm start
```

Dados necessários (rodar via `infra/supabase/supabase/seed.sql` ou bootstrap):
- Síndico bootstrapado (seed local: `sindico@local.dev` / `password123`, condomínio Pitufos `019dd4f8-57fa-77b1-ace2-c9f6a3d9811e`).
- Pelo menos **2 apartamentos** com `eligible_voter_user_id != NULL` e `is_delinquent = false` (para snapshot >1 e ainda sobrar elegível após marcar 1 como inadimplente).
- Pelo menos **1 apartamento marcado como inadimplente** via UI (PATCH `/apartments/{id}/delinquent`) — valida exclusão do snapshot.
- Bruno collection rodando `auth/get-token.bru` para acessar `{{access_token}}` ao chamar endpoints diretamente.
- Acesso ao psql local: `psql postgresql://postgres:postgres@localhost:54322/postgres` (porta default do Supabase CLI).

> **Como obter o UUID da poll para queries SQL:** após criar via UI, copiar o trecho de URL `/polls/{uuid}`. Substituir `:pollId` nas queries abaixo.

### Bloco 1 — Criar e editar DRAFT

| # | Ação | Onde | Resultado esperado | Como validar |
|---|---|---|---|---|
| 1.1 | Login como síndico, clicar tile "Votações" no dashboard | UI | Lista vazia ou polls anteriores aparecem | URL muda para `/app/condominiums/:id/polls` |
| 1.2 | Clicar "+ Nova votação" | UI | Form em branco em `/polls/new` | URL muda |
| 1.3 | Preencher: título "Pintura da fachada", descrição "Verde ou bege?", convocação Primeira, modo Maioria absoluta, início = agora+2min, fim = agora+5min, opções ["Verde","Bege"]. Clicar "Criar rascunho" | UI | Redireciona para detalhe, badge "Rascunho" (cinza) | URL muda para `/polls/{uuid}` |
| 1.4 | Voltar para lista | UI | Poll aparece com badge "Rascunho" | Filtro "Rascunho" retorna a poll |
| 1.5 | Confirmar audit_event gravado | psql | 1 linha `POLL_CREATED` com payload `{title, optionsCount: 2, ...}` | `SELECT event_type, payload FROM audit_event WHERE entity_id='<pollId>' ORDER BY occurred_at;` |
| 1.6 | Detalhe da poll → "Editar" → trocar título para "Pintura — votação", adicionar 3ª opção "Azul", salvar | UI | PUT 200, redireciona para detalhe atualizado | Detalhe mostra 3 opções |
| 1.7 | Confirmar substituição de options | psql | 3 linhas em `poll_option` ordenadas por `display_order` | `SELECT label, display_order FROM poll_option WHERE poll_id='<pollId>' ORDER BY display_order;` |
| 1.8 | Audit `POLL_UPDATED` gravado | psql | Linha adicional no audit_event | Mesma query do 1.5 |

### Bloco 2 — Publicar e abrir manualmente

| # | Ação | Resultado esperado | Como validar |
|---|---|---|---|
| 2.1 | Detalhe da poll → "Publicar" | Status = "Agendada" (badge azul), botões mudam para `Editar / Abrir agora / Cancelar` | UI |
| 2.2 | Audit gravado | `POLL_SCHEDULED` na timeline | Query audit |
| 2.3 | Clicar "Abrir agora" (não esperar o job) | Status = "Aberta" (badge verde), `eligibleCount` populado, info "Aberta em" preenchida | UI |
| 2.4 | Snapshot populado | Nº de linhas = nº de apartamentos elegíveis (não-inadimplentes com voter habilitado) | `SELECT count(*) FROM poll_eligible_snapshot WHERE poll_id='<pollId>';` |
| 2.5 | Snapshot **exclui** apartamento inadimplente | O apartamento marcado como inadimplente NÃO está no snapshot | `SELECT s.apartment_id, a.unit_number, a.is_delinquent FROM poll_eligible_snapshot s JOIN apartment a ON a.id=s.apartment_id WHERE s.poll_id='<pollId>';` — nenhuma linha com `is_delinquent=true` |
| 2.6 | Audit `POLL_OPENED_MANUALLY` com `snapshotSize` no payload | Linha registrada | Query audit |
| 2.7 | **Trigger write-once**: tentar UPDATE direto no snapshot | Falha com `Trigger ...write-once...` | `UPDATE poll_eligible_snapshot SET apartment_id=gen_random_uuid() WHERE poll_id='<pollId>';` deve retornar erro |

### Bloco 3 — Abertura automática via job

Use uma nova poll (não reuse a do Bloco 2 que já está OPEN).

| # | Ação | Resultado esperado | Como validar |
|---|---|---|---|
| 3.1 | Criar DRAFT + publicar com `scheduled_start` ≈ agora+1min | Status = SCHEDULED | UI + SQL |
| 3.2 | Esperar até 6 minutos (job: `fixedDelay=5min`) sem mexer | Status muda sozinho para OPEN após o tick do job | F5 na UI mostra "Aberta" |
| 3.3 | Audit `POLL_OPENED_AUTO` com `actor_user_id = '00000000-0000-0000-0000-000000000001'` (SystemUser) | Linha registrada | Query audit |
| 3.4 | Log do backend confirma execução | Linha `PollOpenerJob: N abertas, 0 falhas` | `docker compose logs backend 2>&1 \| grep PollOpenerJob` |

### Bloco 4 — Cancelar

| # | Ação | Resultado esperado | Como validar |
|---|---|---|---|
| 4.1 | Detalhe de poll DRAFT/SCHEDULED/OPEN → "Cancelar" | Modal de confirmação abre | Overlay |
| 4.2 | Digitar motivo com < 10 caracteres → tentar confirmar | Botão "Confirmar cancelamento" fica desabilitado | UI |
| 4.3 | Digitar motivo "Decisão revogada pela administração" (>10 chars) | Botão habilita | UI |
| 4.4 | Confirmar | Status = "Cancelada" (badge vermelho), motivo aparece no detalhe | UI |
| 4.5 | Audit `POLL_CANCELLED` com `reason` e `previousStatus` no payload | Linha registrada | Query audit |
| 4.6 | Tentar cancelar novamente via Bruno (`POST /api/polls/{id}/cancel`) | 409 Conflict | Status code da resposta |

### Bloco 5 — Encerrar (manual e automático)

| # | Ação | Resultado esperado | Como validar |
|---|---|---|---|
| 5.1 | Em poll OPEN (convocação FIRST, sem votos) → "Encerrar" | Status = "Invalidada" (badge âmbar) — quórum de presença não atingido (0 < ceil(snapshot/2)) | UI |
| 5.2 | Detalhe mostra motivo de invalidação | Texto "Quórum de presença não atingido" | UI |
| 5.3 | `poll_result` inserido | 1 linha com `outcome='INVALIDATED'`, `invalidation_reason='PRESENCE_QUORUM_NOT_REACHED'`, `total_votes=0` | `SELECT outcome, invalidation_reason, total_votes FROM poll_result WHERE poll_id='<pollId>';` |
| 5.4 | Audit `POLL_INVALIDATED` com `automatic=false` no payload | Linha registrada | Query audit |
| 5.5 | Criar nova poll OPEN com `scheduled_end` ≈ agora+1min e esperar **passar do horário + tick do job** (até 6min) | Status muda sozinho para "Invalidada" | F5 + log `PollCloserJob` |
| 5.6 | Audit `POLL_INVALIDATED` com `automatic=true` | Linha registrada | Query audit |

### Bloco 6 — Listagem, filtros e paginação

| # | Ação | Resultado esperado | Como validar |
|---|---|---|---|
| 6.1 | Após Blocos 1-5, lista mostra várias polls em status diferentes | Tudo aparece | UI |
| 6.2 | Filtrar por status "Rascunho" | Só DRAFT aparece | UI + URL query `?status=DRAFT` |
| 6.3 | Filtrar por status "Cancelada" | Só CANCELLED aparece | UI |
| 6.4 | Com 11+ polls totais, trocar size do paginador para 10 | Paginação aparece (≥ 2 páginas) | UI |
| 6.5 | Clicar "Próxima página" | Carrega 2ª página com itens diferentes | UI |

### Bloco 7 — Cross-tenant (RLS)

| # | Ação | Resultado esperado | Como validar |
|---|---|---|---|
| 7.1 | Trocar de condomínio via "Trocar" no header (precisa estar admin em 2+ condos) | Lista de polls do outro condo carrega; polls do anterior somem | UI |
| 7.2 | Com tenant atual = condo B, tentar `GET /api/polls/{idDeCondoA}` via Bruno (mantendo `X-Tenant-Id` = condo B) | 403 Forbidden | Status code |

### Bloco 8 — Integração com H8 (placeholders)

> ⏳ **TODO — todos os passos abaixo dependem da H8 (registrar voto).** Manter aqui para destravar quando H8 entrar — basta substituir os ⏳ por instruções concretas. Bloco 8 NÃO bloqueia merge da H7 em prod.

| # | Ação | Resultado esperado | Como validar |
|---|---|---|---|
| 8.1 | ⏳ TODO Login como morador (votante habilitado de apto no snapshot de uma poll OPEN) | Morador vê poll OPEN na sua área | UI (H8) |
| 8.2 | ⏳ TODO Votar em uma opção | Voto registrado, UI confirma sucesso | UI + `SELECT count(*) FROM vote WHERE poll_id=?` |
| 8.3 | ⏳ TODO Tentar votar de novo no mesmo apartamento | 409 (regra 1 voto por apartamento) | UI/HTTP |
| 8.4 | ⏳ TODO Tentar votar como morador de apto inadimplente ou sem voter habilitado | 403 (apartamento não está no snapshot) | UI/HTTP |
| 8.5 | ⏳ TODO Como síndico: criar poll SIMPLE_MAJORITY com 3 elegíveis, registrar 2 votos na mesma opção, encerrar | Status = CLOSED, `winningOptionId` populado em `poll_result` | UI + `SELECT outcome, winning_option_id FROM poll_result WHERE poll_id=?` |
| 8.6 | ⏳ TODO Detalhe da poll CLOSED mostra vencedor + breakdown real por opção | Tabela com % por opção (substitui o placeholder atual "Detalhe do voto disponível em H8/H9") | UI |
| 8.7 | ⏳ TODO Criar poll com empate exato (2 opções com mesmo nº de votos atingindo limiar) e encerrar | Status = INVALIDATED, `invalidation_reason='NO_OPTION_REACHED_THRESHOLD'` | SQL + UI |
| 8.8 | ⏳ TODO Auto-close quando todos os apartamentos do snapshot votarem (se H8 implementar essa transição) | Status muda para CLOSED ao último voto, antes de `scheduled_end` | UI + log |

### Critérios de aprovação

- ✅ **Blocos 1-7 todos verdes** em ambiente local = H7 funcionalmente pronta para prod.
- ⏳ Bloco 8 fica pendente até H8 entrar — não bloqueia merge da H7 em main.
- 🚨 Qualquer passo dos Blocos 1-7 falhando = blocker (não mergear PR antes de resolver).

### Manutenção deste roteiro

Quando H8 entrar:
1. Substituir os ⏳ TODO do Bloco 8 por instruções concretas com queries SQL específicas.
2. Espelhar Bloco 8 (ou referência cruzada) em `docs/features/h8-votar.md` quando o arquivo for criado.

Quando H6 entrar:
3. Adicionar Bloco 9 cobrindo "delegação/promoção bloqueada durante poll OPEN" (invariante do domínio).

## O que ainda falta testar fora do roteiro

- ⏳ **Smoke E2E em produção** após merge em main — repetir Blocos 1-7 no condomínio piloto Pitufos em `condovote.com.br`.
- ⏳ **Comportamento dos jobs com mais de 1 réplica do backend** — ShedLock fica para v2; documentar limitação se Coolify for escalado.

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
