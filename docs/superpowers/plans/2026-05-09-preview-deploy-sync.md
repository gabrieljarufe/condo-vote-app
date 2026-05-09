# Preview Deploy Sync — Frontend + Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garantir que o frontend preview sempre redeploya quando há push em qualquer PR, apontando para a URL de preview do backend correto.

**Architecture:** Adicionar `always()` ao job `preview-deploy` do `frontend.yml` e incluir `changes` no `needs`, quebrando a propagação de "skipped" do GitHub Actions. O frontend preview passa a rodar para todo PR, sem dependência de mudança frontend.

**Tech Stack:** GitHub Actions, Cloudflare Pages (wrangler), Angular

---

### Task 1: Corrigir `preview-deploy` no `frontend.yml`

**Files:**
- Modify: `.github/workflows/frontend.yml` (job `preview-deploy`, linhas 111-116)

- [ ] **Step 1: Aplicar a mudança**

Substituir o bloco atual:

```yaml
  preview-deploy:
    needs: frontend-quality-gate
    if: >-
      github.event_name == 'pull_request' &&
      github.event.action != 'closed' &&
      (needs.frontend-quality-gate.result == 'success' || needs.frontend-quality-gate.result == 'skipped')
```

Por:

```yaml
  preview-deploy:
    needs: [changes, frontend-quality-gate]
    if: >-
      always() &&
      github.event_name == 'pull_request' &&
      github.event.action != 'closed' &&
      (needs.frontend-quality-gate.result == 'success' || needs.frontend-quality-gate.result == 'skipped')
```

- [ ] **Step 2: Commit e push**

```bash
git add .github/workflows/frontend.yml
git commit -m "fix(ci): preview-deploy do frontend roda em todo PR — corrige propagação de skipped"
git push
```

- [ ] **Step 3: Verificar no GitHub Actions**

Abrir um PR com mudança só de backend e confirmar que o job `preview-deploy` do `frontend.yml` aparece como **executado** (não skipped) na aba Actions do PR.

Resultado esperado: job `preview-deploy` com status ✅ (não ⏭️ skipped).
