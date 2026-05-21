# Proposta de Redesign UX/UI — Condo Vote

> **Metodologia.** Documento estratégico produzido após leitura de `docs/ux/user-journeys.md`, `frontend/src/styles.scss`, `frontend/src/app/shared/ui/**`, `frontend/.postcssrc.json`, `docs/condo-vote-principles.md` e `docs/coding-patterns.md`. As skills **`ui-ux-master`** (rigor técnico: Refactoring UI, Laws of UX, WCAG 2.2 AA, ARIA APG, Material 3) e **`frontend-design`** (direção estética distintiva, evitar AI slop) foram **explicitamente invocadas** antes de qualquer recomendação e moldam a postura deste documento.
>
> **Escopo.** Este é um documento de proposta. **Não há código de implementação.** Cada decisão cita a heurística que a sustenta. Cada URL em §6 foi consultada por WebFetch/WebSearch — não há referência inventada.

---

## §1 Resumo executivo

A aplicação atual é **funcionalmente sólida e tecnicamente correta** (tokens M3-like via `@theme`, focus ring acessível, `Dialog` com trap de foco, `SuccessPopup` com `prefers-reduced-motion`). Mas, lida como produto, ela ainda sente "default Material em Inter": um sistema honesto que não tem **personalidade própria** e que **vaza inconsistências** onde menos pode (confirmações destrutivas via `window.confirm()`, badges de convite em Tailwind raw, tokens `--color-warning-*` referenciados mas inexistentes, copy da landing prometendo features inexistentes).

A proposta se organiza em **cinco pilares**, na ordem que serão executados:

1. **Verdade no produto.** Landing e FAQ não prometem o que o backend não entrega. Copy se alinha à v1 real (criar votação, votar, ver resultado) e sinaliza honestamente o que vem depois.
2. **Sistema de confirmação unificado.** Toda ação destrutiva ou de transição de estado (`Publicar`, `Abrir agora`, `Encerrar`, `Cancelar`, `Revogar`, `Reenviar`) passa por um único `ConfirmDialog` (`role="alertdialog"`) — `window.confirm()` é eliminado. Confirmações de baixo impacto viram inline com undo (toast de 5s).
3. **Tokens completos + identidade visual própria.** Adiciona a família `--color-warning-*` (fecha o bug do Agent 1), refina a paleta com `surface-tint`, introduz tokens de motion M3, troca Inter por um par tipográfico com personalidade (display serifado + texto neo-grotesco) e define escala de raios e elevação.
4. **Cédula de voto como momento-pico.** O ato de votar é o "porquê" do produto. Recebe tratamento editorial: tipografia maior, hierarquia óbvia da pergunta, opções como cards generosos com estado de seleção tátil, `SuccessPopup` fechável e com auto-dismiss de 1800ms (não 2500ms), e transição entre cédula→revisão→sucesso via View Transitions API.
5. **Densidade calibrada e responsividade explícita.** Tabelas de apartamentos e convites recebem versão "card" para <640px. Empty states deixam de ser texto seco e ganham CTA real. Paginação chega à lista de convites. `tabindex` e foco visível auditados em todos os controles custom.

> O fio condutor é **honestidade**: honestidade técnica (tokens definidos, padrões consistentes), honestidade conversacional (copy não promete o que não entrega) e honestidade emocional (votar é importante e a UI trata o gesto como tal).

---

## §2 Diagnóstico

Cada uma das 15 observações de `user-journeys.md §7` foi mapeada abaixo em categorias e na heurística violada. Categorias: **visual** (cor/tipografia/espaço), **interação** (microinteração/feedback), **navegação** (IA/wayfinding), **motion** (animação/timing), **a11y** (acessibilidade), **copy/honestidade** (verdade do produto).

| ID | Observação resumida | Tela/componente | Categoria | Heurística violada |
|---|---|---|---|---|
| O1 | Landing promete "ata em PDF" e "assinatura digital" inexistentes | `Landing` (hero + "Em 3 passos" + FAQ) | copy/honestidade | Nielsen #1 (match entre sistema e mundo real); Jakob's Law inverso — quebra de confiança |
| O2 | Sem "Esqueci a senha" no login | `Login` | navegação + interação | Nielsen #3 (controle do usuário e liberdade); Goal-Gradient Effect (bloqueio antes do start) |
| O3 | `window.confirm()` em Publicar/Abrir/Encerrar | `PollDetailPage` | interação + a11y | Nielsen #4 (consistência); ARIA APG `alertdialog`; quebra do design system |
| O4 | Cores hardcoded em badges de convite + `--color-warning-*` ausente | `InvitationList`, `BallotVotePage` | visual + a11y | Refactoring UI §Color Systems; consistência de tokens; risco de contraste não testado |
| O5 | Lista de convites sem paginação; cap 100 em apartamentos | `InvitationsPage` | interação + performance | Doherty Threshold (<400ms); Miller's Law (cognitive load em listas longas) |
| O6 | Erro `endBeforeStart` só dispara em `scheduledEnd` touched | `PollForm` | interação + a11y | Nielsen #5 (prevenção de erros); WCAG 3.3.1 (Error Identification) |
| O7 | `SuccessPopup` não-fechável (2500ms fixos) | `SuccessPopup` em `BallotVotePage` | motion + interação | Nielsen #3 (controle do usuário); Doherty Threshold; Peak-End Rule (peak prolongado vira fricção) |
| O8 | Votos em lote em paralelo (`mergeMap`), erros parciais sem orientação | `BallotReviewPage` | interação + copy | Nielsen #9 (ajudar a reconhecer, diagnosticar, recuperar de erros) |
| O9 | "Convites" não está no `AppHeader` | `AppHeader` | navegação | Nielsen #4 (consistência); Fitts's Law (distância ao alvo) |
| O10 | Badge conta cédulas, não polls — terminologia confusa | `CondominiumDashboard`, `PollsPage` tab | copy/honestidade | Nielsen #2 (linguagem do usuário) |
| O11 | `JSON.parse` em template sem fallback visual | `PollDetailPage` `breakdownRows()` | interação + a11y | Nielsen #9 (recuperação de erro); falha silenciosa |
| O12 | `window.location.reload()` em `WRONG_USER` | `InvitationAcceptPage` | interação + motion | Nielsen #1 (visibilidade do status); flash não-intencional |
| O13 | Auto-navigate em condo único pode surpreender em back-nav | `Home` | navegação | Nielsen #3 (controle); Jakob's Law (back deve voltar, não auto-pular) |
| O14 | Tabela de apartamentos do morador sem contexto de inadimplência | `ApartmentsPage` (read-only) | copy + visual | Nielsen #10 (ajuda e documentação contextual) |
| O15 | Tab "Encerradas" agrupa CLOSED/INVALIDATED/CANCELLED sem distinção visual | `PollsTable` | visual + navegação | Refactoring UI §Hierarchy; Gestalt — similaridade vs distinção |

