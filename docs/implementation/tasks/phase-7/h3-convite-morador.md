# H3 — Síndico convida morador por e-mail

## História

Como **síndico**, quero **convidar um morador (proprietário ou inquilino) para um apartamento informando e-mail + CPF + papel**, para que **a pessoa receba um link por e-mail que lhe permita aceitar e completar o cadastro (H4) com validação anti-fraude**.

## Motivação / contexto de produto

Sem convite, não há onboarding de morador no piloto — e sem morador cadastrado, não há votação (H7/H8) nem listagem de residentes (H5). H3 materializa a regra-chave da spec ([`docs/condo-vote-principles.md`](../../../condo-vote-principles.md) §4 "Convites de moradores"): _onboarding é nominal_ — síndico autoriza a entrada de cada e-mail+CPF para um apartamento específico, e o aceite (H4) confirma que quem está digitando é quem foi autorizado.

Tabelas afetadas (já existem em V6/V8): `invitation`, `email_notification`. Enum `invitation_status` em V1 cobre os estados PENDING/ACCEPTED/REVOKED/EXPIRED/BOUNCED.

**Invariantes tocadas** (vide [`CLAUDE.md`](../../../../CLAUDE.md) §Invariantes):

- **Multi-tenant via RLS** — todas as queries de convite rodam dentro de `@Transactional` com `TenantTransactionAspect` setando `app.current_tenant`.
- **CPF criptografado** — usa `CpfEncryptor` (AES-256-SIV determinístico, já implementado na Fase 6) para popular `invitation.cpf_encrypted`.
- **Token efêmero em Redis** — token de aceite é UUID v4 que vive em `invitation:token:{token}` com TTL 24h. Não é persistido em PG.
- **Single-use** — token é deletado do Redis no aceite (H4) ou na revogação/reenvio.

## Critérios de aceitação

### Criar convite individual
- [ ] **Dado** síndico autenticado com tenant ativo **quando** chama `POST /api/condominiums/{id}/invitations` com `{ email, cpf, apartmentId, role }` válidos **então** retorna 201 + corpo com `id`, `status=PENDING`, `expiresAt = now()+24h`.
- [ ] **Dado** convite criado **então** `email_notification(type=INVITATION, status=PENDING)` foi inserido na mesma transação E `audit_event(INVITATION_SENT)` foi publicado E chave `invitation:token:{token}` foi setada no Redis com TTL 24h.
- [ ] **Dado** já existe convite PENDING para mesma combinação `(condominium, apartment, email, role)` **quando** tenta criar novo **então** retorna 409 com mensagem clara (UNIQUE index).
- [ ] **Dado** `apartmentId` não pertence ao tenant **quando** tenta criar **então** retorna 404 (RLS isola).
- [ ] **Dado** usuário não-síndico **quando** chama qualquer endpoint **então** retorna 403.

### Bulk via XLSX
- [ ] **Dado** lista com N convites todos válidos **quando** chama `POST /api/condominiums/{id}/invitations/bulk` **então** retorna 201 com array de `N` convites criados, todos PENDING.
- [ ] **Dado** lista com 1 linha inválida (apto não existe / CPF inválido / role inválido) **quando** chama bulk **então** retorna 422 com lista de erros por índice E nenhum convite foi persistido (ACID — tudo ou nada).
- [ ] **Dado** lista com mais de 200 entradas **quando** chama bulk **então** retorna 400.

### Listar / filtrar
- [ ] **Dado** síndico chama `GET /api/condominiums/{id}/invitations` **então** retorna 200 com convites do condomínio ordenados por `created_at DESC`.
- [ ] **Dado** query string `?status=PENDING` ou `?apartmentId=<uuid>` **então** filtra resultado.

### Reenviar / Revogar / Corrigir e-mail
- [ ] **Dado** convite PENDING ou EXPIRED **quando** chama `POST /api/invitations/{id}/resend` **então** convite anterior fica REVOKED, novo convite criado com mesmo apt/email/cpf/role, novo token Redis, nova `email_notification`.
- [ ] **Dado** convite PENDING **quando** chama `POST /api/invitations/{id}/revoke` **então** status → REVOKED, chave Redis removida, audit `INVITATION_REVOKED`.
- [ ] **Dado** convite BOUNCED **quando** chama `POST /api/invitations/{id}/fix-email` com `{ newEmail }` **então** revoga atual e cria novo convite com mesmo apt/cpf/role mas novo e-mail.

### Envio assíncrono
- [ ] **Dado** `email_notification` PENDING **quando** `EmailSenderJob` roda **então** chama `EmailGateway`, marca `SENT` em sucesso ou incrementa `attempts` + agenda retry em falha.
- [ ] **Dado** envio retorna bounce hard **então** `email_notification.status=BOUNCED` E `invitation.status=BOUNCED` na mesma transação.
- [ ] **Dado** dev local **quando** convite criado **então** e-mail aparece no Mailpit UI (`http://localhost:8025`) renderizado pelo template Thymeleaf.

### Expiração automática
- [ ] **Dado** convite PENDING com `expires_at < now()` **quando** `InvitationExpirerJob` roda (cada 1h) **então** status → EXPIRED. Idempotente.

