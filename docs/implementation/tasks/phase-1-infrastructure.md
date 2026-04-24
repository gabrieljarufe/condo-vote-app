# Fase 1 — Fundação de Infraestrutura

**Objetivo:** contas, projetos e secrets provisionados. Nenhuma linha de código de app ainda.

**Pré-requisitos:** Fase 0 concluída.

> **Nota:** esta fase é 95% cliques em dashboards. Entregáveis no repo: `infra/oci/security-list-rules.json` (T1.4c) e `.env.example` (T1.6).

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

**T1.3a — DKIM + SPF (pode ser feito após T1.4f — Cloudflare DNS configurado):**
- [ ] Adicionar registros DKIM + SPF para `condovote.com.br` no Cloudflare DNS (TXT records gerados pelo Resend dashboard → "Domains → Add Domain → condovote.com.br → DNS Records")
- [ ] Validar: `dig +short TXT condovote.com.br` (mostra SPF) e `dig +short TXT resend._domainkey.condovote.com.br` (mostra DKIM)
- [ ] Aguardar status "Verified" no Resend dashboard

**T1.3b — SMTP Supabase Auth via Resend:**
- [ ] Configurar SMTP customizado no Supabase Dashboard (Auth → SMTP Settings): host Resend, porta 465/587, credenciais SMTP do Resend. Garante que emails de reset de senha saem de `condovote.com.br`, não do domínio padrão do Supabase.

**Aceite:** API key funciona; e-mail de teste chegou. DKIM/SPF verificados no Resend dashboard ✓ (T1.3a/b podem ser concluídas em Fase 6 se necessário).

---

## T1.4 — Oracle Cloud + Coolify + Cloudflare DNS/Pages + GHCR

### T1.4a — Oracle Cloud tenancy
- [x] Criar conta Oracle Cloud; escolher região **`us-ashburn-1`** (ARM A1 tem boa disponibilidade; co-localização com Supabase `us-east-2`)
- [x] Validar billing (cartão obrigatório mesmo no Always Free — cobrado $0 se ficar dentro do free)
- [x] Ativar billing alerts em $1 para detectar qualquer drift

### T1.4b — Provisionar VM ARM Ampere A1
- [x] Compute → Instances → Create Instance
- [x] Shape: **VM.Standard.A1.Flex** — 2 OCPU / 8GB RAM
- [x] Image: Ubuntu 22.04 Minimal — AD-1 (US-ASHBURN-AD-1), criada em 2026-04-23
- [x] Gerar SSH keypair, guardar `.pem` no cofre pessoal (Bitwarden: `condo-vote-oracle-ssh-private-key`)
- [x] IP público da VM anotado no Bitwarden e no `CLAUDE.md` (não exposto aqui)

> **Nota:** acesso SSH é via Tailscale (não pelo IP público). Ver seção "VM Oracle (acesso SSH)" no `CLAUDE.md`.

### T1.4c — VCN + Security List
- [x] Abrir ingress na Security List padrão: porta `22` (restrita ao IP Tailscale do Mac), `80` e `443` abertas para `0.0.0.0/0`
- [x] Security List versionada em `infra/oci/security-list-rules.json` — aplicar via `oci-cli`, nunca pelo console OCI diretamente
- [x] No Ubuntu da VM: portas 80, 443, 8000 liberadas no iptables e persistidas com `netfilter-persistent save`
- [x] Tailscale instalado na VM e no Mac — acesso SSH sempre via IP Tailscale (IPs em `docs/private/phase-1-state.md`)
- [x] fail2ban instalado com IP Tailscale do Mac em `ignoreip`, backend `systemd`

### T1.4d — Instalar Coolify
- [x] SSH na VM via Tailscale (ver `docs/runbooks/ssh-vm.md`)
- [x] Instalar: `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash` — versão 4.0.0-beta.474
- [x] Conta admin criada (credenciais em Bitwarden: `condo-vote-coolify-admin`)
- [x] Server type: **This Machine** — Coolify e backend rodam na mesma VM
- [x] Configurar domínio do Coolify: `coolify.condovote.com.br` — Proxy OFF, certificado Let's Encrypt via Caddy automático
- [x] GitHub App `condo-vote` criado no Coolify, webhook endpoint `https://coolify.condovote.com.br`, acesso restrito ao repo `condo-vote-app`

> **Decisão tomada em 2026-04-23:** Coolify tem domínio próprio `coolify.condovote.com.br` com Let's Encrypt (Proxy OFF — Caddy gerencia cert diretamente). Porta 8000 não está aberta na OCI Security List — acesso admin é via Tailscale ou domínio público.

### T1.4e — Cloudflare (DNS autoritativo)
- [x] Registrar conta Cloudflare (free)
- [x] Add site → `condovote.com.br` → plano Free
- [x] Atualizar **nameservers no registrar do domínio** para os NS da Cloudflare
- [x] Aguardar propagação (`dig NS condovote.com.br` mostra NS Cloudflare)
- [x] SSL/TLS → mode **Full (strict)**
- [x] SSL/TLS → Origin Server → Create Certificate → `*.condovote.com.br`, `condovote.com.br`, validade 15 anos → **salvar cert + key** para colar no Coolify depois

### T1.4f — Registros DNS

Estado atual da zona `condovote.com.br` no Cloudflare:

