# Plano: Implementar release-please com versionamento semântico

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

---

## Arquivos

| Arquivo | Ação | Linhas afetadas |
|---|---|---|
| `release-please-config.json` | **Criar** (raiz) | — |
| `.release-please-manifest.json` | **Criar** (raiz) | — |
| `.github/workflows/release.yml` | **Criar** | — |
| `.github/workflows/backend.yml` | Modificar — remover job `publish-image` | linhas 142–169 |
| `.github/workflows/frontend.yml` | Modificar — simplificar `build-and-deploy` | linhas 111–177 |
| `docs/superpowers/specs/2026-05-09-release-please-design.md` | **Criar** | — |
| `docs/superpowers/plans/2026-05-09-release-please.md` | **Criar** (cópia deste plano) | — |

Pré-requisito manual no GitHub (não é arquivo): criar secret `RELEASE_PLEASE_TOKEN` no repositório.

---

## Tarefas

### Tarefa 0 — Setup do branch e descoberta do `bootstrap-sha`

- [ ] **0.1** Garantir branch limpo a partir de `develop` atualizado:
  ```bash
  cd /Users/gabrieljarufe/Developer/projects/condo-vote-app
  git fetch origin
  git checkout develop
  git pull --ff-only origin develop
  git checkout -b chore/release-please
  ```
- [ ] **0.2** Capturar SHA do HEAD atual de `origin/main` para usar como `bootstrap-sha`:
  ```bash
  git rev-parse origin/main
  ```
  Anotar o output (ex.: `abc123def456...`). Será usado nos arquivos JSON da Tarefa 2 e 3.
- [ ] **0.3** Confirmar que o secret `RELEASE_PLEASE_TOKEN` precisa ser criado manualmente:
  ```bash
  gh secret list | grep RELEASE_PLEASE_TOKEN
  ```
  Se não retornar nada, avisar o usuário ao final que ele precisa criar o secret manualmente em `Settings → Secrets and variables → Actions` com um PAT clássico (escopos `repo` + `workflow`).

---

### Tarefa 1 — Criar spec e plano em `docs/superpowers/`

- [ ] **1.1** Criar `docs/superpowers/specs/2026-05-09-release-please-design.md` com o conteúdo do design (seções "Contexto", "Reavaliação crítica", "Design final" deste plano).
- [ ] **1.2** Criar `docs/superpowers/plans/2026-05-09-release-please.md` com cópia integral deste plano (para servir de referência durante e após a execução).
- [ ] **1.3** Verificar criação:
  ```bash
  ls -la docs/superpowers/specs/2026-05-09-release-please-design.md
  ls -la docs/superpowers/plans/2026-05-09-release-please.md
  ```
- [ ] **1.4** Commit:
  ```bash
  git add docs/superpowers/specs/2026-05-09-release-please-design.md docs/superpowers/plans/2026-05-09-release-please.md
  git commit -m "docs: spec e plano de implementação do release-please"
  ```

---

### Tarefa 2 — Criar `release-please-config.json`

- [ ] **2.1** Criar arquivo `release-please-config.json` na **raiz do repositório** (NÃO em `.github/`):
  ```json
  {
    "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
    "bootstrap-sha": "<COLOCAR_SHA_DA_TAREFA_0.2_AQUI>",
    "include-component-in-tag": true,
    "separate-pull-requests": true,
    "bump-minor-pre-major": true,
    "bump-patch-for-minor-pre-major": true,
    "packages": {
      "backend": {
        "release-type": "maven",
        "component": "backend",
        "changelog-path": "CHANGELOG.md"
      },
      "frontend": {
        "release-type": "node",
        "component": "frontend",
        "changelog-path": "CHANGELOG.md"
      }
    }
  }
  ```
  **Importante**: substituir `<COLOCAR_SHA_DA_TAREFA_0.2_AQUI>` pelo SHA capturado na Tarefa 0.2. Não deixar o placeholder.