### Frontend
- [ ] Síndico navega para `/condominiums/:id/invitations` e vê lista + filtros + botões "Convite individual" e "Importar planilha".
- [ ] Form individual valida e-mail, CPF (11 dígitos), apto (select carregado da API de apartments) e papel; submit cria convite e toast confirma.
- [ ] Wizard XLSX: Step 1 baixa template + faz upload; Step 2 mostra preview editável com erros inline; botão "Enviar" só habilita quando 100% válido.
- [ ] Linha BOUNCED tem badge vermelho + ação "Corrigir e-mail" abrindo modal.

## Escopo técnico

### Backend (novos arquivos)

**Domínio `com.condovote.invitation`:**
- `Invitation.java` — record `@Table("invitation")` com todos os campos de V6.
- `InvitationRepository.java` — `CrudRepository<Invitation, UUID>` + queries de listagem e expirer.
- `InvitationService.java` — `create`, `createBulk` (ACID), `resend`, `revoke`, `fixEmail`, `listByCondominium`. Role check via `MembershipRepository.isAdminOfTenant`. Transactional outbox + Redis SET + audit.
- `InvitationController.java` — endpoints REST.
- `dto/CreateInvitationRequest.java`, `dto/BulkCreateInvitationRequest.java`, `dto/InvitationResponse.java`, `dto/BulkResultResponse.java`, `dto/FixEmailRequest.java`.

**Infra `com.condovote.shared.email`:**
- `EmailGateway.java` — interface `void send(EmailMessage msg) throws EmailDeliveryException`.
- `EmailMessage.java` — record com `to`, `subject`, `htmlBody`, `textBody`.
- `EmailDeliveryException.java` — com flag `isHardBounce`.
- `MailpitEmailGateway.java` — `@Profile("!prod")`, via `JavaMailSender`.
- `ResendEmailGateway.java` — `@Profile("prod")`, via `WebClient` para Resend API.
- `EmailTemplateRenderer.java` — wrapper Thymeleaf `TemplateEngine` para renderizar templates classpath.

**Jobs `com.condovote.shared.scheduling`:**
- `EmailSenderJob.java` — `@Scheduled(fixedDelay = 30s)`. Lê PENDING ordenado por `idx_email_pending_fifo`, processa até 50, atualiza status + backoff.
- `InvitationExpirerJob.java` — `@Scheduled(fixedDelay = 1h)`. UPDATE PENDING expirado → EXPIRED.

**Templates `backend/src/main/resources/templates/email/`:**
- `invitation.html` — HTML completo do convite (header, CTA, footer 24h).

**Configs:**
- `application.yaml` — `app.email.from`, `app.email.provider`, `app.email.accept-base-url`, `app.invitation.token-ttl-hours: 24`.
- `application-local.yaml` — `spring.mail.host: localhost`, `port: 1025`.
- `application-prod.yaml` — `app.email.resend-api-key: ${RESEND_API_KEY}`.

**Migration:** **nenhuma nova prevista**. Se T3.0 (audit) identificar gap, criar `V12__h3_indices.sql`.

### Frontend (novos arquivos)

```
features/invitations/
  invitations-page.ts / .html / .scss          (smart, rota /condominiums/:id/invitations)
  invitation-list.ts                            (dumb, lista + filtros + menu por linha)
  invitation-individual-form.ts                 (dumb, modal/drawer)
  invitation-fix-email-form.ts                  (dumb, modal corrigir e-mail BOUNCED)
  invitation-bulk/
    invitation-bulk-page.ts                     (smart, wizard 2 steps)
    invitation-bulk-upload-form.ts              (Step 1)
    invitation-bulk-preview-grid.ts             (Step 2)
core/api/invitations-api.service.ts             (HttpClient wrapper)
```

**Asset estático:** `frontend/src/assets/templates/convites-template.xlsx` (versionado).

**Rota:** adicionar `/condominiums/:id/invitations` em `app.routes.ts`. Link no header condicional a `tenantService.activeRoles().has('MANAGER')`.

### Banco

Tabelas `invitation` (V6) e `email_notification` (V8) já existem. Índices de RLS e FIFO já presentes. Audit `INVITATION_SENT` / `INVITATION_REVOKED` / `INVITATION_ACCEPTED` via `AuditEventPublisher`.

### Cobertura técnica F1–F8 consumida

- **F2** (Invitations + Redis token + `/register/complete`) — H3 cobre criar/listar/expirar/revogar/reenviar/fix-email. `/register/complete` fica em H4.
- **F3** (Email outbox + EmailSender + 7 templates) — H3 cobre outbox completo + EmailSender (Mailpit/Resend) + template `invitation.html`. Demais templates ficam para suas histórias.
- **F4** (Jobs) — H3 cobre `InvitationExpirerJob` + `EmailSenderJob`.
- **F8** (Rate limit Bucket4j) — **adiado para H4** (endpoints públicos `/invitations/validate` e `/register/complete` é onde faz mais sentido). Endpoints de H3 são todos autenticados.

## Fora de escopo (explícito)

