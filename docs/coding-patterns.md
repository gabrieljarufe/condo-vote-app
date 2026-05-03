# Coding Patterns — Condo Vote

> Como escrever código neste projeto. Decisões de sistema vivem em
> [`architecture.md`](architecture.md) §2 (estrutura de packages) e §9 (observabilidade);
> este doc cobre como traduzir essas decisões em código.
> Exemplos referenciam código real do repo.

## Como usar este documento

- Antes de criar uma feature nova, leia a seção correspondente.
- Se um pattern aqui conflita com o que você está prestes a escrever, pare e discuta —
  não invente uma terceira via silenciosa (foi assim que T3.6 virou exceção antes do refactor).

---

## Backend (Spring Boot 4 + Java 21)

### 1. Camadas: Controller → Service → Repository

Princípio: cada camada tem uma responsabilidade. SQL nunca sai da camada Repository.

#### 1.1 Controller (thin)

- `@RestController`, recebe DTO, valida com `@Valid`, delega ao Service, devolve DTO/record.
- Não chama Repository diretamente. Não trata exceção (`GlobalExceptionHandler` cuida).
- Exemplo canônico: `backend/src/main/java/com/condovote/condominium/CondominiumController.java`

#### 1.2 Service (orquestra)

- Lógica de domínio: combinar Repositories, aplicar regras, chamar `AuthGateway`, enfileirar emails.
- Sem SQL. Sem `JdbcTemplate`. Sem `@Query`.
- `@Transactional` aqui (não no Controller, não na Repository) — a transação define o escopo
  do `SET LOCAL app.current_tenant` aplicado pelo `TenantTransactionAspect`.
- Exemplo canônico: `backend/src/main/java/com/condovote/condominium/CondominiumService.java`

#### 1.3 Repository (Spring Data JDBC)

**Interface pública** em `com.condovote.<feature>`, estende `CrudRepository<Aggregate, UUID>` (ou
`PagingAndSortingRepository` quando precisar de paginação).

**Sem classe de impl** — Spring Data JDBC gera o proxy. Para queries complexas, anotar o método
com `@Query("...")` (SQL nativo, sem JPQL).

**CRUD grátis:** `save`, `findById`, `findAll`, `existsById`, `count`, `deleteById`.

**Derived queries** quando o nome do método define a intenção:
```java
List<Condominium> findByName(String name);
boolean existsByApartmentIdAndPollId(UUID aptId, UUID pollId);
```

**Queries complexas** (UNION, CTE, window functions, projeções customizadas) com `@Query`:
```java
@Query("""
        WITH user_roles AS (
            SELECT condominium_id, 'ADMIN' AS role
            FROM condominium_admin
            WHERE user_id = :userId AND revoked_at IS NULL
            UNION
            SELECT condominium_id, role::text
            FROM apartment_resident
            WHERE user_id = :userId AND ended_at IS NULL
        ),
        grouped AS (
            SELECT condominium_id, COUNT(*) AS role_count, MIN(role) AS single_role
            FROM user_roles GROUP BY condominium_id
        )
        SELECT c.id, c.name,
            CASE WHEN g.role_count > 1 THEN 'MULTIPLE' ELSE g.single_role END AS role
        FROM grouped g JOIN condominium c ON c.id = g.condominium_id
        ORDER BY c.name
        """)
List<CondominiumSummary> findSummariesForUser(@Param("userId") UUID userId);
```

Exemplo canônico completo: `backend/src/main/java/com/condovote/condominium/CondominiumRepository.java`

**Projeções de leitura (DTO):** records no pacote da feature. Spring Data JDBC mapeia o
`ResultSet` direto no construtor do record — a ordem das colunas no SELECT deve casar com
a ordem dos parâmetros do construtor.

**Aggregate root** mapeado com `@Table("nome_tabela")` e `@Id` no campo PK. Sem `@Entity`
(isso é JPA) — Spring Data JDBC usa annotations de `org.springframework.data.relational.core.mapping`:

