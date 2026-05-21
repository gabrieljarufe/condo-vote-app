# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado atual

**Progresso por fase + descobertas não-óbvias:** [`docs/STATUS.md`](docs/STATUS.md).

Metodologia: **Spec-Driven Development** (Specify → Plan → Tasks → Implement).
Specify/Plan/Tasks estão concluídos; fase atual: **Implement**.

Toda a documentação é em **português** — mantenha o idioma ao editar.

## Docs canônicos (onde as decisões vivem)

| Arquivo | Propósito |
|---|---|
| `docs/condo-vote-principles.md` | Spec de produto — atores, ciclo de votação, quórum, LGPD |
| `docs/data-model.md` | ERD, enums, tabelas, índices, política de RLS |
| `docs/architecture.md` | Decisões arquiteturais (10 seções: auth, backend, banco, jobs, e-mail, infra, segurança, observabilidade) |
| `docs/coding-patterns.md` | Como implementar — Controller→Service→Repository, Spring Data JDBC, aggregates, DTOs, testes |

Ao responder sobre o domínio, **leia a spec** antes de deduzir — cobre muitos edge cases.

### Docs contextuais (leitura sob demanda)

| Arquivo | Quando ler |
|---|---|
| `docs/context-docs/auth-flow.md` | Mexendo em SecurityConfig, JWT, GoTrue, JWKS |
| `docs/context-docs/flyway-migrations.md` | Criando/editando migration, debug de checksum, bootstrap |
| `docs/runbooks/validate-fase-3.md` | Validar Fase 3 manualmente (Blocos 1-7) ou rodar T3.8/T3.9 (Bloco 8) |

## Invariantes do domínio (não-negociáveis)

Estas decisões parecem de implementação mas são **estruturais**. Não mude sem discutir explicitamente com o usuário.

- **Multi-tenant por RLS:** toda tabela de domínio tem `condominium_id`; queries rodam com `SET LOCAL app.current_tenant = '<uuid>'`. O `condominium_id` **redundante** em `vote` e `apartment_resident` é intencional — é necessário para a política RLS funcionar sem JOINs. Não remova.
- **Snapshot de elegibilidade é write-once:** `poll_eligible_snapshot` é gerado na transição `SCHEDULED → OPEN` e **nunca** alterado depois. Define o denominador de quórum para os modos Absoluto e Qualificado.
- **Voto pertence ao apartamento**, não ao usuário. `voter_user_id` é apenas testemunha para auditoria. Alinhado com o Código Civil.
- **Votos são imutáveis** após registro. Sem UPDATE/DELETE. Alinhado com Código Civil — voto pertence ao apartamento, não ao usuário. Remoção de morador **não invalida** votos já registrados em polls abertos (morador é testemunha apenas) — não existe coluna `is_nullified` neste schema.
- **Delegação de voto é bloqueada durante polls OPEN** — previne o vetor "delegar, votar, revogar". Mesma regra deve valer para transferência de titularidade quando ela for implementada.
- **CPF mora em `app_user`, não em `apartment_resident`** — é identificador nacional único por pessoa, independente do condomínio. Armazenado criptografado (AES-256). Algoritmo: **AES-256-SIV** (determinístico + autenticado). Determinismo é requisito da `UNIQUE(cpf_encrypted)` — CPFs iguais produzem ciphertext igual.
- **Síndicos têm paridade total** dentro de um condomínio; auditoria via `created_by_user_id` nas tabelas de domínio.

## Convenções de trabalho neste repo

