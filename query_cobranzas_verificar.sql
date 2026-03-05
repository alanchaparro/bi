-- Verificación: cobranzas en MySQL (origen)
-- Ejecutar en la base MySQL para comprobar que hay cobranzas y ver formato de Mes/Año.
-- Ajustar el mes/año en el WHERE si quieres otro corte (ej. 03/2026).

SELECT
    YEAR(payments.date) AS Año,
    MONTH(payments.date) AS Mes,
    DAY(payments.date) AS Dia,
    CONCAT(LPAD(MONTH(payments.date), 2, '0'), '/', YEAR(payments.date)) AS mes_anio_formato,
    payments.id,
    payments.contract_id,
    enterprises.name AS UN,
    account_payment_ways.amount AS monto,
    payments.date AS fecha_pago,
    payments.updated_at AS Actualizado_al
FROM account_payment_ways
LEFT JOIN (
    (payments
        LEFT JOIN branches ON payments.branch_id = branches.id)
    LEFT JOIN (contracts
        LEFT JOIN enterprises ON contracts.enterprise_id = enterprises.id)
    ON payments.contract_id = contracts.id
)
ON account_payment_ways.payment_id = payments.id
WHERE IF(payments.status = 1 AND payments.type < 2 AND YEAR(payments.date) > 2020, 1, 0) = 1
  AND IF(enterprises.id < 3 OR enterprises.id = 5, 1, 0) = 1
  AND payments.contract_id NOT IN (55411, 55414, 59127, 59532, 60402)
  AND YEAR(payments.date) = 2026
  AND MONTH(payments.date) = 2
  AND account_payment_ways.amount > 0
ORDER BY payments.date DESC
LIMIT 50;
