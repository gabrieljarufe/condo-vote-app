# Design — Sincronização de Preview Deploy Frontend/Backend

## Problema

O `preview-deploy` do `frontend.yml` tem o mesmo bug de propagação de "skipped" que o backend: sem `always()`, o GitHub Actions propaga o estado skipped do avô (`frontend-quality-gate-run`) para o neto (`preview-deploy`), mesmo que o pai (`frontend-quality-gate`) tenha rodado com sucesso.

Além disso, quando um PR tem somente mudanças de backend, o frontend preview nunca redeploya — continuando a apontar para a URL de produção em vez da URL de preview do PR.

## Solução (Opção A)

Corrigir `frontend.yml` `preview-deploy`:

1. Adicionar `always()` na condição `if` — quebra a propagação de skipped
2. Adicionar `changes` ao `needs` — para poder acessar `changes.outputs` se necessário
3. **Remover** qualquer dependência de `changes.outputs.frontend` do `preview-deploy` — o frontend preview deve rodar para **todo PR**, independente de ter mudança frontend ou não

## Comportamento resultante

| Mudança no PR | Backend preview | Frontend preview |
|---|---|---|
| Só backend | Deploya | Redeploya (aponta para `{pr}.api.condovote.com.br`) |
| Só frontend | Não roda | Deploya |
| Ambos | Deploya | Deploya |
| Nenhum (docs) | Não roda | Deploya (baixo custo, ~1min) |

## Arquivo alterado

- `.github/workflows/frontend.yml` — job `preview-deploy`, campos `needs` e `if`

## Verificação

Abrir um PR com só mudança de backend e confirmar que o job `preview-deploy` do frontend aparece como executado (não skipped) no GitHub Actions.
