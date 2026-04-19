# Condo Vote

Sistema de votação condominial com foco em conformidade com o Código Civil brasileiro, LGPD e quórums definidos por lei.

## Stack

| Camada | Tecnologia |
|--------|----------|
| Backend | Java 21 + Spring Boot |
| Frontend | Angular |
| Banco | PostgreSQL (Supabase) |
| Auth | Supabase Auth |
| Redis | Upstash |
| E-mail | Resend |
| CI/CD | GitHub Actions |
| Hosting | Railway (backend) + Vercel (frontend) |

## Pré-requisitos

- Java 21
- Node.js 20+
- Docker e Docker Compose
- Supabase CLI (`npm install -g supabase`)
- Maven 3.9+

## Documentação

### Local (Em desenvolvimento)

```bash
# Criar arquivo .env a partir do .env.example
cp .env.example .env

# Iniciar Supabase local
cd infra/supabase && supabase start

# Backend (Em desenvolvimento)
cd backend && ./mvnw spring-boot:run

# Frontend
cd frontend && npm install && npm start
```

## Variáveis de Ambiente

### Supabase
- `SUPABASE_URL` - URL do projeto Supabase
- `SUPABASE_ANON_KEY` - Chave anônima
- `SUPABASE_SERVICE_ROLE_KEY` - Chave de serviço (apenas backend)
- `JWT_SECRET` - Segredo para validação JWT

### Banco
- `DATABASE_URL` - Connection string PostgreSQL

### Redis
- `UPSTASH_REDIS_REST_URL` - URL REST do Upstash
- `UPSTASH_REDIS_REST_TOKEN` - Token de acesso

### E-mail
- `RESEND_API_KEY` - API key do Resend
- `RESEND_FROM_ADDRESS` - Endereço de remetente

### Criptografia
- `CPF_ENCRYPTION_KEY` - Chave AES-256-GCM (32 bytes base64)

Ver `.env.example` para a lista completa.

## Links

- [Arquitetura](docs/architecture.md)
- [Data Model](docs/data-model.md)
- [Princípios de Produto](docs/condo-vote-principles.md)
- [Plano de Implementação](docs/implementation/plan.md)