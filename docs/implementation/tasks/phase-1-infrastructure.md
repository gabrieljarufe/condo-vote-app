# Fase 1 — Fundação de Infraestrutura

**Objetivo:** contas, projetos e secrets provisionados. Nenhuma linha de código de app ainda.

**Pré-requisitos:** Fase 0 concluída.

> **Nota:** esta fase é 95% cliques em dashboards. Task `T1.6` é a única com entregável no repo.

---

## T1.1 — Projeto Supabase
- [ ] Criar projeto Supabase (região São Paulo ou mais próxima)
- [ ] Settings → Auth → desabilitar "Enable email confirmations" (spec §3)
- [ ] Capturar secrets (para `.env` local e Railway prod): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, JWT secret, `DATABASE_URL`
- [ ] Criar usuário superadmin pessoal no Dashboard (não é síndico — é o operador da plataforma)

**Aceite:** conseguir logar no Supabase Studio e abrir o schema `public` (vazio).

---

## T1.2 — Upstash Redis
- [ ] Criar Redis database (free tier, região alinhada com Railway — US East ou EU)
- [ ] Capturar `REDIS_URL` (formato `redis://default:<pwd>@host:port`) — preferir esse sobre REST para Spring/Lettuce
- [ ] Testar conexão local com `redis-cli` ou `nc`

**Aceite:** `SET test 1 && GET test` funciona remotamente.

---

## T1.3 — Resend (e-mail)
- [ ] Criar conta Resend
- [ ] Verificar domínio de envio (pode ser subdomínio temporário)
- [ ] Capturar `RESEND_API_KEY` e definir `RESEND_FROM_ADDRESS` (ex: `no-reply@condovote.app`)
- [ ] Enviar e-mail de teste via `curl` para validar credenciais

**Aceite:** API key funciona; e-mail de teste chega.

---

## T1.4 — Railway + Vercel
- [ ] Railway: criar projeto vazio, conectar ao repo (sem deploy ainda — Dockerfile vem na Fase 3)
- [ ] Vercel: criar projeto, conectar ao repo, definir root `frontend/`, build command placeholder

**Aceite:** projetos aparecem nos dashboards, conectados ao repo.

---

## T1.5 — Supabase CLI local
- [ ] Instalar Supabase CLI (homebrew: `brew install supabase/tap/supabase`)
- [ ] `supabase init` dentro de `infra/supabase/` — commitar `config.toml`
- [ ] `supabase start` roda sem erro (exige Docker rodando)
- [ ] Documentar no README os comandos `supabase start` / `supabase stop` / `supabase status`

**Aceite:** Supabase Studio local abre em `http://localhost:54323` e mostra Postgres local vazio.

---

## T1.6 — Secrets e chave de criptografia
- [ ] Completar `.env.example` na raiz com todas as variáveis:
  - Backend: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`, `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, `CPF_ENCRYPTION_KEY`, `CORS_ALLOWED_ORIGINS`
  - Frontend: `NG_APP_SUPABASE_URL`, `NG_APP_SUPABASE_ANON_KEY`, `NG_APP_API_URL`
- [ ] Gerar `CPF_ENCRYPTION_KEY` de 32 bytes base64: `openssl rand -base64 32`
- [ ] Armazenar chave em cofre pessoal (1Password/Bitwarden) — é a única chave capaz de descriptografar CPFs
- [ ] Injetar variáveis no Dashboard Railway (backend) e Vercel (frontend). Em Railway usar "secrets" para valores sensíveis
- [ ] GitHub Actions Secrets só o necessário (se CI precisar tocar Supabase — provavelmente não na v1)

**Aceite:** `.env.example` commitado; chave real nunca no repo; todas as variáveis populadas nos respectivos dashboards.
