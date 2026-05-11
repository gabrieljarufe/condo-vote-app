# Workflow de desenvolvimento de história — Fase 7

> **Leia este arquivo antes de iniciar qualquer história (H1-H10).**
>
> Guia canônico para implementar cada história com assistência do agente Claude.
> Lição da H0 (refactor `MULTIPLE` → `roles: Set<UserRoleInCondo>`):
> **incoerências entre spec, data-model e código só explodem na implementação.**
> A Fase 2 (audit) abaixo é o que evita o próximo "MULTIPLE".

---

## Visão geral — as 6 fases

| Fase | Tempo médio | Quem executa |
|---|---|---|
| 1. Escrever a história | 15-20min | Você + Claude |
| 2. Audit de coerência ⭐ | 10-15min | Subagent (Plan ou Explore) |
| 3. Quebrar em tasks | 5-10min | Você + Claude |
| 4. Plano de execução | 5min | Subagent (writing-plans) |
| 5. Implementar | 1-3 dias | Subagents (subagent-driven-development) |
| 6. Verificação + PR | 30min | Você + Claude |

Custo médio antes de codar: ~30min. **Barato** comparado ao retrabalho de descobrir um `MULTIPLE` no meio do código.

---

## Fase 1 — Escrever a história (15-20min)

**Quem:** você + Claude (com `superpowers:brainstorming` se houver dúvida de escopo).

**Passos:**
1. Copiar `docs/implementation/tasks/phase-7/template.md` → `phase-7/h{N}-{slug}.md`
2. Preencher seções 1-5 do template (História, Motivação, Critérios, Escopo, Fora de escopo) lendo:
   - `docs/condo-vote-principles.md` — spec do produto
   - `docs/data-model.md` — ERD/RLS
   - `docs/coding-patterns.md` — padrões backend
3. **Não preencher Tasks (seção 6) ainda** — depende do audit da Fase 2

**Saída:** história escrita até a seção "Fora de escopo".

---

## Fase 2 — Audit de coerência (10-15min) ⭐

**A etapa que evita o próximo "MULTIPLE".**

**Quem:** Claude com subagent `Plan` (preferido) ou `Explore`.

### Pergunta canônica para o agente

Cole isso no prompt do subagent (substituindo `[H_N]` pelo identificador):

> "Para implementar a história [H_N] descrita em `docs/implementation/tasks/phase-7/h{N}-{slug}.md`, compare a spec (`docs/condo-vote-principles.md`), o data-model (`docs/data-model.md`) e o código existente. Identifique:
>
> 1. **Backend gap** — endpoints, queries ou services que faltam
> 2. **Frontend gap** — componentes, services ou rotas que faltam
> 3. **Banco gap** — migrations Flyway que faltam (tabelas, colunas, índices, constraints)
> 4. **Refactor pré-requisito** — decisões da spec que conflitam com o data-model atual ou com o código
> 5. **RLS risk** — áreas onde row-level security pode silenciosamente quebrar com dados reais multi-tenant
> 6. **Performance risk** — índices ausentes para queries previstas
> 7. **State risk** — estado em memória (signals, sessionStorage) que vai resetar no F5 e quebrar a UX
> 8. **Cross-history risk** — esta história depende de algo que outra história ainda não entregou?
>
> Consulte a `Watch list` em `docs/implementation/tasks/phase-7/workflow.md` para gaps já suspeitos."

### Saída esperada

Lista categorizada por tipo. Para cada item:
- Severidade (bloqueador / atenção / nice-to-have)
- Arquivo/linha de referência
- Sugestão de fix

### Decisão

- Se houver **refactor pré-requisito** (categoria 4), criar uma **`H{N}.0`** que vira **PR separado ANTES** da história principal (mesmo padrão da H0).
- Se houver gaps menores (categorias 1-3, 5-8), incorporar como tasks na Fase 3.

---

## Fase 3 — Quebrar em tasks (5-10min)

**Quem:** você + Claude (sem subagent — decisão sua, Claude só formata).

