# Condo Vote

Sistema de votação condominial com foco em conformidade com o Código Civil brasileiro, LGPD e quóruns definidos por lei.

## Stack

| Camada | Tecnologia |
|--------|----------|
| Backend | Java 21 + Spring Boot |
| Frontend | Angular |
| Banco | PostgreSQL (Supabase) + Flyway |
| Auth | Supabase Auth |
| Redis | Upstash |
| E-mail | Resend |
| CI/CD | GitHub Actions |
| Hosting backend | Oracle Cloud `us-ashburn-1` + Coolify |
| Hosting frontend | Cloudflare Pages |
| DNS / edge | Cloudflare |

## Pré-requisitos

- Java 21
- Node.js 20+
- Docker Desktop
- Supabase CLI (`brew install supabase/tap/supabase`)
- Maven 3.9+

## Infraestrutura local

```bash
# Criar arquivo .env a partir do .env.example
cp .env.example .env
# Edite .env com os valores locais (nunca commite este arquivo)

# Subir Supabase local (Postgres + Auth + Studio)
cd infra/supabase && supabase start

# Verificar status dos serviços
cd infra/supabase && supabase status

# Parar Supabase local
cd infra/supabase && supabase stop
```

Após `supabase start`, o Studio estará em `http://127.0.0.1:54323` e o banco local em `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

## Desenvolvimento

```bash
# Backend (Fase 3)
cd backend && ./mvnw spring-boot:run

# Frontend (Fase 4)
cd frontend && npm install && npm start
```

## Variáveis de Ambiente

Ver `.env.example` para a lista completa. Valores locais ficam em `.env` (gitignored); valores de produção ficam no Dashboard Coolify (backend) e Cloudflare Pages (frontend).

## Deploy

O ciclo de release segue o fluxo:

```
feature/* → PR → develop   (CI: test + frontend-test obrigatórios)
develop   → PR → main       (CI: test + frontend-test + 1 approval)
```

No merge em `main`:
- **Backend** — `publish-image` builda e publica `ghcr.io/gabrieljarufe/condo-vote-backend:latest` no GHCR; Coolify detecta via webhook e faz pull + restart automático em `api.condovote.com.br`
- **Frontend** — `cloudflare-pages.yml` builda e deploya em `app.condovote.com.br` via Cloudflare Pages

Variáveis de produção:
- Backend: Dashboard Coolify → Environment Variables
- Frontend: Cloudflare Pages Dashboard → Settings → Environment Variables (repository secrets `NG_APP_*` usados no build via GitHub Actions)

## Documentação

- [Arquitetura](docs/architecture.md)
- [Data Model](docs/data-model.md)
- [Princípios de Produto](docs/condo-vote-principles.md)
- [Plano de Implementação](plan.md)
