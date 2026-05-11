# H1 — Login + Home com seletor de condomínios

> Esta história formaliza o **walking skeleton** já em produção desde T4.5 (frontend) e T3.6 (backend). Serve como **exemplar canônico** do template de história — todas as próximas (H2+) seguem este formato.

## História

Como **síndico bootstrapado** (cadastrado via runbook [`bootstrap-condominio.md`](../../../runbooks/bootstrap-condominio.md)), quero **fazer login no sistema e ver os condomínios em que sou administrador** para acessar as funcionalidades de gestão do(s) meu(s) condomínio(s).

## Motivação / contexto de produto

Esta é a porta de entrada do produto. Em v1, **não existe self-signup**: usuários entram no sistema apenas após bootstrap manual (síndico) ou convite (morador, coberto em H3/H4). Validar este caminho ponta-a-ponta (Supabase GoTrue → JWT ES256 → backend Spring Boot → RLS multi-tenant → frontend Angular) é o que provou a Fase 3+4 e libera a construção das histórias de domínio.

A história também materializa a **paridade de síndicos** ([`condo-vote-principles.md`](../../../condo-vote-principles.md) §Atores): um usuário pode ser síndico em mais de um condomínio, e o seletor de tenant ativo é um signal **em memória** (sem `localStorage`) — decisão arquitetural documentada em [`architecture.md`](../../../architecture.md) §6 e respeitada por `TenantService.activeCondominiumId`.

## Critérios de aceitação (Gherkin-lite)

- [x] **Dado** um síndico bootstrapado com e-mail/senha válidos **quando** ele submete o formulário de login **então** uma session GoTrue é criada e o JWT (ES256, P-256) é armazenado em memória pelo `AuthService`.
- [x] **Dado** um usuário autenticado **quando** o frontend chama `GET /api/me/condominiums` com `Authorization: Bearer <jwt>` **então** o backend retorna 200 com a lista de condomínios em que o usuário é administrador.
- [x] **Dado** um usuário não autenticado **quando** ele tenta acessar `/home` **então** o `authGuard` redireciona para `/login`.
- [x] **Dado** um usuário sem `Authorization` header **quando** chama `GET /api/me/condominiums` **então** o backend retorna 401.
- [x] **Dado** um usuário com 0 condomínios administrados **quando** entra na home **então** vê estado vazio explicando que precisa ser bootstrapado.
- [x] **Dado** um usuário com N ≥ 1 condomínios **quando** entra na home **então** vê um seletor com todos eles e pode escolher o ativo no header.
- [x] **Dado** um usuário com condomínio ativo selecionado **quando** dá F5 (refresh) **então** o seletor volta ao estado vazio (não persistido em `localStorage` por design — força nova seleção explícita).
- [x] **Dado** o condomínio piloto bootstrapado em prod **quando** o síndico real loga em `https://condovote.com.br` **então** vê o condomínio listado (smoke test prod executado 2026-05-11, fecha T3.9).

## Escopo técnico

- **Backend** (já implementado em Fase 3)
  - `GET /api/me/condominiums` — retorna `List<CondominiumSummaryDTO>` para o `userId` extraído do JWT.
  - `SecurityConfig` com OAuth2 Resource Server + JWKS Supabase (`jws-algorithms: ES256`).
  - `AuthGateway` interface + `SupabaseAuthGateway` impl.
  - `TenantContext` + `TenantInterceptor` + `TenantTransactionAspect` (`SET LOCAL app.current_tenant`).
  - `Condominium` aggregate (Spring Data JDBC) + `CondominiumRepository`.
  - `GlobalExceptionHandler` + `ApiError` record.

- **Frontend** (já implementado em Fase 4)
  - Rotas: `/` (`LandingComponent`, pública), `/login` (`LoginComponent`), `/home` (`HomeComponent`, protegida pelo `authGuard`).
  - `core/auth/supabase.client.ts` — singleton.
  - `core/auth/auth.service.ts` — signal de session.
  - `core/auth/auth.guard.ts` — protege rotas autenticadas.
  - `core/http/auth.interceptor.ts` — injeta `Authorization: Bearer`.
  - `core/http/tenant.interceptor.ts` — injeta header `X-Tenant-Id` exceto em `/api/me/**` e `/api/register/**`.
  - `core/api/me-api.service.ts` — wrapper de `GET /api/me/condominiums`.
  - `core/tenant/tenant.service.ts` — signal `activeCondominiumId` em memória.
  - `features/auth/login.ts` — Reactive Form + `<app-form-field>`.
  - `features/home/home.ts` — estados 0 / 1 / N condomínios.
  - `shared/layout/app-header.ts` — seletor de condomínio + sair.

