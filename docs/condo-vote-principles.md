# Condo Vote — Princípios e Spec de Produto

## 1. Objetivo do Projeto

Criar uma aplicação web multi-tenant de votação online para condomínios residenciais. A plataforma permite que síndicos criem e gerenciem votações, e que moradores participem de forma segura e transparente nos processos de deliberação coletiva.

O problema central que resolve é a baixa adesão em assembleias presenciais, dificuldade de agendamento e falta de transparência na apuração de votos.

---

## 2. Atores do Sistema

**Administrador / Síndico**
- Criado via seed no banco de dados (sem self-service na v1)
- Papel armazenado em tabela dedicada `condominium_role(user_id, condominium_id, role)` — não em `app_user`
- Um condomínio pode ter **múltiplos síndicos** com as mesmas permissões
- Um síndico pode simultaneamente ser proprietário de uma unidade no mesmo condomínio
- Transferência de papel de síndico é operação de superadmin em v1 — sem fluxo self-service
- Permissões restritas ao condomínio ao qual está vinculado
- Pode: cadastrar apartamentos, enviar convites por e-mail, criar/cancelar votações, acompanhar resultados, acessar auditoria de votos

**Proprietário**
- Criado via convite enviado pelo síndico por e-mail
- Ao concluir o cadastro, já nasce vinculado ao condomínio e apartamento como **votante habilitado**
- Pode: visualizar pautas, votar, visualizar resultados após encerramento, convidar inquilino para sua unidade, delegar/revogar direito de voto ao inquilino

**Inquilino**
- Criado via convite enviado pelo síndico ou pelo proprietário da unidade (com e-mail + CPF do inquilino)
- Nasce vinculado ao condomínio e apartamento como **não-votante** por padrão
- Pode se tornar votante habilitado se o proprietário delegar o direito de voto
- Pode: visualizar pautas, votar (se habilitado), visualizar resultados após encerramento

---

## 3. Decisões Técnicas

### Stack
| Camada | Tecnologia | Justificativa |
|---|---|---|
| Backend | Java + Spring Boot | Maior domínio do desenvolvedor, ecossistema maduro |
| Frontend | Angular | Escolha do desenvolvedor |
| Banco de dados | PostgreSQL | Domínio relacional, suporte a JSON nativo, dados estruturados |
| Arquitetura | Multi-tenant | Cada condomínio é um tenant isolado |
| Isolamento de dados | Shared DB + `tenant_id` + RLS | Banco único, coluna `tenant_id` em todas as tabelas de domínio, Row-Level Security (RLS) do PostgreSQL para garantir isolamento no nível do banco |

### Autenticação
| Decisão | Escolha |
|---|---|
| Estratégia | JWT stateless (access token + refresh token) |
| Access token | 15 min de expiração, armazenado em memória no cliente |
| Refresh token | 7 dias, cookie HttpOnly, rotação a cada uso |
| Senhas | BCrypt, custo mínimo 10 |
| Login via magic link | Descartado para v1 — senha obrigatória |
| Login social | Fora do escopo v1 (preparar arquitetura para v2) |
| Recuperação de senha | Sim, via token por e-mail (expira em 1 hora) |

---

## 4. Domínio — Apartamento e Moradores

### Estrutura do condomínio
- Um condomínio pode ter **múltiplas torres/blocos**
- Cada apartamento é identificado pela combinação **torre + número da unidade**

### Regras de ocupação
- Todo apartamento pode ter 1 proprietário e **N inquilinos**
- O proprietário é sempre cadastrado antes de qualquer inquilino (pré-requisito de convite)
- Apenas **1 votante habilitado** por apartamento por vez

### Votante habilitado
- Por padrão, o proprietário é o votante habilitado
- O proprietário pode delegar o direito de voto a **um** inquilino do mesmo apartamento (substitui, não acumula)
- A delegação pode ser revertida pelo proprietário a qualquer momento
- **Delegação e revogação são bloqueadas** enquanto o apartamento tiver votações no estado **Aberta** — previne confusão sobre quem pode votar em polls ativos
- Se não há inquilino cadastrado, o proprietário vota diretamente

