---
name: pr-quality-gates
description: Use when validating CI quality gates on an open PR, analyzing reviewdog or coverage comments, deciding what to fix from gate violations, or before claiming "tests pass / ready to merge". Trigger phrases (PT-BR): "avalie/analise os comments do PR", "como está o coverage", "tem violação de duplicação", "o Spotless reclamou", "o gate passou", "está pronto pra merge", "por que o CI falhou".
---

# PR Quality Gates

## Princípio

CI > local. Quality gates do PR são fonte da verdade sobre o que precisa mudar.
Se você não consultou o gate, você não sabe o que está pendente.

## Os dois tipos de comment (não confundir)

| Tipo                               | Como ler                                                           | Quem posta                                                                             | Silêncio significa                         |
|------------------------------------|--------------------------------------------------------------------|----------------------------------------------------------------------------------------|--------------------------------------------|
| Issue comments (sticky)            | `gh pr view N --comments`                                          | madrapps/jacoco-report (backend unit + IT), vitest-coverage-report-action (frontend)   | Comment SEMPRE presente; valor é o estado  |
| Review comments (inline arq+linha) | `gh api repos/:owner/:repo/pulls/N/comments`                       | reviewdog: Spotless, PMD CPD, ESLint, jscpd                                            | Ausência = SEM violação = saudável         |

Confundir os dois leva a erros como "não vi comment de duplicação, deve estar quebrado" — quando é o oposto.

## Workflow padrão

1. `gh pr checks N` — quais jobs falharam ou estão pendentes? (jobs nomeados `backend-quality-gate` / `frontend-quality-gate`)
2. `gh pr view N --comments` — coverage atual vs threshold (sticky)
3. `gh api repos/:owner/:repo/pulls/N/comments --jq '.[] | {path, line, body}'` — violações inline
4. Decidir ação a partir do que viu (não do que deduziu do código):
   - Coverage abaixo do threshold → ITs/unit novos OU exclude justificado no JaCoCo (ver heurística)
   - Spotless/ESLint → format/fix
   - Duplicação (CPD/jscpd) → refatorar; suprimir só com motivo documentado
5. Após push, reler 3 e 2 para confirmar que violações sumiram

## Heurística: cobertura — falso positivo vs gap real

| Sinal de falso positivo                         | Sinal de gap real                                    |
|-------------------------------------------------|------------------------------------------------------|
| Java `record` puro, sem comportamento           | Lógica condicional não exercitada                    |
| DTO/value object sem método                     | Repository com SQL não validado contra banco         |
| Wrapper de exception sem lógica                 | Filter/interceptor cuja cadeia HTTP só é mockada     |
| Spring Boot main / `*Application*`              | Service com branches sem teste                       |

- **Falso positivo:** adicionar a `<excludes>` do JaCoCo no `backend/pom.xml`. NÃO suprimir no IT.
- **Gap real:** escrever IT que exercita o caminho real (HTTP → Spring → infra de Testcontainers).

## Ferramentas esperadas no ambiente

- `gh` CLI autenticado (`gh auth status`)
- `jq` para filtrar JSON de `gh api`
- Se for inspecionar CPD localmente: `xmlstarlet` (já usado no workflow)
