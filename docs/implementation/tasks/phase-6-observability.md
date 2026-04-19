# Fase 6 — Observabilidade Mínima e Runbook de Bootstrap

**Objetivo:** dá para diagnosticar problemas em prod e onboardar o primeiro condomínio antes de começar a escrever features de domínio.

**Pré-requisitos:** Fase 5 (CI/CD funcionando).

---

## T6.1 — Logging JSON estruturado
- [ ] Adicionar `logstash-logback-encoder` no `backend/pom.xml`
- [ ] `backend/src/main/resources/logback-spring.xml`:
  - [ ] Profile `prod`: appender console com `LogstashEncoder`, campos custom (`service=condovote-backend`, `environment`)
  - [ ] Profile `local`: pattern humano legível (texto colorido)
  - [ ] Filtro de campos sensíveis: máscara `password`, `token`, `cpf`, `secret`, `authorization`, `key` (MDC filter ou custom converter)
- [ ] Adicionar `trace_id` via MDC (filter na entrada de cada request)
- [ ] Log de eventos chave: início/fim de job, abertura/fechamento de poll (quando existirem), erros de autenticação

**Aceite:** log em prod chega no Railway dashboard como JSON; campo CPF em mensagem de log nunca aparece em claro.

---

## T6.2 — Actuator + monitor externo
- [ ] `application-prod.yml`: expor `health`, `info`, `metrics` (já incluso por padrão) — mais nada
- [ ] `management.endpoint.health.show-details=when-authorized` + basic auth com credencial em env var
- [ ] `info`: adicionar `git-commit`, `build-time` via `build-info` do Spring Boot Maven Plugin
- [ ] Configurar **UptimeRobot** (free tier) monitorando `https://<railway-domain>/actuator/health` a cada 5 min
- [ ] Alert: e-mail pessoal do dono quando status down por 2+ checks

**Aceite:** UptimeRobot mostra 100% uptime após 24h; alerta simulado (parando o Railway service) chega por e-mail.

---

## T6.3 — Runbook de bootstrap de condomínio
- [ ] `docs/runbooks/bootstrap-condominio.md` com passo-a-passo conforme `docs/architecture.md` §0:
  - [ ] Passo 1: criar user no Supabase Auth (`supabase auth admin create-user --email ... --password ...` ou via Dashboard)
  - [ ] Passo 2: script SQL transacional (template com placeholders `<condo_name>`, `<user_id>`, `<cpf_encrypted>`) — insere `condominium`, `app_user`, `condominium_admin`
  - [ ] Passo 3: como criptografar CPF manualmente (script auxiliar ou Supabase Edge Function temporária — **ou** documentar que CPF do síndico pode ser inserido sem criptografia se campo opcional, **revisitar**: atualmente é NOT NULL e criptografado)
  - [ ] Passo 4: enviar credenciais ao síndico por canal seguro
- [ ] Testar runbook executando contra Supabase local primeiro, depois contra staging/produção

**Aceite:** operador segue o runbook de ponta-a-ponta e o síndico criado loga com sucesso, vê seu condomínio e consegue chamar endpoint autenticado.

---

## Verificação final (after-all-phases)
- [ ] Operador cria condomínio teste via runbook
- [ ] Síndico loga no frontend Vercel
- [ ] Frontend chama `/api/me/condominiums` → retorna condo
- [ ] Seleciona condo → headers `X-Tenant-Id` começam a ser enviados
- [ ] RLS isola corretamente (verificar com 2 condos distintos)
- [ ] JWT expirado → 401 estruturado
- [ ] Log estruturado com `trace_id` aparece no Railway

Com todos os itens acima ✅, a plataforma está pronta para **Fase 7 — primeira feature de domínio** (Convites e Onboarding), que será planejada em seu próprio `tasks/` dedicado.
