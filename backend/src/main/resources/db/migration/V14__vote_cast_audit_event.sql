-- ALTER TYPE ... ADD VALUE não pode rodar em bloco transacional no PostgreSQL.
-- O arquivo V14__vote_cast_audit_event.sql.conf instrui o Flyway a executar
-- esta migration fora de transação.

-- Adiciona valor VOTE_CAST ao enum audit_event_type para auditoria de votos
-- registrados em polls (cada POST /api/polls/{id}/vote bem-sucedido publica
-- um audit event deste tipo). Ver docs/implementation/tasks/phase-7/h8-votar.md.
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'VOTE_CAST';
