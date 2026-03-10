SELECT
    c.id,
    c.`date`,
    c.amount AS monto_cuota,
    c.status,
    c.created_at,
    c.updated_at,
    CONCAT_WS(' ', seller.first_name, seller.last_name) AS Vendedor,
    (
-- @include sql/common/supervisor_rules.sql
    ) AS Supervisor,
    (
-- @include sql/common/un_rules.sql
    ) AS UN,
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
  AND (
-- @include sql/common/enterprise_scope.sql
  );
