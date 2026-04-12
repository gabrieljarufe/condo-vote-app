# Condo Vote — Plano de Implementação

> Etapas Specify concluídas: `docs/condo-vote-principles.md` + `docs/data-model.md`
> Metodologia: Specify → Plan → Tasks → Implement

---

## Etapa 1 — Setup do Projeto
- Inicializar Spring Boot (Java 21)
- Configurar PostgreSQL + Flyway para migrations
- Estrutura de pacotes (domain, repository, service, controller)
- Docker Compose (Postgres + app)

## Etapa 2 — Migrations e RLS
- DDL das 9 tabelas + enums + índices
- Configurar RLS policies (`app.current_tenant`)
- Seed do admin/síndico

## Etapa 3 — Autenticação
- Registro via convite (aceitar token)
- Login (email + senha → JWT + refresh token)
- Refresh token rotation
- Recuperação de senha

## Etapa 4 — Condomínio e Apartamentos
- CRUD de apartamentos (síndico)
- Gestão de moradores (vínculo, remoção, promoção de inquilino a proprietário)
- Inadimplência (marcar/desmarcar)
- Delegação de voto (proprietário → inquilino)

## Etapa 5 — Convites
- Envio de convite (síndico/proprietário)
- Aceite de convite + onboarding
- Reenvio e expiração (5 dias)

## Etapa 6 — Votação
- CRUD de poll + opções (síndico)
- Máquina de estados (DRAFT → SCHEDULED → OPEN → CLOSED)
- Scheduler para transições automáticas
- Registro de voto
- Cálculo de quórum e resultado
- Empate (TIED) e invalidação

## Etapa 7 — Notificações
- Serviço de e-mail (Spring Mail)
- Templates para os 8 eventos da spec

## Etapa 8 — LGPD
- Consentimento no cadastro (checkbox)
- Exclusão de conta e dados pessoais
- Criptografia de CPF (AES-256)

## Etapa 9 — Frontend Angular
- Auth (login, registro, refresh token)
- Seletor de condomínio (multi-tenant)
- Painel do síndico
- Painel do morador
- Tela de votação

---

**Ordem:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

*Frontend por último — backend validado via API/Postman antes de construir UI.