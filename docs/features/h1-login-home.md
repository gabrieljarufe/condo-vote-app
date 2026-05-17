# H1 — Login + Home com seletor de condomínios

> Status: **milestone funcional alcançado** — smoke test prod realizado em 2026-05-11 com condomínio piloto Pitufos.
> Spec completa: [`docs/implementation/tasks/phase-7/h1-login-home.md`](../implementation/tasks/phase-7/h1-login-home.md).

## ✅ Validado em smoke test prod (2026-05-11 — Pitufos)

- Login via GoTrue (`supabase.auth.signInWithPassword`) → JWT retornado, `AuthService` armazena a session como signal.
- `authGuard` redireciona `/` → `/home` para user autenticado.
- `GET /api/me/condominiums` retorna 200 com Bearer token correto — lista com condomínio Pitufos.
- `<app-app-header>` renderiza nome do condomínio + seletor de troca + botão sair.
- `authInterceptor` injeta `Authorization: Bearer <jwt>` em todas as requisições autenticadas.
- `tenantInterceptor` injeta `X-Tenant-Id: <condominiumId>` (exceto `/api/me/**` e `/api/public/**`).
- `HomeComponent` com 1 condomínio exibe o seletor com opção única pré-selecionada.
- Logout: `supabase.auth.signOut()` → redirect para `/`.

## ❌ Falta testar (antes de considerar 100% pronta)

- [ ] **Caso "0 condomínios"** — user autenticado sem nenhum condomínio associado. `HomeComponent` deveria exibir estado vazio adequado.
- [ ] **Caso "N ≥ 3 condomínios"** — seletor com múltiplas opções em prod real (atualmente só existe 1 condo de piloto).
- [ ] **Logout completo** — confirmar que `supabase.auth.signOut()` limpa o cookie de refresh token no GoTrue e redireciona corretamente.
- [ ] **Troca de condomínio com cache de tenant** — `TenantService.activeCondominiumId` em memória reseta no F5; confirmar que a troca explícita de condomínio via seletor funciona sem recarregar página, e que requisições após a troca usam o novo `X-Tenant-Id`.

## Bugs / limitações conhecidos

- **`TenantService.activeCondominiumId` em memória** reseta ao recarregar a página (F5). Comportamento intencional — força nova seleção explícita, evita ambiguidade entre condos. Documentado em `architecture.md §6`.

## Pré-requisitos prod

Todos atendidos — T3.9 concluído em 2026-05-11:
- Condomínio Pitufos bootstrapado em prod.
- `api.condovote.com.br` respondendo com Let's Encrypt.
- Cloudflare Pages com `_redirects` SPA fallback.
- Secrets no Coolify configurados.

## Histórias dependentes

- **H2+** — todas as histórias subsequentes exigem condomínio selecionado no `TenantService`.