- [ ] **2.2** Validar JSON sintaticamente:
  ```bash
  python3 -m json.tool release-please-config.json > /dev/null && echo "OK"
  ```
  Esperado: `OK`. Se erro, conferir vírgulas/aspas.

- [ ] **2.3** Validar que o `bootstrap-sha` está preenchido (não é o placeholder):
  ```bash
  grep -q "COLOCAR_SHA" release-please-config.json && echo "ERRO: placeholder ainda presente" || echo "OK"
  ```
  Esperado: `OK`.

---

### Tarefa 3 — Criar `.release-please-manifest.json`

- [ ] **3.1** Criar arquivo `.release-please-manifest.json` na **raiz do repositório**:
  ```json
  {
    "backend": "0.1.0",
    "frontend": "0.1.0"
  }
  ```
- [ ] **3.2** Validar JSON:
  ```bash
  python3 -m json.tool .release-please-manifest.json > /dev/null && echo "OK"
  ```

---

### Tarefa 4 — Criar `.github/workflows/release.yml`

- [ ] **4.1** Criar arquivo `.github/workflows/release.yml` com o conteúdo completo abaixo:
  ```yaml
  name: Release

  on:
    push:
      branches: [main]

  concurrency:
    group: release-please-${{ github.ref }}
    cancel-in-progress: false

  permissions:
    contents: write
    pull-requests: write

  jobs:
    release-please:
      runs-on: ubuntu-latest
      outputs:
        backend_release: ${{ steps.rp.outputs['backend--release_created'] }}
        backend_version: ${{ steps.rp.outputs['backend--version'] }}
        backend_tag: ${{ steps.rp.outputs['backend--tag_name'] }}
        frontend_release: ${{ steps.rp.outputs['frontend--release_created'] }}
        frontend_version: ${{ steps.rp.outputs['frontend--version'] }}
        frontend_tag: ${{ steps.rp.outputs['frontend--tag_name'] }}
      steps:
        - uses: googleapis/release-please-action@v4
          id: rp
          with:
            token: ${{ secrets.RELEASE_PLEASE_TOKEN }}
            config-file: release-please-config.json
            manifest-file: .release-please-manifest.json

    publish-backend:
      needs: release-please
      if: needs.release-please.outputs.backend_release == 'true'
      runs-on: ubuntu-latest
      permissions:
        contents: read
        packages: write
      steps:
        - uses: actions/checkout@v4
          with:
            ref: ${{ needs.release-please.outputs.backend_tag }}
        - name: Login to GHCR
          uses: docker/login-action@v3
          with:
            registry: ghcr.io
            username: ${{ github.actor }}
            password: ${{ secrets.GHCR_TOKEN }}
        - name: Build and push image
          uses: docker/build-push-action@v5
          with:
            context: ./backend
            push: true
            tags: |
              ghcr.io/${{ github.repository_owner }}/condo-vote-backend:${{ needs.release-please.outputs.backend_version }}
              ghcr.io/${{ github.repository_owner }}/condo-vote-backend:latest
        - name: Trigger Coolify prod deploy
          run: |
            HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
              -X GET "${{ secrets.COOLIFY_WEBHOOK_URL }}" \
              -H "Authorization: Bearer ${{ secrets.COOLIFY_API_TOKEN }}")
            echo "Coolify prod response: $HTTP"
            [[ "$HTTP" == "2"* ]] || exit 1
        - name: Summary
          run: |
            echo "### Backend ${{ needs.release-please.outputs.backend_tag }} publicado" >> $GITHUB_STEP_SUMMARY
            echo "- Imagem: \`ghcr.io/${{ github.repository_owner }}/condo-vote-backend:${{ needs.release-please.outputs.backend_version }}\`" >> $GITHUB_STEP_SUMMARY
            echo "- Coolify webhook disparado" >> $GITHUB_STEP_SUMMARY

    deploy-frontend-prod:
      needs: release-please
      if: needs.release-please.outputs.frontend_release == 'true'
      runs-on: ubuntu-latest
      permissions:
        contents: read
        deployments: write
      steps:
        - uses: actions/checkout@v4
          with:
            ref: ${{ needs.release-please.outputs.frontend_tag }}
        - uses: actions/setup-node@v4
          with:
            node-version: '20'
            cache: 'npm'
            cache-dependency-path: frontend/package-lock.json
        - name: Install dependencies
          working-directory: frontend
          run: npm ci
        - name: Build (prod)
          working-directory: frontend
          env:
            NG_APP_SUPABASE_URL: ${{ secrets.NG_APP_SUPABASE_URL }}
            NG_APP_SUPABASE_ANON_KEY: ${{ secrets.NG_APP_SUPABASE_ANON_KEY }}
            NG_APP_API_URL: ${{ secrets.NG_APP_API_URL }}
          run: npm run build:prod
        - name: Deploy to Cloudflare Pages (prod)
          uses: cloudflare/wrangler-action@v3
          with:
            apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
            accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
            command: pages deploy frontend/dist/frontend/browser --project-name=condo-vote-frontend --branch=main
        - name: Summary
          run: |
            echo "### Frontend ${{ needs.release-please.outputs.frontend_tag }} publicado" >> $GITHUB_STEP_SUMMARY
            echo "- Produção: https://app.condovote.com.br" >> $GITHUB_STEP_SUMMARY
  ```

  **Notas importantes deste arquivo:**
  - `concurrency: release-please-${{ github.ref }}`: serializa execuções no mesmo branch
  - `cancel-in-progress: false`: nunca cancela um release em andamento
  - Outputs com bracket notation `outputs['backend--release_created']` (mais seguro que dot notation com `--` no nome)
  - `actions/checkout@v4` nos jobs de publish/deploy faz `ref: <tag>` para garantir que o build usa exatamente o código da tag, não o `main` (que pode ter avançado)
  - `cache-dependency-path: frontend/package-lock.json` (não `package.json` — o lock é o arquivo correto para cache do npm)

