SELECT
    c.id,
    c.`date`,
    c.amount AS monto_cuota,
    c.status,
    CONCAT_WS(' ', u.first_name, u.last_name) AS Supervisor,
    e.`name` AS UN,
    cs.fecha_de_culminacion
FROM contracts c
JOIN enterprises e
    ON e.id = c.enterprise_id
LEFT JOIN users u
    ON u.id = c.seller_supervisor_id
LEFT JOIN (
    SELECT
        contract_id,
        MAX(`date`) AS fecha_de_culminacion
    FROM contract_situations
    WHERE type = 3
      AND status = 1
    GROUP BY contract_id
) cs
    ON cs.contract_id = c.id
WHERE c.status IN (5, 6)
  AND e.id IN (1, 5, 2);
