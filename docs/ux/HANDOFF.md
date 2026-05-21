# HANDOFF — Redesign UX/UI do condo-vote-app

> **Para o próximo Claude (Opus recomendado para decisões estéticas, Sonnet para PRs mecânicos).**
> Este documento é auto-contido — você não precisa rolar histórico. Leia até o fim antes de qualquer ação.

---

## 1. Estado atual em uma frase

Pacote **P0 (6 PRs bloqueadores)** do redesign está **mergeado** em `feat/ux-unificar-votacoes-dashboard` (HEAD `ec39b95`). Próximo passo é **PR-07 (paleta + tipografia + warm surface)** — mas **NÃO comece direto**: entre em **modo plano primeiro** para refinar identidade visual + paleta (light + dark) com o usuário (ver §5.0).

---

## 0. ⚠️ Mudança de escopo: dark mode entra na v1

Decisão revertida do usuário: **dark mode AGORA está no escopo da v1.**

Razão: implementar dark mode depois custa caro (re-testar contraste em todos os tokens, ajustar sombras, refatorar componentes). Mais barato pensar nas duas variantes juntas no momento de definir a paleta.

**Implicação prática:** o PR-07 cresce — vira "paleta light + dark + tipografia + warm surface". E **antes** de implementar, é obrigatório uma sessão de **modo plano** com o usuário para:

1. **Refinar identidade visual.** O proposal atual (Fraunces + Geist + warm `#FAFAF7` + primary `#1B3FBE`) é um ponto de partida do Agent 2 — não foi validado em variações. Apresentar 2–3 direções alternativas e deixar o usuário escolher.
2. **Escolher paleta dupla coerente.** Cada token precisa de variante dark com contraste WCAG AA contra `--color-surface` dark. Definir os 2 conjuntos juntos previne "patch dark mode" depois.
3. **Definir gatilho.** `prefers-color-scheme: dark` automático? Toggle manual? Persistência onde (não em localStorage por convenção do projeto — definir alternativa)?

---

## 2. Onde tudo vive

| Tipo | Caminho | O quê |
|---|---|---|
| Jornadas reais (Agent 1) | `docs/ux/user-journeys.md` | 18 rotas, 8 passos por persona, 15 gaps observados |
| Proposta estratégica (Agent 2) | `docs/ux/redesign-proposal.md` | 8 seções, 11 URLs reais, plano de 16 PRs |
| Padrões para subagent | `docs/ux/subagent-brief.md` | Stack, skills, modelo por PR, git workflow |
| Esta página | `docs/ux/HANDOFF.md` | Você está aqui |
| Spec do produto | `docs/condo-vote-principles.md` | Atores, quórum, LGPD, sigilo |
| Status do projeto | `docs/STATUS.md` | Fase 7 H1–H8 entregues |
| Convenções de código | `docs/coding-patterns.md` §Frontend | SOLID, smart/dumb, design tokens |
| Restart do stack | `CLAUDE.md` §"Restart completo" | Comandos para subir/parar tudo |

**Leia nesta ordem antes de tocar código:**
1. `docs/ux/subagent-brief.md` (3 min — padrões e decisões já tomadas)
2. `docs/ux/redesign-proposal.md §§ 3, 4, 8` (essência do que entregar)
3. `docs/ux/user-journeys.md §7` (problemas identificados)

---

## 3. Decisões já tomadas (NÃO reabrir)

- **Tipografia:** **Fraunces** (display, Google Fonts variable) + **Geist Sans** (texto, free).
- **Sair do Inter** — Inter é AI-slop por excelência (regra da skill `frontend-design`).
- **Background warm `#FAFAF7`** (substitui `#f7f9fb` azulado-frio).
- **Primary `#1B3FBE`** — contraste 8.4:1 ✅ AAA.
- **Dark mode:** **NA v1** (decisão revertida — ver §0). Light e dark devem ser desenhados juntos no momento da paleta.
- **Angular Material:** **não migrar.** Tailwind v4 `@theme` como fonte única.
- **Ordem de PRs:** §8 do `redesign-proposal.md` (PR-01 → PR-16).
- **Screenshot tests (Playwright/Percy):** não investir agora; smoke manual basta.
- **Sem co-author em commits.** Convenção do repo.

---

## 4. O que já foi entregue (P0 — mergeado em `34cbfe1`)