- [ ] **4.2** Validar YAML syntax:
  ```bash
  python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))" && echo "OK"
  ```
  Esperado: `OK`. Se erro, mostrar a linha com problema.

- [ ] **4.3** Verificar que não há erros de Action lint (se `actionlint` instalado):
  ```bash
  which actionlint && actionlint .github/workflows/release.yml || echo "actionlint não instalado, pulando"
  ```
  Não bloqueante — se actionlint não estiver instalado, prosseguir.

---

### Tarefa 5 — Modificar `backend.yml`: remover job `publish-image`

- [ ] **5.1** Ler o arquivo atual para confirmar conteúdo a ser removido:
  ```bash
  sed -n '142,169p' .github/workflows/backend.yml
  ```
  Esperado: o output começa com `  publish-image:` e termina com a linha de `${{ secrets.COOLIFY_API_TOKEN }}`.

- [ ] **5.2** Aplicar Edit removendo o job inteiro. O `old_string` deve ser:
  ```yaml
    publish-image:
      needs: backend-quality-gate
      if: github.event_name == 'push' && github.ref == 'refs/heads/main'
      runs-on: ubuntu-latest
      permissions:
        contents: read
        packages: write
      steps:
        - uses: actions/checkout@v4
        - name: Login to GHCR
          uses: docker/login-action@v3
          with:
            registry: ghcr.io
            username: ${{ github.actor }}
            password: ${{ secrets.GHCR_TOKEN }}
        - name: Build and push
          uses: docker/build-push-action@v5
          with:
            context: ./backend
            push: true
            tags: |
              ghcr.io/${{ github.repository_owner }}/condo-vote-backend:${{ github.sha }}
              ghcr.io/${{ github.repository_owner }}/condo-vote-backend:latest
        - name: Trigger Coolify deploy
          run: |
            curl -s -o /dev/null -w "%{http_code}" \
              -X GET "${{ secrets.COOLIFY_WEBHOOK_URL }}" \
              -H "Authorization: Bearer ${{ secrets.COOLIFY_API_TOKEN }}"
  ```
  E o `new_string` deve ser **vazio** (string literal vazia `""`). Isso remove o job inteiro mais a linha em branco que o precede (que será removida junto pela Edit que pega o trailing newline).
  
  **Atenção**: se a Edit não funcionar com string vazia, o approach alternativo é incluir a linha em branco antes do bloco no `old_string` e ajustar.

