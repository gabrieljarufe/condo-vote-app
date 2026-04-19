# Fase 4 — Walking Skeleton Frontend

**Objetivo:** Angular deployado na Vercel; login via Supabase; chamada ao backend com JWT + X-Tenant-Id funcionando.

**Pré-requisitos:** Fase 3 (backend deployado, endpoint `/api/me/condominiums` responde).

---

## T4.1 — Projeto Angular
- [ ] `cd frontend && ng new . --standalone --routing --style=scss --ssr=false`
- [ ] Instalar `@supabase/supabase-js`
- [ ] `src/environments/environment.ts` e `environment.prod.ts` com `supabaseUrl`, `supabaseAnonKey`, `apiUrl`
- [ ] Configurar build para ler variáveis Vercel (`NG_APP_*`) via `file-replacements` ou runtime config

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

## T4.5 — Deploy Vercel
- [ ] Build command: `cd frontend && npm ci && npm run build -- --configuration=production`
- [ ] Output directory: `frontend/dist/frontend/browser`
- [ ] Env vars no Dashboard Vercel: `NG_APP_SUPABASE_URL`, `NG_APP_SUPABASE_ANON_KEY`, `NG_APP_API_URL`
- [ ] Atualizar backend (`CORS_ALLOWED_ORIGINS`) com URL Vercel de produção
- [ ] Validar rewrite/fallback para SPA (todas rotas → `index.html`) — Vercel detecta Angular automaticamente ou configurar `vercel.json`

**Aceite:** produção: usuário real abre URL Vercel, faz login, vê lista de condos vinda do Railway. Ponta-a-ponta.
