# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado atual do projeto

Este repositório está em **fase de design, sem código**. O que existe é apenas documentação em `docs/` (e `LICENSE` + `README.md` de uma linha). Não há build, testes, lint ou comandos de runtime — não tente executar nenhum.

Metodologia adotada: **Spec-Driven Development** (Specify → Plan → Tasks → Implement). As fases **Specify** e **Plan** estão concluídas. Próximo passo: **Tasks** (roadmap de implementação com epics/features ordenados).

Toda a documentação é escrita em **português** — mantenha o idioma ao editar docs existentes ou criar novos.

## Docs canônicos (onde as decisões vivem)

| Arquivo | Propósito |
|---------|-----------|
| `docs/condo-vote-principles.md` | Spec de produto. Fonte da verdade para **regras de negócio, atores, ciclo de vida de votações, quórum, LGPD** |
| `docs/data-model.md` | ERD, enums PostgreSQL, tabelas, índices e política de RLS. Fonte para **schema do banco** |
| `docs/architecture.md` | Decisões arquiteturais — **todas as 10 seções preenchidas**: auth (Supabase), backend (monolito modular DDD-lite), banco (Supabase Postgres + Flyway), jobs (@Scheduled), e-mail (Resend + outbox), frontend↔backend (REST + springdoc), infra (Railway + Vercel + Upstash + GitHub Actions), segurança (Bucket4j, AES-256-GCM, audit_event), observabilidade (JSON logging + Actuator + UptimeRobot) |

Ao responder perguntas sobre o domínio, **leia a spec** antes de deduzir — ela é detalhada e já cobriu muitos edge cases.

## Invariantes do domínio (não-negociáveis)

Estas decisões parecem de implementação mas são **estruturais**. Não mude sem discutir explicitamente com o usuário.

- **Multi-tenant por RLS:** toda tabela de domínio tem `condominium_id`; queries rodam com `SET LOCAL app.current_tenant = '<uuid>'`. O `condominium_id` **redundante** em `vote` e `apartment_resident` é intencional — é necessário para a política RLS funcionar sem JOINs. Não remova.
- **Snapshot de elegibilidade é write-once:** `poll_eligible_snapshot` é gerado na transição `SCHEDULED → OPEN` e **nunca** alterado depois. Define o denominador de quórum para os modos Absoluto e Qualificado.
- **Voto pertence ao apartamento**, não ao usuário. `voter_user_id` é apenas testemunha para auditoria. Alinhado com o Código Civil.
- **Votos são imutáveis** após registro. Sem UPDATE/DELETE. Remoção de morador durante poll aberto seta `is_nullified = true`, não deleta.
- **Delegação de voto é bloqueada durante polls OPEN** — previne o vetor "delegar, votar, revogar". Mesma regra deve valer para transferência de titularidade quando ela for implementada.
- **CPF mora em `app_user`, não em `apartment_resident`** — é identificador nacional único por pessoa, independente do condomínio. Armazenado criptografado (AES-256).
- **Síndicos têm paridade total** dentro de um condomínio; auditoria via `created_by_user_id` nas tabelas de domínio.

## Convenções de trabalho neste repo

- **Respeite as decisões arquiteturais documentadas.** `docs/architecture.md` foi preenchido interativamente com o usuário. As decisões são finais para v1 — siga-as ao implementar. Se surgir conflito entre uma decisão e a realidade da implementação, **discuta com o usuário** antes de mudar.
- **Não invente alternativas ao que já foi decidido.** Exemplo: hosting é Railway (backend) + Vercel (frontend) + Upstash (Redis) — não proponha AWS/Render/etc. sem discussão.
- **Transferência de titularidade** (venda, herança, inquilino comprando): na v1 é tratada via **remoção + convite/promoção** pelo síndico. Fluxo formal (solicitação iniciada pelo proprietário) fica para v2. Ver `condo-vote-principles.md` seção 4 ("Transferência de titularidade") e ponto 4 em "Pontos em Aberto".
- Ao propor mudanças em regras de negócio, **atualize a spec** — não só o código. A spec é a fonte da verdade.

## Stack decidida (ainda sem código)

| Camada | Tecnologia | Detalhes |
|--------|-----------|----------|
| Backend | Java 21 + Spring Boot | Monolito modular, DDD-lite, package by feature |
| Frontend | Angular | Supabase JS SDK para auth, HttpInterceptor para JWT + X-Tenant-Id |
| Banco | PostgreSQL (Supabase) + Flyway | RLS por tenant, migrations SQL versionadas |
| Auth | Supabase Auth | JWT validado via JWKS, AuthGateway abstrai provider |
| Redis | Upstash | Apenas invitation tokens (24h TTL) |
| E-mail | Resend + Thymeleaf | Transactional outbox, EmailSender interface |
| CI/CD | GitHub Actions | test → build → deploy. Branching: main ← develop ← feature/* |
| Hosting | Railway (backend) + Vercel (frontend) | Dockerfile multi-stage, auto-deploy a partir de main |

## Comandos

Os comandos abaixo serão populados ao longo das fases 0–3.

### Backend
```bash
# Desenvolvimento (em fase 3)
cd backend && ./mvnw spring-boot:run

# Testes (em fase 3)
cd backend && ./mvnw verify

# Build Docker (em fase 3)
cd backend && ./mvnw package -DskipTests && docker build -t condo-vote-backend .
```

### Frontend
```bash
# Desenvolvimento (em fase 4)
cd frontend && npm install && npm start

# Build produção (em fase 4)
cd frontend && npm run build
```

### Infraestrutura
```bash
# Supabase local (em fase 1)
cd infra/supabase && supabase start

# Testar migrate Flyway (em fase 2)
cd backend && ./mvnw flyway:migrate
```


## Decisões arquiteturais chave (resumo rápido)

Para detalhes completos, ver `docs/architecture.md`. Aqui o mínimo necessário para não errar ao implementar:

- **Auth:** Supabase Auth gerencia signup/login/senhas/refresh. Spring valida JWT via JWKS (cache local). Interface `AuthGateway` abstrai extração de claims. `app_user.id` = `auth.users.id` (mesmo UUID). Confirmação de email desabilitada no Supabase.
- **Onboarding:** validação pública do convite → signUp no Supabase → POST /register/complete no Spring (na mesma transação: cria app_user + apartment_resident + aceita invitation + DEL Redis token). Endpoint idempotente para user existente (múltiplos apartamentos).
- **RLS:** `TenantInterceptor` extrai `X-Tenant-Id` do header → `TenantContext` (ThreadLocal) → AOP executa `SET LOCAL app.current_tenant` antes de cada @Transactional. Sem header = cross-tenant (queries explícitas com WHERE user_id).
- **Jobs:** 6 jobs @Scheduled (PollOpener, PollCloser, AllVotedChecker, InvitationExpirer, EmailSender, ReminderEnqueuer). SELECT FOR UPDATE para idempotência. Sem ShedLock na v1 (1 instância).
- **E-mail:** Transactional outbox (`email_notification` table). `EmailSender` interface → `ResendEmailSender`. Thymeleaf templates. Retry 3x com backoff.
- **Branching:** `main` (protegida, 1 approval + CI verde) ← `develop` (CI verde) ← `feature/*`. Railway auto-deploy de main.

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