- [ ] **5.3** Verificar que o job foi removido:
  ```bash
  grep -n "publish-image" .github/workflows/backend.yml
  ```
  Esperado: nenhum match.

- [ ] **5.4** Validar YAML:
  ```bash
  python3 -c "import yaml; yaml.safe_load(open('.github/workflows/backend.yml'))" && echo "OK"
  ```

- [ ] **5.5** Verificar que o job `staging-deploy` continua intacto:
  ```bash
  grep -n "staging-deploy:" .github/workflows/backend.yml
  ```
  Esperado: 1 match.

---

### Tarefa 6 — Modificar `frontend.yml`: simplificar `build-and-deploy`

O job `build-and-deploy` atual atende staging E prod com lógica condicional. Como prod migrou para `release.yml`, simplificamos para staging-only.

- [ ] **6.1** Ler o conteúdo atual do job para conferência:
  ```bash
  sed -n '111,177p' .github/workflows/frontend.yml
  ```

- [ ] **6.2** Aplicar Edit substituindo o bloco inteiro do job `build-and-deploy`. 

  `old_string` (lê a partir de `  build-and-deploy:` até o fim do arquivo — última linha do `Publish URL to summary`):
  ```yaml
    build-and-deploy:
      needs: [changes, frontend-quality-gate]
      if: >-
        always() &&
        github.event_name == 'push' &&
        (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop') &&
        (needs.frontend-quality-gate.result == 'success' || needs.frontend-quality-gate.result == 'skipped')
      runs-on: ubuntu-latest
      permissions:
        contents: read
        deployments: write
      steps:
        - name: Checkout
          uses: actions/checkout@v4
        - name: Setup Node.js
          uses: actions/setup-node@v4
          with:
            node-version: '20'
            cache: 'npm'
            cache-dependency-path: frontend/package.json
        - name: Install dependencies
          working-directory: frontend
          run: npm ci
        - name: Set API URL
          id: urls
          run: |
            if [ "${{ github.ref_name }}" = "main" ]; then
              echo "api_url=${{ secrets.NG_APP_API_URL }}" >> $GITHUB_OUTPUT
            else
              echo "api_url=https://staging.api.condovote.com.br" >> $GITHUB_OUTPUT
            fi
        - name: Build
          working-directory: frontend
          env:
            NG_APP_SUPABASE_URL: ${{ secrets.NG_APP_SUPABASE_URL }}
            NG_APP_SUPABASE_ANON_KEY: ${{ secrets.NG_APP_SUPABASE_ANON_KEY }}
            NG_APP_API_URL: ${{ steps.urls.outputs.api_url }}
          run: npm run build:prod
        - name: Deploy to Cloudflare Pages
          id: deploy
          uses: cloudflare/wrangler-action@v3
          with:
            apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
            accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
            command: pages deploy frontend/dist/frontend/browser --project-name=condo-vote-frontend --branch=${{ github.ref_name }}
        - name: Publish URL to summary
          if: steps.deploy.outcome == 'success'
          run: |
            OUTPUT='${{ steps.deploy.outputs.command-output }}'
            UNIQUE_URL=$(echo "$OUTPUT" | grep -oE 'https://[a-z0-9]+\.condo-vote-frontend\.pages\.dev' | head -1 || echo "")
            BRANCH="${{ github.ref_name }}"

            if [ "$BRANCH" = "main" ]; then
              echo "### 🚀 Deploy de produção — \`main\`" >> $GITHUB_STEP_SUMMARY
              echo "" >> $GITHUB_STEP_SUMMARY
              echo "- **Produção:** https://app.condovote.com.br" >> $GITHUB_STEP_SUMMARY
              [ -n "$UNIQUE_URL" ] && echo "- **Unique URL:** $UNIQUE_URL" >> $GITHUB_STEP_SUMMARY
            else
              ALIAS_URL="https://${BRANCH}.condo-vote-frontend.pages.dev"
              echo "### 👀 Deploy de preview — \`${BRANCH}\`" >> $GITHUB_STEP_SUMMARY
              echo "" >> $GITHUB_STEP_SUMMARY
              echo "- **Alias URL:** $ALIAS_URL" >> $GITHUB_STEP_SUMMARY
              [ -n "$UNIQUE_URL" ] && echo "- **Unique URL:** $UNIQUE_URL" >> $GITHUB_STEP_SUMMARY
              echo "" >> $GITHUB_STEP_SUMMARY
              echo "> ℹ️ Alias URL pode levar alguns minutos pra propagar." >> $GITHUB_STEP_SUMMARY
            fi
  ```

  `new_string`:
  ```yaml
    deploy-staging:
      needs: [changes, frontend-quality-gate]
      if: >-
        always() &&
        github.event_name == 'push' &&
        github.ref == 'refs/heads/develop' &&
        needs.frontend-quality-gate.result == 'success'
      runs-on: ubuntu-latest
      permissions:
        contents: read
        deployments: write
      steps:
        - name: Checkout
          uses: actions/checkout@v4
        - name: Setup Node.js
          uses: actions/setup-node@v4
          with:
            node-version: '20'
            cache: 'npm'
            cache-dependency-path: frontend/package-lock.json
        - name: Install dependencies
          working-directory: frontend
          run: npm ci
        - name: Build (staging)
          working-directory: frontend
          env:
            NG_APP_SUPABASE_URL: ${{ secrets.NG_APP_SUPABASE_URL }}
            NG_APP_SUPABASE_ANON_KEY: ${{ secrets.NG_APP_SUPABASE_ANON_KEY }}
            NG_APP_API_URL: https://staging.api.condovote.com.br
          run: npm run build:prod
        - name: Deploy to Cloudflare Pages (staging)
          id: deploy
          uses: cloudflare/wrangler-action@v3
          with:
            apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
            accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
            command: pages deploy frontend/dist/frontend/browser --project-name=condo-vote-frontend --branch=develop
        - name: Summary
          if: steps.deploy.outcome == 'success'
          run: |
            echo "### Deploy de staging — frontend" >> $GITHUB_STEP_SUMMARY
            echo "" >> $GITHUB_STEP_SUMMARY
            echo "- **Staging:** https://develop.condo-vote-frontend.pages.dev" >> $GITHUB_STEP_SUMMARY
  ```

  **Mudanças aplicadas neste Edit:**
  1. Renomeou `build-and-deploy` → `deploy-staging` (mais claro)
  2. Removeu condição `main` e o `|| skipped` (corrige bug de redeploy desnecessário)
  3. Removeu step `Set API URL` — hardcoded direto no `env: NG_APP_API_URL` do build
  4. Fixou `--branch=develop` no comando Cloudflare
  5. Simplificou `Publish URL to summary` → `Summary` (sem lógica condicional main vs branch)
  6. Corrigiu `cache-dependency-path` de `package.json` para `package-lock.json`

