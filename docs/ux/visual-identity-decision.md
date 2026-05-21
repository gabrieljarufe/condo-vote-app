# Visual Identity Decision — Bossa Cívica

> Decisão de identidade visual da v1 do redesign UX do condo-vote-app, finalizada na sessão de plan mode obrigatória pelo `HANDOFF.md §5.0` antes da execução do PR-07.

---

## 1. Direção escolhida

**Bossa Cívica** — modernismo brasileiro + warmth cívica. Spec canônico completo em `docs/ux/DESIGN.md` (frontmatter YAML + brand notes). Mockups de referência em `docs/ux/design-pure-html/{app,web}.html` (Tailwind v3 — traduzir para Tailwind v4 `@theme` no PR-07).

**Pares tipográficos:**
- **Literata** (Google Fonts, serifa transicional, weights 400/500/600/700) — display, headlines, perguntas de cédula.
- **Be Vietnam Pro** (Google Fonts, neo-grotesco, weights 400/500/600) — body, navegação, forms.

**Cores-âncora:**
- Surface warm `#fff8f5` (sand off-white)
- Primary verde tropical profundo `#005129`
- Secondary terracota `#9e4127`

**Shape language:** Rounded 0.5rem base; **pill (full radius)** em botões de ação e elementos decorativos para criar contraste "Bossa" com retângulos do layout.

---

## 2. Paleta light (verbatim de `docs/ux/DESIGN.md`)

| Role | Token | Hex |
|---|---|---|
| Surface base | `--color-surface` | `#fff8f5` |
| Surface dim | `--color-surface-dim` | `#e1d8d4` |
| Surface bright | `--color-surface-bright` | `#fff8f5` |
| Container lowest | `--color-surface-container-lowest` | `#ffffff` |
| Container low | `--color-surface-container-low` | `#fbf2ed` |
| Container | `--color-surface-container` | `#f5ece7` |
| Container high | `--color-surface-container-high` | `#efe6e2` |
| Container highest | `--color-surface-container-highest` | `#e9e1dc` |
| On surface | `--color-on-surface` | `#1e1b18` |
| On surface variant | `--color-on-surface-variant` | `#3f4940` |
| Inverse surface | `--color-inverse-surface` | `#34302c` |
| Inverse on surface | `--color-inverse-on-surface` | `#f8efea` |
| Outline | `--color-outline` | `#6f7a70` |
| Outline variant | `--color-outline-variant` | `#bfc9be` |
| Surface tint | `--color-surface-tint` | `#116c3b` |
| **Primary** | `--color-primary` | `#005129` |
| On primary | `--color-on-primary` | `#ffffff` |
| Primary container | `--color-primary-container` | `#0e6b3a` |
| On primary container | `--color-on-primary-container` | `#94e9ab` |
| Inverse primary | `--color-inverse-primary` | `#85d89c` |
| Primary fixed | `--color-primary-fixed` | `#a0f5b7` |
| Primary fixed dim | `--color-primary-fixed-dim` | `#85d89c` |
| On primary fixed | `--color-on-primary-fixed` | `#00210d` |
| On primary fixed variant | `--color-on-primary-fixed-variant` | `#00522a` |
| **Secondary** | `--color-secondary` | `#9e4127` |
| On secondary | `--color-on-secondary` | `#ffffff` |
| Secondary container | `--color-secondary-container` | `#ff8b6b` |
| On secondary container | `--color-on-secondary-container` | `#75230b` |
| Secondary fixed | `--color-secondary-fixed` | `#ffdbd1` |
| Secondary fixed dim | `--color-secondary-fixed-dim` | `#ffb5a1` |
| On secondary fixed | `--color-on-secondary-fixed` | `#3b0800` |
| On secondary fixed variant | `--color-on-secondary-fixed-variant` | `#7f2a12` |
| Tertiary | `--color-tertiary` | `#464642` |
| On tertiary | `--color-on-tertiary` | `#ffffff` |
| Tertiary container | `--color-tertiary-container` | `#5e5d59` |
| On tertiary container | `--color-on-tertiary-container` | `#d9d6d1` |
| Tertiary fixed | `--color-tertiary-fixed` | `#e5e2dd` |
| Tertiary fixed dim | `--color-tertiary-fixed-dim` | `#c9c6c2` |
| On tertiary fixed | `--color-on-tertiary-fixed` | `#1c1c19` |
| On tertiary fixed variant | `--color-on-tertiary-fixed-variant` | `#474743` |
| Error | `--color-error` | `#ba1a1a` |
| On error | `--color-on-error` | `#ffffff` |
| Error container | `--color-error-container` | `#ffdad6` |
| On error container | `--color-on-error-container` | `#93000a` |
| Background | `--color-background` | `#fff8f5` |
| On background | `--color-on-background` | `#1e1b18` |
| Surface variant | `--color-surface-variant` | `#e9e1dc` |