### Inadimplência
- Moradores inadimplentes **não podem votar** (exigência legal — Código Civil, Art. 1.335, III)
- O síndico marca a unidade como inadimplente no sistema
- Enquanto inadimplente, o apartamento perde o direito de voto independentemente de quem seja o votante habilitado
- Moradores de unidades inadimplentes **continuam visualizando** pautas, votações e resultados — apenas o voto é bloqueado
- A unidade inadimplente **não é contabilizada** no cálculo de quórum (não conta como votante habilitado)
- Ao regularizar, o síndico remove a marcação e o direito de voto é restaurado automaticamente
- **Alterações de inadimplência após a abertura de uma votação não afetam aquela votação** — o conjunto elegível é fixado no momento de abertura (ver Snapshot de Elegibilidade)

### Convites
- Síndico envia convite de proprietário: define unidade + papel = proprietário
- Síndico ou **proprietário** pode convidar o inquilino da unidade: informa e-mail + CPF do inquilino
  - O sistema valida que o CPF não está vinculado a outra unidade no mesmo condomínio
  - CPF é exigido para evitar duplicatas e fraude de vínculo
  - O proprietário deve estar cadastrado antes de qualquer convite de inquilino para a unidade
- Link de convite expira em **5 dias**. O síndico pode reenviar o convite (gera novo link, invalida o anterior)

### Remoção de morador
- Quando um proprietário é removido do condomínio:
  - Se há inquilino vinculado, o inquilino pode ser promovido a proprietário da unidade (decisão do síndico)
  - Se não há inquilino ou o síndico não promove, todos os acessos da unidade são desativados
  - O acesso do proprietário removido é desativado imediatamente
- Votos já registrados por morador removido em votações abertas **permanecem válidos** — o conjunto elegível é fixado no momento de abertura da votação e não pode ser alterado retroativamente

### Fluxo de onboarding
1. Síndico convida proprietário: informa e-mail + unidade
2. Proprietário recebe link, preenche nome + senha → nasce vinculado como votante habilitado
3. Síndico ou proprietário convida inquilino: informa e-mail + CPF + unidade
4. Inquilino recebe link, preenche nome + senha → nasce vinculado como não-votante
5. Proprietário pode delegar voto ao inquilino via painel → inquilino passa a ser votante habilitado
6. Proprietário pode revogar delegação a qualquer momento → retorna como votante habilitado

---

## 5. Domínio — Votação

### Ciclo de vida e estados

```
Rascunho → Agendada → Aberta → Encerrada (vencedor declarado)
               ↓          ↓          ↓
           Cancelada  Cancelada  Invalidada (limiar não atingido ou quórum de presença insuficiente)
```

### Regras por estado
| Estado     | Síndico pode editar? | Moradores veem? | Voto permitido? |
|------------|----------------------|-----------------|-----------------|
| Rascunho   | Sim, tudo            | Não             | Não             |
| Agendada   | Sim (data/hora)      | Sim (somente pauta) | Não          |
| Aberta     | Não                  | Sim             | Sim             |
| Encerrada  | Não                  | Sim (resultado) | Não             |
| Cancelada  | Não                  | Sim (aviso)     | Não             |
| Invalidada | Não                  | Sim (aviso)     | Não             |

### Snapshot de Elegibilidade

No momento exato em que a votação transita para **Aberta**, o sistema gera um snapshot imutável dos apartamentos elegíveis: todos os não-inadimplentes que possuem um `eligible_voter_id` definido naquele instante. Este snapshot armazena:

- **`apartment_id`** — quais apartamentos podem votar
- **`eligible_voter_id`** — quem era o votante habilitado no momento da abertura (referência para auditoria)

Comportamento do snapshot:

