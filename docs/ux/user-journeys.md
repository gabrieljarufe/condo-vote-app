# Jornadas de Usuário — Condo Vote

> **Metodologia:** documento produzido por análise estática de código (Angular 21.2 + Spring Boot backend).
> MCP de browser (Playwright/Chrome) não está disponível neste ambiente — as seções §3, §4 e §5 são derivadas
> exclusivamente da leitura de componentes, guards, serviços e rotas. Nenhum screenshot foi capturado.
> Stack verificada como UP antes da análise: Supabase local, backend/Redis via Docker Compose, frontend dev server porta 4200.

---

## §1 Personas

### Síndico

**Objetivo principal:** administrar o condomínio digitalmente — cadastrar unidades, convidar moradores e conduzir votações com conformidade legal.

**Frequência de uso estimada:** esporádica mas concentrada — períodos de preparação de assembleias e gestão de convites. Uso intenso antes de cada votação, quase inativo entre elas.

**Perfil inferido do código:**
- Só acessa rotas protegidas por `adminGuard` (além de `authGuard`).
- Realiza operações com estado persistente (criar apartamentos, emitir convites, mudar ciclo de vida de polls).
- Tem visão de todas as votações (todas as tabs), sem filtro "Pendentes" quando atua apenas como admin sem papel de residente.
- Usa ações destrutivas/irreversíveis: revogar convite, cancelar poll (motivo obrigatório mínimo 10 chars), encerrar poll.

**Frustrações inferidas:**
- Ações de ciclo de vida de poll (publicar, abrir, encerrar, cancelar) são confirmadas por `window.confirm()` nativo — sem feedback visual integrado ao design system.
- Não há dashboard com métricas consolidadas (a tela de condomínio exibe "Mais funcionalidades em breve").
- Lista de convites não é paginada — carrega até 100 apartamentos mas convites sem paginação.
- Não existe fluxo de recuperação de senha exposto na tela de login.

---

### Morador / Inquilino

**Objetivo principal:** votar nas assembleias do seu condomínio, no seu tempo, sem burocracia.

**Frequência de uso estimada:** muito esporádica — acesso concentrado em períodos de votação aberta, com média de dias ou semanas de inatividade entre polls.

**Perfil inferido do código:**
- Acessa via magic link de convite (e-mail) → onboarding com CPF + senha → login convencional.
- Tab padrão em votações é "Pendentes" — orientado à ação imediata.
- Pode ter múltiplos apartamentos (locador com várias unidades), o que dispara fluxo de bulk vote ou seleção via dropdown.
- Vê badge numérico de cédulas pendentes no dashboard e na tab de votações.
- Não vê o placar em tempo real enquanto a poll está OPEN (campo `totalVotesSoFar=null` — sigilo do voto).
- Recebe feedback de sucesso via `SuccessPopup` animado antes de ser redirecionado.

**Frustrações inferidas:**
- Fluxo de onboarding via magic link pressupõe que o morador sabe que receberá um e-mail e o abrirá — sem instrução contextual no corpo do e-mail visível no código frontend.
- Após votar em todas as cédulas da poll, a tela de voto exibe "Você já votou em todas as suas cédulas" mas o link para ver o resultado da poll exige navegação manual.
- O morador não tem forma de recuperar senha pelo app (não há link "Esqueci a senha" na tela de login).

---

## §2 Mapa de Rotas

