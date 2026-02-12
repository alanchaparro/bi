SELECT
    cb.gestion_month,
    cb.un,
    cb.tramo,
    cb.categoria,
    cb.via_cobro,
    cb.supervisor,
    COUNT(*) AS contracts_total,
    SUM(CASE WHEN COALESCE(pb.paid_total, 0) > 0 THEN 1 ELSE 0 END) AS contracts_paid,
    SUM(cb.debt_total) AS debt_total,
    SUM(COALESCE(pb.paid_total, 0)) AS paid_total,
    SUM(COALESCE(pb.paid_via_debito, 0)) AS paid_via_debito,
    SUM(COALESCE(pb.paid_via_cobrador, 0)) AS paid_via_cobrador,
    SUM(COALESCE(pb.contract_paid_via_debito, 0)) AS contracts_paid_via_debito,
    SUM(COALESCE(pb.contract_paid_via_cobrador, 0)) AS contracts_paid_via_cobrador
FROM (
    SELECT
        ccd.contract_id,
        DATE_FORMAT(DATE_ADD(ccd.closed_date, INTERVAL 1 MONTH), '%m/%Y') AS gestion_month,
        e.name AS un,
        CASE
            WHEN ccd.quotas_expirations >= 7 THEN 7
            WHEN ccd.quotas_expirations < 0 THEN 0
            ELSE ccd.quotas_expirations
        END AS tramo,
        CASE
            WHEN (
                CASE
                    WHEN ccd.quotas_expirations >= 7 THEN 7
                    WHEN ccd.quotas_expirations < 0 THEN 0
                    ELSE ccd.quotas_expirations
                END
            ) <= 3 THEN 'VIGENTE'
            ELSE 'MOROSO'
        END AS categoria,
        CASE
            WHEN c.contract_type = 1 THEN 'COBRADOR'
            ELSE 'DEBITO'
        END AS via_cobro,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), 'S/D') AS supervisor,
        (COALESCE(c.amount, 0) + COALESCE(ccd.expired_amount, 0)) AS debt_total
    FROM contract_closed_dates ccd
    JOIN contracts c
        ON c.id = ccd.contract_id
    JOIN enterprises e
        ON e.id = c.enterprise_id
    LEFT JOIN users u
        ON u.id = c.seller_supervisor_id
    WHERE ccd.closed_date > '2020-12-31'
      AND c.enterprise_id IN (1, 2, 5)
) cb
LEFT JOIN (
    SELECT
        p.contract_id,
        DATE_FORMAT(p.date, '%m/%Y') AS gestion_month,
        SUM(COALESCE(apw.amount, 0)) AS paid_total,
        SUM(
            CASE
                WHEN (
                    pm.name RLIKE 'TC|TD|VIRTUAL|PAGOPAR'
                    OR pm.name LIKE '%PAY%'
                    OR pm.name LIKE '%MASFAZZIL%'
                ) THEN COALESCE(apw.amount, 0)
                ELSE 0
            END
        ) AS paid_via_debito,
        SUM(
            CASE
                WHEN (
                    pm.name RLIKE 'TC|TD|VIRTUAL|PAGOPAR'
                    OR pm.name LIKE '%PAY%'
                    OR pm.name LIKE '%MASFAZZIL%'
                ) THEN 0
                ELSE COALESCE(apw.amount, 0)
            END
        ) AS paid_via_cobrador,
        CASE
            WHEN SUM(
                CASE
                    WHEN (
                        pm.name RLIKE 'TC|TD|VIRTUAL|PAGOPAR'
                        OR pm.name LIKE '%PAY%'
                        OR pm.name LIKE '%MASFAZZIL%'
                    ) AND COALESCE(apw.amount, 0) > 0 THEN 1
                    ELSE 0
                END
            ) > 0 THEN 1
            ELSE 0
        END AS contract_paid_via_debito,
        CASE
            WHEN SUM(
                CASE
                    WHEN (
                        pm.name RLIKE 'TC|TD|VIRTUAL|PAGOPAR'
                        OR pm.name LIKE '%PAY%'
                        OR pm.name LIKE '%MASFAZZIL%'
                    ) THEN 0
                    WHEN COALESCE(apw.amount, 0) > 0 THEN 1
                    ELSE 0
                END
            ) > 0 THEN 1
            ELSE 0
        END AS contract_paid_via_cobrador
    FROM account_payment_ways apw
    JOIN payments p
        ON apw.payment_id = p.id
    LEFT JOIN payment_methods pm
        ON apw.payment_method_id = pm.id
    LEFT JOIN contracts c
        ON p.contract_id = c.id
    LEFT JOIN enterprises e
        ON c.enterprise_id = e.id
    WHERE p.status = 1
      AND p.type < 2
      AND YEAR(p.date) > 2020
      AND IF(e.id < 3 OR e.id = 5, 1, 0) = 1
      AND p.contract_id NOT IN (55411, 55414, 59127, 59532, 60402)
    GROUP BY p.contract_id, DATE_FORMAT(p.date, '%m/%Y')
) pb
    ON pb.contract_id = cb.contract_id
   AND pb.gestion_month = cb.gestion_month
GROUP BY
    cb.gestion_month,
    cb.un,
    cb.tramo,
    cb.categoria,
    cb.via_cobro,
    cb.supervisor
ORDER BY
    STR_TO_DATE(CONCAT('01/', cb.gestion_month), '%d/%m/%Y'),
    cb.un,
    cb.tramo,
    cb.categoria,
    cb.via_cobro,
    cb.supervisor;
