# MySQL `epem` — inventario verificado (solo metadatos)

**Fecha:** 2026-03-28  
**Motor:** MySQL `8.0.27`  
**Esquema:** `epem`  
**Método:** cliente oficial en contenedor `mysql:8` (`docker run --rm mysql:8 mysql ...`).  
**Credenciales:** no se documentan aquí; usar `.env` local.

## Resumen del catálogo

| Métrica | Valor |
|--------|------:|
| Tablas `BASE TABLE` en `epem` | 546 |
| Filas en `information_schema.KEY_COLUMN_USAGE` con `REFERENCED_TABLE_NAME IS NOT NULL` | 1536 |

*(1536 cuenta columnas participantes en FKs; una FK compuesta suma varias filas.)*

## FK declaradas — tablas núcleo de extracción v2 (`sql/v2/*`)

Subconjunto alineado a `docs/base.md` (cartera, cobranzas, contratos, gestores).  
Para el **listado completo** del esquema, volver a ejecutar la consulta de la §7 de `docs/base.md` o:

```bash
docker run --rm mysql:8 mysql -h "<HOST>" -P 3306 -u "<USER>" -p"<PASSWORD>" epem --batch --raw -e "
SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME, CONSTRAINT_NAME
FROM information_schema.KEY_COLUMN_USAGE k
WHERE k.TABLE_SCHEMA = 'epem' AND k.REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, ORDINAL_POSITION;
" > epem_all_fks.tsv
```

### `account_payment_ways`

| Columna | → Tabla | → Columna | Constraint |
|---------|---------|-----------|------------|
| `payment_id` | `payments` | `id` | `account_payment_ways_payment_id_foreign` |
| `payment_method_id` | `payment_methods` | `id` | `account_payment_ways_payment_method_id_foreign` |

### `branches`

| Columna | → Tabla | → Columna | Constraint |
|---------|---------|-----------|------------|
| `operational_manager_id` | `users` | `id` | `branches_operational_manager_id_foreign` |
| `user_id` | `users` | `id` | `branches_user_id_foreign` |

### `client_portfolios`

| Columna | → Tabla | → Columna | Constraint |
|---------|---------|-----------|------------|
| `collection_sections_id` | `collection_sections` | `id` | `client_portfolios_collection_sections_id_foreign` |
| `manager_id` | `users` | `id` | `client_portfolios_manager_id_foreign` |
| `user_id` | `users` | `id` | `client_portfolios_user_id_foreign` |

### `clients` (referencias salientes relevantes para joins con `contracts`)

| Columna | → Tabla | → Columna | Constraint |
|---------|---------|-----------|------------|
| `clients_enterprise_id` | `clients_enterprises` | `id` | `clients_clients_enterprise_id_foreign` |
| `client_turn_portfolio_id` | `client_turn_portfolios` | `id` | `clients_client_turn_portfolio_id_foreign` |
| `collector_id` | `users` | `id` | `clients_collector_id_foreign` |
| `dental_office_id` | `dental_offices` | `id` | `clients_dental_office_id_foreign` |
| `infusion_diagnose_id` | `infusion_diagnoses` | `id` | `clients_infusion_diagnose_id_foreign` |
| `infusion_price_id` | `infusion_prices` | `id` | `clients_infusion_price_id_foreign` |
| `last_dental_office_id` | `dental_offices` | `id` | `clients_last_dental_office_id_foreign` |
| `last_doctor_id` | `doctors` | `id` | `clients_last_doctor_id_foreign` |
| `last_tracking_id` | `cases_to_calls_trackings` | `id` | `clients_last_tracking_id_foreign` |
| `nationality_id` | `nationalities` | `id` | `clients_nationality_id_foreign` |
| `user_id` | `users` | `id` | `clients_user_id_foreign` |

### `contract_closed_dates`

| Columna | → Tabla | → Columna | Constraint |
|---------|---------|-----------|------------|
| `check_discount_id` | `check_discounts` | `id` | `contract_closed_dates_check_discount_id_foreign` |
| `contract_id` | `contracts` | `id` | `contract_closed_dates_contract_id_foreign` |
| `last_collection_manager_id` | `users` | `id` | `contract_closed_dates_last_collection_manager_id_foreign` |
| `last_scheduling_manager_id` | `users` | `id` | `contract_closed_dates_last_scheduling_manager_id_foreign` |

### `contract_situations`

| Columna | → Tabla | → Columna | Constraint |
|---------|---------|-----------|------------|
| `contract_id` | `contracts` | `id` | `contract_situations_contract_id_foreign` |
| `culminated_motive_id` | `culminated_motives` | `id` | `contract_situations_culminated_motive_id_foreign` |
| `user_id` | `users` | `id` | `contract_situations_user_id_foreign` |

### `contracting_entities`

| Columna | → Tabla | → Columna | Constraint |
|---------|---------|-----------|------------|
| `account_manager_id` | `clients` | `id` | `contracting_entities_account_manager_id_foreign` |
| `contract_id` | `contracts` | `id` | `contracting_entities_contracts_id_foreign` |
| `debitentity_id` | `debit_entities` | `id` | `contracting_entities_debit_entities_id_foreign` |

### `contracts` — FK usadas explícitamente en queries v2

