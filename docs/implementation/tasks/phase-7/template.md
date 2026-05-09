# Template de história — Fase 7

> Copie este arquivo ao iniciar uma história nova. Renomeie para `h<n>-<slug-curto>.md` e preencha cada seção. Não invente formato — consistência permite ao Claude Sonnet imitar o padrão sem ambiguidade.

---

# H&lt;n&gt; — &lt;título curto&gt;

## História

Como **&lt;ator&gt;**, quero **&lt;ação&gt;** para **&lt;objetivo de negócio&gt;**.

## Motivação / contexto de produto

1–2 parágrafos. Por que esta história existe? Que regra da spec ela materializa?
Linkar [`docs/condo-vote-principles.md`](../../../condo-vote-principles.md) (seções relevantes) e [`docs/data-model.md`](../../../data-model.md) (tabelas afetadas).
Se a história tocar invariante do domínio (multi-tenant, snapshot, voto imutável, etc.), citar explicitamente — vide CLAUDE.md.

## Critérios de aceitação (Gherkin-lite)

Lista de cenários observáveis. Cada um deve ser testável manualmente e por IT.

- [ ] **Dado** &lt;estado inicial&gt; **quando** &lt;ação&gt; **então** &lt;efeito esperado&gt;
- [ ] **Dado** &lt;estado&gt; **quando** &lt;ação&gt; **então** &lt;efeito&gt;
- [ ] Caminho de erro: **dado** &lt;estado inválido&gt; **quando** &lt;ação&gt; **então** &lt;código de erro / mensagem&gt;

## Escopo técnico

- **Backend**
  - Endpoints REST (`METHOD /api/...` + status codes)
  - DTOs (request/response)
  - Aggregates afetados / criados
  - Services e regras
  - Repositories (queries SQL relevantes — **SQL não sai da camada repository**)
  - Migrations Flyway novas (`V<n>__descricao.sql`)

- **Frontend**
  - Rotas novas
  - Componentes (smart vs dumb)
  - Services Angular
  - Tokens de design já existentes que serão consumidos

- **Banco**
  - Tabelas/colunas novas
  - Índices necessários (cite o cenário de query que cada índice resolve)
  - Policies RLS (sempre `SET LOCAL app.current_tenant`)

- **Cobertura técnica F1–F8 que esta história consome**
  - Ex.: F2 (invitations) parcial — apenas criação; F8 — rate limit no endpoint público.

## Fora de escopo (explícito)

Listar o que parece relacionado mas fica para outra história — evita scope creep e ajuda o Sonnet a recusar pedidos que extrapolam o PR.

- Item X — fica para H&lt;m&gt;
- Item Y — fica para v2

## Tasks

- [ ] T&lt;n&gt;.1 — &lt;ação concreta&gt;
- [ ] T&lt;n&gt;.2 — &lt;ação concreta&gt;
- [ ] T&lt;n&gt;.k — Escrever testes UT + IT (cobertura ≥ 70% nos arquivos alterados)
- [ ] T&lt;n&gt;.k+1 — Smoke test manual em staging (`https://condovote.com.br` + `https://api.condovote.com.br`)
- [ ] T&lt;n&gt;.k+2 — Atualizar `docs/STATUS.md` (marcar história + listar não-óbvios descobertos)
- [ ] T&lt;n&gt;.k+3 — Atualizar este arquivo com ✅ nas tasks concluídas

## Definition of Done

- [ ] Todos os critérios de aceitação verdes em IT (Testcontainers + RLS isolada)
- [ ] UT cobrindo regras de negócio dos services
- [ ] Cobertura ≥ 70% nos arquivos alterados (`./mvnw verify` localmente antes do PR)
- [ ] Quality gates verdes no CI: Spotless, JaCoCo, PMD CPD, ESLint, jscpd, sonarjs
- [ ] Lint e tipos do frontend passando (`npm run lint && npm run test:ci`)
- [ ] Smoke test manual em staging com cenário do critério de aceitação principal
- [ ] `docs/STATUS.md` atualizado no mesmo PR
- [ ] Spec (`docs/condo-vote-principles.md`) atualizada **se** a história alterar regra de negócio
- [ ] Apêndice em [`index.md`](index.md) marcado com ✅ nas linhas F1–F8 cobertas
- [ ] PR aberto contra `develop` via `gh pr create` (não merge local, não push direto)

## Como executar (delegação ao Sonnet)

Ao iniciar a implementação:

1. Ler `docs/coding-patterns.md` antes de qualquer código.
2. Aplicar TDD — UT primeiro, depois IT, depois implementação.
3. Usar `context7` (MCP) ao tocar Spring Data JDBC, Spring Boot 4, Angular 21, Tailwind v4, Bucket4j, Resend, siv-mode — training data pode estar desatualizada.
4. Seguir `Controller → Service → Repository`. SQL nunca sai do repository.
5. Aggregates têm métodos de negócio; services orquestram; controllers só traduzem HTTP.
6. Multi-tenant: toda query de domínio roda dentro de transação com `SET LOCAL app.current_tenant`.
7. Commit em português, imperativo curto. **Nunca** incluir `Co-Authored-By` nos commits.
8. PR alvo `develop` via `gh pr create`. Skill `pr-quality-gates` ajuda a interpretar reviewdog/coverage no PR.
