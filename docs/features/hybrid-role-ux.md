# UX do usuário híbrido (síndico + morador)

**Data:** 2026-05-23
**Branch:** `feat/ux-show-password-toggle-login` (mesma branch da iteração corrente)
**Spec relacionada:** `docs/condo-vote-principles.md:17` — "Um síndico pode simultaneamente ser proprietário de uma unidade no mesmo condomínio".

## Decisão

Tratar o usuário híbrido como **identidade composta**, não como dois logins.
Sem "modo de papel" no login, sem toggle global. UI mostra todas as ações
disponíveis, agrupadas por intenção, com sinalização clara da composição.

Justificativa completa em `~/.claude/plans/eu-quero-que-voc-noble-mango.md`
(plano discutido e refinado em chat).

## O que foi entregue

### Chip de papel no `AppHeader`
- Posição: ao lado do nome do condomínio ativo, oculto em `<sm` (consistente
  com a label do condo).
- Não interativo (`role="status"`); cor `bg-secondary-container` /
  `text-on-secondary-container` (par M3 semântico, não `primary`).
- Label visual: `Síndico · Proprietário` (ordem canônica ADMIN→OWNER→TENANT).
- `aria-label` natural: `Seus papéis neste condomínio: Síndico e Proprietário`
  (separador `·` é puramente visual e SR não verbaliza).

### `CondominiumDashboard`
- Layout **plano** (papel único): grid atual preservado, sem cabeçalhos.
- Layout **híbrido** (`ADMIN + OWNER` ou `ADMIN + TENANT`):
  - Duas `<section aria-labelledby>` com `<h2>` "Gerenciar" e "Participar".
  - Ordem dinâmica por urgência:
    - `pendingBallotsCount > 0` → **Participar** primeiro (Goal-Gradient).
    - Senão → **Gerenciar** primeiro (identidade primária do síndico-morador é
      administrativa).
  - **Card "Criar votação"** novo em *Gerenciar* (CTA `add_circle` →
    `/polls/new`). Resolve a ambiguidade do plano original que combinava
    "criar e participar" no mesmo card (violava Hick's Law).
  - Card *Apartamentos* aparece em ambas as seções com legendas adaptadas:
    *Participar* → "Acesse o seu apartamento" / *Gerenciar* → "Gerencie unidades
    e inadimplência".
- Badge de cédulas pendentes (já existente): adicionado `aria-label` legível
  ("3 cédulas pendentes de voto").

### Seed
- `R__seed_dev.sql`: `sindico@local.dev` agora é também OWNER de A101 no
  Condomínio Teste Local. Permite smoke test do caso híbrido.

## O que foi validado em smoke test (automatizado)

- 19 testes Vitest passando (`app-header.spec.ts` + `condominium-dashboard.spec.ts`),
  cobrindo a matriz: OWNER puro, ADMIN puro, ADMIN+OWNER com 0 pendentes,
  ADMIN+OWNER com 3 pendentes, singular vs plural no aria-label, heading order.
- Suíte completa: **414/414 passando**.
- `tsc --noEmit -p tsconfig.app.json`: limpo.
- ESLint nos arquivos tocados: limpo.

## O que ainda falta validar (smoke manual + pré-prod)

- [ ] **Smoke manual local** com `sindico@local.dev` no Condomínio Teste Local
      (perfil híbrido pós-seed): chip "Síndico · Proprietário" visível,
      ordem das seções no dashboard correta, navegação para "Criar votação"
      funciona.
- [ ] **Light + Dark mode**: confirmar contraste do chip em ambos os temas
      (par M3 garante por design — confirmar visual).
- [ ] **A11y manual**: navegação por Tab (chip não captura foco), VoiceOver
      verbaliza chip e badge corretamente.
- [ ] **Viewport 360px**: sem scroll horizontal; seções empilham.
- [ ] **Lighthouse a11y** na rota `/app/condominiums/<id>` no perfil híbrido
      (alvo ≥95).
- [ ] **Usuário híbrido em múltiplos condomínios com papéis distintos** (ex.:
      ADMIN no condo A, OWNER no condo B) — chip deve refletir o condo ATIVO,
      não a união.

## Edge cases conhecidos não-bloqueantes

- Usuário com papéis `OWNER + TENANT` (raro/inválido no domínio) → chip ainda
  renderiza ("Proprietário · Inquilino"). O domínio não previne isso
  estruturalmente; deixar implícito até virar problema real.
- Síndico-morador que vota em poll que ele mesmo criou: já permitido pelo
  invariante "voto pertence ao apartamento". A UI de detalhe do poll não
  diferencia o voto dele dos demais — comportamento correto (auditoria é
  agregada por padrão).

## Decisões explicitamente fora de escopo

- Sem prompt jurídico de "assinar como síndico vs como condômino" — será
  contextual à ação (ex.: assinatura de ata) quando essa feature existir.
- Sem mudança em `adminGuard`, rotas ou permissões — o modelo já tratava
  papéis como conjunto não-exclusivo.
- Sem mudança em fluxo de notificações por e-mail — síndico-morador recebe
  ambos canais (admin + cédula pendente); é o comportamento correto.

## Pré-requisitos para validar em produção

- `R__seed_dev.sql` é só local — produção precisará de um usuário híbrido
  real (síndico que adquiriu unidade) para validação end-to-end.
- Nenhum mudança de DNS, secrets ou infra necessária.
