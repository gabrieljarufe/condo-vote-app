# Resend — Verificação de domínio e configuração de produção

> Runbook para preparar o envio de e-mails de convite via Resend em produção.
> Pré-requisitos: conta Resend ativa + domínio próprio + acesso ao DNS do domínio (Cloudflare neste projeto).

## Visão geral

O backend usa duas implementações de `EmailGateway`:
- **Dev/test (perfil default):** SMTP via Inbucket (Supabase) ou GreenMail. Aceita qualquer remetente.
- **Produção (perfil `prod`, `app.email.provider=resend`):** HTTP POST para `api.resend.com/emails` — Resend só envia se o domínio do remetente estiver **verificado** (DNS configurado).

Este runbook cobre os passos pontuais para a primeira vez que o sistema for para prod.

---

## Passo 1 — Criar domínio no painel Resend

1. Login em https://resend.com/domains
2. Clicar em **"Add Domain"**
3. Inserir o domínio (ex: `condovote.com.br`) — Resend recomenda usar um subdomínio dedicado para e-mails transacionais (ex: `mail.condovote.com.br`); ambos funcionam.
4. Selecionar região (`us-east-1` é o default — alinhar com região do backend Oracle Cloud).
5. Após criar, Resend mostra registros DNS para adicionar: **MX**, **SPF (TXT)**, **DKIM (CNAME × 3)**, **Return-Path (CNAME)**.

> **Importante:** copie os valores **exatos** dos registros — Resend gera CNAMEs únicos por domínio.

---

## Passo 2 — Configurar DNS no Cloudflare

1. Login em https://dash.cloudflare.com
2. Selecionar o domínio (`condovote.com.br`)
3. **DNS → Records → Add record** para cada um dos registros do passo 1:
   - **MX** — Resend fornece o host (`feedback-smtp.us-east-1.amazonses.com` ou similar) e prioridade `10`.
   - **TXT (SPF)** — valor tipo `"v=spf1 include:amazonses.com ~all"`.
   - **CNAME (DKIM × 3)** — hosts tipo `<id1>._domainkey`, `<id2>._domainkey`, `<id3>._domainkey` apontando para `<id>.dkim.amazonses.com`.
   - **CNAME (Return-Path)** — host tipo `<id>.bounce` apontando para `feedback-smtp.us-east-1.amazonses.com`.

**Atenção Cloudflare:**
- Para os CNAMEs DKIM, **desative o proxy laranja** (Proxy status: DNS only / cinza). Resend valida o registro buscando direto no DNS — proxy quebra a validação.
- TTL pode ficar em "Auto".

4. Salvar cada registro.

---

## Passo 3 — Verificar no Resend

1. Voltar ao painel Resend → seu domínio → clicar **"Verify DNS Records"**.
2. Propagação DNS demora de minutos a até 24h (mas o Cloudflare costuma propagar em <5min). Aguarde até todos os 5 registros ficarem ✅ verdes.

Quando o status do domínio mudar para **"Verified"**, Resend pode enviar com `from: <qualquer>@condovote.com.br`.

---

## Passo 4 — Gerar API key

1. Resend → **API Keys** → **"Create API Key"**.
2. Nome: `condo-vote-prod` (ou similar).
3. Permission: **Sending access** (não Full access — princípio do menor privilégio).
4. Domain: selecione o domínio verificado.
5. **Copiar o token uma única vez** (Resend não mostra de novo) e armazenar no cofre pessoal (1Password/Bitwarden).

---

## Passo 5 — Configurar variáveis no Coolify (backend prod)

No painel Coolify do serviço `condo-vote-backend`, em **Environment Variables**, definir:

| Variável | Valor | Notas |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | `prod` | já deve estar |
| `EMAIL_PROVIDER` | `resend` | seleciona `ResendEmailGateway` |
| `RESEND_API_KEY` | `re_...` | token do Passo 4 — **secret** |
| `EMAIL_FROM` | `noreply@condovote.com.br` | qualquer endereço do domínio verificado |
| `EMAIL_ACCEPT_BASE_URL` | `https://condovote.com.br` | URL pública do frontend; usada na construção do link de aceite |
| `RESEND_API_URL` | `https://api.resend.com/emails` | default OK; só sobrescreva se sandbox |

Após salvar, fazer **redeploy** do backend. Verificar nos logs do container que o bean `ResendEmailGateway` foi instanciado (`@ConditionalOnProperty(name="app.email.provider", havingValue="resend")` deve registrar o bean em vez do `SmtpEmailGateway`).

---

## Passo 6 — Teste end-to-end

1. Logar como síndico (`bielonfire20@gmail.com` ou conta de teste).
2. Acessar `https://condovote.com.br/app/condominiums/<id>/invitations`.
3. Criar convite individual com **seu próprio e-mail** como destinatário.
4. Aguardar até 30 segundos (intervalo do `EmailSenderJob`).
5. Verificar inbox — e-mail deve chegar com remetente `noreply@condovote.com.br`.
6. Verificar headers do e-mail:
   - `DKIM-Signature: ... d=condovote.com.br ...` deve aparecer
   - `Authentication-Results: ... dkim=pass; spf=pass; dmarc=pass`

Se algum header falhar, voltar ao Passo 2 e revisar os registros DNS.

---

## Troubleshooting

**E-mail não chega:**
- Resend → **Logs** → procurar o `email_id` da tentativa. Status `bounced` → corrigir endereço; `failed` → erro de DNS/API.
- Logs do backend → `EmailSenderJob` deve logar tentativas. Se nenhum log aparecer, possível bug no scheduler (verifique `@EnableScheduling`).
- Spam folder do destinatário (especialmente Gmail/Outlook na primeira vez).

**DNS não verifica:**
- Confirmar que os CNAMEs DKIM estão **sem proxy** no Cloudflare.
- `dig <id>._domainkey.condovote.com.br CNAME` deve retornar o host do Resend.
- Aguardar até 24h em casos extremos (Cloudflare propaga em minutos; outros provedores podem demorar).

**Erro 401/403 da API Resend:**
- API key inválida ou revogada → gerar nova no painel.

---

## Notas sobre LGPD e retenção

- Resend armazena cópia do e-mail por 30 dias para troubleshooting (ver privacy policy).
- A tabela local `email_notification` deve ser purgada após 90 dias para SENT/BOUNCED (job `RetentionPrunerJob` em H10).
- Não inclua dados sensíveis (CPF em claro, senha) no `payload` do `email_notification`. H3 atual envia apenas e-mail, role, link com token, expiresAt — OK.

---

## Cross-environment: `CPF_ENCRYPTION_KEY`

**Importante:** a variável `CPF_ENCRYPTION_KEY` deve ser **a mesma** em todos os ambientes que recebem dados copiados de outro (ex: staging que recebe um dump de prod). Se as chaves divergirem, um convite criado em staging não passa na validação anti-fraude em prod (e vice-versa) — o CPF criptografado não decifra com a chave errada.

Para staging que NÃO recebe dump de prod: chave própria é OK e mais seguro.
