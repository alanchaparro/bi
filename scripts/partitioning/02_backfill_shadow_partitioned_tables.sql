-- Fase 2: backfill de datos hacia tablas shadow particionadas.
-- Ejecutar en ventana de baja concurrencia.

BEGIN;

INSERT INTO cartera_fact_part (
    id,
    contract_id,
    close_date,
    close_month,
    close_year,
    contract_date,
    contract_month,
    culm_date,
    culm_month,
    gestion_month,
    supervisor,
    un,
    via_cobro,
    tramo,
    category,
    contracts_total,
    cuota_amount,
    monto_vencido,
    total_saldo,
    capital_saldo,
    capital_vencido,
    source_hash,
    payload_json,
    loaded_at,
    updated_at
)
SELECT
    id,
    contract_id,
    close_date,
    close_month,
    close_year,
    contract_date,
    contract_month,
    culm_date,
    culm_month,
    gestion_month,
    supervisor,
    un,
    via_cobro,
    tramo,
    category,
    contracts_total,
    cuota_amount,
    monto_vencido,
    total_saldo,
    capital_saldo,
    capital_vencido,
    source_hash,
    payload_json,
    loaded_at,
    updated_at
FROM cartera_fact;

INSERT INTO sync_records_part (
    id,
    domain,
    contract_id,
    gestion_month,
    supervisor,
    un,
    via,
    tramo,
    payload_json,
    source_hash,
    created_at,
    updated_at
)
SELECT
    id,
    domain,
    contract_id,
    gestion_month,
    supervisor,
    un,
    via,
    tramo,
    payload_json,
    source_hash,
    created_at,
    updated_at
FROM sync_records;

COMMIT;