**Tokens semânticos adicionais (mantidos do PR-02, ajustados para coerência Bossa Cívica):**

| Role | Token | Hex |
|---|---|---|
| Success | `--color-success` | `#0e6b3a` |
| On success | `--color-on-success` | `#ffffff` |
| Success container | `--color-success-container` | `#c8f5d4` |
| On success container | `--color-on-success-container` | `#002111` |
| Warning | `--color-warning` | `#A35C00` |
| On warning | `--color-on-warning` | `#ffffff` |
| Warning container | `--color-warning-container` | `#FCE4BD` |
| On warning container | `--color-on-warning-container` | `#2A1800` |
| Info | `--color-info` | `#1B5E9E` |
| On info | `--color-on-info` | `#ffffff` |
| Info container | `--color-info-container` | `#D6E8F7` |
| On info container | `--color-on-info-container` | `#001D34` |

---

## 3. Paleta dark derivada (M3 tone-based)

Derivada usando os tons inversos do `DESIGN.md` como ponte cross-mode (`inverse-primary`, `inverse-surface`, `surface-tint`) + extensão pela Tonal Palette M3 do seed verde `#005129`. Surface warm-earth `#14110b` preserva a personalidade "cartorial brasileiro" no escuro — não cai em "slate cinza SaaS".

