# Design: release-please com versionamento semântico

## Contexto

Introduzir versionamento semântico (SemVer) via `release-please` no monorepo `condo-vote-app` (backend Java/Maven + frontend Angular/Node), substituindo o deploy automático em todo push em `main` por um fluxo controlado: o desenvolvedor mergeia um **Release PR** mantido pelo bot do release-please quando quiser lançar uma nova versão. O Release PR acumula todos os commits desde o último release, gera CHANGELOG, e ao ser mergeado dispara tag + GitHub Release + deploys de prod.

Resolve também dois bugs colaterais:
1. Frontend redeploya em pushes de backend-only por causa da condição `needs.frontend-quality-gate.result == 'skipped'`
2. Imagem Docker em prod não tem tag semântica (só `:sha` e `:latest`)

---

## Reavaliação crítica da spec inicial

A spec original tinha **6 erros/lacunas** que precisam ser corrigidos:

### ❌ Erro 1: nome da action errado
A spec usava `google-github-actions/release-please-action@v4`. **O nome correto é `googleapis/release-please-action@v4`**.

### ❌ Erro 2: faltava `bootstrap-sha`
Sem `bootstrap-sha`, o release-please considera **todos os commits desde o início do repo** na primeira execução, gerando um Release PR gigantesco e poluído. Solução: setar `bootstrap-sha` para o HEAD atual de `origin/main` no momento da implementação. Após o primeiro release, o campo é ignorado.

### ❌ Erro 3: faltavam flags de pre-major
O projeto inicia em `0.1.0`. Sem `bump-minor-pre-major: true` e `bump-patch-for-minor-pre-major: true`, **qualquer `feat:` na faixa 0.x bumparia direto para 1.0.0** (comportamento padrão do release-please que segue "0.x = breaking changes livres"). Não é o que o usuário quer — ele quer SemVer normal mesmo em 0.x.

### ❌ Erro 4: faltava `include-component-in-tag` e `separate-pull-requests`
Sem `include-component-in-tag: true`, com múltiplos componentes os tags colidem. Com `separate-pull-requests: true`, backend e frontend ganham PRs independentes — alinhado com a decisão de versionar separadamente.

### ❌ Erro 5: `GITHUB_TOKEN` padrão não dispara workflows
Quando o release-please cria o Release PR usando o token padrão, **o `pull_request` event não dispara `backend.yml`/`frontend.yml`** (proteção do GitHub contra loops). Resultado: quality gates não rodam no Release PR, e a branch protection de `main` (que exige `backend-quality-gate`/`frontend-quality-gate` verdes) bloqueia o merge.

**Solução**: usar um PAT (Personal Access Token) armazenado como `RELEASE_PLEASE_TOKEN`. Quando o action usa o PAT, workflows disparam normalmente.

### ❌ Erro 6: faltava `concurrency`
Múltiplos pushes em `main` em curta janela causam corrida — o release-please pode tentar criar dois Release PRs simultâneos. Adicionar `concurrency: release-please` evita isso.

### ⚠️ Comportamento esperado (não é erro, mas precisa ficar claro)
- Commits que **não** alteram arquivos em `backend/**` ou `frontend/**` (ex.: mudanças em `.github/`, `docs/`, `infra/`, raiz) **não disparam bump de versão e não aparecem em nenhum CHANGELOG**. Isso é intencional — só código de produto entra no SemVer.
- Outputs do action usam path como prefixo: `backend--release_created`, `backend--version`, `backend--tag_name`. Quando o path tem `/` (não é nosso caso), exige notação de bracket.

---

## Design final (corrigido)

### Componentes
| Componente | Path | Release-type | Versão inicial |
|---|---|---|---|
| backend | `backend` | `maven` | `0.1.0` |
| frontend | `frontend` | `node` | `0.1.0` |

### Tags geradas
- `backend-v{X.Y.Z}` (ex.: `backend-v0.2.0`)
- `frontend-v{X.Y.Z}` (ex.: `frontend-v0.2.0`)

### Bumps em 0.x (com flags pre-major)
| Commit | Bump em backend@0.1.0 |
|---|---|
| `fix: ...` em arquivo `backend/**` | `0.1.0` → `0.1.1` |
| `feat: ...` em arquivo `backend/**` | `0.1.0` → `0.2.0` |
| `feat!: ...` em arquivo `backend/**` | `0.1.0` → `1.0.0` |

### Triggers
- `release.yml` roda em `push: branches: [main]`
- `publish-backend` roda condicionalmente se `backend--release_created == 'true'`
- `deploy-frontend-prod` roda condicionalmente se `frontend--release_created == 'true'`

### Token
Novo secret no GitHub: `RELEASE_PLEASE_TOKEN` (PAT clássico do owner do repo com escopos `repo` e `workflow`).

### Arquivos modificados
| Arquivo | Ação |
|---|---|
| `release-please-config.json` | Criar (raiz) |
| `.release-please-manifest.json` | Criar (raiz) |
| `.github/workflows/release.yml` | Criar |
| `.github/workflows/backend.yml` | Remover job `publish-image` |
| `.github/workflows/frontend.yml` | Renomear `build-and-deploy` → `deploy-staging`, simplificar para staging-only |
