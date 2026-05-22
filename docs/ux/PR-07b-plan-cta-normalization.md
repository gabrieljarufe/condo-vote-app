# Plano — Normalizar CTAs primários para `bg-primary` verde (PR-07, segundo commit)

## Contexto

O PR-07 introduziu a paleta Bossa Cívica (`--color-primary` = verde tropical `#005129` light / `#88d89c` dark). Mas o codebase foi escrito quando a paleta antiga tinha:
- `--color-primary: #000000` (preto, não-CTA)
- `--color-secondary: #0051d5` (azul, era a cor de ação)

Por isso, **todos os botões "Entrar", "Começar agora", "Convidar", "+ Novo apartamento", etc usam `bg-secondary`** — herdaram a regra antiga onde secondary era o CTA visível. Com a nova identidade, **secondary é terracota (`#9e4127`)** — uma cor de **acento brand**, não de CTA principal.

Resultado em uso real: convivem na mesma tela botões verdes (ex: "Publicar votação" no ConfirmDialog, "Votar" no ballot-review, badge "Vencedora") e botões terracota (ex: "Entrar" na landing). O verde é o correto pela paleta nova; o terracota é resquício.

**Objetivo:** normalizar todos os CTAs primários para `bg-primary`/`text-on-primary`, preservar terracota apenas onde é acento brand deliberado.

**Decisões do plan mode com o usuário:**
- Trocar focus rings dos inputs (`focus:border-secondary` → `focus:border-primary`) — alinha com o `:focus-visible` global que já é primary verde.
- Fazer **agora, no mesmo PR-07** (mesmo branch `worktree-ux-redesign-p1`, segundo commit). Razão: smoke visual é feito uma vez com a UI completamente consistente.

**Fora de escopo:**
- Paleta light/dark (já entregues).
- Toggle / tokens (já entregues).
- PR-08+ (motion, `app-button` componente, etc).

---

## §1. Regra de triagem por categoria

| Padrão atual | Vira | Onde |
|---|---|---|
| `bg-secondary text-on-secondary` (CTA primário) | `bg-primary text-on-primary` | 17 arquivos com botões "Entrar"/"Salvar"/"Criar"/"Confirmar"/"+ Novo …" |
| `focus:border-secondary` em input | `focus:border-primary` | Todos os inputs (login, poll-form, apartment-form, invitation forms, onboarding) |
| `focus:ring-secondary/20` | `focus:ring-primary/20` | poll-cancel-dialog |
| `hover:border-secondary` em card clicável | `hover:border-primary` | home (card de condomínio), apartment-bulk-preview |
| `text-secondary hover:underline` (link) | `text-primary hover:underline` | apartment-bulk-preview, apartment-list, invitation-accept (link "entrar"), polls-table (link de poll) |
| `hover:text-secondary` | `hover:text-primary` | polls-table |
| **Acentos brand intencionais (NÃO mudar):** | | |
| Hero highlight "sem papel e sem dúvida." | `text-secondary` mantém | landing.ts:44 |
| Ícones decorativos `apartment`/`mail` no dashboard | `text-secondary` mantém | condominium-dashboard.ts:36,50 |
| `bg-secondary-fixed text-on-secondary-fixed-variant` (chips/badges) | mantém | landing chip "Em conformidade", home card icon (já corrigido) |
| Link "Trocar" no header autenticado | `text-secondary` mantém | app-header.ts:46 — pequeno texto-ação, acento |

---

## §2. Arquivos a modificar

### `bg-secondary` → `bg-primary` (CTAs primários)

Lista exaustiva (17 arquivos identificados via grep). Cada hit é cosmético: troca `bg-secondary text-on-secondary` por `bg-primary text-on-primary`. Quando há `hover:brightness-110` / `disabled:opacity-*` adjacentes, mantém.

| Arquivo | Linhas (aprox.) | Botão |
|---|---|---|
| `frontend/src/app/shared/layout/public-header.ts` | 23 | "Entrar" |
| `frontend/src/app/features/landing/landing.ts` | 54 | "Começar agora" |
| `frontend/src/app/features/auth/login.ts` | 87 | "Entrar" |
| `frontend/src/app/features/home/home.ts` | (verificar) | "Selecionar" no card de condo |
| `frontend/src/app/features/onboarding/invitation-accept-page.ts` | (verificar) | "Aceitar convite" |
| `frontend/src/app/features/polls/poll-form.ts` | (verificar) | "Criar poll" / "Salvar" |
| `frontend/src/app/features/polls/polls-page.ts` | (verificar) | "+ Nova votação" |
| `frontend/src/app/features/polls/poll-detail-page.ts` | (verificar) | botões de transição |
| `frontend/src/app/features/apartments/apartments-page.ts` | (verificar) | "+ Novo apartamento" |
| `frontend/src/app/features/apartments/apartment-form.ts` | (verificar) | "Criar" |
| `frontend/src/app/features/apartments/apartment-bulk-generator-form.ts` | (verificar) | "Gerar" |
| `frontend/src/app/features/apartments/apartment-bulk-preview-grid.ts` | (verificar) | confirm bulk |
| `frontend/src/app/features/apartments/apartments-bulk-page.ts` | (verificar) | confirm/salvar |
| `frontend/src/app/features/invitations/invitations-page.ts` | (verificar) | "+ Convidar" |
| `frontend/src/app/features/invitations/invitation-individual-form.ts` | (verificar) | "Enviar convite" |
| `frontend/src/app/features/invitations/invitation-bulk/invitation-bulk-preview-grid.ts` | (verificar) | confirm bulk |
| `frontend/src/app/features/polls/voting/ballot-card.ts` | (verificar) | UI de seleção |