| Columna | → Tabla | → Columna | Constraint |
|---------|---------|-----------|------------|
| `account_holder_id` | `clients` | `id` | `contracts_account_holder_id_foreign` |
| `branch_id` | `branches` | `id` | `contracts_branch_id_foreign` |
| `enterprise_id` | `enterprises` | `id` | `contracts_enterprise_id_foreign` |
| `insurance_id` | `insurances` | `id` | `contracts_insurance_id_foreign` |
| `product_money_loan_id` | `product_money_loans` | `id` | `contracts_product_money_loan_id_foreign` |
| `seller_id` | `users` | `id` | `contracts_seller_id_foreign` |
| `seller_supervisor_id` | `users` | `id` | `contracts_seller_supervisor_id_foreign` |

`contracts` tiene **muchas FK adicionales** (direcciones, promociones, cuoteras, vouchers, etc.); para el modelo completo consultar `information_schema` en el servidor.

### `debit_entities`

| Columna | → Tabla | → Columna | Constraint |
|---------|---------|-----------|------------|
| `user_id` | `users` | `id` | `debit_entities_user_id_foreign` |

### `detail_client_portfolios`

| Columna | → Tabla | → Columna | Constraint |
|---------|---------|-----------|------------|
| `clientportfolio_id` | `client_portfolios` | `id` | `detail_client_portfolios_clientportfolio_id_foreign` |
| `collection_sections_id` | `collection_sections` | `id` | `detail_client_portfolios_collection_sections_id_foreign` |
| `contract_id` | `contracts` | `id` | `detail_client_portfolios_contract_id_foreign` |
| `enterprise_id` | `enterprises` | `id` | `detail_client_portfolios_enterprise_id_foreign` |
| `last_tracking_id` | `recovery_trackings` | `id` | `detail_client_portfolios_last_tracking_id_foreign` |

### `enterprises`

| Columna | → Tabla | → Columna | Constraint |
|---------|---------|-----------|------------|
| `last_seller_int_opportunity_id` | `users` | `id` | `enterprises_last_seller_int_opportunity_id_foreign` |
| `last_seller_asu_opportunity_id` | `users` | `id` | `enterprises_last_seller_opportunity_id_foreign` |
| `social_reason_id` | `social_reasons` | `id` | `enterprises_social_reason_id_foreign` |
| `user_id` | `users` | `id` | `enterprises_user_id_foreign` |

### `insurances`

| Columna | → Tabla | → Columna | Constraint |
|---------|---------|-----------|------------|
| `coverage_id` | `coverages` | `id` | `insurances_coverage_id_foreign` |
| `enterprise_id` | `enterprises` | `id` | `insurances_enterprise_id_foreign` |
| `treatment_convention_id` | `treatment_conventions` | `id` | `insurances_treatment_convention_id_foreign` |
| `user_id` | `users` | `id` | `insurances_user_id_foreign` |

### `payment_methods`

| Columna | → Tabla | → Columna | Constraint |
|---------|---------|-----------|------------|
| `user_id` | `users` | `id` | `payment_methods_user_id_foreign` |

### `payments`

| Columna | → Tabla | → Columna | Constraint |
|---------|---------|-----------|------------|
| `address_id` | `addresses` | `id` | `payments_address_id_foreign` |
| `branch_id` | `branches` | `id` | `payments_branch_id_foreign` |
| `client_id` | `clients` | `id` | `payments_client_id_foreign` |
| `client_portfolios_id` | `client_portfolios` | `id` | `payments_client_portfolios_id_foreign` |
| `contract_id` | `contracts` | `id` | `payments_contract_id_foreign` |
| `contract_promotion_id` | `contract_promotions` | `id` | `payments_contract_promotion_id_foreign` |
| `debt_collector_id` | `users` | `id` | `payments_debt_collector_id_foreign` |
| `exoneration_reason_id` | `exoneration_reasons` | `id` | `payments_exoneration_reason_id_foreign` |
| `user_id` | `users` | `id` | `payments_user_id_foreign` |
| `voucher_detail_id` | `voucher_details` | `id` | `payments_voucher_detail_id_foreign` |
| `voucher_id` | `vouchers` | `id` | `payments_voucher_id_foreign` |

### `product_money_loans`

| Columna | → Tabla | → Columna | Constraint |
|---------|---------|-----------|------------|
| `cuotera_id` | `cuoteras` | `id` | `product_money_loans_cuotera_id_foreign` |
| `user_id` | `users` | `id` | `product_money_loans_user_id_foreign` |

## Coherencia con JOINs del repo

- `contract_closed_dates.contract_id` → `contracts.id` (**FK real**).
- `payments.contract_id` → `contracts.id` (**FK real**).
- `account_payment_ways.payment_id` → `payments.id` (**FK real**).
- `detail_client_portfolios.contract_id` → `contracts.id`; `clientportfolio_id` → `client_portfolios.id` (**FK reales**).
- `contracting_entities.contract_id` → `contracts.id`; `debitentity_id` → `debit_entities.id` (**FK reales**).

## Mantenimiento

Si cambia el esquema en MySQL, regenerar este anexo (o uno nuevo fechado) y actualizar la referencia en `docs/base.md`.
