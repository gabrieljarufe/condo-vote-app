# H3 — Audit de coerência (T3.0)

> Saída do Plan agent rodando em Sonnet. Cada item virou ou uma absorção em task existente, ou ficou registrado para o implementer consultar.

## Resumo das ações

| # | Tipo | Severidade | Onde resolve | Notas |
|---|---|---|---|---|
| B1 | Backend dep | BLOQUEADOR | T3.1 | adicionar `spring-boot-starter-mail` ao `pom.xml` |
| B2 | Backend | BLOQUEADOR | T3.5 (sub-task 0) | criar `EmailNotification` record + `EmailNotificationRepository` em `com.condovote.shared.notification` antes do Invitation aggregate |
| B3/R1 | Refactor | BLOQUEADOR | T3.5 (sub-task 1) | `CpfEncryptor.encrypt()` retorna String hex, mas `invitation.cpf_encrypted` é BYTEA. **Não criar H3.0** — adicionar métodos paralelos `encryptToBytes(): byte[]` e `decryptFromBytes(byte[]): String` no `CpfEncryptor` sem mexer no `encrypt()/decrypt()` existentes (preserva `CpfEncryptorCli` e scripts). UT cobrir os dois caminhos. Spring Data JDBC mapeia `byte[]` ↔ BYTEA automaticamente. Aggregate `Invitation` usa `byte[] cpfEncrypted`. |
| B4 | Backend | BLOQUEADOR | T3.9 | criar `InvitationExpirerJob` com `@Scheduled(fixedDelay=1h)` |
| B5 | Backend | ATENÇÃO | T3.9 | usar overload explícito de `AuditEventPublisher.publish(...tenantId, actorUserId)` no job (não tem TenantContext setado) |
| B6 | Backend | NICE | T3.8 | `email_notification` não tem RLS por design — job de envio NÃO deve setar tenant. Comentário no código. |
| B7 / RLS2 | Backend | ATENÇÃO | T3.6 | endpoints `resend`/`revoke`/`fix-email` recebem só `invitation.id`. RLS filtra, mas resposta seria 404 em vez de 403 se `X-Tenant-Id` divergir. Service: após `findById`, validar `invitation.condominiumId == TenantContext.get()` e lançar `ForbiddenException` se divergir. |
| F1 | Frontend | BLOQUEADOR | T3.10 | adicionar rota `/condominiums/:id/invitations` em `home.routes.ts` |
| F2 | Frontend dep | BLOQUEADOR | T3.1 + T3.11 | **nenhuma lib XLSX no `package.json`** — escolher `read-excel-file` (2 kB gzipped, zero deps) em T3.1. Bulk H2 não usa lib porque gera padrão numérico em memória; H3 é o primeiro caso de upload real. Registrar em `STATUS.md` como descoberta não-óbvia. |
| F3 / S1 | Frontend | ATENÇÃO | T3.10 | aplicar `tenantRestoreGuard` (já existe nas rotas de apartments) na rota de invitations |
| CR4 | Ops | ATENÇÃO | T3.15 | runbook documenta que `CPF_ENCRYPTION_KEY` deve ser a mesma em staging e prod se houver migração de dados — convite criado em staging não valida em H4 prod se chaves divergirem |
| DB1 | Banco | OK | — | Todos os índices, enums, FKs, RLS policies já cobrem 100% das queries previstas. **Nenhuma migration nova é necessária.** UNIQUE parcial `uq_invitation_pending`, `idx_email_pending_fifo`, `idx_invitation_pending_expiring` existem. |

## Verificações de schema realizadas (todas ✅)

- UNIQUE `(condominium_id, apartment_id, email, role) WHERE status='PENDING'` — `V6:26-28`
- `idx_email_pending_fifo` em `(scheduled_for, created_at) WHERE status='PENDING'` — `V8:41-44`
- Enum `invitation_status` inclui `BOUNCED` — `V1:52`
- Enum `email_type` inclui `INVITATION` — `V1:77`
- `cpf_encrypted` é `BYTEA` em `invitation` (`V6:7`) e `app_user` (`V3:7`)
- RLS policy `tenant_isolation` em `invitation` — `V9:63-65`
- FK composta `(apartment_id, condominium_id)` — `V10:11-13`
- Índice para `InvitationExpirerJob` — `idx_invitation_pending_expiring` `V6:33-36`

## Decisão sobre H3.0

**Não criar H3.0 separado.** O único refactor "estrutural" identificado (CpfEncryptor) é resolvível com 2 métodos adicionais paralelos, sem migration de dados nem mudança breaking. Absorvido em T3.5.
