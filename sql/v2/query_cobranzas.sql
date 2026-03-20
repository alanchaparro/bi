SELECT
    -- Regla operativa: este SQL define solo scope de extracción; la semántica de negocio final vive en Python.
    YEAR(p.date) AS anio,
    MONTH(p.date) AS mes,
    DAY(p.date) AS dia,
    p.id,
    apw.id AS payment_way_id,
    (
-- @include sql/common/un_rules.sql
    ) AS UN,
    b.name AS Suc,
    p.contract_id,
    c.number,
    c.enterprise_id,
    pm.name,
    CASE
        WHEN pm.name RLIKE 'TC|TD|VIRTUAL|PAGOPAR'
             OR pm.name LIKE '%PAY%'
             OR pm.name LIKE '%MASFAZZIL%'
        THEN 'DEBITO'
        ELSE 'COBRADOR'
    END AS VP,
    pm.id,
    apw.amount AS monto,
    p.created_at,
    p.updated_at AS Actualizado_al
FROM payments p
INNER JOIN account_payment_ways apw
    ON apw.payment_id = p.id
INNER JOIN contracts c
    ON p.contract_id = c.id
INNER JOIN enterprises e
    ON c.enterprise_id = e.id
LEFT JOIN branches b
    ON p.branch_id = b.id
LEFT JOIN payment_methods pm
    ON apw.payment_method_id = pm.id
WHERE p.status = 1
  AND p.type < 2
  AND p.date >= '2021-01-01'
  AND (
-- @include sql/common/enterprise_scope.sql
  )
  AND p.contract_id NOT IN (55411, 55414, 59127, 59532, 60402);