- **Respeite as decisões arquiteturais documentadas.** `docs/architecture.md` foi preenchido interativamente com o usuário. As decisões são finais para v1 — siga-as ao implementar. Se surgir conflito entre uma decisão e a realidade da implementação, **discuta com o usuário** antes de mudar.
- **Não invente alternativas ao que já foi decidido.** Exemplo: hosting é Oracle Cloud `us-ashburn-1` + Coolify (backend) + Cloudflare Pages (frontend) + Cloudflare DNS + Upstash (Redis) — não proponha AWS/Render/Railway/Vercel/etc. sem discussão.
- **Transferência de titularidade** (venda, herança, inquilino comprando): na v1 é tratada via **remoção + convite/promoção** pelo síndico. Fluxo formal (solicitação iniciada pelo proprietário) fica para v2. Ver `condo-vote-principles.md` seção 4 ("Transferência de titularidade") e ponto 4 em "Pontos em Aberto".
- Ao propor mudanças em regras de negócio, **atualize a spec** — não só o código. A spec é a fonte da verdade.
- Ao concluir uma task ou descobrir algo não-óbvio, **atualize `docs/STATUS.md`** no mesmo PR — é o índice navegável de progresso.
- **Ao encerrar cada história/feature, crie `docs/features/<id>-<slug>.md`** registrando:
  - O que já foi validado em smoke test (caminho feliz funcional).
  - O que ainda **falta testar** (critérios de aceitação não exercitados, fluxos de erro, edge cases).
  - Bugs conhecidos não-bloqueantes que ficaram para depois.
  - Pré-requisitos pendentes para o teste em produção (DNS, secrets, histórias dependentes).
  - O objetivo é separar "milestone funcional alcançado" (ex: e-mail está sendo enviado) de "feature 100% verificada" — para que o usuário decida se quer seguir para prod ou polir antes.

## Stack

Java 21 + Spring Boot · Angular · PostgreSQL (Supabase) + Flyway · Supabase Auth (JWT/JWKS) ·
Redis Upstash · Resend + Thymeleaf · Oracle Cloud + Coolify · Cloudflare Pages/DNS · GHCR + GitHub Actions.

Detalhes, justificativas e trade-offs em `docs/architecture.md`.

## Ambiente local — como subir os serviços

**Ordem correta de inicialização:**

```bash
# 1. Supabase (banco + auth local)
cd infra/supabase && supabase start

# 2. Backend + Redis (sempre via docker compose — nunca ./mvnw spring-boot:run em dev)
docker compose up --build backend
```

> `docker compose up --build backend` sobe o Redis automaticamente (dependência declarada).
> Nunca use `./mvnw spring-boot:run` para desenvolvimento — o compose garante paridade com prod.

### Outros comandos úteis
```bash
cd backend && ./mvnw verify                   # roda unit + integration tests (Testcontainers)
cd frontend && npm install && npm start        # frontend dev server
cd frontend && npm run build                  # build de produção do frontend
cd backend && ./mvnw flyway:migrate           # aplica migrations manualmente
```

- **Bootstrap de condomínio:** migration Flyway `V1001+` no repo, não SQL ad-hoc no Studio. Ver `docs/runbooks/bootstrap-condominio.md`.
- **Acesso SSH à VM Oracle e painel Coolify:** `docs/runbooks/ssh-vm.md` (gitignored — IPs, OCIDs, fluxos de fallback).
- **Bruno API Collection:** `api-collection/README.md` (setup, fluxo de uso, convenção `.bru` por rota).
  - Para testar endpoints autenticados: executar `auth/get-token.bru` primeiro — ele salva o JWT em `access_token` automaticamente. Depois qualquer request de domínio usa `{{access_token}}`.
  - Credentials de seed local: `sindico@local.dev` / `password123`, condomínio `019dd4f8-57fa-77b1-ace2-c9f6a3d9811e`.
  - Não construir curls manuais de auth — usar sempre a collection.

## Fluxo de trabalho com Git

### Ao concluir uma feature

Sempre abrir PR para `develop` via `gh` CLI — **não fazer merge local, não push direto em develop**.

**Antes de abrir o PR**, verificar se `develop` tem commits novos de outras branches que sua branch ainda não viu:

```bash
git fetch origin
git log --oneline fix/<sua-branch>..origin/develop
```

- Se a saída estiver **vazia** (ou mostrar apenas o merge commit do PR anterior desta mesma branch): não precisa de rebase — o "out of date" é cosmético.
- Se tiver **commits reais de outras branches**: fazer rebase para evitar conflitos no CI:
  ```bash
  git rebase origin/develop
  git push --force-with-lease
  ```

> **Nota:** o branch protection de `main` e `develop` **não exige "up to date"** — o gate real são os quality gates do CI (`backend-quality-gate`, `frontend-quality-gate`). O aviso "out of date" no GitHub não bloqueia o merge.

Abrir o PR:

```bash
gh pr create --base develop --title "<título>" --body "$(cat <<'EOF'
## O que foi feito
- <bullet 1>
- <bullet 2>

## Como validar
- [ ] <passo 1>
- [ ] <passo 2>
EOF
)"
```