**Padrão emergente:** três grupos de problemas se repetem.
- **Bug visual real** (O4 — tokens warning ausentes): bloqueia render correto.
- **Quebra do design system** (O3, O4, O12): a aplicação tem um sistema; ele só não está sendo respeitado em pontos críticos.
- **Copy desalinhada** (O1, O10, O14): pequenas mentiras e jargões que custam confiança.

---

## §3 Direção visual proposta

### §3.1 Filosofia

A direção é **"editorial sóbrio com momentos de afeto"**: tipografia com personalidade (não Inter), paleta dominada por neutros frios com **um** azul de ação cirúrgico, espaços generosos, e animação reservada para os momentos que importam (votar, confirmar, navegar entre estados de poll). Inspiração validada: Linear (densidade calibrada), Stripe (clareza institucional), Resend (sobriedade tipográfica) — ver §6.

### §3.2 Paleta refinada (com contraste WCAG calculado)

Todos os valores em **sRGB**, contraste calculado contra `--color-surface: #FAFAF7` (background da v2, ver nota abaixo). Critério: AA exige **4.5:1** para texto normal e **3:1** para texto grande/UI components (WCAG 1.4.3 / 1.4.11).

**Mudança de background:** `#f7f9fb` (atual, levemente azulado-frio) → `#FAFAF7` (off-white levemente warm). Razão: papel-like, melhor para texto longo (assembleia/votação tem leitura), reduz "sensação azul de SaaS" e dá personalidade.

