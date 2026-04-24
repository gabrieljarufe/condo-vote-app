# Plano temporário — Finalização da Fase 1

> ⚠️ **ARQUIVO TEMPORÁRIO.** Este plano existe apenas para guiar a execução pelo Claude Sonnet 4.6.
> **Assim que todas as tasks (T1–T9) estiverem concluídas e o commit final for feito, APAGUE este arquivo** — o estado final fica registrado apenas em `phase-1-infrastructure.md`.

---

## Contexto (para quem chega cold)

A Fase 1 (`docs/implementation/tasks/phase-1-infrastructure.md`) está **~70% concluída**. O doc não reflete o estado real: uma verificação via `oci-cli` mostra que a VM Oracle **já está provisionada e rodando** (T1.4b aparece como bloqueado mas está feito — o "Out of capacity" foi superado).

Objetivo: fechar os itens restantes (Security List, Coolify, DNS `api.`/`app.`, Cloudflare Pages, secrets), atualizar o doc de tracking, e commitar.

**Decisões já tomadas (não revalidar com o usuário):**
- SSH (porta 22): restringir a **IP fixo** (pegar o IP público atual do usuário).
- Mudanças em OCI: **oci-cli sempre que possível** (reproduzível, auditável).
- Let's Encrypt automático — não requer configuração manual de Origin CA.

---

## Estado real verificado (via oci-cli em 2026-04-22)

| Recurso | Estado | Detalhe |
|---|---|---|
| Tenancy / região | ✅ | `us-ashburn-1` (IAD) |
| VCN `condo-vote-vcn` | ✅ | `10.0.0.0/16` |
| Public subnet | ✅ | `10.0.0.0/24` |
| Private subnet | ✅ | `10.0.1.0/24` |
| VM `condo-vote-backend` | ✅ **RUNNING** | `VM.Standard.A1.Flex` 2 OCPU / 8 GB, AD-1, criada 2026-04-23 |
| IP público da VM | ✅ | **`129.159.191.85`** |
| IP privado | ✅ | `10.0.0.198` |
| Default Security List | ⚠️ | Só `22/tcp` (aberto a `0.0.0.0/0` — precisa travar) + ICMP. **Falta 80/443.** |
| Coolify instalado | ❌ | Pendente |
| DNS `api.condovote.com.br` | ❌ | Pendente (A → `129.159.191.85`, proxy ON) |
| DNS `app.condovote.com.br` | ❌ | Pendente (CNAME → pages.dev, proxy ON) |
| Cloudflare Pages project | ❌ | Pendente |
| Coolify ↔ GitHub App + backend app | ❌ | Pendente |
| Secrets injetados (Coolify + Pages) | ❌ | Pendente |

**OCIDs úteis (reuse nos comandos):**

```
TENANCY=ocid1.tenancy.oc1..aaaaaaaabi574nsmzdmfzj2czm5y6h6aldcv2wqyw3nhgakoebw6kfnpdlva
VCN=ocid1.vcn.oc1.iad.amaaaaaatm4cyfyahwlveek5eyy4q2l6v33mmsv7p73rsifbtcsknhs5b2yq
DEFAULT_SL=ocid1.securitylist.oc1.iad.aaaaaaaabyymkcwtvgggx4mu2u34rxorvvwjfeqedgbjsnximxtjtuupnyba
INSTANCE=ocid1.instance.oc1.iad.anuwcljttm4cyfyc5jkxmxuwzot3qhkp4muyjh2znzoqt5e5spimjjrk2lha
PUBLIC_SUBNET=ocid1.subnet.oc1.iad.aaaaaaaastxripjanm2p74susflnuqfgyjtateftiq45246qee32sycmwvnq
VM_IP=129.159.191.85
```

---

## Regras para o Sonnet 4.6 executar

- **Ordem:** T1 é bloqueante. T2, T3, T5 podem rodar em paralelo após T1. T4 depende de T3. T6 depende de T5+T2. T7 depende de T6+T3. T8 e T9 são finalização.
- **Nada de deploy de código** nesta fase — só infra. Se Coolify pedir para fazer build, cancelar.
- **Nunca commitar valores de secrets**. `.env.local` é gitignored; os valores vão direto nos dashboards.
- **Validação obrigatória** ao final de cada task antes de ir para a próxima.
- **Parar e perguntar** ao usuário se: um comando OCI retornar erro inesperado, o IP do usuário mudar, ou um passo de dashboard pedir uma decisão não coberta aqui.

---

## T1 — Atualizar Security List via oci-cli (BLOQUEANTE)

Abrir 80/443 e travar 22 no IP pessoal do usuário.

1. **Peça ao usuário o IP público dele**: "Rode `curl -s ifconfig.me` e me passe o IP." (Não inferir — IP de ISP muda.)
2. **Criar diretório e arquivo versionável**:
   ```bash
   mkdir -p infra/oci
   ```
