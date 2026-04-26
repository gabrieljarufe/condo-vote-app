-- RLS habilitada em todas as tabelas de domínio com condominium_id.
-- O TenantInterceptor executa `SET LOCAL app.current_tenant = '<uuid>'` antes de
-- cada @Transactional com X-Tenant-Id. Endpoints cross-tenant (sem header) usam
-- queries explícitas com WHERE user_id — não dependem de current_setting.
--
-- Comportamento quando app.current_tenant não está setado:
-- current_setting('app.current_tenant', true) retorna NULL (segundo arg = missing_ok).
-- NULL::uuid não casa com nenhum condominium_id → query retorna 0 linhas.
-- Isso é o comportamento correto: sem tenant setado, sem dados visíveis.

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
    USING (condominium_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation ON apartment_resident
    USING (condominium_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation ON condominium_admin
    USING (condominium_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation ON invitation
    USING (condominium_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation ON poll
    USING (condominium_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation ON poll_eligible_snapshot
    USING (condominium_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation ON vote
    USING (condominium_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation ON poll_result
    USING (condominium_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation ON audit_event
    USING (condominium_id = current_setting('app.current_tenant', true)::uuid);