```java
@Table("condominium")
public record Condominium(
        @Id UUID id,
        String name,
        String address,
        Instant createdAt
) {}
```

Exemplo canônico: `backend/src/main/java/com/condovote/condominium/Condominium.java`

#### 1.4 Quando NÃO usar Spring Data JDBC interface

Dois casos onde um `@Repository` concreto (classe com `JdbcTemplate`) é mais honesto:

1. **Consultas de infraestrutura transversal sem aggregate próprio** — ex: `TenantMembershipRepository`
   em `shared/tenant/` valida pertencimento user × tenant sem gerenciar nenhum aggregate.
   Uma interface Spring Data JDBC exigiria um tipo de entidade artificial.
   `backend/src/main/java/com/condovote/shared/tenant/TenantMembershipRepository.java`

2. **SQL de configuração de sessão** — ex: `TenantTransactionAspect` executa
   `SET LOCAL app.current_tenant`. Não é leitura/escrita de aggregate; é configuração da
   conexão corrente. `JdbcTemplate` injetado direto no Aspect é o lugar correto.
   `backend/src/main/java/com/condovote/shared/tenant/TenantTransactionAspect.java`

---

### 2. DTOs, records e aggregates

- **Records** para DTOs de request/response e projeções de leitura (`CondominiumSummary`, `ApiError`).
- **Aggregates** (Spring Data JDBC `@Table`):
  - Records imutáveis quando a entidade é factual e não tem comportamento
    (`Vote`, `AuditEvent` — write-once por design do domínio).
  - Classes mutáveis com construtor privado + factory + métodos de negócio quando o aggregate
    tem ciclo de vida (`Poll` com `open()`, `close()`, `cancel(reason)`;
    `Invitation` com `accept()`, `revoke(userId)`, `isExpired()`).
- **Sem `@Entity`** — isso é JPA. Spring Data JDBC usa `@Table`, `@Id`, `@Column` de
  `org.springframework.data.relational.core.mapping`.
- Métodos de negócio vivem no aggregate (`poll.canBeOpened()`), não no Service.
  Service orquestra; aggregate decide.
- **Aggregate root awareness:** Spring Data JDBC trata entidades alcançáveis a partir do root
  como parte do mesmo aggregate. Regra prática: 1 `*Repository` por aggregate root
  (`Poll`, `Apartment`, `Condominium`, `Invitation`), não 1 por tabela.

---

### 3. Pacotes (DDD-lite, package by feature)

Já decidido em `architecture.md` §2. Reforço aqui: tudo de uma feature mora junto.
Sem `controllers/`, `services/`, `repositories/` globais.

Visibilidade: interface Repository **public**, demais classes **package-private** quando
só o Controller da própria feature as consome.

---

### 4. Multi-tenant + RLS

- Toda query de tabela com `condominium_id` roda dentro de `@Transactional` para que
  `TenantTransactionAspect` injete `SET LOCAL app.current_tenant` antes.
- Repositories **não** anotam `@Transactional` — o Service que orquestra é dono da transação.
- Queries cross-tenant (ex: `CondominiumRepository.findSummariesForUser`) rodam sem
  `X-Tenant-Id` e usam `WHERE user_id = ?` — a tabela `condominium` não tem política RLS
  dependente de tenant (ver `docs/data-model.md`).

---

### 5. Exception handling

Já implementado em T3.5. Ver `GlobalExceptionHandler` + `ApiError` record em
`backend/src/main/java/com/condovote/shared/exception/`.

- Service lança `ForbiddenException` / `NotFoundException`. Nunca `RuntimeException` genérico.
- Para conflitos de integridade, `DataIntegrityViolationException` do Spring é capturada
  automaticamente e convertida em 409.
- Validação de input (`@Valid`) → `MethodArgumentNotValidException` → 400 com lista de campos.

---

### 6. Testing

- **Unit tests** (`*Test.java`): testam Service mockando Repository (interface é trivial de
  mockar com Mockito). Rápidos, sem Spring context.
