-- query_facturacion_tapo_enero_2025.sql
-- MySQL · base `epem`. Facturacion de tratamientos odontologicos financiados por TAPO.
--
-- Filtros:
--   - enterprise_id = 1 (Odontologia)
--   - service_invoice_id = 2 (Tratamiento Odontologico)
--   - Fecha: Enero 2025 (01/01/2025 - 31/01/2025)
--   - status = 1 (Activo)
--   - Via de pago: PRESUPUESTO FINANCIADO%
--   - Subtotal con IVA (voucher_details.amount)
--
-- Resultado esperado: ~738,477,150

-- =============================================================================
-- CONSULTA PRINCIPAL: Facturacion Odontologia TAPO - Enero 2025
-- =============================================================================

SELECT
    'ENERO_2025_ODONTOLOGIA_TAPO' AS periodo,
    COUNT(DISTINCT v.id) AS cantidad_facturas,
    COUNT(DISTINCT vd.id) AS cantidad_detalles,
    SUM(vd.amount) AS subtotal_con_iva,
    SUM(vd.excenta) AS excenta,
    SUM(vd.iva5) AS iva5,
    SUM(vd.iva10) AS iva10
FROM vouchers v
INNER JOIN voucher_details vd ON v.id = vd.voucher_id
INNER JOIN voucher_payments vp ON v.id = vp.voucher_id
INNER JOIN payment_methods pm ON vp.payment_method_id = pm.id
WHERE
    -- Filtro 1: Empresa Odontologia
    v.enterprise_id = 1
    -- Filtro 2: Servicio Tratamiento Odontologico
    AND vd.service_invoice_id = 2
    -- Filtro 3: Rango de fechas Enero 2025
    AND v.date >= '2025-01-01'
    AND v.date <= '2025-01-31'
    -- Filtro 4: Estado activo
    AND v.status = 1
    -- Filtro 5: Via de pago PRESUPUESTO FINANCIADO
    AND pm.name LIKE 'PRESUPUESTO FINANCIADO%';

-- =============================================================================
-- CONSULTA DETALLADA: Desglose por factura
-- =============================================================================

SELECT
    v.id AS voucher_id,
    v.date AS fecha,
    v.voucher_number,
    vd.amount AS subtotal,
    vd.excenta,
    vd.iva5,
    vd.iva10,
    pm.name AS metodo_pago,
    si.id AS service_invoice_id,
    si.name AS servicio
FROM vouchers v
INNER JOIN voucher_details vd ON v.id = vd.voucher_id
INNER JOIN voucher_payments vp ON v.id = vp.voucher_id
INNER JOIN payment_methods pm ON vp.payment_method_id = pm.id
INNER JOIN service_invoices si ON vd.service_invoice_id = si.id
WHERE v.enterprise_id = 1
  AND vd.service_invoice_id = 2
  AND v.date >= '2025-01-01'
  AND v.date <= '2025-01-31'
  AND v.status = 1
  AND pm.name LIKE 'PRESUPUESTO FINANCIADO%'
ORDER BY v.date, v.id;

-- =============================================================================
-- CONSULTA MENSUAL: Facturacion por mes 2025
-- =============================================================================

SELECT
    MONTH(v.date) AS mes,
    MONTHNAME(v.date) AS nombre_mes,
    COUNT(DISTINCT v.id) AS cantidad_facturas,
    SUM(vd.amount) AS subtotal_con_iva,
    SUM(vd.excenta) AS excenta,
    SUM(vd.iva5) AS iva5,
    SUM(vd.iva10) AS iva10
FROM vouchers v
INNER JOIN voucher_details vd ON v.id = vd.voucher_id
INNER JOIN voucher_payments vp ON v.id = vp.voucher_id
INNER JOIN payment_methods pm ON vp.payment_method_id = pm.id
WHERE v.enterprise_id = 1
  AND vd.service_invoice_id = 2
  AND YEAR(v.date) = 2025
  AND v.status = 1
  AND pm.name LIKE 'PRESUPUESTO FINANCIADO%'
GROUP BY MONTH(v.date), MONTHNAME(v.date)
ORDER BY MONTH(v.date);

-- =============================================================================
-- VERIFICACION: Metodos de pago PRESUPUESTO FINANCIADO
-- =============================================================================

SELECT
    pm.id,
    pm.name,
    pm.financing,
    COUNT(DISTINCT v.id) AS cantidad_vouchers,
    SUM(v.amount) AS monto_total
FROM payment_methods pm
LEFT JOIN voucher_payments vp ON pm.id = vp.payment_method_id
LEFT JOIN vouchers v ON vp.voucher_id = v.id
WHERE pm.name LIKE '%PRESUPUESTO FINANCIADO%'
  AND YEAR(v.date) = 2025
  AND MONTH(v.date) = 1
  AND v.status = 1
GROUP BY pm.id, pm.name, pm.financing;

-- =============================================================================
-- VERIFICACION: Service_invoice_id = 2 (Tratamiento Odontologico)
-- =============================================================================

SELECT
    si.id,
    si.name,
    COUNT(DISTINCT v.id) AS cantidad_vouchers,
    SUM(vd.amount) AS monto_total
FROM service_invoices si
LEFT JOIN voucher_details vd ON si.id = vd.service_invoice_id
LEFT JOIN vouchers v ON vd.voucher_id = v.id
WHERE si.id = 2
  AND YEAR(v.date) = 2025
  AND MONTH(v.date) = 1
  AND v.status = 1
GROUP BY si.id, si.name;
