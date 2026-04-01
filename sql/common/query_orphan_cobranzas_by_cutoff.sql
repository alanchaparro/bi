-- Cobros sin cierre cartera para un mes de corte (payment_month): pagos en cobranzas_fact
-- cuyo contract_id NO tiene fila en cartera_fact para el mes de gestión efectivo elegido.
-- Alineado a backend: analytics_service._cohorte_orphan_cobranzas + _effective_cartera_month_for_cutoff.
--
-- Uso:
-- 1) Ajustar `cutoff` y, si hace falta, `effective_gestion_override` en el CTE `params`.
-- 2) effective NULL = último gestion_month en cartera_corte_agg con serial <= cutoff (como _effective_cartera_month_for_cutoff).
-- 3) En cohorte con preagg, el API a veces usa el mismo mes que el corte para estos cobros; si no coincide con (2),
--    poner effective_gestion_override = '03/2026' (mismo valor que cutoff).

WITH params AS (
    SELECT
        '03/2026'::text AS cutoff,           -- mes de cobro (corte)
        NULL::text AS effective_gestion_override  -- ej. '03/2026'; NULL = calcular abajo
),
cutoff_serial AS (
    SELECT
        p.cutoff,
        (split_part(p.cutoff, '/', 2)::int * 12 + split_part(p.cutoff, '/', 1)::int) AS ser
    FROM params p
),
agg_months AS (
    SELECT DISTINCT trim(gestion_month::text) AS gestion_month
    FROM cartera_corte_agg
    WHERE gestion_month IS NOT NULL AND trim(gestion_month::text) <> ''
),
agg_serial AS (
    SELECT
        gestion_month,
        (split_part(gestion_month, '/', 2)::int * 12 + split_part(gestion_month, '/', 1)::int) AS ser
    FROM agg_months
    WHERE gestion_month ~ '^\d{1,2}/\d{4}$'
),
effective AS (
    SELECT COALESCE(
        (SELECT CASE
            WHEN trim(effective_gestion_override) <> '' THEN trim(effective_gestion_override)
            ELSE NULL
        END FROM params),
        (
            SELECT a.gestion_month
            FROM agg_serial a
            CROSS JOIN cutoff_serial c
            WHERE a.ser <= c.ser
            ORDER BY a.ser DESC
            LIMIT 1
        )
    ) AS effective_gestion
),
payment_month_variants AS (
    -- Variantes como _payment_month_variants(): MM/YYYY, YYYY-MM y M/YYYY sin cero a la izquierda
    SELECT DISTINCT v.pm
    FROM params p
    CROSS JOIN LATERAL (
        SELECT trim(p.cutoff) AS pm
        UNION ALL
        SELECT to_char(to_date(trim(p.cutoff), 'MM/YYYY'), 'YYYY-MM')
        UNION ALL
        SELECT (extract(month FROM to_date(trim(p.cutoff), 'MM/YYYY'))::int)::text || '/' || (extract(year FROM to_date(trim(p.cutoff), 'MM/YYYY'))::int)::text
    ) v
),
cartera_contracts AS (
    SELECT DISTINCT trim(contract_id::text) AS contract_id
    FROM cartera_fact cf
    CROSS JOIN effective e
    WHERE trim(cf.gestion_month::text) = e.effective_gestion
      AND trim(cf.contract_id::text) <> ''
)
SELECT
    trim(cf.contract_id::text) AS contract_id,
    upper(trim(coalesce(cf.un::text, 'S/D'))) AS unidad_negocio,
    upper(trim(coalesce(cf.supervisor::text, 'S/D'))) AS supervisor,
    upper(trim(coalesce(cf.via::text, ''))) AS via_cobro,
    count(*) AS lineas_pago,
    round(coalesce(sum(cf.payment_amount), 0)::numeric, 2) AS cobrado_total_gs,
    (SELECT effective_gestion FROM effective) AS gestion_cartera_usada,
    (SELECT cutoff FROM params) AS corte_pago
FROM cobranzas_fact cf
CROSS JOIN effective e
WHERE e.effective_gestion IS NOT NULL
  AND trim(cf.payment_month::text) IN (SELECT pm FROM payment_month_variants WHERE pm IS NOT NULL AND trim(pm) <> '')
  AND trim(cf.contract_id::text) <> ''
  AND NOT EXISTS (
      SELECT 1 FROM cartera_contracts c
      WHERE c.contract_id = trim(cf.contract_id::text)
  )
GROUP BY
    trim(cf.contract_id::text),
    upper(trim(coalesce(cf.un::text, 'S/D'))),
    upper(trim(coalesce(cf.supervisor::text, 'S/D'))),
    upper(trim(coalesce(cf.via::text, '')))
ORDER BY cobrado_total_gs DESC, contract_id;
