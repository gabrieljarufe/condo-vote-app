# Overhaul responsivo mobile (shell + bottom nav + tabelas→cards)

**Data:** 2026-06-08
**Branch:** `feat/ux-mobile-responsive-overhaul`
**Plano:** `~/.claude/plans/fizzy-meandering-lemon.md` (executado por sub-agents W1–W3 + integração W4).

## Problema

No mobile o app estava inutilizável em três frentes confirmadas no código:

1. **Tabelas `table-fixed` não reflowam.** `polls-table` (6 col), `apartment-list`
   (4 col, admin) e a tabela inline do morador em `apartments-page` (3 col) usavam
   `<table class="w-full text-sm table-fixed">` **sem fallback** — a 360px as colunas
   se esmagavam e o texto sobrepunha.
2. **Navegação sumia no mobile sem alternativa.** `app-header` marcava os links como
   `hidden sm:inline-flex` e não havia hambúrguer nem bottom nav — sem caminho para
   Votações no celular.
3. **Padding/alvos de toque fixos de desktop** (`px-6 py-12`, `p-6`, flex-row apertando).

## O que foi entregue

### Layout shell (`shared/layout/authenticated-shell.ts`)
- Renderiza `<app-app-header>` + `<router-outlet>` (com `pb-20 sm:pb-0`) + `<app-bottom-nav>`
  **uma única vez**. Carrega condomínios via `MeApiService.getCondominiums()` (padrão `toSignal`)
  e injeta em header e bottom-nav.
- `home.routes.ts` convertido de flat para **aninhado** sob `condominiums/:condoId` → shell.
  `tenantRestoreGuard` no pai cobre os filhos; `adminGuard` mantido por filho.
- **Correção crítica:** `app.config.ts` ganha `withRouterConfig({ paramsInheritanceStrategy: 'always' })`.
  Sem isso, ao aninhar, os 6 componentes que leem `route.snapshot.params['condoId']`
  (`polls-page`, `poll-detail/edit/create-page`, `ballot-vote/review-page`) e o redirect
  de `my-polls` receberiam `undefined`.

### Bottom nav (`shared/layout/bottom-nav.ts`)
- `sm:hidden fixed bottom-0`, `pb-[env(safe-area-inset-bottom)]`. Itens role-aware
  (Início / Votações / Apartamentos / Mais), `min-h-14`, `routerLinkActive` → `text-primary`
  + `aria-current="page"`.
- **"Mais"** abre bottom sheet (backdrop `bg-black/60`, convenção do `dialog.ts`) com nome
  do condo + chip de papel + Trocar (se `canSwitchCondo`) + Sair.
- Header mobile reduzido a logo + theme toggle; nome/papel/Trocar/Sair migram para o sheet.

### Tabelas → cards
- `polls-table`, `apartment-list` (admin), tabela inline do morador em `apartments-page`,
  e `invitation-list` ganham fallback: `<table class="hidden sm:table">` + lista de cards
  `sm:hidden` (`<ul class="flex flex-col gap-3">`) com os mesmos dados/badges.

### Responsividade transversal
- Containers `px-4 sm:px-6 py-6 sm:py-12`; cards `p-5 sm:p-6`; alvos de toque ≥44px
  (`min-h-11`); ações primárias `w-full sm:w-auto`; `paginator` com botões `min-h-11`.
- `index.html`: viewport `viewport-fit=cover`.

### Refactor: helper de chip de papel (`shared/layout/role-chip.ts`)
- `getOrderedRoles` / `getRoleChipLabel` / `getRoleChipAriaLabel` + `ROLE_LABELS_PT_BR`
  extraídos e compartilhados entre `app-header` e `bottom-nav` (remove duplicação que
  surgiria ao replicar a lógica do chip).

## O que foi validado em smoke test

### Automatizado
- **448/448 testes Vitest** verdes. Novos: `authenticated-shell.spec`, `bottom-nav.spec`,
  `role-chip.spec` (15 casos: 0/1/2/3 papéis, ordem canônica, `·` vs conjunção `e`).
  Specs existentes de `app-header`/`bottom-nav` passam sem alteração → a delegação ao
  helper preservou o comportamento.
- ESLint (`--max-warnings 0`) e jscpd (2.52% < 5%) verdes. Build de desenvolvimento compila.

### Smoke visual (Playwright, stack local de pé, login `sindico@local.dev`)
- 360/390px: **sem overflow horizontal** (scrollW == clientW) em dashboard, votações e
  apartamentos; **header único** em toda rota; bottom nav presente.
- 1024px: bottom nav some, header volta.
- Tabela de apartamentos (admin) renderiza como cards legíveis com dados reais.
- Sheet "Mais" abre com chip "Síndico · Proprietário"; mesmo chip idêntico no header desktop.
- Zero erros de console.

## O que ainda falta validar (smoke manual + pré-prod)

- [ ] **Tabela de votações → cards com dados reais.** O condo de seed não tem polls, então
      o caminho `polls-table` card-fallback só foi exercido por unit test, não no app rodando.
      Validar com um condo que tenha votações em `Em andamento`/`Todas`.
- [ ] **Convites → cards com dados reais** (`invitation-list`): mesma ressalva.
- [ ] **Light + Dark mode**: contraste de cards, bottom nav e sheet em ambos os temas.
- [ ] **A11y manual**: foco visível no bottom nav, `aria-current` lido, VoiceOver no sheet,
      `prefers-reduced-motion`.
- [ ] **Voto** (`ballot-card`/`ballot-vote-page`): espaçamento e botões full-width no fluxo real.
- [ ] **safe-area** em device com notch real (env(safe-area-inset-bottom) só observável em
      hardware/simulador, não no DevTools).

## Bugs conhecidos não-bloqueantes / dívidas

- `invitation-list.ts` segue com cobertura baixa (~31%, sem spec próprio — pré-existente).
  Não é gated (thresholds globais 50/40/50/50), mas merece spec ao mexer de novo.
- Badge de pendências no item "Votações" do bottom nav ficou fora de escopo (v1).

## Pré-requisitos para validar em produção

- Nenhuma mudança de DNS, secrets ou infra. Mudança puramente de frontend.
- `styles.scss` foi commitado junto: contém ajuste de tokens de tema (dark) que já estava
  no working tree antes do overhaul — não faz parte do escopo de responsividade, mas entrou
  no mesmo commit por decisão do usuário.
