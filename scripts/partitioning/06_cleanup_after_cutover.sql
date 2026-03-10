-- Limpieza post-cutover (cuando ya no necesitas rollback inmediato).

BEGIN;

DROP FUNCTION IF EXISTS trg_cartera_fact_dual_write_fn();
DROP FUNCTION IF EXISTS trg_sync_records_dual_write_fn();

-- Descomentar cuando cierres ventana de rollback:
-- DROP TABLE IF EXISTS cartera_fact_legacy;
-- DROP TABLE IF EXISTS sync_records_legacy;

COMMIT;