- **Integration tests** (`*IT.java`): estendem `AbstractIntegrationTest` (Singleton
  Testcontainers Postgres). Testam Controller → Service → Repository → DB real.
- Cada nova rota merece pelo menos 1 IT no happy path + 1 IT de RLS/autorização quando aplicável.
- **Repository isolado:** teste IT validando SQL real é especialmente importante para
  `@Query("SELECT ...")` escritas à mão (alto risco de bug); derived queries são geradas
  pelo Spring (baixo risco). Cobrir `@Query` manualmente com prioridade.

---

### 7. Logging e observabilidade

Decidido em `architecture.md` §9 (JSON structured + MDC). Pattern aqui:

- `Logger` por classe: `LoggerFactory.getLogger(getClass())`. Nunca `System.out`.
- Logar **decisões**, não fluxo: `"poll opened manually by sindico={}"` sim;
  `"entering method foo()"` não.

---

### 8. Naming

| Elemento | Convenção | Exemplo |
|----------|-----------|---------|
| Controller | `<Feature>Controller` | `CondominiumController` |
| Service | `<Feature>Service` | `CondominiumService` |
| Repository (interface) | `<Feature>Repository` | `CondominiumRepository` |
| Aggregate | nome do conceito de domínio | `Condominium`, `Poll` |
| Record de projeção | substantivo | `CondominiumSummary` (não `CondominiumDto`) |
| Exception | `<Domain>Exception` | `ForbiddenException` |
| Método Repository | verbo + critério em domínio | `findActivePollsForCondominium` |

---

## Frontend (Angular 20+)

> Frontend ainda não foi implementado (Fase 4). Esta seção define os patterns
> antes do primeiro código para evitar o mesmo desvio que aconteceu no backend.

### 1. Componentes

- **Standalone components** (default no v20). Não criar NgModule.
- `ChangeDetectionStrategy.OnPush` em todo `@Component`.
- `input()` e `output()` (funções), nunca decorators `@Input`/`@Output`.
- `computed()` para estado derivado.
- Templates: `@if`, `@for`, `@switch` (não `*ngIf`/`*ngFor`).
- Bindings: `[class.x]`, `[style.x]` (não `ngClass`/`ngStyle`).

### 2. Estado

- **Signals** para estado local de componente. Sem `BehaviorSubject` para esse caso.
- Sem biblioteca de state management na v1 (NgRx/Akita) — signals + services chegam.
- `update`/`set` em signals, nunca `mutate`.

### 3. Services

- `providedIn: 'root'` para singletons. `inject()` em vez de constructor injection.
- 1 service por aggregate de domínio (ex: `CondominiumApiService`, `PollApiService`) —
  espelha packages do backend.
- Service expõe `Observable<T>` para chamadas HTTP; componente converte em signal via
  `toSignal()` quando precisar.

### 4. HTTP

- `provideHttpClient(withFetch(), withInterceptors([...]))` no bootstrap.
- 2 interceptors obrigatórios:
  - **AuthInterceptor**: adiciona `Authorization: Bearer <jwt>` (lê do Supabase JS SDK).
  - **TenantInterceptor**: adiciona `X-Tenant-Id` quando o usuário está num condomínio.
- Refresh de token: delegado ao Supabase JS SDK (`architecture.md` §1).

### 5. Estrutura de pastas

```
src/app/
├── core/          singletons globais (interceptors, guards, AuthService)
├── shared/        componentes/pipes reutilizáveis
└── features/
    ├── condominium/   espelha package backend
    ├── poll/
    ├── apartment/
    └── ...
```

- **Lazy loading** por feature route.
- Smart vs dumb components: páginas roteadas são "smart" (injetam services, gerenciam estado);
  UI components em `shared/` são puros (recebem inputs, emitem outputs).

### 6. Forms

- **Reactive Forms**, nunca template-driven. Validators tipados.

### 7. Acessibilidade

- WCAG AA mínimo. `NgOptimizedImage` em todas as imagens estáticas.

### 8. TypeScript

- `strict: true`. Preferir inferência. Evitar `any` (usar `unknown` quando incerto).
