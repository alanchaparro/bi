-- Run with:
-- psql -U cobranzas_user -d cobranzas_prod -f scripts/explain_analytics_v2.sql

EXPLAIN (ANALYZE, BUFFERS)
SELECT gestion_month, un, supervisor, via_cobro, categoria, tramo,
       SUM(debt_total) AS debt_total, SUM(paid_total) AS paid_total,
       SUM(contracts_total) AS contracts_total, SUM(contracts_paid) AS contracts_paid
FROM analytics_rendimiento_agg
WHERE gestion_month IN ('12/2025', '01/2026', '02/2026')
GROUP BY gestion_month, un, supervisor, via_cobro, categoria, tramo;

EXPLAIN (ANALYZE, BUFFERS)
SELECT DISTINCT un_canonica
FROM dim_negocio_contrato
WHERE sale_year > 0
ORDER BY un_canonica;

EXPLAIN (ANALYZE, BUFFERS)
SELECT DISTINCT sale_year
FROM dim_negocio_contrato
WHERE sale_year > 0
ORDER BY sale_year;

EXPLAIN (ANALYZE, BUFFERS)
SELECT sale_year,
       SUM(contracts) AS contracts,
       SUM(culminados) AS culminados
FROM analytics_anuales_agg
WHERE cutoff_month = (
  SELECT MAX(cutoff_month) FROM analytics_anuales_agg
)
GROUP BY sale_year
ORDER BY sale_year;
