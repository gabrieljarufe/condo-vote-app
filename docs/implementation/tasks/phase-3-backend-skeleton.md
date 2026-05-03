# Fase 3 — Walking Skeleton Backend

**Objetivo:** Spring Boot mínimo validando JWT Supabase, 1 endpoint cross-tenant + 1 placeholder RLS-scoped, deployado no Oracle Cloud via Coolify.

**Pré-requisitos:** Fase 2 (migrations aplicáveis local e remoto).

## Patterns de implementação

Antes de escrever qualquer classe Java, consulte **[`docs/coding-patterns.md`](../../coding-patterns.md)**. Define Controller → Service → Repository, Spring Data JDBC, aggregates, DTOs, testes e naming para este projeto.

---

## Docs de referência (Context7)

| Biblioteca | ID Context7 |
|-----------|-------------|
| Spring Security 7 (referência oficial) | `/websites/spring_io_spring-security_reference_7_0` |
| Spring Security (código-fonte / issues) | `/spring-projects/spring-security` |
| springdoc-openapi | `/springdoc/springdoc-openapi` |

> Uso: `mcp__context7__query-docs` com o ID acima para consultar documentação atualizada durante a implementação.

> **Pendência herdada da Fase 2 — Issue #4 (UUID v7 como padrão do projeto):** ao criar **qualquer** entity Hibernate com PK UUID, anotar com `@UuidGenerator(style = UuidGenerator.Style.TIME)` para gerar UUID v7 no app. Migrations **não** declaram `DEFAULT gen_random_uuid()` — INSERT sem ID falha cedo em vez de gerar v4 silencioso. Única exceção: entity de `app_user`, cujo ID vem do Supabase Auth e é setado manualmente pelo service durante o `/register/complete`. Ver `docs/data-model.md` seção "UUID v7 como padrão do projeto" e `docs/analysis/2026-04-25-data-model-scale-review.md` (escopo expandido em 2026-04-26).

---

## T3.1 — Projeto Spring Boot

> **⚠️ T3.1 é pré-requisito bloqueante da Fase 2.** Embora numerada como Fase 3, é a primeira coisa a fazer após Fase 1. Apenas o scaffolding mínimo (T3.1a) é necessário antes da Fase 2 — as classes de segurança/tenant/etc. (T3.2–T3.6) ficam para depois das migrations.

### T3.1a — Scaffolding mínimo (pré-requisito da Fase 2)
- [x] Gerar via Spring Initializr: Java 21, Spring Boot 4.x, Maven
- [x] Package base: `com.condovote`
- [x] `application.yaml` (base) + `application-local.yaml` (override de dev) com datasource e Flyway config mínima
- [x] `CondoVoteApplication.java` sobe em localhost:8080
- [x] Estrutura de packages vazias: `auth/`, `shared/config/`, `shared/tenant/`, `shared/exception/`

> **Decisão de profiles (2026-04-25):** sem `application-prod.yaml`. O `application.yaml` base já é o "perfil produção" implícito — todas as configs sensíveis vêm de env vars (`${DATABASE_URL}`, `${SUPABASE_URL}`, etc.) injetadas pelo Coolify. `application-local.yaml` sobrescreve apenas o que difere em dev (CORS localhost, seed do Flyway, health show-details). Criar arquivo prod vazio seria poluição — Spring Boot trata profile inexistente como "use o default".

**Aceite de T3.1a:** `./mvnw spring-boot:run -Dspring-boot.run.profiles=local` sobe sem erro (com ou sem banco). Fase 2 pode começar.

### T3.1b — Dependências completas e config refinada
- [x] Adicionar dependências faltantes ao `pom.xml`: `lettuce-core` (Redis), `springdoc-openapi-starter-webmvc-ui` (Swagger UI). Demais já estão (Web, JPA, Security, OAuth2 Resource Server, Validation, Thymeleaf, Flyway, PostgreSQL, Actuator)
- [x] Validar Flyway locations no `application-local.yaml`: `classpath:db/migration` + `classpath:db/seed`
- [x] Validar HikariCP pool size 10 no `application.yaml`
- [x] Em prod, todas as configs vêm de env vars do Coolify — sem `application-prod.yaml` (ver decisão em T3.1a)

**Aceite:** `./mvnw spring-boot:run -Dspring-boot.run.profiles=local` sobe com banco conectado e migrations aplicadas.

---

## T3.2 — SecurityConfig com JWKS Supabase
- [x] `shared/config/SecurityConfig.java`:
  - [x] `OAuth2ResourceServerConfigurer` com `jwkSetUri = ${supabase.url}/auth/v1/.well-known/jwks.json`
  - [x] `NimbusJwtDecoder` via auto-config Boot (jwk-set-uri em application.yaml; cache padrão Spring Security adequado para v1)
  - [x] `SecurityFilterChain`: `/actuator/health`, `/v3/api-docs/**`, `/swagger-ui/**` públicas; `/api/**` exige JWT
  - [x] Headers: X-Content-Type-Options nosniff (default), X-Frame-Options DENY, HSTS 1y
  - [x] CORS: whitelist de `${app.cors.allowed-origins}` — `http://localhost:4200` local, `https://app.condovote.com.br` em prod
  - [x] CSRF desabilitado para APIs stateless

