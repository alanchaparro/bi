-- Hardening post-cutover:
-- Apply autovacuum settings to partitioned roots and all existing partitions.

BEGIN;

DO $$
DECLARE
    part_name text;
BEGIN
    FOR part_name IN
        SELECT quote_ident(ns.nspname) || '.' || quote_ident(child.relname)
        FROM pg_inherits i
        JOIN pg_class parent ON parent.oid = i.inhparent
        JOIN pg_class child ON child.oid = i.inhrelid
        JOIN pg_namespace ns ON ns.oid = child.relnamespace
        WHERE parent.relname IN ('cartera_fact', 'sync_records')
    LOOP
        EXECUTE format(
            'ALTER TABLE %s SET (
              autovacuum_vacuum_scale_factor = 0.02,
              autovacuum_analyze_scale_factor = 0.01,
              autovacuum_vacuum_threshold = 5000,
              autovacuum_analyze_threshold = 2500
            )',
            part_name
        );
    END LOOP;
END $$;

COMMIT;

ANALYZE cartera_fact;
ANALYZE sync_records;