| Commit | PR | Mudança | Onde validar visualmente |
|---|---|---|---|
| `1cfd3c1` | PR-01 | Landing copy honesta (remove ata PDF / assinatura digital) | http://localhost:4200 |
| `a4782f8` | PR-02 | Tokens `--color-warning-*` + `--color-info-*` | Banner amarelo de inadimplência em `BallotVotePage` |
| `d418d99` | PR-05 | Validator `endBeforeStart` cruzado em form de poll | Criar poll com end < start |
| `318563f` | PR-03 | `<app-confirm-dialog>` + elimina `window.confirm()` | Síndico → poll DRAFT → Publicar/Abrir/Encerrar |
| `07c8733` | PR-04 | SuccessPopup com Esc + role=alertdialog (versão antiga, c/ OK) | — substituído pelo polish |
| `2d140f2` | PR-06 | Banner de erro quando breakdown JSON corrompido | Só com dado corrompido (forçado) |
| `84c05e4` | — | `@let` para narrowing do signal no template | Sem efeito visível, fix de compile |
| `1318b9c` | — | SuccessPopup sem botão OK, 2500ms, fade-out suave | Morador → vota → vê popup |
| `2b4e43d` | — | Fade-in/fade-out unificado em `<app-dialog>` + "Votar" pill | Toda dialog + detalhe de poll |

**Estado dos testes:** 388 passed. Lint limpo. CPD OK.

---

## 5. Próximo passo: PR-07 (paleta light + dark + tipografia + warm)

### 5.0 OBRIGATÓRIO antes de tocar código — modo plano

Entre em **modo plano** (`ExitPlanMode` no final) e conduza uma sessão de refinamento com o usuário:

1. **Apresentar 2–3 direções de identidade visual** (não só a do Agent 2). Para cada uma:
   - Par tipográfico (display + texto). Ex: A) Fraunces + Geist Sans · B) Instrument Serif + Inter Display · C) Editorial New + Söhne (paid).
   - Paleta primária + warm/cool/neutral surface.
   - Tom: "editorial sóbrio", "tech-friendly clean", "institucional confiável", etc.
   - Mockup descritivo (ASCII ou prose) de hero + card de poll.
2. **Para a direção escolhida, definir paleta DUPLA:**
   - Light: surface, on-surface, primary, success, error, warning, info + containers + variants.
   - Dark: mesmo conjunto, com contraste WCAG AA mínimo recalculado contra dark surface.
   - Usar oklch() ou hex — escolha por consistência (Tailwind v4 aceita ambos).
3. **Definir gatilho do dark mode:**
   - `prefers-color-scheme` automático? Ou toggle explícito?
   - Persistência: localStorage NÃO é convenção do projeto (`TenantService` é em memória — ver `docs/coding-patterns.md`). Alternativas: cookie, signal global sem persist (perde no F5), backend prefs.
4. **Pesquisar referências atuais** (use WebFetch/WebSearch + context7 para Tailwind v4 dark variants):
   - Linear, Vercel, Stripe, Resend dark modes.
   - Material 3 dark theme tokens.
   - Tailwind v4 `@theme` + `@media (prefers-color-scheme: dark)` patterns.
5. **Gerar `docs/ux/visual-identity-decision.md`** com a direção escolhida + paleta dupla + decisões de motion/elevation que mudam no dark.
6. **Só então** sair do plan mode e executar o PR-07.

**Skills obrigatórias durante o plan mode:**
- `ui-ux-master` (rigor WCAG AA em ambas paletas)
- `frontend-design` (direção estética distintiva)

### 5.1 PR-07 — Resumo do que muda (após decisões do §5.0 estarem em `visual-identity-decision.md`)

- `frontend/src/styles.scss` — bloco `@theme { ... }` reescrito com paleta **light + dark** validada no plan mode, tokens de tipografia/spacing/raios/elevação novos. Dark via `@media (prefers-color-scheme: dark)` ou variant Tailwind v4 (decidido em §5.0).
- `frontend/src/index.html` — link Google Fonts para o par tipográfico escolhido em §5.0 (preconnect + display=swap).
- Componentes que usam classes Tailwind hardcoded de cor — auditar e migrar para utility classes que apontam para tokens novos.
- **Validar visualmente light AND dark** em pelo menos 6 telas (landing, login, home, criar poll, votar, success).

### Modelo recomendado

