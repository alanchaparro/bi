-- =============================================================================
-- Ventas Odontología - Enero 2026
-- Propósito: Obtener total vendido, mejor supervisor y mejor vendedor por cantidad
-- Fecha de ejecución: 2026-03-26
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TOTAL VENDIDO DE ODONTOLOGÍA EN ENERO 2026
-- -----------------------------------------------------------------------------
SELECT
    '=== TOTAL VENDIDO ODONTOLOGÍA ENERO 2026 ===' AS consulta,
    COUNT(DISTINCT p.contract_id) AS total_contratos,
    COUNT(p.id) AS total_pagos,
    SUM(apw.amount) AS total_vendido_monto
FROM payments p
INNER JOIN account_payment_ways apw ON apw.payment_id = p.id
INNER JOIN contracts c ON p.contract_id = c.id
INNER JOIN enterprises e ON c.enterprise_id = e.id
WHERE p.status = 1
  AND p.type < 2
  AND p.date >= '2026-01-01'
  AND p.date < '2026-02-01'
  AND c.enterprise_id IN (1, 2, 5)
  AND p.contract_id NOT IN (55411, 55414, 59127, 59532, 60402)
  AND (
      CASE
          WHEN c.request_financing_number IS NOT NULL THEN 'ODONTOLOGIA TTO'
          ELSE e.name
      END
  ) LIKE '%ODONTOLOGIA%';

-- -----------------------------------------------------------------------------
-- 2. MEJOR SUPERVISOR POR CANTIDAD DE CONTRATOS
-- -----------------------------------------------------------------------------
SELECT
    '=== MEJOR SUPERVISOR POR CANTIDAD ===' AS consulta,
    CONCAT_WS(' ', u.first_name, u.last_name) AS supervisor_nombre,
    COUNT(DISTINCT p.contract_id) AS cantidad_contratos,
    COUNT(p.id) AS cantidad_pagos,
    SUM(apw.amount) AS total_vendido_monto
FROM payments p
INNER JOIN account_payment_ways apw ON apw.payment_id = p.id
INNER JOIN contracts c ON p.contract_id = c.id
INNER JOIN enterprises e ON c.enterprise_id = e.id
LEFT JOIN users u ON c.seller_supervisor_id = u.id
WHERE p.status = 1
  AND p.type < 2
  AND p.date >= '2026-01-01'
  AND p.date < '2026-02-01'
  AND c.enterprise_id IN (1, 2, 5)
  AND p.contract_id NOT IN (55411, 55414, 59127, 59532, 60402)
  AND (
      CASE
          WHEN c.request_financing_number IS NOT NULL THEN 'ODONTOLOGIA TTO'
          ELSE e.name
      END
  ) LIKE '%ODONTOLOGIA%'
GROUP BY c.seller_supervisor_id, u.first_name, u.last_name
HAVING supervisor_nombre IS NOT NULL
ORDER BY cantidad_contratos DESC
LIMIT 1;

-- -----------------------------------------------------------------------------
-- 3. MEJOR VENDEDOR POR CANTIDAD DE CONTRATOS
-- -----------------------------------------------------------------------------
SELECT
    '=== MEJOR VENDEDOR POR CANTIDAD ===' AS consulta,
    CONCAT_WS(' ', u.first_name, u.last_name) AS vendedor_nombre,
    COUNT(DISTINCT p.contract_id) AS cantidad_contratos,
    COUNT(p.id) AS cantidad_pagos,
    SUM(apw.amount) AS total_vendido_monto
FROM payments p
INNER JOIN account_payment_ways apw ON apw.payment_id = p.id
INNER JOIN contracts c ON p.contract_id = c.id
INNER JOIN enterprises e ON c.enterprise_id = e.id
INNER JOIN users u ON c.seller_id = u.id
WHERE p.status = 1
  AND p.type < 2
  AND p.date >= '2026-01-01'
  AND p.date < '2026-02-01'
  AND c.enterprise_id IN (1, 2, 5)
  AND p.contract_id NOT IN (55411, 55414, 59127, 59532, 60402)
  AND (
      CASE
          WHEN c.request_financing_number IS NOT NULL THEN 'ODONTOLOGIA TTO'
          ELSE e.name
      END
  ) LIKE '%ODONTOLOGIA%'
GROUP BY c.seller_id, u.first_name, u.last_name
ORDER BY cantidad_contratos DESC
LIMIT 1;

-- -----------------------------------------------------------------------------
-- 4. DESGLOSE POR UNIDAD DE NEGOCIO (ODONTOLOGÍA vs ODONTOLOGÍA TTO)
-- -----------------------------------------------------------------------------
SELECT
    '=== DESGLOSE POR UNIDAD DE NEGOCIO ===' AS consulta,
    CASE
        WHEN c.request_financing_number IS NOT NULL THEN 'ODONTOLOGIA TTO'
        ELSE e.name
    END AS unidad_negocio,
    COUNT(DISTINCT p.contract_id) AS cantidad_contratos,
    COUNT(p.id) AS cantidad_pagos,
    SUM(apw.amount) AS total_vendido_monto
FROM payments p
INNER JOIN account_payment_ways apw ON apw.payment_id = p.id
INNER JOIN contracts c ON p.contract_id = c.id
INNER JOIN enterprises e ON c.enterprise_id = e.id
WHERE p.status = 1
  AND p.type < 2
  AND p.date >= '2026-01-01'
  AND p.date < '2026-02-01'
  AND c.enterprise_id IN (1, 2, 5)
  AND p.contract_id NOT IN (55411, 55414, 59127, 59532, 60402)
  AND (
      CASE
          WHEN c.request_financing_number IS NOT NULL THEN 'ODONTOLOGIA TTO'
          ELSE e.name
      END
  ) LIKE '%ODONTOLOGIA%'
GROUP BY unidad_negocio
ORDER BY total_vendido_monto DESC;
