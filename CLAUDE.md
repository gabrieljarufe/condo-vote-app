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

## Stack

Java 21 + Spring Boot · Angular · PostgreSQL (Supabase) + Flyway · Supabase Auth (JWT/JWKS) ·
Redis Upstash · Resend + Thymeleaf · Oracle Cloud + Coolify · Cloudflare Pages/DNS · GHCR + GitHub Actions.

Detalhes, justificativas e trade-offs em `docs/architecture.md`.

## Comandos

### Backend
```bash
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local
cd backend && ./mvnw verify                           # unit + integration (Testcontainers)
docker build -t condo-vote-backend ./backend
docker compose up --build backend                     # backend container contra Supabase CLI
```

### Frontend (Fase 4)
```bash
cd frontend && npm install && npm start
cd frontend && npm run build
```

### Infraestrutura
```bash
cd infra/supabase && supabase start
cd backend && ./mvnw flyway:migrate
```

- **Bootstrap de condomínio:** migration Flyway `V1001+` no repo, não SQL ad-hoc no Studio. Ver `docs/architecture.md §1` (runbook detalhado virá na Fase 6).
- **Acesso SSH à VM Oracle e painel Coolify:** `docs/runbooks/ssh-vm.md` (gitignored — IPs, OCIDs, fluxos de fallback).
- **Bruno API Collection:** `api-collection/README.md` (setup, fluxo de uso, convenção `.bru` por rota).

> **Quality gate em PR aberto:** workflow versionado como skill `.claude/skills/pr-quality-gates/SKILL.md` (auto-invocada quando o usuário pede análise de comments/coverage/duplicação).

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

## Convenções de git

- **Não adicione co-author nos commits.** Nunca inclua `Co-Authored-By: Claude` ou qualquer variante nas mensagens de commit.