**Opus 4.7.** É decisão estética sutil, não PR mecânico. Não rebaixe para Sonnet.

### Skills obrigatórias

Logo no primeiro turno, invocar via Skill tool:
- `ui-ux-master` — Refactoring UI, Laws of UX, WCAG 2.2 AA, ARIA APG, Material 3.
- `frontend-design` — direção estética distintiva (evitar AI slop).

### Risco principal

**Regressão visual em todas as telas.** Sem screenshot tests, o smoke é manual. Antes de commitar:
1. Subir o app local.
2. Navegar: landing → login → home → apartamentos → convites → criar poll → detalhe de poll → votar.
3. Confirmar que nenhuma tela ficou ilegível (contraste perdido, texto cortado, hierarquia quebrada).

### Critérios de aceite do PR-07

- `docs/ux/visual-identity-decision.md` existe e foi aprovado pelo usuário no plan mode.
- `npm run lint && npm run test:ci && npm run cpd` passa (388+ testes).
- Lighthouse a11y sem regressão de contraste em **light E dark**.
- Nenhum `#hex` ou `rgb(` hardcoded em componente (`grep -rn '#[0-9a-fA-F]\{3,6\}\|rgb(' frontend/src/app --include='*.ts'`).
- Visual smoke em **light E dark** em landing + login + dashboard + criar poll + votar.

---

## 6. Workflow recomendado para começar

### Setup de worktree (recomendado, isola risco do PR-07)

```bash
cd /Users/gabrieljarufe/Developer/projects/condo-vote-app

# remove worktree antiga do P0 (se ainda existir e estiver vazia)
git worktree remove ../condo-vote-app-ux-redesign-p0 2>/dev/null
git branch -d worktree-ux-redesign-p0 2>/dev/null

# cria fresh partindo do feat atualizada
git worktree add ../condo-vote-app-ux-redesign-p1 -b worktree-ux-redesign-p1 feat/ux-unificar-votacoes-dashboard

# copia .env.local (gitignored)
cp .env.local ../condo-vote-app-ux-redesign-p1/

# entra na worktree
cd ../condo-vote-app-ux-redesign-p1
```

### Restart do stack (do `CLAUDE.md`)

```bash
# 1. matar frontend órfão
lsof -ti :4200 -sTCP:LISTEN 2>/dev/null | xargs -I{} kill {} 2>/dev/null

# 2. derrubar containers de outras worktrees, se houver
docker rm -f condo-vote-backend condo-vote-redis 2>/dev/null

# 3. supabase já deve estar rodando (compartilhado); se não:
cd infra/supabase && supabase start && cd -

# 4. backend
docker compose up --build -d backend

# 5. frontend
cd frontend && npm ci && npm start
```

Aguardar:
- http://localhost:4200 (frontend)
- `curl -s http://localhost:8080/actuator/health/liveness` → `"status":"UP"`

### Credenciais de seed

- Síndico: `sindico@local.dev` / `password123` (condo Pitufos `019dd4f8-57fa-77b1-ace2-c9f6a3d9811e`)
- Inbucket (e-mails locais): http://localhost:54324
- Supabase Studio: http://localhost:54323

### Para criar morador de teste

1. Logue como síndico → convide um e-mail novo.
2. Abra Inbucket → siga o magic link.
3. Complete cadastro (CPF válido ex: `390.533.447-05` + senha `password123`).

---

## 7. Roadmap dos próximos PRs (após PR-07)

Ordem completa em `redesign-proposal.md §8`. Resumo:

| PR | Esforço | Modelo | O quê |
|---|---|---|---|
| **PR-07** | L | Opus | Paleta + tipografia + warm surface ⬅️ **PRÓXIMO** |
| PR-08 | M | Sonnet | Tokens motion M3 + `prefers-reduced-motion` global |
| PR-09 | M | Sonnet | Componente `app-button` consistente |
| PR-10 | M | Sonnet | `app-banner` (inadimplência, erro parcial, info) |
| PR-11 | M | Sonnet | Header com Convites + breadcrumb role-aware |
| PR-12 | M | Sonnet | Paginação em convites + correção terminologia |
| PR-13 | L | Opus | `BallotCard` editorial + View Transitions cédula→revisão |
| PR-14 | M | Sonnet | Empty states com CTAs + ilustrações SVG |
| PR-15 | L | Opus | `app-data-table` responsivo (card em <640px) |
| PR-16 | M | Sonnet | "Esqueci a senha" |