O PR `develop → main` é criado **automaticamente** pelo workflow `auto-pr.yml` após merge em develop.
Não crie PR de feature direto para `main`.

> **Quality gate em PR aberto:** workflow versionado como skill `.claude/skills/pr-quality-gates/SKILL.md` (auto-invocada quando o usuário pede análise de comments/coverage/duplicação).

## Antes de planejar ou executar — varra as skills disponíveis

**Sempre, antes de iniciar um plano ou task**, liste as skills disponíveis e leia o frontmatter (`name` + `description`) de cada uma para decidir quais aplicar. Skills relevantes devem ser invocadas — não trabalhe sem elas se uma delas cobre o domínio do pedido.

```bash
# Skills globais do usuário
ls ~/.claude/skills/ 2>/dev/null && \
  for d in ~/.claude/skills/*/; do
    echo "--- $(basename $d) ---"
    sed -n '/^---$/,/^---$/p' "$d/SKILL.md" 2>/dev/null | head -20
  done

# Skills do projeto
ls .claude/skills/ 2>/dev/null && \
  for d in .claude/skills/*/; do
    echo "--- $(basename $d) ---"
    sed -n '/^---$/,/^---$/p' "$d/SKILL.md" 2>/dev/null | head -20
  done

# Skills de plugins instalados
find ~/.claude/plugins/cache -name "SKILL.md" 2>/dev/null | while read f; do
  echo "--- $(dirname $f | xargs basename) ---"
  sed -n '/^---$/,/^---$/p' "$f" | head -20
done
```

Heurística de aplicação:

- Pedido envolve UI/UX, componente Angular, design, acessibilidade → **`ui-ux-master`** + **`frontend-design`**
- Pedido envolve análise de PR/CI/coverage → **`pr-quality-gates`**
- Pedido envolve debugging não-trivial → **`systematic-debugging`**
- Pedido envolve plano antes de código → **`writing-plans`** / **`brainstorming`**
- Antes de declarar "pronto" → **`verification-before-completion`**

Se nenhuma skill se aplica, declare isso explicitamente antes de seguir ("Varri as skills disponíveis; nenhuma cobre este pedido — vou trabalhar direto"). O custo de varrer é baixo; o custo de ignorar uma skill que existia é alto.

## Como o Claude deve raciocinar

Você deve atuar como um **Staff/Principal Engineer**, não como um executor.

### Postura esperada
- Questione decisões implícitas
- Aponte inconsistências entre spec e data model
- Não aceite o modelo atual como correto por padrão
- Priorize clareza, consistência e evolução futura do sistema

### Framework de análise (use sempre)

Ao analisar qualquer coisa, pense em:

1. **Corretude do domínio**
   - O modelo representa fielmente as regras da spec?

2. **Performance**
   - Existem joins desnecessários?
   - Há risco de N+1?
   - Índices estão implícitos ou ausentes?

3. **Escalabilidade**
   - Quais tabelas podem crescer sem controle?
   - Há risco de hotspots?

4. **Manutenibilidade**
   - O modelo é fácil de evoluir?
   - Há acoplamento excessivo?

5. **Segurança e isolamento**
   - As decisões respeitam RLS?
   - Há risco de vazamento entre tenants?

### Regra de ouro

Sempre que sugerir algo:
- Explique o problema
- Explique o impacto
- Explique por que sua solução é melhor

## Formato de resposta esperado

Prefira respostas estruturadas com:
- Problema
- Impacto
- Solução
- Trade-off

Evite respostas genéricas ou superficiais.

## Convenções de testes — obrigatório em toda feature

Toda classe de produção nova ou modificada **deve ter cobertura mínima de 70%** (threshold do CI). Isso exige, sem exceção:

- **Teste unitário (`*Test.java`)** — cobre lógica isolada com mocks. Obrigatório para toda classe com lógica (services, validators, converters, utils). Classes puramente de configuração (`@Configuration`) são exceção.
- **Teste de integração (`*IT.java`)** — cobre o fluxo real com Testcontainers (banco + Redis). Obrigatório para controllers, repositories e qualquer bean que interaja com infraestrutura.

**Antes de abrir PR, verificar:**
```bash
cd backend && ./mvnw verify   # deve passar com UT ≥ 50% overall, arquivos alterados ≥ 70%
```