- [ ] **6.3** Verificar que `deploy-staging` está presente e `build-and-deploy` foi removido:
  ```bash
  grep -n "deploy-staging:" .github/workflows/frontend.yml
  grep -n "build-and-deploy:" .github/workflows/frontend.yml
  ```
  Esperado: primeiro retorna 1 linha, segundo retorna nada.

- [ ] **6.4** Validar YAML:
  ```bash
  python3 -c "import yaml; yaml.safe_load(open('.github/workflows/frontend.yml'))" && echo "OK"
  ```

---

### Tarefa 7 — Commit das mudanças

- [ ] **7.1** Conferir status:
  ```bash
  git status
  git diff --stat
  ```
  Esperado:
  - Novos: `release-please-config.json`, `.release-please-manifest.json`, `.github/workflows/release.yml`
  - Modificados: `.github/workflows/backend.yml`, `.github/workflows/frontend.yml`
  - (Spec/plan já foram commitados na Tarefa 1.)

- [ ] **7.2** Stage e commit (sem co-author, conforme CLAUDE.md):
  ```bash
  git add release-please-config.json .release-please-manifest.json \
          .github/workflows/release.yml \
          .github/workflows/backend.yml \
          .github/workflows/frontend.yml
  git commit -m "feat(ci): introduz release-please com versionamento semântico

- Cria release.yml com release-please-action v4 (manifest mode, separate PRs)
- Backend: Maven release-type, tag backend-vX.Y.Z
- Frontend: Node release-type, tag frontend-vX.Y.Z
- Versão inicial 0.1.0 com flags pre-major (feat=minor, fix=patch em 0.x)
- Remove publish-image de backend.yml (deploy de prod migrou para release.yml)
- Renomeia build-and-deploy para deploy-staging em frontend.yml e remove condição
  permissiva 'skipped' que causava redeploy em pushes backend-only
- Imagem Docker de prod ganha tag semântica além de :latest"
  ```

