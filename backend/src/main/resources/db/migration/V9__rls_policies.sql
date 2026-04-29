-- RLS habilitada em todas as tabelas de domínio com condominium_id.
-- O TenantInterceptor executa `SET LOCAL app.current_tenant = '<uuid>'` antes de
-- cada @Transactional com X-Tenant-Id. Endpoints cross-tenant (sem header) usam
-- queries explícitas com WHERE user_id — não dependem de current_setting.
--
-- Comportamento quando app.current_tenant não está setado:
-- current_setting('app.current_tenant', true) retorna NULL (segundo arg = missing_ok).
-- NULL::uuid não casa com nenhum condominium_id → query retorna 0 linhas.
-- Isso é o comportamento correto: sem tenant setado, sem dados visíveis.
--
-- Por que (SELECT current_setting(...)) em vez de current_setting(...) direto:
-- A forma inline re-avalia a função por linha varrida. Envolver em (SELECT ...)
-- força o Postgres a usar um InitPlan: a função é avaliada uma única vez por query
-- e o resultado é reutilizado. Equivalente semântico exato — mesmo valor, mesma
-- comparação, mesmo comportamento com tenant ausente (NULL → 0 linhas).
-- Elimina o warning auth_rls_initplan do Supabase linter.
-- Ver docs/analysis/2026-04-27-supabase-linter-rls-warnings.md §3.
--
-- Por que algumas tabelas NÃO têm RLS (app_user, condominium, email_notification, poll_option):
-- A fronteira externa do schema public é a Data API (PostgREST). Ela está
-- DESABILITADA neste projeto — nenhum cliente externo acessa /rest/v1/*.
-- O backend conecta direto via JDBC (role postgres, sem BYPASSRLS no Supabase Cloud)
-- e é o único caminho de query. Habilitar RLS nessas tabelas exigiria policies
-- fictícias (USING (true)) ou pools separados por role — custo alto, ganho zero.
-- Ver docs/analysis/2026-04-27-supabase-linter-rls-warnings.md §2.
--
-- ATENÇÃO: esta decisão pressupõe Data API desabilitada (Dashboard → Settings → API).
-- Se Data API for habilitada no futuro, revisar antes de ativar:
-- opção A — revogar grants em public.* para anon/authenticated;
-- opção B — adicionar RLS defensiva nas 4 tabelas acima.

ALTER TABLE apartment              ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartment_resident     ENABLE ROW LEVEL SECURITY;
ALTER TABLE condominium_admin      ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation             ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_eligible_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_result            ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_event            ENABLE ROW LEVEL SECURITY;

-- poll_option não tem condominium_id — filtro via JOIN com poll (sem RLS direta)
-- app_user e email_notification são cross-tenant — sem RLS
-- condominium é cross-tenant (superadmin) — sem RLS

CREATE POLICY tenant_isolation ON apartment
    USING (condominium_id = (SELECT current_setting('app.current_tenant', true)::uuid));

CREATE POLICY tenant_isolation ON apartment_resident
    USING (condominium_id = (SELECT current_setting('app.current_tenant', true)::uuid));

CREATE POLICY tenant_isolation ON condominium_admin
    USING (condominium_id = (SELECT current_setting('app.current_tenant', true)::uuid));

CREATE POLICY tenant_isolation ON invitation
    USING (condominium_id = (SELECT current_setting('app.current_tenant', true)::uuid));

CREATE POLICY tenant_isolation ON poll
    USING (condominium_id = (SELECT current_setting('app.current_tenant', true)::uuid));

CREATE POLICY tenant_isolation ON poll_eligible_snapshot
    USING (condominium_id = (SELECT current_setting('app.current_tenant', true)::uuid));

CREATE POLICY tenant_isolation ON vote
    USING (condominium_id = (SELECT current_setting('app.current_tenant', true)::uuid));

CREATE POLICY tenant_isolation ON poll_result
    USING (condominium_id = (SELECT current_setting('app.current_tenant', true)::uuid));

CREATE POLICY tenant_isolation ON audit_event
    USING (condominium_id = (SELECT current_setting('app.current_tenant', true)::uuid));
