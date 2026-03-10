-- Fase 1: crear tablas shadow particionadas por mes de gestion.
-- PostgreSQL 13+ recomendado.

BEGIN;

CREATE TABLE IF NOT EXISTS cartera_fact_part (
    LIKE cartera_fact INCLUDING DEFAULTS INCLUDING STORAGE INCLUDING COMMENTS
) PARTITION BY RANGE (
    (
        (split_part(gestion_month, '/', 2)::integer * 12) + split_part(gestion_month, '/', 1)::integer
    )
);

CREATE TABLE IF NOT EXISTS sync_records_part (
    LIKE sync_records INCLUDING DEFAULTS INCLUDING STORAGE INCLUDING COMMENTS
) PARTITION BY RANGE (
    (
        (split_part(gestion_month, '/', 2)::integer * 12) + split_part(gestion_month, '/', 1)::integer
    )
);

DO $$
DECLARE
    y integer;
    start_key integer;
    end_key integer;
BEGIN
    FOR y IN 2020..2036 LOOP
        start_key := (y * 12) + 1;
        end_key := ((y + 1) * 12) + 1;
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS cartera_fact_part_%s PARTITION OF cartera_fact_part FOR VALUES FROM (%s) TO (%s);',
            y, start_key, end_key
        );
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS sync_records_part_%s PARTITION OF sync_records_part FOR VALUES FROM (%s) TO (%s);',
            y, start_key, end_key
        );
    END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS cartera_fact_part_default PARTITION OF cartera_fact_part DEFAULT;
CREATE TABLE IF NOT EXISTS sync_records_part_default PARTITION OF sync_records_part DEFAULT;

CREATE INDEX IF NOT EXISTS ix_cartera_fact_part_gestion_un_supervisor_tramo
    ON cartera_fact_part (gestion_month, un, supervisor, tramo);
CREATE INDEX IF NOT EXISTS ix_cartera_fact_part_gestion_close_contract
    ON cartera_fact_part (gestion_month, close_month, contract_id);
CREATE INDEX IF NOT EXISTS ix_cartera_fact_part_updated_at_desc
    ON cartera_fact_part (updated_at DESC);

CREATE INDEX IF NOT EXISTS ix_sync_records_part_domain_gestion
    ON sync_records_part (domain, gestion_month);
CREATE INDEX IF NOT EXISTS ix_sync_records_part_business
    ON sync_records_part (domain, contract_id, gestion_month, supervisor, un, via, tramo);
CREATE INDEX IF NOT EXISTS ix_sync_records_part_updated_at_desc
    ON sync_records_part (updated_at DESC);

COMMIT;
