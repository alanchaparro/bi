SELECT
	concat(users.first_name," ",users.last_name) AS Gestor,
	detail_client_portfolios.contract_id,
	client_portfolios.from_date
FROM
	(detail_client_portfolios left JOIN contracts ON detail_client_portfolios.contract_id=contracts.id)left join
	client_portfolios on detail_client_portfolios.clientportfolio_id = client_portfolios.id
	left join users ON client_portfolios.manager_id = users.id 
WHERE 
users.id <> 696
and
YEAR(client_portfolios.from_date)>=2024    -- mes actual
AND contracts.enterprise_id IN (1,2,5)
and client_portfolios.status = 1