- Define o denominador para cálculo de quórum nos modos Maioria Absoluta e Qualificado
- Determina **quais apartamentos** podem votar nesta votação — mudanças posteriores (inadimplência, remoção de morador) não alteram o snapshot
- Se o votante habilitado do apartamento é removido durante a votação e um novo `eligible_voter_id` é atribuído, o **novo votante pode votar** pelo apartamento (fallback). A delegação/revogação é bloqueada durante polls abertos, mas a remoção de morador pode alterar o `eligible_voter_id` via ação do síndico
- É persistido em tabela dedicada `poll_eligible_snapshot`

### Transições
- **Rascunho → Agendada:** síndico publica definindo data/hora de início e fim
- **Agendada → Aberta:** automático ao atingir `scheduled_start` **ou** síndico abre manualmente antes do horário agendado. Ao abrir, o sistema gera o snapshot de elegibilidade
- **Aberta → Encerrada:** automático ao atingir `scheduled_end` **ou** quando todos os apartamentos do snapshot já tiverem votado
- **Agendada ou Aberta → Cancelada:** síndico cancela manualmente e deve registrar um **motivo obrigatório**; votos já registrados são **preservados** (imutáveis) mas o resultado nunca é publicado
- **Encerrada → Invalidada:** automático se nenhuma opção atingiu o limiar exigido pelo modo de quórum, ou se o quórum de presença não foi atingido (Primeira Convocação)

---

## 6. Domínio — Quórum

### Convocação

O síndico define a **convocação** ao criar a votação:

| Convocação | Quórum de presença | Descrição |
|---|---|---|
| **Primeira** | 50% dos elegíveis devem votar | Para que o resultado seja válido, pelo menos metade dos apartamentos do snapshot deve ter votado. Se não atingir, a votação é INVALIDATED |
| **Segunda** | Nenhum | Qualquer número de votos é válido. A decisão é tomada pela maioria dos que efetivamente votaram |

### Modos de quórum

O síndico define o modo de quórum ao criar a votação. O **denominador** para os modos Absoluto e Qualificado é sempre o **snapshot de elegíveis na abertura** (número de apartamentos elegíveis fixado no momento em que a votação abre).

| Modo | Denominador | Limiar para vencer |
|------|-------------|-------------------|
| Maioria simples | Votos efetivamente computados | opção_vencedora ≥ ⌊votos_computados / 2⌋ + 1 |
| Maioria absoluta | Snapshot elegíveis na abertura | opção_vencedora ≥ ⌊snapshot / 2⌋ + 1 |
| Quórum qualificado 2/3 | Snapshot elegíveis na abertura | opção_vencedora ≥ ⌈snapshot × 2/3⌉ |
| Quórum qualificado 3/4 | Snapshot elegíveis na abertura | opção_vencedora ≥ ⌈snapshot × 3/4⌉ |

### Moradores que não votaram

Contabilizados no denominador dos modos Absoluto e Qualificado (impactam o quórum), mas **não são contados como voto em nenhuma opção**. Não votar não é votar contra.

### Resultados possíveis ao encerrar

| Estado | Condição | Descrição |
|--------|----------|-----------|
| **CLOSED** | Uma opção atingiu o limiar | Vencedor declarado |
| **INVALIDATED** | Nenhuma opção atingiu o limiar, **ou** quórum de presença não atingido (Primeira Convocação) | Votação invalidada. Síndico notificado, pode criar nova votação |

**Nota:** empate exato (ex: 50-50) é um caso particular de INVALIDATED — nenhuma opção atingiu 50%+1, logo nenhuma vence. Não existe estado TIED separado; é matematicamente impossível que duas opções atinjam simultaneamente um limiar >50%.

---

## 7. Domínio — Opções de Voto

- O síndico define N opções ao criar a votação (mínimo 2)
- Cada apartamento habilitado vota em exatamente **1 opção**
- Não há abstenção como opção nativa — morador que não votou até o encerramento é contabilizado como "não votou" (impacta quórum)
- Votos são imutáveis após confirmação
- Pode haver múltiplas votações abertas simultaneamente no mesmo condomínio

---

## 8. Domínio — Resultados e Auditoria

