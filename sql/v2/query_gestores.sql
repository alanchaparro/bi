SELECT
    CONCAT(users.first_name, ' ', users.last_name) AS Gestor,
    dcp.contract_id,
    cp.from_date
FROM detail_client_portfolios dcp
JOIN contracts c
    ON dcp.contract_id = c.id
JOIN client_portfolios cp
    ON dcp.clientportfolio_id = cp.id
JOIN users
    ON cp.manager_id = users.id
WHERE users.id <> 696
  AND cp.from_date >= '2024-01-01'
  AND (
-- @include sql/common/enterprise_scope.sql
  )
  AND cp.status = 1;
