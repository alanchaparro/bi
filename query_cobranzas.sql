-- Solo alias ASCII (anio, mes, dia) para que el driver y el sync lean siempre la fecha del pago
SELECT
    YEAR(payments.date) AS anio,
    MONTH(payments.date) AS mes,
    DAY(payments.date) AS dia,
    payments.id,
    account_payment_ways.id AS payment_way_id,
    CASE
        WHEN contracts.request_financing_number IS NOT NULL THEN 'ODONTOLOGIA TTO'
        ELSE enterprises.name
    END AS UN,
    branches.name AS Suc,
    payments.contract_id,
    contracts.number,
    contracts.enterprise_id,
    payment_methods.name,
    CASE
        WHEN payment_methods.name RLIKE 'TC|TD|VIRTUAL|PAGOPAR'
             OR payment_methods.name LIKE '%PAY%'
             OR payment_methods.name LIKE '%MASFAZZIL%'
        THEN 'DEBITO'
        ELSE 'COBRADOR'
    END AS VP,
    payment_methods.id,
    account_payment_ways.amount AS monto,
    payments.created_at,
    payments.updated_at AS Actualizado_al
FROM account_payment_ways
LEFT JOIN (
    payments
    LEFT JOIN branches ON payments.branch_id = branches.id
    LEFT JOIN contracts ON payments.contract_id = contracts.id
    LEFT JOIN enterprises ON contracts.enterprise_id = enterprises.id
) ON account_payment_ways.payment_id = payments.id
LEFT JOIN payment_methods ON account_payment_ways.payment_method_id = payment_methods.id
WHERE payments.status = 1 
  AND payments.type < 2 
  AND YEAR(payments.date) > 2020
  AND (enterprises.id < 3 OR enterprises.id = 5)
  AND payments.contract_id NOT IN (55411,55414,59127,59532,60402);