- Validar token + completar cadastro do morador (`/api/invitations/validate` + `/api/register/complete`) — H4.
- Página pública `/invitations/:token` no frontend (aceitar convite) — H4.
- Lógica especial quando e-mail já é `app_user` existente (template diferente "você já tem conta") — v2.
- Rate-limit Bucket4j — H4.
- Bounce soft retry sofisticado — v1 usa backoff fixo (1m → 5m → 30m → FAILED).
- Web hook do Resend para bounce assíncrono — v2. V1 captura bounce via resposta da API HTTP.
- `RetentionPrunerJob` para limpar `email_notification` SENT > 90 dias — H10 (placeholder).
- Convite por SMS/WhatsApp — fora do piloto.

## Tasks

- [ ] **T3.17** — Criar este arquivo (Fase 1 do workflow)
- [ ] **T3.0** — Audit de coerência (Fase 2) — subagent Plan
- [ ] **T3.1** — Infra: container Mailpit + deps Mail/Resend no pom + configs YAML + `.env.example`
- [ ] **T3.2** — `EmailGateway` interface + `MailpitEmailGateway` + UT
- [ ] **T3.3** — `ResendEmailGateway` (`@Profile("prod")`) + UT com `MockWebServer`
- [ ] **T3.4** — Template Thymeleaf `templates/email/invitation.html` + `EmailTemplateRenderer` + UT snapshot
- [ ] **T3.5** — Aggregate `Invitation` + Repository + DTOs
- [ ] **T3.6** — `InvitationService` (create + createBulk + resend + revoke + fixEmail + list) + UT cobrindo todos os caminhos
- [ ] **T3.7** — `InvitationController` + ITs cobrindo 201/409/422/200/403
- [ ] **T3.8** — `EmailSenderJob` (`@Scheduled` 30s) + UT + IT com container Mailpit
- [ ] **T3.9** — `InvitationExpirerJob` (`@Scheduled` 1h) + UT + IT
- [ ] **T3.10** — Frontend: API service + página + lista + form individual + rota + link header
- [ ] **T3.11** — Frontend: wizard bulk XLSX (Step 1 upload + Step 2 preview) + asset estático
- [ ] **T3.12** — Vitest: api.service.spec + page.spec + bulk-page.spec
- [ ] **T3.13** — Quality gates locais verdes (`./mvnw verify` + `npm run lint && npm run test:ci`)
- [ ] **T3.14** — Smoke test local (Mailpit + criar/bulk/reenviar/revogar)
- [ ] **T3.15** — Runbook `docs/runbooks/resend-dns-setup.md`
- [ ] **T3.16** — Atualizar `docs/STATUS.md` + `phase-7/index.md`
- [ ] **T3.18** — PR `feat/h3-convite-morador → develop` via `gh pr create`

## Definition of Done

- [ ] Todos os critérios de aceitação verdes em IT (Testcontainers PG + Mailpit)
- [ ] UT cobrindo regras de negócio dos services e jobs
- [ ] Cobertura ≥ 70% nos arquivos alterados (`./mvnw verify`)
- [ ] Quality gates verdes: Spotless, JaCoCo, PMD CPD, ESLint, jscpd, sonarjs
- [ ] Lint e tipos do frontend verdes (`npm run lint && npm run test:ci`)
- [ ] Smoke test manual local com Mailpit (cenário individual + bulk + reenviar)
- [ ] `docs/STATUS.md` atualizado no mesmo PR (H3 ✅ + descobertas não-óbvias)
- [ ] Apêndice em [`index.md`](index.md) marcado com ✅ nas linhas F2 (parte) + F3 (parte) + F4 (parte)
- [ ] Runbook Resend DNS criado para o usuário configurar domínio próprio antes do deploy de prod
- [ ] PR aberto contra `develop` via `gh pr create`

## Notas para o implementer

1. **Ler PRIMEIRO**: `CLAUDE.md` §Invariantes, `docs/coding-patterns.md`, `docs/data-model.md` §Invitation §Email, código de `ApartmentService`/`ApartmentController`/`ApartmentControllerIT` como referência de padrão.
2. **TDD**: UT antes da implementação; IT cobre o caminho REST + multi-tenant + outbox.
3. **`context7`** (MCP) ao tocar Spring Mail, Thymeleaf, Lettuce/Redis, Spring Data JDBC, Spring Scheduling, Resend HTTP API, biblioteca XLSX do frontend.
4. **Multi-tenant**: toda query roda em `@Transactional` com `TenantTransactionAspect`. CPF criptografado via `CpfEncryptor` (já existe).
5. **Token gerado server-side** (UUID v4) — nunca aceito do cliente; única persistência é Redis `invitation:token:{token}` com TTL 24h.
6. **Outbox atômico**: `INSERT invitation` + `INSERT email_notification` + Redis SET + `AuditEventPublisher.publish` na mesma transação. Se Redis falhar → fail-fast e rollback (configurar `RedisTemplate` para propagar exceção).
7. **Commit em PT, imperativo curto. Sem `Co-Authored-By`.**
8. PR alvo `develop` via `gh pr create --base develop`.
