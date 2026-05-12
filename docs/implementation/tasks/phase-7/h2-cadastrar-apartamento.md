# H2 — Síndico cadastra apartamento (e marca inadimplência)

## História

Como **síndico**, quero **cadastrar apartamentos do meu condomínio e marcar inadimplência** para **ter a base de unidades pronta antes de convidar moradores e criar votações**.

## Motivação / contexto de produto

Primeira história com aggregate de domínio novo (`Apartment`). Define o padrão que será replicado por H7/H8: aggregate + repository + service + controller + IT com RLS, frontend lista + form.

Spec [`docs/condo-vote-principles.md`](../../../condo-vote-principles.md) §Atores §Inadimplência. Data model [`docs/data-model.md`](../../../data-model.md) §Apartment (tabela já em V4). Invariante: `condominium_id` redundante na linha por design RLS (`CLAUDE.md` §Invariantes).

A flag `is_delinquent` é pré-requisito do snapshot de elegibilidade em H7 — sem UI para alternar, síndico ficaria preso em SQL manual. H7.0a absorvida aqui.

## Critérios de aceitação

- [ ] **Dado** síndico autenticado com tenant ativo **quando** chama `POST /api/condominiums/{id}/apartments` com `{ unitNumber, block, floor }` **então** retorna 201 + body do apartamento criado com `id` gerado server-side e `isDelinquent=false`.
- [ ] **Dado** síndico tenta criar apartamento com `(condominium_id, unit_number, block)` já existente **então** retorna 409 com mensagem clara (constraint `uq_apartment_unit`).
- [ ] **Dado** síndico autenticado **quando** chama `GET /api/condominiums/{id}/apartments` **então** retorna 200 com array (ordenado por block, unit_number).
- [ ] **Dado** síndico **quando** chama `PATCH /api/apartments/{id}/delinquent` body `{ isDelinquent: true }` **então** retorna 200 + flag atualizada; idempotente se já estava no estado pedido.
- [ ] **Dado** usuário sem role `MANAGER` no tenant **quando** chama qualquer endpoint acima **então** retorna 403.
- [ ] **Dado** usuário sem `X-Tenant-Id` **quando** chama qualquer endpoint **então** retorna 400 (interceptor já cobre).
- [ ] **Dado** apartamento criado **então** `audit_event` recebe linha `APARTMENT_CREATED` com payload `{ unitNumber, block }`.
- [ ] **Dado** flag toggled **então** `audit_event` recebe `APARTMENT_DELINQUENCY_CHANGED` com payload `{ from, to }`.

## Escopo técnico

### Backend

Arquivos a criar (espelhar padrão `com.condovote.condominium`):

- `backend/src/main/java/com/condovote/apartment/Apartment.java` — record `@Table("apartment")` com campos: `@Id UUID id`, `UUID condominiumId`, `String unitNumber`, `String block`, `Integer floor`, `boolean isDelinquent`, `UUID eligibleVoterUserId` (nullable), `Instant createdAt`.
- `backend/src/main/java/com/condovote/apartment/ApartmentRepository.java` — `extends CrudRepository<Apartment, UUID>` com `@Query` para `findByCondominiumId(UUID condoId)` ordenado.
- `backend/src/main/java/com/condovote/apartment/ApartmentService.java` — métodos `create`, `listByCondominium`, `setDelinquent`. Chama `AuditEventPublisher` na mesma transação. Mapeia `DuplicateKeyException` → `ConflictException` (existe em `shared`).
- `backend/src/main/java/com/condovote/apartment/ApartmentController.java` — `@RestController` rota base `/api`. Endpoints conforme critérios. `@PreAuthorize` (ou validação no service via `AuthGateway` + check explícito de role `MANAGER` — alinhado com padrão `condominium_admin`).
- `backend/src/main/java/com/condovote/apartment/dto/CreateApartmentRequest.java` — record com validações `@NotBlank unitNumber`, `@Size block`, `@Min(0) floor`.
- `backend/src/main/java/com/condovote/apartment/dto/ApartmentResponse.java` — record.
- `backend/src/main/java/com/condovote/apartment/dto/SetDelinquentRequest.java` — record `{ boolean isDelinquent }`.

Testes (todos obrigatórios — UT+IT por aggregate, CI bloqueia <70% no arquivo):