**Passos:**
1. Preencher seção 6 (Tasks) do template baseado no audit
2. Cada task deve ter ~1-3 horas de trabalho
3. Marcar dependências entre tasks (T2.1 bloqueia T2.3, etc.)
4. Cada task deve ter:
   - Arquivos a alterar/criar
   - Verificação (comando para rodar)
   - Critério de aceite

---

## Fase 4 — Plano de execução com worktree (5min)

**Quem:** Claude com `superpowers:writing-plans`.

Gerar plano de execução tipo o do H0 (`crispy-newt`/`shimmering-shore`):
- Branch sugerida (ex.: `feat/h2-cadastrar-apartamento` para feature; `chore/h2-0-indices` para refactor pré-requisito)
- Worktree path
- Tasks numeradas com ordem e dependências
- Verificação por task + verificação final do PR
- Saída esperada (URLs dos PRs)

---

## Fase 5 — Implementar (1-3 dias por história)

**Quem:** Claude com `superpowers:subagent-driven-development` + `superpowers:using-git-worktrees`.

### Padrão H0 (provado)

Para cada task do plano:

```
1. Implementer subagent (general-purpose, sonnet/haiku conforme complexidade)
   ├── Recebe contexto completo + arquivos pré-lidos pelo controller
   ├── Implementa, testa, commita
   └── Self-review

2. Spec compliance reviewer (general-purpose)
   ├── Verifica que matched o que foi pedido (nada a mais, nada a menos)
   └── Se falha → implementer corrige → re-review

3. Code quality reviewer (general-purpose)
   ├── Verifica qualidade técnica (clean code, testes, padrões)
   └── Se falha → implementer corrige → re-review

4. Marca task completa
```

### Convenção de commits

| Prefixo | Quando usar | Bumpa versão? |
|---|---|---|
| `feat:` | Entrega valor visível ao usuário final | ✅ minor bump |
| `fix:` | Bug em produção | ✅ patch bump |
| `chore:` | Refactor, build, deps, tests | ❌ não bumpa |
| `docs:` | Apenas documentação | ❌ não bumpa |
| `refactor:` | Reestruturação de código sem mudança de comportamento | ❌ não bumpa |
| `test:` | Apenas testes | ❌ não bumpa |

**Regra:** refactor pré-requisito (`H{N}.0`) usa `chore:` para não bumpar versão antes da feature entregar valor.

---

## Fase 6 — Verificação local + PR (30min)

**Backend:**
```bash
cd backend && ./mvnw verify
```
- Spotless verde
- Todos os UT + IT passando
- Cobertura JaCoCo: arquivos alterados ≥ 70%, overall ≥ 50%

**Frontend:**
```bash
cd frontend && npm run lint && npm run test:ci
```
- ESLint zero warnings
- Vitest 100% verde

**PR:**
```bash
gh pr create --base develop --title "<título>" --body "..."
```

**Pós-PR:**
- Atualizar `docs/STATUS.md` com descobertas não-óbvias da história (no MESMO PR)
- Atualizar `docs/implementation/tasks/phase-7/index.md` mudando status da história para ⏳ → 🔶 (em review) ou ✅ (após merge)

---

## Watch list — gaps já suspeitos (use no audit da Fase 2)

Estes são candidatos a `H{N}.0` identificados em pré-análise. **Não são certeza** — são red flags para o audit considerar.

