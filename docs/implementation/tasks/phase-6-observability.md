# Fase 6 — Observabilidade Mínima e Runbook de Bootstrap

**Objetivo:** dá para diagnosticar problemas em prod e onboardar o primeiro condomínio antes de começar a escrever features de domínio.

**Pré-requisitos:** Fase 5 (CI/CD funcionando).

---

## T6.1 — Logging JSON estruturado

### T6.1a — Logback JSON + pattern local
- [ ] Adicionar `logstash-logback-encoder` no `backend/pom.xml`
- [ ] `backend/src/main/resources/logback-spring.xml`:
  - [ ] Profile `prod`: appender console com `LogstashEncoder`, campos custom (`service=condovote-backend`, `environment`)
  - [ ] Profile `local`: pattern humano legível (texto colorido)

### T6.1b — SensitiveDataMaskingConverter + teste
- [ ] `SensitiveDataMaskingConverter` (Logback custom converter): `cpf` → mostra últimos 3 dígitos; `password`/`token`/`authorization` → vazio; `key`/`secret` → primeiros 6 chars + `...`
- [ ] Teste dedicado: dado log com CPF, output não contém CPF em claro

### T6.1c — MDC integration
- [ ] `TenantInterceptor` adiciona `tenant_id`, `user_id`, `request_id` (X-Request-Id ou UUID gerado) em MDC; limpa no `afterCompletion`
- [ ] Logs estruturados em prod incluem estes campos

**Aceite:** log em prod chega no Coolify dashboard como JSON; campo CPF nunca aparece em claro; `tenant_id` e `request_id` presentes em todos os logs de request.

---

## T6.2 — Actuator + monitor externo
- [ ] `application-prod.yml`: expor `health`, `info`, `metrics` (já incluso por padrão) — mais nada
- [ ] `management.endpoint.health.show-details=when-authorized` + basic auth com credencial em env var
- [ ] `info`: adicionar `git-commit`, `build-time` via `build-info` do Spring Boot Maven Plugin
- [ ] Configurar **UptimeRobot** (free tier) monitorando `https://api.condovote.com.br/actuator/health` a cada 5 min
- [ ] Alert: e-mail pessoal do dono quando status down por 2+ checks

**Aceite:** UptimeRobot mostra 100% uptime após 24h; alerta simulado (parando o container no Coolify) chega por e-mail.

---

## T6.3 — Runbook de bootstrap de condomínio (fluxo Flyway V1001+)

### T6.3a — Script `scripts/encrypt-cpf.sh`
- [ ] Criar `scripts/encrypt-cpf.sh` como wrapper CLI em torno de `CpfEncryptor` (ex: `java -cp backend/target/condo-vote-backend.jar com.condovote.shared.crypto.CpfEncryptorCli $1`). Lê `CPF_ENCRYPTION_KEY` da env local; imprime ciphertext em hex para uso no SQL de bootstrap. **Implementado apenas após T5.1 (backend buildável).**

### T6.3 — Runbook
- [ ] `docs/runbooks/bootstrap-condominio.md` com passo-a-passo conforme `docs/architecture.md §1`:
  - [ ] Passo 1: criar user no Supabase Auth (Dashboard ou CLI). Copiar UUID gerado.
  - [ ] Passo 2: gerar ciphertext do CPF com `scripts/encrypt-cpf.sh <cpf>` (lê `CPF_ENCRYPTION_KEY` do cofre)
  - [ ] Passo 3: criar `backend/src/main/resources/db/migration/bootstrap/V1001__bootstrap_<condo>.sql` com template preenchido (INSERTs de `condominium`, `app_user`, `condominium_admin`, `audit_event`)
  - [ ] Passo 4: PR `feature/bootstrap-<condo-slug>` → develop → main. CI valida migration; Flyway aplica em prod no redeploy.
  - [ ] Passo 5: enviar credenciais ao síndico por canal seguro
- [ ] Testar runbook executando contra Supabase local primeiro (CI Testcontainers)

**Aceite:** operador segue o runbook; migration V1001+ aplica sem erro em local e prod; síndico loga, vê seu condomínio e chama endpoint autenticado.

---

## T6.4 — Backup manual semanal Supabase
- [ ] Agendar backup manual semanal no Dashboard Supabase (Database → Backups → "Create backup") até migração para Supabase Pro (que tem PITR automático)
- [ ] Documentar procedimento em `docs/runbooks/backup-restore.md`

**Aceite:** primeiro backup manual executado com sucesso.

---

## Verificação final (after-all-phases)
- [ ] Operador cria condomínio teste via runbook
- [ ] Síndico loga no frontend Cloudflare Pages (`https://app.condovote.com.br`)
- [ ] Frontend chama `/api/me/condominiums` → retorna condo
- [ ] Seleciona condo → headers `X-Tenant-Id` começam a ser enviados
- [ ] RLS isola corretamente (verificar com 2 condos distintos)
- [ ] JWT expirado → 401 estruturado
- [ ] Log estruturado com `trace_id` aparece no Coolify

Com todos os itens acima ✅, a plataforma está pronta para **Fase 7 — primeira feature de domínio** (Convites e Onboarding), que será planejada em seu próprio `tasks/` dedicado.
