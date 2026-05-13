# H3 — Síndico convida morador por e-mail

> Status: **milestone funcional alcançado** — síndico cria convite e e-mail chega na inbox do destinatário via Resend.
> Spec completa: [`docs/implementation/tasks/phase-7/h3-convite-morador.md`](../implementation/tasks/phase-7/h3-convite-morador.md).

## ✅ Validado em smoke test local

- Síndico autenticado cria convite individual via UI (`POST /api/condominiums/{id}/invitations`) → 201, registro `invitation` PENDING criado.
- Outbox `email_notification` PENDING criada na mesma transação, token gravado no Redis com TTL 24h.
- `EmailSenderJob` (a cada 30s) consome a outbox e chama o gateway.
- `ResendEmailGateway` envia via HTTP API do Resend (perfil local com `APP_EMAIL_PROVIDER=resend`).
- Resend retorna 2xx, `email_notification.status` vai para `SENT`, `sent_at` preenchido.
- Painel Resend confirma `Delivered` (SMTP 250 OK do Gmail).
- E-mail chega na inbox do destinatário com link `http://localhost:4200/invitations/<token>` bem montado.

## ❌ Falta testar (antes de considerar 100% pronta)

### Caminhos de erro do endpoint REST
- [ ] **409** ao criar convite duplicado (mesma combinação `condominium + apartment + email + role` em PENDING).
- [ ] **404** quando `apartmentId` não pertence ao tenant (RLS isola).
- [ ] **403** quando usuário autenticado não é síndico do condomínio.
- [ ] **422** no bulk com pelo menos 1 linha inválida (CPF/role/apto) — ACID, nenhum convite persistido.
- [ ] **400** no bulk com mais de 200 entradas.

### Fluxos secundários
- [ ] Listar convites do condomínio (`GET /api/condominiums/{id}/invitations`) + filtros `?status=` e `?apartmentId=`.
- [ ] **Reenviar** convite (`POST /api/invitations/{id}/resend`) — revoga o anterior, cria novo com mesmo apt/email/cpf/role, novo token Redis, nova `email_notification`.
- [ ] **Revogar** (`POST /api/invitations/{id}/revoke`) — status `REVOKED`, chave Redis removida, audit `INVITATION_REVOKED`.
- [ ] **Corrigir e-mail** em convite BOUNCED (`POST /api/invitations/{id}/fix-email`).
- [ ] Bulk via XLSX completo — upload, preview, submit.

### Jobs
- [ ] `InvitationExpirerJob` (1h) move PENDING expirados → EXPIRED. Idempotente.
- [ ] Hard bounce na resposta da Resend → `email_notification.status=BOUNCED` E `invitation.status=BOUNCED`. **Atenção:** ver bug abaixo.

### Frontend
- [ ] Linha `BOUNCED` mostra badge vermelho + ação "Corrigir e-mail".
- [ ] Wizard XLSX Step 2 mostra erros inline e só habilita "Enviar" com 100% válido.

## 🐛 Bugs conhecidos (não-bloqueantes para o smoke, mas pendentes)

1. **Template `invitation.html` mostra `apartmentId` (UUID)** em vez do label do apartamento (ex: "101 - Bloco A"). Service precisa carregar o `apartment` e passar `apartment.label` ao renderer.
2. **`expiresAt` no e-mail aparece em ISO 8601 cru** (`2026-05-14T00:50:21.798091554Z`). Devia ser formatado para PT-BR (ex: `14/05/2026 às 21:50`).
3. **`ResendEmailGateway.isHardBounceFromBody` não classifica `validation_error`.** O regex procura `invalid_email` ou `validation_failed`, mas Resend (trial e prod) retorna `name: "validation_error"`. Resultado: destinatário inválido vai para `FAILED` (3 retries) em vez de `BOUNCED` direto, e o fluxo "Corrigir e-mail" (que exige status BOUNCED) nunca dispara. Ajustar para também aceitar `validation_error`.

## 🚧 Pré-requisitos para teste em produção

### Histórias dependentes
- **H4** (validar token + tela pública de aceite + `/register/complete`) — **bloqueador conceitual**. Sem H4, o link no e-mail leva a uma rota inexistente; em prod isso vira "convite chegou mas não consigo aceitar". Mínimo para prod: ao menos um placeholder em `/invitations/:token` informando "Em breve" — caso contrário o usuário cai na landing sem feedback.

### Setup Resend de produção
- [ ] Verificar domínio próprio em https://resend.com/domains (passos no [`docs/runbooks/resend-dns-setup.md`](../runbooks/resend-dns-setup.md)). Sem isso, conta trial só envia para o e-mail dono da conta Resend.
- [ ] Atualizar `EMAIL_FROM` para `noreply@<dominio-verificado>` (em vez de `onboarding@resend.dev`).

### Vars no Coolify
- [ ] `APP_EMAIL_PROVIDER=resend`
- [ ] `RESEND_API_KEY` (secret)
- [ ] `APP_EMAIL_FROM=noreply@<dominio-verificado>`
- [ ] `APP_EMAIL_ACCEPT_BASE_URL=https://<frontend-prod-url>`

### DoD do H3 (do `phase-7/h3-convite-morador.md`)
- [ ] `./mvnw verify` verde (cobertura ≥ 70% nos arquivos novos)
- [ ] Quality gates: Spotless, JaCoCo, PMD CPD, ESLint, jscpd, sonarjs
- [ ] Lint/test do frontend (`npm run lint && npm run test:ci`)
- [ ] `docs/STATUS.md` atualizado com H3 ✅ + descobertas não-óbvias (ver abaixo)
- [ ] Apêndice em `docs/implementation/tasks/phase-7/index.md` marcado para F2/F3/F4 parciais
- [ ] PR aberto contra `develop`

## 📝 Descobertas não-óbvias durante o smoke

- **`EMAIL_PROVIDER` sem prefixo `APP_` não bate via relaxed binding.** O env `EMAIL_PROVIDER=resend` no compose **não sobrescreve** `app.email.provider: smtp` do `application-local.yaml` (relaxed binding mapeia `EMAIL_PROVIDER` → `email.provider`, não `app.email.provider`). Solução: usar `APP_EMAIL_PROVIDER` no compose. Mesmo padrão para `APP_EMAIL_FROM`, `APP_EMAIL_ACCEPT_BASE_URL`.
- **Spring Boot 4.0.6 não auto-configura `WebClient.Builder`** em apps MVC. Foi necessário criar `WebClientConfig.java` em `com.condovote.shared.email/` com `@Bean WebClient.Builder` para o `ResendEmailGateway` startar.
- **Gmail filtra `onboarding@resend.dev`** em conta trial. O e-mail chega (`Delivered` no painel + `250 OK` no SMTP response) mas pode cair em Promoções/Spam ou ser silenciado. Mitigação: verificar domínio próprio assim que possível.
- **`.env` na raiz é lido automaticamente pelo Docker Compose** para resolver `${RESEND_API_KEY}` no yaml. Não precisa exportar no shell.
