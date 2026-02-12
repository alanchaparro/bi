SELECT
    YEAR(payments.date) AS Año,
    MONTH(payments.date) AS Mes,
    DAY(payments.date) AS Dia,
    payments.id,
    enterprises.name AS UN,
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
    NOW() AS Actualizado_al
FROM account_payment_ways
LEFT JOIN (
    (payments
        LEFT JOIN branches ON payments.branch_id = branches.id)
        LEFT JOIN (contracts
            LEFT JOIN enterprises ON contracts.enterprise_id = enterprises.id)
    ON payments.contract_id = contracts.id
)
ON account_payment_ways.payment_id = payments.id
LEFT JOIN payment_methods
    ON account_payment_ways.payment_method_id = payment_methods.id
WHERE IF(payments.status = 1 AND payments.type < 2 AND YEAR(payments.date) > 2020,1,0) = 1
  AND IF(enterprises.id < 3 OR enterprises.id = 5,1,0) = 1
  AND payments.contract_id NOT IN (55411,55414,59127,59532,60402);
