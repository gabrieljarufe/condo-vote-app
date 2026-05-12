# H2 — Cadastrar apartamento (e marcar inadimplência)

## Problema da jornada (antes)

O síndico não tinha como cadastrar as unidades do condomínio pela interface. Para preparar a base de apartamentos antes de convidar moradores ou criar votações, era necessário abrir o banco via SQL — um processo manual, suscetível a erro humano e inviável fora de ambiente técnico. A marcação de inadimplência, pré-requisito para o snapshot de elegibilidade de votação, também dependia de acesso direto ao banco.

## Solução (depois)

O síndico agora cadastra apartamentos diretamente pela UI em menos de 10 segundos: informa bloco e número da unidade, salva, e a unidade aparece na lista imediatamente. A marcação de inadimplência é um toggle por linha — um clique alterna o estado e registra o evento no histórico de auditoria. Toda ação é rastreável via timeline de auditoria (H9).

## Como usar

### Cadastro individual

1. Faça login como síndico e selecione o condomínio.
2. Clique em **Apartamentos** no cabeçalho (visível apenas para síndicos).
3. Clique em **+ Novo apartamento**.
4. Preencha **Número da unidade** (obrigatório) e **Bloco** (opcional).
5. Clique em **Cadastrar** — o apartamento aparece na lista ordenada por bloco e unidade.
6. Para marcar inadimplência: clique em **Marcar inadimplente** na linha do apartamento. Para remover: clique em **Remover inadimplência**.

### Cadastro em lote (wizard)

Para edifícios com muitas unidades, use o wizard de cadastro em lote:

1. Clique em **+ Cadastro em lote** na página de apartamentos.
2. **Step 1 — Configurar:** informe bloco/torre (opcional), intervalo de andares, quantidade de aptos por andar, padrão de numeração e andares a pular (ex: 13).
   - **Padrão (101, 102…):** andar + sequência 2 dígitos — padrão brasileiro mais comum.
   - **Compacto (01, 02… / 11, 12…):** andar + sequência sem padding; use andar inicial = 0 para térreo.
   - **Sequencial (001, 002…):** numeração contínua com 3 dígitos, reinicia por andar.
   - **Personalizado:** digite seu próprio padrão com tokens `{andar}`, `{seq}`, `{seq:02}`, `{seq:03}` — o campo exibe um guia de referência ao ser ativado.
3. Clique em **Gerar preview** — o Step 2 exibe a grade de apartamentos por andar.
4. **Step 2 — Revisar:** edite números individuais clicando na célula, remova unidades pelo ×, ou remova um andar inteiro pelo × da linha.
5. Clique em **Criar N apartamentos** — unidades já existentes são ignoradas (idempotente via `ON CONFLICT DO NOTHING`).

## Limitações v1 (débito explícito)

- Apenas síndicos (`ADMIN`) podem listar e cadastrar apartamentos — moradores não têm acesso à lista.
- Não é possível editar `unit_number` ou `block` de um apartamento já cadastrado — fica para v2.
- Não é possível deletar apartamento — envolve votos históricos, fica para v2.
- Associar um morador ao apartamento é feito via convite (H3), não diretamente nesta tela.
- O campo `eligible_voter_user_id` (quem vota pelo apartamento) é gerenciado em H6 (delegação).

## Endpoints / rotas

- Backend: `POST /api/condominiums/{id}/apartments`, `GET /api/condominiums/{id}/apartments`, `PATCH /api/apartments/{id}/delinquent`
- Frontend: `/app/condominiums/:condoId/apartments` (lazy-loaded)

## Referências

- Spec: `docs/condo-vote-principles.md` §Atores §Inadimplência
- Data model: `docs/data-model.md` §Apartment
- História canônica: `docs/implementation/tasks/phase-7/h2-cadastrar-apartamento.md`