### Focus rings em inputs

`focus:border-secondary` (15+ ocorrências) → `focus:border-primary`. Arquivos:
- `login.ts` (2 inputs)
- `poll-form.ts` (5 inputs)
- `poll-cancel-dialog.ts` (1 — também tem `focus:ring-secondary/20` → `focus:ring-primary/20`)
- `apartment-form.ts` (2)
- `apartment-bulk-preview-grid.ts` (1)
- `invitation-accept-page.ts` (4)

### Links e hovers pequenos

`text-secondary hover:underline` (links pequenos, não-CTA) → `text-primary hover:underline`:
- `apartment-bulk-preview-grid.ts:127`
- `apartment-list.ts:42`
- `invitation-accept-page.ts:311` (link "entrar" em texto corrido)
- `polls-table.ts:45` (`hover:text-secondary` em row link)

### Card hovers
`hover:border-secondary` → `hover:border-primary`:
- `home.ts:60` (card de condomínio)
- `apartment-bulk-preview-grid.ts:79` (célula editável)

---

## §3. Acentos brand mantidos (revisão consciente)

Após a migração, esses ainda usam terracota — confirmar visualmente que ficou bom:

1. **`landing.ts:44`** — `<span class="text-secondary">sem papel e sem dúvida.</span>` no hero. Acento de personalidade na headline.
2. **`landing.ts:37`** — chip "Em conformidade com a Lei 14.309/22" usa `bg-secondary-fixed text-on-secondary-fixed-variant`. Badge brand.
3. **`condominium-dashboard.ts:36,50`** — ícones `apartment` e `mail` em `text-secondary` (acento visual no dashboard).
4. **`app-header.ts:46`** — link "Trocar" (`text-secondary hover:underline`). Pequeno acento secundário no header.
5. **Botões de "Cancelar"** em dialogs onde existirem em terracota — confirmar que não passam a competir com primary.

---

## §4. Verificação end-to-end

1. **Migração mecânica:** usar `Edit` com `replace_all: true` por arquivo para os padrões mais repetidos:
   ```
   "bg-secondary text-on-secondary" → "bg-primary text-on-primary"
   "focus:border-secondary" → "focus:border-primary"
   "focus:ring-secondary/20" → "focus:ring-primary/20"
   "hover:border-secondary" → "hover:border-primary"
   "hover:text-secondary" → "hover:text-primary"
   ```
   Para `text-secondary` puro (não é hover/border/focus): editar **manualmente** porque tem que distinguir acentos brand mantidos (§3) dos links que viram primary.

2. **Lint + tests + cpd + build dev:**
   ```bash
   cd /Users/gabrieljarufe/Developer/projects/condo-vote-app-ux-redesign-p1/frontend
   npm run lint && npm run test:ci && npm run cpd && npx ng build --configuration=development
   ```
   Esperado: 398/398 testes passam (mudanças são cosméticas, sem lógica).

3. **Smoke visual em browser** (ng serve já em watch em :4200):
   - Landing: hero highlight terracota mantido; CTA "Começar agora" agora verde; chip de conformidade ainda terracota; botão "Entrar" no header agora verde.
   - Login: botão "Entrar" verde; focus de input em verde.
   - Home: card de condomínio com hover verde; cards de role mantêm icon terracota.
   - Dashboard: ícones decorativos terracota mantidos.
   - Criar poll / form: focus de input em verde; botão "Salvar/Criar" em verde.
   - Convites / apartamentos: mesma regra.
   - **Em ambos os modos** (light + dark).

4. **Audit final:**
   ```bash
   grep -rEn 'bg-secondary\b' frontend/src/app --include='*.ts' --include='*.html'
   ```
   Esperado: zero hits, ou só os acentos justificados em §3.

---

## §5. Critérios de aceite

- [ ] Audit `bg-secondary` retorna só `bg-secondary-fixed` (chip da landing) e listados em §3.
- [ ] `focus:border-secondary` e `focus:ring-secondary` zerados.
- [ ] Links pequenos (`text-secondary hover:underline`) migrados, exceto §3.
- [ ] `npm run lint && npm run test:ci && npm run cpd`: tudo passa.
- [ ] Build dev OK.
- [ ] Smoke visual: CTAs em verde, acentos brand em terracota, focus consistente entre input e botão.
- [ ] Commit no branch `worktree-ux-redesign-p1` sem co-author, scan de secrets.

---

## §6. Riscos

- **R1 — Texto branco perde contraste sobre verde light `#005129`.** Cálculo: `#ffffff` vs `#005129` = 8.4:1 AAA. Folgado. Sem regressão esperada.
- **R2 — Acento brand removido inadvertidamente.** Mitigação: §3 lista explícita do que NÃO mudar; usar `replace_all` só para padrões compostos (`text-secondary hover:underline`), nunca para `text-secondary` puro.
- **R3 — `disabled:opacity-*` ou `hover:brightness-*` em botões interferem com `text-on-primary` em vez de `text-on-secondary`.** Cor de fundo muda; opacity/brightness não dependem. Sem impacto.
- **R4 — Botões "Encerrar"/"Cancelar"/"Excluir" perdem destaque de perigo.** Não tocamos esses — eles usam `bg-error` ou variant `danger` do ConfirmDialog. Sem regressão.
