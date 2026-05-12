-- Adiciona tipo de evento de auditoria para criação de apartamentos em lote
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'APARTMENT_BATCH_CREATED';