3. **Gerar `infra/oci/security-list-rules.json`** no formato do oci-cli. Substitua `<IP_USUARIO>` pelo IP que o usuário passar. Preservar a regra ICMP existente (type 3).
   ```json
   [
     {
       "protocol": "6",
       "source": "<IP_USUARIO>/32",
       "sourceType": "CIDR_BLOCK",
       "isStateless": false,
       "tcpOptions": { "destinationPortRange": { "min": 22, "max": 22 } }
     },
     {
       "protocol": "6",
       "source": "0.0.0.0/0",
       "sourceType": "CIDR_BLOCK",
       "isStateless": false,
       "tcpOptions": { "destinationPortRange": { "min": 80, "max": 80 } }
     },
     {
       "protocol": "6",
       "source": "0.0.0.0/0",
       "sourceType": "CIDR_BLOCK",
       "isStateless": false,
       "tcpOptions": { "destinationPortRange": { "min": 443, "max": 443 } }
     },
     {
       "protocol": "1",
       "source": "0.0.0.0/0",
       "sourceType": "CIDR_BLOCK",
       "isStateless": false,
       "icmpOptions": { "type": 3, "code": 4 }
     },
     {
       "protocol": "1",
       "source": "10.0.0.0/16",
       "sourceType": "CIDR_BLOCK",
       "isStateless": false,
       "icmpOptions": { "type": 3 }
     }
   ]
   ```
4. **Aplicar**:
   ```bash
   oci network security-list update \
     --security-list-id ocid1.securitylist.oc1.iad.aaaaaaaabyymkcwtvgggx4mu2u34rxorvvwjfeqedgbjsnximxtjtuupnyba \
     --ingress-security-rules file://infra/oci/security-list-rules.json \
     --force
   ```
5. **Validar**:
   ```bash
   oci network security-list get --security-list-id ocid1.securitylist.oc1.iad.aaaaaaaabyymkcwtvgggx4mu2u34rxorvvwjfeqedgbjsnximxtjtuupnyba --query 'data."ingress-security-rules"'
   ```
   Deve mostrar as 3 regras TCP (22 restrita, 80/443 abertas) + as 2 ICMP. Teste: `nc -zv 129.159.191.85 22` conecta do IP do usuário.

---

## T2 — Cloudflare DNS: record `api.` (paralelo)

Cloudflare dashboard → zona `condovote.com.br` → DNS → Add record:
- Type `A`, Name `api`, IPv4 `129.159.191.85`, Proxy **ON (laranja)**, TTL Auto.

Validar:
```bash
dig api.condovote.com.br +short
```
Retorna um IP proxied da Cloudflare (NÃO o `129.159...`). `curl -vI https://api.condovote.com.br` devolve 5xx/522 (ok — Coolify ainda não subiu).

---

## T3 — Cloudflare Pages project (paralelo)

Dashboard → Workers & Pages → Create application → Pages → Connect to Git:
- Repo: `condo-vote-app`, branch produção: `main`.
- Project name: `condo-vote-frontend`.
- Framework preset: **`None`** (Angular só na Fase 4 — `None` evita build quebrado).
- Build command: deixar **vazio**.
- Build output directory: `dist/frontend/browser` (placeholder).
- Root directory: `frontend/`.
- **Cancelar o primeiro deploy** se iniciar automaticamente.
- Anotar a URL `<projeto>.pages.dev` gerada (ex: `condo-vote-frontend.pages.dev`).

Validar: projeto aparece em Pages dashboard, sem deploy bem-sucedido (esperado).

---

## T4 — DNS `app.` + Custom Domain (depende de T3)

1. Dashboard Cloudflare → DNS → Add record:
   - Type `CNAME`, Name `app`, Target `<projeto>.pages.dev`, Proxy **ON**.
2. No projeto Pages → Custom domains → Add `app.condovote.com.br` → confirmar.

Validar:
```bash
dig app.condovote.com.br +short
```
Resolve. `https://app.condovote.com.br` retorna página default do Pages ("Nothing here yet").

---

## T5 — SSH hardening + instalar Coolify (depende de T1)

Executado via SSH na VM (chave `.pem` do Bitwarden). Peça o caminho da chave ao usuário.

1. Conectar:
   ```bash
   ssh -i <path-para-chave.pem> ubuntu@129.159.191.85
   ```
2. **Dentro da VM**, liberar firewall interno:
   ```bash
   sudo iptables -I INPUT 6 -p tcp -m multiport --dports 80,443,8000 -j ACCEPT
   sudo netfilter-persistent save
   ```
   Porta 8000 é temporária (acesso inicial ao Coolify; fechada no T6 passo 6).
3. Instalar fail2ban:
   ```bash
   sudo apt update && sudo apt upgrade -y && sudo apt install -y fail2ban
   sudo systemctl enable --now fail2ban
   ```
4. Instalar Coolify (≈5 min):
   ```bash
   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
   ```
5. Abrir `http://129.159.191.85:8000` no browser local → criar conta admin → **senha forte (usuário salva no Bitwarden)**.