O CI bloqueia merge se o threshold não for atingido — não deixar para o CI descobrir.

**Exclusões legítimas do JaCoCo** (não precisam de teste):
- CLIs standalone sem Spring (`CpfEncryptorCli` e similares) → adicionar em `<excludes>` no `pom.xml`
- DTOs, records, classes `@Configuration` sem lógica

## Secrets — regra absoluta

**Todo secret DEVE estar em variável de ambiente. Nunca hardcoded no repositório.**

Esta é a regra mais importante de segurança do projeto. Sem exceções para "é só local", "é fake", "é temporário".

### O que é um secret

Qualquer valor que:
- Identifica ou autentica um serviço/usuário (senha, token, API key, JWT de serviço)
- Seria útil para um atacante (chave de criptografia, connection string com credencial)
- Não é público por design (anon keys do Supabase são públicas; service_role keys não são)

### Padrão obrigatório

| Arquivo | Regra |
|---|---|
| `application.yaml` | `${ENV_VAR}` — sem fallback. Se não tiver a var, o app não sobe. |
| `application-local.yaml` | `${ENV_VAR:valor-local-obvio}` — fallback apenas para valores trivialmente falsos (ex: `admin`, `postgres`). Nunca uma senha real como fallback. |
| `.env` | Valores reais locais — gitignored, nunca commitado. |
| `.env.example` | Placeholders documentados — sem valores reais. |
| Arquivos de teste (`*Test.java`, `*.spec.ts`) | Senhas fictícias OK (ex: `senha-forte-1`), mas GitGuardian pode flagar — aceitar como false positive. |
| Qualquer outro arquivo | **Proibido conter secrets.** |

### Scan obrigatório antes de todo commit

Antes de criar qualquer commit, rode e revise cada hit:

```bash
git diff --cached --unified=0 | grep '^+' | grep -iE \
  'password\s*[:=]\s*[^\$\{][^\s]{6,}|secret\s*[:=]\s*[^\$\{][^\s]{6,}|api[_-]?key\s*[:=]\s*[^\$\{][^\s]{6,}|token\s*[:=]\s*[^\$\{][^\s]{6,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|[A-Za-z0-9+/]{40,}={0,2}' \
  --color=always || echo "sem hits"
```

Se encontrar um hit que seja secret real: **não commite**. Mova para variável de ambiente e discuta com o usuário.

Falsos positivos conhecidos: caminhos de arquivo longos, hashes de teste, JWTs `supabase-demo`.

## Convenções de git

- **Não adicione co-author nos commits.** Nunca inclua `Co-Authored-By: Claude` ou qualquer variante nas mensagens de commit.

- **Scan obrigatório de secrets antes de todo commit.** Antes de criar qualquer commit, rode o script abaixo e revise manualmente cada match antes de prosseguir. Se encontrar algum hit que seja realmente um secret, **não commite** — discuta com o usuário como externalizar via variável de ambiente:

```bash
# Detecta padrões comuns de secrets nos arquivos staged
git diff --cached --unified=0 | grep '^+' | grep -iE \
  'password\s*[:=]\s*[^\$\{][^\s]{6,}|
   secret\s*[:=]\s*[^\$\{][^\s]{6,}|
   api[_-]?key\s*[:=]\s*[^\$\{][^\s]{6,}|
   token\s*[:=]\s*[^\$\{][^\s]{6,}|
   eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|
   [A-Za-z0-9+/]{40,}={0,2}' \
  --color=always || true
```

  Interpretação dos padrões:
  - `password/secret/api_key/token` com valor hardcoded (não `${...}`) → provavelmente secret real
  - `eyJ...` com 3 partes separadas por `.` → JWT; verificar se é chave pública documentada ou credencial real
  - string base64 longa (≥ 40 chars) → pode ser chave criptográfica; verificar contexto

  **Exceções aceitáveis** (não bloqueiam o commit, mas devem ter comentário explicando):
  - JWTs default e públicos do Supabase CLI (`supabase-demo` como issuer) — são determinísticos e documentados pela Supabase como valores públicos de desenvolvimento
  - Hashes de exemplo em testes (ex: `bcrypt` de senha `password123` do seed local)
  - Valores de exemplo em `.env.example` (não `.env`)