-- Solo alias ASCII (anio, mes, dia) para que el driver y el sync lean siempre la fecha del pago.
-- Version optimizada para usar indices por rango de fecha y joins explicitos.
SELECT
    YEAR(p.date) AS anio,
    MONTH(p.date) AS mes,
    DAY(p.date) AS dia,
    p.id,
    apw.id AS payment_way_id,
    CASE
        WHEN c.request_financing_number IS NOT NULL THEN 'ODONTOLOGIA TTO'
        ELSE e.name
    END AS UN,
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
  AND c.enterprise_id IN (1, 2, 5)
  AND p.contract_id NOT IN (55411, 55414, 59127, 59532, 60402);