| Rota | Componente | Guard(s) | Papel mínimo | Propósito |
|------|-----------|---------|-------------|-----------|
| `/` | `Landing` | nenhum | público | Página institucional — hero, funcionalidades, FAQ |
| `/login` | `Login` | nenhum | público | Autenticação por e-mail + senha |
| `/invitations/:token` | `InvitationAcceptPage` | nenhum | público | Aceitar convite via magic link; onboarding ou vínculo de conta existente |
| `/app` | (shell lazy) | `authGuard` | autenticado | Área autenticada — carrega `home.routes` |
| `/app` (index) | `Home` | `authGuard` | qualquer | Seletor de condomínios; auto-navega se só há 1 |
| `/app/condominiums/:condoId` | `CondominiumDashboard` | `authGuard`, `tenantRestoreGuard` | qualquer | Dashboard do condo: atalhos para Aptos, Convites (admin), Votações + badge de cédulas pendentes |
| `/app/condominiums/:condoId/apartments` | `ApartmentsPage` | `authGuard`, `tenantRestoreGuard` | qualquer | Lista de apartamentos; CRUD apenas para ADMIN |
| `/app/condominiums/:condoId/apartments/bulk` | `ApartmentsBulkPage` | `authGuard`, `tenantRestoreGuard`, `adminGuard` | ADMIN | Wizard 2 passos: configurar padrão → preview → criar em lote |
| `/app/condominiums/:condoId/invitations` | `InvitationsPage` | `authGuard`, `tenantRestoreGuard`, `adminGuard` | ADMIN | Lista + filtros de convites; formulário individual; atalho para bulk |
| `/app/condominiums/:condoId/invitations/bulk` | `InvitationBulkPage` | `authGuard`, `tenantRestoreGuard`, `adminGuard` | ADMIN | Wizard 2 passos: upload XLSX → preview → envio em lote |
| `/app/condominiums/:condoId/polls` | `PollsPage` | `authGuard`, `tenantRestoreGuard` | qualquer | Lista de votações com tabs; atalho "Nova votação" (admin) |
| `/app/condominiums/:condoId/polls/new` | `PollCreatePage` | `authGuard`, `tenantRestoreGuard`, `adminGuard` | ADMIN | Formulário de criação de votação (salva como DRAFT) |
| `/app/condominiums/:condoId/polls/:pollId` | `PollDetailPage` | `authGuard`, `tenantRestoreGuard` | qualquer | Detalhe da poll: opções, participação do morador, resultado (se encerrada), ações de admin |
| `/app/condominiums/:condoId/polls/:pollId/edit` | `PollEditPage` | `authGuard`, `tenantRestoreGuard`, `adminGuard` | ADMIN | Editar poll em DRAFT ou SCHEDULED |
| `/app/condominiums/:condoId/polls/:pollId/vote` | `BallotVotePage` | `authGuard`, `tenantRestoreGuard` | residente | Cédula de voto — seleciona opção por apartamento |
| `/app/condominiums/:condoId/polls/:pollId/vote/review` | `BallotReviewPage` | `authGuard`, `tenantRestoreGuard` | residente | Revisão e confirmação de votos em lote (múltiplos apartamentos) |
| `/app/condominiums/:condoId/my-polls` | redirect | `authGuard`, `tenantRestoreGuard` | qualquer | Legado — redireciona para `/polls?tab=pendentes` |
| `/**` | redirect para `/` | nenhum | público | Wildcard |

**Total de rotas:** 18 (incluindo redirect e wildcard).

---

## §3 Jornada do Síndico

### Passo 1 — Landing e login

- **Tela:** `/` (Landing)
- **Entrada:** URL direta ou link externo.
- **Ação:** clicar em "Começar agora" → navega para `/login`.
- **Validações:** nenhuma no lado público.
- **Feedback:** página institucional estática com hero SVG inline, seção de funcionalidades (4 cards), "Em três passos" e FAQ accordion.
- **Próxima tela:** `/login`
- **Screenshot:** não disponível (MCP ausente).
- **Observações de UX:** o botão "Começar agora" e a seção "Em três passos" prometem "ata em PDF" e "assinatura digital" como feature — funcionalidades que o código atual não implementa. FAQ anuncia geração de ata como existente.

---

### Passo 2 — Autenticação

- **Tela:** `/login`
- **Entrada:** e-mail + senha.
- **Ação:** preencher form → "Entrar" → `AuthService.signIn()`.
- **Validações:** `required`, `Validators.email`, `minLength(6)`.
- **Feedback:** spinner inline no botão enquanto carrega. Erros mapeados: "E-mail ou senha incorretos", "Confirme seu e-mail antes de entrar", fallback genérico. Toast de "Conta criada com sucesso" se `?registered=1` na query.
- **Próxima tela:** `/app` (ou `returnUrl` se proveniente de redirect).
- **Screenshot:** não disponível.
- **Observações de UX:** não há link "Esqueci a senha". Ao digitar senha incorreta, a mensagem de erro aparece abaixo do botão sem destacar qual campo está errado.

---

### Passo 3 — Seletor de condomínios (Home)

- **Tela:** `/app`
- **Entrada:** chegada após login bem-sucedido.
- **Ação:** se houver 1 único condomínio, auto-navega via `effect()`. Se houver múltiplos, exibe lista de cards clicáveis.
- **Validações:** `authGuard` aguarda `initPromise` do Supabase antes de decidir.
- **Feedback:** spinner "Carregando seus condomínios…" → lista de cards (nome + papel) ou `EmptyState` com instrução de contatar síndico.
- **Próxima tela:** `/app/condominiums/:condoId`
- **Screenshot:** não disponível.
- **Observações de UX:** o morador sem condomínio vê a instrução "Peça ao síndico… para vincular sua conta" — não há call-to-action, apenas texto estático.

---

### Passo 4 — Dashboard do condomínio

- **Tela:** `/app/condominiums/:condoId`
- **Entrada:** seleção do condomínio na Home.
- **Ação:** visualizar atalhos de navegação; para admin, vê "Apartamentos", "Convites", "Votações". Morador vê apenas "Apartamentos" e "Votações".
- **Validações:** `tenantRestoreGuard` restaura o tenant a partir do `condoId` na URL (suporta F5/deep link).
- **Feedback:** spinner durante carregamento; badge numérico de cédulas pendentes no card "Votações" para residentes.
- **Próxima tela:** qualquer dos 3 atalhos.
- **Screenshot:** não disponível.
- **Observações de UX:** a área inferior "Mais funcionalidades em breve" com ícone `construction` está sempre visível — sem forma de ocultar ou saber o roadmap. O card "Convites" não aparece para o morador mesmo que ele seja admin de outro condo (a visibilidade é por role ativa, não global).