- **Banco** (já em Fase 2)
  - Tabelas `condominium`, `app_user`, `condominium_admin` com RLS habilitado e policies via `(SELECT current_setting('app.current_tenant'))`.
  - Bootstrap formal via migration `V1001+` (template em `V1001__bootstrap_TEMPLATE.sql.example`).

- **Cobertura técnica F1–F8 que esta história consome:** nenhuma. H1 valida o trilho de fundação (Fases 0–6); F1–F8 começam a ser consumidos a partir de H2.

## Fora de escopo (explícito)

- **Self-signup** — não existe em v1; entrada é via bootstrap (síndico) ou convite (H3/H4).
- **Recuperação de senha** — fluxo nativo do Supabase, não precisa de UI custom em v1.
- **Cadastro de apartamento** — H2.
- **Persistência do condomínio ativo entre sessões** — decisão arquitetural: signal **em memória**, F5 reseta de propósito.

## Tasks

- [x] T1.1 — `LoginComponent` com Reactive Form + `<app-form-field>` (concluída em T4.5)
- [x] T1.2 — `AuthService` com signal de session + `supabase.client` singleton (concluída em T4.2)
- [x] T1.3 — `authGuard` + `authInterceptor` + `tenantInterceptor` (concluída em T4.2/T4.3)
- [x] T1.4 — `MeApiService` + `GET /api/me/condominiums` no backend (concluída em T3.6/T4.3)
- [x] T1.5 — `HomeComponent` com 0 / 1 / N condomínios (concluída em T4.5)
- [x] T1.6 — `<app-app-header>` com seletor + sair + `TenantService` em memória (concluída em T4.5)
- [x] **T1.7 — Smoke test prod com condomínio piloto** _(concluída 2026-05-11 — fecha T3.9)_
  - Pré-requisito: condomínio piloto Pitufos bootstrapado em prod via runbook (V1001).
  - Smoke executado: login OK em `https://condovote.com.br`, condomínio Pitufos renderizado na home, seletor funcional, sair desloga corretamente.
- [x] T1.8 — Atualizar `docs/STATUS.md`: T3.9 marcada como ✅, H1 marcada como ✅.
- [x] T1.9 — Marcar com ✅ as linhas correspondentes no apêndice de [`index.md`](index.md) (nada a marcar — H1 não consome F1–F8).
- [x] T1.10 — Critério 8 de aceitação marcado.

## Definition of Done

- [x] Critérios 1–7 de aceitação cobertos por testes existentes:
  - Backend: `MeControllerIT`, `RlsIsolationIT`.
  - Frontend: Vitest unitários de `auth.guard`, `auth.service`, `home`.
- [x] Critério 8 (smoke prod) executado e documentado em STATUS.md.
- [x] Quality gates verdes no CI da Fase 4 (Spotless, JaCoCo ≥ 50% overall, PMD CPD, ESLint, jscpd).
- [x] H1 fechada via PR de foundations da Fase 7.

## Como executar (delegação ao Sonnet)

A maior parte de H1 já está em produção. O Sonnet recebe esta história para:

1. **Executar T1.7** — usar a Bruno collection (`api-collection/`) para validar o caminho real em prod. **Não construir curls manuais de auth** — usar sempre a collection (memória do projeto).
2. **Atualizar `docs/STATUS.md`** com a evidência do smoke (data, status code, qualquer não-óbvio descoberto).
3. **Marcar checkboxes** desta história e do apêndice de `index.md`.
4. Se descobrir gap (ex.: header errado em algum interceptor, env var faltando em prod, certificado expirando), abrir issue e referenciar nesta história — não tentar consertar dentro do mesmo PR de H1.
5. Commit em português, imperativo curto. **Sem `Co-Authored-By`**.
6. PR alvo `develop` via `gh pr create`.