---

### Tarefa 8 — Validação final pré-PR

- [ ] **8.1** Rodar todos os linters de YAML em paralelo:
  ```bash
  for f in .github/workflows/release.yml .github/workflows/backend.yml .github/workflows/frontend.yml; do
    python3 -c "import yaml; yaml.safe_load(open('$f'))" && echo "$f OK" || echo "$f FALHOU"
  done
  ```
  Esperado: 3 linhas com `OK`.

- [ ] **8.2** Validar JSONs:
  ```bash
  python3 -m json.tool release-please-config.json > /dev/null && echo "config OK"
  python3 -m json.tool .release-please-manifest.json > /dev/null && echo "manifest OK"
  ```

- [ ] **8.3** Garantir que nenhum placeholder ficou:
  ```bash
  grep -rn "COLOCAR_SHA\|TODO\|TBD\|FIXME" release-please-config.json .release-please-manifest.json .github/workflows/release.yml
  ```
  Esperado: nenhum match.

---

### Tarefa 9 — Rebase contra develop e abrir PR

- [ ] **9.1** Verificar se develop avançou desde o checkout:
  ```bash
  git fetch origin
  git log --oneline chore/release-please..origin/develop
  ```
  Se houver commits, rebase:
  ```bash
  git rebase origin/develop
  ```

- [ ] **9.2** Push do branch:
  ```bash
  git push -u origin chore/release-please
  ```

- [ ] **9.3** Abrir PR para `develop` (não para `main`, conforme CLAUDE.md):
  ```bash
  gh pr create --base develop --title "feat(ci): introduz release-please com versionamento semântico" --body "$(cat <<'EOF'
  ## O que foi feito
  - Adiciona \`release.yml\` com release-please-action v4 (manifest mode)
  - Componentes independentes: \`backend\` (Maven) e \`frontend\` (Node), versão inicial 0.1.0
  - Tags geradas: \`backend-vX.Y.Z\` e \`frontend-vX.Y.Z\`
  - Deploy de prod migra de \`push: main\` para \`when Release PR mergeado → tag criada\`
  - Remove redeploy desnecessário do frontend em pushes backend-only
  - Imagem Docker de prod ganha tag semântica

  ## Pré-requisito antes de mergear em main
  - [ ] Criar secret \`RELEASE_PLEASE_TOKEN\` no GitHub (PAT clássico, escopos \`repo\` + \`workflow\`)

  ## Como validar
  - [ ] CI do PR passa nos quality gates de backend e frontend
  - [ ] Após merge em develop, staging-deploy do backend roda e \`deploy-staging\` do frontend roda apenas se houver mudança em \`frontend/**\`
  - [ ] Após merge develop→main, \`release.yml\` cria Release PR(s) — um por componente afetado
  - [ ] Mergeando o(s) Release PR(s): tag criada, imagem Docker com tag semântica publicada, Coolify webhook disparado, frontend deploya em \`branch=main\`
  EOF
  )"
  ```

