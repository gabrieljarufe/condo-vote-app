# H9 — Síndico vê timeline de auditoria do condomínio

## História

Como **síndico**, quero **ver a timeline de eventos do meu condomínio (apartamentos criados, convites, votações abertas/fechadas, votos)** para **acompanhar mudanças, auditar ações e investigar incidentes sem precisar abrir o banco**.

## Motivação / contexto de produto

Auditoria é exigência regulatória (Código Civil + LGPD § §accountability) e operacional. Sem UI, síndico precisa de pgAdmin / consulta direta no banco — não escala além do piloto.

Spec [`docs/condo-vote-principles.md`](../../../condo-vote-principles.md) §Auditoria. Data model [`docs/data-model.md`](../../../data-model.md) §audit_event. RLS já aplicada em V9; índice composto `(condominium_id, occurred_at DESC, id DESC)` adicionado na V8 (Pré-Wave 1) para cursor-based sem skip.

Esta história é **read-only sobre `audit_event`**. Eventos são populados pelos services de H2/H3/H4/H6/H7/H8 via `AuditEventPublisher` (Pré-Wave 1). H9 pode mergear ANTES das outras — vai mostrar timeline vazia, e ganha conteúdo conforme outras histórias mergeiam.

## Critérios de aceitação

- [ ] **Dado** síndico autenticado **quando** chama `GET /api/condominiums/{id}/audit?limit=50` **então** retorna 200 com `{ events: [...], nextCursor: "<occurredAt>_<id>" | null }` **ordenados do mais recente para o mais antigo** (`ORDER BY occurred_at DESC, id DESC`).
- [ ] **Dado** síndico **quando** chama com `?cursor=<previousNext>&limit=50` **então** retorna a próxima página (eventos com `(occurred_at, id) < cursor`), mantendo a ordenação descendente.
- [ ] **Dado** dois eventos com `occurred_at` idênticos (timestamps em bulk) **então** ordem entre eles é por `id DESC` — desempate determinístico, sem skip/dup na paginação.
- [ ] **Dado** síndico **quando** chama `GET /api/condominiums/{id}/audit?eventTypes=POLL_CREATED,VOTE_CAST&limit=50` **então** retorna apenas eventos cujos tipos estão na lista; vazio se nenhum tipo válido. Múltiplos valores separados por vírgula.
- [ ] **Dado** filtro com tipo inválido (não existente no enum `audit_event_type`) **então** retorna 400 com mensagem listando o(s) tipo(s) desconhecido(s).
- [ ] **Dado** filtro vazio ou ausente **então** retorna todos os tipos (comportamento default).
- [ ] **Dado** filtro ativo **quando** o usuário carrega "Mais resultados" **então** o cursor mantém o filtro entre páginas (filtro acompanha cada request).
- [ ] **Dado** condomínio sem eventos **então** retorna 200 com `events: []` e `nextCursor: null`.
- [ ] **Dado** usuário sem role MANAGER **quando** chama o endpoint **então** retorna 403 (RLS sozinha não distingue morador de síndico — check explícito necessário).
- [ ] **Dado** usuário tenta acessar audit de tenant que não é dele **então** RLS retorna lista vazia (sem 403 — comportamento padrão multi-tenant).
- [ ] **Dado** `limit > 100` **então** retorna 400 (proteção contra abuse).
- [ ] **Dado** cursor malformado **então** retorna 400.

## Escopo técnico

### Backend

Arquivos a criar:

- `backend/src/main/java/com/condovote/audit/AuditEvent.java` — record `@Table("audit_event")` com campos da V8 (id, condominium_id, actor_user_id, event_type, entity_type, entity_id, payload, occurred_at). `payload` é JSONB — mapear como `String` (controller serializa, frontend parseia) OU `JsonNode` se mais limpo.
- `backend/src/main/java/com/condovote/audit/AuditEventRepository.java` — Spring Data JDBC, com query custom:
  ```java
  @Query("""
    SELECT * FROM audit_event
    WHERE condominium_id = :condoId
      AND (:occurredAtCursor IS NULL OR (occurred_at, id) < (:occurredAtCursor, :idCursor))
      AND (:eventTypes::text[] IS NULL OR event_type::text = ANY(:eventTypes))
    ORDER BY occurred_at DESC, id DESC
    LIMIT :limit
    """)
  List<AuditEvent> findPage(UUID condoId, Instant occurredAtCursor, UUID idCursor,
                            String[] eventTypes, int limit);
  ```
  - `eventTypes` é `String[]` para evitar binding do enum no driver (mais simples). Service valida cada string contra `AuditEventType` enum antes de chamar repo; se inválido, lança `BadRequestException`.
  - Quando `eventTypes` é null ou vazio, condição passa (sem filtro).
