-- ALTER TYPE ... ADD VALUE não pode rodar em bloco transacional no PostgreSQL.
-- O arquivo V13__poll_manual_close_trigger.sql.conf instrui o Flyway a executar
-- esta migration fora de transação.

-- Adiciona valor MANUAL ao enum poll_close_trigger para suportar encerramento
-- manual de votação pelo síndico (PollCloser.close com automatic=false).
ALTER TYPE poll_close_trigger ADD VALUE IF NOT EXISTS 'MANUAL';