Validar: Coolify dashboard abre e admin criado.

---

## T6 — Coolify: domínio + Let's Encrypt + GitHub App (depende de T5 + T2)

1. Coolify → Settings → Instance → definir URL pública do próprio Coolify: `https://coolify.condovote.com.br`.
   - Adicionar no Cloudflare um CNAME `coolify` → IP da VM, proxy **OFF** (necessário para Let's Encrypt HTTP-01).
2. Coolify → Sources → New GitHub App → autorizar **apenas no repo `condo-vote-app`**.
3. Coolify → Projects → New Project → Resource → Application:
   - Source: GitHub App (recém-criado).
   - Repo: `condo-vote-app`, branch `main`.
   - Build pack: `Dockerfile`.
   - Base directory: `backend/`.
   - Domain: `api.condovote.com.br` — Let's Encrypt é emitido automaticamente ao salvar.
4. **Não fazer deploy** (Dockerfile só chega na Fase 3). Só ter a app criada basta.
5. Remover a regra temporária da porta 8000:
   - Editar `infra/oci/security-list-rules.json` — remover qualquer referência a 8000 (se foi adicionada) — e reaplicar o update.
   - Na VM: `sudo iptables -D INPUT -p tcp --dport 8000 -j ACCEPT && sudo netfilter-persistent save`.

Validar: aplicação listada em Coolify com status "never deployed"; Let's Encrypt emitindo; `http://129.159.191.85:8000` não responde mais externamente.

---

## T7 — Injetar secrets em Coolify e Pages (depende de T6 + T3)

Os valores reais vêm do Bitwarden e dos dashboards dos provedores (Supabase/Upstash/Resend). Peça ao usuário para puxar — não tentar buscar valores reais automaticamente.

1. **Coolify → Application → Environment** (backend — referência: `.env.example`):
   - `DATABASE_URL`
   - `SUPABASE_URL`
   - `SUPABASE_JWT_SECRET`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `REDIS_URL`
   - `RESEND_API_KEY`
   - `RESEND_FROM_ADDRESS`
   - `CPF_ENCRYPTION_KEY`
   - `CORS_ALLOWED_ORIGINS=https://app.condovote.com.br`

   Marcar todas como "Build-time secret" (ou equivalente).

2. **Cloudflare Pages → Project → Settings → Environment variables** (Production):
   - `NG_APP_SUPABASE_URL`
   - `NG_APP_SUPABASE_ANON_KEY`
   - `NG_APP_API_URL=https://api.condovote.com.br`

Validar: em ambos dashboards, "View variables" lista os nomes esperados com valores mascarados.

---

## T8 — Atualizar `phase-1-infrastructure.md`

No arquivo `docs/implementation/tasks/phase-1-infrastructure.md`:

- Marcar `[x]` em TODOS os itens de: T1.4b (incluindo IP `129.159.191.85`), T1.4c, T1.4d, T1.4f, T1.4h, T1.4i, e o último item de T1.6 (injeção em Coolify + Pages).
- **Remover** o bloco `⚠️ "Out of capacity"` do T1.4b (resolvido).
- Acrescentar nota ao final do arquivo:
  > **IP público da VM:** `129.159.191.85`
  > **Security List versionada em:** `infra/oci/security-list-rules.json`

Validar:
```bash
grep -c '\[ \]' docs/implementation/tasks/phase-1-infrastructure.md
```
Deve retornar `0`.

---

## T9 — Commit final + remoção deste plano

1. **Apagar este arquivo:**
   ```bash
   rm docs/implementation/tasks/phase-1-finalization-plan.md
   ```
2. Commit único na branch `develop` (GitFlow do projeto):
   ```bash
   git add docs/implementation/tasks/phase-1-infrastructure.md infra/oci/security-list-rules.json
   git rm docs/implementation/tasks/phase-1-finalization-plan.md
   git commit -m "feat(fase-1): finaliza infraestrutura — Coolify + DNS + secrets"
   ```
   (Não fazer push sem confirmação do usuário.)

---

## Verificação end-to-end (após T1–T9)

1. `oci network security-list get ...` mostra as 3 regras ingress TCP corretas (22 restrita ao IP do usuário, 80/443 abertas).
2. `ssh -i key.pem ubuntu@129.159.191.85` conecta do IP do usuário; falha de outras redes.
3. `https://api.condovote.com.br` responde 5xx/522 via Cloudflare (esperado — backend não deployed). Certificado TLS válido.
4. `https://app.condovote.com.br` retorna página default do Pages.
5. `https://condovote.com.br` e `https://www.condovote.com.br` retornam 301 → `app.condovote.com.br`.
6. Coolify dashboard em `https://coolify.condovote.com.br` lista 1 application (backend) e 0 deploys.
7. `grep -c '\[ \]' docs/implementation/tasks/phase-1-infrastructure.md` = `0`.
8. `ls docs/implementation/tasks/phase-1-finalization-plan.md` retorna "No such file".