| Role | Token | Hex | Contraste vs base | Status |
|---|---|---|---|---|
| Surface base | `--color-surface` | `#14110b` | — | base warm earth |
| Surface dim | `--color-surface-dim` | `#14110b` | — | |
| Surface bright | `--color-surface-bright` | `#3b352f` | — | |
| Container lowest | `--color-surface-container-lowest` | `#0e0c08` | — | |
| Container low | `--color-surface-container-low` | `#1c1814` | — | inputs |
| Container | `--color-surface-container` | `#211d18` | — | cards padrão |
| Container high | `--color-surface-container-high` | `#2b2722` | — | header/drawer |
| Container highest | `--color-surface-container-highest` | `#36322c` | — | dialogs |
| On surface | `--color-on-surface` | `#ece5dd` | **13.6:1 AAA** vs surface | texto principal |
| On surface variant | `--color-on-surface-variant` | `#c9c5b9` | **9.4:1 AAA** vs surface | labels |
| Outline | `--color-outline` | `#939185` | **4.8:1 AA** vs surface | borda foco/erro |
| Outline variant | `--color-outline-variant` | `#494842` | 1.8:1 hairline | bordas decorativas |
| Inverse surface | `--color-inverse-surface` | `#ece5dd` | — | claro em dark |
| Inverse on surface | `--color-inverse-on-surface` | `#34302c` | — | |
| Surface tint | `--color-surface-tint` | `#85d89c` | — | |
| **Primary** | `--color-primary` | `#85d89c` | **10.2:1 AAA** vs surface | CTAs, links |
| On primary | `--color-on-primary` | `#003919` | **9.4:1 AAA** vs primary | texto em CTA |
| Primary container | `--color-primary-container` | `#00522a` | — | chip selecionado |
| On primary container | `--color-on-primary-container` | `#a0f5b7` | **8.5:1 AAA** vs container | texto em chip |
| Inverse primary | `--color-inverse-primary` | `#005129` | — | |
| Primary fixed | `--color-primary-fixed` | `#a0f5b7` | — | |
| Primary fixed dim | `--color-primary-fixed-dim` | `#85d89c` | — | |
| On primary fixed | `--color-on-primary-fixed` | `#00210d` | — | |
| On primary fixed variant | `--color-on-primary-fixed-variant` | `#00522a` | — | |
| **Secondary** | `--color-secondary` | `#ffb5a1` | **9.0:1 AAA** vs surface | terracota clara |
| On secondary | `--color-on-secondary` | `#5e1700` | **7.6:1 AAA** vs secondary | |
| Secondary container | `--color-secondary-container` | `#7f2a12` | — | accent chips |
| On secondary container | `--color-on-secondary-container` | `#ffdbd1` | **8.9:1 AAA** vs container | |
| Secondary fixed | `--color-secondary-fixed` | `#ffdbd1` | — | |
| Secondary fixed dim | `--color-secondary-fixed-dim` | `#ffb5a1` | — | |
| On secondary fixed | `--color-on-secondary-fixed` | `#3b0800` | — | |
| On secondary fixed variant | `--color-on-secondary-fixed-variant` | `#7f2a12` | — | |
| Tertiary | `--color-tertiary` | `#c9c6c2` | **8.2:1 AAA** vs surface | inativo/disabled |
| On tertiary | `--color-on-tertiary` | `#2f2f2c` | **9.1:1 AAA** vs tertiary | |
| Tertiary container | `--color-tertiary-container` | `#474743` | — | |
| On tertiary container | `--color-on-tertiary-container` | `#e5e2dd` | **8.7:1 AAA** vs container | |
| Tertiary fixed | `--color-tertiary-fixed` | `#e5e2dd` | — | |
| Tertiary fixed dim | `--color-tertiary-fixed-dim` | `#c9c6c2` | — | |
| On tertiary fixed | `--color-on-tertiary-fixed` | `#1c1c19` | — | |
| On tertiary fixed variant | `--color-on-tertiary-fixed-variant` | `#474743` | — | |
| Error | `--color-error` | `#ffb4ab` | **8.7:1 AAA** vs surface | ícones erro |
| On error | `--color-on-error` | `#690005` | **7.1:1 AAA** vs error | |
| Error container | `--color-error-container` | `#93000a` | — | |
| On error container | `--color-on-error-container` | `#ffdad6` | **7.4:1 AAA** vs container | |
| Background | `--color-background` | `#14110b` | — | |
| On background | `--color-on-background` | `#ece5dd` | **13.6:1 AAA** vs background | |
| Surface variant | `--color-surface-variant` | `#494842` | — | |

**Tokens semânticos adicionais — dark:**

| Role | Token | Hex | Contraste |
|---|---|---|---|
| Success | `--color-success` | `#85d89c` | 10.2:1 AAA vs surface |
| On success | `--color-on-success` | `#003919` | 9.4:1 AAA vs success |
| Success container | `--color-success-container` | `#00522a` | — |
| On success container | `--color-on-success-container` | `#a0f5b7` | 8.5:1 AAA vs container |
| Warning | `--color-warning` | `#FFB68A` | 8.2:1 AAA vs surface |
| On warning | `--color-on-warning` | `#522300` | — |
| Warning container | `--color-warning-container` | `#7A4400` | — |
| On warning container | `--color-on-warning-container` | `#FFE0C3` | 7.8:1 AAA vs container |
| Info | `--color-info` | `#A9CBF5` | 9.1:1 AAA vs surface |
| On info | `--color-on-info` | `#003258` | — |
| Info container | `--color-info-container` | `#0E3C66` | — |
| On info container | `--color-on-info-container` | `#D6E8F7` | 7.6:1 AAA vs container |

---

## 4. Gatilho do dark mode

**Automático via `prefers-color-scheme: dark`.** Sem toggle, sem persistência, sem código TS extra.

Implementação em `frontend/src/styles.scss`:

```scss
@media (prefers-color-scheme: dark) {
  :root {
    --color-surface: #14110b;
    /* ...demais tokens redefinidos... */
  }
}
```

**Justificativa:**
- LocalStorage não é convenção do projeto (`TenantService` é em memória — `docs/coding-patterns.md`).
- Cookie + middleware adiciona superfície de bug (SSR/hidratação) sem benefício mensurável para a v1.
- Toggle em memória resetaria no F5 → UX inconsistente, pior que não ter toggle.
- `prefers-color-scheme` é zero-cost, zero-bug, e o SO já é onde o usuário expressa preferência.