| História | Gap suspeito | Por que é red flag |
|---|---|---|
| **H2** (cadastro de apartamento) | Índice composto em `apartment(condominium_id, unit_number)` | Query "lista apartamentos do condo" pode fazer full scan |
| **H3** (convite) | Job de expiração 24h não existe | Spec diz "expira em 24h" mas nenhum `@Scheduled` existe; sem isso, status fica `PENDING` forever |
| **H3/H4** (convite + onboarding) | Chave `CPF_ENCRYPTION_KEY` rotaciona entre staging/prod? | Se chaves diferem, convite criado em staging não valida em prod (e vice-versa) |
| **H5** (listagem residências) | `TenantService` perde estado no F5 | `activeCondominiumId` é em memória (decisão arquitetural). Se H5 assume contexto, F5 zera tudo. Pode precisar de redirect para Home |
| **H6** (delegação + promoção) | Bloqueio durante poll OPEN | Spec/CLAUDE.md já registra como invariante, mas backend precisa enforcement explícito (não há check hoje) |
| **H7** (criar votação) | `poll_eligible_snapshot` write-once | Spec diz "snapshot fixo na transição SCHEDULED→OPEN". Sem trigger ou aspect garantindo, alguém pode atualizar acidentalmente |
| **H7** | "Marcar apartamento como inadimplente" não tem história | Spec diz síndico marca, mas não há `H_inadimplência`. Vai virar tarefa de H2 ou H7.0 |
| **H8** (votar) | Imutabilidade de voto | PK protege duplicata mas não revote via DELETE+INSERT. Aspect ou trigger pode ser necessário |
| **H8** | Cálculo de quórum | Onde mora a lógica? Service? View materializada? Função PostgreSQL? Não decidido em `coding-patterns.md` |
| **H9** (auditoria UI) | Performance da timeline | `audit_event` cresce ilimitado. Sem paginação cursor-based + índice em `(condominium_id, occurred_at DESC)`, página trava em ~10k eventos |
| **H10** (jobs agendados) | Onde rodar `@Scheduled`? | Coolify backend é stateless single-instance? Se escalar para 2 réplicas, jobs duplicam. Precisa lock distribuído (Redis) ou ShedLock |

**Como usar:** ao entrar em uma história, a Fase 2 (audit) deve confirmar/descartar cada item desta lista que toca aquela história. Atualize esta tabela conforme novos gaps forem descobertos.

---

## Ordem recomendada de execução

Baseado em (a) dependências entre histórias, (b) risco técnico, (c) valor de negócio:

1. **H1** — finalizar T1.7 (smoke test prod) → fecha o walking skeleton. Já ~90% pronto.
2. **H2** — cadastro de apartamento. Primeira história com aggregate novo (`Apartment`). Valida padrões: novo controller/service/repository + RLS isolation + índices.
3. **H7.0 (inadimplência)** — toggle `apartment.is_delinquent`. Pequena, mas necessária ANTES de H7 (votação precisa filtrar inelegíveis).
4. **H3 + H4** (juntas, fatiadas em PRs) — convite + onboarding. Podem ir em pares (H3a backend, H3b email outbox, H4 frontend onboarding) se ficar grande.
5. **H5** — listagem de residências. Depende de H2 e H4 (precisa ter dados).
6. **H7** — criar votação. Pode iniciar em paralelo com H5 se aggregate `Poll` é independente.
7. **H8** — votar. Depende de H7 estar parcialmente pronto (poll OPEN).
8. **H6** — delegação + promoção. Depende de H5 (lista de residentes para escolher delegado). Bloqueio durante poll OPEN é interlock com H7+H8.
9. **H10** — jobs agendados. Pode rodar em paralelo com H6/H7/H8 se forem outros aggregates.
10. **H9** — auditoria UI. Read-only sobre `audit_event` que já é populado por todas as histórias anteriores. Última a entrar.

**Sinal de alerta:** se uma história demorar **>3 dias**, pause e re-faça o audit. Provavelmente apareceu um gap não previsto.

---

## Como usar Claude com eficiência (por fase)

| Fase | Skill / Subagent | Por quê |
|---|---|---|
| 1. Escrever história | `superpowers:brainstorming` (só se ambíguo) | Evita scope creep; força decisões antes de codar |
| 2. Audit de coerência | `Plan` agent ou `Explore` agent (1 só) | Plan é melhor para análise estrutural; Explore se precisa varrer muitos arquivos |
| 3. Quebrar em tasks | direto com Claude (sem subagent) | Decisão sua, Claude só formata |
| 4. Plano de execução | `superpowers:writing-plans` | Cria plano executável tipo `crispy-newt` |
| 5. Implementar | `superpowers:subagent-driven-development` + `superpowers:using-git-worktrees` | Padrão H0: implementer + spec-review + code-review por task |
| 6. PR + verificação | direto + `pr-quality-gates` se CI reclamar | `pr-quality-gates` é auto-invocado quando você pede análise de coverage/duplicação |