- `backend/src/main/java/com/condovote/audit/AuditQueryService.java`:
  - `getPage(condoId, cursorString, eventTypesCsv, limit) → AuditPageResponse`
  - Parse cursor `"<occurredAt-ISO>_<uuid>"` → `(Instant, UUID)`. Null se ausente.
  - Parse `eventTypesCsv` (string separada por vírgula) → `String[]`. Valida cada elemento contra `AuditEventType` enum; tipo inválido → `BadRequestException` listando os inválidos. Lista vazia/null → sem filtro.
  - Valida limit ∈ [1, 100].
  - Valida role MANAGER (check explícito no `condominium_admin`).
  - Chama repo, mapeia para DTOs.
  - Calcula `nextCursor`: se retornou exatamente `limit` linhas, próximo cursor = `{last.occurredAt}_{last.id}`. Caso contrário, null. **Filtro acompanha cursor** — caller passa `eventTypes` em toda página subsequente.
- `backend/src/main/java/com/condovote/audit/AuditEventType.java` — enum Java espelhando exatamente os valores do enum SQL `audit_event_type` em V1. Usado para validar `eventTypes` no service e para o frontend listar opções (via endpoint auxiliar OU constantes hardcoded — preferir hardcoded em v1, alinhado com `quorum_mode` em H7).
- `backend/src/main/java/com/condovote/audit/AuditController.java` — `GET /api/condominiums/{id}/audit?cursor=&eventTypes=POLL_CREATED,VOTE_CAST&limit=`. Param `eventTypes` aceita CSV.
- DTOs: `AuditEventResponse(id, eventType, entityType, entityId, actorUserId, payload, occurredAt)`, `AuditPageResponse(events, nextCursor)`.

Testes:
- `backend/src/test/java/com/condovote/audit/AuditQueryServiceTest.java` — mocks repository. Cobre cursor parse válido/inválido, limit validation, role check, próximo cursor calculado corretamente, null no fim.
- `backend/src/test/java/com/condovote/audit/AuditControllerIT.java` — extends `AbstractIntegrationTest`. Inserir 5 eventos via `AuditEventPublisher` (ou direto via JdbcTemplate seguindo schema V8), chamar endpoint com limit=2, validar paginação cursor (3 chamadas para esvaziar), 403 sem role, 400 com cursor inválido.

### Frontend

- `frontend/src/app/features/audit/audit-timeline-page.ts` (+ html/scss) — smart:
  - Signals: `events: WritableSignal<AuditEvent[]>`, `nextCursor: WritableSignal<string | null>`, `selectedTypes: WritableSignal<Set<AuditEventType>>` (default vazio = todos).
  - Toolbar com `<app-audit-type-filter>` (multi-select de chips/checkboxes) e botão "Limpar filtros".
  - Quando `selectedTypes` muda → reset de `events` + `nextCursor` + chamada nova ao service passando o filtro atual.
  - Botão "Carregar mais" → chama service com `cursor=nextCursor()` + `eventTypes=selectedTypes()` e appendá página.
  - Rota `/condominiums/:id/audit`.
- `frontend/src/app/features/audit/audit-event-row.ts` — dumb, renderiza 1 evento (timestamp + tipo humanizado + ator + payload formatado).
- `frontend/src/app/features/audit/audit-type-filter.ts` — dumb, recebe lista de tipos disponíveis + Set selecionado via `@Input()`, emite `(selectionChange)` com novo Set. UI: chips clicáveis (selecionado = preenchido). Mostra contador "N tipos selecionados" ou "Todos".
- `frontend/src/app/core/api/audit-api.service.ts` — `getPage(condoId, opts: { cursor?: string; eventTypes?: AuditEventType[]; limit?: number }) → Observable<AuditPage>`. Serializa `eventTypes` como CSV no query param.
- `frontend/src/app/core/api/audit-event-type.ts` — const array com labels PT-BR para cada `AuditEventType` (`APARTMENT_CREATED → "Apartamento criado"` etc.), reutilizado pelo filtro e pelo row.
- Rota + link "Auditoria" no header condicional a MANAGER.

