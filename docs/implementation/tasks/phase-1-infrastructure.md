# Fase 1 — Fundação de Infraestrutura

**Objetivo:** contas, projetos e secrets provisionados. Nenhuma linha de código de app ainda.

**Pré-requisitos:** Fase 0 concluída.

> **Nota:** esta fase é 95% cliques em dashboards. Task `T1.6` é a única com entregável no repo.

---

## T1.1 — Projeto Supabase
- [x] Criar projeto Supabase (região São Paulo ou mais próxima)
- [x] Settings → Auth → desabilitar "Enable email confirmations" (spec §3)
- [x] Capturar secrets (para `.env` local e Coolify prod): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`
- [x] Criar usuário superadmin pessoal no Dashboard (não é síndico — é o operador da plataforma)

**Aceite:** conseguir logar no Supabase Studio e abrir o schema `public` (vazio).

---

## T1.2 — Upstash Redis
- [x] Criar Redis database (free tier, região alinhada com Supabase `us-east-2` / Oracle `us-ashburn-1`)
- [x] Capturar `REDIS_URL` (formato Redis protocol: `rediss://:password@host:port`) — Upstash suporta Redis protocol além da REST API
- [x] Testar conexão local com `redis-cli` ou `nc`

**Aceite:** `SET test 1 && GET test` funciona remotamente.

---

## T1.3 — Resend (e-mail)
- [x] Criar conta Resend
- [x] Capturar `RESEND_API_KEY` e salvar no cofre pessoal
- [x] Enviar e-mail de teste via `curl` para validar credenciais

> Verificação de domínio próprio (`condovote.com.br`) e configuração de DNS ficam na Fase 3.

**Aceite:** API key funciona; e-mail de teste chegou. ✓

---

## T1.4 — Oracle Cloud + Coolify + Cloudflare DNS/Pages + GHCR

### T1.4a — Oracle Cloud tenancy
- [x] Criar conta Oracle Cloud; escolher região **`us-ashburn-1`** (ARM A1 tem boa disponibilidade; co-localização com Supabase `us-east-2`)
- [x] Validar billing (cartão obrigatório mesmo no Always Free — cobrado $0 se ficar dentro do free)
- [x] Ativar billing alerts em $1 para detectar qualquer drift

### T1.4b — Provisionar VM ARM Ampere A1
- [ ] Compute → Instances → Create Instance
- [ ] Shape: **VM.Standard.A1.Flex** — 2 OCPU / 8GB RAM (pode subir depois até 4/24 sem custo)
- [ ] Image: Ubuntu 22.04 Minimal
- [ ] ⚠️ "Out of capacity" nos 3 ADs de us-ashburn-1 — tentar novamente em horários diferentes (madrugada BR). VCN `condo-vote-vcn` + public subnet já criadas. SSH keypair gerado e salvo no Bitwarden.
- [x] Gerar SSH keypair, guardar `.pem` no cofre pessoal
- [ ] Anotar **IP público** da VM

### T1.4c — VCN + Security List
- [ ] Abrir ingress na Security List padrão: porta `22` (restringir ao seu IP pessoal), `80` (HTTP), `443` (HTTPS)
- [ ] No Ubuntu da VM, liberar firewall: `sudo iptables -I INPUT -p tcp -m multiport --dports 80,443 -j ACCEPT && sudo netfilter-persistent save`

### T1.4d — Instalar Coolify
- [ ] SSH na VM: `ssh -i key.pem ubuntu@<ip>`
- [ ] Instalar: `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash`
- [ ] Acessar `http://<ip>:8000`, criar conta admin, setar senha forte
- [ ] Configurar domínio do próprio Coolify (`coolify.condovote.com.br` como subdomínio interno, ou usar IP por enquanto)

### T1.4e — Cloudflare (DNS autoritativo)
- [x] Registrar conta Cloudflare (free)
- [x] Add site → `condovote.com.br` → plano Free
- [x] Atualizar **nameservers no registrar do domínio** para os NS da Cloudflare
- [x] Aguardar propagação (`dig NS condovote.com.br` mostra NS Cloudflare)
- [x] SSL/TLS → mode **Full (strict)**
- [x] SSL/TLS → Origin Server → Create Certificate → `*.condovote.com.br`, `condovote.com.br`, validade 15 anos → **salvar cert + key** para colar no Coolify depois