### Anti-padrões a evitar

- ❌ Pedir Claude para "implementar H2 e H3 juntas" — perde isolamento de PR e cresce blast radius
- ❌ Pular Fase 2 (audit) "porque a história parece simples" — foi exatamente isso que escondeu o `MULTIPLE` antes do H0
- ❌ Implementar sem worktree na branch atual — risco de conflito + perde isolamento de review
- ❌ Usar `fix:` ou `feat:` em commit de refactor pré-requisito (`H{N}.0`) — bumpa versão sem entregar feature

### Padrões a manter

- ✅ Worktree por PR (uma branch = uma worktree)
- ✅ `chore:` para refactor/teste; `feat:` só quando entrega valor visível ao usuário; `fix:` só para bugs em prod
- ✅ Atualizar `docs/STATUS.md` no MESMO PR que a história (descobertas não-óbvias)
- ✅ Cada história fecha com smoke test manual (não só CI)
- ✅ Sem `Co-Authored-By` em commits (convenção do projeto)

---

## Verificação — a estratégia está funcionando?

**Após H2 (primeira história não-trivial):**

- [ ] Fase 2 (audit) detectou pelo menos 1 gap real?
- [ ] PR ficou abaixo de 600 linhas alteradas?
- [ ] CI passou na primeira tentativa (ou só com fixes triviais)?
- [ ] `STATUS.md` ganhou uma descoberta não-óbvia?

**Se todas ✅:** a estratégia está calibrada.
**Se ≥2 ❌:** pause e ajuste — talvez aumentar tempo de Fase 2, ou diminuir escopo de tasks.

**Sinal de sucesso global (após H5):** velocidade aumenta porque os gaps já encontrados (H2, H3, H4) estabilizaram a base.

---

## Arquivos críticos para o workflow

| Arquivo | Quando usar |
|---|---|
| `docs/implementation/tasks/phase-7/template.md` | Copiar para criar nova história |
| `docs/implementation/tasks/phase-7/h1-login-home.md` | Exemplar — referência de como uma história fica completa |
| `docs/implementation/tasks/phase-7/index.md` | Atualizar status (✅/⏳/🔶) ao concluir cada história |
| `docs/condo-vote-principles.md` | Spec do produto — fonte de verdade nas Fases 1 e 2 |
| `docs/data-model.md` | ERD/RLS — fonte na Fase 2 (audit) |
| `docs/coding-patterns.md` | Como implementar — fonte na Fase 4 e 5 |
| `docs/STATUS.md` | Atualizar ao final da Fase 6 com descobertas não-óbvias |
| `CLAUDE.md` (invariantes) | Releitura no início de cada história — pega regras estruturais |

---

## Histórico — origem deste workflow

Este workflow foi destilado da experiência da **H0 implícita** (PR #56 + #57), que descobriu 3 incoerências estruturais entre spec/data-model/código antes de iniciar H2:

1. **Bootstrap quebrava cross-condo** — síndico em 2 condomínios gerava PK violation no `app_user`
2. **`MULTIPLE` colapsava informação** — frontend não sabia QUAIS papéis o usuário tinha, bloqueando guards de rota em H5/H6/H8
3. **`TenantService` sem `activeRoles`** — toda feature H2+ teria que duplicar lookup de papéis

Sem o audit prévio, esses 3 problemas seriam descobertos um a um durante a implementação de H2, H5 e H7 — provavelmente custando 2-3x mais tempo total.

**Lição:** dedicar 30min de audit antes de codar economiza horas de retrabalho. Este workflow institucionaliza essa prática.