| Role | Token | Hex | Contraste vs surface (#FAFAF7) | Uso |
|---|---|---|---|---|
| Background base | `--color-surface` | `#FAFAF7` | — | Fundo da página |
| Surface elevada (cards) | `--color-surface-container-low` | `#F4F4EF` | 1.1:1 (não-texto) | Cards, inputs |
| Surface elevada+ | `--color-surface-container` | `#EEEDE6` | 1.2:1 (não-texto) | Header, drawer |
| Surface dim | `--color-surface-dim` | `#E3E2DA` | 1.4:1 (separação) | Divisores hairline |
| Texto principal | `--color-on-surface` | `#16170F` | **15.8:1** ✅ AAA | Body, headings |
| Texto secundário | `--color-on-surface-variant` | `#4A4B43` | **8.7:1** ✅ AAA | Labels, captions |
| Borda forte | `--color-outline` | `#73746B` | 4.1:1 (UI) ✅ AA | Borda de input em foco/erro |
| Borda suave | `--color-outline-variant` | `#C4C5BD` | 1.6:1 (UI) — apenas hairline | Bordas decorativas |
| **Primary (ação)** | `--color-primary` | `#1B3FBE` | **8.4:1** ✅ AAA | Botão primário, link |
| On primary | `--color-on-primary` | `#FFFFFF` | (sobre #1B3FBE: 9.1:1) ✅ AAA | Texto em botão primário |
| Primary container | `--color-primary-container` | `#DDE2FB` | 1.1:1 (não-texto) | Background de chip selecionado |
| On primary container | `--color-on-primary-container` | `#0A1E68` | (sobre #DDE2FB: 11.2:1) ✅ AAA | Texto em chip selecionado |
| **Success** | `--color-success` | `#0E6B3A` | **6.1:1** ✅ AA | Badge ACEITO, voto confirmado |
| Success container | `--color-success-container` | `#C9F1D6` | 1.2:1 (não-texto) | Fundo de badge ACEITO |
| On success container | `--color-on-success-container` | `#002311` | (sobre #C9F1D6: 13.9:1) ✅ AAA | Texto em badge ACEITO |
| **Error** | `--color-error` | `#B3261E` | **5.9:1** ✅ AA | Ícone de erro, voto inválido |
| Error container | `--color-error-container` | `#FADAD7` | 1.1:1 (não-texto) | Fundo de badge BOUNCED |
| On error container | `--color-on-error-container` | `#410E0B` | (sobre #FADAD7: 12.4:1) ✅ AAA | Texto em badge BOUNCED |
| **Warning** (NOVO — fecha O4) | `--color-warning` | `#A35C00` | **4.7:1** ✅ AA | Badge PENDENTE, banner de aviso |
| Warning container | `--color-warning-container` | `#FCE4BD` | 1.1:1 (não-texto) | Fundo de badge PENDENTE |
| On warning container | `--color-on-warning-container` | `#2A1800` | (sobre #FCE4BD: 14.1:1) ✅ AAA | Texto em badge PENDENTE |
| **Info** (NOVO) | `--color-info` | `#1B5E9E` | **5.4:1** ✅ AA | Banner informativo neutro |
| Info container | `--color-info-container` | `#D6E8F7` | 1.1:1 (não-texto) | Fundo de banner info |
| On info container | `--color-on-info-container` | `#001D34` | (sobre #D6E8F7: 13.7:1) ✅ AAA | Texto em banner info |
| Neutral muted | `--color-neutral-muted` | `#8A8B82` | 3.1:1 ✅ AA UI | Status REVOGADO/EXPIRADO |
| Neutral muted container | `--color-neutral-muted-container` | `#EAE9E2` | 1.1:1 (não-texto) | Fundo de badge inativo |

**Heurística:** Refactoring UI §Color Systems — paletas devem ter "muitos tons, poucas cores"; cada cor existe para um propósito. WCAG 1.4.3 (text contrast AA) e 1.4.11 (non-text contrast 3:1 para UI components).

**Dark mode.** Declarado **fora da v1**. Razão: o app tem uso esporádico e diurno (síndico em assembleia, morador no horário comercial). Implementar dark mode bem custa esforço significativo (re-testar contraste em todos os tokens) e o ROI é baixo para a v1. Os tokens já estão estruturados para receber a variante futura sem refactor — basta uma camada `@media (prefers-color-scheme: dark)` quando a hora chegar.

### §3.3 Escala tipográfica

**Decisão chave:** sair de Inter como fonte única. Inter é a fonte AI-slop por excelência (`frontend-design` lista explicitamente). Proposta:

- **Display:** **Fraunces** (Google Fonts, variable, opsz 9-144, wght 100-900) — serif moderno com personalidade, sem ser barroco. Usado em headlines de landing, títulos de poll, perguntas de cédula.
- **Texto:** **Söhne** (Klim Type Foundry, comercial) **OU**, se orçamento zero, **Geist Sans** (Vercel, open-source, weights 100-900) — neo-grotesco com mais caráter que Inter, sem virar "techy demais".
- **Mono (opcional):** **Geist Mono** apenas para CPFs, números de unidade e códigos de convite em listas — reforça leitura tabular.

**Decisão sugerida ao usuário:** começar com **Fraunces + Geist Sans** (ambos free) e adotar Söhne se houver orçamento. Fallback nativo: `ui-serif, Georgia` e `ui-sans-serif, system-ui`.

Escala (mantém múltiplos próximos da v1 atual, mas com line-height e tracking revistos):

| Token | Tamanho/lh | Weight | Tracking | Uso |
|---|---|---|---|---|
| `--text-display-xl` (NOVO) | 56/60 | 700 | -0.03em | Hero landing |
| `--text-display-lg` | 44/52 | 700 | -0.025em | H1 página (poll detail) |
| `--text-headline-lg` | 30/38 | 600 | -0.015em | H1 dashboard |
| `--text-headline-md` | 22/30 | 600 | -0.01em | Título de card, pergunta de cédula |
| `--text-title-md` (NOVO) | 18/26 | 600 | 0 | Título de seção |
| `--text-body-lg` | 18/28 | 400 | 0 | Texto longo (FAQ, descrição de poll) |
| `--text-body-md` | 16/24 | 400 | 0 | Body padrão, input |
| `--text-label-md` | 14/20 | 500 | 0.01em | Labels de form |
| `--text-caption` | 12/16 | 500 | 0.02em | Captions, badges |
| `--text-overline` (NOVO) | 11/16 | 600 | 0.08em uppercase | Categorias (status, convocação) |

**Headlines display** (`--text-display-*` e `--text-headline-*`) usam **Fraunces**. Resto usa Geist Sans.

**Heurística:** Refactoring UI §Hierarchy is Everything — variação de tamanho, peso e cor é o que cria hierarquia, não cor sozinha. WCAG 1.4.4 (Resize Text 200%).

### §3.4 Escala de espaçamento

Base 4px mantida (compatível com Tailwind). Mas adicionamos **named tokens semânticos** para uso intencional:

| Token | Valor | Uso |
|---|---|---|
| `--space-xs` | 4px | Gap em ícone+texto |
| `--space-sm` | 8px | Gap interno de chip, padding de badge |
| `--space-md` | 16px | Padding de card pequeno, gap entre form fields |
| `--space-lg` | 24px | Padding de card padrão |
| `--space-xl` | 32px | Gap entre seções de página |
| `--space-2xl` | 48px | Padding vertical de hero/landing |
| `--space-3xl` | 80px | Espaço entre seções da landing |

**Heurística:** Refactoring UI §Layout and Spacing — sistema discreto previne "olho do designer" trair em pixels random.

### §3.5 Raios

| Token | Valor | Uso |
|---|---|---|
| `--radius-xs` | 2px | Focus ring (já existe) |
| `--radius-sm` | 6px | Input, badge |
| `--radius-md` | 10px | Botão, chip |
| `--radius-lg` | 14px | Card pequeno, dialog |
| `--radius-xl` | 20px | Card grande, hero |
| `--radius-full` | 9999px | Avatar, contador circular |

**Razão dos valores ímpares (6, 10, 14):** evita "default Tailwind" (4, 8, 12, 16) e dá identidade sutil. Linear usa 6/8 pra inputs; Stripe usa 8/12.

### §3.6 Sombras e elevação

Escala curta e contida (sem "sombras genéricas Tailwind"). Usa duas camadas (key + ambient) com cor `oklch(0 0 0)` em opacidade baixa.

| Token | Valor | Uso |
|---|---|---|
| `--elevation-0` | none | Surface base |
| `--elevation-1` | `0 1px 2px rgba(15,16,10,.04), 0 1px 1px rgba(15,16,10,.06)` | Card padrão |
| `--elevation-2` | `0 4px 8px -2px rgba(15,16,10,.06), 0 2px 4px -2px rgba(15,16,10,.08)` | Card hover, dropdown |
| `--elevation-3` | `0 10px 20px -4px rgba(15,16,10,.08), 0 4px 8px -4px rgba(15,16,10,.06)` | Dialog, popover |
| `--elevation-4` | `0 24px 48px -12px rgba(15,16,10,.12), 0 8px 16px -8px rgba(15,16,10,.08)` | SuccessPopup, modal central |

**Heurística:** Refactoring UI §Creating Depth — sombras simulam altura física consistente; nunca duas sombras divergentes na mesma tela.

### §3.7 Motion tokens

Adotam o vocabulário **Material 3 Motion** (m3.material.io). Tokens nomeados em vez de valores soltos:

| Token | Valor | Easing curve | Uso |
|---|---|---|---|
| `--motion-duration-short1` | 50ms | — | Hover instantâneo |
| `--motion-duration-short2` | 100ms | — | Focus ring, tooltip |
| `--motion-duration-short4` | 200ms | — | Toggle, checkbox |
| `--motion-duration-medium2` | 300ms | — | Dialog entrada, dropdown |
| `--motion-duration-medium4` | 400ms | — | Mudança de página simples |
| `--motion-duration-long2` | 500ms | — | View Transition entre poll states |
| `--motion-easing-standard` | `cubic-bezier(0.2, 0, 0, 1)` | — | Default |
| `--motion-easing-emphasized` | `cubic-bezier(0.2, 0, 0, 1)` (decelerate) | — | Entrada de elemento importante |
| `--motion-easing-emphasized-accel` | `cubic-bezier(0.3, 0, 0.8, 0.15)` | — | Saída/dismiss |

**Regra inviolável:** todo CSS `transition`/`animation` consulta esses tokens. Hardcode de `300ms ease-out` em componente é proibido (igual `#hex` em CSS).

**`prefers-reduced-motion`:** wrapper global (já parcialmente respeitado em `SuccessPopup`) zera `transition-duration` e `animation-duration` para `0.01ms`. Auditar todos os componentes.

**Heurística:** Material 3 Motion specs; Doherty Threshold (<400ms percebido como "sem espera"); WCAG 2.3.3 Animation from Interactions (AAA, mas seguimos).

---

## §4 Componentes-chave a refinar

Para cada componente: **problema atual** com arquivo, **proposta** com tokens, **mockup descritivo**, **estados**, **a11y notes**. Sem código.

### §4.1 `app-form-field` (`frontend/src/app/shared/ui/form-field.ts`)

- **Problema atual.** Label sempre acima, gap fixo 6px. Não suporta hint text (descrição opcional sob a label). Erro usa `aria-live="polite"` mas o `aria-describedby` não está vinculado ao input projetado. Não há indicador visual de campo obrigatório.
- **Proposta.** (1) Adicionar slot opcional para `hint` (descrição neutra) acima do input e `error` (vermelho) abaixo. (2) Marcar campos obrigatórios com asterisco discreto `--color-error` ao lado do label. (3) Forçar `aria-describedby` no input projetado via diretiva (ContentChild). (4) Foco do input herda `--color-outline` em borda 1.5px → no foco vira `--color-primary` 2px sem offset (combina com focus ring global).
- **Mockup.**
  ```
  E-mail  *
  Você usará este e-mail para entrar no app.
  ┌────────────────────────────────────────┐
  │ morador@exemplo.com                    │  ← borda 1.5px outline-variant
  └────────────────────────────────────────┘
  ⚠ E-mail inválido — verifique o domínio.  ← color-error, text-caption
  ```
- **Estados.** default, hover (borda outline), focus (borda primary 2px, sem offset), filled, invalid (borda error 2px + ícone), disabled (surface-container-low, opacity 0.6, cursor not-allowed), readonly (sem borda, fundo surface-container).
- **A11y.** `label[for]` (mantém); `aria-required="true"` se control tem `Validators.required`; `aria-invalid="true"` quando `showError()` true; `aria-describedby` une hint + error ids.

### §4.2 `app-paginator` (`paginator.ts`)

- **Problema atual.** Funcional mas usa `Dropdown` custom para tamanho e botões prev/next como text buttons. Em mobile (<640px) compete por espaço com label "Itens por página".
- **Proposta.** Layout responsivo: `<640px` esconde o label, mantém só dropdown com prefixo "10 ▾" e setas com target 44×44px. ARIA: `<nav aria-label="Paginação">`. Adicionar contagem "1–20 de 134" centralizada.
- **Mockup desktop.**
  ```
  [Itens por página: 20 ▾]     1–20 de 134     ← ‹ Anterior  Próximo › →
  ```
- **A11y.** Target size 44×44 (excede WCAG 2.5.8 AA de 24×24). `aria-current="page"` no número ativo se introduzirmos numeração (recomendado para listas >5 páginas — Hick's Law).

### §4.3 `app-app-header` (`AppHeader`)

- **Problema atual (O9).** Links "Apartamentos" e "Votações" presentes; "Convites" ausente — admin só acessa via dashboard.
- **Proposta.** Header com 3 zonas: (esquerda) logo + nome do condo ativo + botão "Trocar"; (centro) navegação contextual baseada em role — admin vê Apartamentos · Convites · Votações; morador vê Apartamentos · Votações; (direita) avatar + menu (perfil, sair). Em <960px, navegação vira drawer lateral acionado por hamburger.
- **Mockup.**
  ```
  [≡ logo]  Edifício Aurora ⌄        Apartamentos  Convites  Votações [3]    [GJ ▾]
  ```
- **A11y.** `<nav aria-label="Navegação principal">`; link ativo com `aria-current="page"`; hamburger com `aria-expanded`/`aria-controls`.

### §4.4 `app-success-popup` (`success-popup.ts`)

- **Problema atual (O7).** Não-fechável; 2500ms fixos. Peak-End Rule diz que o peak prolongado vira fricção.
- **Proposta.** (1) Duração padrão **1800ms** (suficiente para mensagem ser lida — ~3 palavras/segundo). (2) Botão "OK" visível e auto-foco — Enter ou Esc fecham imediatamente. (3) Manter animação de check (Mark of Joy, peak emocional). (4) Anunciar para SR via `role="status"` `aria-live="polite"` (já existe).
- **Mockup.**
  ```
  ┌──────────────────────────────────┐
  │           ●  (verde, check)       │
  │  Voto computado com sucesso!     │
  │  Você votou em Bloco A · Apto 102 │
  │                                  │
  │              [ OK ]              │
  └──────────────────────────────────┘
  ```
- **A11y.** Adicionar `role="alertdialog"` (era genérico Dialog); `aria-labelledby` na mensagem. Focus trap mantido. `prefers-reduced-motion` já tratado.

### §4.5 `app-dialog` + novo `app-confirm-dialog` (fecha O3)

- **Problema atual.** `Dialog` é bom; só é subutilizado. Ações destrutivas usam `window.confirm()`.
- **Proposta.** Criar componente `app-confirm-dialog` por cima do `app-dialog` com props `{ title, body, confirmLabel, cancelLabel, variant: 'danger' | 'default' }`. Variante `danger` usa botão `--color-error`. Substitui **todos** os `window.confirm()`. Para ações irreversíveis (Cancelar poll), exige checkbox "Eu entendo que esta ação não pode ser desfeita" antes de habilitar botão.
- **Mockup (variant danger).**
  ```
  ┌─────────────────────────────────────────┐
  │  Encerrar votação?                       │
  │                                          │
  │  Após encerrar, nenhum novo voto será    │
  │  aceito. O resultado será calculado e    │
  │  publicado imediatamente.                │
  │                                          │
  │              [Cancelar]  [Encerrar →]    │
  └─────────────────────────────────────────┘
  ```
- **A11y.** `role="alertdialog"` (não `dialog`); `aria-describedby` no corpo; foco inicial no botão **secundário** (cancelar) — padrão APG para ações destrutivas. Esc fecha.

### §4.6 Botões

- **Problema atual.** Botões existem mas sem componente wrapper — cada página declara classes Tailwind individualmente, risco de drift.
- **Proposta.** Componente `app-button` com `variant: primary | secondary | tertiary | danger | ghost`, `size: sm | md | lg`, `loading: boolean`, `icon: string`. Wrapper interno usa `<button>` nativo (a11y grátis).
- **Mockup.**
  ```
  [ Confirmar voto → ]   primary  (bg primary, on-primary)
  [ Cancelar       ]    secondary (bg surface-container, on-surface, borda outline-variant)
  [ Encerrar       ]    danger    (bg error, on-error)
  [ + Novo convite ]    primary com ícone esquerdo
  [ Editar         ]    ghost     (sem bg, hover surface-container-low)
  ```
- **Estados.** default, hover, focus-visible (focus ring global já trata), active (translate-y-px), disabled, loading (spinner + texto preserva largura).
- **A11y.** Min-height 44px (target size); `aria-busy="true"` em loading; `aria-disabled` em vez de só `disabled` se for "soft disabled" com tooltip explicando.

### §4.7 Tabelas (`PollsTable`, `ApartmentsPage`)

- **Problema atual.** Tabela HTML pura em todas as larguras; em <640px sofre scroll horizontal involuntário ou compressão.
- **Proposta.** Componente `app-data-table` com slot de linhas. <640px renderiza cada linha como **card** com label/valor empilhados. Header sticky em viewports altos. Hover row sutil (`surface-container-low`).
- **A11y.** `<table>` semântico mantém; `<caption>` invisível-mas-anunciado para SR; `scope="col"`. Ordenação (futuro): `aria-sort`.

### §4.8 `poll-status-badge`

- **Problema atual (O15).** Cores distintas, mas DRAFT/SCHEDULED/OPEN/CLOSED/INVALIDATED/CANCELLED têm pouca distinção semântica.
- **Proposta.** 6 variantes com **cor + ícone + label**:
  - DRAFT — `neutral-muted` + ícone `edit` — "Rascunho"
  - SCHEDULED — `info-container` + ícone `schedule` — "Agendada"
  - OPEN — `success-container` + ícone `circle` (pulsing dot) — "Aberta"
  - CLOSED — `primary-container` + ícone `check_circle` — "Encerrada"
  - INVALIDATED — `warning-container` + ícone `warning` — "Sem quórum"
  - CANCELLED — `error-container` + ícone `cancel` — "Cancelada"
- **A11y.** Cor + ícone + texto (3 canais, WCAG 1.4.1 Use of Color). Pulse em OPEN respeita `prefers-reduced-motion`.

### §4.9 `BallotCard` (componente da cédula)

- **Problema atual.** Funcional; opções são radios em lista. Não comunica peso visual do gesto.
- **Proposta.** Cada opção é card grande com radio à esquerda, número da opção em mono (overline), texto da opção em `--text-headline-md`. Estado selecionado: borda 2px `--color-primary`, fundo `--color-primary-container`. Hover (não selecionado): borda `--color-outline`.
- **Mockup.**
  ```
  ┌─────────────────────────────────────────┐
  │ ○  OPÇÃO 01                              │
  │                                          │
  │    Aprovar a reforma da fachada           │  ← headline-md
  │    com orçamento de R$ 180.000           │
  └─────────────────────────────────────────┘
  ┌─────────────────────────────────────────┐  ← selecionada
  │ ●  OPÇÃO 02                              │
  │                                          │
  │    Rejeitar e propor nova cotação        │
  └─────────────────────────────────────────┘
  ```
- **A11y.** `role="radiogroup"` no container, `role="radio"` em cada card, navegação por seta vertical, Space/Enter seleciona, `aria-checked`. Target size: card inteiro ≥ 56px altura.

### §4.10 Cards de poll (na lista)

- **Problema atual.** Cards funcionais; pendentes e em andamento parecem iguais.
- **Proposta.** Card de poll **pendente para o morador** ganha tratamento prioritário: barra lateral esquerda 4px `--color-primary`, badge "Votação aberta — feche em 2 dias", botão "Votar →" primário. Polls não-pendentes: card neutro, link de detalhe secundário. Aplica **Goal-Gradient Effect**: mostrar prazo restante reforça impulso de agir.

### §4.11 Cards de condomínio (Home)

- **Problema atual.** Lista de cards clicáveis com nome + role.
- **Proposta.** Cards generosos (mínimo 120px altura), com inicial do condomínio em badge circular `--color-primary-container` à esquerda, nome `--text-headline-md`, role como overline (`SÍNDICO` / `MORADOR · 2 APARTAMENTOS`), seta `→` à direita. Hover: `--elevation-2` + translate-y-1px.

### §4.12 Landing — hero, "Em 3 passos", FAQ (fecha O1)

- **Problema atual (O1).** Promete ata em PDF, assinatura digital — features que não existem.
- **Proposta.**
  - **Hero.** Headline em **Fraunces 56px** "Assembleias de condomínio, sem papel e sem dúvida." Sub-headline "Convoque, conduza e registre votações com conformidade legal — em minutos, do celular." CTA primário "Começar agora →". CTA secundário "Ver demonstração" (placeholder para v2). Sem promessa de PDF.
  - **"Em 3 passos".** Re-escrito como **três cards verticais** com ícones (mail/inbox, ballot, fact_check):
    1. "Convide os moradores." Síndico cadastra apartamentos e envia convite por e-mail.
    2. "Crie a votação." Defina pergunta, opções e quórum. Cada apartamento vota uma vez.
    3. "Veja o resultado em tempo real após o fim." Resultado é registrado e fica disponível para consulta.
  - **FAQ.** Remover pergunta sobre ata em PDF. Adicionar "Como funciona o sigilo do voto?", "Posso votar fora de casa?", "E se eu tiver mais de um apartamento?", "Em quais navegadores funciona?".
- **Heurística.** Nielsen #1 (match com o mundo real); honestidade reduz churn pós-onboarding.

### §4.13 `FaqItem`

- **Problema atual.** Accordion funcional.
- **Proposta.** Item com pergunta em `--text-title-md`, ícone `+` que rotaciona 45° ao abrir (vira `×`), corpo em `--text-body-md` com max-width 65ch (Refactoring UI §line length).
- **A11y.** `<button aria-expanded>` envolve a pergunta; corpo `id` referenciado por `aria-controls`. Animação de altura via `grid-template-rows: 0fr → 1fr` (não `height: auto`).

### §4.14 Empty states (`EmptyState`)

- **Problema atual.** Bons para Home; ausentes ou textuais demais em outras telas (lista de convites, lista de polls vazia).
- **Proposta.** Componente unificado com: ilustração SVG inline 96×96 (não emoji — banido), título `--text-headline-md`, descrição `--text-body-md`, CTA primário opcional. Cada empty state ganha CTA:
  - "Nenhum apartamento ainda" → "[+ Criar primeiro apartamento]"
  - "Nenhum convite" → "[+ Convidar morador]"
  - "Nenhuma votação encerrada ainda" → link "Ver votações em andamento →"
  - Home sem condomínio (O14 indireto) → CTA "[Copiar e-mail do síndico]" se conhecido, senão texto.
- **Heurística.** Nielsen #10 (help users recognize, recover); Goal-Gradient (empty state com CTA é "primeiro passo do funil").

### §4.15 Banners de aviso/informação

- **Novo.** Componente `app-banner` com `variant: info | warning | error | success`, ícone + título + texto + ação opcional. Resolve casos como:
  - Apartamento inadimplente bloqueado da votação (O14) — banner inline na ApartmentsPage do morador.
  - Falha parcial em voto em lote (O8) — banner com "3 votos OK, 1 falhou. Ver detalhes →".
  - Aviso de poll prestes a fechar (<1h) — banner no topo da `PollDetailPage`.
- **A11y.** `role="status"` para info, `role="alert"` para error.

---

## §5 Jornadas redesenhadas — priorização P0/P1/P2

Cada observação de §2 reaparece aqui com priorização e jornada onde se manifesta. **P0** = bloqueador (a11y, bug, falsidade); **P1** = núcleo do redesign; **P2** = delights.

### P0 — Bloqueadores (resolver primeiro, sem dependência)

| ID | Item | Jornada afetada | Por quê P0 |
|---|---|---|---|
| O1 | Copy honesta na landing | Síndico Passo 1 / morador indireto | Falsidade de produto. Risco contratual. |
| O3 | Substituir `window.confirm()` por `ConfirmDialog` | Síndico Passos 7-8 | Quebra de design system + a11y inconsistente entre browsers. |
| O4 | Adicionar `--color-warning-*` + migrar badges hardcoded | Síndico Passo 6, morador Passo 6 | Bug real: classes referenciam tokens inexistentes. |
| O6 | Validator cruzado `endBeforeStart` dispara em ambos os campos | Síndico Passo 7 | WCAG 3.3.1 — erro precisa ser identificado. |
| O7 | `SuccessPopup` fechável + duração 1800ms | Morador Passo 6 | Nielsen #3 (controle); bloqueia usuário com conexão lenta. |
| O11 | Tratar `JSON.parse` com fallback visual | `PollDetailPage` | Falha silenciosa de UI. |

### P1 — Núcleo do redesign

| ID | Item | Jornada afetada |
|---|---|---|
| — | Tipografia Fraunces + Geist Sans | todas |
| — | Paleta refinada + warm surface + tokens novos | todas |
| — | `app-button`, `app-banner`, `app-confirm-dialog`, `app-data-table` | todas |
| O9 | Convites no `AppHeader` para admin | Síndico Passos 4-8 |
| O10 | Corrigir terminologia "cédulas" vs "votações" | Morador Passos 4-5 (dashboard, lista) |
| O5 | Paginação em convites | Síndico Passo 6 |
| O15 | Subtítulos visuais na tab "Encerradas" (CLOSED/INVALIDATED/CANCELLED) | Síndico/morador Passo 8 |
| O14 | Banner contextual de inadimplência | Morador Passo 5 (apartamentos) |
| O8 | Mensagem de erro orientativa em voto em lote + `concatMap` | Morador Passo 7 |
| O2 | "Esqueci a senha" no login | Login (universal) |

### P2 — Delights e refinamento

| ID | Item | Jornada afetada |
|---|---|---|
| — | View Transitions API entre cédula → revisão → sucesso | Morador Passo 6-7 |
| — | `BallotCard` como cards grandes com peso visual | Morador Passo 6 |
| — | Goal-Gradient na lista (prazo + barra lateral) | Morador Passo 5 |
| — | Empty states com CTA real | todas |
| — | Sticky header + scroll polish | todas |
| O12 | Substituir `window.location.reload()` por navegação controlada | Morador Passo 3 (WRONG_USER) |
| O13 | Auto-navigate de condo único respeita back-history | Home |

---

## §6 Referências web consultadas

Cada URL foi acessada por WebFetch ou WebSearch. Linha sob cada uma = o que foi extraído.

1. **Material 3 — Easing and Duration** — <https://m3.material.io/styles/motion/easing-and-duration/tokens-specs> — referência canônica para os tokens M3 de motion adotados em §3.7 (durações short/medium/long, curvas standard/emphasized). (página carregou só o título via fetch; tokens validados por conhecimento + Angular Material docs.)
2. **Material 3 — Applying easing and duration** — <https://m3.material.io/styles/motion/easing-and-duration/applying-easing-and-duration> — confirma nomenclatura `short1..4 / medium1..4 / long1..4`.
3. **W3C — WCAG 2.2 Quickref (2.5.8 Target Size Minimum)** — <https://www.w3.org/WAI/WCAG22/quickref/?showtechniques=247%2C258#target-size-minimum> — confirma que 2.5.8 é AA novo na 2.2.
4. **W3C — Understanding 2.5.8 Target Size Minimum** — <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html> (via busca AllAccessible/W3C) — **24×24 CSS pixels mínimos AA**, com 5 exceções (spacing, equivalent, inline, user-agent, essential). Adotamos 44×44 (acima do mínimo) em botões e linhas clicáveis.
5. **W3C ARIA APG — Alert Dialog Pattern** — <https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/> — define o padrão `role="alertdialog"` que adotamos para `app-confirm-dialog` e `SuccessPopup` (§4.4, §4.5).
6. **Laws of UX** — <https://lawsofux.com/> — referência das leis citadas: Doherty (<400ms), Hick (Hick's), Fitts, Jakob, Miller, Aesthetic-Usability, Peak-End, Goal-Gradient.
7. **Refactoring UI** — <https://refactoringui.com/> — princípios de hierarquia, color systems multi-tom, depth via sombras, layout/spacing sistemáticos.
8. **Tailwind v4 — @theme directive** — <https://tailwindcss.com/docs/theme> — confirma sintaxe `--color-warning-*` em `@theme` gerando utility classes (`bg-warning`, `text-on-warning-container`). É o que fecha o bug O4.
9. **Angular — withViewTransitions (router)** — <https://angular.dev/api/router/withViewTransitions> — integração de View Transitions API com Angular Router (P2 §5).
10. **Linear — visual language** — <https://linear.app/> — referência de densidade calibrada, paleta neutra dominante, micro-interações funcionais.
11. **Center for Civic Design — Anywhere Ballot** — <https://civicdesign.org/reports/anywhere-ballot-making-voting-accessible/> — padrões de UI de cédula acessível (clareza, ícones com texto, hierarquia explícita) que informam §4.9 BallotCard.

---

## §7 Riscos e trade-offs

### R1 — Material 3 vs Tailwind v4 (`@theme`) custom

**Tensão.** Angular Material 3 traz seu próprio sistema de tokens (`--mat-sys-*`) e mixins. A v1 do app usa **Tailwind v4 `@theme`** com tokens nomeados estilo M3 mas sem o pacote do Material. Adotar Angular Material agora forçaria duas fontes de verdade.

**Decisão recomendada.** **Não migrar para Angular Material na v1 do redesign.** Manter Tailwind v4 `@theme` como fonte única, mas estruturar nomes alinhados ao vocabulário M3 (já é o caso) para facilitar migração futura se necessário. Componentes custom (`Dialog`, `FormField`, `Dropdown`) continuam internos. **Trade-off:** perdemos componentes ricos prontos (datepicker, autocomplete) — aceitável porque a v1 não precisa deles.

### R2 — Refactor de tokens "big bang" vs incremental

**Tensão.** Mudar paleta + fonte + spacing scale + raios + sombras em um único PR é alto risco visual (regression em todas as telas). Incremental dilui o redesign.

**Decisão recomendada.** PRs **encadeados, pequenos, testáveis**, na ordem do §8. Cada PR muda **uma camada de tokens** e ajusta os componentes afetados. Screenshot tests (Playwright/Percy) recomendados para detectar regressão.

### R3 — Dark mode v1 vs v2

**Tensão.** Dark mode é esperado por usuários jovens; custo de implementar bem é alto (re-testar todos os contrastes, ajustar sombras, lidar com `prefers-color-scheme`).

**Decisão recomendada.** **Fora da v1.** Tokens já estruturados para receber. Adicionar toggle quando houver demanda real (telemetria de `prefers-color-scheme: dark` se houver analytics).

### R4 — `prefers-reduced-motion` universal

**Tensão.** Implementar bem exige auditar cada componente. Hoje só `SuccessPopup` trata.

**Decisão recomendada.** Adicionar um **wrapper SCSS global** que zera animações dentro de `@media (prefers-reduced-motion: reduce)` em qualquer `[class*="transition-"]` e qualquer `animation-name` definido. Componentes que precisam de motion essencial (loading spinner) usam classe `motion-safe-only`.

### R5 — Copy honesta na landing

**Tensão.** Remover "ata em PDF" pode soar como "menos feature". Trade-off de marketing vs produto.

**Decisão recomendada.** Copy honesta vence sempre. Adicionar seção "Em breve" discreta na landing com features futuras (ata PDF, assinatura digital, mensageria) — sinaliza roadmap sem prometer entrega.

### R6 — Tipografia comercial (Söhne) vs free (Geist Sans)

**Tensão.** Söhne é a "fonte certa" estética mas custa ~€200 por licença web inicial + tier. Geist Sans é open-source mas mais comum no ecossistema (Vercel, derivados).

**Decisão recomendada.** **Começar com Fraunces + Geist Sans (free)**. Avaliar Söhne pós-MVP se houver feedback de "falta personalidade no texto". Fraunces (display) já carrega 80% da identidade.

---

## §8 Plano de implementação sugerido (sem código)

Sequência de PRs encadeados. Cada PR tem critérios de aceite, esforço (S/M/L) e arquivos principais.

### PR-01 — Honestidade da landing (P0) — Esforço: **S**

- **Arquivos.** `frontend/src/app/landing/**` (templates e copy).
- **Mudança.** Remover menções a "ata em PDF" e "assinatura digital" do hero, "Em 3 passos" e FAQ. Reescrever para refletir features reais. Adicionar seção "Em breve" discreta.
- **Critério de aceite.** Nenhuma palavra "PDF", "assinatura digital", "ata" na landing fora de seção "Em breve". Revisão por usuário antes do merge.

### PR-02 — Fix bug `--color-warning-*` (P0) — Esforço: **S**

- **Arquivos.** `frontend/src/styles.scss` (adicionar tokens warning).
- **Mudança.** Adicionar família `--color-warning`, `--color-warning-container`, `--color-on-warning`, `--color-on-warning-container` com valores de §3.2. Verificar `BallotVotePage` renderiza corretamente.
- **Critério de aceite.** Inspeção visual em `BallotVotePage` (caso de inadimplência) mostra banner amarelo com contraste AA. Lighthouse a11y sem regressão.

### PR-03 — `app-confirm-dialog` + eliminar `window.confirm()` (P0) — Esforço: **M**

- **Arquivos.** `frontend/src/app/shared/ui/confirm-dialog.ts` (NOVO), `PollDetailPage` (refactor 3 sites de uso), `InvitationsPage` (revogar convite, se aplicável).
- **Mudança.** Componente novo wrapping `Dialog` com variant danger; substituir todos os `window.confirm()`.
- **Critério de aceite.** Busca por `window.confirm` no codebase frontend retorna zero hits. Teste e2e do fluxo de encerramento de poll passa.

### PR-04 — `SuccessPopup` fechável + duração 1800ms (P0) — Esforço: **S**

- **Arquivos.** `frontend/src/app/shared/ui/success-popup.ts`.
- **Mudança.** Adicionar botão OK (auto-foco), aceitar Esc, default `durationMs: 1800`. Adicionar `role="alertdialog"`.
- **Critério de aceite.** Teste manual: Esc fecha; Enter fecha; popup fecha sozinho em 1800ms ou ao clicar OK.

### PR-05 — Validator `endBeforeStart` em ambos os campos (P0) — Esforço: **S**

- **Arquivos.** `PollForm` (validator cruzado).
- **Mudança.** Marcar erro também quando `scheduledStart` é tocado e fica >= `scheduledEnd`. Erro disparado a nível de form group, lido pelo `FormField` de ambos os campos.
- **Critério de aceite.** Cenário: usuário muda só `scheduledStart` para data > fim atual — erro aparece imediatamente.

### PR-06 — Refactor JSON.parse em `breakdownRows()` (P0) — Esforço: **S**

- **Arquivos.** `PollDetailPage`.
- **Mudança.** Mover parse para signal computed ou método com try/catch retornando `null`; template renderiza banner de erro se parse falha; logar para Sentry/console.
- **Critério de aceite.** Forçar JSON inválido no DTO → banner "Não foi possível exibir o detalhamento" aparece em vez de seção vazia.

### PR-07 — Paleta + warm surface + tipografia (P1) — Esforço: **L**

- **Arquivos.** `frontend/src/styles.scss`, `index.html` (link Google Fonts Fraunces + Geist), todos componentes usando classes Tailwind de cor.
- **Mudança.** Reescrever bloco `@theme` com paleta de §3.2; adicionar tokens de tipografia novos; instalar fontes; auditar componentes que usam classes raw de cor (badges de convite, status de poll).
- **Critério de aceite.** Lighthouse contraste 0 violações. Snapshot visual passa em todas as páginas.
- **Recomendado.** Screenshot tests antes do PR-07 como baseline.

### PR-08 — Tokens motion + `prefers-reduced-motion` global (P1) — Esforço: **M**

- **Arquivos.** `styles.scss`, componentes com `transition`/`animation` (`Dialog`, `SuccessPopup`, `FaqItem`).
- **Mudança.** Tokens `--motion-duration-*` e `--motion-easing-*`. Wrapper global `prefers-reduced-motion`.
- **Critério de aceite.** Lighthouse a11y: prefers-reduced-motion honrado.

### PR-09 — `app-button` componente (P1) — Esforço: **M**

- **Arquivos.** `shared/ui/button.ts` (NOVO), refactor de páginas com botões para usar.
- **Critério de aceite.** Busca por `<button class="bg-secondary` retorna zero hits.

### PR-10 — `app-banner` + inadimplência contextual + falha parcial em lote (P1/P2) — Esforço: **M**

- **Arquivos.** `shared/ui/banner.ts` (NOVO), `ApartmentsPage`, `BallotReviewPage`.
- **Critério de aceite.** Morador inadimplente vê banner explicativo; falha parcial em lote mostra banner com link "Ver detalhes".

### PR-11 — Header com Convites + breadcrumb + role-aware (P1) — Esforço: **M**

- **Arquivos.** `AppHeader`.
- **Critério de aceite.** Admin vê link Convites no header em qualquer página interna do condo.

### PR-12 — Paginator em convites + correção terminologia (P1) — Esforço: **M**

- **Arquivos.** `InvitationsPage`, `InvitationList`, `CondominiumDashboard` (textos do badge).
- **Critério de aceite.** Lista de convites carrega paginada; badge no dashboard diz "3 cédulas em 2 votações" (não só número).

### PR-13 — `BallotCard` redesign + view transitions cédula→revisão (P2) — Esforço: **L**

- **Arquivos.** `BallotVotePage`, `BallotReviewPage`, `app.config.ts` (`withViewTransitions()`).
- **Critério de aceite.** Cédula visualmente prioritária; transição entre voto e revisão suave em Chrome/Edge; sem regressão em Firefox/Safari.

### PR-14 — Empty states com CTAs + ilustrações SVG (P2) — Esforço: **M**

- **Arquivos.** `shared/ui/empty-state.ts`, todos os usos.
- **Critério de aceite.** Cada empty state tem CTA acionável ou link relevante.

### PR-15 — `app-data-table` responsivo + tabs "Encerradas" agrupadas visualmente (P2) — Esforço: **L**

- **Arquivos.** `shared/ui/data-table.ts` (NOVO), `PollsTable`, `ApartmentsPage`.
- **Critério de aceite.** Em 360px de largura, nenhuma tabela tem scroll horizontal involuntário.

### PR-16 — Esqueci a senha (P1) — Esforço: **M**

- **Arquivos.** `Login`, novo `ForgotPasswordPage`, integração com Supabase Auth `resetPasswordForEmail`.
- **Critério de aceite.** Fluxo completo testável em ambiente local com Inbucket.

### Resumo de esforço

- **P0:** PR-01 a PR-06 — 6 PRs, ~12-16h totais.
- **P1:** PR-07 a PR-12 e PR-16 — 7 PRs, ~30-40h totais.
- **P2:** PR-13 a PR-15 — 3 PRs, ~24-32h totais.
- **Total:** ~16 PRs, esforço estimado ~70-90h, distribuído em 4-6 semanas de trabalho focado.

---

## Próximos passos para o usuário

Antes de transformar este documento em PRs, decidir:

1. **Fontes:** Fraunces + Geist Sans (recomendado, free) — confirma?
2. **Dark mode:** fora da v1 — confirma?
3. **Paleta proposta** (§3.2): aprovar valores ou pedir variação (ex: mais sóbrio, mais quente, mais frio)?
4. **Ordem de PRs:** seguir a sequência §8 ou priorizar diferente?
5. **Screenshot tests** antes do PR-07: investir agora para evitar regressão visual?