Map de `event_type` → label humanizado (em PT):
- `APARTMENT_CREATED` → "Apartamento criado"
- `APARTMENT_DELINQUENCY_CHANGED` → "Inadimplência alterada"
- `POLL_CREATED` → "Votação criada"
- `POLL_CLOSED` → "Votação encerrada"
- `VOTE_CAST` → "Voto registrado"
- ... resto conforme enum V1

Renderização do `payload` (JSONB): no v1, mostrar como `<pre>` com JSON pretty-printed. v2 pode ter renderer por tipo.

### Cobertura técnica F1-F8

F7 — auditoria UI read-only. Completa.

## Fora de escopo

- Filtros por autor (`actor_user_id`) — v2.
- Filtro por intervalo de datas (date range picker) — v2.
- Busca por texto livre no payload — v2 (precisaria de tsvector + índice GIN).
- Export CSV — v2.
- Renderização rica por tipo (cards com avatar do ator etc.) — v2; v1 é `<pre>` do payload.
- Retenção / pruning de eventos antigos — H10 (`RetentionPrunerJob` placeholder, política LGPD ainda não definida).
- Notificações de eventos em tempo real (SSE/websocket) — v2.

## Tasks

- [ ] T9.1 — Backend: aggregate + repository com query cursor+filtro + service (parse cursor + parse eventTypes CSV + validação enum) + controller + DTOs + `AuditEventType` enum Java
- [ ] T9.2 — UT `AuditQueryServiceTest` cobrindo cursor parse, filtro vazio, filtro válido, filtro inválido → 400, role check
- [ ] T9.3 — IT `AuditControllerIT` com inserção manual de eventos de 3 tipos diferentes, paginação multi-página, filtro reduz resultado, filtro mantido entre páginas
- [ ] T9.4 — Frontend: page + row + service + filter chip component + labels PT-BR + rota
- [ ] T9.5 — Vitest do service (mock HttpClient) + filter component (selectionChange) + page (filtro reseta paginação)
- [ ] T9.6 — `docs/features/h9-auditoria.md`
- [ ] T9.7 — `./mvnw verify` + `npm run lint && npm run test:ci` verde
- [ ] T9.8 — Smoke local: inserir evento via `AuditEventPublisher` (ou aguardar primeiro evento real de H2) → abrir UI → ver linha
- [ ] T9.9 — PR `feat/h9-audit-timeline → develop`
- [ ] T9.10 — `docs/STATUS.md` atualizado

## Definition of Done

- [ ] Critérios de aceitação verdes em IT
- [ ] Cobertura ≥ 70% nos arquivos alterados
- [ ] Quality gates verdes
- [ ] `docs/features/h9-auditoria.md` no PR
- [ ] PR `feat/h9-audit-timeline` aberto contra `develop`
- [ ] Apêndice marcado: F7 ✅

## Notas para o implementer (Sonnet 4.6)

1. Ler PRIMEIRO: `backend/src/main/resources/db/migration/V8__audit_and_notifications.sql` (schema + índice composto cursor já adicionado), `V9__rls_policies.sql` (policy `audit_event` já existe), `AuditEventPublisher.java`, `Condominium.java`, `CondominiumService.java`.
2. **Cursor format**: usar `<ISO-8601 instant>_<UUID>` separado por `_`. Parse defensivo — qualquer formato inválido → 400.
3. **RLS é multi-tenant, NÃO role-based.** Cheque MANAGER no service via `SELECT 1 FROM condominium_admin WHERE ...` antes de chamar repo. Sem isso, morador veria timeline do próprio condomínio.
4. Spring Data JDBC mapeando JSONB para `String`: anotar campo `payload` com nada especial — JDBC driver default já entrega como String. Se houver problema, usar `org.springframework.data.relational.core.mapping.Column` para customizar.
5. **Commit em português. SEM `Co-Authored-By`.** PR contra `develop`.