### Visibilidade para moradores
- **Enquanto aberta:** moradores não veem resultados parciais
- **Após encerrada ou invalidada:** moradores veem totais agregados por opção + percentual de participação

### Auditoria
- Somente o síndico acessa o detalhamento voto-a-voto (apartamento → opção escolhida)
- Auditoria é imutável e acessível ao síndico a qualquer momento após encerramento
- Na v1: auditoria via interface do síndico; exportação (PDF/CSV) avaliada na v2

---

## 9. Notificações por E-mail (v1)

| Evento | Destinatário |
|--------|-------------|
| Convite enviado | Morador convidado |
| Nova votação publicada (Agendada) | Todos os moradores do condomínio |
| Votação aberta | Todos os votantes habilitados |
| Lembrete 24h antes de fechar | Votantes que ainda não votaram |
| Votação encerrada + resultado | Todos os moradores do condomínio |
| Votação invalidada (quórum não atingido) | Todos os moradores + síndico |
| Votação cancelada | Todos os moradores do condomínio |
| Recuperação de senha | Morador solicitante |

Notificações push avaliadas na v2.

---

## 10. Decisões de Design do Produto

- **Admin via seed, não self-service:** controle de quem administra cada condomínio, evita cadastros indevidos
- **Convite por e-mail (não código genérico):** o síndico informa e-mail + apartamento, morador recebe link e já nasce vinculado
- **CPF único por usuário:** CPF é um identificador nacional único — armazenado no cadastro do usuário, não no vínculo com o apartamento. Garante unicidade e evita fraude de representação
- **1 votante por apartamento:** proprietário por padrão; delegação explícita ao inquilino
- **Sem resultados parciais:** preserva a independência do voto até o encerramento
- **Multi-tenant:** moradores podem estar vinculados a múltiplos condomínios, com seletor de contexto no frontend
- **Snapshot de elegibilidade na abertura:** o denominador do quórum é fixado no instante em que a votação abre. Alterações de inadimplência, delegação ou remoção de morador só afetam votações futuras
- **Voto pertence ao apartamento (usuário é testemunha):** direito de voto é da unidade condominial, não da pessoa — alinhado com o Código Civil. O usuário que votou fica registrado para auditoria
- **Síndicos com paridade total:** todos os síndicos de um condomínio têm as mesmas permissões. Qualquer um pode agir sobre qualquer recurso. O sistema registra qual síndico executou cada ação para auditoria
- **Delegação bloqueada durante polls abertos:** previne confusão sobre quem pode votar e elimina vetor de manipulação (delegar, votar, revogar)
- **Convocação explícita:** cada votação define se é Primeira (com quórum de presença de 50%) ou Segunda Convocação (sem quórum de presença), alinhado com a prática condominial brasileira

---

## 11. LGPD — Conformidade Mínima v1

O app coleta dados pessoais (CPF, e-mail, comportamento de voto) e está sujeito à Lei 13.709/2018.

| Requisito | O que implementar na v1 |
|-----------|------------------------|
| Base legal | Consentimento explícito no cadastro (checkbox + link para política de privacidade) |
| Finalidade | CPF coletado somente para verificar unicidade de vínculo; não exibido a outros moradores |
| Direito de exclusão | Fluxo para morador solicitar exclusão de conta e dados pessoais |
| Retenção | Dados de votação retidos por 5 anos (alinhado com prazo de prescrição condominial) |
| Segurança | Senhas com BCrypt (custo 10), CPF armazenado criptografado em repouso |

Fora do escopo v1: DPO nomeado, RIPD completo, relatórios de impacto.

---

## 12. Metodologia: Spec-Driven Development (SDD)

### Ciclo adotado
```
Specify → Plan → Tasks → Implement
```

---

## Pontos em Aberto (não bloqueadores para v1)

1. **Número máximo de opções por votação:** definir limite ou deixar sem restrição
2. **Troca de síndico:** fluxo de transferência de acesso administrativo (seed ou painel de superadmin?)
3. **Retenção de dados de votação:** confirmado 5 anos, mas validar com síndico se há necessidade de prazo diferente por tipo de deliberação