- [ ] **9.4** Avisar o usuário que o secret `RELEASE_PLEASE_TOKEN` precisa ser criado **antes do merge em main** — caso contrário o release-please não conseguirá criar o Release PR e o passo de release falhará silenciosamente.

---

## Verificação end-to-end (pós-merge)

Esta é a sequência de validação após o PR ser mergeado em develop e depois em main:

### Passo A: validar staging
1. Após merge em `develop`, ir em **Actions** no GitHub e confirmar:
   - `Backend CI/CD` rodou e `staging-deploy` foi `success`
   - `Frontend CI/CD` rodou e `deploy-staging` rodou **apenas se** o PR alterou `frontend/**` (esperado: skipped neste PR específico)
   - `Auto PR develop → main` criou ou atualizou o PR develop→main

### Passo B: validar release-please na main
1. Mergear o PR develop→main
2. Confirmar em Actions:
   - `Release` workflow disparou
   - Job `release-please` finalizou com sucesso
   - Job `publish-backend` foi **skipped** (nenhuma release ainda — só o setup foi mergeado)
   - Job `deploy-frontend-prod` foi **skipped**
3. Confirmar que o release-please **criou um Release PR** para backend e/ou frontend (apenas se houver commits relevantes pós-`bootstrap-sha`):
   - PRs no formato `chore(backend): release 0.2.0` ou `chore(main): release backend 0.1.0` (depende do volume de commits qualificados)
   - O PR contém: bump em `backend/pom.xml`, criação de `backend/CHANGELOG.md` (Maven type usa o `changelog-path` configurado, mas o caminho default é dentro do package; conferir), atualização de `.release-please-manifest.json`

   **Se nenhum Release PR aparecer**: significa que nenhum commit qualificado existe entre o `bootstrap-sha` e o HEAD atual de main. Para testar, fazer um commit `feat(...)` em algum arquivo de `backend/**` ou `frontend/**` e mergear.

### Passo C: validar deploy de prod via Release PR
1. Mergear o Release PR (por exemplo, o do backend)
2. Confirmar em Actions:
   - `Release` workflow disparou novamente
   - Job `release-please` agora retorna `backend--release_created == true`
   - Job `publish-backend` rodou: imagem `ghcr.io/.../condo-vote-backend:0.2.0` + `:latest` foi publicada
   - Coolify webhook retornou `2xx`
3. Verificar GitHub Releases:
   ```bash
   gh release list
   ```
   Deve mostrar `backend-v0.2.0` com CHANGELOG agrupado (✨ Features, 🐛 Fixes, etc.)
4. Verificar pull da imagem:
   ```bash
   docker pull ghcr.io/<owner>/condo-vote-backend:0.2.0
   ```

### Passo D: rollback (se necessário)
- Para reverter um release: deletar a tag e a release no GitHub, depois ajustar `.release-please-manifest.json` manualmente para a versão anterior.
- Em caso de falha do deploy de prod (Coolify retornou erro): a tag fica criada, mas Coolify pode ser disparado manualmente via UI.

---

## Notas críticas para o executor

1. **Não esquecer o `bootstrap-sha`** — sem isso, primeiro Release PR fica gigante.
2. **Não esquecer o secret `RELEASE_PLEASE_TOKEN`** — sem isso, o passo de release-please falha ou (pior) abre PRs que não disparam quality gates e ficam bloqueados.
3. **`googleapis/release-please-action@v4`** — não confundir com `google-github-actions/...`.
4. **Outputs com bracket notation** — `${{ steps.rp.outputs['backend--release_created'] }}`, não `steps.rp.outputs.backend--release_created` (dot notation quebra com `--`).
5. **`ref: <tag>` no checkout dos jobs de deploy** — garante reprodutibilidade.
6. **Não criar co-author** nos commits (CLAUDE.md).
7. **PR para `develop`, nunca direto para `main`** (CLAUDE.md).
