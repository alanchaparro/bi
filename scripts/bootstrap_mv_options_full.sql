-- Bootstrap completo de catalogos de filtros (mv_options_*).
-- Ejecutar luego de deploy/migracion para evitar options parciales.

BEGIN;

TRUNCATE TABLE mv_options_cartera;
INSERT INTO mv_options_cartera (
    gestion_month,
    close_month,
    contract_year,
    un,
    supervisor,
    via_cobro,
    categoria,
    tramo,
    updated_at
)
SELECT
    a.gestion_month,
    a.close_month,
    COALESCE(a.contract_year, 0) AS contract_year,
    COALESCE(NULLIF(TRIM(UPPER(a.un)), ''), 'S/D') AS un,
    COALESCE(NULLIF(TRIM(UPPER(a.supervisor)), ''), 'S/D') AS supervisor,
    COALESCE(NULLIF(TRIM(UPPER(a.via_cobro)), ''), 'DEBITO') AS via_cobro,
    COALESCE(NULLIF(TRIM(UPPER(a.categoria)), ''), 'VIGENTE') AS categoria,
    COALESCE(a.tramo, 0) AS tramo,
    NOW()
FROM cartera_corte_agg a
GROUP BY
    a.gestion_month,
    a.close_month,
    a.contract_year,
    COALESCE(NULLIF(TRIM(UPPER(a.un)), ''), 'S/D'),
    COALESCE(NULLIF(TRIM(UPPER(a.supervisor)), ''), 'S/D'),
    COALESCE(NULLIF(TRIM(UPPER(a.via_cobro)), ''), 'DEBITO'),
    COALESCE(NULLIF(TRIM(UPPER(a.categoria)), ''), 'VIGENTE'),
    COALESCE(a.tramo, 0);

TRUNCATE TABLE mv_options_cohorte;
INSERT INTO mv_options_cohorte (
    cutoff_month,
    un,
    supervisor,
    via_cobro,
    categoria,
    updated_at
)
SELECT
    a.cutoff_month,
    COALESCE(NULLIF(TRIM(UPPER(a.un)), ''), 'S/D') AS un,
    COALESCE(NULLIF(TRIM(UPPER(a.supervisor)), ''), 'S/D') AS supervisor,
    COALESCE(NULLIF(TRIM(UPPER(a.via_cobro)), ''), 'DEBITO') AS via_cobro,
    COALESCE(NULLIF(TRIM(UPPER(a.categoria)), ''), 'VIGENTE') AS categoria,
    NOW()
FROM cobranzas_cohorte_agg a
GROUP BY
    a.cutoff_month,
    COALESCE(NULLIF(TRIM(UPPER(a.un)), ''), 'S/D'),
    COALESCE(NULLIF(TRIM(UPPER(a.supervisor)), ''), 'S/D'),
    COALESCE(NULLIF(TRIM(UPPER(a.via_cobro)), ''), 'DEBITO'),
    COALESCE(NULLIF(TRIM(UPPER(a.categoria)), ''), 'VIGENTE');

TRUNCATE TABLE mv_options_rendimiento;
INSERT INTO mv_options_rendimiento (
    gestion_month,
    un,
    supervisor,
    via_cobro,
    categoria,
    tramo,
    updated_at
)
SELECT
    a.gestion_month,
    COALESCE(NULLIF(TRIM(UPPER(a.un)), ''), 'S/D') AS un,
    COALESCE(NULLIF(TRIM(UPPER(a.supervisor)), ''), 'S/D') AS supervisor,
    COALESCE(NULLIF(TRIM(UPPER(a.via_cobro)), ''), 'DEBITO') AS via_cobro,
    COALESCE(NULLIF(TRIM(UPPER(a.categoria)), ''), 'VIGENTE') AS categoria,
    COALESCE(a.tramo, 0) AS tramo,
    NOW()
FROM analytics_rendimiento_agg a
GROUP BY
    a.gestion_month,
    COALESCE(NULLIF(TRIM(UPPER(a.un)), ''), 'S/D'),
    COALESCE(NULLIF(TRIM(UPPER(a.supervisor)), ''), 'S/D'),
    COALESCE(NULLIF(TRIM(UPPER(a.via_cobro)), ''), 'DEBITO'),
    COALESCE(NULLIF(TRIM(UPPER(a.categoria)), ''), 'VIGENTE'),
    COALESCE(a.tramo, 0);

TRUNCATE TABLE mv_options_anuales;
INSERT INTO mv_options_anuales (
    cutoff_month,
    sale_month,
    sale_year,
    un,
    updated_at
)
SELECT
    a.cutoff_month,
    a.sale_month,
    COALESCE(a.sale_year, 0) AS sale_year,
    COALESCE(NULLIF(TRIM(UPPER(a.un)), ''), 'S/D') AS un,
    NOW()
FROM analytics_anuales_agg a
GROUP BY
    a.cutoff_month,
    a.sale_month,
    COALESCE(a.sale_year, 0),
    COALESCE(NULLIF(TRIM(UPPER(a.un)), ''), 'S/D');

COMMIT;
