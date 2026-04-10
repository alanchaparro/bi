-- query_eerr.sql
-- MySQL · base `epem`. Sync dominio **eerr** (un solo archivo por contrato del extractor).
--
-- UNION ALL de ingresos (ventas), costos y gastos. Mantener alineado con:
--   `query_eerr_ventas.sql`, `query_eerr_costos.sql`, `query_eerr_gastos.sql`.
-- Exclusión GESE: mayor o cuenta que contenga "gese" → `sql/common/eerr_exclude_mayor_cuenta_gese.sql`.
-- Columna `eerr_block`: ventas | costos | gastos (AGENTS.md regla 10).
-- Filtros equivalentes al legado: IF(status=1 AND type=N,1,0)=1 por bloque (aquí: AND at.status = 1 AND at.`type` = N).
-- Columna `is_tapo`: identifica asientos contables de tratamientos odontológicos financiados por TAPO.
--   Criterio (docs/agents/guiamysql.md): LEFT JOIN a vouchers v_tapo donde
--   ae.fromable_type = 'App\Models\Voucher', ae.fromable_id = v_tapo.id,
--   v_tapo.enterprise_id = 1 (Odontología), v_tapo.status = 1,
--   EXISTS voucher_details vd_tapo con service_invoice_id = 2 (Tratamiento Odontológico),
--   EXISTS voucher_payments vp_tapo → payment_methods pm_tapo con financing = 1.
--   Si el voucher coincide → is_tapo = 1, sino 0.
--   IMPORTANTE: la expresión is_tapo se incluye en el GROUP BY para que los montos TAPO y
--   no-TAPO queden en filas separadas. Así, al filtrar "Sin TAPO" (is_tapo=0), solo se
--   excluye la porción financiada TAPO de cada cuenta, preservando la porción no-TAPO.
--   Si se usara MAX(is_tapo) sin incluirlo en GROUP BY, los montos se mezclarían y toda
--   la fila quedaría marcada como TAPO, eliminando la cuenta completa al filtrar.
--
SELECT
    'ventas' AS eerr_block,
    MONTH(ae.date) AS Mes,
    YEAR(ae.date) AS `Año`,
    ae.social_reason_id,
    sr.razon_social AS Empresa,
    aed.accounting_plan_id,
    at.`type` AS group_type,
    at.name AS Mayor,
    ap.name AS Cuenta,
    IF(v_tapo.id IS NOT NULL, 1, 0) AS is_tapo,
    SUM(aed.debit) AS debit,
    SUM(aed.credit) AS credit
FROM accounting_entry_details AS aed
INNER JOIN accounting_entries AS ae ON aed.accounting_entry_id = ae.id
INNER JOIN accounting_plans AS ap ON aed.accounting_plan_id = ap.id
INNER JOIN accounting_types AS at ON ap.accounting_type_id = at.id
INNER JOIN social_reasons AS sr ON ap.social_reason_id = sr.id
LEFT JOIN vouchers v_tapo
    ON ae.fromable_id = v_tapo.id
    AND ae.fromable_type = 'App\\Models\\Voucher'
    AND v_tapo.enterprise_id = 1
    AND v_tapo.status = 1
    AND EXISTS (
        SELECT 1 FROM voucher_details vd_tapo
        WHERE vd_tapo.voucher_id = v_tapo.id
        AND vd_tapo.service_invoice_id = 2
    )
    AND EXISTS (
        SELECT 1 FROM voucher_payments vp_tapo
        INNER JOIN payment_methods pm_tapo ON vp_tapo.payment_method_id = pm_tapo.id
        WHERE vp_tapo.voucher_id = v_tapo.id
        AND pm_tapo.financing = 1
    )
WHERE
    YEAR(ae.date) >= 2020
    AND sr.id <= 3
    AND at.status = 1
    AND at.`type` = 1
-- @include sql/common/eerr_exclude_mayor_cuenta_gese.sql
GROUP BY
    MONTH(ae.date),
    YEAR(ae.date),
    ae.social_reason_id,
    sr.razon_social,
    aed.accounting_plan_id,
    at.`type`,
    at.name,
    ap.name,
    IF(v_tapo.id IS NOT NULL, 1, 0)

UNION ALL

