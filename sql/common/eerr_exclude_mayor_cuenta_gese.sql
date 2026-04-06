-- Excluye del EERR movimientos cuyo mayor (`accounting_types.name`) o cuenta
-- (`accounting_plans.name`) contenga la subcadena "gese" (sin distinguir mayúsculas).
-- Incluir solo dentro de un WHERE ya abierto (líneas siguientes = AND ...).
    AND LOWER(IFNULL(at.name, '')) NOT LIKE '%gese%'
    AND LOWER(IFNULL(ap.name, '')) NOT LIKE '%gese%'
