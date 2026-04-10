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
--   - Exclusión GESE: si el nombre del mayor (`accounting_types.name`) o de la cuenta (`accounting_plans.name`)
--     contiene la subcadena `gese` (sin distinguir mayúsculas), la fila no entra al EERR. Misma lógica que
--     `sql/common/eerr_exclude_mayor_cuenta_gese.sql` en `query_eerr.sql`.
--
-- Columna `is_tapo`: identifica asientos contables de tratamientos odontológicos financiados por TAPO.
--   Criterio (LEFT JOIN a subconsulta derivada DISTINCT, compatible con ONLY_FULL_GROUP_BY):
--   Se precalcula el conjunto de accounting_entry_id que son TAPO (voucher de Odontología
--   enterprise_id=1 con detail service_invoice_id=2 y payment financing=1) en una subconsulta
--   derivada `tapo` con SELECT DISTINCT. Luego se hace LEFT JOIN a esa subconsulta y
--   CASE WHEN tapo.accounting_entry_id IS NOT NULL THEN 1 ELSE 0 END AS is_tapo.
--   IMPORTANTE: la expresión is_tapo se incluye en el GROUP BY para que los montos TAPO y
--   no-TAPO queden en filas separadas. Así, al filtrar "Sin TAPO" (is_tapo=0), solo se
--   excluye la porción financiada TAPO de cada cuenta, preservando la porción no-TAPO.
--   Si se usara MAX(is_tapo) sin incluirlo en GROUP BY, los montos se mezclarían y toda
--   la fila quedaría marcada como TAPO, eliminando la cuenta completa al filtrar.
--
-- Nota: se exponen `SUM(debit)` y `SUM(credit)` por grupo. Para armar "ingreso" neto en UI/API puede
-- hacer falta convención por naturaleza de cuenta (p. ej. crédito neto en ingresos); ajustar cuando se cierre el modelo EERR.

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
    SUM(aed.credit) AS credit,
    CASE WHEN tapo.accounting_entry_id IS NOT NULL THEN 1 ELSE 0 END AS is_tapo
FROM accounting_entry_details AS aed
INNER JOIN accounting_entries AS ae ON aed.accounting_entry_id = ae.id
INNER JOIN accounting_plans AS ap ON aed.accounting_plan_id = ap.id
INNER JOIN accounting_types AS at ON ap.accounting_type_id = at.id
INNER JOIN social_reasons AS sr ON ap.social_reason_id = sr.id
LEFT JOIN (
    SELECT DISTINCT ae_tapo.id AS accounting_entry_id
    FROM accounting_entries ae_tapo
    INNER JOIN vouchers v2 ON ae_tapo.fromable_id = v2.id
        AND ae_tapo.fromable_type = 'App\\Models\\Voucher'
        AND v2.enterprise_id = 1
    INNER JOIN voucher_details vd2 ON v2.id = vd2.voucher_id AND vd2.service_invoice_id = 2
    INNER JOIN voucher_payments vp2 ON v2.id = vp2.voucher_id
    INNER JOIN payment_methods pm2 ON vp2.payment_method_id = pm2.id AND pm2.financing = 1
) AS tapo ON ae.id = tapo.accounting_entry_id
WHERE
    YEAR(ae.date) >= 2020
    AND sr.id <= 3
    AND at.status = 1
    AND at.`type` = 1
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
    ap.name,
    CASE WHEN tapo.accounting_entry_id IS NOT NULL THEN 1 ELSE 0 END
ORDER BY
    YEAR(ae.date),
    MONTH(ae.date),
    ae.social_reason_id,
    aed.accounting_plan_id;
