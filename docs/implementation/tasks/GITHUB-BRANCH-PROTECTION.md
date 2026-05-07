# Configuração de Branch Protection (Manual)

Como a API do GitHub para branch protection tem limitações via CLI no plano Free, configure manualmente no GitHub:

## GitHub → Settings → Branches → Branch protection rules

### main
- [x] Require pull request reviews before merging
  - Required approving reviews: **1**
  - Dismiss stale approvals when new commits are pushed: **ON**
  - Require review from code owners: **OFF**
- [x] Require status checks to pass before merging
  - Status checks obrigatórios: **`test`** (backend workflow) + **`frontend-test`** (frontend workflow)
  - Require branches to be up to date: **ON**
- [x] Block force pushes
- [x] Include administrators: **ON** (recomendado)
- [x] Restrict who can push
  - Adicionar se necessário (opcional na v1)

### develop
- [x] Require pull request reviews before merging
  - Required approving reviews: **0** (pode manter livre na v1)
- [x] Require status checks to pass before merging
  - Status checks obrigatórios: **`test`** + **`frontend-test`**
- [x] Block force pushes

---

## Padrão `changes` / leaf job

Os workflows usam o padrão:

```
changes → test-backend → test                              (backend.yml)
changes → run-frontend-tests → frontend-test (leaf)        (frontend.yml)
```

O job `changes` detecta quais arquivos foram alterados. PRs que tocam apenas
`docs/**` ou `infra/**` pulam os jobs de teste (`test-backend`,
`run-frontend-tests`), mas os jobs **leaf** (`test`, `frontend-test`) são
configurados com `if: always()` e reportam `success` mesmo quando o antecessor
é `skipped`. Isso garante que o branch protection é satisfeito em PRs
docs-only.

---

## Verificar proteção atual via CLI

```bash
# Checar status checks exigidos no main
gh api repos/{owner}/{repo}/branches/main/protection \
  | jq '.required_status_checks.contexts'

# Checar develop
gh api repos/{owner}/{repo}/branches/develop/protection \
  | jq '.required_status_checks.contexts'
```

Substitua `{owner}` por `gabrieljarufe` e `{repo}` por `condo-vote-app`.

---

## Notas

- Os workflows `backend.yml` e `frontend.yml` estão totalmente implementados —
  não há jobs comentados. O CI roda Spotless, testes unitários, testes de
  integração (Testcontainers), JaCoCo, PMD CPD (backend) e ESLint, Vitest,
  jscpd (frontend).
- O status check a registrar no GitHub é o **nome do job leaf** (`test` e
  `frontend-test`), não o nome do workflow.
- Após qualquer mudança nos nomes dos jobs, atualize os status checks aqui e
  reconfigure no painel do GitHub.