- `backend/src/test/java/com/condovote/apartment/ApartmentServiceTest.java` — mocks `ApartmentRepository` + `AuditEventPublisher` + `AuthGateway`. Cobre criar OK, listar OK, delinquent toggle OK, role check negativo.
- `backend/src/test/java/com/condovote/apartment/ApartmentControllerIT.java` — extends `AbstractIntegrationTest`. Cenários: 201 happy path, 409 duplicata, 200 lista, 200 toggle, 403 não-síndico. Use `@WithMockUser` ou JWT mockado conforme `CondominiumControllerIT`.

Sem migration nova — `V4__apartment_and_residents.sql` já tem schema.

### Frontend

Arquivos a criar (espelhar padrão `features/home/home.ts`):

- `frontend/src/app/features/apartments/apartments-page.ts` (+ `.html` + `.scss`) — smart component que consome service e usa `<app-apartment-list>` + `<app-apartment-form>`. Rota: `/condominiums/:id/apartments`.
- `frontend/src/app/features/apartments/apartment-list.ts` — dumb, recebe `apartments` via `@Input()`, emite `(toggleDelinquent)`.
- `frontend/src/app/features/apartments/apartment-form.ts` — dumb, Reactive Form com `<app-form-field>`, emite `(submit)`.
- `frontend/src/app/core/api/apartments-api.service.ts` — wrapper HTTP. Usa `tenantInterceptor` (deve incluir `X-Tenant-Id`).
- Adicionar rota em `frontend/src/app/app.routes.ts`.
- Adicionar link "Apartamentos" no `<app-app-header>` condicional a `tenantService.activeRoles().has('MANAGER')`.

Testes Vitest:
- `apartments-api.service.spec.ts` — mock HttpClient.
- `apartments-page.spec.ts` — render + signal updates.

### Cobertura técnica F1-F8 consumida

F5 (parte) — Apartment CRUD. `apartment_resident` fica para H3/H4.

## Fora de escopo

- Convidar morador para apartamento — fica em H3.
- Editar `unit_number` ou `block` de apartamento existente — fica para v2 (PATCH só para flags).
- Deletar apartamento — fica para v2 (precisa lidar com votos históricos).
- Endpoint `PATCH /apartments/{id}/eligible-voter` — fica em H6.
- Buscar apartamento por id individualmente — não necessário em v1.

## Tasks

- [ ] T2.1 — Backend: aggregate + repository + service + controller + DTOs
- [ ] T2.2 — UT `ApartmentServiceTest` + IT `ApartmentControllerIT` com Testcontainers
- [ ] T2.3 — Frontend: `apartments-api.service`, `apartments-page`, `apartment-list`, `apartment-form` + rota + link no header
- [ ] T2.4 — Vitest unitário do service + page
- [ ] T2.5 — `docs/features/h2-apartamento.md` criado (template no plano canônico)
- [ ] T2.6 — `./mvnw verify` + `npm run lint && npm run test:ci` verde local
- [ ] T2.7 — Smoke local: subir stack (`supabase start` + `docker compose up --build backend` + `npm start`) → criar apto via UI → ver na lista → toggle delinquent → confirmar audit_event no banco
- [ ] T2.8 — PR `feat/h2-apartamento → develop` via `gh pr create`
- [ ] T2.9 — Atualizar `docs/STATUS.md` (H2 ✅ + não-óbvios)

## Definition of Done

- [ ] Todos os critérios de aceitação verdes em IT
- [ ] Cobertura ≥ 70% nos arquivos alterados
- [ ] Spotless + JaCoCo + PMD CPD + ESLint + jscpd verdes
- [ ] `docs/features/h2-apartamento.md` no PR
- [ ] PR aberto contra `develop`
- [ ] Apêndice [`index.md`](index.md) marcado: F5 (parte) ✅

## Notas para o implementer (Sonnet 4.6)

1. Ler PRIMEIRO: `CLAUDE.md` §Invariantes, `docs/coding-patterns.md` §Backend e §Frontend, `backend/.../Condominium.java`, `CondominiumService.java`, `CondominiumController.java`, `MeControllerIT.java`, `frontend/src/app/features/home/home.ts`, `frontend/src/app/core/api/me-api.service.ts`.
2. `AuditEventPublisher` já existe em `com.condovote.shared.audit` (Pré-Wave 1) — injetar e chamar `publish("APARTMENT_CREATED", "apartment", id, Map.of(...))`.
3. Role check `MANAGER`: na ausência de `@PreAuthorize` configurado, fazer check explícito no service via query `SELECT 1 FROM condominium_admin WHERE condominium_id=? AND user_id=? AND revoked_at IS NULL` — alinhado com `CondominiumRepository`.
4. **Commit em português, imperativo curto. SEM `Co-Authored-By`.**
5. PR alvo `develop` via `gh pr create --base develop`.
