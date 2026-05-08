# Fase 6 — Observabilidade Mínima e Runbook de Bootstrap

**Objetivo:** dá para diagnosticar problemas em prod e onboardar o primeiro condomínio antes de começar a escrever features de domínio.

**Pré-requisitos:** Fase 5 (CI/CD funcionando).

---

## T6.1 — Logging JSON estruturado

### T6.1a — Spring Boot ECS structured logging + pattern local
- [x] `backend/src/main/resources/application.yaml`: `logging.structured.format.console: ecs` (Spring Boot 4 nativo — sem `logstash-logback-encoder`)
- [x] `backend/src/main/resources/logback-spring.xml`:
  - [x] Profile `prod`: bloco vazio — Spring Boot gerencia o appender ECS automaticamente
  - [x] Profile `local`: pattern humano legível colorido
  - [x] Fallback (sem perfil): pattern plain para testes

### T6.1b — SensitiveDataMaskingCustomizer + teste
- [x] `SensitiveDataMaskingCustomizer` implementa `StructuredLoggingJsonMembersCustomizer<ILoggingEvent>` (Spring Boot 4 API — não é Logback custom converter): CPF formatado → mascara primeiros 6 dígitos; Bearer token → `Bearer ***`; JWT → `eyJ***`; Supabase keys → primeiros 6 + `***`; MDC paths sensíveis (`cpf`, `password`, `token`, `authorization`, `secret`, `key`) → `[REDACTED]`
- [x] Teste dedicado: dado log com CPF, output não contém CPF em claro

### T6.1c — MDC integration
- [x] `TenantInterceptor` adiciona `tenant_id`, `user_id`, `request_id` (X-Request-Id ou UUID gerado) em MDC; limpa no `afterCompletion`
- [x] Logs estruturados em prod incluem estes campos

**Aceite:** log em prod chega no Coolify dashboard como JSON; campo CPF nunca aparece em claro; `tenant_id` e `request_id` presentes em todos os logs de request.

---

## T6.2 — Actuator + monitor externo
- [x] `application.yaml`: expor `health`, `info`, `metrics` (já incluso por padrão) — mais nada
- [x] `management.endpoint.health.show-details=when-authorized` + basic auth com credencial em env var
- [x] `info`: adicionar `git-commit`, `build-time` via `build-info` do Spring Boot Maven Plugin
- [x] Health probes: liveness (sem DB, apenas `livenessState`) + readiness (com `db` + `redis`)
- [x] `git-commit-id-maven-plugin` 9.0.1: branch, commit hash abreviado, timestamp, dirty flag em `/actuator/info`
- [ ] Configurar **Better Stack** (free tier) monitorando `https://api.condovote.com.br/actuator/health/liveness` a cada 30s _(configuração manual no dashboard Better Stack — fora do repo)_
- [ ] Alert: e-mail quando status down _(configuração manual)_

**Aceite:** Better Stack mostra 100% uptime após 24h; alerta simulado (parando o container no Coolify) chega por e-mail.

---

## T6.3 — Runbook de bootstrap de condomínio (fluxo Flyway V1001+)

### T6.3a — Script `scripts/encrypt-cpf.sh`
- [x] Criar `scripts/encrypt-cpf.sh` como wrapper CLI em torno de `CpfEncryptorCli` (lê `CPF_ENCRYPTION_KEY` da env local; imprime ciphertext em hex para uso no SQL de bootstrap)
- [x] `CpfEncryptor.java` — AES-256-SIV com `org.cryptomator:siv-mode:1.6.0`
- [x] `CpfEncryptorCli.java` — main class standalone (sem Spring context)
- [x] `CpfEncryptorTest.java` — 7 cenários (encrypt/decrypt, determinismo, CPFs distintos, hex maiúsculo, nulo, ciphertext corrompido, chave inválida)

### T6.3 — Runbook
- [x] `docs/runbooks/bootstrap-condominio.md` com passo-a-passo conforme `docs/architecture.md §1`:
  - [x] Passo 1: criar user no Supabase Auth (Dashboard ou CLI). Copiar UUID gerado.
  - [x] Passo 2: gerar ciphertext do CPF com `scripts/encrypt-cpf.sh <cpf>` (lê `CPF_ENCRYPTION_KEY` do cofre)
  - [x] Passo 3: criar `backend/src/main/resources/db/migration/bootstrap/V1001__bootstrap_<condo>.sql` com template preenchido (INSERTs de `condominium`, `app_user`, `condominium_admin`, `audit_event`)
  - [x] Passo 4: PR `feature/bootstrap-<condo-slug>` → develop → main. CI valida migration; Flyway aplica em prod no redeploy.
  - [x] Passo 5: enviar credenciais ao síndico por canal seguro
- [x] `BootstrapTemplateIT` — valida o template SQL em transação com rollback via Testcontainers (2 cenários: SQL completo + compatibilidade hex↔BYTEA)

**Aceite:** operador segue o runbook; migration V1001+ aplica sem erro em local e prod; síndico loga, vê seu condomínio e chama endpoint autenticado.

---

## T6.3b — Runbook mensal: verificar Data API desabilitada

- [x] `docs/runbooks/data-api-monthly-check.md` — checklist + log de verificações + o que fazer se estiver habilitada

  Esta é uma fronteira de segurança crítica: `app_user`, `condominium`, `email_notification` e `poll_option` não têm RLS habilitada. Ativar a Data API sem antes revogar grants em `public.*` para `anon`/`authenticated`, ou sem adicionar RLS defensiva nessas 4 tabelas, expõe dados sem controle de acesso.

  Ver decisão completa em `docs/analysis/2026-04-27-supabase-linter-rls-warnings.md` e subseção "Por que algumas tabelas não têm RLS" em `docs/architecture.md §8`.

## T6.4 — Backup manual semanal Supabase
- [x] `docs/runbooks/backup-restore.md` — procedimento manual semanal (Dashboard + CLI), log de execuções, restore step-by-step, critérios de migração para Pro com PITR
- [ ] Primeiro backup manual executado com sucesso _(ação manual — fora do repo)_

**Aceite:** primeiro backup manual executado com sucesso.

---

## Verificação final (after-all-phases)
- [ ] Operador cria condomínio teste via runbook
- [ ] Síndico loga no frontend Cloudflare Pages (`https://app.condovote.com.br`)
- [ ] Frontend chama `/api/me/condominiums` → retorna condo
- [ ] Seleciona condo → headers `X-Tenant-Id` começam a ser enviados
- [ ] RLS isola corretamente (verificar com 2 condos distintos)
- [ ] JWT expirado → 401 estruturado
- [ ] Log estruturado com `request_id` aparece no Coolify (campo MDC — populado pelo `TenantInterceptor` em requests autenticadas com `X-Tenant-Id`)

Com todos os itens acima ✅, a plataforma está pronta para **Fase 7 — primeira feature de domínio** (Convites e Onboarding), que será planejada em seu próprio `tasks/` dedicado.
