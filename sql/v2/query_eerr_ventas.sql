-- query_eerr_ventas.sql
-- MySQL · base operativa típica `epem` (misma convención que `sql/v2/query_cartera.sql`, etc.).
--
-- Estado de resultado (EERR) — extracto **ingresos / ventas** (movimientos por plan contable y periodo).
-- Reglas del módulo (margen, EBITDA): `AGENTS.md` regla 10.
--
-- Filtros (legado analizado):
--   - `YEAR(accounting_entries.date) >= 2020`
--   - `social_reasons.id <= 3` — alcance por razón social en catálogo contable (no es el mismo criterio
--     que `enterprise_id IN (1,2,5)` de cartera/cobranzas; revisar alineación de negocio si hiciera falta).
--   - `accounting_types.status = 1` y `accounting_types.type = 1` — equivalente a
--     `IF(accounting_types.status = 1 AND accounting_types.type = 1, 1, 0) = 1` del origen.
--     El significado exacto de `type` depende del catálogo legacy (`accounting_types` / `type-group-accounting` en `docs/base.md`).
--
-- Nota: se exponen `SUM(debit)` y `SUM(credit)` por grupo. Para armar “ingreso” neto en UI/API puede
-- hacer falta convención por naturaleza de cuenta (p. ej. crédito neto en ingresos); ajustar cuando se cierre el modelo EERR.
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
    AND at.`type` = 1
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