SELECT
    'costos' AS eerr_block,
    MONTH(ae.date) AS Mes,
    YEAR(ae.date) AS `Año`,
    ae.social_reason_id,
    sr.razon_social AS Empresa,
    aed.accounting_plan_id,
    at.`type` AS group_type,
    at.name AS Mayor,
    ap.name AS Cuenta,
    IF(v_tapo.id IS NOT NULL, 1, 0) AS is_tapo,
    SUM(aed.debit) AS debit,
    SUM(aed.credit) AS credit
FROM accounting_entry_details AS aed
INNER JOIN accounting_entries AS ae ON aed.accounting_entry_id = ae.id
INNER JOIN accounting_plans AS ap ON aed.accounting_plan_id = ap.id
INNER JOIN accounting_types AS at ON ap.accounting_type_id = at.id
INNER JOIN social_reasons AS sr ON ap.social_reason_id = sr.id
LEFT JOIN vouchers v_tapo
    ON ae.fromable_id = v_tapo.id
    AND ae.fromable_type = 'App\\Models\\Voucher'
    AND v_tapo.enterprise_id = 1
    AND v_tapo.status = 1
    AND EXISTS (
        SELECT 1 FROM voucher_details vd_tapo
        WHERE vd_tapo.voucher_id = v_tapo.id
        AND vd_tapo.service_invoice_id = 2
    )
    AND EXISTS (
        SELECT 1 FROM voucher_payments vp_tapo
        INNER JOIN payment_methods pm_tapo ON vp_tapo.payment_method_id = pm_tapo.id
        WHERE vp_tapo.voucher_id = v_tapo.id
        AND pm_tapo.financing = 1
    )
WHERE
    YEAR(ae.date) >= 2020
    AND sr.id <= 3
    AND at.status = 1
    AND at.`type` = 2
-- @include sql/common/eerr_exclude_mayor_cuenta_gese.sql
GROUP BY
    MONTH(ae.date),
    YEAR(ae.date),
    ae.social_reason_id,
    sr.razon_social,
    aed.accounting_plan_id,
    at.`type`,
    at.name,
    ap.name,
    IF(v_tapo.id IS NOT NULL, 1, 0)

UNION ALL

SELECT
    'gastos' AS eerr_block,
    MONTH(ae.date) AS Mes,
    YEAR(ae.date) AS `Año`,
    ae.social_reason_id,
    sr.razon_social AS Empresa,
    aed.accounting_plan_id,
    at.`type` AS group_type,
    at.name AS Mayor,
    ap.name AS Cuenta,
    IF(v_tapo.id IS NOT NULL, 1, 0) AS is_tapo,
    SUM(aed.debit) AS debit,
    SUM(aed.credit) AS credit
FROM accounting_entry_details AS aed
INNER JOIN accounting_entries AS ae ON aed.accounting_entry_id = ae.id
INNER JOIN accounting_plans AS ap ON aed.accounting_plan_id = ap.id
INNER JOIN accounting_types AS at ON ap.accounting_type_id = at.id
INNER JOIN social_reasons AS sr ON ap.social_reason_id = sr.id
LEFT JOIN vouchers v_tapo
    ON ae.fromable_id = v_tapo.id
    AND ae.fromable_type = 'App\\Models\\Voucher'
    AND v_tapo.enterprise_id = 1
    AND v_tapo.status = 1
    AND EXISTS (
        SELECT 1 FROM voucher_details vd_tapo
        WHERE vd_tapo.voucher_id = v_tapo.id
        AND vd_tapo.service_invoice_id = 2
    )
    AND EXISTS (
        SELECT 1 FROM voucher_payments vp_tapo
        INNER JOIN payment_methods pm_tapo ON vp_tapo.payment_method_id = pm_tapo.id
        WHERE vp_tapo.voucher_id = v_tapo.id
        AND pm_tapo.financing = 1
    )
WHERE
    YEAR(ae.date) >= 2020
    AND sr.id <= 3
    AND at.status = 1
    AND at.`type` = 3
-- @include sql/common/eerr_exclude_mayor_cuenta_gese.sql
GROUP BY
    MONTH(ae.date),
    YEAR(ae.date),
    ae.social_reason_id,
    sr.razon_social,
    aed.accounting_plan_id,
    at.`type`,
    at.name,
    ap.name,
    IF(v_tapo.id IS NOT NULL, 1, 0);