**Recomendação prática:** PRs L em worktrees isoladas. PRs M/S podem encadear na mesma worktree.

---

## 8. Detalhes não-óbvios aprendidos nesta sessão

- **Tailwind v4 `@theme`:** classes utility como `bg-warning-container` só funcionam se o token `--color-warning-container` existir no bloco `@theme`. PR-02 fechou esse bug. Ao adicionar tokens novos no PR-07, confira que cada classe usada no codebase tem token correspondente.
- **Angular `@let` (v18+)** resolve narrowing de signals dentro de templates. Use sempre que precisar do mesmo signal em múltiplas branches de `@if`/`@else if`.
- **Vitest + TestBed exige `--no-file-parallelism`** — sem isso, vários NG0303 falsos. Configurado no `package.json`.
- **Signal inputs (`input.required()`) não funcionam em componentes substituídos via `overrideComponent`** — use `@Input()`/`@Output()` clássicos em componentes dumb que serão stubados.
- **Flyway divergência entre worktrees:** se o `flyway_schema_history` ficar dessincronizado (ex: migration renomeada), o backend não sobe. Solução documentada no `CLAUDE.md §"Restart completo"`: `supabase db reset` (perde dados locais).
- **Conflito de container Docker entre worktrees:** o compose project name é derivado do path; duas worktrees subindo geram `Container name already in use`. Antes de subir, `docker rm -f condo-vote-backend condo-vote-redis`.
- **Race condition entre subagents paralelos:** PR-04 e PR-05 commitaram no mesmo arquivo (`success-popup.ts` ficou no commit do PR-05). Não bloqueia funcionalidade, mas atrapalha história. Se for disparar subagents paralelos no PR-08+, garanta que cada um toque arquivos **disjuntos** ou serialize.

---

## 9. Padrões do projeto (sumário para não reabrir docs)

### Stack
Angular 21.2 standalone · Tailwind v4 via `@theme` · Vitest · TypeScript strict.

### Naming
Components sem sufixo `.component` (Angular CLI 20+ default).

### Forms
Reactive Forms + `<app-form-field>`. Nunca template-driven.

### State
Signals. Smart/dumb split: pages em `features/<dominio>/*-page.ts`, reusáveis em `shared/ui/`.

### Tokens
Sempre via classe Tailwind (`bg-primary`) ou `var(--color-*)` em SCSS. Nunca `#hex` em componente.

### A11y
- Focus visible em todo controle (ring global já existe).
- Target size mínimo 44×44px.
- `role="alertdialog"` para confirmações destrutivas.
- `prefers-reduced-motion` honrado em qualquer `transition`/`animation`.

### Testes
Cobertura ≥ 70% por arquivo modificado (CI bloqueia). UT obrigatório em toda classe com lógica.

### Git
- Convencional commits (`feat(ux): ...`, `fix(ux): ...`, `refactor(ux): ...`).
- **Sem co-author Claude.**
- Scan de secrets antes de todo commit (script em `CLAUDE.md §Secrets`).
- PR final para `develop` (não `main`). Auto-PR `develop → main` via workflow.

---

## 10. O que NÃO está no escopo deste handoff

- Backend changes (regras de domínio, novas migrations, endpoints) — fora do redesign UX.
- Refactor de arquitetura — Angular Material, NgRx, NgModules, etc. — todas decisões já foram negadas.
- Mudanças de produto que afetem `condo-vote-principles.md` — discutir com o usuário antes.
- Internacionalização — projeto é PT-BR only por enquanto.

---

## 11. Prompt sugerido para abrir a próxima sessão

Cole o texto abaixo (o `@docs/ux/HANDOFF.md` carrega automaticamente este arquivo no contexto da nova sessão):

> Continue o redesign UX do condo-vote-app. Leia @docs/ux/HANDOFF.md (é auto-contido). Antes de qualquer código, entre em **modo plano** e conduza a sessão descrita na §5.0 do HANDOFF (refinar identidade visual + paleta light + dark + gatilho). Apresente 2–3 direções de identidade para eu escolher; gere `docs/ux/visual-identity-decision.md` com a decisão; só então saia do plan mode e implemente o PR-07. Modelo: Opus 4.7. Invoque `ui-ux-master` + `frontend-design` logo no início.