| Tipo | Nome | Destino | Proxy | Uso |
|---|---|---|---|---|
| A | `api` | IP público da VM | ON | Backend Spring Boot (via Caddy/Coolify) |
| A | `coolify` | IP público da VM | OFF | Painel Coolify (Let's Encrypt direto) |
| A | `condovote.com.br` | `192.0.2.1` | ON | Placeholder para Redirect Rule |
| CNAME | `app` | `condo-vote-frontend.pages.dev` | ON | Frontend Angular (Cloudflare Pages) |
| CNAME | `www` | `condovote.com.br` | ON | Redirect para `app.` |
| MX | `condovote.com.br` | `.` (priority 0) | — | Null MX — rejeita e-mail no apex |
| TXT | `condovote.com.br` | `v=spf1 -all` | — | SPF — nenhum servidor autorizado no apex |
| TXT | `_dmarc` | `v=DMARC1; p=reject;` | — | DMARC — rejeita spoofing do domínio |

- [x] Todos os registros acima criados e validados

### T1.4g — Redirect Rules (apex + www)
- [x] Rules → Redirect Rules → Create:
  - Se hostname = `condovote.com.br` OR `www.condovote.com.br` → 301 para `https://app.condovote.com.br$1` (preserve path + query)

### T1.4h — Cloudflare Pages via GitHub Actions

> **Decisão tomada em 2026-04-24:** Auto-deploy nativo do Cloudflare Pages foi desabilitado
> via Branch Control (Production: OFF, Preview: None). Deploy agora via GitHub Actions
> workflow `.github/workflows/cloudflare-pages.yml` — evita double deploy.

- [x] Workers & Pages → Connect to Git → repo `condo-vote-app` (mantido para integrações GitHub)
- [x] Branch control → **Production: OFF**, **Preview: None** (disable auto-deploy nativo)
- [x] Project name: `condo-vote-frontend`
- [x] Production branch: `main` (usado pelo workflow, não pelo Cloudflare)
- [x] Framework preset: `None` (Angular chega na Fase 4)
- [x] Build command: vazio (configurar em Fase 4: workflow faz build)
- [x] Build output directory: `dist/frontend/browser`
- [x] Root directory: `frontend/`
- [x] Custom domain `app.condovote.com.br` adicionado via Pages → Custom domains
- [x] Env vars (Production): `NG_APP_SUPABASE_URL`, `NG_APP_SUPABASE_ANON_KEY`, `NG_APP_API_URL=https://api.condovote.com.br`

- [x] `.github/workflows/cloudflare-pages.yml` criado e commitado:
  - Trigger: `push` em `main`/`develop` com mudanças em `frontend/**`
  - `workflow_dispatch` para deploy manual
  - Steps: checkout → npm ci → npm run build → wrangler pages deploy
  - Deploy para branch correspondente (`main`=production, `develop`=preview)

- [x] Secrets do GitHub Actions configurados (`gh secret set`):
  - `CLOUDFLARE_API_TOKEN`: token com permissões Edit para Pages
  - `CLOUDFLARE_ACCOUNT_ID`: ID da conta Cloudflare

### T1.4i — Coolify + repo
- [x] No Coolify: Sources → GitHub App `condo-vote` criado, autorizado apenas no repo `condo-vote-app`
- [x] Application `condo-vote-backend` criada: repo público `https://github.com/jarufe/condo-vote-app`, branch `main`, build pack Dockerfile, base dir `/backend/`, domain `https://api.condovote.com.br` — **sem deploy** (Dockerfile chega na Fase 3)
- [x] SSL do Coolify dashboard: Let's Encrypt via Caddy automático (domínio `coolify.condovote.com.br`, Proxy OFF)

### T1.4j — GHCR (GitHub Container Registry)
- [x] No GitHub: Settings → Developer settings → Personal access tokens → Generate (classic)
- [x] Escopos: `write:packages`, `read:packages` (repo público — `repo` não necessário)
- [x] Guardar token em cofre pessoal (Bitwarden)
- [x] No repo: Settings → Secrets and variables → Actions → New repository secret: `GHCR_TOKEN` = valor do PAT

**Aceite:** VM Oracle no ar com Coolify acessível; Cloudflare autoritativo com `api.` e `app.` apontados; Pages projeto criado conectado ao repo; Coolify conectado ao repo com Let's Encrypt automático; `GHCR_TOKEN` disponível nos Actions secrets.

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
  - Backend: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`, `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, `CPF_ENCRYPTION_KEY`, `CORS_ALLOWED_ORIGINS` — **sem `SUPABASE_JWT_SECRET`**: validação via JWKS (ver `architecture.md` §1)
  - Frontend: `NG_APP_SUPABASE_URL`, `NG_APP_SUPABASE_ANON_KEY`, `NG_APP_API_URL`
- [x] Criar `.env.local` com valores locais (Supabase local, Redis local, `localhost` URLs) — gitignored
- [x] Gerar `CPF_ENCRYPTION_KEY` de 32 bytes base64: `openssl rand -base64 32`
- [x] Armazenar chave em cofre pessoal (Bitwarden) — é a única chave capaz de descriptografar CPFs
- [x] Injetar variáveis no Dashboard Coolify (backend, Secrets criptografados em repouso) e Cloudflare Pages (frontend)
- [x] GitHub Actions Secrets não necessário na v1

**Aceite:** `.env.example` commitado; chave real nunca no repo; todas as variáveis populadas nos respectivos dashboards.
