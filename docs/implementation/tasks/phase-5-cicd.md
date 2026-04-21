# Fase 5 — CI/CD Completa

**Objetivo:** `.github/workflows/ci.yml` rodando em toda PR, status checks obrigatórios, auto-deploy funcionando.

**Pré-requisitos:** Fase 3 (testes existem), Fase 4 (frontend builda).

---

## T5.1 — Workflow CI backend
- [ ] `.github/workflows/ci.yml` com job `test`:
  - [ ] Trigger: `push` em `main`/`develop` e `pull_request`
  - [ ] `actions/checkout@v4`
  - [ ] `actions/setup-java@v4` com `java-version: 21`, `distribution: temurin`, cache Maven
  - [ ] Service container: `redis:7-alpine` (caso algum IT use)
  - [ ] Step: `cd backend && ./mvnw verify` — inclui Testcontainers (Docker disponível em `ubuntu-latest`)
  - [ ] Upload de surefire-reports em caso de falha (debug fácil)

**Aceite:** PR com teste quebrado é bloqueado; PR verde tem ✅ no check `test`.

---

## T5.2 — Workflow CI frontend
- [ ] Adicionar job `frontend-test` no mesmo workflow ou em `frontend-ci.yml`:
  - [ ] `actions/setup-node@v4` com `node-version: 20` + cache npm
  - [ ] `cd frontend && npm ci`
  - [ ] `npm run lint` (se ESLint configurado)
  - [ ] `npm run build -- --configuration=production` — garante que prod build não quebra
  - [ ] **Testes unitários** podem ficar para depois se custarem tempo — priorizar build verde

**Aceite:** PR que quebra build Angular é bloqueado.

---

## T5.3 — Proteção de branches e auto-deploy
- [ ] Ativar status checks obrigatórios (adiados na Fase 0):
  - `main`: exige `test` + `frontend-test`
  - `develop`: exige `test` + `frontend-test`
- [ ] Confirmar Coolify auto-deploy no push para `main` via webhook (já configurado na Fase 3)
- [ ] Job `publish-image` no workflow: login no GHCR via `GHCR_TOKEN`, `docker/build-push-action@v5` tag `ghcr.io/<owner>/condo-vote-backend:<sha>` + `:latest` (dispara só em push para `main`)
- [ ] Confirmar Cloudflare Pages auto-deploy no push para `main` + preview em PRs
- [ ] Documentar fluxo de release em `README.md` seção "Deploy"

**Aceite:** ciclo completo: `feature/*` → PR para `develop` → CI verde → merge → PR `develop` → `main` → 1 approval + CI → merge → deploy automático Coolify (via webhook + imagem em GHCR) + Cloudflare Pages.
