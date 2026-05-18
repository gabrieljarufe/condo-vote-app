-- ALTER TYPE ... ADD VALUE não pode rodar em bloco transacional no PostgreSQL.
-- O arquivo V12__poll_lifecycle_support.sql.conf instrui o Flyway a executar
-- esta migration fora de transação.

-- Adiciona valores de enum para audit_event_type cobrindo eventos do ciclo
-- de vida estendido de poll (publish DRAFT->SCHEDULED, edição em DRAFT/SCHEDULED,
-- abertura automática via job @Scheduled).
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'POLL_PUBLISHED';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'POLL_UPDATED';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'POLL_OPENED_AUTO';

-- Index parcial forward-looking: H6 (delegação/promoção/remoção) precisa
-- consultar "esse apartamento tem poll OPEN no snapshot?" rapidamente.
-- Criado agora para evitar nova migration quando H6 entrar.
CREATE INDEX IF NOT EXISTS idx_poll_open_by_condo
    ON poll (condominium_id)
    WHERE status = 'OPEN';
