-- Fase 4: cutover.
-- Ejecutar solo cuando validaste paridad de conteos y checksums.

BEGIN;

LOCK TABLE cartera_fact IN ACCESS EXCLUSIVE MODE;
LOCK TABLE cartera_fact_part IN ACCESS EXCLUSIVE MODE;
LOCK TABLE sync_records IN ACCESS EXCLUSIVE MODE;
LOCK TABLE sync_records_part IN ACCESS EXCLUSIVE MODE;

DROP TRIGGER IF EXISTS trg_cartera_fact_dual_write ON cartera_fact;
DROP TRIGGER IF EXISTS trg_sync_records_dual_write ON sync_records;

ALTER TABLE cartera_fact RENAME TO cartera_fact_legacy;
ALTER TABLE cartera_fact_part RENAME TO cartera_fact;

ALTER TABLE sync_records RENAME TO sync_records_legacy;
ALTER TABLE sync_records_part RENAME TO sync_records;

COMMIT;