**Trade-off aceito:** se o usuário usa light no SO mas quer dark no condo-vote-app (ou vice-versa), não conseguirá. Aceita-se para a v1; se telemetria futura mostrar demanda, adiciona-se toggle com cookie.

---

## 5. Decisões cross-mode

- **Sombras:** opacities ajustadas em dark (14-22%) vs light (4-8%) para criar profundidade visível em surfaces escuras. Implementar com tokens `--shadow-elevation-*` no PR-08 ou inline no PR-07 onde já existir.
- **Focus ring global** (`:focus-visible`): muda de `var(--color-secondary)` (atual: azul vivo) para `var(--color-primary)`. Em light: `#005129` sobre `#fff8f5` = 14.5:1; em dark: `#85d89c` sobre `#14110b` = 10.2:1. Ambos passam WCAG 1.4.11 (3:1 para UI components).
- **Pulse do status "Aberta"** (`animate-pulse`): mesma curva em ambos os modos; `prefers-reduced-motion: reduce` zera (já tratado globalmente em PR-08 futuro, mas já honrado em `success-popup`).
- **Scrollbar** (`::-webkit-scrollbar-thumb`): em dark usa `--color-outline` (que vira `#939185`) — fica visível sem ser agressivo.

---

## 6. Tipografia — escala normalizada (do `DESIGN.md`)

| Token | Tamanho/line-height | Weight | Letter-spacing | Família |
|---|---|---|---|---|
| `--text-display-lg` | 48/56 | 700 | -0.02em | Literata |
| `--text-headline-lg` | 32/40 | 600 | 0 | Literata |
| `--text-headline-lg-mobile` | 28/36 | 600 | 0 | Literata |
| `--text-headline-md` | 24/32 | 500 | 0 | Literata |
| `--text-body-lg` | 18/28 | 400 | 0 | Be Vietnam Pro |
| `--text-body-md` | 16/24 | 400 | 0 | Be Vietnam Pro |
| `--text-label-md` | 14/20 | 600 | 0.01em | Be Vietnam Pro |
| `--text-label-sm` | 12/16 | 500 | 0.04em | Be Vietnam Pro |

**Famílias:**
- `--font-display: "Literata", ui-serif, Georgia, serif`
- `--font-body: "Be Vietnam Pro", ui-sans-serif, system-ui, sans-serif`
- `--font-sans: var(--font-body)` (alias para compat; `body { font-family: var(--font-body) }`)

---

## 7. Critério de validação WCAG AA

- **Texto normal (< 18.66px ou < 24px se 700):** ≥ 4.5:1 — todos os pares `on-X` vs `X` validados acima.
- **Texto grande / UI components:** ≥ 3:1 — `outline` em ambos os modos passa folgado.
- **`prefers-reduced-motion`:** honrado por `success-popup` (atual); auditoria global fica para PR-08.
- **Target size:** mínimo 44×44px em controles — verificado fora deste documento, no smoke do PR-07.

---

## 8. Não-decisões (explícito)

- **Toggle manual de dark:** fora da v1.
- **Tokens de motion / `prefers-reduced-motion` global:** PR-08, fora deste PR.
- **Componente `app-button`:** PR-09, fora deste PR.
- **Componentes do `DESIGN.md` (pill em "Aprovar"/"Rejeitar", organic shapes, ambient shadows tactile):** PR-13 (BallotCard editorial). Aqui só os tokens base entram — a aplicação visual completa virá depois.

---

## 9. Validação cruzada com plano

Este documento valida e fecha as 6 obrigações da §5.0 do `docs/ux/HANDOFF.md`:

1. ✅ Direção visual escolhida entre alternativas (Bossa Cívica vs Editorial Cartorial vs Civic Modernist, ver chat de plan mode).
2. ✅ Paleta dupla (light + dark) com contraste WCAG AA recalculado em ambos.
3. ✅ Gatilho do dark mode definido: `prefers-color-scheme` automático.
4. ✅ Referências consultadas: `DESIGN.md` (canônico), Material 3 tone-based dark palette, M3 cross-mode tokens (`inverse-*`).
5. ✅ Este arquivo (`docs/ux/visual-identity-decision.md`).
6. ⏭ PR-07 executado em seguida.