---

### Passo 5 — Gerenciar apartamentos

- **Tela:** `/app/condominiums/:condoId/apartments`
- **Entrada:** clique em "Apartamentos" no dashboard ou no header.
- **Ação (admin):** visualizar lista paginada; toggle de inadimplência por apartamento; botão "+ Novo apartamento" → chooser modal (Individual ou Lote).
- **Ação (morador):** tabela read-only com bloco, unidade e situação.
- **Validações:** `adminGuard` bloqueia a rota de bulk para não-admin. Formulário individual valida bloco (opcional) e número de unidade (obrigatório, máx 20 chars). Criação falha com mensagem se unidade duplicada no bloco.
- **Feedback:** spinner durante carregamento; erro inline se API falha; chooser aparece sobreposto (não é `Dialog` reutilizável — é um componente específico).
- **Próxima tela:** `apartments/bulk` (se lote) ou permanece na mesma página (se individual, form aparece inline).
- **Screenshot:** não disponível.
- **Observações de UX:** o toggle de inadimplência não tem confirmação — é imediato. Morador vê coluna "Situação" (adimplente/inadimplente) mas não tem contexto de por que isso importa.

---

### Passo 6 — Gerenciar convites

- **Tela:** `/app/condominiums/:condoId/invitations`
- **Entrada:** clique em "Convites" no dashboard.
- **Ação:** filtrar por status e apartamento; reenviar, revogar, corrigir e-mail (BOUNCED). Criar convite individual (formulário inline) ou bulk (XLSX).
- **Validações (form individual):** apartamento obrigatório (dropdown), papel (radio OWNER/TENANT), e-mail obrigatório+válido, CPF com máscara + padrão `\d{3}\.\d{3}\.\d{3}-\d{2}` + validação de todos dígitos iguais.
- **Feedback:** lista de convites com badge de status colorido (amarelo=PENDENTE, verde=ACEITO, vermelho=BOUNCED, cinza=EXPIRADO/REVOGADO). "Expira em Xh" para pendentes. Inline input de e-mail para correção em BOUNCED.
- **Próxima tela:** permanece (convite adicionado no topo da lista); ou navega para `invitations/bulk`.
- **Screenshot:** não disponível.
- **Observações de UX:** as cores de status (amarelo, verde, vermelho, cinza) usam classes Tailwind hardcoded (`bg-yellow-100`, `bg-green-100`, `bg-red-100`) — fora do design system de tokens do projeto. Ao reenviar um convite, o convite original muda para REVOGADO e o novo aparece no topo — comportamento não óbvio para o síndico.

---

### Passo 7 — Criar votação

- **Tela:** `/app/condominiums/:condoId/polls/new`
- **Entrada:** clique em "+ Nova votação" na página de votações.
- **Ação:** preencher título (máx 200 chars), descrição opcional (máx 2000 chars), convocação (1ª/2ª), modo de quórum (4 opções), datas de início/fim (datetime-local pré-preenchidos: agora e +30min), opções de votação (2 a 10 itens).
- **Validações:** título e datas obrigatórios; fim > início (validator cruzado); mín 2 opções, sem brancos, sem duplicatas; convocação e quórum obrigatórios. Botão "Criar rascunho" desabilitado enquanto form inválido ou submetendo (anti-double-submit).
- **Feedback:** erros inline nos campos. Erro de servidor exibido abaixo do form. Após sucesso, navega para o detalhe da poll criada (em DRAFT).
- **Próxima tela:** `/polls/:pollId` (detalhe em DRAFT).
- **Screenshot:** não disponível.
- **Observações de UX:** o erro cruzado "A data de fim deve ser posterior ao início" só aparece quando `scheduledEnd` está dirty ou touched — se o usuário altera apenas o início e deixa o fim intocado, o erro não aparece imediatamente.

---

### Passo 8 — Publicar e conduzir a votação

