# Fase 3 — Walking Skeleton Backend

**Objetivo:** Spring Boot mínimo validando JWT Supabase, 1 endpoint cross-tenant + 1 placeholder RLS-scoped, deployado no Railway.

**Pré-requisitos:** Fase 2 (migrations aplicáveis local e remoto).

---

## T3.1 — Projeto Spring Boot
- [ ] Gerar via Spring Initializr: Java 21, Spring Boot 3.x, Maven
- [ ] Dependências: `spring-boot-starter-web`, `-data-jpa`, `-security`, `-oauth2-resource-server`, `-actuator`, `-validation`, `-thymeleaf`, `flyway-core`, `flyway-database-postgresql`, `postgresql`, `jedis`/`lettuce-core`, `springdoc-openapi-starter-webmvc-ui`
- [ ] Package base: `com.condovote`
- [ ] Estrutura inicial de packages (vazias): `auth/`, `shared/config/`, `shared/tenant/`, `shared/exception/`
- [ ] `application.yml` + `application-local.yml` + `application-prod.yml` com datasource, JWKS URL, HikariCP pool size 10
- [ ] `CondoVoteApplication.java` sobe em localhost:8080

**Aceite:** `./mvnw spring-boot:run -Dspring-boot.run.profiles=local` sobe sem erro.

---

## T3.2 — SecurityConfig com JWKS Supabase
- [ ] `shared/config/SecurityConfig.java`:
  - [ ] `OAuth2ResourceServerConfigurer` com `jwkSetUri = ${supabase.url}/auth/v1/.well-known/jwks.json`
  - [ ] `NimbusJwtDecoder` com cache de chaves (`cache-duration = PT1H`)
  - [ ] `SecurityFilterChain`: `/actuator/health`, `/v3/api-docs/**`, `/swagger-ui/**` públicas; `/api/**` exige JWT
  - [ ] Headers: X-Content-Type-Options nosniff, X-Frame-Options DENY, HSTS 1y
  - [ ] CORS: whitelist de `${app.cors.allowed-origins}` — `localhost:4200` local, URL Vercel em prod
  - [ ] CSRF desabilitado para APIs stateless

**Aceite:** curl sem token em `/api/me/condominiums` retorna 401; curl em `/actuator/health` retorna 200.

---

## T3.3 — AuthGateway
- [ ] `auth/AuthGateway.java`: interface com `UUID getCurrentUserId()`, `String getCurrentUserEmail()`
- [ ] `auth/SupabaseAuthGateway.java`: implementação que extrai `sub` e `email` de `SecurityContextHolder.getContext().getAuthentication().getPrincipal()` (cast para `Jwt`)
- [ ] Bean Spring injetável; **nenhum outro código do app toca `Jwt` diretamente** (isola Supabase)

**Aceite:** teste unitário com `Jwt` mock confirma extração correta.

---

## T3.4 — TenantContext + Interceptor + TransactionAspect
- [ ] `shared/tenant/TenantContext.java`: ThreadLocal<UUID> com `set`, `get`, `clear`
- [ ] `shared/tenant/TenantInterceptor.java` (`HandlerInterceptor`):
  - [ ] `preHandle`: lê header `X-Tenant-Id`; se ausente → segue sem setar (cross-tenant); se presente → valida UUID, valida pertencimento do user (query `condominium_admin` OR `apartment_resident`), armazena em `TenantContext`
  - [ ] `afterCompletion`: `TenantContext.clear()`
- [ ] `shared/tenant/TenantTransactionAspect.java` (`@Aspect`):
  - [ ] `@Around("@annotation(org.springframework.transaction.annotation.Transactional)")`
  - [ ] Se `TenantContext.get() != null`: executa `SET LOCAL app.current_tenant = :tenant` via `EntityManager.createNativeQuery`
- [ ] Registro do interceptor em `WebMvcConfigurer`

**Aceite:** teste de integração com 2 tenants confirma que queries com header filtram corretamente.

---

## T3.5 — GlobalExceptionHandler
- [ ] `shared/exception/ForbiddenException.java`, `NotFoundException.java` (runtime exceptions)
- [ ] `shared/exception/ApiError.java`: DTO `{code, message, details?, timestamp}`
- [ ] `shared/exception/GlobalExceptionHandler.java` (`@RestControllerAdvice`):
  - `MethodArgumentNotValidException` → 400 com lista de erros por campo
  - `DataIntegrityViolationException` → 409
  - `ForbiddenException` → 403
  - `NotFoundException` → 404
  - `Exception` fallback → 500 (log completo, resposta sem stacktrace)

**Aceite:** endpoint de teste que lança cada exception retorna o status esperado + payload estruturado.

---

## T3.6 — Endpoint sentinela `GET /api/me/condominiums`
- [ ] `condominium/CondominiumController.java` (thin)
- [ ] `condominium/CondominiumService.java`:
  - [ ] Query explícita por `user_id` em `condominium_admin` UNION `apartment_resident` (sem RLS — cross-tenant)
  - [ ] Retorna `List<CondominiumSummary { id, name, role }>`
- [ ] DTO `CondominiumSummary` com enum `UserRoleInCondo { ADMIN, OWNER, TENANT, MULTIPLE }`
- [ ] Endpoint **não exige** header `X-Tenant-Id`

**Aceite:** user seed do `R__seed_dev.sql` chama endpoint e vê o condo do seed com role ADMIN.

---

## T3.7 — Dockerfile multi-stage
- [ ] `backend/Dockerfile` conforme `docs/architecture.md` §7:
  - Stage 1: `eclipse-temurin:21-jdk` → `./mvnw dependency:go-offline` + `package -DskipTests`
  - Stage 2: `eclipse-temurin:21-jre` → copia jar, EXPOSE 8080, ENTRYPOINT java -jar
- [ ] `backend/.dockerignore` exclui `target/`, `.idea`, `*.md`, `.env*`
- [ ] Build local: `docker build -t condovote-backend ./backend` funciona

**Aceite:** container sobe com `docker run -e DATABASE_URL=... -p 8080:8080 condovote-backend` e responde em `/actuator/health`.

---

## T3.8 — Deploy Railway
- [ ] Configurar todas as env vars no Railway (do `.env.example`)
- [ ] Confirmar que Railway detecta o Dockerfile e builda
- [ ] Merge em `main` dispara deploy automático
- [ ] Configurar custom domain ou usar o `<app>.up.railway.app` padrão
- [ ] Atualizar `CORS_ALLOWED_ORIGINS` do backend com URL Vercel (será preenchida na Fase 4)

**Aceite:** `curl https://<railway-domain>/actuator/health` retorna 200 com `{"status":"UP"}`.

---

## T3.9 — Smoke test ponta-a-ponta
- [ ] Criar user de teste no Supabase Auth Dashboard
- [ ] Inserir manualmente `app_user` + `condominium_admin` para esse user (ou rodar o runbook da Fase 6 se já existir)
- [ ] Obter JWT: `curl https://<supabase>/auth/v1/token?grant_type=password -H "apikey: <anon>" -d '{"email":"...","password":"..."}'`
- [ ] `curl -H "Authorization: Bearer <jwt>" https://<railway>/api/me/condominiums` → retorna o condo
- [ ] Sem JWT → 401; JWT adulterado → 401

**Aceite:** fluxo completo validado em prod Railway + Supabase.
