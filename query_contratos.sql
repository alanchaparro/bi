SELECT
    c.id,
    c.`date`,
    c.amount AS monto_cuota,
    c.status,

    CONCAT_WS(' ', seller.first_name, seller.last_name)       AS Vendedor,
    CASE
        WHEN UPPER(REPLACE(REPLACE(TRIM(CONCAT_WS(' ', sup.first_name, sup.last_name)), '.', ''), '  ', ' ')) = 'FVBROKEREAS'
         AND UPPER(REPLACE(REPLACE(TRIM(CONCAT_WS(' ', seller.first_name, seller.last_name)), '.', ''), '  ', ' ')) = 'FVBROKEREASCDE'
        THEN CONCAT_WS(' ', seller.first_name, seller.last_name)
        ELSE CONCAT_WS(' ', sup.first_name, sup.last_name)
    END                                                      AS Supervisor,

    e.`name` AS UN,
    cs.fecha_de_culminacion
FROM contracts c
JOIN enterprises e
    ON e.id = c.enterprise_id

LEFT JOIN users seller
    ON seller.id = c.seller_id

LEFT JOIN users sup
    ON sup.id = c.seller_supervisor_id

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