- **Tela:** `/app/condominiums/:condoId/polls/:pollId`
- **Entrada:** chegada via lista de polls ou redirect após criar.
- **Ação (DRAFT):** visualizar detalhe; botões "Editar" e "Publicar" e "Cancelar". Publicar usa `window.confirm()`.
- **Ação (SCHEDULED):** botões "Editar", "Abrir agora" e "Cancelar". "Abrir agora" usa `window.confirm()`.
- **Ação (OPEN):** botão "Encerrar" e "Cancelar". "Encerrar" usa `window.confirm()`. Cancelar abre `PollCancelDialog` com textarea de motivo (10-500 chars obrigatório).
- **Ação (CLOSED/INVALIDATED):** apenas visualização do resultado com breakdown por opção (barras de progresso) e badge "Vencedora".
- **Validações:** `adminGuard` protege edição; erro 422 na abertura traduzido para "Não há eleitores elegíveis".
- **Feedback:** `PollStatusBadge` com cor por status. DL de informações (convocação, quórum, datas). Erro inline após ações frustradas.
- **Próxima tela:** permanece após ação (recarrega via `loadDetail()`).
- **Screenshot:** não disponível.
- **Observações de UX:** ações "Publicar", "Abrir agora" e "Encerrar" usam `window.confirm()` nativo — não seguem o design system da aplicação (que tem `Dialog` reutilizável). Apenas "Cancelar" usa o dialog customizado.

---

## §4 Jornada do Morador / Inquilino

### Passo 1 — Receber e-mail de convite

