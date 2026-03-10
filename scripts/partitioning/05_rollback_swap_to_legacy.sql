-- Rollback de cutover de tablas particionadas.
-- Devuelve nombres originales legacy->activos.

BEGIN;

LOCK TABLE cartera_fact IN ACCESS EXCLUSIVE MODE;
LOCK TABLE cartera_fact_legacy IN ACCESS EXCLUSIVE MODE;
LOCK TABLE sync_records IN ACCESS EXCLUSIVE MODE;
LOCK TABLE sync_records_legacy IN ACCESS EXCLUSIVE MODE;

ALTER TABLE cartera_fact RENAME TO cartera_fact_part;
ALTER TABLE cartera_fact_legacy RENAME TO cartera_fact;

ALTER TABLE sync_records RENAME TO sync_records_part;
ALTER TABLE sync_records_legacy RENAME TO sync_records;

COMMIT;

