-- Fase 3: dual-write temporal desde tablas actuales hacia shadow particionadas.
-- Mantener activo hasta cutover.

BEGIN;

CREATE OR REPLACE FUNCTION trg_cartera_fact_dual_write_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM cartera_fact_part WHERE id = OLD.id;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        DELETE FROM cartera_fact_part WHERE id = OLD.id;
    END IF;

    INSERT INTO cartera_fact_part (
        id, contract_id, close_date, close_month, close_year, contract_date, contract_month,
        culm_date, culm_month, gestion_month, supervisor, un, via_cobro, tramo, category,
        contracts_total, cuota_amount, monto_vencido, total_saldo, capital_saldo, capital_vencido,
        source_hash, payload_json, loaded_at, updated_at
    ) VALUES (
        NEW.id, NEW.contract_id, NEW.close_date, NEW.close_month, NEW.close_year, NEW.contract_date, NEW.contract_month,
        NEW.culm_date, NEW.culm_month, NEW.gestion_month, NEW.supervisor, NEW.un, NEW.via_cobro, NEW.tramo, NEW.category,
        NEW.contracts_total, NEW.cuota_amount, NEW.monto_vencido, NEW.total_saldo, NEW.capital_saldo, NEW.capital_vencido,
        NEW.source_hash, NEW.payload_json, NEW.loaded_at, NEW.updated_at
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cartera_fact_dual_write ON cartera_fact;
CREATE TRIGGER trg_cartera_fact_dual_write
AFTER INSERT OR UPDATE OR DELETE ON cartera_fact
FOR EACH ROW EXECUTE FUNCTION trg_cartera_fact_dual_write_fn();

CREATE OR REPLACE FUNCTION trg_sync_records_dual_write_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM sync_records_part WHERE id = OLD.id;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        DELETE FROM sync_records_part WHERE id = OLD.id;
    END IF;

    INSERT INTO sync_records_part (
        id, domain, contract_id, gestion_month, supervisor, un, via, tramo,
        payload_json, source_hash, created_at, updated_at
    ) VALUES (
        NEW.id, NEW.domain, NEW.contract_id, NEW.gestion_month, NEW.supervisor, NEW.un, NEW.via, NEW.tramo,
        NEW.payload_json, NEW.source_hash, NEW.created_at, NEW.updated_at
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_records_dual_write ON sync_records;
CREATE TRIGGER trg_sync_records_dual_write
AFTER INSERT OR UPDATE OR DELETE ON sync_records
FOR EACH ROW EXECUTE FUNCTION trg_sync_records_dual_write_fn();

COMMIT;