- **Tela:** cliente de e-mail → Inbucket em dev (http://localhost:54324).
- **Entrada:** e-mail com magic link enviado pelo síndico após criação do convite.
- **Ação:** clicar no link → navega para `/invitations/:token`.
- **Validações:** token validado pelo backend antes de exibir qualquer formulário.
- **Feedback:** durante validação, tela exibe spinner "Validando convite…".
- **Próxima tela:** `InvitationAcceptPage` com estado derivado do token.
- **Screenshot:** não disponível.
- **Observações de UX:** o frontend não tem acesso ao template do e-mail — não é possível auditar instruções ao morador via análise de código Angular.

---

### Passo 2 — Onboarding (conta nova)

- **Tela:** `/invitations/:token` — modo `CREATE`
- **Entrada:** token válido cujo e-mail não tem conta ainda.
- **Ação:** preencher nome completo, CPF (com máscara automática), senha (mín 8 chars), confirmar senha, aceitar checkbox de declaração de vínculo.
- **Validações:** nome obrigatório (máx 255); CPF com regex `^\d{3}\.\d{3}\.\d{3}-\d{2}$`; senhas iguais (validator cruzado `passwordsMatch`); `Validators.requiredTrue` no checkbox; e-mail pré-preenchido e readonly.
- **Feedback:** erros inline por campo; erro cruzado "As senhas não conferem" ao nível do group; erros de servidor mapeados (CPF não confere → 400, conflito → 409, rate limit → 429).
- **Próxima tela:** `/login?registered=1` (toast de confirmação).
- **Screenshot:** não disponível.
- **Observações de UX:** o e-mail é readonly mas visualmente usa `bg-surface-container text-on-surface-variant cursor-not-allowed` — diferente do estilo padrão dos outros campos. O checkbox de aceite tem texto legal denso com termos específicos do apartamento: o morador precisa ler com atenção antes de marcar.

---

### Passo 3 — Onboarding (conta existente — modo LINK)

- **Tela:** `/invitations/:token` — modo `LINK`
- **Entrada:** token válido cujo e-mail já tem conta e usuário está logado com esse e-mail.
- **Ação:** confirmar checkbox de declaração → "Aceitar convite".
- **Validações:** `Validators.requiredTrue` no checkbox.
- **Feedback:** spinner "Vinculando…" no botão. Erros de servidor (403, 409, 429).
- **Próxima tela:** `/app` (dashboard de seleção de condos).
- **Screenshot:** não disponível.
- **Observações de UX:** se o usuário está logado com e-mail diferente, vê o modo `WRONG_USER` com instrução de sair. A opção de sair usa `window.location.reload()` após `signOut()` — pode causar flash visual.

---

### Passo 4 — Login e acesso ao condomínio

- **Tela:** `/login` → `/app` → `/app/condominiums/:condoId`
- **Entrada:** credenciais criadas no onboarding.
- **Ação:** login → seletor de condos → dashboard.
- **Validações:** idem ao fluxo do síndico (Passos 2-4 da jornada do síndico).
- **Feedback:** badge numérico de cédulas pendentes no card "Votações" do dashboard.
- **Próxima tela:** `/app/condominiums/:condoId/polls`
- **Screenshot:** não disponível.
- **Observações de UX:** o badge no card "Votações" conta cédulas (por apartamento), não polls — um morador com 3 apartamentos em 1 poll vê badge "3", não "1".

---

### Passo 5 — Ver votações pendentes

- **Tela:** `/app/condominiums/:condoId/polls` — tab "Pendentes"
- **Entrada:** clique em "Votações" no dashboard.
- **Ação:** a tab "Pendentes" é selecionada por padrão para residentes. Cada card de poll pendente mostra título, "X de Y cédulas pendentes", data de encerramento e botão "Votar →".
- **Validações:** morador sem papel de residente não vê a tab "Pendentes".
- **Feedback:** spinner durante carregamento; empty state "Você não tem votações pendentes" com link "Ver em andamento".
- **Próxima tela:** `/polls/:pollId/vote` ao clicar "Votar →".
- **Screenshot:** não disponível.
- **Observações de UX:** o contador "X de Y cédulas pendentes" usa a palavra "cédulas" — terminologia técnica que pode não ser familiar a todos os moradores.

---

### Passo 6 — Votar (cédula única)

- **Tela:** `/app/condominiums/:condoId/polls/:pollId/vote`
- **Entrada:** clique em "Votar →" na lista de pendentes.
- **Ação:** selecionar uma opção de voto no `BallotCard`; confirmar com "Confirmar voto".
- **Validações:** botão "Confirmar voto" desabilitado até selecionar uma opção e enquanto `submitting`. Erros de servidor: 409 → "A votação foi encerrada".
- **Feedback:** lista de opções numeradas (displayOrder + 1) acima da cédula; seção de "Apartamentos fora desta votação" se houver excluídos (inadimplentes). Após submissão: `SuccessPopup` animado por 2500ms (círculo verde desenhado + checkmark + mensagem "Voto computado com sucesso!") → fecha automaticamente → navega para `/polls?tab=pendentes`.
- **Próxima tela:** `/polls?tab=pendentes` após SuccessPopup fechar.
- **Screenshot:** não disponível.
- **Observações de UX:** se o morador tem múltiplos apartamentos pendentes, antes de submeter o primeiro voto aparece um Dialog "Aplicar a mesma opção aos N apartamentos?" — o fluxo muda abruptamente. O SuccessPopup não é fechável manualmente (apenas pelo timer interno de 2500ms); `closeOnEsc` e `closeOnBackdrop` estão em `false` no `Dialog` interno.

---

### Passo 7 — Votar em lote (múltiplos apartamentos)

- **Tela:** `/app/condominiums/:condoId/polls/:pollId/vote/review`
- **Entrada:** escolher "Aplicar a todos" no dialog de bulk prompt na tela de voto.
- **Ação:** revisar lista de apartamentos + opção selecionada; clicar "Confirmar e enviar N votos".
- **Validações:** a página verifica `history.state` — se navegada diretamente sem estado, redireciona de volta para `/vote`.
- **Feedback:** lista de apartamentos com a opção. Após submit: sumário "Sucessos: X · Falhas: Y" com resultado por apartamento (✓ ou mensagem de erro). Se tudo OK: `SuccessPopup` com `voteCount` = número de sucessos. Botão "Tentar novamente nas falhas" se houver falhas parciais.
- **Próxima tela:** `/my-polls` (redirect → `/polls?tab=pendentes`) após sucesso ou clique em "Voltar à lista".
- **Screenshot:** não disponível.
- **Observações de UX:** votos em lote usam `mergeMap` sem `concatMap` — são disparados em paralelo, sem ordem garantida. Em caso de falha parcial, o morador vê a mensagem "Votação encerrada/duplicada" ou "Falha ao registrar" sem indicação de como resolver.

---

### Passo 8 — Acompanhar resultado

- **Tela:** `/app/condominiums/:condoId/polls/:pollId`
- **Entrada:** navegar para o detalhe de uma poll CLOSED ou INVALIDATED.
- **Ação:** visualizar resultado com breakdown por opção (barras de progresso horizontal), total de votos, vencedora destacada com badge.
- **Validações:** seção "Resultado" só aparece para CLOSED ou INVALIDATED (não CANCELLED).
- **Feedback:** barras de progresso coloridas (primária para vencedora, secundária para demais); porcentagem e contagem absolutas.
- **Próxima tela:** nenhuma — tela final de informação.
- **Screenshot:** não disponível.
- **Observações de UX:** na poll OPEN, a seção "Sua participação" exibe apenas "X apartamento(s) elegível(is) no total desta votação" — não expõe quantos já votaram (sigilo). Após votar, o morador vê "Votou em: [opção]" junto ao apartamento, mas não vê quanto falta para quórum.

---

## §5 Estados Transversais

### Empty states

| Contexto | Componente | Mensagem |
|---------|-----------|---------|
| Home sem condomínio | `EmptyState` (icon: apartment) | "Você ainda não está vinculado a nenhum condomínio" + instrução de contatar síndico |
| Home — erro de rede | `EmptyState` (icon: error) | Mensagem do erro ou "Erro de rede" |
| Votações — tab pendentes sem items | `PendingPollsList` | "Você não tem votações pendentes" + link "Ver em andamento" |
| Votações — outras tabs sem items | `PollsTable` | Mensagem contextual: "Nenhuma votação em andamento", "Nenhuma votação encerrada ainda" ou "Nenhuma votação encontrada" |
| Convites — lista vazia | `InvitationList` | "Nenhum convite encontrado." |
| Morador na tela de voto sem elegibilidade | `BallotVotePage` | "Você não pode votar nesta votação" + explicação de motivos |
| Morador após votar todos os aptos | `BallotVotePage` | "Você já votou em todas as suas cédulas para esta votação" |
| Poll sem participação do morador | `PollDetailPage` | "Você não tem apartamentos elegíveis nesta votação" |

### Loading states

- Todos os carregamentos usam o componente `Spinner` (`<app-spinner>`) com `label` acessível para leitores de tela.
- Páginas de listagem bloqueiam a renderização até o carregamento concluir (sem skeleton loading).

### Erros

| Cenário | Tratamento |
|---------|-----------|
| Token de convite inválido/inexistente | Estado `NOT_FOUND` na `InvitationAcceptPage`: "Convite inválido. Peça ao síndico para enviar um novo convite." |
| Token expirado (>24h) | Estado `EXPIRED`: "Convites têm validade de 24h. Peça ao síndico para reenviar." |
| Token revogado | Estado `REVOKED`: "Este convite foi cancelado pelo síndico." |
| Convite já aceito | Estado `ALREADY_ACCEPTED`: "Este convite já foi aceito." + link para login |
| Usuário logado com e-mail errado | Modo `WRONG_USER`: instrução de sair e fazer login com e-mail correto |
| Voto fora do período (poll CLOSED/CANCELLED) | Erro 409 na submissão → "A votação foi encerrada. Volte para a lista." |
| Abrir poll sem eleitores elegíveis | Erro 422 → "Não há eleitores elegíveis para abrir a votação." |
| Rate limit (429) | Mensagem: "Muitas tentativas. Aguarde um minuto e tente novamente." |
| Erro genérico de rede | Mensagem: "Não foi possível carregar" ou fallback genérico por tela |

### Paginação

- Componente `Paginator` (com dropdown de tamanho de página: 10/20/50/100) presente em: lista de apartamentos (admin), tabela de votações.
- Lista de convites não é paginada — carregada inteira (com cap de 100 apartamentos no `apartmentsApi.list`).

### Multi-condomínio

- `Home` exibe lista de condomínios se o usuário está vinculado a mais de 1.
- `AppHeader` exibe nome do condomínio ativo e botão "Trocar" que limpa o tenant e retorna para `/app`.
- `tenantRestoreGuard` restaura o tenant ativo ao navegar via URL direta ou F5.

### Sigilo do voto em poll OPEN

- Na seção "Sua participação" de `PollDetailPage`, durante status OPEN, o componente exibe apenas "X apartamento(s) elegível(is) no total desta votação" — sem expor quantos votos já foram registrados.
- `BallotVotePage` não exibe placar parcial em nenhum momento.

---

## §6 Inventário de Componentes shared/ui

| Componente | O que faz | Onde é usado |
|-----------|---------|-------------|
| `Dialog` (`dialog.ts`) | Modal reutilizável com trap de foco, ESC, backdrop clicável, animação scale-in; slots `dialog-title`, `dialog-body`, `dialog-actions` | `BallotVotePage` (bulk prompt), `SuccessPopup`, `PollCancelDialog` |
| `Dropdown` (`dropdown.ts`) | Select customizado com opções genéricas; suporta `ControlValueAccessor`; `ariaLabel` opcional | `PollForm` (convocação, quórum), `InvitationsPage` (filtros), `InvitationIndividualForm` (apartamento), `ApartmentsPage` (paginator), `BallotVotePage` (dropdown de apartamentos) |
| `EmptyState` (`empty-state.ts`) | Ícone + título + descrição + slot de conteúdo adicional; centrado verticalmente | `Home` (sem condo, erro de rede) |
| `FaqItem` (`faq-item.ts`) | Accordion de pergunta/resposta para FAQ da landing | `Landing` |
| `FormField` (`form-field.ts`) | Wrapper de campo de formulário com label acessível, ID dinâmico, exibição de erros de validação | `Login`, `InvitationAcceptPage`, `InvitationIndividualForm`, `PollForm` |
| `Paginator` (`paginator.ts`) | Navegação de páginas com dropdown de tamanho; emite `pageChange` e `sizeChange` | `ApartmentsPage`, `PollsTable` |
| `Spinner` (`spinner.ts`) | Indicador de carregamento com `label` acessível (visível apenas para screen readers via sr-only) | Em todas as páginas durante carregamento e dentro de botões durante submit |
| `SuccessPopup` (`success-popup.ts`) | Dialog não-fechável manualmente com animação SVG de checkmark verde + mensagem; auto-fecha em 2500ms emitindo `(closed)` | `BallotVotePage`, `BallotReviewPage` |

---

## §7 Gaps Observados

Lista bruta de observações concretas — sem priorização e sem proposta de solução.

1. **Landing → promessas não entregues:** a seção "Em três passos" menciona "ata em PDF pronta para assinatura digital" e o FAQ confirma "ata em PDF". Nenhuma feature de geração de ata existe no código atual. O usuário que ler a landing e contratar o serviço esperará essa entrega.

2. **Login → ausência de "Esqueci a senha":** a tela `/login` não tem link ou fluxo de recuperação de senha. Moradores que esquecem a senha após o onboarding não têm caminho de auto-serviço visível no app.

3. **PollDetailPage → confirmações com `window.confirm()`:** as ações "Publicar", "Abrir agora" e "Encerrar" usam o dialog nativo do browser (`window.confirm()`), que não herda o design system, não é acessível via teclado de forma consistente entre browsers, e não permite copy personalizado rico (ex: aviso de consequências).

4. **InvitationList → cores hardcoded fora do design system:** os badges de status de convite (PENDING, ACCEPTED, BOUNCED, EXPIRED, REVOKED) usam classes Tailwind de cor raw (`bg-yellow-100 text-yellow-800`, `bg-green-100 text-green-800`, `bg-red-100 text-red-800`) que não existem nos tokens definidos em `@theme` do `styles.scss`. O projeto não tem `--color-warning-*` definido mas `BallotVotePage` usa `bg-warning-container text-on-warning-container` — inconsistência entre componentes.

5. **InvitationsPage → paginação ausente na lista de convites:** a lista de convites carrega todos os registros sem paginação. O carregamento de apartamentos (para o dropdown de filtro) tem cap de 100 itens com comentário `// Condomínios com >100 unidades precisam paginar aqui também (pendência conhecida)`. Condomínios grandes podem sofrer degradação de performance e UX.

6. **PollForm → erro cruzado "fim antes de início" com UX incompleta:** o erro `endBeforeStart` só aparece quando `scheduledEnd` está `dirty || touched`. Se o usuário muda apenas a data de início para depois do fim (sem tocar no campo fim), o erro não dispara. O formulário pode ser submetido se o usuário contornar a ordem de interação.

7. **BallotVotePage → SuccessPopup não é fechável manualmente:** o morador não pode fechar o popup de sucesso antes dos 2500ms. Em conexões lentas onde o próximo carregamento é demorado, o usuário fica bloqueado observando uma tela que não pode avançar.

8. **BallotReviewPage → votos em lote disparados em paralelo:** `mergeMap` sem limite de concorrência envia todos os votos simultaneamente. Em caso de falha parcial a mensagem exibida é genérica ("Votação encerrada/duplicada" ou "Falha ao registrar") sem orientar o morador sobre o que fazer (ex: se a votação foi encerrada enquanto votava, os votos bem-sucedidos já estão registrados mas não há instrução clara).

9. **AppHeader → link "Convites" ausente no menu:** o `AppHeader` lista apenas "Apartamentos" e "Votações" como links de navegação. "Convites" só é acessível via dashboard do condomínio — um síndico navegando diretamente de qualquer sub-página não tem atalho para Convites no header.

10. **Dashboard → badge conta cédulas, não polls:** o badge numérico no card "Votações" do `CondominiumDashboard` e na tab "Pendentes" da `PollsPage` conta cédulas (ballots), não votações. Um morador com 3 apartamentos em 1 votação vê o badge "3". Isso pode causar confusão se o morador espera ver "1 votação pendente".

11. **PollDetailPage → resultado JSON parseado em runtime no template:** `breakdownRows()` faz `JSON.parse(d.result.optionsBreakdown)` dentro do método chamado pelo template. O `console.error` em caso de falha não tem tratamento visual — a seção simplesmente não renderiza as barras sem feedback ao usuário.

12. **InvitationAcceptPage → modo `WRONG_USER` usa `window.location.reload()`:** após `signOut()`, o componente chama `window.location.reload()` para forçar reinicialização. Isso é menos elegante que uma navegação controlada e pode causar flash de conteúdo ou perda de estado de URL.

13. **Home → auto-navigate para condo único pode surpreender:** se o usuário está vinculado a exatamente 1 condomínio, o `effect()` navega automaticamente para o dashboard desse condomínio sem mostrar a Home. Em cenários de deep link ou back-navigation, esse comportamento pode criar loops perceptíveis.

14. **ApartmentsPage (morador) → tabela sem informação contextual:** o morador vê seus apartamentos com status adimplente/inadimplente, mas não há explicação de que a inadimplência pode excluí-lo de votações. A conexão entre essas duas informações é implícita.

15. **Polls → tab "Encerradas" agrupa CLOSED, INVALIDATED e CANCELLED sem distinção visual na lista:** na `PollsTable`, o `PollStatusBadge` diferencia os status com cores distintas, mas a tab "Encerradas" agrupa os três status terminais. Uma poll invalidada (que não teve vencedor) aparece ao lado de uma cancelada sem agrupamento visual ou separação.

---

## §8 Inventário de Tokens Visuais

Extraído do bloco `@theme` em `/Users/gabrieljarufe/Developer/projects/condo-vote-app/frontend/src/styles.scss`.

### Cores

| Token CSS | Valor | Descrição |
|-----------|-------|-----------|
| `--color-primary` | `#000000` | Preto — cor primária |
| `--color-on-primary` | `#ffffff` | Texto sobre primária |
| `--color-primary-container` | `#131b2e` | Container primário (escuro) |
| `--color-on-primary-container` | `#7c839b` | Texto sobre container primário |
| `--color-secondary` | `#0051d5` | Azul — cor de ação principal |
| `--color-on-secondary` | `#ffffff` | Texto sobre secundária |
| `--color-secondary-container` | `#316bf3` | Container secundário |
| `--color-on-secondary-container` | `#fefcff` | Texto sobre container secundário |
| `--color-secondary-fixed` | `#dbe1ff` | Azul claro fixo (badges, ícones de feature) |
| `--color-on-secondary-fixed` | `#00174b` | Texto sobre secondary-fixed |
| `--color-on-secondary-fixed-variant` | `#003ea8` | Variante de texto sobre secondary-fixed |
| `--color-tertiary` | `#000000` | Terciária (igual à primária) |
| `--color-on-tertiary` | `#ffffff` | Texto sobre terciária |
| `--color-tertiary-container` | `#0b1c30` | Container terciário |
| `--color-on-tertiary-container` | `#75859d` | Texto sobre container terciário |
| `--color-success` | `#1a6b3a` | Verde de sucesso |
| `--color-on-success` | `#ffffff` | Texto sobre sucesso |
| `--color-success-container` | `#c8f5d4` | Container de sucesso (claro) |
| `--color-on-success-container` | `#002111` | Texto sobre container de sucesso |
| `--color-error` | `#ba1a1a` | Vermelho de erro |
| `--color-on-error` | `#ffffff` | Texto sobre erro |
| `--color-error-container` | `#ffdad6` | Container de erro (claro) |
| `--color-on-error-container` | `#93000a` | Texto sobre container de erro |
| `--color-surface` | `#f7f9fb` | Superfície principal |
| `--color-on-surface` | `#191c1e` | Texto sobre superfície |
| `--color-surface-variant` | `#e0e3e5` | Variante de superfície |
| `--color-on-surface-variant` | `#45464d` | Texto secundário (placeholders, labels) |
| `--color-surface-container-lowest` | `#ffffff` | Container mais claro (cards, inputs) |
| `--color-surface-container-low` | `#f2f4f6` | Container levemente destacado |
| `--color-surface-container` | `#eceef0` | Container padrão |
| `--color-surface-container-high` | `#e6e8ea` | Container mais elevado |
| `--color-surface-container-highest` | `#e0e3e5` | Container mais alto |
| `--color-surface-dim` | `#d8dadc` | Superfície escurecida |
| `--color-surface-bright` | `#f7f9fb` | Superfície clara (igual à surface) |
| `--color-background` | `#f7f9fb` | Background da página |
| `--color-on-background` | `#191c1e` | Texto sobre background |
| `--color-outline` | `#76777d` | Bordas de elementos |
| `--color-outline-variant` | `#c6c6cd` | Bordas suaves |
| `--color-inverse-surface` | `#2d3133` | Superfície invertida (dark) |
| `--color-inverse-on-surface` | `#eff1f3` | Texto sobre superfície invertida |
| `--color-inverse-primary` | `#bec6e0` | Primária invertida |

**Nota:** não há tokens `--color-warning-*` definidos em `@theme`, mas o componente `BallotVotePage` referencia `bg-warning-container text-on-warning-container` (ausentes nos tokens).

### Tipografia

| Token | Valor |
|-------|-------|
| `--font-sans` | `"Inter", ui-sans-serif, system-ui, sans-serif` |
| `--font-display` | `"Inter", sans-serif` |
| `--text-display-lg` | `48px / 56px, weight 700, letter-spacing -0.02em` |
| `--text-headline-lg` | `32px / 40px, weight 600, letter-spacing -0.01em` |
| `--text-headline-md` | `24px / 32px, weight 600` |
| `--text-body-lg` | `18px / 28px, weight 400` |
| `--text-body-md` | `16px / 24px, weight 400` |
| `--text-label-md` | `14px / 20px, weight 500, letter-spacing 0.01em` |
| `--text-caption` | `12px / 16px, weight 400` |

### Spacing

| Token | Valor |
|-------|-------|
| `--spacing` | `4px` (base do grid — Tailwind multiplica: spacing-1 = 4px, spacing-2 = 8px, etc.) |

### Outros

- **Scrollbar:** 4px de largura/altura, retangular (sem border-radius), cor `--color-outline`, hover `--color-secondary`.
- **Focus ring:** `outline: 2px solid --color-secondary`, `offset: 2px`, `border-radius: 2px`.
- **Material Symbols:** `font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24` como base; overrides pontuais inline com `style="font-variation-settings: 'FILL' 1"`.
