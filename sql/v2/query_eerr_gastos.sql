-- query_eerr_gastos.sql
-- MySQL · base operativa típica `epem` (misma convención que `sql/v2/query_eerr_ventas.sql`).
--
-- Estado de resultado (EERR) — extracto **gastos** (movimientos por plan contable y periodo).
-- Reglas del módulo (EBITDA = margen − gastos): `AGENTS.md` regla 10.
--
-- Mismo JOIN y columnas de salida que `query_eerr_ventas.sql`; cambia el filtro de tipo contable.
--
-- Filtros (legado analizado):
--   - `YEAR(accounting_entries.date) >= 2020`
--   - `social_reasons.id <= 3` — ver nota de alcance en `query_eerr_ventas.sql`
--   - `accounting_types.status = 1` y `accounting_types.type = 3` — equivalente a
--     `IF(accounting_types.status = 1 AND accounting_types.type = 3, 1, 0) = 1` del origen.
--   - Exclusión GESE: ver comentario en `query_eerr_ventas.sql` (mismas condiciones `NOT LIKE '%gese%'`).
--
-- Nota: `SUM(debit)` / `SUM(credit)` por grupo; el signo operativo de “gasto” en UI/API puede requerir
-- convención por naturaleza de cuenta.
--
SELECT
    MONTH(ae.date) AS Mes,
    YEAR(ae.date) AS `Año`,
    ae.social_reason_id,
    sr.razon_social AS Empresa,
    aed.accounting_plan_id,
    at.`type` AS group_type,
    at.name AS Mayor,
    ap.name AS Cuenta,
    SUM(aed.debit) AS debit,
    SUM(aed.credit) AS credit
FROM accounting_entry_details AS aed
INNER JOIN accounting_entries AS ae ON aed.accounting_entry_id = ae.id
INNER JOIN accounting_plans AS ap ON aed.accounting_plan_id = ap.id
INNER JOIN accounting_types AS at ON ap.accounting_type_id = at.id
INNER JOIN social_reasons AS sr ON ap.social_reason_id = sr.id
WHERE
    YEAR(ae.date) >= 2020
    AND sr.id <= 3
    AND at.status = 1
    AND at.`type` = 3
    AND LOWER(IFNULL(at.name, '')) NOT LIKE '%gese%'
    AND LOWER(IFNULL(ap.name, '')) NOT LIKE '%gese%'
GROUP BY
    MONTH(ae.date),
    YEAR(ae.date),
    ae.social_reason_id,
    sr.razon_social,
    aed.accounting_plan_id,
    at.`type`,
    at.name,
    ap.name
ORDER BY
    YEAR(ae.date),
    MONTH(ae.date),
    ae.social_reason_id,
    aed.accounting_plan_id;