**Aceite:** curl sem token em `/api/me/condominiums` retorna 401; curl em `/actuator/health` retorna 200.

---

## T3.3 — AuthGateway
- [x] `auth/AuthGateway.java`: interface com `UUID getCurrentUserId()`, `String getCurrentUserEmail()`
- [x] `auth/SupabaseAuthGateway.java`: implementação que extrai `sub` e `email` de `SecurityContextHolder.getContext().getAuthentication().getPrincipal()` (cast para `Jwt`)
- [x] Bean Spring injetável; **nenhum outro código do app toca `Jwt` diretamente** (isola Supabase)

**Aceite:** teste unitário com `Jwt` mock confirma extração correta.

---

## T3.4 — TenantContext + Interceptor + TransactionAspect
- [x] `shared/tenant/TenantContext.java`: ThreadLocal<UUID> com `set`, `get`, `clear`
- [x] `shared/tenant/TenantInterceptor.java` (`HandlerInterceptor`):
  - [x] `preHandle`: lê header `X-Tenant-Id`; se ausente → segue sem setar (cross-tenant); se presente → valida UUID, valida pertencimento do user (query `condominium_admin` OR `apartment_resident`), armazena em `TenantContext`
  - [x] `afterCompletion`: `TenantContext.clear()`
- [x] `shared/tenant/TenantTransactionAspect.java` (`@Aspect`):
  - [x] `@Around("@annotation(...Transactional) || @within(...Transactional)")` — cobre anotação no método e na classe
  - [x] Se `TenantContext.get() != null`: executa `set_config('app.current_tenant', tenant, true)` via `EntityManager.createNativeQuery`
- [x] Registro do interceptor em `WebMvcConfigurer` + `@EnableTransactionManagement(order = 0)` para garantir TX como wrapper externo

**Aceite:** 14 testes (10 unit + 4 IT com Testcontainers) — isolamento de threads, SET LOCAL transaction-scoped, @Transactional em método e em classe.

---

## T3.5 — GlobalExceptionHandler
- [x] `shared/exception/ForbiddenException.java`, `NotFoundException.java` (runtime exceptions)
- [x] `shared/exception/ApiError.java`: DTO `{code, message, details?, timestamp}`
- [x] `shared/exception/GlobalExceptionHandler.java` (`@RestControllerAdvice`):
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
- [ ] `backend/.dockerignore`: `target/`, `.idea`, `*.md`, `.env*`, `.git/`, `Dockerfile`, `*.iml`
- [ ] Build local: `docker build -t condovote-backend ./backend` funciona

**Aceite:** container sobe com `docker run -e DATABASE_URL=... -p 8080:8080 condovote-backend` e responde em `/actuator/health`.

---

## T3.8 — Deploy Coolify
- [x] Configurar todas as env vars no Coolify (do `.env.example`) como Secrets criptografados
- [ ] Confirmar que Coolify detecta o **Dockerfile recém-commitado** e builda (build pack Dockerfile, root `backend/`). Secrets já injetados em T1.6.
- [x] Merge em `main` dispara deploy automático via webhook (configurado em T1.4i)
- [x] Opção alternativa documentada: em vez de Coolify buildar, puxar imagem do GHCR (`ghcr.io/<owner>/condo-vote-backend:latest`) após workflow do Actions publicar (Fase 5)
- [x] Let's Encrypt automático — não requer configuração manual de certificate
- [x] Setar `CORS_ALLOWED_ORIGINS=https://app.condovote.com.br` no Coolify

**Aceite:** `curl https://api.condovote.com.br/actuator/health` retorna 200 com `{"status":"UP"}`.

---

## T3.9 — Smoke test ponta-a-ponta
- [ ] Criar user de teste no Supabase Auth Dashboard
- [ ] Inserir manualmente `app_user` + `condominium_admin` para esse user (ou rodar o runbook da Fase 6 se já existir)
- [ ] Obter JWT: `curl https://<supabase>/auth/v1/token?grant_type=password -H "apikey: <anon>" -d '{"email":"...","password":"..."}'`
- [ ] `curl -H "Authorization: Bearer <jwt>" https://api.condovote.com.br/api/me/condominiums` → retorna o condo
- [ ] Sem JWT → 401; JWT adulterado → 401

**Aceite:** fluxo completo validado em prod Oracle/Coolify + Cloudflare + Supabase.

---

## T3.10 — Atualizar comandos do CLAUDE.md
- [ ] Atualizar seção `CLAUDE.md → Comandos → Backend` com comandos reais:
  - `./mvnw spring-boot:run -Dspring-boot.run.profiles=local`
  - `./mvnw verify`
  - `docker build -t condo-vote-backend ./backend`
