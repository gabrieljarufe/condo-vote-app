# Configuração de Branch Protection (Manual)

Como a API do GitHub para branch protection tem limitações via CLI, configure manualmente no GitHub:

## GitHub → Settings → Branches → Branch protection rules

### main
- [x] Require pull request reviews before merging
  - Required approving reviews: **1**
  - Dismiss stale approvals when new commits are pushed: **ON**
  - Require review from code owners: **OFF**
- [x] Require status checks to pass before merging
  - Status checks: adicionar **test** (do workflow CI) quando existir
  - Require branches to be up to date: **ON**
- [x] Block force pushes
- [x] Include administrators: **ON** (recomendado)
- [x] Restrict who can push
  - Adicionar se necessário (opcional na v1)

### develop
- [x] Require pull request reviews before merging
  - Required approving reviews: **0** (pode manter livre na v1)
- [x] Require status checks to pass before merging
  - Status checks: adicionar **test**
- [x] Block force pushes

---

## Notas

- O workflow `ci.yml` já foi criado em `.github/workflows/ci.yml`
- Os jobs `test` e `frontend-test` estão comentados temporariamente - serão ativados quando os projetos forem criados
- Após ativar o CI, volte aqui e adicione o status check "test" nas regras de branch protection