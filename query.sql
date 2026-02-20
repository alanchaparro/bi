SELECT
    e.name AS UN,
    b.name AS sucursal,
    ccd.contract_id AS id_contrato,
    c.date AS fecha_contrato,
    c.number AS numero_contrato,
    c.request_number AS numero_solicitud,
    c.request_financing_number,
    cl.document_number AS cedula,
    CONCAT(cl.first_name, ' ', cl.last_name) AS nombre_cliente,
    i.name AS seguro,
    IF(c.type_plan = 1, 'INDIVIDUAL', 'FAMILIAR') AS tipo_plan,
    CASE
        WHEN c.contract_type = 1 THEN 'COBRADOR'
        ELSE (
            SELECT de.name 
            FROM epem.contracting_entities ce
            JOIN epem.debit_entities de ON ce.debitentity_id = de.id
            WHERE ce.contract_id = c.id
            LIMIT 1
        )
    END AS via_de_cobro,
    c.persons_amount AS asegurados,
    c.quotas_amount AS periodo_cuotas,
    c.amount AS monto_cuota,
    c.actual_fee_quantity AS total_cuotas,
    c.inscription AS inscripcion,
    c.observation AS observacion,
    pml.name AS producto,
    CONCAT_WS(' ', seller.first_name, seller.last_name) AS Vendedor,
    CASE
        WHEN UPPER(REPLACE(REPLACE(TRIM(CONCAT_WS(' ', sup.first_name, sup.last_name)), '.', ''), '  ', ' ')) = 'FVBROKEREAS'
         AND UPPER(REPLACE(REPLACE(TRIM(CONCAT_WS(' ', seller.first_name, seller.last_name)), '.', ''), '  ', ' ')) = 'FVBROKEREASCDE'
        THEN CONCAT_WS(' ', seller.first_name, seller.last_name)
        ELSE CONCAT_WS(' ', sup.first_name, sup.last_name)
    END AS Supervisor,
    DATE_FORMAT(ccd.closed_date, '%Y/%m/%d') AS fecha_cierre,
    ccd.quotas_expirations AS cuotas_vencidas,
    ccd.expired_amount AS monto_vencido,
    ccd.total_residue AS total_saldo,
    CASE
        WHEN c.enterprise_id IN (4, 9, 10) THEN
            CASE c.status
                WHEN 1 THEN 'CONTROL'
                WHEN 2 THEN 'RECHAZADO CONTROL'
                WHEN 3 THEN 'ANALISIS'
                WHEN 4 THEN 'RECHAZADO ANALISIS'
                WHEN 5 THEN 'CONFIRMADO'
                WHEN 6 THEN 'CULMINADO'
                WHEN 7 THEN 'ANULADO'
                WHEN 8 THEN 'LIQUIDACION'
                WHEN 9 THEN 'DESEMBOLSO'
                ELSE 'CEDIDO'
            END
        ELSE
            CASE c.status
                WHEN 1 THEN 'CONTROL DE CALIDAD'
                WHEN 2 THEN 'APROBADO POR CC'
                WHEN 3 THEN 'RECHAZADO POR CC'
                WHEN 4 THEN 'RECHAZADO POR AUTORIZACION'
                WHEN 5 THEN 'CONFIRMADO'
                WHEN 6 THEN 'CULMINADO'
                WHEN 7 THEN 'BORRADO'
                WHEN 8 THEN 'UNDEFINED'
                WHEN 9 THEN 'UNDEFINED'
                ELSE 'CEDIDO'
            END
    END AS Estado_hoy,
    ccd.next_expiration_to_pay AS proximo_vencimiento_a_saldar,
    ccd.last_payment AS ultima_fecha_pago,
    ccd.expired_capital_amount AS capital_vencido,
    ccd.expired_interest_amount AS interes_vencido,
    ccd.capital_amount_residue AS capital_saldo,
    ccd.interest_amount_residue AS interes_saldo,
    ccd.accrued_amount AS monto_devengado,
    ccd.interest_suspension AS interes_suspendido,
    ccd.days_late AS dias_atraso,
    ccd.next_expiration_to_pay AS proximo_vencimiento,
    ccd.check_discount_status AS estado_descuento_cheque,
    ccd.last_collection_manager_id AS id_ultimo_gestor,
    cs.date AS fecha_culminacion,
    CASE c.client_sales_process
        WHEN 1 THEN 'OIMA'
        WHEN 2 THEN 'TAPO'
        ELSE 'NO'
    END AS Cartera_Vendida,
    ccd.residue_iva_invoice AS iva_a_facturar
FROM epem.contract_closed_dates ccd
JOIN epem.contracts c 
    ON ccd.contract_id = c.id
JOIN epem.clients cl 
    ON c.account_holder_id = cl.id
JOIN epem.enterprises e 
    ON c.enterprise_id = e.id
JOIN epem.branches b 
    ON c.branch_id = b.id
LEFT JOIN epem.insurances i 
    ON c.insurance_id = i.id
LEFT JOIN epem.product_money_loans pml 
    ON c.product_money_loan_id = pml.id
LEFT JOIN epem.users seller
    ON c.seller_id = seller.id
LEFT JOIN epem.users sup
    ON c.seller_supervisor_id = sup.id
LEFT JOIN epem.contract_situations cs 
    ON cs.contract_id = c.id 
    AND cs.type = 3 
    AND cs.status = 1
WHERE ccd.closed_date > '2020-12-31' AND
    c.enterprise_id IN (1, 2, 5)
