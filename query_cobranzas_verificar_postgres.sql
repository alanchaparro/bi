-- Verificación: cobranzas en PostgreSQL (data warehouse)
-- Ejecutar en la base Postgres del proyecto para ver qué hay en cobranzas_fact.
-- Si payment_month está vacío o en otro formato, el reporte no sumará.

-- Resumen por mes (qué meses tienen datos y formato)
SELECT
    payment_month,
    LENGTH(payment_month) AS len,
    COUNT(*) AS filas,
    SUM(payment_amount) AS total_cobrado
FROM cobranzas_fact
WHERE payment_amount > 0
GROUP BY payment_month
ORDER BY payment_month DESC
LIMIT 24;

-- Filas para 02/2026 (o variantes)
SELECT
    contract_id,
    payment_month,
    payment_amount,
    un,
    supervisor,
    via
FROM cobranzas_fact
WHERE payment_amount > 0
  AND (TRIM(payment_month) = '02/2026' OR TRIM(payment_month) = '2026-02' OR TRIM(payment_month) = '2/2026')
ORDER BY payment_amount DESC
LIMIT 50;