### T1.4f — Registros DNS
- [ ] `api.condovote.com.br` → A record apontando para IP público da VM Oracle, **Proxy ON (laranja)** — aguarda T1.4b
- [ ] `app.condovote.com.br` → CNAME para `<projeto>.pages.dev` (criado em T1.4h), **Proxy ON (laranja)** — aguarda T1.4h
- [x] `condovote.com.br` → A record `192.0.2.1`, **Proxy ON** (placeholder para redirect rule)
- [x] `www.condovote.com.br` → CNAME para `condovote.com.br`, **Proxy ON**

### T1.4g — Redirect Rules (apex + www)
- [x] Rules → Redirect Rules → Create:
  - Se hostname = `condovote.com.br` OR `www.condovote.com.br` → 301 para `https://app.condovote.com.br$1` (preserve path + query)

### T1.4h — Cloudflare Pages (frontend)
- [ ] Workers & Pages → Create Application → Pages → Connect to Git → selecionar repo
- [ ] Project name: `condo-vote-frontend`
- [ ] Production branch: `main`
- [ ] Framework preset: Angular (ou None + configurar manualmente)
- [ ] Build command: `ng build --configuration=production` (ajustar em Fase 4)
- [ ] Build output directory: `dist/frontend/browser`
- [ ] Root directory: `frontend/`
- [ ] Custom domain → `app.condovote.com.br` (Cloudflare auto-valida porque já é autoritativo)

### T1.4i — Coolify + repo
- [ ] No Coolify: Sources → New GitHub App → autorizar no repo
- [ ] Criar Application no Coolify apontando para o repo, branch `main`, build pack Dockerfile, root directory `backend/` — **sem fazer deploy ainda** (Dockerfile chega na Fase 3)
- [ ] Installing SSL cert custom: Caddy → upload Cloudflare Origin CA cert + key (capturados em T1.4e)

### T1.4j — GHCR (GitHub Container Registry)
- [x] No GitHub: Settings → Developer settings → Personal access tokens → Generate (classic)
- [x] Escopos: `write:packages`, `read:packages` (repo público — `repo` não necessário)
- [x] Guardar token em cofre pessoal (Bitwarden)
- [x] No repo: Settings → Secrets and variables → Actions → New repository secret: `GHCR_TOKEN` = valor do PAT

**Aceite:** VM Oracle no ar com Coolify acessível; Cloudflare autoritativo com `api.` e `app.` apontados; Pages projeto criado conectado ao repo; Coolify conectado ao repo com Origin CA instalado; `GHCR_TOKEN` disponível nos Actions secrets.

---

## T1.5 — Supabase CLI local
- [x] Instalar Supabase CLI (homebrew: `brew install supabase/tap/supabase`) — v2.90.0
- [x] `supabase init` dentro de `infra/supabase/` — `config.toml` gerado em `infra/supabase/supabase/config.toml`
- [x] `supabase start` roda sem erro (Docker 29.3.1) — Studio em `http://127.0.0.1:54323`
- [x] Documentar no README os comandos `supabase start` / `supabase stop` / `supabase status`

**Aceite:** Supabase Studio local abre em `http://127.0.0.1:54323` e mostra Postgres local vazio. ✅

---

## T1.6 — Secrets e chave de criptografia
- [x] Completar `.env.example` na raiz com todas as variáveis:
  - Backend: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`, `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, `CPF_ENCRYPTION_KEY`, `CORS_ALLOWED_ORIGINS`
  - Frontend: `NG_APP_SUPABASE_URL`, `NG_APP_SUPABASE_ANON_KEY`, `NG_APP_API_URL`
- [x] Criar `.env.local` com valores locais (Supabase local, Redis local, `localhost` URLs) — gitignored
- [x] Gerar `CPF_ENCRYPTION_KEY` de 32 bytes base64: `openssl rand -base64 32`
- [x] Armazenar chave em cofre pessoal (Bitwarden) — é a única chave capaz de descriptografar CPFs
- [ ] Injetar variáveis no Dashboard Coolify (backend, Secrets criptografados em repouso) e Cloudflare Pages (frontend) — aguarda T1.4d e T1.4h
- [ ] GitHub Actions Secrets só o necessário (se CI precisar tocar Supabase — provavelmente não na v1)

**Aceite:** `.env.example` commitado; chave real nunca no repo; todas as variáveis populadas nos respectivos dashboards.
