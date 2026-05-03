# Fase 4 — Walking Skeleton Frontend

**Objetivo:** Angular deployado no Cloudflare Pages; login via Supabase; chamada ao backend com JWT + X-Tenant-Id funcionando.

**Pré-requisitos:** Fase 3 (backend deployado, endpoint `/api/me/condominiums` responde).

## Patterns de implementação

Antes de escrever qualquer componente Angular, consulte **[`docs/coding-patterns.md`](../../coding-patterns.md)** seção "Frontend (Angular 20+)". Define standalone components, signals, services, interceptors, estrutura de pastas e TypeScript strict.

---

## T4.1 — Projeto Angular
- [ ] `cd frontend && ng new . --standalone --routing --style=scss --ssr=false` — **standalone components + signals** (conforme `architecture.md §6`)
- [ ] Instalar `@supabase/supabase-js`
- [ ] `src/environments/environment.ts` e `environment.prod.ts` com `supabaseUrl`, `supabaseAnonKey`, `apiUrl`
- [ ] Configurar build para ler variáveis Cloudflare Pages (`NG_APP_*`) via `file-replacements` ou runtime config

**Aceite:** `ng serve` sobe em localhost:4200.

---

## T4.2 — AuthService + login/logout + guard
- [ ] `src/app/auth/auth.service.ts`:
  - [ ] `SupabaseClient` singleton
  - [ ] `signIn(email, password)`, `signOut()`
  - [ ] `session$` signal/observable refletindo `onAuthStateChange`
  - [ ] `getAccessToken()` síncrono a partir da session atual
- [ ] `src/app/auth/login.component.ts`: form reativo com validação `Validators.required`/`Validators.email`
- [ ] `src/app/auth/auth.guard.ts` (`CanActivateFn`): redireciona para `/login` se sem sessão
- [ ] Rotas: `/login` pública, restante protegido pelo guard

**Aceite:** login com user real do Supabase direciona para home; logout volta para login.

---

## T4.3 — HttpInterceptor
- [ ] `src/app/core/auth.interceptor.ts` (`HttpInterceptorFn`):
  - [ ] Só injeta headers em requests para `environment.apiUrl`
  - [ ] Sempre injeta `Authorization: Bearer <access_token>`
  - [ ] Injeta `X-Tenant-Id` se `TenantService.activeCondominiumId()` estiver setado
  - [ ] Exclui `X-Tenant-Id` para paths `/api/me/**` e `/api/register/**`
  - [ ] **Não implementar retry manual de 401** — Supabase JS SDK já faz refresh automático. Se receber 401, deixar passar para o guard redirecionar para `/login`.
- [ ] `src/app/core/tenant.service.ts`: signal `activeCondominiumId`, persistido em `localStorage`
- [ ] Registrar interceptor em `app.config.ts`

**Aceite:** DevTools mostra requests ao backend com os dois headers corretos.

---

## T4.4 — Tela pós-login com seletor de condomínio
- [ ] `src/app/home/home.component.ts`:
  - [ ] Chama `GET /api/me/condominiums` no init
  - [ ] Se lista vazia: mensagem "você ainda não está vinculado a nenhum condomínio"
  - [ ] Se 1 item: seta automaticamente como ativo
  - [ ] Se N > 1: renderiza seletor (dropdown ou lista)
- [ ] Indicador de condo ativo no header + opção de trocar
- [ ] Placeholder de dashboard após seleção

**Aceite:** user multi-condo vê todas suas opções; seleção persiste entre reloads.

---

## T4.5 — Deploy Cloudflare Pages
- [ ] Projeto Pages já criado em T1.4h; confirmar build config no dashboard:
  - Build command: `cd frontend && npm ci && npm run build -- --configuration=production`
  - Build output directory: `frontend/dist/frontend/browser`
  - Root directory: `/` (ou `frontend/` se preferir contexto limitado)
- [ ] Env vars no Dashboard Cloudflare Pages (Production + Preview): `NG_APP_SUPABASE_URL`, `NG_APP_SUPABASE_ANON_KEY`, `NG_APP_API_URL=https://api.condovote.com.br`
- [ ] SPA fallback: criar `frontend/public/_redirects` com a linha `/*  /index.html  200` (Cloudflare Pages lê esse arquivo automaticamente)
- [ ] Confirmar que backend tem `CORS_ALLOWED_ORIGINS=https://app.condovote.com.br` (setado em T3.8)
- [ ] Custom domain `app.condovote.com.br` já configurado em T1.4h
- [ ] Validar que `frontend/public/_redirects` existe e é copiado para `dist/frontend/browser/` no build. Testar rota deep-link `https://app.condovote.com.br/login?redirect=/dashboard` retorna a SPA (não 404).

**Aceite:** produção: usuário real abre `https://app.condovote.com.br`, faz login, vê lista de condos vinda de `https://api.condovote.com.br`. Ponta-a-ponta.
