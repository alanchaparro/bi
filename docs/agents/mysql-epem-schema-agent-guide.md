# Guía de esquema MySQL `epem` (para agentes y desarrollo)

> **Generado automáticamente** — no editar a mano. Regenerar con `python scripts/mysql_schema_to_agent_guide.py`.

- **Fecha:** 2026-04-08
- **Motor:** MySQL `8.0.27`
- **Base:** `epem`
- **Credenciales:** nunca en este archivo; usar `MYSQL_*` en `.env` local (ver `.env.example`).

## Cómo usar esta guía (orden de precedencia)

1. **`AGENTS.md`** — reglas de negocio y políticas del proyecto (cierre/gestión, tramos, exclusiones, etc.).
2. **`docs/base.md`** — qué tablas entran en sync, JOINs alineados a `sql/v2/*`, inventario operativo.
3. **Este documento** — catálogo **declarado** en MySQL (columnas, PK, FK). Útil para proponer JOINs coherentes con el motor; la **verdad operativa** del pipeline sigue siendo cada `query_*.sql` versionado.
4. Si el esquema cambió en el servidor, regenerar este MD y, si aplica, actualizar `docs/base.md` y anexos bajo `archive-md-no-canonico/docs/archive/` (ver `scripts/dump_epem_fks.ps1`).

## Resumen numérico

| Métrica | Valor |
|---------|------:|
| Tablas (`BASE TABLE`) | 546 |
| Restricciones FK (filas en `KEY_COLUMN_USAGE` con referencia) | 1536 |
| Grupos de FK únicos (`TABLE` + `CONSTRAINT_NAME`) | 1536 |

## Tablas más referenciadas (grado entrante)

Útil para ubicar **entidades pivote** (muchas tablas apuntan aquí).

| Tabla referenciada | # referencias (columnas FK entrantes) |
|--------------------|----------------------------------------:|
| `users` | 428 |
| `clients` | 77 |
| `contracts` | 77 |
| `enterprises` | 73 |
| `branches` | 53 |
| `doctors` | 31 |
| `social_reasons` | 30 |
| `dental_offices` | 27 |
| `vouchers` | 21 |
| `insurances` | 21 |
| `people` | 19 |
| `services_doctors` | 18 |
| `purchases` | 18 |
| `employee_contracts` | 18 |
| `cities` | 15 |
| `purchases_products` | 14 |
| `purchases_providers` | 12 |
| `esth_treatments` | 12 |
| `deposits` | 12 |
| `bank_accounts` | 11 |
| `currencies` | 11 |
| `cash_boxes` | 11 |
| `payments` | 10 |
| `calendar_events` | 10 |
| `dental_budgets` | 10 |

## Grafo compacto de FK (Mermaid)

Solo aristas **tabla → tabla** (sin columnas), para visión rápida. En esquemas muy grandes se trunca el número de aristas.

```mermaid
flowchart LR
  account_payment_ways["account_payment_ways"] --> payments["payments"]
  account_payment_ways["account_payment_ways"] --> payment_methods["payment_methods"]
  account_payments["account_payments"] --> contract_fees["contract_fees"]
  account_payments["account_payments"] --> payments["payments"]
  accounting_closings["accounting_closings"] --> social_reasons["social_reasons"]
  accounting_entries["accounting_entries"] --> accounting_entries["accounting_entries"]
  accounting_entries["accounting_entries"] --> social_reasons["social_reasons"]
  accounting_entries["accounting_entries"] --> users["users"]
  accounting_entry_details["accounting_entry_details"] --> accounting_entries["accounting_entries"]
  accounting_entry_details["accounting_entry_details"] --> accounting_plans["accounting_plans"]
  accounting_entry_details["accounting_entry_details"] --> branches["branches"]
  accounting_entry_details["accounting_entry_details"] --> cost_centers["cost_centers"]
  accounting_plan_unions["accounting_plan_unions"] --> accounting_plans["accounting_plans"]
  accounting_plan_unions["accounting_plan_unions"] --> social_reasons["social_reasons"]
  accounting_plans["accounting_plans"] --> accounting_types["accounting_types"]
  accounting_plans["accounting_plans"] --> social_reasons["social_reasons"]
  accounting_plans["accounting_plans"] --> accounting_plans["accounting_plans"]
  accounting_type_ivas["accounting_type_ivas"] --> accounting_plans["accounting_plans"]
  accounting_type_ivas["accounting_type_ivas"] --> social_reasons["social_reasons"]
  accounting_types["accounting_types"] --> users["users"]
  accruals["accruals"] --> enterprises["enterprises"]
  acknowledgment_receipt_details["acknowledgment_receipt_details"] --> client_laboratories["client_laboratories"]
  acknowledgment_receipt_details["acknowledgment_receipt_details"] --> acknowledgment_receipts["acknowledgment_receipts"]
  acknowledgment_receipts["acknowledgment_receipts"] --> clients["clients"]
  acknowledgment_receipts["acknowledgment_receipts"] --> dental_offices["dental_offices"]
  ad_sets_portfolios["ad_sets_portfolios"] --> ad_sets["ad_sets"]
  ad_sets_portfolios["ad_sets_portfolios"] --> sale_portfolios["sale_portfolios"]
  additional_service_contract["additional_service_contract"] --> additional_services["additional_services"]
  additional_service_contract["additional_service_contract"] --> contracts["contracts"]
  additional_services["additional_services"] --> enterprises["enterprises"]
  additional_services["additional_services"] --> users["users"]
  address_facturacion_electronica["address_facturacion_electronica"] --> clients["clients"]
  addresses["addresses"] --> cities["cities"]
  addresses["addresses"] --> clients["clients"]
  addresses["addresses"] --> contracts["contracts"]
  addresses["addresses"] --> neighborhoods["neighborhoods"]
  agent_schedules["agent_schedules"] --> users["users"]
  agent_schedules["agent_schedules"] --> tracking_teams["tracking_teams"]
  anticipated_cancelations["anticipated_cancelations"] --> contracts["contracts"]
  anticipated_cancelations["anticipated_cancelations"] --> users["users"]
  assistances["assistances"] --> employee_contract_assistances["employee_contract_assistances"]
  assistances["assistances"] --> people["people"]
  assistances["assistances"] --> users["users"]
  balance_changes["balance_changes"] --> clients["clients"]
  balance_changes["balance_changes"] --> client_service_advances["client_service_advances"]
  balance_changes["balance_changes"] --> users["users"]
  bancard_card_contracts["bancard_card_contracts"] --> bancard_cards["bancard_cards"]
  bancard_card_contracts["bancard_card_contracts"] --> contracts["contracts"]
  bancard_card_contracts["bancard_card_contracts"] --> request_changes["request_changes"]
  bancard_cards["bancard_cards"] --> clients["clients"]
  bancard_cards["bancard_cards"] --> users["users"]
  bancard_cards["bancard_cards"] --> enterprises["enterprises"]
  bancard_cards["bancard_cards"] --> phone_numbers["phone_numbers"]
  bank_account_balances["bank_account_balances"] --> bank_accounts["bank_accounts"]
  bank_account_balances["bank_account_balances"] --> banks["banks"]
  bank_account_balances["bank_account_balances"] --> social_reasons["social_reasons"]
  bank_accounts["bank_accounts"] --> banks["banks"]
  bank_accounts["bank_accounts"] --> social_reasons["social_reasons"]
  bank_accounts["bank_accounts"] --> users["users"]
  bank_concepts["bank_concepts"] --> users["users"]
  bank_details["bank_details"] --> bank_accounts["bank_accounts"]
  bank_details["bank_details"] --> bank_concepts["bank_concepts"]
  bank_details["bank_details"] --> banks["banks"]
  bank_details["bank_details"] --> cash_box_details["cash_box_details"]
  bank_details["bank_details"] --> check_books["check_books"]
  bank_details["bank_details"] --> users["users"]
  bank_details["bank_details"] --> purchases_providers["purchases_providers"]
  bank_transfer_details["bank_transfer_details"] --> bank_transfers["bank_transfers"]
  bank_transfer_details["bank_transfer_details"] --> branches["branches"]
  bank_transfer_details["bank_transfer_details"] --> clients["clients"]
  bank_transfer_details["bank_transfer_details"] --> contracts["contracts"]
  bank_transfer_details["bank_transfer_details"] --> enterprises["enterprises"]
  bank_transfer_details["bank_transfer_details"] --> vouchers["vouchers"]
  bank_transfers["bank_transfers"] --> bank_accounts["bank_accounts"]
  bank_transfers["bank_transfers"] --> payment_methods["payment_methods"]
  bank_transfers["bank_transfers"] --> banks["banks"]
  bank_transfers["bank_transfers"] --> social_reasons["social_reasons"]
  bank_transfers["bank_transfers"] --> users["users"]
  banks["banks"] --> users["users"]
  banks_contract_debit_details["banks_contract_debit_details"] --> banks_contract_debits["banks_contract_debits"]
  banks_contract_debit_details["banks_contract_debit_details"] --> contracts["contracts"]
  banks_contract_debits["banks_contract_debits"] --> debit_entities["debit_entities"]
  bicsas["bicsas"] --> clients["clients"]
  bicsas["bicsas"] --> users["users"]
  branch_cost_centers["branch_cost_centers"] --> branches["branches"]
  branch_cost_centers["branch_cost_centers"] --> cost_centers["cost_centers"]
  branch_cost_centers["branch_cost_centers"] --> users["users"]
  branches["branches"] --> users["users"]
  business_departments["business_departments"] --> gerencies["gerencies"]
  cadastres["cadastres"] --> contracts["contracts"]
  cadastres["cadastres"] --> debit_entities["debit_entities"]
  cadastres["cadastres"] --> users["users"]
  calendar_event_chats["calendar_event_chats"] --> calendar_events["calendar_events"]
  calendar_event_chats["calendar_event_chats"] --> users["users"]
  calendar_event_rooms["calendar_event_rooms"] --> calendar_events["calendar_events"]
  calendar_event_rooms["calendar_event_rooms"] --> dental_office_rooms["dental_office_rooms"]
  calendar_event_rooms["calendar_event_rooms"] --> esth_treatments["esth_treatments"]
  calendar_events["calendar_events"] --> users["users"]
  calendar_events["calendar_events"] --> clients["clients"]
  calendar_events["calendar_events"] --> contracts["contracts"]
  calendar_events["calendar_events"] --> credit_note_reason["credit_note_reason"]
  calendar_events["calendar_events"] --> dental_offices["dental_offices"]
  calendar_events["calendar_events"] --> doctors["doctors"]
  calendar_events["calendar_events"] --> enterprises["enterprises"]
  calendar_events["calendar_events"] --> esth_protocols["esth_protocols"]
  calendar_events["calendar_events"] --> insurances["insurances"]
  calendar_events["calendar_events"] --> especialities["especialities"]
  calendar_events_doctor_services["calendar_events_doctor_services"] --> calendar_events["calendar_events"]
  calendar_events_doctor_services["calendar_events_doctor_services"] --> esth_treatments["esth_treatments"]
  calendar_events_doctor_services["calendar_events_doctor_services"] --> procedures["procedures"]
  calendar_events_doctor_services["calendar_events_doctor_services"] --> services_doctors["services_doctors"]
  calendar_payments["calendar_payments"] --> currencies["currencies"]
  calendar_payments["calendar_payments"] --> calendar_payments["calendar_payments"]
  calendar_payments["calendar_payments"] --> purchases["purchases"]
  calendar_payments["calendar_payments"] --> purchases_collects["purchases_collects"]
  calendar_payments["calendar_payments"] --> purchases_providers["purchases_providers"]
  calendar_payments["calendar_payments"] --> services["services"]
  calendar_payments["calendar_payments"] --> social_reasons["social_reasons"]
  calendar_payments["calendar_payments"] --> users["users"]
  call_center_call_phones["call_center_call_phones"] --> call_center_calls["call_center_calls"]
  call_center_call_phones["call_center_call_phones"] --> recovery_trackings["recovery_trackings"]
  call_center_call_phones["call_center_call_phones"] --> sales_opportunity_trackings["sales_opportunity_trackings"]
  call_center_calls["call_center_calls"] --> clients["clients"]
  call_center_calls["call_center_calls"] --> contracts["contracts"]
  call_center_calls["call_center_calls"] --> sales_opportunities["sales_opportunities"]
  call_center_calls["call_center_calls"] --> users["users"]
  call_center_pause_motives["call_center_pause_motives"] --> users["users"]
  call_center_pauses["call_center_pauses"] --> users["users"]
  campaigns["campaigns"] --> branches["branches"]
  campaigns["campaigns"] --> enterprises["enterprises"]
  card_prints["card_prints"] --> clients["clients"]
  card_prints["card_prints"] --> contracts["contracts"]
  card_prints["card_prints"] --> enterprises["enterprises"]
  card_prints["card_prints"] --> insurances["insurances"]
  card_prints["card_prints"] --> users["users"]
  cases_to_calls["cases_to_calls"] --> calendar_events["calendar_events"]
  cases_to_calls["cases_to_calls"] --> users["users"]
  cases_to_calls["cases_to_calls"] --> clients["clients"]
  cases_to_calls["cases_to_calls"] --> contracts["contracts"]
  cases_to_calls["cases_to_calls"] --> enterprises["enterprises"]
  cases_to_calls_details["cases_to_calls_details"] --> cases_to_calls["cases_to_calls"]
  cases_to_calls_details["cases_to_calls_details"] --> dental_budgets["dental_budgets"]
  cases_to_calls_details["cases_to_calls_details"] --> dental_offices["dental_offices"]
  cases_to_calls_movements["cases_to_calls_movements"] --> cases_to_calls["cases_to_calls"]
  cases_to_calls_movements["cases_to_calls_movements"] --> users["users"]
  cases_to_calls_trackings["cases_to_calls_trackings"] --> cases_to_calls["cases_to_calls"]
  cases_to_calls_trackings["cases_to_calls_trackings"] --> clients["clients"]
  cases_to_calls_trackings["cases_to_calls_trackings"] --> polls_services["polls_services"]
  cases_to_calls_trackings["cases_to_calls_trackings"] --> users["users"]
  cash_box_bank_accounts["cash_box_bank_accounts"] --> bank_accounts["bank_accounts"]
  cash_box_bank_accounts["cash_box_bank_accounts"] --> cash_boxes["cash_boxes"]
  cash_box_close_details["cash_box_close_details"] --> cash_box_closes["cash_box_closes"]
  cash_box_closes["cash_box_closes"] --> users["users"]
  cash_box_closes["cash_box_closes"] --> cash_boxes["cash_boxes"]
  cash_box_closes["cash_box_closes"] --> currencies["currencies"]
  cash_box_concepts["cash_box_concepts"] --> users["users"]
  cash_box_details["cash_box_details"] --> bank_accounts["bank_accounts"]
  cash_box_details["cash_box_details"] --> bank_details["bank_details"]
  cash_box_details["cash_box_details"] --> cash_box_closes["cash_box_closes"]
  cash_box_details["cash_box_details"] --> cash_box_concepts["cash_box_concepts"]
  cash_box_details["cash_box_details"] --> cash_boxes["cash_boxes"]
  cash_box_details["cash_box_details"] --> contracts["contracts"]
  cash_box_details["cash_box_details"] --> currencies["currencies"]
  cash_box_details["cash_box_details"] --> users["users"]
  cash_box_details["cash_box_details"] --> cash_box_details["cash_box_details"]
  cash_box_details["cash_box_details"] --> payments["payments"]
  cash_box_details["cash_box_details"] --> vouchers["vouchers"]
  cash_box_payment_methods["cash_box_payment_methods"] --> cash_boxes["cash_boxes"]
  cash_box_payment_methods["cash_box_payment_methods"] --> payment_methods["payment_methods"]
  cash_box_users["cash_box_users"] --> cash_boxes["cash_boxes"]
  cash_box_users["cash_box_users"] --> users["users"]
  cash_box_voucher_boxes["cash_box_voucher_boxes"] --> cash_boxes["cash_boxes"]
  cash_box_voucher_boxes["cash_box_voucher_boxes"] --> voucher_boxes["voucher_boxes"]
  cash_boxes["cash_boxes"] --> branches["branches"]
  cash_boxes["cash_boxes"] --> enterprises["enterprises"]
  cash_boxes["cash_boxes"] --> cash_boxes["cash_boxes"]
  cash_boxes["cash_boxes"] --> users["users"]
  cell_payments["cell_payments"] --> contracts["contracts"]
  cell_payments["cell_payments"] --> users["users"]
  check_books["check_books"] --> bank_accounts["bank_accounts"]
  check_books["check_books"] --> users["users"]
  check_discount_deposits["check_discount_deposits"] --> bank_accounts["bank_accounts"]
  check_discount_deposits["check_discount_deposits"] --> bank_details["bank_details"]
  check_discount_deposits["check_discount_deposits"] --> users["users"]
  check_discounts["check_discounts"] --> banks["banks"]
  check_discounts["check_discounts"] --> check_discount_deposits["check_discount_deposits"]
  check_discounts["check_discounts"] --> check_discounts["check_discounts"]
  check_discounts["check_discounts"] --> contract_fees["contract_fees"]
  check_discounts["check_discounts"] --> contracts["contracts"]
  check_discounts["check_discounts"] --> clients["clients"]
  cities["cities"] --> departments["departments"]
  cities["cities"] --> users["users"]
  client_credit_days["client_credit_days"] --> clients["clients"]
  client_credit_days["client_credit_days"] --> contracts["contracts"]
  client_doctor_infusion["client_doctor_infusion"] --> clients["clients"]
  client_doctor_infusion["client_doctor_infusion"] --> doctor_infusions["doctor_infusions"]
  client_files["client_files"] --> clients["clients"]
  client_files["client_files"] --> contracts["contracts"]
  client_files["client_files"] --> users["users"]
  client_images["client_images"] --> clients["clients"]
  client_laboratories["client_laboratories"] --> clients["clients"]
  client_laboratories["client_laboratories"] --> client_laboratories["client_laboratories"]
  client_laboratories["client_laboratories"] --> client_services["client_services"]
  client_laboratories["client_laboratories"] --> users["users"]
  client_laboratories["client_laboratories"] --> dental_budgets["dental_budgets"]
  client_laboratories["client_laboratories"] --> dental_offices["dental_offices"]
  client_laboratories["client_laboratories"] --> doctors["doctors"]
  client_laboratories["client_laboratories"] --> laboratories["laboratories"]
  client_laboratories["client_laboratories"] --> laboratory_jobs["laboratory_jobs"]
  client_laboratories["client_laboratories"] --> denpro_motive_rejecteds["denpro_motive_rejecteds"]
  client_laboratories["client_laboratories"] --> services_doctors["services_doctors"]
  client_laboratories["client_laboratories"] --> vouchers["vouchers"]
  client_portfolios["client_portfolios"] --> collection_sections["collection_sections"]
  client_portfolios["client_portfolios"] --> users["users"]
  client_service_advances["client_service_advances"] --> clients["clients"]
  client_service_advances["client_service_advances"] --> client_service_debts["client_service_debts"]
  client_service_advances["client_service_advances"] --> dental_budgets["dental_budgets"]
  client_service_advances["client_service_advances"] --> enterprises["enterprises"]
  client_service_advances["client_service_advances"] --> vouchers["vouchers"]
  client_service_debts["client_service_debts"] --> clients["clients"]
  client_service_debts["client_service_debts"] --> client_services["client_services"]
  client_service_debts["client_service_debts"] --> enterprises["enterprises"]
  client_service_expiration_details["client_service_expiration_details"] --> client_service_advances["client_service_advances"]
  client_service_expiration_details["client_service_expiration_details"] --> client_service_expirations["client_service_expirations"]
  client_service_expiration_details["client_service_expiration_details"] --> users["users"]
  client_service_payments["client_service_payments"] --> client_service_advances["client_service_advances"]
  client_service_payments["client_service_payments"] --> client_service_debts["client_service_debts"]
  client_service_payments["client_service_payments"] --> users["users"]
  client_services["client_services"] --> calendar_events["calendar_events"]
  client_services["client_services"] --> clients["clients"]
  client_services["client_services"] --> client_images["client_images"]
  client_services["client_services"] --> doctors["doctors"]
  client_services["client_services"] --> contracts["contracts"]
  client_services["client_services"] --> dental_budget_details["dental_budget_details"]
  client_services["client_services"] --> dental_offices["dental_offices"]
  client_services["client_services"] --> insurances["insurances"]
  client_services["client_services"] --> services_authorization_details["services_authorization_details"]
  client_services["client_services"] --> services_doctors["services_doctors"]
  client_services["client_services"] --> users["users"]
  client_tokens["client_tokens"] --> clients["clients"]
  client_treatment_orthodontics["client_treatment_orthodontics"] --> brackets["brackets"]
  client_treatment_orthodontics["client_treatment_orthodontics"] --> clients["clients"]
  client_treatment_orthodontics["client_treatment_orthodontics"] --> contracts["contracts"]
  client_treatment_orthodontics["client_treatment_orthodontics"] --> dental_offices["dental_offices"]
  client_treatment_orthodontics["client_treatment_orthodontics"] --> doctors["doctors"]
  client_treatment_orthodontics["client_treatment_orthodontics"] --> users["users"]
  client_turn_portfolio_details["client_turn_portfolio_details"] --> clients["clients"]
  client_turn_portfolio_details["client_turn_portfolio_details"] --> client_turn_portfolios["client_turn_portfolios"]
  client_turn_portfolio_details["client_turn_portfolio_details"] --> contracts["contracts"]
  client_turn_portfolios["client_turn_portfolios"] --> users["users"]
  client_types["client_types"] --> users["users"]
  clients["clients"] --> client_turn_portfolios["client_turn_portfolios"]
  clients["clients"] --> clients_enterprises["clients_enterprises"]
  clients["clients"] --> users["users"]
  clients["clients"] --> dental_offices["dental_offices"]
  clients["clients"] --> infusion_diagnoses["infusion_diagnoses"]
  clients["clients"] --> infusion_prices["infusion_prices"]
  clients["clients"] --> doctors["doctors"]
  clients["clients"] --> cases_to_calls_trackings["cases_to_calls_trackings"]
  clients["clients"] --> nationalities["nationalities"]
  clients_enterprises["clients_enterprises"] --> users["users"]
  clients_enterprises_addresses["clients_enterprises_addresses"] --> cities["cities"]
  clients_enterprises_addresses["clients_enterprises_addresses"] --> clients_enterprises["clients_enterprises"]
  clients_enterprises_addresses["clients_enterprises_addresses"] --> neighborhoods["neighborhoods"]
  clients_enterprises_emails["clients_enterprises_emails"] --> clients_enterprises["clients_enterprises"]
  clients_enterprises_phones["clients_enterprises_phones"] --> clients_enterprises["clients_enterprises"]
  clinic_histories["clinic_histories"] --> clients["clients"]
  closed_invoices["closed_invoices"] --> branches["branches"]
  closed_invoices["closed_invoices"] --> enterprises["enterprises"]
  closed_invoices["closed_invoices"] --> service_invoices["service_invoices"]
  closing_inventory_stock_details["closing_inventory_stock_details"] --> closing_inventory_stocks["closing_inventory_stocks"]
  closing_inventory_stock_details["closing_inventory_stock_details"] --> deposits["deposits"]
  closing_inventory_stock_details["closing_inventory_stock_details"] --> purchases_products["purchases_products"]
  closing_inventory_stocks["closing_inventory_stocks"] --> users["users"]
  coll_agent_goal_config_details["coll_agent_goal_config_details"] --> collection_agents_goal_configs["collection_agents_goal_configs"]
  collection_agents_goal_configs["collection_agents_goal_configs"] --> enterprises["enterprises"]
  collection_form_details["collection_form_details"] --> collection_forms["collection_forms"]
  collection_form_details["collection_form_details"] --> contracts["contracts"]
  collection_form_details["collection_form_details"] --> payments["payments"]
  collection_forms["collection_forms"] --> debit_entities["debit_entities"]
```

*Aristas mostradas en el diagrama: 280 de 1318 únicas (límite `--max-mermaid-edges 280`). Aumente el límite o omita el diagrama con `--max-mermaid-edges 0`.*

## Catálogo por tabla

Para cada tabla: motor/filas estimadas, PK, columnas, FK salientes y tablas que referencian esta.

### `account_payment_ways`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1827391`  

- **PK:** `id`

**Referenciada por (muestra):**
- `collection_income_details` → `account_payment_ways` (`collection_income_details_account_payment_way_id_foreign`)
- `commission_payment_details` → `account_payment_ways` (`commission_payment_details_account_payment_way_id_foreign`)

**FK salientes:**

- `account_payment_ways_payment_id_foreign`: (`payment_id`) → `payments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `account_payment_ways_payment_method_id_foreign`: (`payment_method_id`) → `payment_methods` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `payment_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `payment_method_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `account_payments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2253246`  

- **PK:** `id`

**FK salientes:**

- `account_payments_contract_fee_id_foreign`: (`contract_fee_id`) → `contract_fees` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `account_payments_payment_id_foreign`: (`payment_id`) → `payments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `payment_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `contract_fee_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `esth_package_fee_id` | `int unsigned` | YES | `` | NULL | `` |  |
| `amount` | `decimal(13,2)` | NO | `` | NULL | `` |  |
| `amount_interest` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `amount_capital` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `interest_moratorium` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `interest_punitive` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `iva` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `amount_treatments` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `amount_quota` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `accounting_closings`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `299`  

- **PK:** `id`

**FK salientes:**

- `accounting_closings_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `social_reason_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `billing_status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `purchase_status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `treasury_status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `accountig_status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `cash_status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `collection_status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `payment_status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `stock_status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `odontology_status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `accrual_status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `from_date` | `date` | NO | `` | NULL | `` |  |
| `until_date` | `date` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `accounting_entries`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2968098`  

- **PK:** `id`

**Referenciada por (muestra):**
- `accounting_entries` → `accounting_entries` (`accounting_entries_old_accounting_entry_id_foreign`)
- `accounting_entry_details` → `accounting_entries` (`accounting_entry_details_accounting_entry_id_foreign`)

**FK salientes:**

- `accounting_entries_old_accounting_entry_id_foreign`: (`old_accounting_entry_id`) → `accounting_entries` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `accounting_entries_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `accounting_entries_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `social_reason_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `number` | `int` | NO | `` | NULL | `` |  |
| `date` | `date` | NO | `MUL` | NULL | `` |  |
| `type` | `tinyint unsigned` | NO | `` | NULL | `` |  |
| `accounting_movement_type` | `int` | YES | `` | NULL | `` |  |
| `concept` | `varchar(191)` | NO | `` | NULL | `` |  |
| `observation` | `varchar(191)` | YES | `` | NULL | `` |  |
| `voucher_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `total` | `decimal(14,2)` | YES | `` | NULL | `` |  |
| `fromable_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `old_accounting_entry_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `fromable_type` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `accounting_entry_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `7746637`  

- **PK:** `id`

**FK salientes:**

- `accounting_entry_details_accounting_entry_id_foreign`: (`accounting_entry_id`) → `accounting_entries` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `accounting_entry_details_accounting_plan_id_foreign`: (`accounting_plan_id`) → `accounting_plans` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `accounting_entry_details_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `accounting_entry_details_cost_center_id_foreign`: (`cost_center_id`) → `cost_centers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `accounting_entry_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `accounting_plan_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `cost_center_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `concept` | `varchar(191)` | YES | `` | NULL | `` |  |
| `voucher_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `debit` | `decimal(14,2)` | YES | `` | NULL | `` |  |
| `credit` | `decimal(14,2)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `accounting_plan_unions`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `35610`  

- **PK:** `id`

**FK salientes:**

- `accounting_plan_unions_accounting_plan_id_foreign`: (`accounting_plan_id`) → `accounting_plans` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `accounting_plan_unions_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `accountable_id` | `int unsigned` | NO | `` | NULL | `` |  |
| `accountable_type` | `varchar(191)` | NO | `` | NULL | `` |  |
| `social_reason_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `accounting_plan_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `accounting_plans`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2805`  

- **PK:** `id`

**Referenciada por (muestra):**
- `accounting_entry_details` → `accounting_plans` (`accounting_entry_details_accounting_plan_id_foreign`)
- `accounting_plan_unions` → `accounting_plans` (`accounting_plan_unions_accounting_plan_id_foreign`)
- `accounting_plans` → `accounting_plans` (`accounting_plans_top_account_id_foreign`)
- `accounting_type_ivas` → `accounting_plans` (`accounting_type_ivas_accounting_plan_id_foreign`)
- `interest_accrual_details` → `accounting_plans` (`interest_accrual_details_accounting_plan_id_foreign`)
- `model_accounting_entry_details` → `accounting_plans` (`model_accounting_entry_details_accounting_plan_id_foreign`)
- `purchases_accounting_plans` → `accounting_plans` (`purchases_accounting_plans_accounting_plan_id_foreign`)
- `purchases_details` → `accounting_plans` (`purchases_details_accounting_plan_id_foreign`)

**FK salientes:**

- `accounting_plans_accounting_type_id_foreign`: (`accounting_type_id`) → `accounting_types` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `accounting_plans_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `accounting_plans_top_account_id_foreign`: (`top_account_id`) → `accounting_plans` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `social_reason_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `number` | `varchar(191)` | NO | `` | NULL | `` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `top_account_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `accounting_type_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `fixed_asset` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `level` | `tinyint` | NO | `` | NULL | `` |  |
| `type` | `tinyint` | NO | `` | NULL | `` |  |
| `title` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `setteable` | `tinyint` | NO | `` | NULL | `` |  |
| `status` | `tinyint` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `accounting_type_ivas`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `50`  

- **PK:** `id`

**FK salientes:**

- `accounting_type_ivas_accounting_plan_id_foreign`: (`accounting_plan_id`) → `accounting_plans` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `accounting_type_ivas_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `type_iva` | `smallint unsigned` | NO | `` | NULL | `` |  |
| `social_reason_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `accounting_plan_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `accounting_types`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `30`  

- **PK:** `id`

**Referenciada por (muestra):**
- `accounting_plans` → `accounting_types` (`accounting_plans_accounting_type_id_foreign`)

**FK salientes:**

- `accounting_types_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `type` | `int` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `accruals`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `49384`  

- **PK:** `id`

**FK salientes:**

- `accruals_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `type` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `data_json` | `longtext` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `accounting_seated` | `tinyint(1)` | NO | `` | 0 | `` |  |

### `acknowledgment_receipt_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `45855`  

- **PK:** `id`

**FK salientes:**

- `acknowledgment_receipt_details_client_laboratory_id_foreign`: (`client_laboratory_id`) → `client_laboratories` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `acknowledgment_receipt_details_receipt_id_foreign`: (`receipt_id`) → `acknowledgment_receipts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `receipt_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `client_laboratory_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `acknowledgment_receipts`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `5620`  

- **PK:** `id`

**Referenciada por (muestra):**
- `acknowledgment_receipt_details` → `acknowledgment_receipts` (`acknowledgment_receipt_details_receipt_id_foreign`)

**FK salientes:**

- `acknowledgment_receipts_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `acknowledgment_receipts_dental_office_id_foreign`: (`dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `receipt_number` | `int` | NO | `` | NULL | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `client_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `dental_office_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `ad_sets`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `556`  

- **PK:** `id`

**Referenciada por (muestra):**
- `ad_sets_portfolios` → `ad_sets` (`ad_sets_portfolios_ad_set_id_foreign`)
- `sales_opportunities` → `ad_sets` (`sales_opportunities_ad_set_id_foreign`)

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `adset_name` | `varchar(255)` | NO | `` | NULL | `` |  |
| `adset_description` | `varchar(191)` | YES | `` | NULL | `` |  |
| `adset_url` | `varchar(191)` | YES | `` | NULL | `` |  |
| `adset_image` | `varchar(191)` | YES | `` | NULL | `` |  |
| `meta_ad_id` | `varchar(191)` | YES | `` | NULL | `` |  |
| `status` | `tinyint` | NO | `` | 1 | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `ad_sets_portfolios`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `3079`  

- **PK:** `id`

**FK salientes:**

- `ad_sets_portfolios_ad_set_id_foreign`: (`ad_set_id`) → `ad_sets` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `ad_sets_portfolios_sale_portfolio_id_foreign`: (`sale_portfolio_id`) → `sale_portfolios` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `ad_set_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `sale_portfolio_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `additional_service_contract`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `6501`  

- **PK:** `id`

**FK salientes:**

- `additional_service_contract_additional_service_id_foreign`: (`additional_service_id`) → `additional_services` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `additional_service_contract_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `additional_service_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `double` | NO | `` | NULL | `` |  |
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `additional_services`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `31`  

- **PK:** `id`

**Referenciada por (muestra):**
- `additional_service_contract` → `additional_services` (`additional_service_contract_additional_service_id_foreign`)
- `crm_products` → `additional_services` (`crm_products_additional_service_id_foreign`)

**FK salientes:**

- `additional_services_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `additional_services_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `service` | `varchar(191)` | NO | `` | NULL | `` |  |
| `amount` | `int` | NO | `` | NULL | `` |  |
| `image` | `varchar(191)` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `address_facturacion_electronica`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `11`  

- **PK:** `id`

**FK salientes:**

- `address_facturacion_electronica_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `cod_departamento` | `int unsigned` | NO | `` | NULL | `` |  |
| `desc_departamento` | `varchar(191)` | NO | `` | NULL | `` |  |
| `cod_distrito` | `int unsigned` | NO | `` | NULL | `` |  |
| `desc_distrito` | `varchar(191)` | NO | `` | NULL | `` |  |
| `cod_ciudad` | `int unsigned` | NO | `` | NULL | `` |  |
| `desc_ciudad` | `varchar(191)` | NO | `` | NULL | `` |  |
| `nro_casa` | `int unsigned` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `addresses`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `410585`  

- **PK:** `id`

**Referenciada por (muestra):**
- `contracts` → `addresses` (`contracts_coverage_address_id_foreign`)
- `infusions` → `addresses` (`infusions_address_id_foreign`)
- `payments` → `addresses` (`payments_address_id_foreign`)
- `recovery_trackings` → `addresses` (`recovery_trackings_address_id_foreign`)

**FK salientes:**

- `addresses_city_id_foreign`: (`city_id`) → `cities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `addresses_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `addresses_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `addresses_neighborhood_id_foreign`: (`neighborhood_id`) → `neighborhoods` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `address` | `varchar(191)` | NO | `` | NULL | `` |  |
| `type_address` | `int` | NO | `` | NULL | `` |  |
| `neighborhood_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `deleted_at` | `datetime` | YES | `` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `city_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `location` | `mediumtext` | YES | `` | NULL | `` |  |
| `neighborhood_old` | `varchar(191)` | YES | `` |  | `` |  |
| `image` | `varchar(191)` | YES | `` | NULL | `` |  |

### `agent_schedules`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `97`  

- **PK:** `id`

**FK salientes:**

- `agent_schedules_created_user_id_foreign`: (`created_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `agent_schedules_deleted_user_id_foreign`: (`deleted_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `agent_schedules_tracking_team_id_foreign`: (`tracking_team_id`) → `tracking_teams` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `tracking_team_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `deleted_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `valid_since` | `date` | NO | `` | NULL | `` |  |
| `valid_until` | `date` | NO | `` | NULL | `` |  |
| `work_start` | `time` | NO | `` | NULL | `` |  |
| `work_end` | `time` | NO | `` | NULL | `` |  |
| `day` | `varchar(191)` | NO | `` | NULL | `` |  |
| `deleted_reason` | `varchar(191)` | YES | `` | NULL | `` |  |
| `cases_to_call_type` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `varchar(191)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `annexed_sheet_items`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `28`  

- **PK:** `id`

**Referenciada por (muestra):**
- `employee_contract_annexed_items` → `annexed_sheet_items` (`employee_contract_annexed_items_annexed_sheet_item_id_foreign`)

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `description` | `varchar(191)` | NO | `` | NULL | `` |  |
| `employee_type` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `anticipated_cancelations`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `anticipated_cancelations_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `anticipated_cancelations_user_delete_id_foreign`: (`user_delete_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `anticipated_cancelations_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `total_count` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `total_discount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `total_amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_delete_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `date_delete` | `datetime` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `api_request_client_status`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `8`  

- **PK:** `id`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `token` | `varchar(191)` | NO | `` | NULL | `` |  |
| `document_number` | `varchar(191)` | NO | `` | NULL | `` |  |
| `headers` | `longtext` | NO | `` | NULL | `` |  |
| `ip` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status_response` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `response` | `longtext` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `asientos`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `5291`  

- **PK:** `id`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `fecha` | `date` | YES | `` | NULL | `` |  |
| `cuenta` | `varchar(50)` | YES | `` | NULL | `` |  |
| `nombre` | `varchar(100)` | YES | `` | NULL | `` |  |
| `concepto` | `varchar(100)` | YES | `` | NULL | `` |  |
| `centro_de_costo` | `varchar(50)` | YES | `` | NULL | `` |  |
| `debe` | `decimal(15,2)` | YES | `` | NULL | `` |  |
| `haber` | `decimal(15,2)` | YES | `` | NULL | `` |  |
| `nro_asiento` | `int` | YES | `` | NULL | `` |  |
| `razon_social_id` | `int` | YES | `` | NULL | `` |  |
| `centro_costo_id` | `int` | YES | `` | NULL | `` |  |
| `status` | `tinyint` | YES | `` | NULL | `` |  |
| `accounting_plan_id` | `int` | YES | `` | NULL | `` |  |
| `accounting_entry_detail_id` | `int` | YES | `` | NULL | `` |  |
| `accounting_entry_id` | `int` | YES | `` | NULL | `` |  |
| `id` | `int` | NO | `PRI` | NULL | `auto_increment` |  |

### `asientos_contables`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `3891`  

- **PK:** `id`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `nro_asiento` | `int` | YES | `` | NULL | `` |  |
| `fecha` | `date` | YES | `` | NULL | `` |  |
| `cuenta` | `varchar(159)` | YES | `` | NULL | `` |  |
| `nombre` | `varchar(159)` | YES | `` | NULL | `` |  |
| `concepto` | `varchar(159)` | YES | `` | NULL | `` |  |
| `centro_de_costo` | `varchar(159)` | YES | `` | NULL | `` |  |
| `debe` | `decimal(15,2)` | YES | `` | NULL | `` |  |
| `haber` | `decimal(15,2)` | YES | `` | NULL | `` |  |
| `razon_social_id` | `int` | YES | `` | NULL | `` |  |
| `status` | `tinyint` | YES | `` | NULL | `` |  |
| `centro_costo_id` | `int` | YES | `` | NULL | `` |  |
| `accounting_plan_id` | `int` | YES | `` | NULL | `` |  |
| `accounting_entry_id` | `int` | YES | `` | NULL | `` |  |
| `accounting_entry_detail_id` | `int` | YES | `` | NULL | `` |  |
| `id` | `int` | NO | `PRI` | NULL | `auto_increment` |  |

### `asientos_corregir`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `568`  

- **PK:** *(no declarada como `PRIMARY` en information_schema)*

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `fecha` | `varchar(15)` | YES | `` | NULL | `` |  |
| `usuario` | `varchar(50)` | YES | `` | NULL | `` |  |
| `tipo` | `varchar(15)` | YES | `` | NULL | `` |  |
| `nro_asiento` | `varchar(10)` | YES | `` | NULL | `` |  |
| `concepto` | `varchar(200)` | YES | `` | NULL | `` |  |
| `importe` | `varchar(15)` | YES | `` | NULL | `` |  |
| `asiento_id` | `int` | YES | `` | NULL | `` |  |
| `compra_id` | `int` | YES | `` | NULL | `` |  |
| `centro_costo` | `mediumtext` | YES | `` | NULL | `` |  |

### `assistances`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `assistances_employee_contract_assistance_id_foreign`: (`employee_contract_assistance_id`) → `employee_contract_assistances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `assistances_people_id_foreign`: (`people_id`) → `people` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `assistances_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `people_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `date` | `datetime` | NO | `` | NULL | `` |  |
| `document_number` | `int` | NO | `` | NULL | `` |  |
| `from_date` | `date` | NO | `` | NULL | `` |  |
| `until_date` | `date` | NO | `` | NULL | `` |  |
| `type` | `int` | NO | `` | NULL | `` |  |
| `assistance_status` | `varchar(191)` | NO | `` | NULL | `` |  |
| `employee_contract_assistance_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `batch` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `audits`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `user_id` | `int unsigned` | YES | `` | NULL | `` |  |
| `event` | `varchar(191)` | NO | `` | NULL | `` |  |
| `auditable_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `auditable_type` | `varchar(191)` | NO | `` | NULL | `` |  |
| `old_values` | `text` | YES | `` | NULL | `` |  |
| `new_values` | `text` | YES | `` | NULL | `` |  |
| `url` | `text` | YES | `` | NULL | `` |  |
| `ip_address` | `varchar(45)` | YES | `` | NULL | `` |  |
| `user_agent` | `varchar(191)` | YES | `` | NULL | `` |  |
| `tags` | `varchar(191)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `balance_changes`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `646`  

- **PK:** `id`

**FK salientes:**

- `balance_changes_client_id_from_foreign`: (`client_id_from`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `balance_changes_client_id_to_foreign`: (`client_id_to`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `balance_changes_client_service_advance_id_foreign`: (`client_service_advance_id`) → `client_service_advances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `balance_changes_new_client_service_advance_id_foreign`: (`new_client_service_advance_id`) → `client_service_advances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `balance_changes_user_id_deleted_foreign`: (`user_id_deleted`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `balance_changes_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `client_service_advance_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `client_id_from` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `client_id_to` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `new_client_service_advance_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `amount` | `int` | NO | `` | NULL | `` |  |
| `user_id_deleted` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `date_deleted` | `date` | YES | `` | NULL | `` |  |
| `reason_delete` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `bancard_card_contracts`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `15957`  

- **PK:** `id`

**FK salientes:**

- `bancard_card_contracts_bancard_card_id_foreign`: (`bancard_card_id`) → `bancard_cards` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bancard_card_contracts_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bancard_card_contracts_request_change_id_foreign`: (`request_change_id`) → `request_changes` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `request_change_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `bancard_card_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `int` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `bancard_cards`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `23721`  

- **PK:** `id`

**Referenciada por (muestra):**
- `bancard_card_contracts` → `bancard_cards` (`bancard_card_contracts_bancard_card_id_foreign`)

**FK salientes:**

- `bancard_cards_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bancard_cards_deleted_user_id_foreign`: (`deleted_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bancard_cards_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bancard_cards_phone_number_id_foreign`: (`phone_number_id`) → `phone_numbers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bancard_cards_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `process_id` | `varchar(191)` | YES | `` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `token` | `longtext` | YES | `` | NULL | `` |  |
| `cadastre_remote_token_expiration` | `datetime` | YES | `` | NULL | `` |  |
| `last_card_used_status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `card_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `account_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `card_type` | `char(10)` | YES | `` | NULL | `` |  |
| `card_expiration` | `varchar(191)` | YES | `` | NULL | `` |  |
| `card_masked_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `card_brand` | `varchar(191)` | YES | `` | NULL | `` |  |
| `phone_number_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `phone_fullnumber` | `varchar(191)` | YES | `` | NULL | `` |  |
| `email` | `varchar(191)` | YES | `` | NULL | `` |  |
| `json_request` | `longtext` | YES | `` | NULL | `` |  |
| `bancard_environment` | `int` | NO | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `iframe_status` | `varchar(191)` | YES | `` | NULL | `` |  |
| `error_message` | `varchar(191)` | YES | `` | NULL | `` |  |
| `cadastre_remote_token` | `varchar(191)` | YES | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `cadastres_type` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `deleted_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `deleted_reason` | `varchar(191)` | YES | `` | NULL | `` |  |
| `deleted_at` | `date` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `json_bancard` | `longtext` | YES | `` | NULL | `` |  |

### `bank_account_balances`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `9342`  

- **PK:** `id`

**FK salientes:**

- `bank_account_balances_bank_account_id_foreign`: (`bank_account_id`) → `bank_accounts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bank_account_balances_bank_id_foreign`: (`bank_id`) → `banks` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bank_account_balances_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `social_reason_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `bank_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `bank_account_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(13,2)` | NO | `` | 0.00 | `` |  |
| `amount_to_confirm` | `decimal(13,2)` | NO | `` | 0.00 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `bank_accounts`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `54`  

- **PK:** `id`

**Referenciada por (muestra):**
- `bank_account_balances` → `bank_accounts` (`bank_account_balances_bank_account_id_foreign`)
- `bank_details` → `bank_accounts` (`bank_details_bank_account_id_foreign`)
- `bank_transfers` → `bank_accounts` (`bank_transfers_bank_account_id_foreign`)
- `cash_box_bank_accounts` → `bank_accounts` (`cash_box_bank_accounts_bank_account_id_foreign`)
- `cash_box_details` → `bank_accounts` (`cash_box_details_bank_account_id_foreign`)
- `check_books` → `bank_accounts` (`check_books_bank_account_id_foreign`)
- `check_discount_deposits` → `bank_accounts` (`check_discount_deposits_bank_account_id_foreign`)
- `collection_incomes` → `bank_accounts` (`collection_incomes_bank_account_id_foreign`)
- `employee_payments` → `bank_accounts` (`employee_payments_bank_account_id_foreign`)
- `op_massives` → `bank_accounts` (`op_massives_bank_account_id_foreign`)
- `vouchers` → `bank_accounts` (`vouchers_bank_account_id_foreign`)

**FK salientes:**

- `bank_accounts_bank_id_foreign`: (`bank_id`) → `banks` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bank_accounts_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bank_accounts_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `account` | `varchar(191)` | NO | `` | NULL | `` |  |
| `social_reason_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `to_name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `type` | `int` | NO | `` | NULL | `` |  |
| `default_debit_account` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `available_deposit` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `bank_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `bank_concepts`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `30`  

- **PK:** `id`

**Referenciada por (muestra):**
- `bank_details` → `bank_concepts` (`bank_details_bank_concept_id_foreign`)

**FK salientes:**

- `bank_concepts_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `type` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `bank_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `241453`  

- **PK:** `id`

**Referenciada por (muestra):**
- `cash_box_details` → `bank_details` (`cash_box_details_bank_detail_id_foreign`)
- `check_discount_deposits` → `bank_details` (`check_discount_deposits_bank_detail_id_foreign`)
- `collection_incomes` → `bank_details` (`collection_incomes_bank_detail_id_foreign`)
- `money_disbursement_payments` → `bank_details` (`money_disbursement_payments_bank_detail_id_foreign`)
- `purchases_accounting_plans` → `bank_details` (`purchases_accounting_plans_bank_detail_id_foreign`)
- `purchases_payments` → `bank_details` (`purchases_payments_bank_detail_id_foreign`)

**FK salientes:**

- `bank_details_bank_account_id_foreign`: (`bank_account_id`) → `bank_accounts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bank_details_bank_concept_id_foreign`: (`bank_concept_id`) → `bank_concepts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bank_details_bank_id_foreign`: (`bank_id`) → `banks` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bank_details_cash_box_detail_id_foreign`: (`cash_box_detail_id`) → `cash_box_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bank_details_check_book_id_foreign`: (`check_book_id`) → `check_books` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bank_details_print_user_id_foreign`: (`print_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bank_details_purchases_provider_id_foreign`: (`purchases_provider_id`) → `purchases_providers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bank_details_user_deleted_foreign`: (`user_deleted`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bank_details_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `cash_box_detail_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `date_payment` | `date` | NO | `` | NULL | `` |  |
| `bank_account_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `bank_concept_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `type` | `tinyint unsigned` | NO | `` | NULL | `` |  |
| `purchases_provider_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `beneficiary` | `varchar(191)` | YES | `` | NULL | `` |  |
| `bank_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `bank_account` | `varchar(191)` | YES | `` | NULL | `` |  |
| `number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `check_book_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `print_status` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `print_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `print_date` | `datetime` | YES | `` | NULL | `` |  |
| `status` | `tinyint unsigned` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `date_deleted` | `datetime` | YES | `` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `accounting_seated` | `tinyint(1)` | NO | `` | 0 | `` |  |

### `bank_transfer_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `102734`  

- **PK:** `id`

**FK salientes:**

- `bank_transfer_details_bank_transfer_id_foreign`: (`bank_transfer_id`) → `bank_transfers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bank_transfer_details_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bank_transfer_details_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bank_transfer_details_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bank_transfer_details_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bank_transfer_details_voucher_id_foreign`: (`voucher_id`) → `vouchers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `bank_transfer_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `intercompany` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `voucher_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `concept` | `varchar(191)` | YES | `` | NULL | `` |  |
| `client_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `amount` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `bank_transfers`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `86451`  

- **PK:** `id`

**Referenciada por (muestra):**
- `bank_transfer_details` → `bank_transfers` (`bank_transfer_details_bank_transfer_id_foreign`)

**FK salientes:**

- `bank_transfers_bank_account_id_foreign`: (`bank_account_id`) → `bank_accounts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bank_transfers_payment_method_id_foreign`: (`payment_method_id`) → `payment_methods` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bank_transfers_receiver_bank_id_foreign`: (`receiver_bank_id`) → `banks` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bank_transfers_sender_bank_id_foreign`: (`sender_bank_id`) → `banks` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bank_transfers_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bank_transfers_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bank_transfers_user_rejected_id_foreign`: (`user_rejected_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `transfer_receipt_number` | `bigint` | YES | `` | NULL | `` |  |
| `transfer_receipt_number_verified` | `bigint` | YES | `` | NULL | `` |  |
| `transfer_manager` | `varchar(191)` | YES | `` | NULL | `` |  |
| `payment_method_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `sender_bank_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `receiver_bank_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `social_reason_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `bank_account_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `date` | `datetime` | NO | `` | NULL | `` |  |
| `amount` | `int` | NO | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `rejection_motive` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_rejected_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `image` | `varchar(191)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |

### `banks`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `35`  

- **PK:** `id`

**Referenciada por (muestra):**
- `bank_account_balances` → `banks` (`bank_account_balances_bank_id_foreign`)
- `bank_accounts` → `banks` (`bank_accounts_bank_id_foreign`)
- `bank_details` → `banks` (`bank_details_bank_id_foreign`)
- `bank_transfers` → `banks` (`bank_transfers_receiver_bank_id_foreign`)
- `bank_transfers` → `banks` (`bank_transfers_sender_bank_id_foreign`)
- `check_discounts` → `banks` (`check_discounts_bank_id_foreign`)
- `employee_contracts` → `banks` (`employee_contracts_bank_id_foreign`)
- `purchases_providers` → `banks` (`purchases_providers_bank_id_foreign`)

**FK salientes:**

- `banks_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `banks_contract_debit_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `9493458`  

- **PK:** `id`

**FK salientes:**

- `banks_contract_debit_details_banks_contract_debit_id_foreign`: (`banks_contract_debit_id`) → `banks_contract_debits` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `banks_contract_debit_details_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `banks_contract_debit_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `document_manager` | `varchar(11)` | NO | `` | NULL | `` |  |
| `account_manager` | `varchar(30)` | YES | `` | NULL | `` |  |
| `account_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `card_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `quota_number` | `int` | NO | `` | NULL | `` |  |
| `expiration` | `date` | NO | `` | NULL | `` |  |
| `number` | `int` | YES | `` | NULL | `` |  |
| `amount_send` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `amount_get` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `status` | `int` | NO | `MUL` | NULL | `` |  |
| `cod_error` | `int` | YES | `` | NULL | `` |  |
| `error_motive` | `varchar(191)` | YES | `` | NULL | `` |  |
| `shop_process_id` | `bigint` | YES | `` | NULL | `` |  |
| `token` | `char(32)` | YES | `` | NULL | `` |  |
| `response` | `char(1)` | YES | `` | NULL | `` |  |
| `response_code` | `char(2)` | YES | `` | NULL | `` |  |
| `response_description` | `char(40)` | YES | `` | NULL | `` |  |
| `response_details` | `char(60)` | YES | `` | NULL | `` |  |
| `currency` | `char(3)` | YES | `` | NULL | `` |  |
| `authorization_number` | `char(6)` | YES | `` | NULL | `` |  |
| `extended_response_description` | `char(191)` | YES | `` | NULL | `` |  |
| `ticket_number` | `bigint` | YES | `` | NULL | `` |  |
| `card_source` | `char(1)` | YES | `` | NULL | `` |  |
| `customer_ip` | `char(15)` | YES | `` | NULL | `` |  |
| `card_country` | `char(30)` | YES | `` | NULL | `` |  |
| `version` | `char(5)` | YES | `` | NULL | `` |  |
| `risk_index` | `smallint` | YES | `` | NULL | `` |  |
| `RbStatus` | `char(5)` | YES | `` | NULL | `` |  |
| `RbKey` | `char(191)` | YES | `` | NULL | `` |  |
| `RbLevel` | `char(5)` | YES | `` | NULL | `` |  |
| `RbDescription` | `char(191)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `banks_contract_debits`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `9757243`  

- **PK:** `id`

**Referenciada por (muestra):**
- `banks_contract_debit_details` → `banks_contract_debits` (`banks_contract_debit_details_banks_contract_debit_id_foreign`)

**FK salientes:**

- `banks_contract_debits_debitentity_id_foreign`: (`debitentity_id`) → `debit_entities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `debitentity_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `json_request` | `longtext` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `base_contratos_quantum`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1889`  

- **PK:** `id`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `enterprise_id` | `int` | NO | `` | NULL | `` |  |
| `nro_contrato` | `int unsigned` | NO | `` | NULL | `` |  |
| `nombre` | `varchar(191)` | NO | `` | NULL | `` |  |
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `status` | `tinyint(1)` | NO | `` | 0 | `` |  |

### `base_crm_abogados`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `22058`  

- **PK:** *(no declarada como `PRIMARY` en information_schema)*

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `cedula` | `int` | YES | `UNI` | NULL | `` |  |
| `matricula` | `int` | YES | `` | NULL | `` |  |
| `nombre` | `varchar(191)` | YES | `` | NULL | `` |  |
| `apellido` | `varchar(191)` | YES | `` | NULL | `` |  |
| `telefono` | `varchar(15)` | YES | `` | NULL | `` |  |
| `birthdate` | `date` | YES | `` | NULL | `` |  |
| `direccion` | `varchar(191)` | YES | `` | NULL | `` |  |
| `barrio` | `varchar(191)` | YES | `` | NULL | `` |  |
| `ciudad` | `varchar(191)` | YES | `` | NULL | `` |  |
| `departamento` | `varchar(191)` | YES | `` | NULL | `` |  |
| `client_id` | `int` | YES | `` | NULL | `` |  |
| `contrato` | `int` | YES | `` | NULL | `` |  |
| `contract_id` | `int` | YES | `` | NULL | `` |  |

### `base_crm_ips`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `73969`  

- **PK:** *(no declarada como `PRIMARY` en information_schema)*

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `cedula` | `int` | YES | `UNI` | NULL | `` |  |
| `nombre` | `varchar(191)` | YES | `` | NULL | `` |  |
| `apellido` | `varchar(191)` | YES | `` | NULL | `` |  |
| `birthdate` | `date` | YES | `` | NULL | `` |  |
| `ciudad` | `varchar(191)` | YES | `` | NULL | `` |  |
| `departamento` | `varchar(191)` | YES | `` | NULL | `` |  |
| `direccion` | `varchar(191)` | YES | `` | NULL | `` |  |
| `nro_patronal` | `varchar(20)` | YES | `` | NULL | `` |  |
| `telefono` | `varchar(20)` | YES | `` | NULL | `` |  |
| `titular` | `varchar(20)` | YES | `` | NULL | `` |  |
| `client_id` | `int` | YES | `` | NULL | `` |  |
| `contract_id` | `int` | YES | `` | NULL | `` |  |
| `nro_contrato` | `int` | YES | `` | NULL | `` |  |

### `base_crm_vision`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `43176`  

- **PK:** `cedula`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `cedula` | `int` | NO | `PRI` | NULL | `` |  |
| `nombre` | `varchar(100)` | NO | `` | NULL | `` |  |
| `tel_laboral` | `varchar(20)` | YES | `` | NULL | `` |  |
| `tel_particular` | `varchar(20)` | YES | `` | NULL | `` |  |
| `celular` | `varchar(20)` | YES | `` | NULL | `` |  |
| `barrio` | `varchar(50)` | YES | `` | NULL | `` |  |
| `type` | `int` | YES | `` | NULL | `` |  |
| `ciudad` | `varchar(100)` | YES | `` | NULL | `` |  |
| `nacionalidad` | `varchar(100)` | YES | `` | NULL | `` |  |
| `birthdate` | `date` | YES | `` | NULL | `` |  |
| `edad` | `int` | YES | `` | NULL | `` |  |
| `trabajo` | `varchar(100)` | YES | `` | NULL | `` |  |
| `client_id` | `int` | YES | `` | NULL | `` |  |
| `contract_id` | `int` | YES | `` | NULL | `` |  |
| `contract_number` | `int` | YES | `` | NULL | `` |  |
| `enterprise_id` | `int` | YES | `` | NULL | `` |  |
| `unidad_de_negocio` | `varchar(50)` | YES | `` | NULL | `` |  |

### `base_tupi`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1714`  

- **PK:** `document_number`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `document_number` | `int` | NO | `PRI` | NULL | `` |  |
| `fullname` | `varchar(191)` | YES | `` | NULL | `` |  |
| `address` | `longtext` | YES | `` | NULL | `` |  |
| `phone_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `garanty_person` | `varchar(191)` | YES | `` | NULL | `` |  |
| `personal_references` | `varchar(191)` | YES | `` | NULL | `` |  |
| `client_id` | `int` | YES | `` | NULL | `` |  |
| `contract_id` | `int` | YES | `` | NULL | `` |  |
| `contract_number` | `int` | YES | `` | NULL | `` |  |

### `bicsas`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1325`  

- **PK:** `id`

**FK salientes:**

- `bicsas_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `bicsas_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `type` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `client_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `document_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `response` | `longtext` | YES | `` | NULL | `` |  |
| `status_charge` | `longtext` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `borrar_contratos`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `5780`  

- **PK:** *(no declarada como `PRIMARY` en information_schema)*

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `UN` | `varchar(30)` | NO | `` | NULL | `` |  |
| `contract_nuumber` | `varchar(30)` | YES | `` | NULL | `` |  |
| `deleted` | `tinyint(1)` | YES | `` | 0 | `` |  |

### `brackets`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `6`  

- **PK:** `id`

**Referenciada por (muestra):**
- `client_treatment_orthodontics` → `brackets` (`client_treatment_orthodontics_bracket_id_foreign`)

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `branch_cost_centers`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `5`  

- **PK:** `id`

**FK salientes:**

- `branch_cost_centers_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `branch_cost_centers_cost_center_id_foreign`: (`cost_center_id`) → `cost_centers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `branch_cost_centers_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `cost_center_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `branches`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `14`  

- **PK:** `id`

**Referenciada por (muestra):**
- `accounting_entry_details` → `branches` (`accounting_entry_details_branch_id_foreign`)
- `bank_transfer_details` → `branches` (`bank_transfer_details_branch_id_foreign`)
- `branch_cost_centers` → `branches` (`branch_cost_centers_branch_id_foreign`)
- `campaigns` → `branches` (`campaigns_branch_id_foreign`)
- `cash_boxes` → `branches` (`cash_boxes_branch_id_foreign`)
- `closed_invoices` → `branches` (`closed_invoices_branch_id_foreign`)
- `collection_incomes` → `branches` (`collection_incomes_branch_id_foreign`)
- `commission_categories` → `branches` (`commission_categories_branch_id_foreign`)
- `commission_payments` → `branches` (`commission_payments_branch_id_foreign`)
- `commission_types` → `branches` (`commission_types_branch_id_foreign`)
- `contract_monitorings` → `branches` (`contract_monitorings_branch_id_foreign`)
- `contracts` → `branches` (`contracts_branch_id_foreign`)
- `contracts` → `branches` (`contracts_user_branch_id_foreign`)
- `dental_budgets` → `branches` (`dental_budgets_branch_id_foreign`)
- `dental_offices` → `branches` (`dental_offices_branch_id_foreign`)
- `deposits` → `branches` (`deposits_branch_id_foreign`)
- `doctor_commissions` → `branches` (`doctor_commissions_branch_id_foreign`)
- `employee_contract_assistances` → `branches` (`employee_contract_assistances_branch_id_foreign`)
- `employee_contracts` → `branches` (`employee_contracts_branch_id_foreign`)
- `esth_branch_machines` → `branches` (`esth_branch_machines_branch_id_foreign`)
- `esth_patient_treatments` → `branches` (`esth_patient_treatments_branch_id_foreign`)
- `esth_treatment_prices` → `branches` (`esth_treatment_prices_branch_id_foreign`)
- `facebook_ads` → `branches` (`facebook_ads_branch_id_foreign`)
- `facebook_ads` → `branches` (`facebook_ads_from_branch_id_foreign`)
- `invoice_masives` → `branches` (`invoice_masives_branch_id_foreign`)
- `laboratory_receipts` → `branches` (`laboratory_receipts_branch_id_foreign`)
- `last_sellers` → `branches` (`last_sellers_branch_id_foreign`)
- `marker_clocks` → `branches` (`marker_clocks_branch_id_foreign`)
- `op_massives` → `branches` (`op_massives_branch_id_foreign`)
- `patronal_numbers` → `branches` (`patronal_numbers_branch_id_foreign`)
- `payments` → `branches` (`payments_branch_id_foreign`)
- `pending_invoices` → `branches` (`pending_invoices_branch_id_foreign`)
- `pending_schedules` → `branches` (`pending_schedules_branch_id_foreign`)
- `people` → `branches` (`people_branch_id_foreign`)
- `phone_callbacks` → `branches` (`phone_callbacks_branch_id_foreign`)
- `polls_services` → `branches` (`polls_services_branch_id_foreign`)
- `purchases` → `branches` (`purchases_branch_id_foreign`)
- `purchases_movements` → `branches` (`purchases_movements_branch_id_foreign`)
- `purchases_orders` → `branches` (`purchases_orders_branch_id_foreign`)
- `restockings` → `branches` (`restockings_branch_id_foreign`)
- *… y 13 restricciones más*

**FK salientes:**

- `branches_operational_manager_id_foreign`: (`operational_manager_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `branches_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `abbreviation` | `varchar(191)` | NO | `` | NULL | `` |  |
| `address` | `varchar(191)` | YES | `` | NULL | `` |  |
| `location` | `varchar(191)` | YES | `` | NULL | `` |  |
| `phone_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `voucher_number` | `tinyint unsigned` | NO | `` | NULL | `` |  |
| `voucher_number_infoco` | `int` | YES | `` | NULL | `` |  |
| `voucher_number_tapo` | `int` | YES | `` | NULL | `` |  |
| `voucher_number_puro_venta` | `varchar(191)` | YES | `` | NULL | `` |  |
| `voucher_number_gepem` | `int` | YES | `` | NULL | `` |  |
| `ascont_id` | `int` | YES | `` | NULL | `` |  |
| `ip_domain` | `varchar(191)` | NO | `` | NULL | `` |  |
| `operational_manager_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `business_departments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `49`  

- **PK:** `id`

**Referenciada por (muestra):**
- `dismissals` → `business_departments` (`dismissals_business_department_id_foreign`)
- `employee_contracts` → `business_departments` (`employee_contracts_business_department_id_foreign`)
- `employee_searches` → `business_departments` (`employee_searches_business_department_id_foreign`)
- `job_positions` → `business_departments` (`job_positions_business_department_id_foreign`)
- `marker_clocks` → `business_departments` (`marker_clocks_business_department_id_foreign`)
- `people` → `business_departments` (`people_business_department_id_foreign`)
- `tickets` → `business_departments` (`tickets_business_department_id_foreign`)
- `tickets` → `business_departments` (`tickets_from_business_department_id_foreign`)
- `users` → `business_departments` (`users_business_department_id_foreign`)
- `work_areas` → `business_departments` (`work_areas_business_department_id_foreign`)

**FK salientes:**

- `business_departments_gerency_id_foreign`: (`gerency_id`) → `gerencies` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `gerency_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `cadastres`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1200`  

- **PK:** `id`

**FK salientes:**

- `cadastres_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cadastres_debit_entity_id_foreign`: (`debit_entity_id`) → `debit_entities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cadastres_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `debit_entity_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `account_manager` | `varchar(191)` | NO | `` | NULL | `` |  |
| `document_manager` | `varchar(191)` | NO | `` | NULL | `` |  |
| `account_number` | `varchar(191)` | NO | `` | NULL | `` |  |
| `card_number` | `varchar(191)` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `observation` | `mediumtext` | NO | `` | NULL | `` |  |
| `receiving_person` | `mediumtext` | YES | `` | NULL | `` |  |
| `reason_delete` | `longtext` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `calendar_event_chats`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `60050`  

- **PK:** `id`

**FK salientes:**

- `calendar_event_chats_calendar_event_id_foreign`: (`calendar_event_id`) → `calendar_events` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_event_chats_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `calendar_event_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `comment` | `longtext` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `calendar_event_rooms`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `586801`  

- **PK:** `id`

**FK salientes:**

- `calendar_event_rooms_calendar_event_id_foreign`: (`calendar_event_id`) → `calendar_events` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_event_rooms_dental_office_room_id_foreign`: (`dental_office_room_id`) → `dental_office_rooms` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_event_rooms_esth_treatment_id_foreign`: (`esth_treatment_id`) → `esth_treatments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `dental_office_room_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `esth_treatment_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `calendar_event_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `start` | `datetime` | NO | `` | NULL | `` |  |
| `end` | `datetime` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `calendar_events`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1778540`  

- **PK:** `id`

**Referenciada por (muestra):**
- `calendar_event_chats` → `calendar_events` (`calendar_event_chats_calendar_event_id_foreign`)
- `calendar_event_rooms` → `calendar_events` (`calendar_event_rooms_calendar_event_id_foreign`)
- `calendar_events_doctor_services` → `calendar_events` (`calendar_events_doctor_services_calendar_event_id_foreign`)
- `cases_to_calls` → `calendar_events` (`cases_to_calls_calendar_event_id_foreign`)
- `client_services` → `calendar_events` (`client_services_calendar_event_id_foreign`)
- `doctor_commission_details` → `calendar_events` (`doctor_commission_details_calendar_event_id_foreign`)
- `esth_client_services` → `calendar_events` (`esth_client_services_calendar_event_id_foreign`)
- `pending_schedules` → `calendar_events` (`pending_schedules_calendar_event_id_foreign`)
- `polls_services` → `calendar_events` (`polls_services_calendar_event_id_foreign`)
- `sms_tokens` → `calendar_events` (`sms_tokens_calendar_event_id_foreign`)

**FK salientes:**

- `calendar_events_absent_user_id_foreign`: (`absent_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_events_cancel_user_id_foreign`: (`cancel_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_events_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_events_confirm_user_id_foreign`: (`confirm_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_events_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_events_credit_note_reason_id_foreign`: (`credit_note_reason_id`) → `credit_note_reason` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_events_dental_office_id_foreign`: (`dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_events_doctor_id_foreign`: (`doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_events_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_events_esth_protocol_id_foreign`: (`esth_protocol_id`) → `esth_protocols` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_events_insurance_id_foreign`: (`insurance_id`) → `insurances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_events_speciality_id_foreign`: (`speciality_id`) → `especialities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_events_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `insurance_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `start` | `datetime` | NO | `` | NULL | `` |  |
| `end` | `datetime` | NO | `` | NULL | `` |  |
| `status` | `int` | NO | `MUL` | NULL | `` |  |
| `type_scheduling` | `int` | NO | `` | 1 | `` |  |
| `esth_protocol_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `doctor_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `dental_office_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `evaluation` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `first_consultation` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `out_of_turn` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `urgency` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `prospect` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `esth_turn_recovered` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `nutritional_plan` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `half_session` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `next_visit` | `longtext` | YES | `` | NULL | `` |  |
| `observation_doctor` | `longtext` | YES | `` | NULL | `` |  |
| `turn_order` | `int` | YES | `` | NULL | `` |  |
| `esth_additional_service` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `status_confirmation_date` | `datetime` | YES | `` | NULL | `` |  |
| `status_clinic_date` | `datetime` | YES | `` | NULL | `` |  |
| `status_consulting_room_date` | `datetime` | YES | `` | NULL | `` |  |
| `status_attended_date` | `datetime` | YES | `` | NULL | `` |  |
| `status_reschedule_date` | `datetime` | YES | `` | NULL | `` |  |
| `status_canceled_date` | `datetime` | YES | `` | NULL | `` |  |
| `status_absent_date` | `datetime` | YES | `` | NULL | `` |  |
| `absent_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `type_absent` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `observation_absent` | `varchar(191)` | YES | `` | NULL | `` |  |
| `infobip_status` | `int unsigned` | YES | `` | NULL | `` |  |
| `infobip_schedule` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `scheduling_path` | `int` | YES | `` | NULL | `` |  |
| `json_sent_to_infobit` | `longtext` | YES | `` | NULL | `` |  |
| `json_received_to_infobit` | `longtext` | YES | `` | NULL | `` |  |
| `json_infobip_schedule` | `longtext` | YES | `` | NULL | `` |  |
| `comments` | `longtext` | YES | `` | NULL | `` |  |
| `template_id` | `longtext` | YES | `` | NULL | `` |  |
| `last_message_at` | `datetime` | YES | `` | NULL | `` |  |
| `confirm_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `cancel_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `reason_cancel` | `varchar(191)` | YES | `` | NULL | `` |  |
| `credit_note_reason_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |
| `speciality_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `confirm_area` | `tinyint` | YES | `` | NULL | `` |  |

### `calendar_events_doctor_services`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `calendar_events_doctor_services_calendar_event_id_foreign`: (`calendar_event_id`) → `calendar_events` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_events_doctor_services_esth_treatment_id_foreign`: (`esth_treatment_id`) → `esth_treatments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_events_doctor_services_procedure_id_foreign`: (`procedure_id`) → `procedures` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_events_doctor_services_services_doctor_id_foreign`: (`services_doctor_id`) → `services_doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `calendar_event_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `services_doctor_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `esth_treatment_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `procedure_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `calendar_payments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `38122`  

- **PK:** `id`

**Referenciada por (muestra):**
- `calendar_payments` → `calendar_payments` (`calendar_payments_last_calendar_payment_id_foreign`)

**FK salientes:**

- `calendar_payments_currency_id_foreign`: (`currency_id`) → `currencies` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_payments_last_calendar_payment_id_foreign`: (`last_calendar_payment_id`) → `calendar_payments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_payments_purchase_id_foreign`: (`purchase_id`) → `purchases` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_payments_purchases_collect_id_foreign`: (`purchases_collect_id`) → `purchases_collects` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_payments_purchases_provider_id_foreign`: (`purchases_provider_id`) → `purchases_providers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_payments_service_id_foreign`: (`service_id`) → `services` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_payments_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_payments_user_delete_id_foreign`: (`user_delete_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_payments_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `calendar_payments_user_rescheduled_id_foreign`: (`user_rescheduled_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `social_reason_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `service_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `type_account` | `int` | NO | `` | NULL | `` |  |
| `type_scheduler` | `int` | NO | `` | NULL | `` |  |
| `purchase_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `purchases_collect_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `purchases_provider_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `description` | `longtext` | YES | `` | NULL | `` |  |
| `amount` | `decimal(15,2)` | NO | `` | 0.00 | `` |  |
| `last_calendar_payment_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `currency_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_rescheduled_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_delete_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `reason` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `int` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `call_center_call_phones`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `60377`  

- **PK:** `id`

**FK salientes:**

- `call_center_call_phones_call_center_calls_id_foreign`: (`call_center_calls_id`) → `call_center_calls` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `call_center_call_phones_recovery_tracking_id_foreign`: (`recovery_tracking_id`) → `recovery_trackings` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `call_center_call_phones_sales_opportunity_tracking_id_foreign`: (`sales_opportunity_tracking_id`) → `sales_opportunity_trackings` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `call_center_calls_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `number_phone` | `varchar(191)` | NO | `` | NULL | `` |  |
| `recovery_tracking_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `sales_opportunity_tracking_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `llamada_id` | `varchar(191)` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `call_center_calls`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `28044`  

- **PK:** `id`

**Referenciada por (muestra):**
- `call_center_call_phones` → `call_center_calls` (`call_center_call_phones_call_center_calls_id_foreign`)

**FK salientes:**

- `call_center_calls_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `call_center_calls_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `call_center_calls_sales_opportunity_id_foreign`: (`sales_opportunity_id`) → `sales_opportunities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `call_center_calls_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `queue` | `varchar(191)` | NO | `` | NULL | `` |  |
| `agent` | `varchar(191)` | NO | `` | NULL | `` |  |
| `internal` | `varchar(191)` | NO | `` | NULL | `` |  |
| `client_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `sales_opportunity_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `call_center_pause_motives`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `5`  

- **PK:** `id`

**FK salientes:**

- `call_center_pause_motives_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `call_center_pauses`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `245`  

- **PK:** `id`

**FK salientes:**

- `call_center_pauses_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `queue` | `varchar(191)` | NO | `` | NULL | `` |  |
| `agent` | `varchar(191)` | NO | `` | NULL | `` |  |
| `internal` | `varchar(191)` | NO | `` | NULL | `` |  |
| `motive_id` | `int` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `int` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `finished_at` | `datetime` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `campaigns`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `4`  

- **PK:** `id`

**Referenciada por (muestra):**
- `loyalty_coupons` → `campaigns` (`loyalty_coupons_campaign_id_foreign`)

**FK salientes:**

- `campaigns_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `campaigns_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `card_prints`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `29149`  

- **PK:** `id`

**FK salientes:**

- `card_prints_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `card_prints_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `card_prints_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `card_prints_insurance_id_foreign`: (`insurance_id`) → `insurances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `card_prints_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `start_date` | `date` | NO | `` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `client_type` | `int` | NO | `` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `insurance_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `cartera_por_tramos`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `17639`  

- **PK:** `contract_number`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `contract_number` | `int` | NO | `PRI` | NULL | `` |  |
| `contract_id` | `int` | YES | `` | NULL | `` |  |
| `gestor` | `varchar(191)` | YES | `` | NULL | `` |  |
| `document_number` | `int` | YES | `` | NULL | `` |  |
| `last_payment` | `date` | YES | `` | NULL | `` |  |
| `days_last_payment` | `int` | YES | `` | NULL | `` |  |
| `ddu` | `int` | YES | `` | NULL | `` |  |
| `tramo_ddu` | `varchar(191)` | YES | `` | NULL | `` |  |
| `tramos_cuotas_vdas` | `varchar(191)` | YES | `` | NULL | `` |  |
| `cuota_vencidas` | `int` | YES | `` | NULL | `` |  |
| `tramo_id` | `int` | YES | `` | NULL | `` |  |
| `enterprise_id` | `int` | YES | `` | NULL | `` |  |

### `cases_to_calls`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1065029`  

- **PK:** `id`

**Referenciada por (muestra):**
- `cases_to_calls_details` → `cases_to_calls` (`cases_to_calls_details_cases_to_call_id_foreign`)
- `cases_to_calls_movements` → `cases_to_calls` (`cases_to_calls_movements_cases_to_call_id_foreign`)
- `cases_to_calls_trackings` → `cases_to_calls` (`cases_to_calls_trackings_cases_to_call_id_foreign`)

**FK salientes:**

- `cases_to_calls_calendar_event_id_foreign`: (`calendar_event_id`) → `calendar_events` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cases_to_calls_cases_manager_id_foreign`: (`cases_manager_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cases_to_calls_client_enterprise_id_foreign`: (`client_enterprise_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cases_to_calls_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cases_to_calls_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cases_to_calls_delete_user_id_foreign`: (`delete_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cases_to_calls_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cases_to_calls_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `client_enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `calendar_event_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `motive` | `longtext` | NO | `` | NULL | `` |  |
| `dental_budget_detail_id` | `int unsigned` | YES | `` | NULL | `` |  |
| `client_service_id` | `int unsigned` | YES | `` | NULL | `` |  |
| `phone_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `type` | `int` | NO | `` | NULL | `` |  |
| `cases_status` | `int` | NO | `` | 1 | `` |  |
| `status` | `int` | NO | `` | 1 | `` |  |
| `cases_manager_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `delete_reason` | `varchar(191)` | YES | `` | NULL | `` |  |
| `delete_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `cases_to_calls_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `130798`  

- **PK:** `id`

**FK salientes:**

- `cases_to_calls_details_cases_to_call_id_foreign`: (`cases_to_call_id`) → `cases_to_calls` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cases_to_calls_details_dental_budget_id_foreign`: (`dental_budget_id`) → `dental_budgets` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cases_to_calls_details_dental_office_id_foreign`: (`dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `cases_to_call_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `dental_budget_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `dental_office_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `cases_to_calls_movements`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `44399`  

- **PK:** `id`

**FK salientes:**

- `cases_to_calls_movements_cases_to_call_id_foreign`: (`cases_to_call_id`) → `cases_to_calls` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cases_to_calls_movements_new_manager_id_foreign`: (`new_manager_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cases_to_calls_movements_old_manager_id_foreign`: (`old_manager_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cases_to_calls_movements_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `cases_to_call_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `old_manager_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `new_manager_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `observation` | `longtext` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `cases_to_calls_trackings`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `265388`  

- **PK:** `id`

**Referenciada por (muestra):**
- `clients` → `cases_to_calls_trackings` (`clients_last_tracking_id_foreign`)

**FK salientes:**

- `cases_to_calls_trackings_cases_to_call_id_foreign`: (`cases_to_call_id`) → `cases_to_calls` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cases_to_calls_trackings_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cases_to_calls_trackings_polls_service_id_foreign`: (`polls_service_id`) → `polls_services` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cases_to_calls_trackings_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `cases_to_call_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `attended` | `int` | NO | `` | NULL | `` |  |
| `not_attended` | `int` | NO | `` | NULL | `` |  |
| `call_again` | `datetime` | YES | `` | NULL | `` |  |
| `contact_form` | `int` | NO | `` | NULL | `` |  |
| `rejected_motive_id` | `int` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | NO | `` | NULL | `` |  |
| `resolution` | `int` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `polls_service_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `cash_box_bank_accounts`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `334`  

- **PK:** `id`

**FK salientes:**

- `cash_box_bank_accounts_bank_account_id_foreign`: (`bank_account_id`) → `bank_accounts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cash_box_bank_accounts_cash_box_id_foreign`: (`cash_box_id`) → `cash_boxes` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `cash_box_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `bank_account_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `cash_box_close_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `278955`  

- **PK:** `id`

**FK salientes:**

- `cash_box_close_details_cash_box_close_id_foreign`: (`cash_box_close_id`) → `cash_box_closes` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `cash_box_close_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `billet` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `quantity` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `cash_box_closes`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `84436`  

- **PK:** `id`

**Referenciada por (muestra):**
- `cash_box_close_details` → `cash_box_closes` (`cash_box_close_details_cash_box_close_id_foreign`)
- `cash_box_details` → `cash_box_closes` (`cash_box_details_cash_box_close_id_foreign`)
- `request_changes_details` → `cash_box_closes` (`request_changes_details_cash_box_close_id_foreign`)

**FK salientes:**

- `cash_box_closes_arqueo_use_id_foreign`: (`arqueo_use_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cash_box_closes_cash_box_id_foreign`: (`cash_box_id`) → `cash_boxes` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cash_box_closes_currency_id_foreign`: (`currency_id`) → `currencies` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cash_box_closes_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `cash_box_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `currency_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `fund` | `tinyint unsigned` | YES | `` | NULL | `` |  |
| `amount` | `decimal(13,2)` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `arqueo_use_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `cash_box_concepts`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `77`  

- **PK:** `id`

**Referenciada por (muestra):**
- `cash_box_details` → `cash_box_concepts` (`cash_box_details_cash_box_concept_id_foreign`)

**FK salientes:**

- `cash_box_concepts_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `small_box` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `type` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `cash_box_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1457352`  

- **PK:** `id`

**Referenciada por (muestra):**
- `bank_details` → `cash_box_details` (`bank_details_cash_box_detail_id_foreign`)
- `cash_box_details` → `cash_box_details` (`cash_box_details_old_detail_id_foreign`)

**FK salientes:**

- `cash_box_details_bank_account_id_foreign`: (`bank_account_id`) → `bank_accounts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cash_box_details_bank_detail_id_foreign`: (`bank_detail_id`) → `bank_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cash_box_details_cash_box_close_id_foreign`: (`cash_box_close_id`) → `cash_box_closes` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cash_box_details_cash_box_concept_id_foreign`: (`cash_box_concept_id`) → `cash_box_concepts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cash_box_details_cash_box_id_foreign`: (`cash_box_id`) → `cash_boxes` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cash_box_details_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cash_box_details_currency_id_foreign`: (`currency_id`) → `currencies` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cash_box_details_delete_user_id_foreign`: (`delete_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cash_box_details_old_detail_id_foreign`: (`old_detail_id`) → `cash_box_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cash_box_details_payment_id_foreign`: (`payment_id`) → `payments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cash_box_details_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cash_box_details_voucher_id_foreign`: (`voucher_id`) → `vouchers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `currency_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `cash_box_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `cash_box_concept_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `voucher_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `payment_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `old_detail_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `type` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `fund` | `tinyint unsigned` | YES | `` | NULL | `` |  |
| `amount` | `decimal(13,2)` | NO | `` | NULL | `` |  |
| `bank_account_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `bank_detail_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `deposit_slip` | `varchar(191)` | YES | `` | NULL | `` |  |
| `deposit_slip_status` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `date` | `date` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `cash_box_close_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `delete_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `accounting_seated` | `tinyint(1)` | NO | `` | 0 | `` |  |

### `cash_box_payment_methods`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1040`  

- **PK:** `id`

**FK salientes:**

- `cash_box_payment_methods_cash_box_id_foreign`: (`cash_box_id`) → `cash_boxes` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cash_box_payment_methods_payment_method_id_foreign`: (`payment_method_id`) → `payment_methods` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `cash_box_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `payment_method_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `cash_box_users`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2135`  

- **PK:** `id`

**FK salientes:**

- `cash_box_users_cash_box_id_foreign`: (`cash_box_id`) → `cash_boxes` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cash_box_users_user_delete_id_foreign`: (`user_delete_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cash_box_users_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `cash_box_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `motive` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_delete_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `delete_date` | `datetime` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `cash_box_voucher_boxes`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `152`  

- **PK:** `id`

**FK salientes:**

- `cash_box_voucher_boxes_cash_box_id_foreign`: (`cash_box_id`) → `cash_boxes` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cash_box_voucher_boxes_voucher_box_id_foreign`: (`voucher_box_id`) → `voucher_boxes` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `cash_box_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `voucher_box_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `cash_boxes`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `185`  

- **PK:** `id`

**Referenciada por (muestra):**
- `cash_box_bank_accounts` → `cash_boxes` (`cash_box_bank_accounts_cash_box_id_foreign`)
- `cash_box_closes` → `cash_boxes` (`cash_box_closes_cash_box_id_foreign`)
- `cash_box_details` → `cash_boxes` (`cash_box_details_cash_box_id_foreign`)
- `cash_box_payment_methods` → `cash_boxes` (`cash_box_payment_methods_cash_box_id_foreign`)
- `cash_box_users` → `cash_boxes` (`cash_box_users_cash_box_id_foreign`)
- `cash_box_voucher_boxes` → `cash_boxes` (`cash_box_voucher_boxes_cash_box_id_foreign`)
- `cash_boxes` → `cash_boxes` (`cash_boxes_intercompany_idem_id_foreign`)
- `cash_boxes` → `cash_boxes` (`cash_boxes_intercompany_infoco_id_foreign`)
- `cash_boxes` → `cash_boxes` (`cash_boxes_intercompany_tapo_id_foreign`)
- `purchases` → `cash_boxes` (`purchases_cash_box_id_foreign`)
- `request_changes_details` → `cash_boxes` (`request_changes_details_cash_box_id_foreign`)

**FK salientes:**

- `cash_boxes_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cash_boxes_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cash_boxes_intercompany_idem_id_foreign`: (`intercompany_idem_id`) → `cash_boxes` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cash_boxes_intercompany_infoco_id_foreign`: (`intercompany_infoco_id`) → `cash_boxes` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cash_boxes_intercompany_tapo_id_foreign`: (`intercompany_tapo_id`) → `cash_boxes` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cash_boxes_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `small_box` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `box_lock` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `alert_limit_small_box` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `intercompany_infoco_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `intercompany_tapo_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `intercompany_idem_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `cell_payments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `74733`  

- **PK:** `id`

**FK salientes:**

- `cell_payments_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cell_payments_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `recovery_racking_id` | `int unsigned` | YES | `` | NULL | `` |  |
| `non_payment_reason_id` | `int unsigned` | YES | `` | NULL | `` |  |
| `payment_id` | `int unsigned` | YES | `` | NULL | `` |  |
| `charged` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `receipt` | `int` | YES | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `location` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `check_books`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `161`  

- **PK:** `id`

**Referenciada por (muestra):**
- `bank_details` → `check_books` (`bank_details_check_book_id_foreign`)

**FK salientes:**

- `check_books_bank_account_id_foreign`: (`bank_account_id`) → `bank_accounts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `check_books_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `bank_account_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `serial_number` | `varchar(191)` | NO | `` | NULL | `` |  |
| `initial_number` | `int` | NO | `` | NULL | `` |  |
| `number` | `int` | NO | `` | NULL | `` |  |
| `end_number` | `int` | NO | `` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `type` | `tinyint unsigned` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `check_discount_deposits`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2996`  

- **PK:** `id`

**Referenciada por (muestra):**
- `check_discounts` → `check_discount_deposits` (`check_discounts_check_discount_deposit_id_foreign`)

**FK salientes:**

- `check_discount_deposits_bank_account_id_foreign`: (`bank_account_id`) → `bank_accounts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `check_discount_deposits_bank_detail_id_foreign`: (`bank_detail_id`) → `bank_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `check_discount_deposits_user_delete_id_foreign`: (`user_delete_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `check_discount_deposits_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `bank_account_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `bank_detail_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `deposit_ballot` | `varchar(191)` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_delete_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `date_delete` | `datetime` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `accounting_seated` | `tinyint(1)` | NO | `` | 0 | `` |  |

### `check_discounts`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `3857`  

- **PK:** `id`

**Referenciada por (muestra):**
- `check_discounts` → `check_discounts` (`check_discounts_check_discount_id_foreign`)
- `contract_closed_dates` → `check_discounts` (`contract_closed_dates_check_discount_id_foreign`)

**FK salientes:**

- `check_discounts_bank_id_foreign`: (`bank_id`) → `banks` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `check_discounts_check_discount_deposit_id_foreign`: (`check_discount_deposit_id`) → `check_discount_deposits` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `check_discounts_check_discount_id_foreign`: (`check_discount_id`) → `check_discounts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `check_discounts_contract_fee_id_foreign`: (`contract_fee_id`) → `contract_fees` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `check_discounts_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `check_discounts_drawer_id_foreign`: (`drawer_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `contract_fee_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `check_discount_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `check_discount_deposit_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `bank_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `drawer_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `drawer` | `varchar(191)` | NO | `` | NULL | `` |  |
| `drawer_ruc` | `varchar(191)` | YES | `` | NULL | `` |  |
| `type_check` | `int` | NO | `` | NULL | `` |  |
| `check_number` | `varchar(191)` | NO | `` | NULL | `` |  |
| `serie` | `varchar(191)` | NO | `` | NULL | `` |  |
| `account_number` | `varchar(191)` | NO | `` | NULL | `` |  |
| `date_broadcast` | `date` | NO | `` | NULL | `` |  |
| `date_expiration` | `date` | NO | `` | NULL | `` |  |
| `amount` | `decimal(13,2)` | NO | `` | NULL | `` |  |
| `residue` | `decimal(13,2)` | NO | `` | NULL | `` |  |
| `interest` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `administrative_amount` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `administrative_iva` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `brokerage_amount` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `brokerage_iva` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `additional_amount` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `additional_iva` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `iva` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `net` | `decimal(13,2)` | NO | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `reason_rejection` | `varchar(191)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `cities`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `336`  

- **PK:** `id`

**Referenciada por (muestra):**
- `addresses` → `cities` (`addresses_city_id_foreign`)
- `clients_enterprises_addresses` → `cities` (`clients_enterprises_addresses_city_id_foreign`)
- `contracts` → `cities` (`contracts_city_id_enterprise_request_foreign`)
- `dental_offices` → `cities` (`dental_offices_city_id_foreign`)
- `doctors` → `cities` (`doctors_city_id_foreign`)
- `email_campaigns` → `cities` (`email_campaigns_client_city_id_foreign`)
- `emergency_services` → `cities` (`emergency_services_city_id_1_foreign`)
- `emergency_services` → `cities` (`emergency_services_city_id_2_foreign`)
- `neighborhoods` → `cities` (`neighborhoods_city_id_foreign`)
- `occupational_medicine_files` → `cities` (`occupational_medicine_files_city_id_foreign`)
- `people` → `cities` (`people_city_id_foreign`)
- `recovery_trackings` → `cities` (`recovery_trackings_city_id_foreign`)
- `request_eme_serv_details` → `cities` (`request_eme_serv_details_city_id_foreign`)
- `sales_opportunities` → `cities` (`sales_opportunities_city_id_foreign`)
- `sms_campaigns` → `cities` (`sms_campaigns_client_city_id_foreign`)

**FK salientes:**

- `cities_department_id_foreign`: (`department_id`) → `departments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cities_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `department_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |

### `client_benefits`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `file` | `varchar(191)` | YES | `` | NULL | `` |  |
| `description` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `client_credit_days`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1228`  

- **PK:** `id`

**FK salientes:**

- `client_credit_days_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_credit_days_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `credit_days` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `client_doctor_infusion`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `41`  

- **PK:** `id`

**FK salientes:**

- `client_doctor_infusion_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE CASCADE
- `client_doctor_infusion_doctor_infusion_id_foreign`: (`doctor_infusion_id`) → `doctor_infusions` (`id`) ON UPDATE NO ACTION / ON DELETE CASCADE

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `doctor_infusion_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `client_files`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `17435`  

- **PK:** `id`

**FK salientes:**

- `client_files_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_files_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_files_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `type` | `int` | NO | `` | NULL | `` |  |
| `document` | `varchar(191)` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |

### `client_images`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `38609`  

- **PK:** `id`

**Referenciada por (muestra):**
- `client_services` → `client_images` (`client_services_client_image_id_foreign`)

**FK salientes:**

- `client_images_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `image` | `varchar(191)` | NO | `` | NULL | `` |  |
| `type` | `int` | YES | `` | NULL | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |

### `client_laboratories`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `57591`  

- **PK:** `id`

**Referenciada por (muestra):**
- `acknowledgment_receipt_details` → `client_laboratories` (`acknowledgment_receipt_details_client_laboratory_id_foreign`)
- `client_laboratories` → `client_laboratories` (`client_laboratories_client_laboratory_id_foreign`)
- `laboratory_receipt_details` → `client_laboratories` (`laboratory_receipt_details_client_laboratory_id_foreign`)

**FK salientes:**

- `client_laboratories_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_laboratories_client_laboratory_id_foreign`: (`client_laboratory_id`) → `client_laboratories` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_laboratories_client_service_id_foreign`: (`client_service_id`) → `client_services` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_laboratories_deleted_user_id_foreign`: (`deleted_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_laboratories_delivered_user_id_foreign`: (`delivered_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_laboratories_denpro_delivered_user_id_foreign`: (`denpro_delivered_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_laboratories_denpro_finish_user_id_foreign`: (`denpro_finish_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_laboratories_denpro_received_user_id_foreign`: (`denpro_received_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_laboratories_denpro_shipping_user_id_foreign`: (`denpro_shipping_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_laboratories_denpro_working_user_id_foreign`: (`denpro_working_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_laboratories_dental_budget_id_foreign`: (`dental_budget_id`) → `dental_budgets` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_laboratories_dental_office_id_foreign`: (`dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_laboratories_doctor_id_foreign`: (`doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_laboratories_finish_user_id_foreign`: (`finish_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_laboratories_laboratory_id_foreign`: (`laboratory_id`) → `laboratories` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_laboratories_laboratory_job_id_foreign`: (`laboratory_job_id`) → `laboratory_jobs` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_laboratories_received_user_id_foreign`: (`received_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_laboratories_rejected_motive_id_foreign`: (`rejected_motive_id`) → `denpro_motive_rejecteds` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_laboratories_rejected_user_id_foreign`: (`rejected_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_laboratories_return_user_id_foreign`: (`return_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_laboratories_sent_user_id_foreign`: (`sent_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_laboratories_services_doctor_id_foreign`: (`services_doctor_id`) → `services_doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_laboratories_shipping_user_id_foreign`: (`shipping_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_laboratories_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_laboratories_voucher_id_foreign`: (`voucher_id`) → `vouchers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `laboratory_job_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `laboratory_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `client_service_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `dental_budget_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `services_doctor_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `patient_name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `tooth_piece` | `varchar(191)` | YES | `` | NULL | `` |  |
| `colour` | `varchar(6)` | YES | `` | NULL | `` |  |
| `original_price_sale` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `price_sale` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `price_cost` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `deliver_date` | `date` | YES | `` | NULL | `` |  |
| `doctor_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `client_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `dental_office_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `int unsigned` | NO | `` | NULL | `` |  |
| `sent_at` | `datetime` | YES | `` | NULL | `` |  |
| `sent_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `shipping_at` | `datetime` | YES | `` | NULL | `` |  |
| `shipping_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `delivered_at` | `datetime` | YES | `` | NULL | `` |  |
| `delivered_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `finish_at` | `datetime` | YES | `` | NULL | `` |  |
| `finish_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `received_at` | `datetime` | YES | `` | NULL | `` |  |
| `received_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `return_at` | `datetime` | YES | `` | NULL | `` |  |
| `return_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `denpro_status` | `int` | YES | `` | NULL | `` |  |
| `denpro_working_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `denpro_delivered_at` | `datetime` | YES | `` | NULL | `` |  |
| `denpro_delivered_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `denpro_finish_at` | `datetime` | YES | `` | NULL | `` |  |
| `denpro_finish_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `denpro_shipping_at` | `datetime` | YES | `` | NULL | `` |  |
| `denpro_received_at` | `datetime` | YES | `` | NULL | `` |  |
| `denpro_received_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `denpro_working_at` | `datetime` | YES | `` | NULL | `` |  |
| `denpro_shipping_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `voucher_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `to_bill` | `int` | NO | `` | 1 | `` |  |
| `client_laboratory_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `deleted_at` | `datetime` | YES | `` | NULL | `` |  |
| `deleted_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `deleted_motive` | `longtext` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `rejected_observation` | `longtext` | YES | `` | NULL | `` |  |
| `rejected_in_status` | `int` | YES | `` | NULL | `` |  |
| `rejected_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `rejected_motive_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `client_portfolios`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2123`  

- **PK:** `id`

**Referenciada por (muestra):**
- `collection_sections` → `client_portfolios` (`collection_sections_client_portfolios_id_foreign`)
- `detail_client_portfolios` → `client_portfolios` (`detail_client_portfolios_clientportfolio_id_foreign`)
- `discount_interests` → `client_portfolios` (`discount_interests_client_portfolio_id_foreign`)
- `payments` → `client_portfolios` (`payments_client_portfolios_id_foreign`)
- `portfolio_assignment_configurations` → `client_portfolios` (`portfolio_assignment_configurations_client_portfolio_id_foreign`)
- `portfolio_filters` → `client_portfolios` (`portfolio_filters_clientportfolio_id_foreign`)
- `portfolio_movements` → `client_portfolios` (`portfolio_movements_destination_portfolio_id_foreign`)
- `portfolio_movements` → `client_portfolios` (`portfolio_movements_origin_portfolio_id_foreign`)

**FK salientes:**

- `client_portfolios_collection_sections_id_foreign`: (`collection_sections_id`) → `collection_sections` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_portfolios_manager_id_foreign`: (`manager_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_portfolios_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `manager_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `from_date` | `date` | NO | `` | NULL | `` |  |
| `until_date` | `date` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `collection_sections_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `MUL` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `client_service_advances`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `263092`  

- **PK:** `id`

**Referenciada por (muestra):**
- `balance_changes` → `client_service_advances` (`balance_changes_client_service_advance_id_foreign`)
- `balance_changes` → `client_service_advances` (`balance_changes_new_client_service_advance_id_foreign`)
- `client_service_expiration_details` → `client_service_advances` (`client_service_expiration_details_advance_id_foreign`)
- `client_service_payments` → `client_service_advances` (`client_service_payments_client_service_advance_id_foreign`)

**FK salientes:**

- `client_service_advances_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_service_advances_client_service_debt_id_foreign`: (`client_service_debt_id`) → `client_service_debts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_service_advances_dental_budget_id_foreign`: (`dental_budget_id`) → `dental_budgets` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_service_advances_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_service_advances_voucher_id_foreign`: (`voucher_id`) → `vouchers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | 1 | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `voucher_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `amount` | `decimal(30,2)` | NO | `` | 0.00 | `` |  |
| `residue` | `decimal(30,2)` | NO | `` | 0.00 | `` |  |
| `client_service_debt_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `dental_budget_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `treatment_financed` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `financed` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `readiography_payment` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `maintenance` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `active_to_accounting_entry` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `does_not_expired` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `client_service_debts`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `386771`  

- **PK:** `id`

**Referenciada por (muestra):**
- `client_service_advances` → `client_service_debts` (`client_service_advances_client_service_debt_id_foreign`)
- `client_service_payments` → `client_service_debts` (`client_service_payments_client_service_debt_id_foreign`)

**FK salientes:**

- `client_service_debts_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_service_debts_client_service_id_foreign`: (`client_service_id`) → `client_services` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_service_debts_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | 1 | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `client_service_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(30,2)` | NO | `` | 0.00 | `` |  |
| `residue` | `decimal(30,2)` | NO | `` | 0.00 | `` |  |
| `doctor_commission_amount` | `decimal(30,2)` | NO | `` | NULL | `` |  |
| `session_number` | `int` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `client_service_expiration_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `32204`  

- **PK:** `id`

**FK salientes:**

- `client_service_expiration_details_advance_id_foreign`: (`advance_id`) → `client_service_advances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_service_expiration_details_headboard_id_foreign`: (`headboard_id`) → `client_service_expirations` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_service_expiration_details_rollback_user_id_foreign`: (`rollback_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `headboard_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `advance_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(13,2)` | NO | `` | 0.00 | `` |  |
| `motive` | `longtext` | YES | `` | NULL | `` |  |
| `rollback_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `rollback_date` | `datetime` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `client_service_expirations`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1243`  

- **PK:** `id`

**Referenciada por (muestra):**
- `client_service_expiration_details` → `client_service_expirations` (`client_service_expiration_details_headboard_id_foreign`)

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date_expiration` | `date` | NO | `` | NULL | `` |  |
| `amount` | `decimal(13,2)` | NO | `` | 0.00 | `` |  |
| `accounting_amount` | `decimal(13,2)` | NO | `` | 0.00 | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `accounting_seated` | `tinyint(1)` | NO | `` | 0 | `` |  |

### `client_service_payments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `520133`  

- **PK:** `id`

**FK salientes:**

- `client_service_payments_client_service_advance_id_foreign`: (`client_service_advance_id`) → `client_service_advances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_service_payments_client_service_debt_id_foreign`: (`client_service_debt_id`) → `client_service_debts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_service_payments_deleted_user_id_foreign`: (`deleted_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_service_advance_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `client_service_debt_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(30,2)` | NO | `` | 0.00 | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `deleted_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `accounting_seated` | `tinyint(1)` | NO | `` | 0 | `` |  |

### `client_services`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `915910`  

- **PK:** `id`

**Referenciada por (muestra):**
- `client_laboratories` → `client_services` (`client_laboratories_client_service_id_foreign`)
- `client_service_debts` → `client_services` (`client_service_debts_client_service_id_foreign`)
- `doctor_commission_details` → `client_services` (`doctor_commission_details_client_service_id_foreign`)
- `paym_serv_auth_details` → `client_services` (`paym_serv_auth_details_client_service_id_foreign`)
- `prosthesis_laboratories` → `client_services` (`prosthesis_laboratories_client_service_id_foreign`)

**FK salientes:**

- `client_services_calendar_event_id_foreign`: (`calendar_event_id`) → `calendar_events` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_services_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_services_client_image_id_foreign`: (`client_image_id`) → `client_images` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_services_commission_doctor_id_foreign`: (`commission_doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_services_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_services_dental_budget_detail_id_foreign`: (`dental_budget_detail_id`) → `dental_budget_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_services_dental_office_id_foreign`: (`dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_services_doctor_id_foreign`: (`doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_services_insurance_id_foreign`: (`insurance_id`) → `insurances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_services_services_authorization_detail_id_foreign`: (`services_authorization_detail_id`) → `services_authorization_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_services_services_doctor_id_foreign`: (`services_doctor_id`) → `services_doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_services_user_deleted_foreign`: (`user_deleted`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_services_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `client_image_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `services_authorization_detail_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `insurance_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `dental_office_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `commission_doctor_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `tooth_piece` | `varchar(191)` | YES | `` | NULL | `` |  |
| `services_doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `quantity` | `int` | YES | `` | NULL | `` |  |
| `calendar_event_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `dental_budget_detail_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `session_number` | `int` | YES | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `treatment_status` | `int` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `client_tokens`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `client_tokens_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `token` | `longtext` | NO | `` | NULL | `` |  |
| `expiration` | `datetime` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `client_treatment_orthodontics`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `8926`  

- **PK:** `id`

**FK salientes:**

- `client_treatment_orthodontics_bracket_id_foreign`: (`bracket_id`) → `brackets` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_treatment_orthodontics_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_treatment_orthodontics_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_treatment_orthodontics_dental_office_id_foreign`: (`dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_treatment_orthodontics_doctor_id_foreign`: (`doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_treatment_orthodontics_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `from_date` | `date` | NO | `` | NULL | `` |  |
| `until_date` | `date` | NO | `` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `bracket_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `dental_office_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount_maintenance` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `tratment_orthodontic_status` | `int` | NO | `` | 1 | `` |  |

### `client_turn_portfolio_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `859746`  

- **PK:** `id`

**FK salientes:**

- `client_turn_portfolio_details_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_turn_portfolio_details_client_turn_portfolio_id_foreign`: (`client_turn_portfolio_id`) → `client_turn_portfolios` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_turn_portfolio_details_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_turn_portfolio_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `expired_quotas` | `int` | NO | `` | NULL | `` |  |
| `type_membresia` | `int` | YES | `` | NULL | `` |  |
| `active` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `client_turn_portfolios`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `644`  

- **PK:** `id`

**Referenciada por (muestra):**
- `client_turn_portfolio_details` → `client_turn_portfolios` (`client_turn_portfolio_details_client_turn_portfolio_id_foreign`)
- `clients` → `client_turn_portfolios` (`clients_client_turn_portfolio_id_foreign`)
- `turn_portfolio_movements` → `client_turn_portfolios` (`turn_portfolio_movements_destination_turn_portfolio_id_foreign`)
- `turn_portfolio_movements` → `client_turn_portfolios` (`turn_portfolio_movements_origin_turn_portfolio_id_foreign`)

**FK salientes:**

- `client_turn_portfolios_manager_id_foreign`: (`manager_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `client_turn_portfolios_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `manager_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `from_date` | `date` | NO | `` | NULL | `` |  |
| `until_date` | `date` | NO | `` | NULL | `` |  |
| `collection_section` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `last_manager` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `` | NULL | `` |  |
| `goal_atenttion` | `int` | NO | `` | NULL | `` |  |
| `goal_schedule` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `client_types`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `client_types_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `clientes_emergencias`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `488`  

- **PK:** *(no declarada como `PRIMARY` en information_schema)*

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `nro_contrato` | `int` | YES | `` | NULL | `` |  |
| `nombre` | `varchar(200)` | YES | `` | NULL | `` |  |
| `cuota` | `varchar(15)` | YES | `` | NULL | `` |  |
| `fecha` | `varchar(15)` | YES | `` | NULL | `` |  |
| `cuota_vencida` | `int` | YES | `` | NULL | `` |  |
| `contract_id` | `int` | YES | `` | NULL | `` |  |

### `clientes_vendidos`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `10161`  

- **PK:** *(no declarada como `PRIMARY` en information_schema)*

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `nrocedula` | `int` | YES | `` | NULL | `` |  |
| `nrocontrato` | `int` | YES | `` | NULL | `` |  |
| `nombre` | `varchar(250)` | YES | `` | NULL | `` |  |
| `unidad_negocio` | `varchar(30)` | YES | `` | NULL | `` |  |
| `contract_id` | `int` | YES | `` | NULL | `` |  |

### `clients`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `392236`  

- **PK:** `id`

**Referenciada por (muestra):**
- `acknowledgment_receipts` → `clients` (`acknowledgment_receipts_client_id_foreign`)
- `address_facturacion_electronica` → `clients` (`address_facturacion_electronica_client_id_foreign`)
- `addresses` → `clients` (`addresses_client_id_foreign`)
- `balance_changes` → `clients` (`balance_changes_client_id_from_foreign`)
- `balance_changes` → `clients` (`balance_changes_client_id_to_foreign`)
- `bancard_cards` → `clients` (`bancard_cards_client_id_foreign`)
- `bank_transfer_details` → `clients` (`bank_transfer_details_client_id_foreign`)
- `bicsas` → `clients` (`bicsas_client_id_foreign`)
- `calendar_events` → `clients` (`calendar_events_client_id_foreign`)
- `call_center_calls` → `clients` (`call_center_calls_client_id_foreign`)
- `card_prints` → `clients` (`card_prints_client_id_foreign`)
- `cases_to_calls` → `clients` (`cases_to_calls_client_enterprise_id_foreign`)
- `cases_to_calls` → `clients` (`cases_to_calls_client_id_foreign`)
- `cases_to_calls_trackings` → `clients` (`cases_to_calls_trackings_client_id_foreign`)
- `check_discounts` → `clients` (`check_discounts_drawer_id_foreign`)
- `client_credit_days` → `clients` (`client_credit_days_client_id_foreign`)
- `client_doctor_infusion` → `clients` (`client_doctor_infusion_client_id_foreign`)
- `client_files` → `clients` (`client_files_client_id_foreign`)
- `client_images` → `clients` (`client_images_client_id_foreign`)
- `client_laboratories` → `clients` (`client_laboratories_client_id_foreign`)
- `client_service_advances` → `clients` (`client_service_advances_client_id_foreign`)
- `client_service_debts` → `clients` (`client_service_debts_client_id_foreign`)
- `client_services` → `clients` (`client_services_client_id_foreign`)
- `client_tokens` → `clients` (`client_tokens_client_id_foreign`)
- `client_treatment_orthodontics` → `clients` (`client_treatment_orthodontics_client_id_foreign`)
- `client_turn_portfolio_details` → `clients` (`client_turn_portfolio_details_client_id_foreign`)
- `clinic_histories` → `clients` (`clinic_histories_client_id_foreign`)
- `complaints` → `clients` (`complaints_client_id_foreign`)
- `contract_clients` → `clients` (`contract_clients_clients_id_foreign`)
- `contract_scorings` → `clients` (`contract_scorings_account_holder_id_foreign`)
- `contracting_entities` → `clients` (`contracting_entities_account_manager_id_foreign`)
- `contracts` → `clients` (`contracts_account_holder_id_foreign`)
- `dental_budgets` → `clients` (`dental_budgets_client_id_foreign`)
- `emails` → `clients` (`emails_client_id_foreign`)
- `emergency_services` → `clients` (`emergency_services_client_id_foreign`)
- `equifaxes` → `clients` (`equifaxes_client_id_foreign`)
- `esth_body_measurements` → `clients` (`esth_body_measurements_client_id_foreign`)
- `esth_client_services` → `clients` (`esth_client_services_client_id_foreign`)
- `esth_client_services_advances` → `clients` (`esth_client_services_advances_client_id_foreign`)
- `esth_client_services_debts` → `clients` (`esth_client_services_debts_client_id_foreign`)
- *… y 37 restricciones más*

**FK salientes:**

- `clients_client_turn_portfolio_id_foreign`: (`client_turn_portfolio_id`) → `client_turn_portfolios` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `clients_clients_enterprise_id_foreign`: (`clients_enterprise_id`) → `clients_enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `clients_collector_id_foreign`: (`collector_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `clients_dental_office_id_foreign`: (`dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `clients_infusion_diagnose_id_foreign`: (`infusion_diagnose_id`) → `infusion_diagnoses` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `clients_infusion_price_id_foreign`: (`infusion_price_id`) → `infusion_prices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `clients_last_dental_office_id_foreign`: (`last_dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `clients_last_doctor_id_foreign`: (`last_doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `clients_last_tracking_id_foreign`: (`last_tracking_id`) → `cases_to_calls_trackings` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `clients_nationality_id_foreign`: (`nationality_id`) → `nationalities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `clients_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_type` | `int` | NO | `` | 1 | `` |  |
| `external_base` | `tinyint(1)` | YES | `` | 0 | `` |  |
| `contributor` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `max_schedulings_per_month` | `tinyint unsigned` | NO | `` | 5 | `` |  |
| `first_name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `last_name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `document_type` | `int` | YES | `` | 1 | `` |  |
| `ruc` | `varchar(191)` | YES | `` | NULL | `` |  |
| `razon_social` | `varchar(191)` | YES | `` | NULL | `` |  |
| `contact` | `varchar(191)` | YES | `` | NULL | `` |  |
| `civil_status` | `int` | YES | `` | NULL | `` |  |
| `studies_taken` | `longtext` | YES | `` | NULL | `` |  |
| `facebook_screen_name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `children` | `varchar(191)` | YES | `` | NULL | `` |  |
| `document_number` | `bigint` | YES | `` | NULL | `` |  |
| `birth_date` | `date` | YES | `` | NULL | `` |  |
| `gender` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `nationality_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `clients_enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `last_dental_office_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `last_doctor_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `type_iva` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `collector_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `date_invoice` | `int` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `client_fast` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `client_of` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `dental_office_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `infobip_people` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `client_with_discount` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `json_recived` | `longtext` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `email` | `varchar(191)` | YES | `` | NULL | `` |  |
| `total_advances` | `decimal(11,2)` | NO | `` | 0.00 | `` |  |
| `total_treatment_advances` | `decimal(11,2)` | NO | `` | 0.00 | `` |  |
| `total_readiography_advances` | `decimal(11,2)` | NO | `` | 0.00 | `` |  |
| `password` | `varchar(191)` | YES | `` | NULL | `` |  |
| `client_turn_portfolio_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `pending_assignament` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `last_tracking_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `next_odo_event` | `datetime` | YES | `` | NULL | `` |  |
| `next_mee_event` | `datetime` | YES | `` | NULL | `` |  |
| `last_odo_event_attended` | `datetime` | YES | `` | NULL | `` |  |
| `last_mee_event_attended` | `datetime` | YES | `` | NULL | `` |  |
| `last_odo_event_absent` | `datetime` | YES | `` | NULL | `` |  |
| `last_mee_event_absent` | `datetime` | YES | `` | NULL | `` |  |
| `scheduling_call_again` | `date` | YES | `` | NULL | `` |  |
| `infusion_diagnose_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `infusion_frequency` | `smallint` | YES | `` | NULL | `` |  |
| `infusion_price_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `infusion_additionals` | `longtext` | YES | `` | NULL | `` |  |

### `clients_enterprises`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1574`  

- **PK:** `id`

**Referenciada por (muestra):**
- `clients` → `clients_enterprises` (`clients_clients_enterprise_id_foreign`)
- `clients_enterprises_addresses` → `clients_enterprises` (`clients_enterprises_addresses_client_enterprise_id_foreign`)
- `clients_enterprises_emails` → `clients_enterprises` (`clients_enterprises_emails_client_enterprise_id_foreign`)
- `clients_enterprises_phones` → `clients_enterprises` (`clients_enterprises_phones_client_enterprise_id_foreign`)
- `contracts` → `clients_enterprises` (`contracts_clients_enterprise_id_request_foreign`)
- `corporate_agreements` → `clients_enterprises` (`corporate_agreements_clients_enterprise_id_foreign`)
- `loyalty_coupons` → `clients_enterprises` (`loyalty_coupons_client_enterprise_id_foreign`)

**FK salientes:**

- `clients_enterprises_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `razon_social` | `varchar(191)` | NO | `` | NULL | `` |  |
| `contact` | `varchar(191)` | NO | `` | NULL | `` |  |
| `position` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `clients_enterprises_addresses`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1339`  

- **PK:** `id`

**FK salientes:**

- `clients_enterprises_addresses_city_id_foreign`: (`city_id`) → `cities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `clients_enterprises_addresses_client_enterprise_id_foreign`: (`client_enterprise_id`) → `clients_enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `clients_enterprises_addresses_neighborhood_id_foreign`: (`neighborhood_id`) → `neighborhoods` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `address` | `varchar(191)` | NO | `` | NULL | `` |  |
| `type_address` | `int` | NO | `` | NULL | `` |  |
| `location` | `mediumtext` | YES | `` | NULL | `` |  |
| `neighborhood_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `city_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `client_enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `clients_enterprises_emails`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1382`  

- **PK:** `id`

**FK salientes:**

- `clients_enterprises_emails_client_enterprise_id_foreign`: (`client_enterprise_id`) → `clients_enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `email` | `varchar(191)` | NO | `` | NULL | `` |  |
| `client_enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `clients_enterprises_phones`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1273`  

- **PK:** `id`

**FK salientes:**

- `clients_enterprises_phones_client_enterprise_id_foreign`: (`client_enterprise_id`) → `clients_enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `prefix` | `varchar(191)` | NO | `` | NULL | `` |  |
| `number_without_prefix` | `varchar(191)` | NO | `` | NULL | `` |  |
| `number` | `varchar(191)` | NO | `` | NULL | `` |  |
| `type_number` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `client_enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `clients_notifications`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `message` | `longtext` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `clients_solds`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `13175`  

- **PK:** *(no declarada como `PRIMARY` en information_schema)*

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `document_number` | `int` | YES | `` | NULL | `` |  |
| `contract_number` | `int` | YES | `` | NULL | `` |  |
| `client_name` | `varchar(250)` | YES | `` | NULL | `` |  |
| `enterprise_name` | `varchar(30)` | YES | `` | NULL | `` |  |
| `contract_id` | `int` | YES | `` | NULL | `` |  |

### `clinic_histories`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `32799`  

- **PK:** `id`

**FK salientes:**

- `clinic_histories_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `taking_medication` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `comment_taking_medication` | `varchar(191)` | YES | `` | NULL | `` |  |
| `allergic` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `comment_allergic` | `varchar(191)` | YES | `` | NULL | `` |  |
| `pregnant` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `comment_pregnant` | `varchar(191)` | YES | `` | NULL | `` |  |
| `abnormal_hemorrhages` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `comment_abnormal_hemorrhages` | `varchar(191)` | YES | `` | NULL | `` |  |
| `dental_treatment_problem` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `comment_dental_treatment_problem` | `varchar(191)` | YES | `` | NULL | `` |  |
| `cardiovascular_disease` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `comment_cardiovascular_disease` | `varchar(191)` | YES | `` | NULL | `` |  |
| `diabetes` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `arthritis` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `tuberculosis` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `venereal_diseases` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `hepatitis` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `hypertension` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `blood_diseases` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `esth_skin_diseases` | `int` | YES | `` | NULL | `` |  |
| `esth_skin_diseases_comment` | `varchar(191)` | YES | `` | NULL | `` |  |
| `esth_congestive_heart_disease` | `int` | YES | `` | NULL | `` |  |
| `esth_congestive_heart_disease_comment` | `varchar(191)` | YES | `` | NULL | `` |  |
| `esth_electronic_implants` | `int` | YES | `` | NULL | `` |  |
| `esth_electronic_implants_comment` | `varchar(191)` | YES | `` | NULL | `` |  |
| `esth_blood_pressure_diseases` | `int` | YES | `` | NULL | `` |  |
| `esth_blood_pressure_diseases_comment` | `varchar(191)` | YES | `` | NULL | `` |  |
| `esth_implants_in_hip` | `int` | YES | `` | NULL | `` |  |
| `esth_implants_in_hip_comment` | `varchar(191)` | YES | `` | NULL | `` |  |
| `esth_cancer` | `int` | YES | `` | NULL | `` |  |
| `esth_cancer_comment` | `varchar(191)` | YES | `` | NULL | `` |  |
| `esth_peripheral_vascular_disease` | `int` | YES | `` | NULL | `` |  |
| `esth_peripheral_vascular_disease_comment` | `varchar(191)` | YES | `` | NULL | `` |  |
| `esth_surgery_in_the_area` | `int` | YES | `` | NULL | `` |  |
| `esth_surgery_in_the_area_comment` | `varchar(191)` | YES | `` | NULL | `` |  |
| `esth_autoimmune_disorders` | `int` | YES | `` | NULL | `` |  |
| `esth_autoimmune_disorders_comment` | `varchar(191)` | YES | `` | NULL | `` |  |
| `esth_osteoarticular_pathologies` | `int` | YES | `` | NULL | `` |  |
| `esth_osteoarticular_pathologies_comment` | `varchar(191)` | YES | `` | NULL | `` |  |
| `esth_Infectious_inflammatory_processes` | `int` | YES | `` | NULL | `` |  |
| `esth_Infectious_inflammatory_processes_comment` | `varchar(191)` | YES | `` | NULL | `` |  |
| `esth_skin_hypersensitivity` | `int` | YES | `` | NULL | `` |  |
| `esth_skin_hypersensitivity_comment` | `varchar(191)` | YES | `` | NULL | `` |  |
| `esth_herpes` | `int` | YES | `` | NULL | `` |  |
| `esth_herpes_comment` | `varchar(191)` | YES | `` | NULL | `` |  |
| `esth_in_vitro_fertilization` | `int` | YES | `` | NULL | `` |  |
| `esth_in_vitro_fertilization_comment` | `varchar(191)` | YES | `` | NULL | `` |  |
| `esth_lactation` | `int` | YES | `` | NULL | `` |  |
| `esth_lactation_comment` | `varchar(191)` | YES | `` | NULL | `` |  |
| `esth_epilepsy` | `int` | YES | `` | NULL | `` |  |
| `esth_epilepsy_comment` | `varchar(191)` | YES | `` | NULL | `` |  |
| `esth_hiv` | `int` | YES | `` | NULL | `` |  |
| `esth_hiv_comment` | `varchar(191)` | YES | `` | NULL | `` |  |
| `esth_undiagnosed_injuries` | `int` | YES | `` | NULL | `` |  |
| `esth_undiagnosed_injuries_comment` | `varchar(191)` | YES | `` | NULL | `` |  |
| `esth_fillings_in_the_area` | `int` | YES | `` | NULL | `` |  |
| `esth_fillings_in_the_area_comment` | `varchar(191)` | YES | `` | NULL | `` |  |
| `esth_mesotherapy_in_the_area` | `int` | YES | `` | NULL | `` |  |
| `esth_mesotherapy_in_the_area_comment` | `varchar(191)` | YES | `` | NULL | `` |  |
| `esth_renal_disease` | `int` | YES | `` | NULL | `` |  |
| `esth_renal_disease_comment` | `varchar(191)` | YES | `` | NULL | `` |  |
| `esth_diu_in_the_area` | `int` | YES | `` | NULL | `` |  |
| `esth_diu_in_the_area_comment` | `varchar(191)` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `closed_invoices`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `18903`  

- **PK:** `id`

**FK salientes:**

- `closed_invoices_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `closed_invoices_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `closed_invoices_service_invoice_id_foreign`: (`service_invoice_id`) → `service_invoices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `service_invoice_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(13,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `closing_inventory_stock_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `14134260`  

- **PK:** `id`

**FK salientes:**

- `closing_inventory_stock_details_closing_id_foreign`: (`closing_id`) → `closing_inventory_stocks` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `closing_inventory_stock_details_deposit_id_foreign`: (`deposit_id`) → `deposits` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `closing_inventory_stock_details_purchases_product_id_foreign`: (`purchases_product_id`) → `purchases_products` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `closing_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `purchases_product_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `deposit_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `price_cost` | `decimal(12,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `closing_inventory_stocks`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1468`  

- **PK:** `id`

**Referenciada por (muestra):**
- `closing_inventory_stock_details` → `closing_inventory_stocks` (`closing_inventory_stock_details_closing_id_foreign`)

**FK salientes:**

- `closing_inventory_stocks_user_deleted_foreign`: (`user_deleted`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `closing_inventory_stocks_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `date_deleted` | `datetime` | YES | `` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `coll_agent_goal_config_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `64`  

- **PK:** `id`

**FK salientes:**

- `coll_agent_goal_config_details_coll_agent_goal_config_id_foreign`: (`coll_agent_goal_config_id`) → `collection_agents_goal_configs` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `coll_agent_goal_config_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `from_percentage` | `decimal(5,2)` | NO | `` | NULL | `` |  |
| `until_percentage` | `decimal(5,2)` | NO | `` | NULL | `` |  |
| `payment_percentage` | `decimal(5,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `collection_agents_goal_configs`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `24`  

- **PK:** `id`

**Referenciada por (muestra):**
- `coll_agent_goal_config_details` → `collection_agents_goal_configs` (`coll_agent_goal_config_details_coll_agent_goal_config_id_foreign`)

**FK salientes:**

- `collection_agents_goal_configs_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `tramo` | `varchar(2)` | NO | `` | NULL | `` |  |
| `percentage` | `decimal(5,3)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `collection_form_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `10524`  

- **PK:** `id`

**FK salientes:**

- `collection_form_details_collection_form_id_foreign`: (`collection_form_id`) → `collection_forms` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `collection_form_details_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `collection_form_details_payment_id_foreign`: (`payment_id`) → `payments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `collection_form_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `quota_number` | `int` | NO | `` | NULL | `` |  |
| `expired_total` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `residue_total` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `payment_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `collection_forms`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `183`  

- **PK:** `id`

**Referenciada por (muestra):**
- `collection_form_details` → `collection_forms` (`collection_form_details_collection_form_id_foreign`)

**FK salientes:**

- `collection_forms_debit_entity_id_foreign`: (`debit_entity_id`) → `debit_entities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `collection_forms_product_money_loan_id_foreign`: (`product_money_loan_id`) → `product_money_loans` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `collection_forms_user_delete_id_foreign`: (`user_delete_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `collection_forms_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `date_to` | `date` | NO | `` | NULL | `` |  |
| `date_from` | `date` | NO | `` | NULL | `` |  |
| `debit_entity_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `product_money_loan_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `collection_percentage` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `total_amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `total_collect` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `total_collection` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_delete_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `date_delete` | `datetime` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `collection_income_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `57334`  

- **PK:** `id`

**FK salientes:**

- `collection_income_details_account_payment_way_id_foreign`: (`account_payment_way_id`) → `account_payment_ways` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `collection_income_details_collection_income_id_foreign`: (`collection_income_id`) → `collection_incomes` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `collection_income_details_voucher_payment_id_foreign`: (`voucher_payment_id`) → `voucher_payments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `collection_income_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `account_payment_way_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `voucher_payment_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `collection_incomes`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `18484`  

- **PK:** `id`

**Referenciada por (muestra):**
- `collection_income_details` → `collection_incomes` (`collection_income_details_collection_income_id_foreign`)

**FK salientes:**

- `collection_incomes_bank_account_id_foreign`: (`bank_account_id`) → `bank_accounts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `collection_incomes_bank_detail_id_foreign`: (`bank_detail_id`) → `bank_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `collection_incomes_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `collection_incomes_collector_id_foreign`: (`collector_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `collection_incomes_deleted_user_id_foreign`: (`deleted_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `collection_incomes_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `collection_incomes_payment_method_id_foreign`: (`payment_method_id`) → `payment_methods` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `collection_incomes_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date_from` | `date` | NO | `` | NULL | `` |  |
| `date_to` | `date` | NO | `` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `payment_method_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `collector_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `bank_account_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `bank_detail_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `voucher` | `varchar(191)` | YES | `` | NULL | `` |  |
| `voucher_date` | `date` | YES | `` | NULL | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `quantity` | `int unsigned` | NO | `` | 0 | `` |  |
| `total` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `status` | `int unsigned` | NO | `` | 0 | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `deleted_reason` | `varchar(191)` | YES | `` | NULL | `` |  |
| `deleted_at` | `datetime` | YES | `` | NULL | `` |  |
| `deleted_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `accounting_seated` | `tinyint(1)` | NO | `` | 0 | `` |  |

### `collection_sections`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `31`  

- **PK:** `id`

**Referenciada por (muestra):**
- `client_portfolios` → `collection_sections` (`client_portfolios_collection_sections_id_foreign`)
- `detail_client_portfolios` → `collection_sections` (`detail_client_portfolios_collection_sections_id_foreign`)
- `email_campaigns` → `collection_sections` (`email_campaigns_collection_section_id_foreign`)
- `manager_commission_details` → `collection_sections` (`manager_commission_details_collection_sections_id_foreign`)
- `sms_campaigns` → `collection_sections` (`sms_campaigns_collection_section_id_foreign`)
- `type_section_commissions` → `collection_sections` (`type_section_commissions_collection_sections_id_foreign`)
- `users` → `collection_sections` (`users_collection_sections_id_foreign`)

**FK salientes:**

- `collection_sections_client_portfolios_id_foreign`: (`client_portfolios_id`) → `client_portfolios` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `collection_sections_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `collection_sections_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `type` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `from` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `until` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `type_goal` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `amount_goal` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `type_commission` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `amount_commission` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `period` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `assignments` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `client_portfolios_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `include_not_commissionable` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `collector_locations`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `26169736`  

- **PK:** `id`

**FK salientes:**

- `collector_locations_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `datetime` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `location` | `varchar(191)` | NO | `` | NULL | `` |  |
| `battery_level` | `int` | YES | `` | NULL | `` |  |
| `battery_charging` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `commission_categories`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `16`  

- **PK:** `id`

**Referenciada por (muestra):**
- `commission_payments` → `commission_categories` (`commission_payments_commission_category_id_foreign`)

**FK salientes:**

- `commission_categories_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commission_categories_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commission_categories_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `salary_base` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `target` | `int` | NO | `` | NULL | `` |  |
| `minimum_target` | `int` | NO | `` | NULL | `` |  |
| `percentage_commission` | `int` | NO | `` | NULL | `` |  |
| `commission_amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `commission_contracts`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `30870`  

- **PK:** `id`

**FK salientes:**

- `commission_contracts_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `number` | `int` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `residue` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `type` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `commission_payment_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `103249`  

- **PK:** `id`

**FK salientes:**

- `commission_payment_details_account_payment_way_id_foreign`: (`account_payment_way_id`) → `account_payment_ways` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commission_payment_details_commission_id_foreign`: (`commission_id`) → `commissions` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commission_payment_details_commission_payment_id_foreign`: (`commission_payment_id`) → `commission_payments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commission_payment_details_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commission_payment_details_voucher_id_foreign`: (`voucher_id`) → `vouchers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commission_payment_details_voucher_payment_id_foreign`: (`voucher_payment_id`) → `voucher_payments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `commission_payment_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `type` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `commission_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `voucher_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `fromable_id` | `int unsigned` | YES | `` | NULL | `` |  |
| `model` | `varchar(191)` | YES | `` | NULL | `` |  |
| `account_payment_way_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `number` | `int` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `percentage` | `int` | NO | `` | NULL | `` |  |
| `commission` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `voucher_payment_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |

### `commission_payments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `19138`  

- **PK:** `id`

**Referenciada por (muestra):**
- `commission_payment_details` → `commission_payments` (`commission_payment_details_commission_payment_id_foreign`)
- `manager_commission_details` → `commission_payments` (`manager_commission_details_commission_payment_id_foreign`)

**FK salientes:**

- `commission_payments_authorized_user_id_foreign`: (`authorized_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commission_payments_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commission_payments_commission_category_id_foreign`: (`commission_category_id`) → `commission_categories` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commission_payments_commission_sheet_id_foreign`: (`commission_sheet_id`) → `commission_sheets` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commission_payments_confirm_user_id_foreign`: (`confirm_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commission_payments_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commission_payments_manager_id_foreign`: (`manager_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commission_payments_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commission_payments_user_id_payment_foreign`: (`user_id_payment`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `commission_sheet_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `type` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `type_receipt` | `smallint` | YES | `` | NULL | `` |  |
| `receipt_number` | `int` | NO | `` | NULL | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `from_date` | `date` | YES | `` | NULL | `` |  |
| `until_date` | `date` | YES | `` | NULL | `` |  |
| `from_payment` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `until_payment` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_id_payment` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `total_payment` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `commission_category_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `volume` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `additional_quantity` | `int` | YES | `` | NULL | `` |  |
| `additional_amount` | `int` | YES | `` | NULL | `` |  |
| `total_commission` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `confirm_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `authorized_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `management_reason` | `longtext` | YES | `` | NULL | `` |  |
| `manager_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `confirm_date` | `datetime` | YES | `` | NULL | `` |  |
| `authorize_date` | `datetime` | YES | `` | NULL | `` |  |
| `deleted_date` | `datetime` | YES | `` | NULL | `` |  |

### `commission_sheets`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2371`  

- **PK:** `id`

**Referenciada por (muestra):**
- `commission_payments` → `commission_sheets` (`commission_payments_commission_sheet_id_foreign`)
- `doctor_commissions` → `commission_sheets` (`doctor_commissions_commission_sheet_id_foreign`)

**FK salientes:**

- `commission_sheets_first_user_confirm_id_foreign`: (`first_user_confirm_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commission_sheets_rejected_user_id_foreign`: (`rejected_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commission_sheets_second_user_confirm_id_foreign`: (`second_user_confirm_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commission_sheets_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `from_date` | `date` | NO | `` | NULL | `` |  |
| `to_date` | `date` | NO | `` | NULL | `` |  |
| `type` | `smallint` | NO | `` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `status` | `smallint` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `first_user_confirm_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `first_confirm_date` | `datetime` | YES | `` | NULL | `` |  |
| `second_user_confirm_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `second_confirm_date` | `datetime` | YES | `` | NULL | `` |  |
| `rejected_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `rejected_date` | `datetime` | YES | `` | NULL | `` |  |
| `reason_rejected` | `longtext` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `commission_types`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `97`  

- **PK:** `id`

**FK salientes:**

- `commission_types_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commission_types_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commission_types_scale_viatic_id_foreign`: (`scale_viatic_id`) → `scale_viatics` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commission_types_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `scale_viatic_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `contract_type` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `counted` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `first_payment_made` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `type_amount` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `order` | `int` | YES | `` | NULL | `` |  |
| `days_to_discount` | `smallint` | YES | `` | NULL | `` |  |
| `days_to_notify` | `smallint` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `commissions`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `397974`  

- **PK:** `id`

**Referenciada por (muestra):**
- `commission_payment_details` → `commissions` (`commission_payment_details_commission_id_foreign`)
- `doctor_commission_details` → `commissions` (`doctor_commission_details_commission_id_foreign`)

**FK salientes:**

- `commissions_aproved_user_id_foreign`: (`aproved_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commissions_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commissions_delete_user_id_foreign`: (`delete_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commissions_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commissions_payment_id_foreign`: (`payment_id`) → `payments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commissions_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commissions_voucher_detail_id_foreign`: (`voucher_detail_id`) → `voucher_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `commissions_voucher_id_foreign`: (`voucher_id`) → `vouchers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `payment_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `voucher_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `voucher_detail_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `type_commission` | `int` | NO | `` | NULL | `` |  |
| `commission_agent_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | 0.00 | `` |  |
| `old_commission_id` | `int unsigned` | YES | `` | NULL | `` |  |
| `type_movement` | `int` | NO | `` | NULL | `` |  |
| `type_payment` | `int` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | NO | `` | NULL | `` |  |
| `model` | `varchar(191)` | NO | `` | NULL | `` |  |
| `controller` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | 1 | `` |  |
| `delete_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `reason_aproved` | `longtext` | YES | `` | NULL | `` |  |
| `aproved_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `reason_delete` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `int` | NO | `` | 5 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `complaint_destiny_users`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `28`  

- **PK:** `id`

**FK salientes:**

- `complaint_destiny_users_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `complaint_destiny` | `int` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `complaint_files`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `9135`  

- **PK:** `id`

**FK salientes:**

- `complaint_files_complaint_id_foreign`: (`complaint_id`) → `complaints` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `complaint_files_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `complaint_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `description` | `varchar(191)` | YES | `` | NULL | `` |  |
| `file` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |

### `complaint_motives`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `105`  

- **PK:** `id`

**Referenciada por (muestra):**
- `complaint_motives_destinations` → `complaint_motives` (`complaint_motives_destinations_complaint_motive_id_foreign`)
- `complaints` → `complaint_motives` (`complaints_complaint_motive_id_foreign`)

**FK salientes:**

- `complaint_motives_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `department` | `int` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `complaint_motives_destinations`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `309`  

- **PK:** `id`

**FK salientes:**

- `complaint_motives_destinations_complaint_motive_id_foreign`: (`complaint_motive_id`) → `complaint_motives` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `complaint_motive_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `destiny_id` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `complaint_trackings`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `185123`  

- **PK:** `id`

**FK salientes:**

- `complaint_trackings_complaint_id_foreign`: (`complaint_id`) → `complaints` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `complaint_trackings_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `complaint_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `observation` | `longtext` | NO | `` | NULL | `` |  |
| `complaint_remitent` | `int unsigned` | YES | `` | NULL | `` |  |
| `complaint_destiny` | `int` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `complaint_status` | `int unsigned` | YES | `` | NULL | `` |  |
| `notificated` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `remited_at` | `datetime` | YES | `` | NULL | `` |  |
| `receipt_at` | `datetime` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `complaints`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `81745`  

- **PK:** `id`

**Referenciada por (muestra):**
- `complaint_files` → `complaints` (`complaint_files_complaint_id_foreign`)
- `complaint_trackings` → `complaints` (`complaint_trackings_complaint_id_foreign`)

**FK salientes:**

- `complaints_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `complaints_complaint_motive_id_foreign`: (`complaint_motive_id`) → `complaint_motives` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `complaints_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `complaints_created_user_id_foreign`: (`created_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `complaints_deleted_user_id_foreign`: (`deleted_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `complaints_loyal_user_id_foreign`: (`loyal_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `complaints_tracking_user_foreign`: (`tracking_user`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `complaints_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | YES | `` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `client_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `phone_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `complaint_motive_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `reversion` | `int` | YES | `` | NULL | `` |  |
| `json_infobip` | `longtext` | YES | `` | NULL | `` |  |
| `contract_cancelation` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `double_debit_correspond` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `complaint_destiny` | `int` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `int unsigned` | NO | `MUL` | 1 | `` |  |
| `user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `loyalty` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `loyal_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `loyal_date` | `date` | YES | `` | NULL | `` |  |
| `tracking_user` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `deleted_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `deleted_motive` | `longtext` | YES | `` | NULL | `` |  |
| `deleted_at` | `datetime` | YES | `` | NULL | `` |  |
| `created_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `bank_name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `account_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `amount` | `varchar(191)` | YES | `` | NULL | `` |  |
| `document_manager` | `varchar(191)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `contract_authorizations`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `123975`  

- **PK:** `id`

**FK salientes:**

- `contract_authorizations_contracts_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_authorizations_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `authorization_date` | `datetime` | YES | `` | NULL | `` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `result` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `type` | `varchar(191)` | YES | `` | TAPO | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `contract_clients`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `215252`  

- **PK:** `id`

**FK salientes:**

- `contract_clients_clients_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_clients_contracts_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `bracket` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `type` | `tinyint(1)` | NO | `MUL` | NULL | `` |  |
| `relationship` | `int unsigned` | YES | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `usufruct` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `esth_sessions` | `tinyint` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `admission_date` | `date` | YES | `` | NULL | `` |  |

### `contract_closed_dates`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `3452979`  

- **PK:** `id`

**FK salientes:**

- `contract_closed_dates_check_discount_id_foreign`: (`check_discount_id`) → `check_discounts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_closed_dates_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_closed_dates_last_collection_manager_id_foreign`: (`last_collection_manager_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_closed_dates_last_scheduling_manager_id_foreign`: (`last_scheduling_manager_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `check_discount_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `closed_date` | `date` | YES | `` | NULL | `` |  |
| `contract_type` | `int` | YES | `` | NULL | `` |  |
| `client_sales_process` | `int` | YES | `` | NULL | `` |  |
| `contract_give` | `int` | NO | `` | 0 | `` |  |
| `quotas_expirations` | `int` | NO | `` | NULL | `` |  |
| `quotas_expirations_laboratory` | `int` | NO | `` | NULL | `` |  |
| `amount_laboratory` | `decimal(11,2)` | NO | `` | 0.00 | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | 0.00 | `` |  |
| `expired_amount` | `decimal(12,2)` | NO | `` | NULL | `` |  |
| `expired_amount_laboratory` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `total_residue` | `decimal(12,2)` | NO | `` | NULL | `` |  |
| `total_residue_laboratory` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `expired_capital_amount` | `decimal(12,2)` | NO | `` | NULL | `` |  |
| `expired_interest_amount` | `decimal(12,2)` | NO | `` | NULL | `` |  |
| `capital_amount_residue` | `decimal(12,2)` | NO | `` | NULL | `` |  |
| `interest_amount_residue` | `decimal(12,2)` | NO | `` | NULL | `` |  |
| `accrued_amount` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `interest_suspension` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `residue_iva_invoice` | `decimal(12,2)` | YES | `` | NULL | `` |  |
| `next_expiration_to_pay` | `date` | YES | `` | NULL | `` |  |
| `next_expiration_to_pay_lab` | `date` | YES | `` | NULL | `` |  |
| `last_payment` | `date` | YES | `` | NULL | `` |  |
| `last_payment_lab` | `date` | YES | `` | NULL | `` |  |
| `days_late` | `int` | YES | `` | NULL | `` |  |
| `days_late_lab` | `int` | YES | `` | NULL | `` |  |
| `expiration_date` | `date` | YES | `` | NULL | `` |  |
| `last_scheduling_manager_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `last_collection_manager_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `check_discount_status` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `contract_comercial_references`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `536`  

- **PK:** `id`

**FK salientes:**

- `contract_comercial_references_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `enterprise` | `varchar(191)` | NO | `` | NULL | `` |  |
| `phone` | `varchar(191)` | YES | `` | NULL | `` |  |
| `description` | `varchar(191)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `contract_debited_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `7947250`  

- **PK:** `id`

**FK salientes:**

- `contract_debited_details_contract_debited_id_foreign`: (`contract_debited_id`) → `contract_debiteds` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_debited_details_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_debited_details_payment_id_foreign`: (`payment_id`) → `payments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `number` | `int` | NO | `` | NULL | `` |  |
| `quota_number` | `int` | YES | `` | NULL | `` |  |
| `contract_debited_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `account_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `card_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `txt_line` | `varchar(191)` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `payment_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `contract_debiteds`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `21539`  

- **PK:** `id`

**Referenciada por (muestra):**
- `contract_debited_details` → `contract_debiteds` (`contract_debited_details_contract_debited_id_foreign`)

**FK salientes:**

- `contract_debiteds_debit_entity_id_foreign`: (`debit_entity_id`) → `debit_entities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_debiteds_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_debiteds_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_debiteds_user_deleted_id_foreign`: (`user_deleted_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_debiteds_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `social_reason_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `enterprises` | `varchar(191)` | NO | `` | NULL | `` |  |
| `debit_entity_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `account_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `expired_quotas` | `int` | YES | `` | NULL | `` |  |
| `coupon_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `file_txt` | `longtext` | NO | `` | NULL | `` |  |
| `file_txt_name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `quantity_quotas` | `int` | YES | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_deleted_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `request_json` | `longtext` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `contract_fee_tokens`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `4489`  

- **PK:** `id`

**FK salientes:**

- `contract_fee_tokens_contract_fee_id_foreign`: (`contract_fee_id`) → `contract_fees` (`id`) ON UPDATE NO ACTION / ON DELETE CASCADE
- `contract_fee_tokens_payment_id_foreign`: (`payment_id`) → `payments` (`id`) ON UPDATE NO ACTION / ON DELETE SET NULL
- `contract_fee_tokens_payment_method_id_foreign`: (`payment_method_id`) → `payment_methods` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_fee_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `token` | `varchar(191)` | NO | `UNI` | NULL | `` |  |
| `status` | `tinyint` | NO | `` | NULL | `` |  |
| `email_sent` | `tinyint` | NO | `` | 0 | `` |  |
| `payment_method_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `payment_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `payment_expiry_date` | `date` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | 0.00 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `contract_fee_vouchers`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `102713`  

- **PK:** `id`

**FK salientes:**

- `contract_fee_vouchers_contract_fee_id_foreign`: (`contract_fee_id`) → `contract_fees` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_fee_vouchers_voucher_id_foreign`: (`voucher_id`) → `vouchers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_fee_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `voucher_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `contract_fees`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `6269924`  

- **PK:** `id`

**Referenciada por (muestra):**
- `account_payments` → `contract_fees` (`account_payments_contract_fee_id_foreign`)
- `check_discounts` → `contract_fees` (`check_discounts_contract_fee_id_foreign`)
- `contract_fee_tokens` → `contract_fees` (`contract_fee_tokens_contract_fee_id_foreign`)
- `contract_fee_vouchers` → `contract_fees` (`contract_fee_vouchers_contract_fee_id_foreign`)
- `interest_accrual_details` → `contract_fees` (`interest_accrual_details_contract_fee_id_foreign`)
- `request_changes_details` → `contract_fees` (`request_changes_details_fee_contract_id_foreign`)
- `vouchers` → `contract_fees` (`vouchers_contract_fee_id_foreign`)

**FK salientes:**

- `contract_fees_contract_promotion_id_foreign`: (`contract_promotion_id`) → `contract_promotions` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_fees_contracts_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `number` | `int` | NO | `` | NULL | `` |  |
| `expiration` | `date` | NO | `MUL` | NULL | `` |  |
| `last_payment` | `date` | YES | `` | NULL | `` |  |
| `amount` | `decimal(12,2)` | NO | `` | NULL | `` |  |
| `residue` | `decimal(12,2)` | NO | `` | NULL | `` |  |
| `token_pagopar` | `varchar(191)` | YES | `` | NULL | `` |  |
| `token_pagopar_status` | `varchar(191)` | YES | `` | NULL | `` |  |
| `renewal_number` | `int` | YES | `` | NULL | `` |  |
| `type` | `int` | NO | `` | 1 | `` |  |
| `fee_reshedule` | `int` | NO | `` | 0 | `` |  |
| `from_quota_suspension` | `date` | YES | `` | NULL | `` |  |
| `until_quota_suspension` | `date` | YES | `` | NULL | `` |  |
| `interest` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `interest_iva` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `administrative_amount` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `administrative_iva` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `brokerage_amount` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `brokerage_iva` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `additional_amount` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `additional_iva` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `capital` | `decimal(12,2)` | YES | `` | NULL | `` |  |
| `interest_residue` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `accrual_from_date` | `date` | YES | `` | NULL | `` |  |
| `accrual_until_date` | `date` | YES | `` | NULL | `` |  |
| `interest_to_accrual` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `accrued_interest` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `interest_suspension` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `days_to_accrual` | `int` | YES | `` | NULL | `` |  |
| `accrual_data_json` | `longtext` | YES | `` | NULL | `` |  |
| `payment_accrual_data_json` | `longtext` | YES | `` | NULL | `` |  |
| `auto_accrual_data_json` | `longtext` | YES | `` | NULL | `` |  |
| `capital_residue` | `decimal(12,2)` | YES | `` | NULL | `` |  |
| `interest_to_bill` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `amortization` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `interest_rate` | `decimal(19,10)` | YES | `` | NULL | `` |  |
| `a` | `decimal(19,10)` | YES | `` | NULL | `` |  |
| `b` | `decimal(19,10)` | YES | `` | NULL | `` |  |
| `c` | `decimal(19,10)` | YES | `` | NULL | `` |  |
| `d` | `decimal(19,10)` | YES | `` | NULL | `` |  |
| `closed_date` | `date` | YES | `` | NULL | `` |  |
| `quotas_expirations` | `int` | YES | `` | 0 | `` |  |
| `amount_treatments` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `residue_treatments` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `amount_quota` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `residue_quota` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `contract_promotion_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |

### `contract_files`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `269954`  

- **PK:** `id`

**FK salientes:**

- `contract_files_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_files_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `file` | `varchar(191)` | NO | `` | NULL | `` |  |
| `type` | `int` | NO | `` | 0 | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |

### `contract_monitorings`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `251680`  

- **PK:** `id`

**FK salientes:**

- `contract_monitorings_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_monitorings_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_monitorings_insurance_id_foreign`: (`insurance_id`) → `insurances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_monitorings_seller_id_foreign`: (`seller_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_monitorings_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `seller_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `from_date` | `date` | NO | `` | NULL | `` |  |
| `until_date` | `date` | YES | `` | NULL | `` |  |
| `request_number` | `int unsigned` | NO | `` | NULL | `` |  |
| `insurance_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `int unsigned` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `motive` | `longtext` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `contract_observations`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `217186`  

- **PK:** `id`

**FK salientes:**

- `contract_observations_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_observations_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `observation` | `longtext` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `contract_personal_references`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `49`  

- **PK:** `id`

**FK salientes:**

- `contract_personal_references_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `phone` | `varchar(191)` | YES | `` | NULL | `` |  |
| `relation` | `varchar(191)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `contract_promotion_insurance`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `978`  

- **PK:** `id`

**FK salientes:**

- `contract_promotion_insurance_contract_promotion_id_foreign`: (`contract_promotion_id`) → `contract_promotions` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_promotion_insurance_insurance_id_foreign`: (`insurance_id`) → `insurances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `insurance_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `contract_promotion_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `contract_promotions`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1074`  

- **PK:** `id`

**Referenciada por (muestra):**
- `contract_fees` → `contract_promotions` (`contract_fees_contract_promotion_id_foreign`)
- `contract_promotion_insurance` → `contract_promotions` (`contract_promotion_insurance_contract_promotion_id_foreign`)
- `contracts` → `contract_promotions` (`contracts_contract_promotion_id_foreign`)
- `facebook_ads` → `contract_promotions` (`facebook_ads_contract_promotion_id_foreign`)
- `payments` → `contract_promotions` (`payments_contract_promotion_id_foreign`)
- `promotion_services_doctors_details` → `contract_promotions` (`promotion_services_doctors_details_contract_promotion_id_foreign`)
- `sales_opportunities` → `contract_promotions` (`sales_opportunities_contract_promotion_id_foreign`)

**FK salientes:**

- `contract_promotions_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_promotions_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_promotions_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `start` | `datetime` | YES | `` | NULL | `` |  |
| `end` | `datetime` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `promotion_types` | `int` | YES | `` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `type_agreement` | `smallint` | NO | `` | 1 | `` |  |
| `quotas_numbers` | `varchar(191)` | YES | `` | NULL | `` |  |
| `quotas_type` | `smallint` | YES | `` | NULL | `` |  |
| `quotas_amount` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `percentage` | `int` | NO | `` | 0 | `` |  |
| `cross_contract` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `processed_at` | `datetime` | YES | `` | NULL | `` |  |

### `contract_renovations`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `182348`  

- **PK:** `id`

**FK salientes:**

- `contract_renovations_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `from_date` | `date` | NO | `` | NULL | `` |  |
| `until_date` | `date` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `contract_scorings`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1168659`  

- **PK:** `id`

**FK salientes:**

- `contract_scorings_account_holder_id_foreign`: (`account_holder_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_scorings_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_scorings_contract_situation_id_foreign`: (`contract_situation_id`) → `contract_situations` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_scorings_insurance_id_foreign`: (`insurance_id`) → `insurances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `closing_date` | `date` | NO | `` | NULL | `` |  |
| `date_renovation` | `date` | YES | `` | NULL | `` |  |
| `account_holder_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `insurance_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `contract_type` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `renewal_number` | `int` | YES | `` | NULL | `` |  |
| `total_amount` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `total_payments` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `total_exonerations` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `total_balance` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `quota_balance` | `int` | YES | `` | NULL | `` |  |
| `contract_situation_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `days_late` | `int` | NO | `` | NULL | `` |  |
| `expired_quotas` | `int` | NO | `` | NULL | `` |  |
| `expired_amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `last_payment` | `date` | YES | `` | NULL | `` |  |
| `usage_rate` | `int` | YES | `` | NULL | `` |  |
| `usage_rate_amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `faja` | `varchar(191)` | YES | `` | NULL | `` |  |
| `antiquity` | `int` | YES | `` | NULL | `` |  |
| `age` | `int` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `contract_situations`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `66395`  

- **PK:** `id`

**Referenciada por (muestra):**
- `contract_scorings` → `contract_situations` (`contract_scorings_contract_situation_id_foreign`)

**FK salientes:**

- `contract_situations_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_situations_culminated_motive_id_foreign`: (`culminated_motive_id`) → `culminated_motives` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contract_situations_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `type` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `culminated_motive_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `medium` | `smallint` | YES | `` | NULL | `` |  |
| `work_area` | `smallint` | YES | `` | NULL | `` |  |
| `observation` | `mediumtext` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `contracting_entities`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `53692`  

- **PK:** `id`

**FK salientes:**

- `contracting_entities_account_manager_id_foreign`: (`account_manager_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracting_entities_contracts_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracting_entities_debit_entities_id_foreign`: (`debitentity_id`) → `debit_entities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `debitentity_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `account_manager_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `account_manager` | `varchar(191)` | NO | `` | NULL | `` |  |
| `document_manager` | `varchar(191)` | NO | `` | NULL | `` |  |
| `account_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `card_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |

### `contracts`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `147845`  

- **PK:** `id`

**Referenciada por (muestra):**
- `additional_service_contract` → `contracts` (`additional_service_contract_contract_id_foreign`)
- `addresses` → `contracts` (`addresses_contract_id_foreign`)
- `anticipated_cancelations` → `contracts` (`anticipated_cancelations_contract_id_foreign`)
- `bancard_card_contracts` → `contracts` (`bancard_card_contracts_contract_id_foreign`)
- `bank_transfer_details` → `contracts` (`bank_transfer_details_contract_id_foreign`)
- `banks_contract_debit_details` → `contracts` (`banks_contract_debit_details_contract_id_foreign`)
- `cadastres` → `contracts` (`cadastres_contract_id_foreign`)
- `calendar_events` → `contracts` (`calendar_events_contract_id_foreign`)
- `call_center_calls` → `contracts` (`call_center_calls_contract_id_foreign`)
- `card_prints` → `contracts` (`card_prints_contract_id_foreign`)
- `cases_to_calls` → `contracts` (`cases_to_calls_contract_id_foreign`)
- `cash_box_details` → `contracts` (`cash_box_details_contract_id_foreign`)
- `cell_payments` → `contracts` (`cell_payments_contract_id_foreign`)
- `check_discounts` → `contracts` (`check_discounts_contract_id_foreign`)
- `client_credit_days` → `contracts` (`client_credit_days_contract_id_foreign`)
- `client_files` → `contracts` (`client_files_contract_id_foreign`)
- `client_services` → `contracts` (`client_services_contract_id_foreign`)
- `client_treatment_orthodontics` → `contracts` (`client_treatment_orthodontics_contract_id_foreign`)
- `client_turn_portfolio_details` → `contracts` (`client_turn_portfolio_details_contract_id_foreign`)
- `collection_form_details` → `contracts` (`collection_form_details_contract_id_foreign`)
- `commission_contracts` → `contracts` (`commission_contracts_contract_id_foreign`)
- `commission_payment_details` → `contracts` (`commission_payment_details_contract_id_foreign`)
- `commissions` → `contracts` (`commissions_contract_id_foreign`)
- `complaints` → `contracts` (`complaints_contract_id_foreign`)
- `contract_authorizations` → `contracts` (`contract_authorizations_contracts_id_foreign`)
- `contract_clients` → `contracts` (`contract_clients_contracts_id_foreign`)
- `contract_closed_dates` → `contracts` (`contract_closed_dates_contract_id_foreign`)
- `contract_comercial_references` → `contracts` (`contract_comercial_references_contract_id_foreign`)
- `contract_debited_details` → `contracts` (`contract_debited_details_contract_id_foreign`)
- `contract_fees` → `contracts` (`contract_fees_contracts_id_foreign`)
- `contract_files` → `contracts` (`contract_files_contract_id_foreign`)
- `contract_observations` → `contracts` (`contract_observations_contract_id_foreign`)
- `contract_personal_references` → `contracts` (`contract_personal_references_contract_id_foreign`)
- `contract_promotions` → `contracts` (`contract_promotions_contract_id_foreign`)
- `contract_renovations` → `contracts` (`contract_renovations_contract_id_foreign`)
- `contract_scorings` → `contracts` (`contract_scorings_contract_id_foreign`)
- `contract_situations` → `contracts` (`contract_situations_contract_id_foreign`)
- `contracting_entities` → `contracts` (`contracting_entities_contracts_id_foreign`)
- `contracts` → `contracts` (`contracts_old_contract_id_foreign`)
- `contracts_vouchers_details` → `contracts` (`contracts_vouchers_details_contract_id_foreign`)
- *… y 37 restricciones más*

**FK salientes:**

- `contracts_account_holder_id_foreign`: (`account_holder_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_city_id_enterprise_request_foreign`: (`city_id_enterprise_request`) → `cities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_clients_enterprise_id_request_foreign`: (`clients_enterprise_id_request`) → `clients_enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_contract_promotion_id_foreign`: (`contract_promotion_id`) → `contract_promotions` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_corporate_agreement_id_foreign`: (`corporate_agreement_id`) → `corporate_agreements` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_coverage_address_id_foreign`: (`coverage_address_id`) → `addresses` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_cuotera_id_foreign`: (`cuotera_id`) → `cuoteras` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_customer_profession_id_foreign`: (`customer_profession_id`) → `customer_professions` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_dental_budget_id_foreign`: (`dental_budget_id`) → `dental_budgets` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_dental_office_id_foreign`: (`dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_destination_loan_id_foreign`: (`destination_loan_id`) → `destination_loans` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_esth_package_id_foreign`: (`esth_package_id`) → `esthetic_packages` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_half_contact_id_foreign`: (`half_contact_id`) → `half_contacts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_heading_id_foreign`: (`heading_id`) → `headings` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_inactived_user_id_foreign`: (`inactived_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_insurance_id_foreign`: (`insurance_id`) → `insurances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_interest_rate_id_foreign`: (`interest_rate_id`) → `interest_rates` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_invoice_cycle_id_foreign`: (`invoice_cycle_id`) → `invoice_cycles` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_managment_agent_id_foreign`: (`managment_agent_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_nationality_id_spouse_request_foreign`: (`nationality_id_spouse_request`) → `nationalities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_neighborhood_id_enterprise_request_foreign`: (`neighborhood_id_enterprise_request`) → `neighborhoods` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_old_contract_id_foreign`: (`old_contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_other_insurance_id_foreign`: (`other_insurance_id`) → `insurances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_product_money_loan_id_foreign`: (`product_money_loan_id`) → `product_money_loans` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_sales_closer_id_foreign`: (`sales_closer_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_seller_id_foreign`: (`seller_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_seller_supervisor_id_foreign`: (`seller_supervisor_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_user_branch_id_foreign`: (`user_branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_user_disbursement_foreign`: (`user_disbursement`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_user_liquidations_foreign`: (`user_liquidations`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_voucher_id_foreign`: (`voucher_id`) → `vouchers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `activation_date` | `datetime` | YES | `` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_branch_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `account_holder_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `coverage_address_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `number` | `int` | NO | `` | NULL | `` |  |
| `order_number` | `int` | YES | `` | NULL | `` |  |
| `date_order` | `date` | YES | `` | NULL | `` |  |
| `request_number` | `int` | NO | `` | NULL | `` |  |
| `request_financing_number` | `int` | YES | `` | NULL | `` |  |
| `seller_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `seller_supervisor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `sales_closer_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `insurance_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `other_insurance_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `message_id` | `varchar(191)` | YES | `` | NULL | `` |  |
| `contract_promotion_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `half_contact_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `invoice_cycle_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `masive_invoice` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `contract_type` | `tinyint(1)` | NO | `MUL` | 1 | `` |  |
| `actual_stretch` | `int` | YES | `` | NULL | `` |  |
| `real_stretch` | `int` | YES | `` | NULL | `` |  |
| `from_effective_date` | `date` | YES | `` | NULL | `` |  |
| `until_effective_date` | `date` | YES | `` | NULL | `` |  |
| `persons_amount` | `int` | YES | `` | NULL | `` |  |
| `students_quantity` | `int` | YES | `` | NULL | `` |  |
| `unit_amount` | `decimal(11,2)` | NO | `` | 0.00 | `` |  |
| `quotas_amount` | `int` | NO | `` | NULL | `` |  |
| `amount` | `decimal(12,2)` | NO | `` | NULL | `` |  |
| `original_amount` | `decimal(11,2)` | NO | `` | 0.00 | `` |  |
| `actual_fee_quantity` | `int unsigned` | YES | `` | NULL | `` |  |
| `total_quotas` | `decimal(12,2)` | NO | `` | 0.00 | `` |  |
| `inscription` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `control_call_day` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `control_call_time` | `time` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `product_money_loan_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `requested_amount` | `decimal(12,2)` | YES | `` | NULL | `` |  |
| `total_requested_amount` | `decimal(12,2)` | YES | `` | NULL | `` |  |
| `amount_approved_credit` | `decimal(12,2)` | YES | `` | NULL | `` |  |
| `total_amount_approved_credit` | `decimal(12,2)` | YES | `` | NULL | `` |  |
| `quantity_approved_credit` | `int` | YES | `` | NULL | `` |  |
| `disbursement_amount` | `decimal(12,2)` | YES | `` | NULL | `` |  |
| `amount_idem_invoice` | `decimal(11,2)` | NO | `` | 0.00 | `` |  |
| `refinanced_loan` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `percentaje` | `decimal(5,2)` | YES | `` | NULL | `` |  |
| `administrative_expense_percentage` | `decimal(5,2)` | YES | `` | NULL | `` |  |
| `periodic_rate` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `iva` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `administrative_expenses` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `administrative_expenses_iva` | `decimal(12,2)` | YES | `` | NULL | `` |  |
| `amount_commission_brokerage` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `amount_commission_brokerage_iva` | `decimal(12,2)` | YES | `` | NULL | `` |  |
| `capital` | `decimal(12,2)` | YES | `` | NULL | `` |  |
| `capital_residue` | `decimal(12,2)` | YES | `` | NULL | `` |  |
| `amount_additional` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `amount_additional_iva` | `decimal(12,2)` | YES | `` | NULL | `` |  |
| `interest` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `interest_residue` | `decimal(12,2)` | YES | `` | NULL | `` |  |
| `interest_to_accrual` | `decimal(12,2)` | YES | `` | NULL | `` |  |
| `accrued_interest` | `decimal(12,2)` | YES | `` | NULL | `` |  |
| `accrued_days` | `int` | NO | `` | NULL | `` |  |
| `interest_iva` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `rate_frequency` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `invoice_interest_payment` | `tinyint(1)` | YES | `` | 0 | `` |  |
| `destination_loan_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `cuotera_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `interest_rate_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `type_calc` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `clients_enterprise_id_request` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `phone_request` | `varchar(191)` | YES | `` | NULL | `` |  |
| `position_request` | `varchar(191)` | YES | `` | NULL | `` |  |
| `salary_request` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `antiquity_request` | `varchar(191)` | YES | `` | NULL | `` |  |
| `ips_request` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `enterprise_activity_request` | `varchar(191)` | YES | `` | NULL | `` |  |
| `address_enterprise_request` | `varchar(191)` | YES | `` | NULL | `` |  |
| `neighborhood_enterprise_request` | `varchar(191)` | YES | `` | NULL | `` |  |
| `city_id_enterprise_request` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `neighborhood_id_enterprise_request` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `other_income_request` | `varchar(191)` | YES | `` | NULL | `` |  |
| `concept_request` | `varchar(191)` | YES | `` | NULL | `` |  |
| `check_labor_data` | `varchar(191)` | YES | `` | NULL | `` |  |
| `name_spouse_request` | `varchar(191)` | YES | `` | NULL | `` |  |
| `document_number_spouse_request` | `int` | YES | `` | NULL | `` |  |
| `birth_date_spouse_request` | `date` | YES | `` | NULL | `` |  |
| `address_spouse_request` | `varchar(191)` | YES | `` | NULL | `` |  |
| `neighborhood_spouse_request` | `varchar(191)` | YES | `` | NULL | `` |  |
| `nationality_id_spouse_request` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `civil_status_spouse_request` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `gender_spouse_request` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `check_spouse_data` | `varchar(191)` | YES | `` | NULL | `` |  |
| `name_reference_request_1` | `varchar(191)` | YES | `` | NULL | `` |  |
| `phones_reference_request_1` | `varchar(191)` | YES | `` | NULL | `` |  |
| `relation_reference_request_1` | `varchar(191)` | YES | `` | NULL | `` |  |
| `check_reference_request_1` | `varchar(191)` | YES | `` | NULL | `` |  |
| `name_reference_request_2` | `varchar(191)` | YES | `` | NULL | `` |  |
| `phones_reference_request_2` | `varchar(191)` | YES | `` | NULL | `` |  |
| `relation_reference_request_2` | `varchar(191)` | YES | `` | NULL | `` |  |
| `check_reference_request_2` | `varchar(191)` | YES | `` | NULL | `` |  |
| `name_reference_request_3` | `varchar(191)` | YES | `` | NULL | `` |  |
| `phones_reference_request_3` | `varchar(191)` | YES | `` | NULL | `` |  |
| `relation_reference_request_3` | `varchar(191)` | YES | `` | NULL | `` |  |
| `check_reference_request_3` | `varchar(191)` | YES | `` | NULL | `` |  |
| `informconf_grildle_request` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_liquidations` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `observation_liquidations` | `varchar(191)` | YES | `` | NULL | `` |  |
| `date_liquidations` | `date` | YES | `` | NULL | `` |  |
| `user_disbursement` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `observation_disbursement` | `longtext` | YES | `` | NULL | `` |  |
| `date_disbursement` | `date` | YES | `` | NULL | `` |  |
| `total_debt` | `decimal(12,2)` | NO | `` | NULL | `` |  |
| `total_paid` | `decimal(12,2)` | YES | `` | NULL | `` |  |
| `quantity_quotas_paid` | `int` | NO | `` | 0 | `` |  |
| `total_value` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `quantity_renovation` | `int` | YES | `` | NULL | `` |  |
| `expired_quotas` | `int` | NO | `` | NULL | `` |  |
| `expired_amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `last_payment` | `date` | YES | `` | NULL | `` |  |
| `call_again` | `date` | YES | `` | NULL | `` |  |
| `payment_date` | `date` | YES | `` | NULL | `` |  |
| `payment_date_cc` | `date` | YES | `` | NULL | `` |  |
| `denomination` | `varchar(191)` | YES | `` | NULL | `` |  |
| `last_payment_location` | `varchar(191)` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `MUL` | 1 | `` |  |
| `quality_control_status` | `int` | YES | `` | NULL | `` |  |
| `exception_authorizer` | `smallint` | YES | `` | NULL | `` |  |
| `exception_motive` | `smallint` | YES | `` | NULL | `` |  |
| `inactived_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `dental_office_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `pending_adherents` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `old_contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `seed_update` | `int` | NO | `` | 0 | `` |  |
| `esth_package_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `type_plan` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `first_payment_made` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `voucher_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `cadastre_status` | `int` | NO | `` | NULL | `` |  |
| `client_sales_process` | `int` | NO | `` | 0 | `` |  |
| `mpp_insurance_use` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `mpp_insurance_use_expiration` | `date` | YES | `` | NULL | `` |  |
| `manager_fullname` | `varchar(191)` | YES | `` | NULL | `` |  |
| `pending_assignament` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `portfolio_from_date` | `date` | YES | `` | NULL | `` |  |
| `portfolio_until_date` | `date` | YES | `` | NULL | `` |  |
| `last_date_management` | `date` | YES | `` | NULL | `` |  |
| `last_phone_attended` | `varchar(191)` | YES | `` | NULL | `` |  |
| `heading_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `dental_budget_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `enabled_for_accrual` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `activated_for_accrual` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `next_accrual_date` | `date` | YES | `` | NULL | `` |  |
| `last_accrual_date` | `date` | YES | `` | NULL | `` |  |
| `accounting_seated` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `days_for_first_expiration` | `int` | NO | `` | 0 | `` |  |
| `corporate_agreement_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `automatic_renewal` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `construction` | `varchar(191)` | YES | `` | NULL | `` |  |
| `client_branch` | `varchar(191)` | YES | `` | NULL | `` |  |
| `next_expiration_to_pay` | `date` | YES | `` | NULL | `` |  |
| `expiration_date` | `date` | YES | `` | NULL | `` |  |
| `is_update` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `ruc` | `varchar(191)` | YES | `` | NULL | `` |  |
| `social_reason` | `varchar(191)` | YES | `` | NULL | `` |  |
| `judicial_management` | `tinyint(1)` | YES | `` | 0 | `` |  |
| `inactived_motive` | `longtext` | YES | `` | NULL | `` |  |
| `inactived_at` | `datetime` | YES | `` | NULL | `` |  |
| `managment_agent_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `regularized_contract` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `customer_profession_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `tan` | `decimal(4,2)` | YES | `` | NULL | `` |  |
| `tae` | `decimal(4,2)` | YES | `` | NULL | `` |  |
| `actual_loans` | `int` | NO | `` | NULL | `` |  |
| `canceled_loans` | `int` | NO | `` | NULL | `` |  |
| `pending_loans` | `int` | NO | `` | NULL | `` |  |
| `others_loans` | `int` | NO | `` | NULL | `` |  |
| `previous_capital` | `decimal(12,2)` | NO | `` | NULL | `` |  |
| `previous_interest` | `decimal(12,2)` | NO | `` | NULL | `` |  |
| `max_days_late` | `int` | NO | `` | NULL | `` |  |
| `last_days_late` | `int` | NO | `` | NULL | `` |  |
| `attended` | `smallint` | YES | `` | NULL | `` |  |

### `contracts_vouchers_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `58059`  

- **PK:** `id`

**FK salientes:**

- `contracts_vouchers_details_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `contracts_vouchers_details_voucher_id_foreign`: (`voucher_id`) → `vouchers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `voucher_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `contratos_asignar`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `3360`  

- **PK:** *(no declarada como `PRIMARY` en information_schema)*

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `nro_contrato` | `int` | YES | `` | NULL | `` |  |
| `gestor` | `varchar(100)` | YES | `` | NULL | `` |  |
| `idcartera` | `int` | YES | `` | NULL | `` |  |
| `empresa` | `int` | YES | `` | NULL | `` |  |
| `contract_id` | `int` | YES | `` | NULL | `` |  |
| `portfolio_movements_id` | `int` | YES | `` | NULL | `` |  |

### `contratos_debitos_a_cobrador`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `912`  

- **PK:** *(no declarada como `PRIMARY` en information_schema)*

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `monto` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `nro_cuenta` | `varchar(191)` | NO | `` | NULL | `` |  |
| `cliente` | `varchar(191)` | NO | `` | NULL | `` |  |
| `motivo` | `varchar(191)` | NO | `` | NULL | `` |  |
| `nro_contrato` | `int` | NO | `` | NULL | `` |  |
| `estado` | `tinyint(1)` | YES | `` | 1 | `` |  |

### `contratos_deshabilitar`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `150`  

- **PK:** `id`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `nro_cuenta` | `varchar(25)` | NO | `` | NULL | `` |  |
| `monto` | `int` | NO | `` | NULL | `` |  |
| `contract_id` | `int` | YES | `` | NULL | `` |  |
| `id` | `int` | NO | `PRI` | NULL | `auto_increment` |  |

### `contratos_para_tapo`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `7790`  

- **PK:** `id`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `nro_contrato` | `int` | NO | `` | NULL | `` |  |
| `monto` | `int` | NO | `` | NULL | `` |  |
| `valor_aumentado` | `int` | NO | `` | NULL | `` |  |
| `unidad_de_negocio` | `varchar(100)` | NO | `` | NULL | `` |  |
| `contract_id` | `int` | YES | `` | NULL | `` |  |
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `status` | `int` | YES | `` | 0 | `` |  |

### `contratos_uso_mpp`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2608`  

- **PK:** `id`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `number` | `int` | YES | `` | NULL | `` |  |
| `expiration` | `date` | YES | `` | NULL | `` |  |
| `id` | `int` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_id` | `int` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 0 | `` |  |

### `contratos_vendidos`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `5068`  

- **PK:** *(no declarada como `PRIMARY` en information_schema)*

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `nro_contrato` | `int` | NO | `` | NULL | `` |  |
| `contract_id` | `int` | NO | `` | NULL | `` |  |
| `contract_situation_id` | `int` | NO | `` | NULL | `` |  |

### `corporate_agreements`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `4`  

- **PK:** `id`

**Referenciada por (muestra):**
- `contracts` → `corporate_agreements` (`contracts_corporate_agreement_id_foreign`)
- `corporate_agreements_enterprises` → `corporate_agreements` (`corporate_agreements_enterprises_corporate_agreement_id_foreign`)

**FK salientes:**

- `corporate_agreements_clients_enterprise_id_foreign`: (`clients_enterprise_id`) → `clients_enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `corporate_agreements_seller_id_foreign`: (`seller_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `clients_enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `description` | `varchar(191)` | NO | `` | NULL | `` |  |
| `seller_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `percentage_discount` | `int` | NO | `` | NULL | `` |  |
| `odo_commission` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `mee_commission` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `mpp_commission` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `corporate_agreements_enterprises`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `11`  

- **PK:** `id`

**FK salientes:**

- `corporate_agreements_enterprises_corporate_agreement_id_foreign`: (`corporate_agreement_id`) → `corporate_agreements` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `corporate_agreements_enterprises_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `corporate_agreement_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `cost_centers`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `47`  

- **PK:** `id`

**Referenciada por (muestra):**
- `accounting_entry_details` → `cost_centers` (`accounting_entry_details_cost_center_id_foreign`)
- `branch_cost_centers` → `cost_centers` (`branch_cost_centers_cost_center_id_foreign`)
- `dental_offices` → `cost_centers` (`dental_offices_cost_center_id_foreign`)
- `deposit_cost_centers` → `cost_centers` (`deposit_cost_centers_cost_center_id_foreign`)
- `people_cost_centers` → `cost_centers` (`people_cost_centers_cost_center_id_foreign`)
- `purchases_cost_centers` → `cost_centers` (`purchases_cost_centers_cost_center_id_foreign`)
- `purchases_order_cost_centers` → `cost_centers` (`purchases_order_cost_centers_cost_center_id_foreign`)
- `service_invoice_branch_enterprices` → `cost_centers` (`service_invoice_branch_enterprices_cost_center_id_foreign`)

**FK salientes:**

- `cost_centers_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cost_centers_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cost_centers_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `social_reason_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `abbreviation` | `varchar(191)` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `costos_migrar`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `3256`  

- **PK:** *(no declarada como `PRIMARY` en information_schema)*

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `product_id` | `int` | NO | `` | NULL | `` |  |
| `price_cost_iva` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `price_cost` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `social_reason_id` | `int` | NO | `` | NULL | `` |  |

### `coverages`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `39`  

- **PK:** `id`

**Referenciada por (muestra):**
- `insurances` → `coverages` (`insurances_coverage_id_foreign`)
- `medical_coverages` → `coverages` (`medical_coverages_coverage_id_foreign`)

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `credit_benches`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `credit_benches_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `credit_note_reason`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `20`  

- **PK:** `id`

**Referenciada por (muestra):**
- `calendar_events` → `credit_note_reason` (`calendar_events_credit_note_reason_id_foreign`)
- `dental_budget_details` → `credit_note_reason` (`dental_budget_details_canceled_motive_id_foreign`)
- `vouchers` → `credit_note_reason` (`vouchers_cnote_reason_id_foreign`)

**FK salientes:**

- `credit_note_reason_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `type_reason` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `creditor_account_payments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `creditor_account_payments_creditor_fee_id_foreign`: (`creditor_fee_id`) → `creditor_fees` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `creditor_account_payments_creditor_payment_id_foreign`: (`creditor_payment_id`) → `creditor_payments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `creditor_payment_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `creditor_fee_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `capital_amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `interest_amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `creditor_fees`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**Referenciada por (muestra):**
- `creditor_account_payments` → `creditor_fees` (`creditor_account_payments_creditor_fee_id_foreign`)

**FK salientes:**

- `creditor_fees_creditor_id_foreign`: (`creditor_id`) → `creditors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `creditor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `number` | `int` | NO | `` | NULL | `` |  |
| `expiration` | `date` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `residue` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `capital` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `capital_residue` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `interest` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `interest_residue` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `creditor_payments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**Referenciada por (muestra):**
- `creditor_account_payments` → `creditor_payments` (`creditor_account_payments_creditor_payment_id_foreign`)

**FK salientes:**

- `creditor_payments_creditor_id_foreign`: (`creditor_id`) → `creditors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `creditor_payments_deleted_user_id_foreign`: (`deleted_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `creditor_payments_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `creditor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `reference` | `varchar(191)` | NO | `` | NULL | `` |  |
| `amount` | `decimal(13,2)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `observation` | `longtext` | NO | `` | NULL | `` |  |
| `deleted_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `creditors`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**Referenciada por (muestra):**
- `creditor_fees` → `creditors` (`creditor_fees_creditor_id_foreign`)
- `creditor_payments` → `creditors` (`creditor_payments_creditor_id_foreign`)

**FK salientes:**

- `creditors_purchases_provider_id_foreign`: (`purchases_provider_id`) → `purchases_providers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `creditors_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `creditors_user_deleted_id_foreign`: (`user_deleted_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `creditors_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `social_reason_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `purchases_provider_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `reference_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `total` | `decimal(13,2)` | NO | `` | NULL | `` |  |
| `residue` | `decimal(13,2)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `date_deleted` | `datetime` | YES | `` | NULL | `` |  |
| `user_deleted_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `disbursement_amount_commission` | `decimal(13,2)` | NO | `` | NULL | `` |  |

### `crm_contacts`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `383`  

- **PK:** `id`

**FK salientes:**

- `crm_contacts_opportunity_id_foreign`: (`opportunity_id`) → `sales_opportunities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `opportunity_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `contact_name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `contact_charge` | `varchar(191)` | YES | `` | NULL | `` |  |
| `email` | `varchar(191)` | YES | `` | NULL | `` |  |
| `prefix` | `varchar(191)` | NO | `` | NULL | `` |  |
| `number_without_prefix` | `varchar(191)` | NO | `` | NULL | `` |  |
| `number` | `varchar(191)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `crm_products`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `779`  

- **PK:** `id`

**FK salientes:**

- `crm_products_additional_service_id_foreign`: (`additional_service_id`) → `additional_services` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `opportunity_id` | `int unsigned` | NO | `` | NULL | `` |  |
| `additional_service_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `paramedic` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `ambulance` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `sold` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `crosseling_contracts`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `8`  

- **PK:** `id`

**FK salientes:**

- `crosseling_contracts_original_contract_id_foreign`: (`original_contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `crosseling_contracts_promotion_contract_id_foreign`: (`promotion_contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `original_contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `promotion_contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `original_price` | `int` | NO | `` | NULL | `` |  |
| `promo_price` | `int` | NO | `` | NULL | `` |  |
| `recalculated_promo` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `culminated_motives`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `85`  

- **PK:** `id`

**Referenciada por (muestra):**
- `contract_situations` → `culminated_motives` (`contract_situations_culminated_motive_id_foreign`)

**FK salientes:**

- `culminated_motives_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `cuotas_vencidas`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `11128`  

- **PK:** *(no declarada como `PRIMARY` en information_schema)*

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `UN` | `varchar(255)` | YES | `` | NULL | `` |  |
| `SUCURSAL` | `varchar(191)` | YES | `` | NULL | `` |  |
| `NRO_CONTRATO` | `int` | YES | `` | NULL | `` |  |
| `NRO_SOLICITUD` | `int` | YES | `` | NULL | `` |  |
| `CUOTAS_VENCIDAS` | `int` | YES | `` | NULL | `` |  |
| `MONTO_VENCIDO` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `ESTADO` | `varchar(191)` | YES | `` | NULL | `` |  |

### `cuotera_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `585`  

- **PK:** `id`

**FK salientes:**

- `cuotera_details_cuotera_id_foreign`: (`cuotera_id`) → `cuoteras` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `cuotera_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `fee_amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `term` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `capital` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `interest` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `rate_percentage` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `amount_administrative_expenses` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `amount_commission_brokerage` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `percentage_commission_brokerage` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `amount_additional` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `percentage_additional` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `cuoteras`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `18`  

- **PK:** `id`

**Referenciada por (muestra):**
- `contracts` → `cuoteras` (`contracts_cuotera_id_foreign`)
- `cuotera_details` → `cuoteras` (`cuotera_details_cuotera_id_foreign`)
- `product_money_loans` → `cuoteras` (`product_money_loans_cuotera_id_foreign`)

**FK salientes:**

- `cuoteras_interest_rate_id_foreign`: (`interest_rate_id`) → `interest_rates` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `cuoteras_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `interest_rate_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `currencies`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2`  

- **PK:** `id`

**Referenciada por (muestra):**
- `calendar_payments` → `currencies` (`calendar_payments_currency_id_foreign`)
- `cash_box_closes` → `currencies` (`cash_box_closes_currency_id_foreign`)
- `cash_box_details` → `currencies` (`cash_box_details_currency_id_foreign`)
- `currency_quotations` → `currencies` (`currency_quotations_currency_id_foreign`)
- `op_massives` → `currencies` (`op_massives_currency_id_foreign`)
- `provider_autorizathion_payments` → `currencies` (`provider_autorizathion_payments_currency_id_foreign`)
- `purchases` → `currencies` (`purchases_currency_id_foreign`)
- `purchases_movements` → `currencies` (`purchases_movements_currency_id_foreign`)
- `purchases_orders` → `currencies` (`purchases_orders_currency_id_foreign`)
- `restockings` → `currencies` (`restockings_currency_id_foreign`)
- `vouchers` → `currencies` (`vouchers_currency_id_foreign`)

**FK salientes:**

- `currencies_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `abbreviation` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `currency_quotations`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `currency_quotations_currency_id_foreign`: (`currency_id`) → `currencies` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `currency_quotations_user_deleted_id_foreign`: (`user_deleted_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `currency_quotations_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `currency_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `purchase` | `int` | NO | `` | NULL | `` |  |
| `sale` | `int` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_deleted_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `date_deleted` | `datetime` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `customer_professions`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**Referenciada por (muestra):**
- `contracts` → `customer_professions` (`contracts_customer_profession_id_foreign`)

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `debit_disableds`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `3285`  

- **PK:** `id`

**FK salientes:**

- `debit_disableds_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `debit_disableds_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `from_date` | `date` | NO | `` | NULL | `` |  |
| `until_date` | `date` | NO | `` | NULL | `` |  |
| `observation` | `mediumtext` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `debit_entities`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `48`  

- **PK:** `id`

**Referenciada por (muestra):**
- `banks_contract_debits` → `debit_entities` (`banks_contract_debits_debitentity_id_foreign`)
- `cadastres` → `debit_entities` (`cadastres_debit_entity_id_foreign`)
- `collection_forms` → `debit_entities` (`collection_forms_debit_entity_id_foreign`)
- `contract_debiteds` → `debit_entities` (`contract_debiteds_debit_entity_id_foreign`)
- `contracting_entities` → `debit_entities` (`contracting_entities_debit_entities_id_foreign`)
- `debit_entity_files` → `debit_entities` (`debit_entity_files_debit_entity_id_foreign`)
- `request_changes` → `debit_entities` (`request_changes_new_debitentity_id_foreign`)
- `request_changes` → `debit_entities` (`request_changes_old_debitentity_id_foreign`)

**FK salientes:**

- `debit_entities_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `period` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `aso_tapo` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `credit_limit_tapo` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `collection_percentage` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `entity_type_id` | `int unsigned` | YES | `` | NULL | `` |  |
| `lines_quantity` | `int` | YES | `` | NULL | `` |  |

### `debit_entity_files`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2`  

- **PK:** `id`

**FK salientes:**

- `debit_entity_files_debit_entity_id_foreign`: (`debit_entity_id`) → `debit_entities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `debit_entity_files_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `debit_entity_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `type` | `int` | NO | `` | NULL | `` |  |
| `document` | `varchar(191)` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |

### `denpro_motive_rejecteds`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `5`  

- **PK:** `id`

**Referenciada por (muestra):**
- `client_laboratories` → `denpro_motive_rejecteds` (`client_laboratories_rejected_motive_id_foreign`)

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `dental_budget_detail_percentages`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2107600`  

- **PK:** `id`

**FK salientes:**

- `dental_budget_detail_percentages_budget_detail_id_foreign`: (`budget_detail_id`) → `dental_budget_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `budget_detail_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `session_number` | `int` | NO | `` | NULL | `` |  |
| `percentage` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `dental_budget_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1888660`  

- **PK:** `id`

**Referenciada por (muestra):**
- `client_services` → `dental_budget_details` (`client_services_dental_budget_detail_id_foreign`)
- `dental_budget_detail_percentages` → `dental_budget_details` (`dental_budget_detail_percentages_budget_detail_id_foreign`)
- `doctor_commission_details` → `dental_budget_details` (`doctor_commission_details_dental_budget_detail_id_foreign`)

**FK salientes:**

- `dental_budget_details_canceled_motive_id_foreign`: (`canceled_motive_id`) → `credit_note_reason` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dental_budget_details_dental_budget_id_foreign`: (`dental_budget_id`) → `dental_budgets` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dental_budget_details_finished_user_id_foreign`: (`finished_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dental_budget_details_processed_user_id_foreign`: (`processed_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dental_budget_details_services_doctor_id_foreign`: (`services_doctor_id`) → `services_doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dental_budget_details_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `dental_budget_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `services_doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `tooth_piece` | `varchar(191)` | YES | `` | NULL | `` |  |
| `detail` | `varchar(191)` | NO | `` | NULL | `` |  |
| `session_quantity` | `int` | YES | `` | NULL | `` |  |
| `phase_type` | `int` | YES | `` | NULL | `` |  |
| `show_amount` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `cost_amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `wholesale_amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `doctor_commission_amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `amount_suggested` | `decimal(30,2)` | NO | `` | 0.00 | `` |  |
| `original_amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `percentage_discount` | `decimal(4,2)` | NO | `` | NULL | `` |  |
| `amount` | `decimal(30,2)` | NO | `` | 0.00 | `` |  |
| `amount_financed` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `promotion_amount` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `processed_at` | `datetime` | YES | `` | NULL | `` |  |
| `processed_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `finished_at` | `datetime` | YES | `` | NULL | `` |  |
| `finished_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `last_date_payment` | `date` | YES | `` | NULL | `` |  |
| `canceled_at` | `datetime` | YES | `` | NULL | `` |  |
| `canceled_observation` | `longtext` | YES | `` | NULL | `` |  |
| `canceled_motive_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `amount_paid` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `dental_budgets`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `240363`  

- **PK:** `id`

**Referenciada por (muestra):**
- `cases_to_calls_details` → `dental_budgets` (`cases_to_calls_details_dental_budget_id_foreign`)
- `client_laboratories` → `dental_budgets` (`client_laboratories_dental_budget_id_foreign`)
- `client_service_advances` → `dental_budgets` (`client_service_advances_dental_budget_id_foreign`)
- `contracts` → `dental_budgets` (`contracts_dental_budget_id_foreign`)
- `dental_budget_details` → `dental_budgets` (`dental_budget_details_dental_budget_id_foreign`)
- `dental_budgets` → `dental_budgets` (`dental_budgets_old_budget_id_foreign`)
- `loyalty_coupons_details` → `dental_budgets` (`loyalty_coupons_details_dental_budget_id_foreign`)
- `prosthesis_laboratories` → `dental_budgets` (`prosthesis_laboratories_dental_budget_id_foreign`)
- `request_changes` → `dental_budgets` (`request_changes_dental_budget_id_foreign`)
- `sales_opportunities` → `dental_budgets` (`sales_opportunities_dental_budget_id_foreign`)

**FK salientes:**

- `dental_budgets_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dental_budgets_cancel_user_id_foreign`: (`cancel_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dental_budgets_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dental_budgets_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dental_budgets_dental_office_id_foreign`: (`dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dental_budgets_doctor_id_foreign`: (`doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dental_budgets_financing_contract_id_foreign`: (`financing_contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dental_budgets_old_budget_id_foreign`: (`old_budget_id`) → `dental_budgets` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dental_budgets_old_treatment_convention_id_foreign`: (`old_treatment_convention_id`) → `treatment_conventions` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dental_budgets_treatment_convention_id_foreign`: (`treatment_convention_id`) → `treatment_conventions` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dental_budgets_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `financing_contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `financing_budget` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `branch_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `dental_office_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `doctor_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `show_treatments_modalities` | `varchar(191)` | YES | `` | NULL | `` |  |
| `show_lab_treatments_modalities` | `varchar(191)` | YES | `` | NULL | `` |  |
| `treatment_convention_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `old_treatment_convention_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `total` | `decimal(30,2)` | NO | `` | 0.00 | `` |  |
| `total_financed` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `total_suggested` | `decimal(30,2)` | NO | `` | 0.00 | `` |  |
| `total_discount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `not_change_price` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `cancel_reason` | `longtext` | YES | `` | NULL | `` |  |
| `discount_observation` | `longtext` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `confirm_status_date` | `datetime` | YES | `` | NULL | `` |  |
| `process_status_date` | `datetime` | YES | `` | NULL | `` |  |
| `culminated_status_date` | `datetime` | YES | `` | NULL | `` |  |
| `cancel_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `old_budget_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |

### `dental_office_rooms`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `55`  

- **PK:** `id`

**Referenciada por (muestra):**
- `calendar_event_rooms` → `dental_office_rooms` (`calendar_event_rooms_dental_office_room_id_foreign`)

**FK salientes:**

- `dental_office_rooms_dental_office_id_foreign`: (`dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `dental_office_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `dental_offices`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `245`  

- **PK:** `id`

**Referenciada por (muestra):**
- `acknowledgment_receipts` → `dental_offices` (`acknowledgment_receipts_dental_office_id_foreign`)
- `calendar_events` → `dental_offices` (`calendar_events_dental_office_id_foreign`)
- `cases_to_calls_details` → `dental_offices` (`cases_to_calls_details_dental_office_id_foreign`)
- `client_laboratories` → `dental_offices` (`client_laboratories_dental_office_id_foreign`)
- `client_services` → `dental_offices` (`client_services_dental_office_id_foreign`)
- `client_treatment_orthodontics` → `dental_offices` (`client_treatment_orthodontics_dental_office_id_foreign`)
- `clients` → `dental_offices` (`clients_dental_office_id_foreign`)
- `clients` → `dental_offices` (`clients_last_dental_office_id_foreign`)
- `contracts` → `dental_offices` (`contracts_dental_office_id_foreign`)
- `dental_budgets` → `dental_offices` (`dental_budgets_dental_office_id_foreign`)
- `dental_office_rooms` → `dental_offices` (`dental_office_rooms_dental_office_id_foreign`)
- `doctor_changes` → `dental_offices` (`doctor_changes_dental_office_id_foreign`)
- `doctor_commissions` → `dental_offices` (`doctor_commissions_dental_office_id_foreign`)
- `doctor_dental_offices` → `dental_offices` (`doctor_dental_offices_dental_office_id_foreign`)
- `doctor_schedule_exceptions` → `dental_offices` (`doctor_schedule_exceptions_dental_office_id_foreign`)
- `doctor_schedules` → `dental_offices` (`doctor_schedules_dental_office_id_foreign`)
- `doctors` → `dental_offices` (`doctors_dental_office_id_foreign`)
- `esth_client_services` → `dental_offices` (`esth_client_services_dental_office_id_foreign`)
- `esth_patient_treatments` → `dental_offices` (`esth_patient_treatments_dental_office_id_foreign`)
- `medical_equipment_dental_offices` → `dental_offices` (`medical_equipment_dental_offices_dental_office_id_foreign`)
- `medical_equipments_verifications` → `dental_offices` (`medical_equipments_verifications_dental_office_id_foreign`)
- `polls_services` → `dental_offices` (`polls_services_dental_office_id_foreign`)
- `prosthesis_laboratories` → `dental_offices` (`prosthesis_laboratories_dental_office_id_foreign`)
- `service_levels` → `dental_offices` (`service_levels_dental_office_id_foreign`)
- `sms_tokens` → `dental_offices` (`sms_tokens_dental_office_id_foreign`)
- `voucher_boxes` → `dental_offices` (`voucher_boxes_dental_office_id_foreign`)
- `vouchers` → `dental_offices` (`vouchers_dental_office_id_foreign`)

**FK salientes:**

- `dental_offices_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dental_offices_city_id_foreign`: (`city_id`) → `cities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dental_offices_cost_center_id_foreign`: (`cost_center_id`) → `cost_centers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dental_offices_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dental_offices_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `address` | `varchar(191)` | NO | `` | NULL | `` |  |
| `phoneNumber` | `varchar(191)` | NO | `` | NULL | `` |  |
| `city_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `consulting_room` | `int` | NO | `` | NULL | `` |  |
| `quantity_doctors` | `int` | YES | `` | NULL | `` |  |
| `epem_office` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `is_dna_laboratory` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `camera_address` | `varchar(191)` | YES | `` | NULL | `` |  |
| `cost_center_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `departments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `23`  

- **PK:** `id`

**Referenciada por (muestra):**
- `cities` → `departments` (`cities_department_id_foreign`)

**FK salientes:**

- `departments_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |

### `deposit_cost_centers`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `70`  

- **PK:** `id`

**FK salientes:**

- `deposit_cost_centers_cost_center_id_foreign`: (`cost_center_id`) → `cost_centers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `deposit_cost_centers_deposit_id_foreign`: (`deposit_id`) → `deposits` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `deposit_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `cost_center_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `deposit_requesting_departments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `324`  

- **PK:** `id`

**FK salientes:**

- `deposit_requesting_departments_deposit_id_foreign`: (`deposit_id`) → `deposits` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `deposit_requesting_departments_requesting_department_id_foreign`: (`requesting_department_id`) → `purchases_requesting_departments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `deposit_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `requesting_department_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `deposit_users`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `177`  

- **PK:** `id`

**FK salientes:**

- `deposit_users_deposit_id_foreign`: (`deposit_id`) → `deposits` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `deposit_users_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `deposit_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `deposits`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `66`  

- **PK:** `id`

**Referenciada por (muestra):**
- `closing_inventory_stock_details` → `deposits` (`closing_inventory_stock_details_deposit_id_foreign`)
- `deposit_cost_centers` → `deposits` (`deposit_cost_centers_deposit_id_foreign`)
- `deposit_requesting_departments` → `deposits` (`deposit_requesting_departments_deposit_id_foreign`)
- `deposit_users` → `deposits` (`deposit_users_deposit_id_foreign`)
- `purchases_existences` → `deposits` (`purchases_existences_deposit_id_foreign`)
- `purchases_movements` → `deposits` (`purchases_movements_deposit_destiny_id_foreign`)
- `purchases_movements` → `deposits` (`purchases_movements_deposits_id_foreign`)
- `purchases_product_inventories` → `deposits` (`purchases_product_inventories_deposit_destiny_id_foreign`)
- `purchases_product_inventories` → `deposits` (`purchases_product_inventories_deposit_id_foreign`)
- `purchases_product_minimums` → `deposits` (`purchases_product_minimums_deposit_id_foreign`)
- `restockings` → `deposits` (`restockings_deposit_id_foreign`)
- `users` → `deposits` (`users_deposit_id_foreign`)

**FK salientes:**

- `deposits_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `deposits_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `deposits_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `destination_loans`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `13`  

- **PK:** `id`

**Referenciada por (muestra):**
- `contracts` → `destination_loans` (`contracts_destination_loan_id_foreign`)

**FK salientes:**

- `destination_loans_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `detail_client_portfolios`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `3580273`  

- **PK:** `id`

**FK salientes:**

- `detail_client_portfolios_clientportfolio_id_foreign`: (`clientportfolio_id`) → `client_portfolios` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `detail_client_portfolios_collection_sections_id_foreign`: (`collection_sections_id`) → `collection_sections` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `detail_client_portfolios_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `detail_client_portfolios_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `detail_client_portfolios_last_tracking_id_foreign`: (`last_tracking_id`) → `recovery_trackings` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `clientportfolio_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `collection_sections_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `expired_quotas` | `int` | NO | `` | NULL | `` |  |
| `regular_customer` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `last_tracking_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `expired_amount` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `quota_amount` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `total_collection` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `expired_quotas_at_closing` | `int` | YES | `` | NULL | `` |  |
| `next_expiration_to_pay` | `date` | YES | `` | NULL | `` |  |

### `diagnostics`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `15`  

- **PK:** `id`

**Referenciada por (muestra):**
- `internments` → `diagnostics` (`internments_diagnostic_id_foreign`)
- `services_authorizations` → `diagnostics` (`services_authorizations_diagnostic_id_foreign`)

**FK salientes:**

- `diagnostics_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `discount_interests`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `21161`  

- **PK:** `id`

**FK salientes:**

- `discount_interests_client_portfolio_id_foreign`: (`client_portfolio_id`) → `client_portfolios` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `discount_interests_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `discount_interests_payment_id_foreign`: (`payment_id`) → `payments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `discount_interests_user_deleted_id_foreign`: (`user_deleted_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `discount_interests_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `interest_moratorium` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `client_portfolio_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `interest_punitive` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `payment_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_deleted_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `date_deleted` | `datetime` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `dismissal_statuses`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `dismissal_statuses_dismissal_id_foreign`: (`dismissal_id`) → `dismissals` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dismissal_statuses_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `dismissal_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `dismissals`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `10`  

- **PK:** `id`

**Referenciada por (muestra):**
- `dismissal_statuses` → `dismissals` (`dismissal_statuses_dismissal_id_foreign`)

**FK salientes:**

- `dismissals_business_department_id_foreign`: (`business_department_id`) → `business_departments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dismissals_employee_contract_id_foreign`: (`employee_contract_id`) → `employee_contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dismissals_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dismissals_job_positions_id_foreign`: (`job_positions_id`) → `job_positions` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dismissals_requesting_user_id_foreign`: (`requesting_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dismissals_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dismissals_user_deleted_foreign`: (`user_deleted`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dismissals_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `dismissals_work_area_id_foreign`: (`work_area_id`) → `work_areas` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `requesting_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `employee_contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `job_positions_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `work_area_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `business_department_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `social_reason_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `date_admission` | `date` | NO | `` | NULL | `` |  |
| `date_possible_dismissal` | `date` | NO | `` | NULL | `` |  |
| `reason_dismissal` | `varchar(191)` | NO | `` | NULL | `` |  |
| `reason_request` | `varchar(191)` | NO | `` | NULL | `` |  |
| `replacement_change` | `varchar(191)` | NO | `` | NULL | `` |  |
| `rrhh_comment` | `varchar(191)` | YES | `` | NULL | `` |  |
| `reason_deleted` | `longtext` | YES | `` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `date_deleted` | `date` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `doctor_changes`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2698`  

- **PK:** `id`

**FK salientes:**

- `doctor_changes_dental_office_id_foreign`: (`dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctor_changes_doctor_id_from_foreign`: (`doctor_id_from`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctor_changes_doctor_id_to_foreign`: (`doctor_id_to`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctor_changes_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `doctor_id_from` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `doctor_id_to` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `reason` | `longtext` | NO | `` | NULL | `` |  |
| `reason_delete` | `longtext` | YES | `` | NULL | `` |  |
| `date_from` | `datetime` | NO | `` | NULL | `` |  |
| `date_to` | `datetime` | NO | `` | NULL | `` |  |
| `init_break` | `time` | YES | `` | NULL | `` |  |
| `finish_break` | `time` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `dental_office_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `doctor_commission_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `291288`  

- **PK:** `id`

**FK salientes:**

- `doctor_commission_details_assistance_id_foreign`: (`assistance_id`) → `employee_contract_assistances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctor_commission_details_calendar_event_id_foreign`: (`calendar_event_id`) → `calendar_events` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctor_commission_details_client_service_id_foreign`: (`client_service_id`) → `client_services` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctor_commission_details_commission_id_foreign`: (`commission_id`) → `commissions` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctor_commission_details_dental_budget_detail_id_foreign`: (`dental_budget_detail_id`) → `dental_budget_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctor_commission_details_doctor_commission_id_foreign`: (`doctor_commission_id`) → `doctor_commissions` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctor_commission_details_voucher_detail_id_foreign`: (`voucher_detail_id`) → `voucher_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `doctor_commission_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `client_service_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `dental_budget_detail_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `voucher_detail_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `calendar_event_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `assistance_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `commission_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `percentage` | `decimal(5,2)` | NO | `` | NULL | `` |  |
| `commission` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `doctor_commissions`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `8943`  

- **PK:** `id`

**Referenciada por (muestra):**
- `doctor_commission_details` → `doctor_commissions` (`doctor_commission_details_doctor_commission_id_foreign`)

**FK salientes:**

- `doctor_commissions_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctor_commissions_commission_sheet_id_foreign`: (`commission_sheet_id`) → `commission_sheets` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctor_commissions_dental_office_id_foreign`: (`dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctor_commissions_doctor_id_foreign`: (`doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctor_commissions_user_deleted_id_foreign`: (`user_deleted_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctor_commissions_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `commission_type` | `int` | YES | `` | NULL | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `number` | `int` | NO | `` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `dental_office_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `total` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `total_commission` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `commission_sheet_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `smallint` | NO | `` | 1 | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `user_deleted_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `reason_deleted` | `longtext` | YES | `` | NULL | `` |  |
| `date_deleted` | `datetime` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `doctor_dental_offices`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `773`  

- **PK:** `id`

**FK salientes:**

- `doctor_dental_offices_dental_office_id_foreign`: (`dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctor_dental_offices_doctor_id_foreign`: (`doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `dental_office_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `doctor_especialities`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `829`  

- **PK:** `id`

**FK salientes:**

- `doctor_especialities_doctor_id_foreign`: (`doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctor_especialities_especiality_id_foreign`: (`especiality_id`) → `especialities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `especiality_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `doctor_files`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `doctor_files_doctor_id_foreign`: (`doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `file` | `varchar(191)` | NO | `` | NULL | `` |  |
| `original_name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `from_date` | `date` | YES | `` | NULL | `` |  |
| `until_date` | `date` | YES | `` | NULL | `` |  |
| `type` | `int` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `doctor_infusions`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**Referenciada por (muestra):**
- `client_doctor_infusion` → `doctor_infusions` (`client_doctor_infusion_doctor_infusion_id_foreign`)
- `infusions` → `doctor_infusions` (`infusions_doctor_infusion_id_foreign`)

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `document_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `email` | `varchar(191)` | NO | `UNI` | NULL | `` |  |
| `phone` | `varchar(191)` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |

### `doctor_schedule_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1271`  

- **PK:** `id`

**FK salientes:**

- `doctor_schedule_details_doctor_schedule_id_foreign`: (`doctor_schedule_id`) → `doctor_schedules` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctor_schedule_details_speciality_id_foreign`: (`speciality_id`) → `especialities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `doctor_schedule_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `speciality_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `from_time` | `time` | NO | `` | NULL | `` |  |
| `until_time` | `time` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `doctor_schedule_exceptions`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2142`  

- **PK:** `id`

**FK salientes:**

- `doctor_schedule_exceptions_deleted_user_id_foreign`: (`deleted_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctor_schedule_exceptions_dental_office_id_foreign`: (`dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctor_schedule_exceptions_doctor_id_foreign`: (`doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctor_schedule_exceptions_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `dental_office_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `date` | `date` | YES | `` | NULL | `` |  |
| `from_hour` | `time` | YES | `` | NULL | `` |  |
| `until_hour` | `time` | YES | `` | NULL | `` |  |
| `start_break` | `time` | YES | `` | NULL | `` |  |
| `end_break` | `time` | YES | `` | NULL | `` |  |
| `break_interval` | `int` | YES | `` | NULL | `` |  |
| `type` | `int` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `reason` | `varchar(191)` | YES | `` | NULL | `` |  |
| `reason_delete` | `varchar(191)` | YES | `` | NULL | `` |  |
| `deleted_at` | `datetime` | YES | `` | NULL | `` |  |
| `deleted_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `doctor_schedules`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1647`  

- **PK:** `id`

**Referenciada por (muestra):**
- `doctor_schedule_details` → `doctor_schedules` (`doctor_schedule_details_doctor_schedule_id_foreign`)

**FK salientes:**

- `doctor_schedules_dental_office_id_foreign`: (`dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctor_schedules_doctor_id_foreign`: (`doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctor_schedules_people_id_foreign`: (`people_id`) → `people` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `doctor_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `people_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `dental_office_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `days` | `int` | YES | `` | NULL | `` |  |
| `work_start` | `time` | NO | `` | NULL | `` |  |
| `work_end` | `time` | NO | `` | NULL | `` |  |
| `break_start` | `time` | YES | `` | NULL | `` |  |
| `break_end` | `time` | YES | `` | NULL | `` |  |
| `break_interval` | `int` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `doctor_service_adquireds`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `244`  

- **PK:** `id`

**FK salientes:**

- `doctor_service_adquireds_doctor_id_foreign`: (`doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `type_service` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `doctor_type_commissions`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `464`  

- **PK:** `id`

**FK salientes:**

- `doctor_type_commissions_doctor_id_foreign`: (`doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctor_type_commissions_services_doctor_id_foreign`: (`services_doctor_id`) → `services_doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `type` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `type_calculation` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `services_doctor_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `doctors`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `667`  

- **PK:** `id`

**Referenciada por (muestra):**
- `calendar_events` → `doctors` (`calendar_events_doctor_id_foreign`)
- `client_laboratories` → `doctors` (`client_laboratories_doctor_id_foreign`)
- `client_services` → `doctors` (`client_services_commission_doctor_id_foreign`)
- `client_services` → `doctors` (`client_services_doctor_id_foreign`)
- `client_treatment_orthodontics` → `doctors` (`client_treatment_orthodontics_doctor_id_foreign`)
- `clients` → `doctors` (`clients_last_doctor_id_foreign`)
- `dental_budgets` → `doctors` (`dental_budgets_doctor_id_foreign`)
- `doctor_changes` → `doctors` (`doctor_changes_doctor_id_from_foreign`)
- `doctor_changes` → `doctors` (`doctor_changes_doctor_id_to_foreign`)
- `doctor_commissions` → `doctors` (`doctor_commissions_doctor_id_foreign`)
- `doctor_dental_offices` → `doctors` (`doctor_dental_offices_doctor_id_foreign`)
- `doctor_especialities` → `doctors` (`doctor_especialities_doctor_id_foreign`)
- `doctor_files` → `doctors` (`doctor_files_doctor_id_foreign`)
- `doctor_schedule_exceptions` → `doctors` (`doctor_schedule_exceptions_doctor_id_foreign`)
- `doctor_schedules` → `doctors` (`doctor_schedules_doctor_id_foreign`)
- `doctor_service_adquireds` → `doctors` (`doctor_service_adquireds_doctor_id_foreign`)
- `doctor_type_commissions` → `doctors` (`doctor_type_commissions_doctor_id_foreign`)
- `emergency_services` → `doctors` (`emergency_services_doctor_id_foreign`)
- `emergency_teams` → `doctors` (`emergency_teams_doctor_id_foreign`)
- `esth_patient_treatments` → `doctors` (`esth_patient_treatments_doctor_id_foreign`)
- `insurance_doctor` → `doctors` (`insurance_doctor_doctor_id_foreign`)
- `internments` → `doctors` (`internments_doctor_id_foreign`)
- `payment_services_authorizations` → `doctors` (`payment_services_authorizations_doctor_id_foreign`)
- `polls_services` → `doctors` (`polls_services_doctor_id_foreign`)
- `professionals` → `doctors` (`professionals_provider_id_foreign`)
- `prosthesis_laboratories` → `doctors` (`prosthesis_laboratories_doctor_id_foreign`)
- `purchases_movements` → `doctors` (`purchases_movements_doctor_id_foreign`)
- `service_doctor_prices` → `doctors` (`service_doctor_prices_doctor_id_foreign`)
- `service_levels` → `doctors` (`service_levels_doctor_id_foreign`)
- `sms_tokens` → `doctors` (`sms_tokens_doctor_id_foreign`)
- `turn_callers` → `doctors` (`turn_callers_doctor_id_foreign`)

**FK salientes:**

- `doctors_city_id_foreign`: (`city_id`) → `cities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctors_corresponding_user_id_foreign`: (`corresponding_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctors_dental_office_id_foreign`: (`dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctors_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctors_first_representative_nationality_id_foreign`: (`first_representative_nationality_id`) → `nationalities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctors_nationality_id_foreign`: (`nationality_id`) → `nationalities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctors_second_representative_nationality_id_foreign`: (`second_representative_nationality_id`) → `nationalities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `doctors_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `type_lender` | `int` | YES | `` | NULL | `` |  |
| `medical_guide` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `document_number` | `int` | YES | `` | NULL | `` |  |
| `date_event` | `date` | YES | `` | NULL | `` |  |
| `ruc` | `varchar(191)` | YES | `` | NULL | `` |  |
| `first_name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `last_name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `lender_profile` | `varchar(191)` | YES | `` | NULL | `` |  |
| `social_reason` | `varchar(191)` | YES | `` | NULL | `` |  |
| `bank_account_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `address` | `varchar(191)` | NO | `` | NULL | `` |  |
| `e_mail` | `varchar(191)` | YES | `` | NULL | `` |  |
| `phone` | `varchar(191)` | YES | `` | NULL | `` |  |
| `cellphone` | `varchar(191)` | YES | `` | NULL | `` |  |
| `register_number` | `int` | YES | `` | NULL | `` |  |
| `register_expired` | `date` | YES | `` | NULL | `` |  |
| `city_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `nationality_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `dental_office_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `first_representative` | `varchar(191)` | YES | `` | NULL | `` |  |
| `first_representative_nationality_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `second_representative` | `varchar(191)` | YES | `` | NULL | `` |  |
| `second_representative_nationality_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `second_representative_ci` | `int` | YES | `` | NULL | `` |  |
| `first_representative_ci` | `int` | YES | `` | NULL | `` |  |
| `commission` | `decimal(5,2)` | YES | `` | NULL | `` |  |
| `orthodontic_commission` | `int` | YES | `` | NULL | `` |  |
| `experience` | `longtext` | YES | `` | NULL | `` |  |
| `comentary` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `box_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `corresponding_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `email_campaign_emails`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `16845`  

- **PK:** `id`

**FK salientes:**

- `email_campaign_emails_email_campaign_id_foreign`: (`email_campaign_id`) → `email_campaigns` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `email_campaign_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `email` | `varchar(191)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `email_campaigns`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `32`  

- **PK:** `id`

**Referenciada por (muestra):**
- `email_campaign_emails` → `email_campaigns` (`email_campaign_emails_email_campaign_id_foreign`)

**FK salientes:**

- `email_campaigns_client_city_id_foreign`: (`client_city_id`) → `cities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `email_campaigns_collection_section_id_foreign`: (`collection_section_id`) → `collection_sections` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `email_campaigns_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `email_campaigns_insurance_id_foreign`: (`insurance_id`) → `insurances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `email_campaigns_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `type` | `int unsigned` | NO | `` | NULL | `` |  |
| `excel_path` | `varchar(500)` | YES | `` | NULL | `` |  |
| `all_clients` | `tinyint(1)` | YES | `` | 0 | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `collection_section_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `contract_status` | `int unsigned` | YES | `` | NULL | `` |  |
| `insurance_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `client_type` | `int unsigned` | YES | `` | NULL | `` |  |
| `client_city_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `subject` | `longtext` | NO | `` | NULL | `` |  |
| `message` | `text` | YES | `` | NULL | `` |  |
| `image` | `longtext` | NO | `` | NULL | `` |  |
| `link` | `longtext` | YES | `` | NULL | `` |  |
| `send_after` | `longtext` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |
| `replyto` | `varchar(191)` | YES | `` | NULL | `` |  |
| `from_name` | `varchar(191)` | YES | `` | NULL | `` |  |

### `emails`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `35492`  

- **PK:** `id`

**Referenciada por (muestra):**
- `report_sending_emails` → `emails` (`report_sending_emails_email_id_foreign`)

**FK salientes:**

- `emails_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `email` | `varchar(191)` | NO | `` | NULL | `` |  |
| `description` | `longtext` | YES | `` | NULL | `` |  |
| `main_email` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `send_invoice` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `send_receipt` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `emergency_dispatchers`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `8674`  

- **PK:** `id`

**FK salientes:**

- `emergency_dispatchers_dispatcher_id_foreign`: (`dispatcher_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_dispatchers_emergency_mobile_id_foreign`: (`emergency_mobile_id`) → `emergency_mobiles` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_dispatchers_request_eme_serv_id_foreign`: (`request_eme_serv_id`) → `request_eme_serv_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `dispatcher_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `request_eme_serv_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `type` | `int` | NO | `` | NULL | `` |  |
| `bag_number` | `int` | YES | `` | NULL | `` |  |
| `fitted_bag` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `emergency_mobile_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `make_assistance` | `tinyint` | NO | `` | 0 | `` | 0: No, 1: Si |

### `emergency_drivers`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `101`  

- **PK:** `id`

**Referenciada por (muestra):**
- `emergency_services` → `emergency_drivers` (`emergency_services_emergency_driver_id_foreign`)
- `emergency_teams` → `emergency_drivers` (`emergency_teams_emergency_driver_id_foreign`)

**FK salientes:**

- `emergency_drivers_corresponding_user_id_foreign`: (`corresponding_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_drivers_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `corresponding_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `emergency_guard_exceptions`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2015`  

- **PK:** `id`

**FK salientes:**

- `emergency_guard_exceptions_deleted_user_id_foreign`: (`deleted_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_guard_exceptions_employee_activity_id_foreign`: (`employee_activity_id`) → `employee_activities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_guard_exceptions_employee_assistance_id_foreign`: (`employee_assistance_id`) → `employee_contract_assistances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_guard_exceptions_employee_contract_id_from_foreign`: (`employee_contract_id_from`) → `employee_contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_guard_exceptions_employee_contract_id_to_foreign`: (`employee_contract_id_to`) → `employee_contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_guard_exceptions_place_service_id_foreign`: (`place_service_id`) → `place_services` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_guard_exceptions_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `employee_contract_id_from` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `employee_contract_id_to` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `employee_activity_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `place_service_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `employee_assistance_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `from_hour` | `time` | YES | `` | NULL | `` |  |
| `until_hour` | `time` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `reason` | `varchar(191)` | YES | `` | NULL | `` |  |
| `type` | `int` | YES | `` | NULL | `` |  |
| `reason_delete` | `varchar(191)` | YES | `` | NULL | `` |  |
| `deleted_at` | `datetime` | YES | `` | NULL | `` |  |
| `deleted_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `emergency_guards`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1084`  

- **PK:** `id`

**FK salientes:**

- `emergency_guards_emergency_team_id_foreign`: (`emergency_team_id`) → `emergency_teams` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_guards_employee_activity_id_foreign`: (`employee_activity_id`) → `employee_activities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_guards_employee_contract_id_foreign`: (`employee_contract_id`) → `employee_contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_guards_place_service_id_foreign`: (`place_service_id`) → `place_services` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_guards_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `emergency_team_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `employee_activity_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `employee_contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `place_service_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `days` | `int` | YES | `` | NULL | `` |  |
| `work_start` | `time` | NO | `` | NULL | `` |  |
| `work_end` | `time` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `emergency_mobiles`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `55`  

- **PK:** `id`

**Referenciada por (muestra):**
- `emergency_dispatchers` → `emergency_mobiles` (`emergency_dispatchers_emergency_mobile_id_foreign`)
- `emergency_services` → `emergency_mobiles` (`emergency_services_emergency_mobile_id_foreign`)
- `emergency_teams` → `emergency_mobiles` (`emergency_teams_emergency_mobile_id_foreign`)
- `purchases_details` → `emergency_mobiles` (`purchases_details_emergency_mobile_id_foreign`)
- `purchases_order_details` → `emergency_mobiles` (`purchases_order_details_emergency_mobile_id_foreign`)

**FK salientes:**

- `emergency_mobiles_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `brand` | `varchar(191)` | YES | `` | NULL | `` |  |
| `description` | `varchar(191)` | YES | `` | NULL | `` |  |
| `lock` | `varchar(191)` | YES | `` | NULL | `` |  |
| `base` | `varchar(191)` | YES | `` | NULL | `` |  |
| `greendocument` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `title` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `municipalauthorization` | `date` | YES | `` | NULL | `` |  |
| `mspbsauthorization` | `date` | YES | `` | NULL | `` |  |
| `currentkilometer` | `int` | YES | `` | NULL | `` |  |
| `lastmaintenace` | `int` | YES | `` | NULL | `` |  |
| `nextmaintenace` | `int` | YES | `` | NULL | `` |  |
| `insurance` | `date` | YES | `` | NULL | `` |  |
| `operability` | `tinyint(1)` | YES | `` | 1 | `` |  |
| `reason` | `varchar(191)` | YES | `` | NULL | `` |  |
| `categories` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `emergency_paramedics`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `149`  

- **PK:** `id`

**Referenciada por (muestra):**
- `emergency_services` → `emergency_paramedics` (`emergency_services_emergency_paramedic_id_foreign`)
- `emergency_teams` → `emergency_paramedics` (`emergency_teams_emergency_paramedic_id_foreign`)

**FK salientes:**

- `emergency_paramedics_corresponding_user_id_foreign`: (`corresponding_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_paramedics_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `corresponding_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `emergency_service_patients`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `63008`  

- **PK:** `id`

**FK salientes:**

- `emergency_service_patients_emergency_service_id_foreign`: (`emergency_service_id`) → `emergency_services` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `emergency_service_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `document_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `age` | `varchar(191)` | YES | `` | NULL | `` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `emergency_services`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `55301`  

- **PK:** `id`

**Referenciada por (muestra):**
- `emergency_service_patients` → `emergency_services` (`emergency_service_patients_emergency_service_id_foreign`)

**FK salientes:**

- `emergency_services_city_id_1_foreign`: (`city_id_1`) → `cities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_services_city_id_2_foreign`: (`city_id_2`) → `cities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_services_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_services_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_services_dispatcher_id_foreign`: (`dispatcher_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_services_doctor_id_foreign`: (`doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_services_emergency_driver_id_foreign`: (`emergency_driver_id`) → `emergency_drivers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_services_emergency_mobile_id_foreign`: (`emergency_mobile_id`) → `emergency_mobiles` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_services_emergency_paramedic_id_foreign`: (`emergency_paramedic_id`) → `emergency_paramedics` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_services_emergency_team_id_foreign`: (`emergency_team_id`) → `emergency_teams` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_services_emergency_type_service_id_foreign`: (`emergency_type_service_id`) → `emergency_type_services` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_services_final_type_service_id_foreign`: (`final_type_service_id`) → `emergency_type_services` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_services_neighborhood_id_foreign`: (`neighborhood_id`) → `neighborhoods` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_services_request_eme_serv_det_id_foreign`: (`request_eme_serv_det_id`) → `request_eme_serv_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_services_user_deleted_foreign`: (`user_deleted`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_services_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `coverage` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `dispatcher_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `client_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `emergency_team_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `emergency_driver_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `emergency_mobile_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `emergency_paramedic_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `emergency_type_service_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `final_type_service_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `doctor_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `request_eme_serv_det_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `applicant_name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `applicant_phone_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `reception_time` | `datetime` | YES | `` | NULL | `` |  |
| `dispatcher_time` | `datetime` | YES | `` | NULL | `` |  |
| `exit_time` | `datetime` | YES | `` | NULL | `` |  |
| `arrival_time_1` | `datetime` | YES | `` | NULL | `` |  |
| `exit_time_1` | `datetime` | YES | `` | NULL | `` |  |
| `place_time_1` | `varchar(191)` | YES | `` | NULL | `` |  |
| `arrival_time_2` | `datetime` | YES | `` | NULL | `` |  |
| `exit_time_2` | `datetime` | YES | `` | NULL | `` |  |
| `place_time_2` | `varchar(191)` | YES | `` | NULL | `` |  |
| `arrival_time_3` | `datetime` | YES | `` | NULL | `` |  |
| `exit_time_3` | `datetime` | YES | `` | NULL | `` |  |
| `place_time_3` | `varchar(191)` | YES | `` | NULL | `` |  |
| `free_time` | `datetime` | YES | `` | NULL | `` |  |
| `wait_time` | `datetime` | YES | `` | NULL | `` |  |
| `place_time` | `varchar(191)` | YES | `` | NULL | `` |  |
| `address_1` | `varchar(191)` | YES | `` | NULL | `` |  |
| `city_id_1` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `house_number_1` | `varchar(191)` | YES | `` | NULL | `` |  |
| `neighborhood_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `address_2` | `varchar(191)` | YES | `` | NULL | `` |  |
| `city_id_2` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `house_number_2` | `varchar(191)` | YES | `` | NULL | `` |  |
| `reference` | `varchar(191)` | YES | `` | NULL | `` |  |
| `zone` | `varchar(191)` | YES | `` | NULL | `` |  |
| `insurance_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `insurance_autorization` | `varchar(191)` | YES | `` | NULL | `` |  |
| `symptom` | `varchar(191)` | YES | `` | NULL | `` |  |
| `diagnosis` | `varchar(191)` | YES | `` | NULL | `` |  |
| `final_destination` | `varchar(191)` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `int` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `date_deleted` | `datetime` | YES | `` | NULL | `` |  |
| `services_price` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `emergency_teams`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `26`  

- **PK:** `id`

**Referenciada por (muestra):**
- `emergency_guards` → `emergency_teams` (`emergency_guards_emergency_team_id_foreign`)
- `emergency_services` → `emergency_teams` (`emergency_services_emergency_team_id_foreign`)

**FK salientes:**

- `emergency_teams_doctor_id_foreign`: (`doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_teams_emergency_driver_id_foreign`: (`emergency_driver_id`) → `emergency_drivers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_teams_emergency_mobile_id_foreign`: (`emergency_mobile_id`) → `emergency_mobiles` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_teams_emergency_paramedic_id_foreign`: (`emergency_paramedic_id`) → `emergency_paramedics` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_teams_place_service_id_foreign`: (`place_service_id`) → `place_services` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `zone` | `varchar(191)` | NO | `` | NULL | `` |  |
| `place_service_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `location` | `varchar(191)` | YES | `` | NULL | `` |  |
| `datetime_location` | `datetime` | YES | `` | NULL | `` |  |
| `doctor_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `emergency_paramedic_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `emergency_driver_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `emergency_mobile_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `emergency_type_services`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `32`  

- **PK:** `id`

**Referenciada por (muestra):**
- `emergency_services` → `emergency_type_services` (`emergency_services_emergency_type_service_id_foreign`)
- `emergency_services` → `emergency_type_services` (`emergency_services_final_type_service_id_foreign`)
- `request_eme_serv_details` → `emergency_type_services` (`request_eme_serv_details_emergency_type_service_id_foreign`)

**FK salientes:**

- `emergency_type_services_service_invoice_id_foreign`: (`service_invoice_id`) → `service_invoices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `emergency_type_services_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `amount_particular` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `amount_insured` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `service_invoice_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `employee_academic_preparations`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1818`  

- **PK:** `id`

**FK salientes:**

- `employee_academic_preparations_person_id_foreign`: (`person_id`) → `people` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `person_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `education_level` | `int` | NO | `` | NULL | `` |  |
| `school_name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `course_academic` | `varchar(191)` | YES | `` | NULL | `` |  |
| `academic_degree` | `varchar(191)` | YES | `` | NULL | `` |  |
| `year` | `varchar(191)` | YES | `` | NULL | `` |  |
| `education_status` | `int` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `employee_activities`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `24`  

- **PK:** `id`

**Referenciada por (muestra):**
- `emergency_guard_exceptions` → `employee_activities` (`emergency_guard_exceptions_employee_activity_id_foreign`)
- `emergency_guards` → `employee_activities` (`emergency_guards_employee_activity_id_foreign`)
- `employee_contract_activities` → `employee_activities` (`employee_contract_activities_employee_activity_id_foreign`)
- `employee_contract_assistances` → `employee_activities` (`employee_contract_assistances_employee_activity_id_foreign`)

**FK salientes:**

- `employee_activities_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `employee_childrens`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `313`  

- **PK:** `id`

**FK salientes:**

- `employee_childrens_employee_contract_id_foreign`: (`employee_contract_id`) → `employee_contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `employee_contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `document_number` | `int` | YES | `` | NULL | `` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `birth_date` | `date` | NO | `` | NULL | `` |  |
| `gender` | `tinyint` | NO | `` | NULL | `` |  |
| `bonus` | `tinyint` | NO | `` | NULL | `` |  |
| `kindergarten_bonus` | `tinyint(1)` | NO | `` | 2 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `employee_collector_commissions`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `33`  

- **PK:** `id`

**FK salientes:**

- `employee_collector_commissions_employee_contract_id_foreign`: (`employee_contract_id`) → `employee_contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `employee_contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `type_commission` | `smallint` | NO | `` | NULL | `` |  |
| `commission_amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `percentage_number` | `smallint` | YES | `` | NULL | `` |  |
| `conditional_type` | `varchar(2)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `employee_complaints`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `employee_complaints_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_complaints_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_complaints_work_area_id_foreign`: (`work_area_id`) → `work_areas` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `work_area_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `type` | `smallint` | NO | `` | NULL | `` |  |
| `confidential` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `message` | `longtext` | NO | `` | NULL | `` |  |
| `contact_data` | `longtext` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |

### `employee_concepts`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `80`  

- **PK:** `id`

**Referenciada por (muestra):**
- `employee_discounts` → `employee_concepts` (`employee_discounts_employee_concept_id_foreign`)
- `employee_gratifications` → `employee_concepts` (`employee_gratifications_employee_concept_id_foreign`)
- `employee_payment_details` → `employee_concepts` (`employee_payment_details_employee_concept_id_foreign`)
- `payroll_salary_details` → `employee_concepts` (`payroll_salary_details_employee_concept_id_foreign`)

**FK salientes:**

- `employee_concepts_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `type` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `type_gratification` | `smallint` | YES | `` | 1 | `` |  |
| `variable` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `employee_contract_activities`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1625`  

- **PK:** `id`

**FK salientes:**

- `employee_contract_activities_employee_activity_id_foreign`: (`employee_activity_id`) → `employee_activities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_contract_activities_employee_contract_id_foreign`: (`employee_contract_id`) → `employee_contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_contract_activities_place_service_id_foreign`: (`place_service_id`) → `place_services` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `employee_contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `employee_activity_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `place_service_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `night_time_price` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `employee_contract_annexed_items`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `733`  

- **PK:** `id`

**FK salientes:**

- `employee_contract_annexed_items_annexed_sheet_id_foreign`: (`annexed_sheet_id`) → `employee_contract_annexed_sheets` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_contract_annexed_items_annexed_sheet_item_id_foreign`: (`annexed_sheet_item_id`) → `annexed_sheet_items` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `annexed_sheet_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `annexed_sheet_item_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `employee_contract_annexed_sheets`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `289`  

- **PK:** `id`

**Referenciada por (muestra):**
- `employee_contract_annexed_items` → `employee_contract_annexed_sheets` (`employee_contract_annexed_items_annexed_sheet_id_foreign`)

**FK salientes:**

- `employee_contract_annexed_sheets_employee_contract_id_foreign`: (`employee_contract_id`) → `employee_contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `employee_contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `date` | `date` | YES | `` | NULL | `` |  |
| `observation` | `varchar(191)` | NO | `` | NULL | `` |  |
| `order` | `int` | NO | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `employee_contract_assistances`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `240831`  

- **PK:** `id`

**Referenciada por (muestra):**
- `assistances` → `employee_contract_assistances` (`assistances_employee_contract_assistance_id_foreign`)
- `doctor_commission_details` → `employee_contract_assistances` (`doctor_commission_details_assistance_id_foreign`)
- `emergency_guard_exceptions` → `employee_contract_assistances` (`emergency_guard_exceptions_employee_assistance_id_foreign`)
- `employee_payment_assistances` → `employee_contract_assistances` (`employee_payment_assistances_employee_assistance_id_foreign`)
- `payroll_salary_assistances` → `employee_contract_assistances` (`payroll_salary_assistances_employee_assistance_id_foreign`)
- `users` → `employee_contract_assistances` (`users_employee_contract_assistance_id_foreign`)

**FK salientes:**

- `employee_contract_assistances_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_contract_assistances_employee_activity_id_foreign`: (`employee_activity_id`) → `employee_activities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_contract_assistances_employee_contract_id_foreign`: (`employee_contract_id`) → `employee_contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_contract_assistances_extra_hour_id_foreign`: (`extra_hour_id`) → `extra_hours` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_contract_assistances_place_service_id_foreign`: (`place_service_id`) → `place_services` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_contract_assistances_user_deleted_foreign`: (`user_deleted`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_contract_assistances_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `employee_contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `employee_activity_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `employee_assistance_type` | `int` | NO | `` | 1 | `` |  |
| `extra_hour_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `ip` | `varchar(191)` | YES | `` | NULL | `` |  |
| `type` | `int` | NO | `` | 1 | `` |  |
| `fromable_id` | `int` | YES | `` | NULL | `` |  |
| `fromable_type` | `varchar(191)` | YES | `` | NULL | `` |  |
| `place_service_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `price_per_hour` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `daytime_pay` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `price_per_night_hour` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `night_pay` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `total_amount` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `iva_amount` | `decimal(8,2)` | YES | `` | NULL | `` |  |
| `start` | `datetime` | NO | `` | NULL | `` |  |
| `real_time_init` | `datetime` | YES | `` | NULL | `` |  |
| `end` | `datetime` | NO | `` | NULL | `` |  |
| `real_time_finish` | `datetime` | YES | `` | NULL | `` |  |
| `time_break` | `int` | YES | `` | NULL | `` |  |
| `amount_marking` | `int` | NO | `` | NULL | `` |  |
| `branch_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `hours` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `night_hours` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `date_deleted` | `datetime` | YES | `` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `employee_contracts`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `3351`  

- **PK:** `id`

**Referenciada por (muestra):**
- `dismissals` → `employee_contracts` (`dismissals_employee_contract_id_foreign`)
- `emergency_guard_exceptions` → `employee_contracts` (`emergency_guard_exceptions_employee_contract_id_from_foreign`)
- `emergency_guard_exceptions` → `employee_contracts` (`emergency_guard_exceptions_employee_contract_id_to_foreign`)
- `emergency_guards` → `employee_contracts` (`emergency_guards_employee_contract_id_foreign`)
- `employee_childrens` → `employee_contracts` (`employee_childrens_employee_contract_id_foreign`)
- `employee_collector_commissions` → `employee_contracts` (`employee_collector_commissions_employee_contract_id_foreign`)
- `employee_contract_activities` → `employee_contracts` (`employee_contract_activities_employee_contract_id_foreign`)
- `employee_contract_annexed_sheets` → `employee_contracts` (`employee_contract_annexed_sheets_employee_contract_id_foreign`)
- `employee_contract_assistances` → `employee_contracts` (`employee_contract_assistances_employee_contract_id_foreign`)
- `employee_discount_massive_details` → `employee_contracts` (`employee_discount_massive_details_employee_contract_id_foreign`)
- `employee_discounts` → `employee_contracts` (`employee_discounts_employee_contract_id_foreign`)
- `employee_gratifications` → `employee_contracts` (`employee_gratifications_employee_contract_id_foreign`)
- `employee_manager_commissions` → `employee_contracts` (`employee_manager_commissions_employee_contract_id_foreign`)
- `employee_payments` → `employee_contracts` (`employee_payments_employee_contract_id_foreign`)
- `employee_seller_type_commissions` → `employee_contracts` (`employee_seller_type_commissions_employee_contract_id_foreign`)
- `employee_vacations` → `employee_contracts` (`employee_vacations_employee_contract_id_foreign`)
- `payroll_salary_employees` → `employee_contracts` (`payroll_salary_employees_employee_contract_id_foreign`)
- `vacations` → `employee_contracts` (`vacations_employee_contract_id_foreign`)

**FK salientes:**

- `employee_contracts_bank_id_foreign`: (`bank_id`) → `banks` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_contracts_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_contracts_business_department_id_foreign`: (`business_department_id`) → `business_departments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_contracts_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_contracts_job_position_id_foreign`: (`job_position_id`) → `job_positions` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_contracts_people_boss_id_foreign`: (`people_boss_id`) → `people` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_contracts_people_id_foreign`: (`people_id`) → `people` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_contracts_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_contracts_user_deleted_foreign`: (`user_deleted`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_contracts_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `expiration_date` | `date` | YES | `` | NULL | `` |  |
| `date_ips` | `date` | YES | `` | NULL | `` |  |
| `social_reason_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `number` | `int` | NO | `` | NULL | `` |  |
| `people_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `people_boss_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `job_position_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `business_department_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `type_salary` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `salary` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `iva_included` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `salary_minimum` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `ips` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `ips_salary` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `insured_code` | `varchar(191)` | YES | `` | NULL | `` |  |
| `type_payment` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `contract_type` | `int` | YES | `` | NULL | `` |  |
| `bank_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `account_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `card_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `spouse_name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `spouse_document_number` | `int` | YES | `` | NULL | `` |  |
| `spouse_birth_date` | `date` | YES | `` | NULL | `` |  |
| `spouse_gender` | `tinyint` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `date_deleted` | `datetime` | YES | `` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `culminated_motive` | `smallint` | YES | `` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `contract_document_type` | `int` | YES | `` | NULL | `` |  |
| `trial_period` | `int` | YES | `` | NULL | `` |  |
| `trial_period_fixed` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `expiration_processed` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `contributor_type` | `int` | YES | `` | NULL | `` |  |
| `payment_period` | `int` | YES | `` | NULL | `` |  |
| `hiring_type` | `int` | YES | `` | NULL | `` |  |
| `type_confidential` | `varchar(191)` | YES | `` | NULL | `` |  |
| `infringement_amount` | `varchar(191)` | YES | `` | NULL | `` |  |
| `mpp_seller_category` | `smallint` | YES | `` | NULL | `` |  |

### `employee_discount_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `35406`  

- **PK:** `id`

**Referenciada por (muestra):**
- `employee_payment_details` → `employee_discount_details` (`employee_payment_details_employee_discount_details_id_foreign`)
- `payroll_salary_details` → `employee_discount_details` (`payroll_salary_details_discount_details_id_foreign`)

**FK salientes:**

- `employee_discount_details_employee_discount_id_foreign`: (`employee_discount_id`) → `employee_discounts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_discount_details_exoneration_user_id_foreign`: (`exoneration_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `employee_discount_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `number` | `int` | NO | `` | NULL | `` |  |
| `expiration` | `date` | YES | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `residue` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `reason_exoneration` | `varchar(191)` | YES | `` | NULL | `` |  |
| `exoneration_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `employee_discount_massive_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `105`  

- **PK:** `id`

**FK salientes:**

- `employee_discount_massive_details_employee_contract_id_foreign`: (`employee_contract_id`) → `employee_contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_discount_massive_details_massive_id_foreign`: (`massive_id`) → `employee_discount_massives` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `massive_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `employee_contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `employee_discount_massives`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `10`  

- **PK:** `id`

**Referenciada por (muestra):**
- `employee_discount_massive_details` → `employee_discount_massives` (`employee_discount_massive_details_massive_id_foreign`)

**FK salientes:**

- `employee_discount_massives_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_discount_massives_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `number` | `int` | NO | `` | NULL | `` |  |
| `social_reason_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `employee_discounts`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `15523`  

- **PK:** `id`

**Referenciada por (muestra):**
- `employee_discount_details` → `employee_discounts` (`employee_discount_details_employee_discount_id_foreign`)

**FK salientes:**

- `employee_discounts_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_discounts_employee_concept_id_foreign`: (`employee_concept_id`) → `employee_concepts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_discounts_employee_contract_id_foreign`: (`employee_contract_id`) → `employee_contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_discounts_user_deleted_foreign`: (`user_deleted`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_discounts_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `employee_contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `employee_concept_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `amount_total` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `residue` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `days` | `int` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `date_deleted` | `datetime` | YES | `` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `employee_file_updates`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1828`  

- **PK:** `id`

**FK salientes:**

- `employee_file_updates_people_id_foreign`: (`people_id`) → `people` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `people_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `employee_files`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1109`  

- **PK:** `id`

**FK salientes:**

- `employee_files_person_id_foreign`: (`person_id`) → `people` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_files_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `file` | `varchar(191)` | NO | `` | NULL | `` |  |
| `type` | `int` | NO | `` | 0 | `` |  |
| `person_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |

### `employee_gratification_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `43677`  

- **PK:** `id`

**Referenciada por (muestra):**
- `employee_payment_details` → `employee_gratification_details` (`employee_payment_details_gratification_details_id_foreign`)
- `payroll_salary_details` → `employee_gratification_details` (`payroll_salary_details_gratification_details_id_foreign`)

**FK salientes:**

- `employee_gratification_details_employee_gratification_id_foreign`: (`employee_gratification_id`) → `employee_gratifications` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_gratification_details_exoneration_user_id_foreign`: (`exoneration_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `employee_gratification_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `number` | `int` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `residue` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `reason_exoneration` | `longtext` | YES | `` | NULL | `` |  |
| `exoneration_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `employee_gratifications`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `40011`  

- **PK:** `id`

**Referenciada por (muestra):**
- `employee_gratification_details` → `employee_gratifications` (`employee_gratification_details_employee_gratification_id_foreign`)

**FK salientes:**

- `employee_gratifications_employee_concept_id_foreign`: (`employee_concept_id`) → `employee_concepts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_gratifications_employee_contract_id_foreign`: (`employee_contract_id`) → `employee_contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_gratifications_user_deleted_foreign`: (`user_deleted`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_gratifications_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `employee_contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `employee_concept_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `fromable_id` | `int unsigned` | YES | `` | NULL | `` |  |
| `fromable_type` | `varchar(191)` | YES | `` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `days_hours_worked` | `int` | YES | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `amount_total` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `residue` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `type` | `int` | NO | `` | 1 | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `date_deleted` | `datetime` | YES | `` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `int` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `employee_manager_commissions`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `employee_manager_commissions_employee_contract_id_foreign`: (`employee_contract_id`) → `employee_contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_manager_commissions_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `employee_contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `commission_percentage` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `tramo` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `employee_payment_assistances`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `121055`  

- **PK:** `id`

**FK salientes:**

- `employee_payment_assistances_employee_assistance_id_foreign`: (`employee_assistance_id`) → `employee_contract_assistances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_payment_assistances_employee_payment_id_foreign`: (`employee_payment_id`) → `employee_payments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `employee_payment_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `employee_assistance_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `employee_payment_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `110791`  

- **PK:** `id`

**FK salientes:**

- `employee_payment_details_employee_concept_id_foreign`: (`employee_concept_id`) → `employee_concepts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_payment_details_employee_discount_details_id_foreign`: (`employee_discount_details_id`) → `employee_discount_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_payment_details_employee_payment_id_foreign`: (`employee_payment_id`) → `employee_payments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_payment_details_gratification_details_id_foreign`: (`gratification_details_id`) → `employee_gratification_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `employee_payment_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `employee_concept_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `type` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `employee_discount_details_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `gratification_details_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `employee_payments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `41280`  

- **PK:** `id`

**Referenciada por (muestra):**
- `employee_payment_assistances` → `employee_payments` (`employee_payment_assistances_employee_payment_id_foreign`)
- `employee_payment_details` → `employee_payments` (`employee_payment_details_employee_payment_id_foreign`)
- `payroll_salary_employees` → `employee_payments` (`payroll_salary_employees_employee_payment_id_foreign`)

**FK salientes:**

- `employee_payments_bank_account_id_foreign`: (`bank_account_id`) → `bank_accounts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_payments_employee_contract_id_foreign`: (`employee_contract_id`) → `employee_contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_payments_patronal_number_id_foreign`: (`patronal_number_id`) → `patronal_numbers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_payments_user_deleted_foreign`: (`user_deleted`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_payments_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `start_period` | `date` | NO | `` | NULL | `` |  |
| `closing_period` | `date` | NO | `` | NULL | `` |  |
| `worked_days` | `int` | YES | `` | NULL | `` |  |
| `salary_day_amount` | `decimal(12,2)` | YES | `` | NULL | `` |  |
| `employee_contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `discount` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `amount_receivable` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `hourly_amount` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `hours` | `int` | YES | `` | NULL | `` |  |
| `night_hours` | `int` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `type_payment` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `receipt_type` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `bank_account_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `check_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `patronal_number_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `date_deleted` | `datetime` | YES | `` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `employee_search_statuses`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `68`  

- **PK:** `id`

**FK salientes:**

- `employee_search_statuses_employee_search_id_foreign`: (`employee_search_id`) → `employee_searches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_search_statuses_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `employee_search_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `employee_searches`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `294`  

- **PK:** `id`

**Referenciada por (muestra):**
- `employee_search_statuses` → `employee_searches` (`employee_search_statuses_employee_search_id_foreign`)

**FK salientes:**

- `employee_searches_business_department_id_foreign`: (`business_department_id`) → `business_departments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_searches_depend_of_id_foreign`: (`depend_of_id`) → `job_positions` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_searches_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_searches_job_positions_id_foreign`: (`job_positions_id`) → `job_positions` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_searches_replace_person_id_foreign`: (`replace_person_id`) → `people` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_searches_requesting_user_id_foreign`: (`requesting_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_searches_user_deleted_foreign`: (`user_deleted`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_searches_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `requesting_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `job_positions_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `confidential` | `int` | NO | `` | NULL | `` |  |
| `depend_of_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount_people` | `int` | NO | `` | NULL | `` |  |
| `sepervise` | `longtext` | YES | `` | NULL | `` |  |
| `reason_for_order` | `int` | NO | `` | NULL | `` |  |
| `salary_base` | `int` | NO | `` | NULL | `` |  |
| `variable_salary` | `varchar(191)` | YES | `` | NULL | `` |  |
| `observation` | `varchar(191)` | YES | `` | NULL | `` |  |
| `hours` | `varchar(191)` | NO | `` | NULL | `` |  |
| `monday_friday` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `saturday` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `sunday` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `contractual_relationship` | `int` | NO | `` | NULL | `` |  |
| `business_name` | `int` | NO | `` | NULL | `` |  |
| `fuel` | `int` | NO | `` | NULL | `` |  |
| `amount` | `int` | NO | `` | NULL | `` |  |
| `own_mobility` | `int` | NO | `` | NULL | `` |  |
| `type_mobility` | `varchar(191)` | YES | `` | NULL | `` |  |
| `travel_interior` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `travel_branch` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `not_travel` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `driving_license` | `int` | NO | `` | NULL | `` |  |
| `benefits` | `longtext` | YES | `` | NULL | `` |  |
| `trial_period` | `int` | NO | `` | NULL | `` |  |
| `age` | `varchar(191)` | YES | `` | NULL | `` |  |
| `gender` | `int` | NO | `` | NULL | `` |  |
| `nationality` | `int` | NO | `` | NULL | `` |  |
| `academic_training` | `int` | NO | `` | NULL | `` |  |
| `level` | `varchar(191)` | YES | `` | NULL | `` |  |
| `university_career` | `varchar(191)` | YES | `` | NULL | `` |  |
| `other_knowledge` | `longtext` | YES | `` | NULL | `` |  |
| `experience` | `longtext` | YES | `` | NULL | `` |  |
| `work_description` | `longtext` | NO | `` | NULL | `` |  |
| `skills_attitudes` | `longtext` | YES | `` | NULL | `` |  |
| `notebook` | `int` | NO | `` | NULL | `` |  |
| `corporate_line` | `int` | NO | `` | NULL | `` |  |
| `corporate_mail` | `int` | NO | `` | NULL | `` |  |
| `system` | `int` | NO | `` | NULL | `` |  |
| `desk` | `int` | NO | `` | NULL | `` |  |
| `chair` | `int` | NO | `` | NULL | `` |  |
| `business_department_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `uniform` | `varchar(191)` | YES | `` | NULL | `` |  |
| `approximate_date` | `date` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `reason_deleted` | `longtext` | YES | `` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `requested_date` | `date` | YES | `` | NULL | `` |  |
| `date_deleted` | `date` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `replace_person_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |

### `employee_seller_type_commissions`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `583`  

- **PK:** `id`

**FK salientes:**

- `employee_seller_type_commissions_employee_contract_id_foreign`: (`employee_contract_id`) → `employee_contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_seller_type_commissions_people_id_foreign`: (`people_id`) → `people` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_seller_type_commissions_scale_viatic_id_foreign`: (`scale_viatic_id`) → `scale_viatics` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `employee_contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `people_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `type_commission` | `smallint` | NO | `` | NULL | `` |  |
| `scale_viatic_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `employee_vacations`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `774`  

- **PK:** `id`

**FK salientes:**

- `employee_vacations_delete_user_id_foreign`: (`delete_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_vacations_employee_contract_id_foreign`: (`employee_contract_id`) → `employee_contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_vacations_people_id_foreign`: (`people_id`) → `people` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `employee_vacations_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `people_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `employee_contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `from_date` | `date` | NO | `` | NULL | `` |  |
| `until_date` | `date` | NO | `` | NULL | `` |  |
| `return_date` | `date` | NO | `` | NULL | `` |  |
| `days` | `int` | NO | `` | NULL | `` |  |
| `ips_from_date` | `date` | YES | `` | NULL | `` |  |
| `ips_until_date` | `date` | YES | `` | NULL | `` |  |
| `ips_return_date` | `date` | YES | `` | NULL | `` |  |
| `ips_days` | `int` | YES | `` | NULL | `` |  |
| `period` | `int` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `delete_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `date_delete` | `date` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `engagement_letters`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `745`  

- **PK:** `id`

**FK salientes:**

- `engagement_letters_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `engagement_letters_person_id_foreign`: (`person_id`) → `people` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `engagement_letters_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `engagement_letters_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `social_reason_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `person_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `expiration_at` | `date` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `smallint` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `finished_at` | `datetime` | YES | `` | NULL | `` |  |

### `enterprise_numbers`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `enterprise_numbers_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE CASCADE

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `whatsapp_number` | `varchar(20)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |

### `enterprise_seller_rotations`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `enterprise_seller_rotations_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE CASCADE
- `enterprise_seller_rotations_last_user_id_foreign`: (`last_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE SET NULL

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `enterprise_id` | `int unsigned` | NO | `UNI` | NULL | `` |  |
| `last_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `enterprise_users`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `8232`  

- **PK:** `id`

**FK salientes:**

- `enterprise_users_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `enterprise_users_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `enterprises`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `18`  

- **PK:** `id`

**Referenciada por (muestra):**
- `accruals` → `enterprises` (`accruals_enterprise_id_foreign`)
- `additional_services` → `enterprises` (`additional_services_enterprise_id_foreign`)
- `bancard_cards` → `enterprises` (`bancard_cards_enterprise_id_foreign`)
- `bank_transfer_details` → `enterprises` (`bank_transfer_details_enterprise_id_foreign`)
- `calendar_events` → `enterprises` (`calendar_events_enterprise_id_foreign`)
- `campaigns` → `enterprises` (`campaigns_enterprise_id_foreign`)
- `card_prints` → `enterprises` (`card_prints_enterprise_id_foreign`)
- `cases_to_calls` → `enterprises` (`cases_to_calls_enterprise_id_foreign`)
- `cash_boxes` → `enterprises` (`cash_boxes_enterprise_id_foreign`)
- `client_service_advances` → `enterprises` (`client_service_advances_enterprise_id_foreign`)
- `client_service_debts` → `enterprises` (`client_service_debts_enterprise_id_foreign`)
- `closed_invoices` → `enterprises` (`closed_invoices_enterprise_id_foreign`)
- `collection_agents_goal_configs` → `enterprises` (`collection_agents_goal_configs_enterprise_id_foreign`)
- `collection_incomes` → `enterprises` (`collection_incomes_enterprise_id_foreign`)
- `collection_sections` → `enterprises` (`collection_sections_enterprise_id_foreign`)
- `commission_categories` → `enterprises` (`commission_categories_enterprise_id_foreign`)
- `commission_payments` → `enterprises` (`commission_payments_enterprise_id_foreign`)
- `commission_types` → `enterprises` (`commission_types_enterprise_id_foreign`)
- `commissions` → `enterprises` (`commissions_enterprise_id_foreign`)
- `contract_debiteds` → `enterprises` (`contract_debiteds_enterprise_id_foreign`)
- `contract_monitorings` → `enterprises` (`contract_monitorings_enterprise_id_foreign`)
- `contract_promotions` → `enterprises` (`contract_promotions_enterprise_id_foreign`)
- `contracts` → `enterprises` (`contracts_enterprise_id_foreign`)
- `corporate_agreements_enterprises` → `enterprises` (`corporate_agreements_enterprises_enterprise_id_foreign`)
- `cost_centers` → `enterprises` (`cost_centers_enterprise_id_foreign`)
- `dental_offices` → `enterprises` (`dental_offices_enterprise_id_foreign`)
- `deposits` → `enterprises` (`deposits_enterprise_id_foreign`)
- `detail_client_portfolios` → `enterprises` (`detail_client_portfolios_enterprise_id_foreign`)
- `dismissals` → `enterprises` (`dismissals_enterprise_id_foreign`)
- `doctors` → `enterprises` (`doctors_enterprise_id_foreign`)
- `email_campaigns` → `enterprises` (`email_campaigns_enterprise_id_foreign`)
- `employee_complaints` → `enterprises` (`employee_complaints_enterprise_id_foreign`)
- `employee_contracts` → `enterprises` (`employee_contracts_enterprise_id_foreign`)
- `employee_manager_commissions` → `enterprises` (`employee_manager_commissions_enterprise_id_foreign`)
- `employee_searches` → `enterprises` (`employee_searches_enterprise_id_foreign`)
- `engagement_letters` → `enterprises` (`engagement_letters_enterprise_id_foreign`)
- `enterprise_numbers` → `enterprises` (`enterprise_numbers_enterprise_id_foreign`)
- `enterprise_seller_rotations` → `enterprises` (`enterprise_seller_rotations_enterprise_id_foreign`)
- `enterprise_users` → `enterprises` (`enterprise_users_enterprise_id_foreign`)
- `facebook_forms` → `enterprises` (`facebook_forms_enterprise_id_foreign`)
- *… y 33 restricciones más*

**FK salientes:**

- `enterprises_last_seller_int_opportunity_id_foreign`: (`last_seller_int_opportunity_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `enterprises_last_seller_opportunity_id_foreign`: (`last_seller_asu_opportunity_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `enterprises_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `enterprises_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `abbreviation` | `varchar(191)` | NO | `` | NULL | `` |  |
| `label` | `varchar(191)` | NO | `` | NULL | `` |  |
| `ascont_id` | `int` | YES | `` | NULL | `` |  |
| `social_reason_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `service_ascont_id` | `int` | YES | `` | NULL | `` |  |
| `last_seller_asu_opportunity_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `last_seller_int_opportunity_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `equifaxes`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `45`  

- **PK:** `id`

**FK salientes:**

- `equifaxes_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `equifaxes_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `equifaxes_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `document_number` | `varchar(191)` | NO | `` | NULL | `` |  |
| `client_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `response` | `longtext` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `especialities`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `132`  

- **PK:** `id`

**Referenciada por (muestra):**
- `calendar_events` → `especialities` (`calendar_events_speciality_id_foreign`)
- `doctor_especialities` → `especialities` (`doctor_especialities_especiality_id_foreign`)
- `doctor_schedule_details` → `especialities` (`doctor_schedule_details_speciality_id_foreign`)
- `especiality_professional` → `especialities` (`especiality_professional_especiality_id_foreign`)
- `services_doctor_especialities` → `especialities` (`services_doctor_especialities_especiality_id_foreign`)

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `duration` | `int` | NO | `` | 0 | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `especiality_professional`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `4726`  

- **PK:** *(no declarada como `PRIMARY` en information_schema)*

**FK salientes:**

- `especiality_professional_especiality_id_foreign`: (`especiality_id`) → `especialities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `especiality_professional_professional_id_foreign`: (`professional_id`) → `professionals` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `especiality_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `professional_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |

### `esth_additional_treatments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `36`  

- **PK:** `id`

**FK salientes:**

- `esth_additional_treatments_esth_additional_id_foreign`: (`esth_additional_id`) → `esth_treatments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esth_additional_treatments_esth_treatment_id_foreign`: (`esth_treatment_id`) → `esth_treatments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `esth_additional_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `esth_treatment_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `esth_body_measurements`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `10694`  

- **PK:** `id`

**FK salientes:**

- `esth_body_measurements_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `weight` | `int` | YES | `` | NULL | `` |  |
| `height` | `int` | YES | `` | NULL | `` |  |
| `waist` | `int` | YES | `` | NULL | `` |  |
| `thigh` | `int` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `reason_admission` | `longtext` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `esth_branch_machines`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `189`  

- **PK:** `id`

**FK salientes:**

- `esth_branch_machines_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esth_branch_machines_esth_esthetic_machine_id_foreign`: (`esth_esthetic_machine_id`) → `esth_esthetic_machines` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `esth_esthetic_machine_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `availability` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `esth_client_services`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `50040`  

- **PK:** `id`

**Referenciada por (muestra):**
- `esth_client_services_debts` → `esth_client_services` (`esth_client_services_debts_esth_client_service_id_foreign`)

**FK salientes:**

- `esth_client_services_calendar_event_id_foreign`: (`calendar_event_id`) → `calendar_events` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esth_client_services_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esth_client_services_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esth_client_services_dental_office_id_foreign`: (`dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esth_client_services_esth_contract_treat_detail_id_foreign`: (`esth_contract_treat_detail_id`) → `esth_contract_treatment_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esth_client_services_esth_pat_treat_detail_id_foreign`: (`esth_pat_treat_detail_id`) → `esth_pat_treat_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esth_client_services_esth_treatment_id_foreign`: (`esth_treatment_id`) → `esth_treatments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esth_client_services_loyalty_coupons_detail_id_foreign`: (`loyalty_coupons_detail_id`) → `loyalty_coupons_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esth_client_services_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `esth_treatment_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `esth_pat_treat_detail_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `esth_contract_treat_detail_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `calendar_event_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `dental_office_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `loyalty_coupons_detail_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `additional_treatment` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `body_area` | `int` | YES | `` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `amount` | `int` | NO | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | NO | `` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `esth_client_services_advances`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `12239`  

- **PK:** `id`

**Referenciada por (muestra):**
- `esth_client_services_payments` → `esth_client_services_advances` (`esth_client_services_payments_esth_advance_id_foreign`)

**FK salientes:**

- `esth_client_services_advances_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esth_client_services_advances_voucher_id_foreign`: (`voucher_id`) → `vouchers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `voucher_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(30,2)` | NO | `` | 0.00 | `` |  |
| `residue` | `decimal(30,2)` | NO | `` | 0.00 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `esth_client_services_debts`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `639`  

- **PK:** `id`

**Referenciada por (muestra):**
- `esth_client_services_payments` → `esth_client_services_debts` (`esth_client_services_payments_esth_debt_id_foreign`)

**FK salientes:**

- `esth_client_services_debts_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esth_client_services_debts_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esth_client_services_debts_esth_client_service_id_foreign`: (`esth_client_service_id`) → `esth_client_services` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `esth_client_service_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(30,2)` | NO | `` | 0.00 | `` |  |
| `residue` | `decimal(30,2)` | NO | `` | 0.00 | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `esth_client_services_payments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `717`  

- **PK:** `id`

**FK salientes:**

- `esth_client_services_payments_esth_advance_id_foreign`: (`esth_advance_id`) → `esth_client_services_advances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esth_client_services_payments_esth_debt_id_foreign`: (`esth_debt_id`) → `esth_client_services_debts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `esth_advance_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `esth_debt_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(30,2)` | NO | `` | 0.00 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `esth_combo_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `62`  

- **PK:** `id`

**FK salientes:**

- `esth_combo_details_esth_combo_id_foreign`: (`esth_combo_id`) → `esth_combos` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esth_combo_details_purchases_product_id_foreign`: (`purchases_product_id`) → `purchases_products` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `esth_combo_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `amount` | `decimal(12,2)` | NO | `` | NULL | `` |  |
| `purchases_product_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `esth_combos`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `27`  

- **PK:** `id`

**Referenciada por (muestra):**
- `esth_combo_details` → `esth_combos` (`esth_combo_details_esth_combo_id_foreign`)

**FK salientes:**

- `esth_combos_service_invoice_id_foreign`: (`service_invoice_id`) → `service_invoices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esth_combos_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `from_date` | `date` | NO | `` | NULL | `` |  |
| `until_date` | `date` | NO | `` | NULL | `` |  |
| `service_invoice_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `esth_configuration_plans`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1347`  

- **PK:** `id`

**FK salientes:**

- `esth_configuration_plans_esthetic_package_id_foreign`: (`esthetic_package_id`) → `esthetic_packages` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `esthetic_package_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `insurance_id` | `int unsigned` | NO | `` | NULL | `` |  |
| `discount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `original_amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `esth_contract_treatment_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2393`  

- **PK:** `id`

**Referenciada por (muestra):**
- `esth_client_services` → `esth_contract_treatment_details` (`esth_client_services_esth_contract_treat_detail_id_foreign`)

**FK salientes:**

- `esth_contract_treatment_details_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esth_contract_treatment_details_esth_treatment_id_foreign`: (`esth_treatment_id`) → `esth_treatments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `esth_treatment_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `session_duration` | `int` | NO | `` | 0 | `` |  |
| `quantity_sessions` | `int` | NO | `` | NULL | `` |  |
| `residue_sessions` | `int` | NO | `` | NULL | `` |  |
| `session_price` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `total_amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `esth_treatments_type` | `int` | NO | `` | NULL | `` |  |

### `esth_esthetic_machines`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `36`  

- **PK:** `id`

**Referenciada por (muestra):**
- `esth_branch_machines` → `esth_esthetic_machines` (`esth_branch_machines_esth_esthetic_machine_id_foreign`)
- `esth_treatments` → `esth_esthetic_machines` (`esth_treatments_esth_esthetic_machine_id_foreign`)

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `esth_pat_treat_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `53340`  

- **PK:** `id`

**Referenciada por (muestra):**
- `esth_client_services` → `esth_pat_treat_details` (`esth_client_services_esth_pat_treat_detail_id_foreign`)

**FK salientes:**

- `esth_pat_treat_details_esth_patient_treatment_id_foreign`: (`esth_patient_treatment_id`) → `esth_patient_treatments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esth_pat_treat_details_esth_protocol_id_foreign`: (`esth_protocol_id`) → `esth_protocols` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esth_pat_treat_details_esth_treatment_id_foreign`: (`esth_treatment_id`) → `esth_treatments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `esth_patient_treatment_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `esth_treatment_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `esth_protocol_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `body_area` | `int` | NO | `` | NULL | `` |  |
| `order` | `int` | NO | `` | NULL | `` |  |
| `sessions` | `int` | NO | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `esth_pathologies`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `33`  

- **PK:** `id`

**Referenciada por (muestra):**
- `esth_protocols` → `esth_pathologies` (`esth_protocols_esth_pathology_id_foreign`)

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `description` | `longtext` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `esth_patient_treatments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `36500`  

- **PK:** `id`

**Referenciada por (muestra):**
- `esth_pat_treat_details` → `esth_patient_treatments` (`esth_pat_treat_details_esth_patient_treatment_id_foreign`)

**FK salientes:**

- `esth_patient_treatments_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esth_patient_treatments_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esth_patient_treatments_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esth_patient_treatments_dental_office_id_foreign`: (`dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esth_patient_treatments_doctor_id_foreign`: (`doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esth_patient_treatments_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `dental_office_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `observation` | `longtext` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `esth_protocol_treatments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `203`  

- **PK:** `id`

**FK salientes:**

- `esth_protocol_treatments_esth_protocol_id_foreign`: (`esth_protocol_id`) → `esth_protocols` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esth_protocol_treatments_esth_treatment_id_foreign`: (`esth_treatment_id`) → `esth_treatments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `esth_protocol_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `esth_treatment_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `order` | `int` | NO | `` | NULL | `` |  |
| `sessions` | `int` | NO | `` | NULL | `` |  |
| `body_area` | `int` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `esth_protocols`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `102`  

- **PK:** `id`

**Referenciada por (muestra):**
- `calendar_events` → `esth_protocols` (`calendar_events_esth_protocol_id_foreign`)
- `esth_pat_treat_details` → `esth_protocols` (`esth_pat_treat_details_esth_protocol_id_foreign`)
- `esth_protocol_treatments` → `esth_protocols` (`esth_protocol_treatments_esth_protocol_id_foreign`)

**FK salientes:**

- `esth_protocols_esth_pathology_id_foreign`: (`esth_pathology_id`) → `esth_pathologies` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `type` | `int` | NO | `` | NULL | `` |  |
| `esth_pathology_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `description` | `longtext` | NO | `` | NULL | `` |  |
| `treatment_orders` | `int` | YES | `` | 1 | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `esth_treatment_prices`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `180`  

- **PK:** `id`

**FK salientes:**

- `esth_treatment_prices_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esth_treatment_prices_esth_treatment_id_foreign`: (`esth_treatment_id`) → `esth_treatments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `esth_treatment_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `body_area` | `int` | NO | `` | NULL | `` |  |
| `price` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `preferencial_price` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `esth_treatments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `45`  

- **PK:** `id`

**Referenciada por (muestra):**
- `calendar_event_rooms` → `esth_treatments` (`calendar_event_rooms_esth_treatment_id_foreign`)
- `calendar_events_doctor_services` → `esth_treatments` (`calendar_events_doctor_services_esth_treatment_id_foreign`)
- `esth_additional_treatments` → `esth_treatments` (`esth_additional_treatments_esth_additional_id_foreign`)
- `esth_additional_treatments` → `esth_treatments` (`esth_additional_treatments_esth_treatment_id_foreign`)
- `esth_client_services` → `esth_treatments` (`esth_client_services_esth_treatment_id_foreign`)
- `esth_contract_treatment_details` → `esth_treatments` (`esth_contract_treatment_details_esth_treatment_id_foreign`)
- `esth_pat_treat_details` → `esth_treatments` (`esth_pat_treat_details_esth_treatment_id_foreign`)
- `esth_protocol_treatments` → `esth_treatments` (`esth_protocol_treatments_esth_treatment_id_foreign`)
- `esth_treatment_prices` → `esth_treatments` (`esth_treatment_prices_esth_treatment_id_foreign`)
- `esthetic_package_details` → `esth_treatments` (`esthetic_package_details_esth_treatments_id_foreign`)
- `loyalty_coupons_details` → `esth_treatments` (`loyalty_coupons_details_esth_treatment_id_foreign`)
- `product_stocks` → `esth_treatments` (`product_stocks_esth_treatment_id_foreign`)

**FK salientes:**

- `esth_treatments_esth_esthetic_machine_id_foreign`: (`esth_esthetic_machine_id`) → `esth_esthetic_machines` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `esth_treatment_type` | `varchar(191)` | YES | `` | NULL | `` |  |
| `frequency` | `int` | NO | `` | NULL | `` |  |
| `esth_esthetic_machine_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `price` | `int` | NO | `` | NULL | `` |  |
| `preferencial_price` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `additional_treatment` | `int` | NO | `` | NULL | `` |  |
| `assisted_treatment` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `duration_time` | `int` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `esthetic_package_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `175`  

- **PK:** `id`

**FK salientes:**

- `esthetic_package_details_esth_package_id_foreign`: (`esth_package_id`) → `esthetic_packages` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esthetic_package_details_esth_treatments_id_foreign`: (`esth_treatments_id`) → `esth_treatments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `esth_package_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `esth_treatments_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `esth_treatments_type` | `int` | NO | `` | NULL | `` |  |
| `session_duration` | `int` | NO | `` | NULL | `` |  |
| `session_price` | `int` | NO | `` | NULL | `` |  |
| `session_quantity` | `int` | NO | `` | NULL | `` |  |
| `total_amount` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `esthetic_package_pay_to_fees`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2544`  

- **PK:** `id`

**FK salientes:**

- `esthetic_package_pay_to_fees_esth_package_id_foreign`: (`esth_package_id`) → `esthetic_packages` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `esthetic_package_pay_to_fees_insurance_id_foreign`: (`insurance_id`) → `insurances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `esth_package_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `insurance_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `number` | `int` | NO | `` | NULL | `` |  |
| `percentage` | `int` | NO | `` | NULL | `` |  |
| `amount_fees` | `int` | NO | `` | NULL | `` |  |
| `type_fees` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `esthetic_packages`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `188`  

- **PK:** `id`

**Referenciada por (muestra):**
- `contracts` → `esthetic_packages` (`contracts_esth_package_id_foreign`)
- `esth_configuration_plans` → `esthetic_packages` (`esth_configuration_plans_esthetic_package_id_foreign`)
- `esthetic_package_details` → `esthetic_packages` (`esthetic_package_details_esth_package_id_foreign`)
- `esthetic_package_pay_to_fees` → `esthetic_packages` (`esthetic_package_pay_to_fees_esth_package_id_foreign`)

**FK salientes:**

- `esthetic_packages_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `total_amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `is_custom` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `evaluation_periods`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `78`  

- **PK:** `id`

**FK salientes:**

- `evaluation_period_people_id_foreign`: (`people_id`) → `people` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `people_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `cooperation` | `int` | NO | `` | NULL | `` |  |
| `discipline` | `int` | NO | `` | NULL | `` |  |
| `presentation` | `int` | NO | `` | NULL | `` |  |
| `human_relations` | `int` | NO | `` | NULL | `` |  |
| `productivity` | `int` | NO | `` | NULL | `` |  |
| `work_quality` | `int` | NO | `` | NULL | `` |  |
| `standards_professionalism` | `int` | NO | `` | NULL | `` |  |
| `opening_change` | `int` | NO | `` | NULL | `` |  |
| `relationships` | `int` | NO | `` | NULL | `` |  |
| `planning` | `int` | NO | `` | NULL | `` |  |
| `attendance` | `int` | NO | `` | NULL | `` |  |
| `initiative` | `int` | NO | `` | NULL | `` |  |
| `creativity` | `int` | NO | `` | NULL | `` |  |
| `ability_learn` | `int` | NO | `` | NULL | `` |  |
| `aptitude` | `int` | NO | `` | NULL | `` |  |
| `responsibility` | `int` | NO | `` | NULL | `` |  |
| `collaboration` | `int` | NO | `` | NULL | `` |  |
| `adaptability` | `int` | NO | `` | NULL | `` |  |
| `quantity_results` | `int` | NO | `` | NULL | `` |  |
| `quality_results` | `int` | NO | `` | NULL | `` |  |
| `knowledge` | `int` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | NO | `` | NULL | `` |  |
| `points_improve` | `longtext` | NO | `` | NULL | `` |  |
| `required_training` | `longtext` | NO | `` | NULL | `` |  |
| `new_period_evaluating` | `longtext` | NO | `` | NULL | `` |  |
| `pass_trial_period` | `longtext` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `exoneration_reasons`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `35`  

- **PK:** `id`

**Referenciada por (muestra):**
- `payments` → `exoneration_reasons` (`payments_exoneration_reason_id_foreign`)

**FK salientes:**

- `exoneration_reasons_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `extra_hours`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**Referenciada por (muestra):**
- `employee_contract_assistances` → `extra_hours` (`employee_contract_assistances_extra_hour_id_foreign`)

**FK salientes:**

- `extra_hours_approved_user_id_foreign`: (`approved_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `extra_hours_deleted_user_id_foreign`: (`deleted_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `extra_hours_people_id_foreign`: (`people_id`) → `people` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `extra_hours_rejected_user_id_foreign`: (`rejected_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `extra_hours_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `people_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `from_hour` | `time` | NO | `` | NULL | `` |  |
| `until_hour` | `time` | NO | `` | NULL | `` |  |
| `type` | `int` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `approved_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `rejected_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `motive_rejected` | `longtext` | YES | `` | NULL | `` |  |
| `deleted_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `motive_deleted` | `longtext` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `facebook_ad_teams`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `502`  

- **PK:** `id`

**FK salientes:**

- `facebook_ad_teams_facebook_ad_id_foreign`: (`facebook_ad_id`) → `facebook_ads` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `facebook_ad_teams_seller_team_id_foreign`: (`seller_team_id`) → `seller_teams` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `facebook_ad_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `seller_team_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `facebook_ads`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `800`  

- **PK:** `id`

**Referenciada por (muestra):**
- `facebook_ad_teams` → `facebook_ads` (`facebook_ad_teams_facebook_ad_id_foreign`)

**FK salientes:**

- `facebook_ads_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `facebook_ads_contract_promotion_id_foreign`: (`contract_promotion_id`) → `contract_promotions` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `facebook_ads_from_branch_id_foreign`: (`from_branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `facebook_ads_insurance_id_foreign`: (`insurance_id`) → `insurances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `facebook_ads_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `ad_id` | `varchar(191)` | NO | `` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `from_branch_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `insurance_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `contract_promotion_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |

### `facebook_forms`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `26`  

- **PK:** `id`

**FK salientes:**

- `facebook_forms_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `facebook_forms_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `form_id` | `varchar(191)` | NO | `` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |

### `factura`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `92682`  

- **PK:** *(no declarada como `PRIMARY` en information_schema)*

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `fa_fecha` | `date` | NO | `` | NULL | `` |  |
| `fa_hora` | `varchar(10)` | NO | `` | NULL | `` |  |
| `fa_nro` | `int` | NO | `` | NULL | `` |  |
| `fa_condicion` | `varchar(10)` | NO | `` | NULL | `` |  |
| `fa_vcmto` | `date` | YES | `` | NULL | `` |  |
| `fa_nombre` | `varchar(50)` | NO | `` | NULL | `` |  |
| `fa_direccion` | `varchar(50)` | NO | `` | NULL | `` |  |
| `fa_ruc` | `varchar(20)` | NO | `` | NULL | `` |  |
| `fa_telefono` | `varchar(15)` | NO | `` | NULL | `` |  |
| `fa_paciente` | `int` | NO | `MUL` | NULL | `` |  |
| `fa_iva5` | `int` | YES | `` | NULL | `` |  |
| `fa_iva10` | `int` | YES | `` | NULL | `` |  |
| `fa_excenta` | `int` | YES | `` | NULL | `` |  |
| `fa_total` | `int` | NO | `` | NULL | `` |  |
| `fa_concepto` | `varchar(100)` | YES | `` | NULL | `` |  |
| `fa_tipof` | `varchar(1)` | NO | `` | NULL | `` |  |
| `fa_tipo` | `varchar(1)` | NO | `` | NULL | `` |  |
| `fa_usuario` | `varchar(5)` | NO | `` | NULL | `` |  |
| `fa_estado` | `varchar(1)` | NO | `` | NULL | `` |  |
| `fa_multa` | `int` | YES | `` | NULL | `` |  |
| `fa_id_sucursal` | `varchar(5)` | NO | `` | NULL | `` |  |
| `fa_id_caja` | `varchar(5)` | NO | `` | NULL | `` |  |
| `fa_voucher_id` | `int` | YES | `` | NULL | `` |  |

### `failed_jobs`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `52470`  

- **PK:** `id`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `bigint unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `connection` | `text` | NO | `` | NULL | `` |  |
| `queue` | `text` | NO | `` | NULL | `` |  |
| `payload` | `longtext` | NO | `` | NULL | `` |  |
| `exception` | `longtext` | NO | `` | NULL | `` |  |
| `failed_at` | `timestamp` | NO | `` | CURRENT_TIMESTAMP | `DEFAULT_GENERATED` |  |

### `gerencies`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `14`  

- **PK:** `id`

**Referenciada por (muestra):**
- `business_departments` → `gerencies` (`business_departments_gerency_id_foreign`)
- `people` → `gerencies` (`people_gerency_id_foreign`)

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `goals`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `54`  

- **PK:** `id`

**Referenciada por (muestra):**
- `goals_details` → `goals` (`goals_details_goal_id_foreign`)
- `manager_commission_details` → `goals` (`manager_commission_details_goal_id_foreign`)

**FK salientes:**

- `goals_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `goal_type` | `int` | NO | `` | NULL | `` |  |
| `goal_category` | `int` | NO | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `from_date` | `date` | NO | `` | NULL | `` |  |
| `until_date` | `date` | NO | `` | NULL | `` |  |
| `tramo` | `int` | YES | `` | NULL | `` |  |
| `percentage` | `decimal(5,3)` | YES | `` | NULL | `` |  |
| `goal_amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `total` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `request_json` | `text` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `conditional_percentage` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `commission_percentage` | `decimal(11,2)` | YES | `` | NULL | `` |  |

### `goals_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `973`  

- **PK:** `id`

**FK salientes:**

- `goals_details_goal_id_foreign`: (`goal_id`) → `goals` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `fromable_id` | `int` | NO | `` | NULL | `` |  |
| `fromable_type` | `varchar(191)` | NO | `` | NULL | `` |  |
| `goal_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `half_contacts`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `52`  

- **PK:** `id`

**Referenciada por (muestra):**
- `contracts` → `half_contacts` (`contracts_half_contact_id_foreign`)
- `sales_opportunities` → `half_contacts` (`sales_opportunities_half_contact_id_foreign`)

**FK salientes:**

- `half_contacts_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `MUL` | NULL | `` |  |
| `type` | `int unsigned` | YES | `` | 0 | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `headings`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `57`  

- **PK:** `id`

**Referenciada por (muestra):**
- `contracts` → `headings` (`contracts_heading_id_foreign`)

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `holidays`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `15`  

- **PK:** `id`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `description` | `varchar(191)` | NO | `` | NULL | `` |  |
| `day` | `int` | NO | `` | NULL | `` |  |
| `month` | `int` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `infusion_diagnoses`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `4`  

- **PK:** `id`

**Referenciada por (muestra):**
- `clients` → `infusion_diagnoses` (`clients_infusion_diagnose_id_foreign`)

**FK salientes:**

- `infusion_diagnoses_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `infusion_prices`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `5`  

- **PK:** `id`

**Referenciada por (muestra):**
- `clients` → `infusion_prices` (`clients_infusion_price_id_foreign`)

**FK salientes:**

- `infusion_prices_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `type` | `int` | NO | `` | NULL | `` |  |
| `amount` | `decimal(10,2)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `infusions`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2227`  

- **PK:** `id`

**FK salientes:**

- `infusions_address_id_foreign`: (`address_id`) → `addresses` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `infusions_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `infusions_doctor_infusion_id_foreign`: (`doctor_infusion_id`) → `doctor_infusions` (`id`) ON UPDATE NO ACTION / ON DELETE SET NULL
- `infusions_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `doctor_infusion_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `address_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `file` | `varchar(191)` | YES | `` | NULL | `` |  |
| `amount` | `decimal(10,2)` | YES | `` | NULL | `` |  |
| `additional_amount` | `decimal(10,2)` | YES | `` | NULL | `` |  |

### `insurance_doctor`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2835`  

- **PK:** `id`

**FK salientes:**

- `insurance_doctor_doctor_id_foreign`: (`doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `insurance_doctor_insurance_id_foreign`: (`insurance_id`) → `insurances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `insurance_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `insurances`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `128`  

- **PK:** `id`

**Referenciada por (muestra):**
- `calendar_events` → `insurances` (`calendar_events_insurance_id_foreign`)
- `card_prints` → `insurances` (`card_prints_insurance_id_foreign`)
- `client_services` → `insurances` (`client_services_insurance_id_foreign`)
- `contract_monitorings` → `insurances` (`contract_monitorings_insurance_id_foreign`)
- `contract_promotion_insurance` → `insurances` (`contract_promotion_insurance_insurance_id_foreign`)
- `contract_scorings` → `insurances` (`contract_scorings_insurance_id_foreign`)
- `contracts` → `insurances` (`contracts_insurance_id_foreign`)
- `contracts` → `insurances` (`contracts_other_insurance_id_foreign`)
- `email_campaigns` → `insurances` (`email_campaigns_insurance_id_foreign`)
- `esthetic_package_pay_to_fees` → `insurances` (`esthetic_package_pay_to_fees_insurance_id_foreign`)
- `facebook_ads` → `insurances` (`facebook_ads_insurance_id_foreign`)
- `insurance_doctor` → `insurances` (`insurance_doctor_insurance_id_foreign`)
- `internments` → `insurances` (`internments_insurance_id_foreign`)
- `invoice_masives` → `insurances` (`invoice_masives_insurance_id_foreign`)
- `medical_coverages` → `insurances` (`medical_coverages_insurance_id_foreign`)
- `quality_controls` → `insurances` (`quality_controls_insurance_id_foreign`)
- `request_changes` → `insurances` (`request_changes_insurance_id_foreign`)
- `request_changes` → `insurances` (`request_changes_old_insurance_id_foreign`)
- `sales_estetics` → `insurances` (`sales_estetics_insurance_id_foreign`)
- `sales_opportunities` → `insurances` (`sales_opportunities_insurance_id_foreign`)
- `sms_campaigns` → `insurances` (`sms_campaigns_insurance_id_foreign`)

**FK salientes:**

- `insurances_coverage_id_foreign`: (`coverage_id`) → `coverages` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `insurances_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `insurances_treatment_convention_id_foreign`: (`treatment_convention_id`) → `treatment_conventions` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `insurances_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `coverage_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `persons` | `int` | NO | `` | NULL | `` |  |
| `quotas` | `int` | NO | `` | NULL | `` |  |
| `debtcollector_individual` | `int` | NO | `` | NULL | `` |  |
| `debtcollector_familiar` | `int` | NO | `` | NULL | `` |  |
| `debtcollector_couple` | `int` | YES | `` | NULL | `` |  |
| `debit_individual` | `int` | NO | `` | NULL | `` |  |
| `debit_familiar` | `int` | NO | `` | NULL | `` |  |
| `debit_couple` | `int` | YES | `` | NULL | `` |  |
| `counted` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `esth_sessions` | `int` | YES | `` | NULL | `` |  |
| `automatic_renewal` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `treatment_convention_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |

### `interest_accrual_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `298020`  

- **PK:** `id`

**FK salientes:**

- `interest_accrual_details_accounting_plan_id_foreign`: (`accounting_plan_id`) → `accounting_plans` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `interest_accrual_details_contract_fee_id_foreign`: (`contract_fee_id`) → `contract_fees` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `interest_accrual_details_interest_accrual_id_foreign`: (`interest_accrual_id`) → `interest_accruals` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `interest_accrual_details_payment_id_foreign`: (`payment_id`) → `payments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `interest_accrual_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `contract_fee_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `accounting_plan_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `interest_to_accrue` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `residue` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `payment_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `interest_accruals`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `298105`  

- **PK:** `id`

**Referenciada por (muestra):**
- `interest_accrual_details` → `interest_accruals` (`interest_accrual_details_interest_accrual_id_foreign`)

**FK salientes:**

- `interest_accruals_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `interest_accruals_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `accounting_seated` | `tinyint(1)` | NO | `` | 0 | `` |  |

### `interest_rates`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `902`  

- **PK:** `id`

**Referenciada por (muestra):**
- `contracts` → `interest_rates` (`contracts_interest_rate_id_foreign`)
- `cuoteras` → `interest_rates` (`cuoteras_interest_rate_id_foreign`)

**FK salientes:**

- `interest_rates_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `from_date` | `date` | NO | `` | NULL | `` |  |
| `until_date` | `date` | NO | `` | NULL | `` |  |
| `direct_reference_rate` | `decimal(5,2)` | YES | `` | NULL | `` |  |
| `top_rate` | `decimal(4,2)` | YES | `` | NULL | `` |  |
| `rate_frequency` | `int` | NO | `` | NULL | `` |  |
| `real_interest_rate` | `decimal(4,2)` | NO | `` | NULL | `` |  |
| `interest_rate` | `decimal(4,2)` | NO | `` | NULL | `` |  |
| `seller_comission` | `decimal(4,2)` | NO | `` | NULL | `` |  |
| `administrative_rate` | `decimal(4,2)` | NO | `` | NULL | `` |  |
| `top_administrative_expense` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `default_rate` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `internal_notification_files`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `16`  

- **PK:** `id`

**FK salientes:**

- `internal_notification_files_internal_notification_id_foreign`: (`internal_notification_id`) → `internal_notifications` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `internal_notification_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `original_name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `internal_notification_users`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `416711`  

- **PK:** `id`

**FK salientes:**

- `internal_notification_users_internal_notification_id_foreign`: (`internal_notification_id`) → `internal_notifications` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `internal_notification_users_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `internal_notification_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `view` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `internal_notifications`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `149961`  

- **PK:** `id`

**Referenciada por (muestra):**
- `internal_notification_files` → `internal_notifications` (`internal_notification_files_internal_notification_id_foreign`)
- `internal_notification_users` → `internal_notifications` (`internal_notification_users_internal_notification_id_foreign`)

**FK salientes:**

- `internal_notifications_deleted_user_id_foreign`: (`deleted_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `internal_notifications_quality_control_id_foreign`: (`quality_control_id`) → `quality_controls` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `internal_notifications_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `publishing_date` | `datetime` | NO | `` | NULL | `` |  |
| `quality_control_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `header` | `varchar(191)` | YES | `` | NULL | `` |  |
| `body` | `longtext` | NO | `` | NULL | `` |  |
| `email_notification` | `int` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `job_id` | `int unsigned` | YES | `` | NULL | `` |  |
| `deleted_at` | `datetime` | YES | `` | NULL | `` |  |
| `reason_delete` | `longtext` | YES | `` | NULL | `` |  |
| `deleted_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `internment_processes`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `internment_rooms`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `3`  

- **PK:** `id`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `internments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `260`  

- **PK:** `id`

**Referenciada por (muestra):**
- `services_authorizations` → `internments` (`services_authorizations_internment_id_foreign`)

**FK salientes:**

- `internments_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `internments_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `internments_diagnostic_id_foreign`: (`diagnostic_id`) → `diagnostics` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `internments_doctor_id_foreign`: (`doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `internments_insurance_id_foreign`: (`insurance_id`) → `insurances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `internments_user_deleted_foreign`: (`user_deleted`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `internments_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `insurance_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `diagnostic_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `number` | `int` | YES | `` | NULL | `` |  |
| `internment_date` | `datetime` | NO | `` | NULL | `` |  |
| `exit_date` | `datetime` | YES | `` | NULL | `` |  |
| `room_number` | `varchar(191)` | NO | `` | NULL | `` |  |
| `floor_number` | `varchar(191)` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `total_amount` | `decimal(12,2)` | YES | `` | NULL | `` |  |
| `date_deleted` | `date` | YES | `` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `exit_motive` | `smallint` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `invoice_cycles`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `12`  

- **PK:** `id`

**Referenciada por (muestra):**
- `contracts` → `invoice_cycles` (`contracts_invoice_cycle_id_foreign`)
- `invoice_masives` → `invoice_cycles` (`invoice_masives_invoice_cycle_id_foreign`)

**FK salientes:**

- `invoice_cycles_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `invoice_masive_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `39168`  

- **PK:** `id`

**FK salientes:**

- `invoice_masive_details_invoice_masive_id_foreign`: (`invoice_masive_id`) → `invoice_masives` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `invoice_masive_details_voucher_id_foreign`: (`voucher_id`) → `vouchers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `invoice_masive_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `voucher_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `invoice_masives`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `564`  

- **PK:** `id`

**Referenciada por (muestra):**
- `invoice_masive_details` → `invoice_masives` (`invoice_masive_details_invoice_masive_id_foreign`)

**FK salientes:**

- `invoice_masives_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `invoice_masives_debt_collector_id_foreign`: (`debt_collector_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `invoice_masives_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `invoice_masives_insurance_id_foreign`: (`insurance_id`) → `insurances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `invoice_masives_invoice_cycle_id_foreign`: (`invoice_cycle_id`) → `invoice_cycles` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `invoice_masives_seller_id_foreign`: (`seller_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `invoice_masives_service_invoice_id_foreign`: (`service_invoice_id`) → `service_invoices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `invoice_masives_stamped_id_foreign`: (`stamped_id`) → `stampeds` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `invoice_masives_user_deleted_foreign`: (`user_deleted`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `invoice_masives_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `invoice_masives_voucher_box_id_foreign`: (`voucher_box_id`) → `voucher_boxes` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `voucher_box_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `stamped_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `service_invoice_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `description` | `varchar(191)` | NO | `` | NULL | `` |  |
| `invoice_cycle_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `seller_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `debt_collector_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `insurance_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `invoice_services_migrate`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `5881`  

- **PK:** *(no declarada como `PRIMARY` en information_schema)*

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `date` | `date` | YES | `` | NULL | `` |  |
| `number` | `varchar(20)` | YES | `` | NULL | `` |  |
| `name` | `varchar(200)` | YES | `` | NULL | `` |  |
| `document_number` | `varchar(20)` | YES | `` | NULL | `` |  |
| `amount` | `varbinary(30)` | YES | `` | NULL | `` |  |

### `job_positions`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `189`  

- **PK:** `id`

**Referenciada por (muestra):**
- `dismissals` → `job_positions` (`dismissals_job_positions_id_foreign`)
- `employee_contracts` → `job_positions` (`employee_contracts_job_position_id_foreign`)
- `employee_searches` → `job_positions` (`employee_searches_depend_of_id_foreign`)
- `employee_searches` → `job_positions` (`employee_searches_job_positions_id_foreign`)
- `people` → `job_positions` (`people_job_position_id_foreign`)

**FK salientes:**

- `job_positions_business_department_id_foreign`: (`business_department_id`) → `business_departments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `job_positions_work_area_id_foreign`: (`work_area_id`) → `work_areas` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `business_department_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `work_area_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `jobs`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `17594`  

- **PK:** `id`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `bigint unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `queue` | `varchar(191)` | NO | `MUL` | NULL | `` |  |
| `payload` | `longtext` | NO | `` | NULL | `` |  |
| `attempts` | `tinyint unsigned` | NO | `` | NULL | `` |  |
| `reserved_at` | `int unsigned` | YES | `` | NULL | `` |  |
| `available_at` | `int unsigned` | NO | `` | NULL | `` |  |
| `created_at` | `int unsigned` | NO | `` | NULL | `` |  |

### `laboratories`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `8`  

- **PK:** `id`

**Referenciada por (muestra):**
- `client_laboratories` → `laboratories` (`client_laboratories_laboratory_id_foreign`)
- `laboratory_receipts` → `laboratories` (`laboratory_receipts_laboratory_id_foreign`)
- `prosthesis_laboratories` → `laboratories` (`prosthesis_laboratories_laboratory_id_foreign`)
- `users` → `laboratories` (`users_laboratory_id_foreign`)

**FK salientes:**

- `laboratories_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `laboratories_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `client_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `epem_offices` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `laboratory_job_services_doctor`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `461`  

- **PK:** `id`

**FK salientes:**

- `laboratory_job_services_doctor_laboratory_job_id_foreign`: (`laboratory_job_id`) → `laboratory_jobs` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `laboratory_job_services_doctor_services_doctor_id_foreign`: (`services_doctor_id`) → `services_doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `laboratory_job_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `services_doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `limit_time` | `varchar(191)` | NO | `` | 00:00:00 | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `type_time` | `int` | NO | `` | 2 | `` |  |

### `laboratory_jobs`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `18`  

- **PK:** `id`

**Referenciada por (muestra):**
- `client_laboratories` → `laboratory_jobs` (`client_laboratories_laboratory_job_id_foreign`)
- `laboratory_job_services_doctor` → `laboratory_jobs` (`laboratory_job_services_doctor_laboratory_job_id_foreign`)
- `prosthesis_laboratories` → `laboratory_jobs` (`prosthesis_laboratories_laboratory_job_id_foreign`)

**FK salientes:**

- `laboratory_jobs_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `sale_price` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `laboratory_price_list_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `laboratory_price_list_details_laboratory_price_list_id_foreign`: (`laboratory_price_list_id`) → `laboratory_price_lists` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `laboratory_price_list_details_services_doctor_id_foreign`: (`services_doctor_id`) → `services_doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `laboratory_price_list_details_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `laboratory_price_list_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `services_doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `price_sale` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `laboratory_price_lists`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**Referenciada por (muestra):**
- `laboratory_price_list_details` → `laboratory_price_lists` (`laboratory_price_list_details_laboratory_price_list_id_foreign`)

**FK salientes:**

- `laboratory_price_lists_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `laboratory_receipt_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `44588`  

- **PK:** `id`

**FK salientes:**

- `laboratory_receipt_details_client_laboratory_id_foreign`: (`client_laboratory_id`) → `client_laboratories` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `laboratory_receipt_details_laboratory_receipt_id_foreign`: (`laboratory_receipt_id`) → `laboratory_receipts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_laboratory_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `laboratory_receipt_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `laboratory_receipts`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `14350`  

- **PK:** `id`

**Referenciada por (muestra):**
- `laboratory_receipt_details` → `laboratory_receipts` (`laboratory_receipt_details_laboratory_receipt_id_foreign`)

**FK salientes:**

- `laboratory_receipts_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `laboratory_receipts_laboratory_id_foreign`: (`laboratory_id`) → `laboratories` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `laboratory_receipts_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `laboratory_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `sent_with` | `varchar(191)` | NO | `` | NULL | `` |  |
| `back_at` | `date` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `int unsigned` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `last_sellers`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `167`  

- **PK:** `id`

**FK salientes:**

- `last_sellers_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `last_sellers_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `branch_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `last_seller` | `int` | NO | `` | NULL | `` |  |
| `seller_type` | `int` | YES | `` | NULL | `` |  |
| `distribution_type` | `int` | NO | `` | NULL | `` |  |
| `teams_concat` | `varchar(191)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `listado_servicios`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `816`  

- **PK:** *(no declarada como `PRIMARY` en information_schema)*

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `nombre` | `varchar(200)` | YES | `` | NULL | `` |  |
| `precio` | `varchar(20)` | YES | `` | NULL | `` |  |
| `service_doctor_id` | `int` | YES | `` | NULL | `` |  |

### `log_emails`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `327747`  

- **PK:** `id`

**FK salientes:**

- `log_emails_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `email` | `varchar(191)` | NO | `` | NULL | `` |  |
| `observation` | `varchar(191)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `login_call_centers`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `7018`  

- **PK:** `id`

**FK salientes:**

- `login_call_centers_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `queue` | `varchar(191)` | NO | `` | NULL | `` |  |
| `agent` | `varchar(191)` | NO | `` | NULL | `` |  |
| `internal` | `varchar(191)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `loyalty_client_trackings`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `460`  

- **PK:** `id`

**FK salientes:**

- `loyalty_client_trackings_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `loyalty_client_trackings_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `loyalty_client_trackings_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `loyalty_client_trackings_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `contact_way` | `text` | YES | `` | NULL | `` |  |
| `contact_status` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `motive` | `text` | YES | `` | NULL | `` |  |
| `observation` | `text` | YES | `` | NULL | `` |  |
| `tracking_type` | `int unsigned` | YES | `` | NULL | `` |  |
| `status` | `varchar(191)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `loyalty_coupons`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2003`  

- **PK:** `id`

**Referenciada por (muestra):**
- `loyalty_coupons_details` → `loyalty_coupons` (`loyalty_coupons_details_loyalty_coupon_id_foreign`)

**FK salientes:**

- `loyalty_coupons_campaign_id_foreign`: (`campaign_id`) → `campaigns` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `loyalty_coupons_client_enterprise_id_foreign`: (`client_enterprise_id`) → `clients_enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `loyalty_coupons_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `loyalty_coupons_seller_id_foreign`: (`seller_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `loyalty_coupons_used_user_id_foreign`: (`used_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `loyalty_coupons_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `type` | `int` | NO | `` | 1 | `` |  |
| `description` | `varchar(191)` | NO | `` | NULL | `` |  |
| `number` | `int` | NO | `` | NULL | `` |  |
| `campaign_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `client_enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `seller_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `client_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `amount` | `decimal(8,2)` | YES | `` | NULL | `` |  |
| `expiration` | `date` | YES | `` | NULL | `` |  |
| `residue` | `decimal(8,2)` | YES | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | NO | `` | NULL | `` |  |
| `used_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `used_at` | `datetime` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `loyalty_coupons_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `66`  

- **PK:** `id`

**Referenciada por (muestra):**
- `esth_client_services` → `loyalty_coupons_details` (`esth_client_services_loyalty_coupons_detail_id_foreign`)

**FK salientes:**

- `loyalty_coupons_details_dental_budget_id_foreign`: (`dental_budget_id`) → `dental_budgets` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `loyalty_coupons_details_esth_treatment_id_foreign`: (`esth_treatment_id`) → `esth_treatments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `loyalty_coupons_details_loyalty_coupon_id_foreign`: (`loyalty_coupon_id`) → `loyalty_coupons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `loyalty_coupon_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `dental_budget_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `esth_treatment_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `body_area` | `int` | YES | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `manager_commission_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2`  

- **PK:** `id`

**FK salientes:**

- `manager_commission_details_collection_sections_id_foreign`: (`collection_sections_id`) → `collection_sections` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `manager_commission_details_commission_payment_id_foreign`: (`commission_payment_id`) → `commission_payments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `manager_commission_details_goal_id_foreign`: (`goal_id`) → `goals` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `commission_payment_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `goal_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `collection_sections_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `goal_amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `minimum_goal` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `month_collection` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `commissionable_amount` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `percentage_commission` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `commission_amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `payment_percentage` | `decimal(11,2)` | YES | `` | NULL | `` |  |

### `manager_effectivities`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `82930`  

- **PK:** `id`

**FK salientes:**

- `manager_effectivities_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `manager_effectivities_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `area` | `int` | NO | `` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `assisted` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `marker_clocks`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `marker_clocks_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `marker_clocks_business_department_id_foreign`: (`business_department_id`) → `business_departments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `business_department_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `motive` | `varchar(191)` | NO | `` | NULL | `` |  |
| `ip_address` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `marker_registers`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `card` | `varchar(191)` | NO | `` | NULL | `` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `password` | `varchar(191)` | YES | `` | NULL | `` |  |
| `role` | `int unsigned` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `medical_coverages`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `22993`  

- **PK:** `id`

**FK salientes:**

- `medical_coverages_coverage_id_foreign`: (`coverage_id`) → `coverages` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `medical_coverages_insurance_id_foreign`: (`insurance_id`) → `insurances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `medical_coverages_services_doctor_id_foreign`: (`services_doctor_id`) → `services_doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `insurance_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `coverage_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `services_doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `coverage` | `int` | NO | `` | NULL | `` |  |
| `coverage_type` | `int unsigned` | YES | `` | NULL | `` |  |
| `period` | `int unsigned` | YES | `` | NULL | `` |  |
| `waiting_period` | `int unsigned` | YES | `` | NULL | `` |  |
| `quantity` | `int unsigned` | YES | `` | NULL | `` |  |
| `limit_amount` | `int` | YES | `` | NULL | `` |  |
| `group` | `int` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `medical_equipment_dental_offices`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `21`  

- **PK:** `id`

**FK salientes:**

- `medical_equipment_dental_offices_dental_office_id_foreign`: (`dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `medical_equipment_dental_offices_medical_equipment_id_foreign`: (`medical_equipment_id`) → `medical_equipments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `medical_equipment_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `dental_office_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `medical_equipments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `18`  

- **PK:** `id`

**Referenciada por (muestra):**
- `medical_equipment_dental_offices` → `medical_equipments` (`medical_equipment_dental_offices_medical_equipment_id_foreign`)
- `medical_equipments_verifications` → `medical_equipments` (`medical_equipments_verifications_medical_equipment_id_foreign`)

**FK salientes:**

- `medical_equipments_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `varchar(191)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `medical_equipments_verifications`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `medical_equipments_verifications_dental_office_id_foreign`: (`dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `medical_equipments_verifications_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `medical_equipments_verifications_medical_equipment_id_foreign`: (`medical_equipment_id`) → `medical_equipments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `medical_equipments_verifications_ticket_id_foreign`: (`ticket_id`) → `tickets` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `medical_equipments_verifications_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `medical_equipment_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `dental_office_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `type` | `varchar(191)` | YES | `` | NULL | `` |  |
| `box_number` | `int` | YES | `` | NULL | `` |  |
| `service_id` | `int` | YES | `` | NULL | `` |  |
| `description` | `varchar(191)` | YES | `` | NULL | `` |  |
| `ticket_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `migrate_complaints`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `3`  

- **PK:** `id`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `fecha` | `varchar(191)` | YES | `` | NULL | `` |  |
| `empresa` | `varchar(191)` | YES | `` | NULL | `` |  |
| `contrato` | `varchar(191)` | YES | `` | NULL | `` |  |
| `contract_id` | `int` | YES | `` | NULL | `` |  |
| `atencion` | `longtext` | YES | `` | NULL | `` |  |
| `observacion` | `longtext` | YES | `` | NULL | `` |  |
| `complaint_motive_id` | `int` | YES | `` | NULL | `` |  |
| `user_id` | `varchar(191)` | YES | `` | NULL | `` |  |

### `migrations`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1833`  

- **PK:** `id`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `migration` | `varchar(191)` | NO | `` | NULL | `` |  |
| `batch` | `int` | NO | `` | NULL | `` |  |

### `minimum_wage_logs`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `95`  

- **PK:** `id`

**FK salientes:**

- `minimum_wage_logs_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `model_accounting_entries`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `7`  

- **PK:** `id`

**Referenciada por (muestra):**
- `model_accounting_entry_details` → `model_accounting_entries` (`model_accounting_entry_details_model_accounting_entry_id_foreign`)

**FK salientes:**

- `model_accounting_entries_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `social_reason_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `type` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `model_accounting_entry_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `31`  

- **PK:** `id`

**FK salientes:**

- `model_accounting_entry_details_accounting_plan_id_foreign`: (`accounting_plan_id`) → `accounting_plans` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `model_accounting_entry_details_model_accounting_entry_id_foreign`: (`model_accounting_entry_id`) → `model_accounting_entries` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `model_accounting_entry_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `accounting_plan_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `type` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `type_field` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `money_disbursement_payments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `9607`  

- **PK:** `id`

**FK salientes:**

- `money_disbursement_payments_bank_detail_id_foreign`: (`bank_detail_id`) → `bank_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `money_disbursement_payments_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `type` | `int` | NO | `` | NULL | `` |  |
| `bank_detail_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `mpp_sworn_declarations`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2018`  

- **PK:** `id`

**FK salientes:**

- `mpp_sworn_declarations_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `mpp_sworn_declarations_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `mpp_sworn_declarations_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `congenital_diseases` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `palpitations_pressure_fever` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `asthma_hepatitis_lupus` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `hyperthyroidism_obesity_goiter` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `diabetes_cholesterol_triglycerides` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `oncological_history` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `year` | `year` | YES | `` | NULL | `` |  |
| `parkinson_dementia_epilepsies` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `cataracts_sinusitis_lithiasis` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `transplanted_organ` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `pregnant` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `weeks` | `int` | YES | `` | NULL | `` |  |
| `herpes_hiv_hpv` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `covid_19` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `surgical_procedure` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `observation_surgical` | `longtext` | YES | `` | NULL | `` |  |
| `year_surgical` | `date` | YES | `` | NULL | `` |  |
| `receives_medication` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `observation_receives` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `nationalities`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `27`  

- **PK:** `id`

**Referenciada por (muestra):**
- `clients` → `nationalities` (`clients_nationality_id_foreign`)
- `contracts` → `nationalities` (`contracts_nationality_id_spouse_request_foreign`)
- `doctors` → `nationalities` (`doctors_first_representative_nationality_id_foreign`)
- `doctors` → `nationalities` (`doctors_nationality_id_foreign`)
- `doctors` → `nationalities` (`doctors_second_representative_nationality_id_foreign`)
- `people` → `nationalities` (`people_nationality_id_foreign`)

**FK salientes:**

- `nationalities_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |

### `neighborhoods`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `5815`  

- **PK:** `id`

**Referenciada por (muestra):**
- `addresses` → `neighborhoods` (`addresses_neighborhood_id_foreign`)
- `clients_enterprises_addresses` → `neighborhoods` (`clients_enterprises_addresses_neighborhood_id_foreign`)
- `contracts` → `neighborhoods` (`contracts_neighborhood_id_enterprise_request_foreign`)
- `emergency_services` → `neighborhoods` (`emergency_services_neighborhood_id_foreign`)
- `occupational_medicine_files` → `neighborhoods` (`occupational_medicine_files_neighborhood_id_foreign`)
- `people` → `neighborhoods` (`people_neighborhood_id_foreign`)
- `recovery_trackings` → `neighborhoods` (`recovery_trackings_neighborhood_id_foreign`)
- `request_eme_serv_details` → `neighborhoods` (`request_eme_serv_details_neighborhood_id_foreign`)

**FK salientes:**

- `neighborhoods_city_id_foreign`: (`city_id`) → `cities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `city_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `tinyint` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `news`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `news_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `title` | `varchar(191)` | NO | `` | NULL | `` |  |
| `image` | `varchar(191)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `content` | `longtext` | NO | `` | NULL | `` |  |
| `published_at` | `datetime` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |
| `slug` | `varchar(191)` | NO | `` | NULL | `` |  |

### `newsletters`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `124`  

- **PK:** `id`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `email` | `varchar(191)` | NO | `` | NULL | `` |  |
| `ip_address` | `varchar(191)` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `nomencladores`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `158`  

- **PK:** `id`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `type` | `varchar(191)` | YES | `` | NULL | `` |  |
| `service` | `varchar(191)` | YES | `` | NULL | `` |  |
| `cop` | `int` | YES | `` | NULL | `` |  |
| `solo_frenillo` | `int` | YES | `` | NULL | `` |  |
| `estetico` | `int` | YES | `` | NULL | `` |  |
| `autoligable` | `int` | YES | `` | NULL | `` |  |
| `id` | `int` | NO | `PRI` | NULL | `auto_increment` |  |
| `services_doctor_id` | `int` | YES | `` | NULL | `` |  |

### `non_payment_reasons`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `79`  

- **PK:** `id`

**FK salientes:**

- `non_payment_reasons_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `type` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `nuevos_precios_tratamientos`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `309`  

- **PK:** `id`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `price` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `processed` | `tinyint(1)` | YES | `` | 0 | `` |  |
| `services_doctor_id` | `int` | YES | `` | NULL | `` |  |
| `id` | `int` | NO | `PRI` | NULL | `auto_increment` |  |

### `occ_med_client_advances`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `3290`  

- **PK:** `id`

**Referenciada por (muestra):**
- `occ_med_client_payments` → `occ_med_client_advances` (`occ_med_client_payments_advance_id_foreign`)

**FK salientes:**

- `occ_med_client_advances_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occ_med_client_advances_service_invoice_id_foreign`: (`service_invoice_id`) → `service_invoices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occ_med_client_advances_voucher_id_foreign`: (`voucher_id`) → `vouchers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occ_med_client_advances_work_order_id_foreign`: (`work_order_id`) → `occupational_medicine_work_orders` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `work_order_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `voucher_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `service_invoice_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `service_invoice_amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `residue` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `occ_med_client_debts`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `52185`  

- **PK:** `id`

**Referenciada por (muestra):**
- `occ_med_client_debts` → `occ_med_client_debts` (`occ_med_client_debts_pending_invoice_id_foreign`)
- `occ_med_client_payments` → `occ_med_client_debts` (`occ_med_client_payments_debt_id_foreign`)

**FK salientes:**

- `occ_med_client_debts_client_file_status_id_foreign`: (`client_file_status_id`) → `occupational_medicine_client_file_statuses` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occ_med_client_debts_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occ_med_client_debts_file_id_foreign`: (`file_id`) → `occupational_medicine_files` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occ_med_client_debts_pending_invoice_id_foreign`: (`pending_invoice_id`) → `occ_med_client_debts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `file_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `client_file_status_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `pending_invoice_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `residue` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `status` | `int` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `occ_med_client_payments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `24211`  

- **PK:** `id`

**FK salientes:**

- `occ_med_client_payments_advance_id_foreign`: (`advance_id`) → `occ_med_client_advances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occ_med_client_payments_debt_id_foreign`: (`debt_id`) → `occ_med_client_debts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `advance_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `debt_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `occ_med_collection_memo_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2471`  

- **PK:** `id`

**FK salientes:**

- `occ_med_collection_memo_details_file_id_foreign`: (`file_id`) → `occupational_medicine_files` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occ_med_collection_memo_details_memo_id_foreign`: (`memo_id`) → `occ_med_collection_memos` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `memo_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `file_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `patient_status` | `int` | YES | `` | NULL | `` |  |
| `pathology_comment` | `varchar(191)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `occ_med_collection_memos`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `959`  

- **PK:** `id`

**Referenciada por (muestra):**
- `occ_med_collection_memo_details` → `occ_med_collection_memos` (`occ_med_collection_memo_details_memo_id_foreign`)

**FK salientes:**

- `occ_med_collection_memos_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occ_med_collection_memos_confirm_user_id_foreign`: (`confirm_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occ_med_collection_memos_deleted_user_id_foreign`: (`deleted_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occ_med_collection_memos_product_id_foreign`: (`product_id`) → `occupational_medicine_products` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occ_med_collection_memos_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `number` | `int` | NO | `` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `product_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `deleted_motive` | `varchar(191)` | YES | `` | NULL | `` |  |
| `deleted_date` | `datetime` | YES | `` | NULL | `` |  |
| `deleted_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `confirm_status_date` | `datetime` | YES | `` | NULL | `` |  |
| `confirm_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `occ_med_provider_payment_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `occ_med_provider_payment_details_client_file_status_id_foreign`: (`client_file_status_id`) → `occupational_medicine_client_file_statuses` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occ_med_provider_payment_details_provider_payment_id_foreign`: (`provider_payment_id`) → `occ_med_provider_payments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `provider_payment_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `client_file_status_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `occ_med_provider_payments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**Referenciada por (muestra):**
- `occ_med_provider_payment_details` → `occ_med_provider_payments` (`occ_med_provider_payment_details_provider_payment_id_foreign`)

**FK salientes:**

- `occ_med_provider_payments_provider_id_foreign`: (`provider_id`) → `purchases_providers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occ_med_provider_payments_user_delete_id_foreign`: (`user_delete_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occ_med_provider_payments_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `provider_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `user_delete_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `reason_delete` | `longtext` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `occupational_medicine_client_file_statuses`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `814733`  

- **PK:** `id`

**Referenciada por (muestra):**
- `occ_med_client_debts` → `occupational_medicine_client_file_statuses` (`occ_med_client_debts_client_file_status_id_foreign`)
- `occ_med_provider_payment_details` → `occupational_medicine_client_file_statuses` (`occ_med_provider_payment_details_client_file_status_id_foreign`)

**FK salientes:**

- `occupational_medicine_client_file_statuses_can_user_id_foreign`: (`can_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occupational_medicine_client_file_statuses_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occupational_medicine_client_file_statuses_file_id_foreign`: (`file_id`) → `occupational_medicine_files` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occupational_medicine_client_file_statuses_fin_user_id_foreign`: (`fin_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occupational_medicine_client_file_statuses_pro_user_id_foreign`: (`pro_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occupational_medicine_client_file_statuses_provider_id_foreign`: (`provider_id`) → `purchases_providers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occupational_medicine_client_file_statuses_service_id_foreign`: (`service_id`) → `occupational_medicine_services` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occupational_medicine_client_file_statuses_wo_detail_id_foreign`: (`wo_detail_id`) → `occupational_medicine_work_order_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occupational_medicine_client_file_statuses_work_order_id_foreign`: (`work_order_id`) → `occupational_medicine_work_orders` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `file_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `wo_detail_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `work_order_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `service_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `int unsigned` | NO | `` | 0 | `` |  |
| `provider_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `lender_cost` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `sale_price` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `pro_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `process_at` | `datetime` | YES | `` | NULL | `` |  |
| `fin_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `finished_at` | `datetime` | YES | `` | NULL | `` |  |
| `can_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `canceled_at` | `datetime` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `occupational_medicine_doctors`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `24`  

- **PK:** `id`

**Referenciada por (muestra):**
- `occupational_medicine_files` → `occupational_medicine_doctors` (`occupational_medicine_files_doctor_id_foreign`)

**FK salientes:**

- `occupational_medicine_doctors_corresponding_user_id_foreign`: (`corresponding_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occupational_medicine_doctors_provider_id_foreign`: (`provider_id`) → `purchases_providers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occupational_medicine_doctors_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `provider_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `corresponding_user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `occupational_medicine_files`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `102299`  

- **PK:** `id`

**Referenciada por (muestra):**
- `occ_med_client_debts` → `occupational_medicine_files` (`occ_med_client_debts_file_id_foreign`)
- `occ_med_collection_memo_details` → `occupational_medicine_files` (`occ_med_collection_memo_details_file_id_foreign`)
- `occupational_medicine_client_file_statuses` → `occupational_medicine_files` (`occupational_medicine_client_file_statuses_file_id_foreign`)

**FK salientes:**

- `occupational_medicine_files_city_id_foreign`: (`city_id`) → `cities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occupational_medicine_files_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occupational_medicine_files_doctor_id_foreign`: (`doctor_id`) → `occupational_medicine_doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occupational_medicine_files_neighborhood_id_foreign`: (`neighborhood_id`) → `neighborhoods` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occupational_medicine_files_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occupational_medicine_files_work_order_id_foreign`: (`work_order_id`) → `occupational_medicine_work_orders` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `status` | `int` | NO | `` | 1 | `` |  |
| `branch` | `varchar(191)` | YES | `` | NULL | `` |  |
| `query_status` | `int` | NO | `` | NULL | `` |  |
| `status_consulting_clinical_date` | `datetime` | YES | `` | NULL | `` |  |
| `status_clinical_attended_date` | `datetime` | YES | `` | NULL | `` |  |
| `status_consulting_laboratory_date` | `datetime` | YES | `` | NULL | `` |  |
| `status_laboratory_attended_date` | `datetime` | YES | `` | NULL | `` |  |
| `status_consulting_rx_date` | `datetime` | YES | `` | NULL | `` |  |
| `status_rx_attended_date` | `datetime` | YES | `` | NULL | `` |  |
| `work_order_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `client_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `doctor_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `task` | `varchar(191)` | YES | `` | NULL | `` |  |
| `previous_jobs` | `longtext` | YES | `` | NULL | `` |  |
| `cost` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `total_amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `address` | `varchar(191)` | YES | `` | NULL | `` |  |
| `phone_number_prefix` | `varchar(191)` | YES | `` | NULL | `` |  |
| `phone_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `email` | `varchar(191)` | YES | `` | NULL | `` |  |
| `city_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `neighborhood_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `position_optional` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `position_standing` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `position_seated` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `attitude_indifferent` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `attitude_static` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `attitude_dinamic` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `esfuerzo_small` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `esfuerzo_medium` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `esfuerzo_big` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `exposed_area_trunk` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `exposed_area_mmss` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `exposed_area_mmii` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `exposed_area_ears` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `exposed_area_view` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `exposed_area_vocalchords` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `exposed_area_psychointelligent` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `pathological_background_ht_alcohol` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `pathological_background_ht_alcohol_comment` | `longtext` | YES | `` | NULL | `` |  |
| `pathological_background_ht_tobacco` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `pathological_background_ht_tobacco_comment` | `longtext` | YES | `` | NULL | `` |  |
| `pathological_background_af_hta` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `pathological_background_af_diabetes` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `pathological_background_af_cardiac` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `pathological_background_af_mental` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `pathological_background_af_cancer` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `pathological_background_af_other` | `longtext` | YES | `` | NULL | `` |  |
| `pathological_background_surgical_history` | `longtext` | YES | `` | NULL | `` |  |
| `pathological_background_traumatological_history` | `longtext` | YES | `` | NULL | `` |  |
| `pathological_background_vision_with` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `pathological_background_vision_without` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `pathological_background_vision_other` | `longtext` | YES | `` | NULL | `` |  |
| `pathological_background_audition_hear` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `pathological_background_audition_pain` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `pathological_background_audition_other` | `longtext` | YES | `` | NULL | `` |  |
| `other_background_dizziness` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `other_background_headache` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `other_background_seizures` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `other_background_neuropathies` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `other_background_depression` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `other_background_brucellosis` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `other_background_asthma` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `other_background_ulcer_acidity` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `other_background_edema` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `other_background_chest_pain` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `other_background_hta` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `psycho_physical_height` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `psycho_physical_weight` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `psycho_physical_cardiovascular_ta` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_cardiovascular_auscult` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_cardiovascular_pulse` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_cardiovascular_ecg` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_cardiovascular_observation` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_respiratory_orl` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_respiratory_auscul` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_respiratory_rx` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_respiratory_observation` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_scars_operative` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_scars_hernias` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_scars_varicose` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_scars_hemorrhoids` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_scars_other` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_members_function` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_members_amput` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_members_fract` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_members_secuelas` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_members_other` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_column_flexex` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_column_rotac` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_column_ejes` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_radiology_cervicalfp` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_radiology_lumbasfp` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_radiology_torax` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_laboratory_blood` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_laboratory_facgroup` | `varchar(191)` | YES | `` | NULL | `` |  |
| `psycho_physical_laboratory_urine` | `varchar(191)` | YES | `` | NULL | `` |  |
| `suitable` | `int unsigned` | YES | `` | NULL | `` |  |
| `valid` | `int unsigned` | YES | `` | NULL | `` |  |
| `valid_certificate_days` | `int` | YES | `` | NULL | `` |  |
| `exam_observations` | `longtext` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `occupational_medicine_lender_service`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `41`  

- **PK:** `id`

**FK salientes:**

- `occupational_medicine_lender_service_provider_id_foreign`: (`provider_id`) → `purchases_providers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occupational_medicine_lender_service_service_id_foreign`: (`service_id`) → `occupational_medicine_services` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `provider_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `service_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `cost` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `occupational_medicine_lenders`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `occupational_medicine_lenders_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `occupational_medicine_product_service`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `107`  

- **PK:** `id`

**FK salientes:**

- `occupational_medicine_product_service_product_id_foreign`: (`product_id`) → `occupational_medicine_products` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occupational_medicine_product_service_service_id_foreign`: (`service_id`) → `occupational_medicine_services` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `product_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `service_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `price` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `cost` | `decimal(11,2)` | NO | `` | 0.00 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `occupational_medicine_products`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `25`  

- **PK:** `id`

**Referenciada por (muestra):**
- `occ_med_collection_memos` → `occupational_medicine_products` (`occ_med_collection_memos_product_id_foreign`)
- `occupational_medicine_product_service` → `occupational_medicine_products` (`occupational_medicine_product_service_product_id_foreign`)
- `occupational_medicine_work_orders` → `occupational_medicine_products` (`occupational_medicine_work_orders_product_id_foreign`)
- `voucher_details` → `occupational_medicine_products` (`voucher_details_occ_med_product_id_foreign`)

**FK salientes:**

- `occupational_medicine_products_service_invoice_id_foreign`: (`service_invoice_id`) → `service_invoices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occupational_medicine_products_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `service_invoice_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `examen_type` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `occupational_medicine_services`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `179`  

- **PK:** `id`

**Referenciada por (muestra):**
- `occupational_medicine_client_file_statuses` → `occupational_medicine_services` (`occupational_medicine_client_file_statuses_service_id_foreign`)
- `occupational_medicine_lender_service` → `occupational_medicine_services` (`occupational_medicine_lender_service_service_id_foreign`)
- `occupational_medicine_product_service` → `occupational_medicine_services` (`occupational_medicine_product_service_service_id_foreign`)
- `occupational_medicine_work_order_details` → `occupational_medicine_services` (`occupational_medicine_work_order_details_service_id_foreign`)

**FK salientes:**

- `occupational_medicine_services_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `price_cost` | `decimal(11,2)` | NO | `` | 0.00 | `` |  |
| `type` | `int` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `occupational_medicine_work_order_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `28322`  

- **PK:** `id`

**Referenciada por (muestra):**
- `occupational_medicine_client_file_statuses` → `occupational_medicine_work_order_details` (`occupational_medicine_client_file_statuses_wo_detail_id_foreign`)

**FK salientes:**

- `occupational_medicine_work_order_details_service_id_foreign`: (`service_id`) → `occupational_medicine_services` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occupational_medicine_work_order_details_work_order_id_foreign`: (`work_order_id`) → `occupational_medicine_work_orders` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `work_order_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `service_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `type` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `cost` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `price` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `occupational_medicine_work_orders`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `3260`  

- **PK:** `id`

**Referenciada por (muestra):**
- `occ_med_client_advances` → `occupational_medicine_work_orders` (`occ_med_client_advances_work_order_id_foreign`)
- `occupational_medicine_client_file_statuses` → `occupational_medicine_work_orders` (`occupational_medicine_client_file_statuses_work_order_id_foreign`)
- `occupational_medicine_files` → `occupational_medicine_work_orders` (`occupational_medicine_files_work_order_id_foreign`)
- `occupational_medicine_work_order_details` → `occupational_medicine_work_orders` (`occupational_medicine_work_order_details_work_order_id_foreign`)

**FK salientes:**

- `occupational_medicine_work_orders_cancel_user_id_foreign`: (`cancel_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occupational_medicine_work_orders_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occupational_medicine_work_orders_product_id_foreign`: (`product_id`) → `occupational_medicine_products` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occupational_medicine_work_orders_seller_id_foreign`: (`seller_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `occupational_medicine_work_orders_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `seller_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `product_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `advance_invoice` | `int` | YES | `` | NULL | `` |  |
| `coupons` | `int` | YES | `` | NULL | `` |  |
| `actual_coupons` | `int` | YES | `` | NULL | `` |  |
| `percentage_discount` | `int unsigned` | YES | `` | NULL | `` |  |
| `status` | `int unsigned` | NO | `` | 0 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `cancel_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `cancel_observation` | `longtext` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `op_massive_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `14462`  

- **PK:** `id`

**FK salientes:**

- `op_massive_details_op_massive_id_foreign`: (`op_massive_id`) → `op_massives` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `op_massive_details_purchase_id_foreign`: (`purchase_id`) → `purchases` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `op_massive_details_purchase_op_id_foreign`: (`purchase_op_id`) → `purchases` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `op_massive_details_purchases_provider_id_foreign`: (`purchases_provider_id`) → `purchases_providers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `op_massive_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `purchase_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `purchase_op_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `purchases_provider_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `account_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `document_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `reference` | `varchar(191)` | YES | `` | NULL | `` |  |
| `date` | `varchar(191)` | YES | `` | NULL | `` |  |
| `observation` | `varchar(191)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `op_massives`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1238`  

- **PK:** `id`

**Referenciada por (muestra):**
- `op_massive_details` → `op_massives` (`op_massive_details_op_massive_id_foreign`)

**FK salientes:**

- `op_massives_bank_account_id_foreign`: (`bank_account_id`) → `bank_accounts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `op_massives_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `op_massives_currency_id_foreign`: (`currency_id`) → `currencies` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `op_massives_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `op_massives_user_deleted_foreign`: (`user_deleted`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `op_massives_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `bank_account_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `social_reason_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `currency_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `total` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `date_deleted` | `datetime` | YES | `` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `opportunity_campaigns`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `47`  

- **PK:** `id`

**Referenciada por (muestra):**
- `sale_portfolios` → `opportunity_campaigns` (`sale_portfolios_opportunity_campaign_id_foreign`)
- `sales_opportunities` → `opportunity_campaigns` (`sales_opportunities_opportunity_campaign_id_foreign`)
- `sales_opportunity_movements` → `opportunity_campaigns` (`sales_opportunity_movements_new_campaign_id_foreign`)
- `sales_opportunity_movements` → `opportunity_campaigns` (`sales_opportunity_movements_old_campaign_id_foreign`)
- `sales_opportunity_trackings` → `opportunity_campaigns` (`sales_opportunity_trackings_opportunity_campaign_id_foreign`)

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `start_date` | `datetime` | NO | `` | NULL | `` |  |
| `end_date` | `datetime` | NO | `` | NULL | `` |  |
| `daily_goal` | `int` | NO | `` | 0 | `` |  |
| `manage_lead_goal` | `int` | NO | `` | 0 | `` |  |
| `min_calls_before_rejection` | `int` | NO | `` | 0 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `opportunity_management`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `5`  

- **PK:** `id`

**Referenciada por (muestra):**
- `sales_opportunity_trackings` → `opportunity_management` (`sales_opportunity_trackings_opportunity_management_id_foreign`)

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `pagos_tapo`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2804`  

- **PK:** *(no declarada como `PRIMARY` en information_schema)*

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int` | YES | `` | NULL | `` |  |
| `nro` | `int` | YES | `` | NULL | `` |  |
| `fecha` | `varchar(15)` | YES | `` | NULL | `` |  |
| `importe` | `varchar(15)` | YES | `` | NULL | `` |  |
| `payment_id` | `int` | YES | `` | NULL | `` |  |

### `password_resets`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** *(no declarada como `PRIMARY` en information_schema)*

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `email` | `varchar(191)` | NO | `MUL` | NULL | `` |  |
| `token` | `varchar(191)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |

### `patronal_numbers`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `18`  

- **PK:** `id`

**Referenciada por (muestra):**
- `employee_payments` → `patronal_numbers` (`employee_payments_patronal_number_id_foreign`)
- `people` → `patronal_numbers` (`people_patronal_number_id_foreign`)

**FK salientes:**

- `patronal_numbers_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `patronal_numbers_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `social_reason_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `ips_patronal_number` | `varchar(191)` | NO | `` | NULL | `` |  |
| `mtess_patronal_number` | `varchar(191)` | NO | `` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `txt_patronal_number` | `varchar(191)` | YES | `` | NULL | `` |  |

### `paym_serv_auth_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `147667`  

- **PK:** `id`

**FK salientes:**

- `paym_serv_auth_details_client_service_id_foreign`: (`client_service_id`) → `client_services` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `paym_serv_auth_details_payment_services_authorization_id_foreign`: (`payment_services_authorization_id`) → `payment_services_authorizations` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `paym_serv_auth_details_purchase_id_foreign`: (`purchase_id`) → `purchases` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `paym_serv_auth_details_services_authorization_detail_id_foreign`: (`services_authorization_detail_id`) → `services_authorization_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `payment_services_authorization_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `client_service_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `services_authorization_detail_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `detail` | `varchar(191)` | NO | `` | NULL | `` |  |
| `amount` | `int` | NO | `` | NULL | `` |  |
| `purchase_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `payment_methods`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `171`  

- **PK:** `id`

**Referenciada por (muestra):**
- `account_payment_ways` → `payment_methods` (`account_payment_ways_payment_method_id_foreign`)
- `bank_transfers` → `payment_methods` (`bank_transfers_payment_method_id_foreign`)
- `cash_box_payment_methods` → `payment_methods` (`cash_box_payment_methods_payment_method_id_foreign`)
- `collection_incomes` → `payment_methods` (`collection_incomes_payment_method_id_foreign`)
- `contract_fee_tokens` → `payment_methods` (`contract_fee_tokens_payment_method_id_foreign`)
- `voucher_payments` → `payment_methods` (`voucher_payments_payment_method_id_foreign`)

**FK salientes:**

- `payment_methods_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `type` | `int unsigned` | NO | `` | NULL | `` |  |
| `ascont_id` | `int` | YES | `` | NULL | `` |  |
| `commisionable_manager` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `type_method` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `type_method_cobranza` | `int` | YES | `` | NULL | `` |  |
| `fund` | `tinyint unsigned` | YES | `` | NULL | `` |  |
| `pos` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `financing` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `payment_services_authorizations`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `4788`  

- **PK:** `id`

**Referenciada por (muestra):**
- `paym_serv_auth_details` → `payment_services_authorizations` (`paym_serv_auth_details_payment_services_authorization_id_foreign`)
- `purchases` → `payment_services_authorizations` (`purchases_payment_services_authorization_id_foreign`)

**FK salientes:**

- `payment_services_authorizations_doctor_id_foreign`: (`doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `payment_services_authorizations_purchase_id_foreign`: (`purchase_id`) → `purchases` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `payment_services_authorizations_user_deleted_id_foreign`: (`user_deleted_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `payment_services_authorizations_user_finished_id_foreign`: (`user_finished_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `payment_services_authorizations_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `password` | `varchar(191)` | YES | `` | NULL | `` |  |
| `number` | `int` | NO | `` | NULL | `` |  |
| `purchase_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `total_services` | `int` | NO | `` | NULL | `` |  |
| `amount` | `int` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `pending_discount` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `purchase_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `comentary` | `longtext` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_finished_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_deleted_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `reason_deleted` | `longtext` | YES | `` | NULL | `` |  |
| `service_date_started` | `datetime` | YES | `` | NULL | `` |  |
| `service_date_ended` | `datetime` | YES | `` | NULL | `` |  |
| `total_amount_purchases` | `decimal(12,2)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `payments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2178002`  

- **PK:** `id`

**Referenciada por (muestra):**
- `account_payment_ways` → `payments` (`account_payment_ways_payment_id_foreign`)
- `account_payments` → `payments` (`account_payments_payment_id_foreign`)
- `cash_box_details` → `payments` (`cash_box_details_payment_id_foreign`)
- `collection_form_details` → `payments` (`collection_form_details_payment_id_foreign`)
- `commissions` → `payments` (`commissions_payment_id_foreign`)
- `contract_debited_details` → `payments` (`contract_debited_details_payment_id_foreign`)
- `contract_fee_tokens` → `payments` (`contract_fee_tokens_payment_id_foreign`)
- `discount_interests` → `payments` (`discount_interests_payment_id_foreign`)
- `interest_accrual_details` → `payments` (`interest_accrual_details_payment_id_foreign`)
- `vouchers` → `payments` (`vouchers_payment_id_foreign`)

**FK salientes:**

- `payments_address_id_foreign`: (`address_id`) → `addresses` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `payments_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `payments_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `payments_client_portfolios_id_foreign`: (`client_portfolios_id`) → `client_portfolios` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `payments_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `payments_contract_promotion_id_foreign`: (`contract_promotion_id`) → `contract_promotions` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `payments_debt_collector_id_foreign`: (`debt_collector_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `payments_exoneration_reason_id_foreign`: (`exoneration_reason_id`) → `exoneration_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `payments_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `payments_voucher_detail_id_foreign`: (`voucher_detail_id`) → `voucher_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `payments_voucher_id_foreign`: (`voucher_id`) → `vouchers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `voucher_detail_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `voucher` | `int unsigned` | YES | `` | NULL | `` |  |
| `voucher_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `voucher_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `transaction_pronet` | `varchar(191)` | YES | `` | NULL | `` |  |
| `transaction_pago_express` | `varchar(191)` | YES | `` | NULL | `` |  |
| `transaction_infonet` | `varchar(191)` | YES | `` | NULL | `` |  |
| `transaction_practipago` | `varchar(191)` | YES | `` | NULL | `` |  |
| `debt_collector_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `exoneration_reason_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `contract_promotion_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `ascont_id` | `int` | YES | `` | NULL | `` |  |
| `amount` | `decimal(13,2)` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `MUL` | NULL | `` |  |
| `url_invoice` | `varchar(191)` | YES | `` | NULL | `` |  |
| `type` | `tinyint(1)` | NO | `MUL` | 1 | `` |  |
| `client_portfolios_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `address_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `MUL` | 1 | `` |  |
| `json_request` | `longtext` | YES | `` | NULL | `` |  |
| `bankid` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `accounting_seated` | `tinyint(1)` | NO | `` | 0 | `` |  |

### `payroll_salaries`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2560`  

- **PK:** `id`

**Referenciada por (muestra):**
- `payroll_salary_employees` → `payroll_salaries` (`payroll_salary_employees_payroll_salary_id_foreign`)

**FK salientes:**

- `payroll_salaries_confirm_user_id_foreign`: (`confirm_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `payroll_salaries_process_user_id_foreign`: (`process_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `payroll_salaries_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `payroll_salaries_user_deleted_foreign`: (`user_deleted`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `payroll_salaries_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `ips` | `tinyint(1)` | NO | `` | 2 | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `start_period` | `date` | NO | `` | NULL | `` |  |
| `closing_period` | `date` | NO | `` | NULL | `` |  |
| `payment_date` | `datetime` | YES | `` | NULL | `` |  |
| `social_reason_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `type_payroll` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `type_salary` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `total` | `decimal(14,2)` | NO | `` | NULL | `` |  |
| `txt_file` | `longtext` | YES | `` | NULL | `` |  |
| `file_name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `confirm_date` | `datetime` | YES | `` | NULL | `` |  |
| `confirm_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `process_date` | `datetime` | YES | `` | NULL | `` |  |
| `process_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `date_deleted` | `datetime` | YES | `` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `payroll_salary_assistances`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `110825`  

- **PK:** `id`

**FK salientes:**

- `payroll_salary_assistances_employee_assistance_id_foreign`: (`employee_assistance_id`) → `employee_contract_assistances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `payroll_salary_assistances_payroll_salary_employee_id_foreign`: (`payroll_salary_employee_id`) → `payroll_salary_employees` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `payroll_salary_employee_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `employee_assistance_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `payroll_salary_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `102732`  

- **PK:** `id`

**FK salientes:**

- `payroll_salary_details_discount_details_id_foreign`: (`discount_details_id`) → `employee_discount_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `payroll_salary_details_employee_concept_id_foreign`: (`employee_concept_id`) → `employee_concepts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `payroll_salary_details_gratification_details_id_foreign`: (`gratification_details_id`) → `employee_gratification_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `payroll_salary_details_payroll_salary_employee_id_foreign`: (`payroll_salary_employee_id`) → `payroll_salary_employees` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `payroll_salary_details_user_deleted_foreign`: (`user_deleted`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `payroll_salary_employee_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `employee_concept_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `gratification_details_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `discount_details_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `type` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `date_deleted` | `datetime` | YES | `` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `payroll_salary_employees`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `40859`  

- **PK:** `id`

**Referenciada por (muestra):**
- `payroll_salary_assistances` → `payroll_salary_employees` (`payroll_salary_assistances_payroll_salary_employee_id_foreign`)
- `payroll_salary_details` → `payroll_salary_employees` (`payroll_salary_details_payroll_salary_employee_id_foreign`)

**FK salientes:**

- `payroll_salary_employees_employee_contract_id_foreign`: (`employee_contract_id`) → `employee_contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `payroll_salary_employees_employee_payment_id_foreign`: (`employee_payment_id`) → `employee_payments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `payroll_salary_employees_payroll_salary_id_foreign`: (`payroll_salary_id`) → `payroll_salaries` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `payroll_salary_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `employee_contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount_receivable` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `employee_payment_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `worked_days` | `int` | YES | `` | NULL | `` |  |
| `hourly_amount` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `hours` | `int` | YES | `` | NULL | `` |  |
| `night_hours` | `int` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `pendientes_emergencias`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `4914`  

- **PK:** *(no declarada como `PRIMARY` en information_schema)*

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `nro` | `varchar(10)` | YES | `` | NULL | `` |  |
| `fecha` | `varchar(10)` | YES | `` | NULL | `` |  |
| `factura` | `varchar(20)` | YES | `` | NULL | `` |  |
| `ruc` | `varchar(20)` | YES | `` | NULL | `` |  |
| `cliente` | `varchar(100)` | YES | `` | NULL | `` |  |
| `concepto` | `varchar(100)` | YES | `` | NULL | `` |  |
| `saldo` | `varchar(20)` | YES | `` | NULL | `` |  |
| `estado` | `varchar(20)` | YES | `` | NULL | `` |  |

### `pending_claims`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `3759`  

- **PK:** `id`

**FK salientes:**

- `delivery_of_materials_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `delivery_of_materials_delivery_man_id_foreign`: (`delivery_man_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `delivery_of_materials_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `pending_claims_recovery_tracking_id_foreign`: (`recovery_tracking_id`) → `recovery_trackings` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `type` | `int` | NO | `` | NULL | `` |  |
| `delivery_date` | `date` | YES | `` | NULL | `` |  |
| `receiver` | `varchar(191)` | YES | `` | NULL | `` |  |
| `delivery_man_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `int` | YES | `` | NULL | `` |  |
| `recovery_tracking_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `pending_invoices`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `80968`  

- **PK:** `id`

**FK salientes:**

- `pending_invoices_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `pending_invoices_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `pending_invoices_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `pending_invoices_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `pending_invoices_seller_id_foreign`: (`seller_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `pending_invoices_service_invoice_id_foreign`: (`service_invoice_id`) → `service_invoices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `pending_invoices_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `pending_invoices_user_process_id_foreign`: (`user_process_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `pending_invoices_voucher_id_foreign`: (`voucher_id`) → `vouchers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `fromable_id` | `int` | NO | `` | NULL | `` |  |
| `fromable_type` | `varchar(191)` | NO | `` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `service_invoice_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `voucher_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `concept` | `varchar(191)` | NO | `` | NULL | `` |  |
| `reason_exoneration` | `varchar(191)` | YES | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `quantity` | `int` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_process_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `date_process` | `datetime` | YES | `` | NULL | `` |  |
| `seller_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `pending_schedule_trackings`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `213`  

- **PK:** `id`

**FK salientes:**

- `pending_schedule_trackings_pending_schedule_id_foreign`: (`pending_schedule_id`) → `pending_schedules` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `pending_schedule_trackings_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `pending_schedule_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `call_back` | `date` | YES | `` | NULL | `` |  |
| `contact_form` | `int` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `attended` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `pending_schedules`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1303`  

- **PK:** `id`

**Referenciada por (muestra):**
- `pending_schedule_trackings` → `pending_schedules` (`pending_schedule_trackings_pending_schedule_id_foreign`)

**FK salientes:**

- `pending_schedules_agent_id_foreign`: (`agent_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `pending_schedules_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `pending_schedules_calendar_event_id_foreign`: (`calendar_event_id`) → `calendar_events` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `pending_schedules_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `pending_schedules_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `pending_schedules_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `calendar_event_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `document_number` | `varchar(191)` | NO | `` | NULL | `` |  |
| `is_client` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `phone_number` | `varchar(191)` | NO | `` | NULL | `` |  |
| `type_case` | `int` | NO | `` | NULL | `` |  |
| `agent_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `reason_delete` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `int` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `people`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2693`  

- **PK:** `id`

**Referenciada por (muestra):**
- `assistances` → `people` (`assistances_people_id_foreign`)
- `doctor_schedules` → `people` (`doctor_schedules_people_id_foreign`)
- `employee_academic_preparations` → `people` (`employee_academic_preparations_person_id_foreign`)
- `employee_contracts` → `people` (`employee_contracts_people_boss_id_foreign`)
- `employee_contracts` → `people` (`employee_contracts_people_id_foreign`)
- `employee_file_updates` → `people` (`employee_file_updates_people_id_foreign`)
- `employee_files` → `people` (`employee_files_person_id_foreign`)
- `employee_searches` → `people` (`employee_searches_replace_person_id_foreign`)
- `employee_seller_type_commissions` → `people` (`employee_seller_type_commissions_people_id_foreign`)
- `employee_vacations` → `people` (`employee_vacations_people_id_foreign`)
- `engagement_letters` → `people` (`engagement_letters_person_id_foreign`)
- `evaluation_periods` → `people` (`evaluation_period_people_id_foreign`)
- `extra_hours` → `people` (`extra_hours_people_id_foreign`)
- `people` → `people` (`people_people_boss_id_foreign`)
- `people_admission_dates` → `people` (`people_admission_dates_people_id_foreign`)
- `people_cost_centers` → `people` (`people_cost_centers_people_id_foreign`)
- `person_numbers` → `people` (`person_numbers_person_id_foreign`)
- `users` → `people` (`users_person_id_foreign`)
- `vacations` → `people` (`vacations_people_id_foreign`)

**FK salientes:**

- `people_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `people_business_department_id_foreign`: (`business_department_id`) → `business_departments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `people_city_id_foreign`: (`city_id`) → `cities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `people_gerency_id_foreign`: (`gerency_id`) → `gerencies` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `people_job_position_id_foreign`: (`job_position_id`) → `job_positions` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `people_nationality_id_foreign`: (`nationality_id`) → `nationalities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `people_neighborhood_id_foreign`: (`neighborhood_id`) → `neighborhoods` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `people_patronal_number_id_foreign`: (`patronal_number_id`) → `patronal_numbers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `people_people_boss_id_foreign`: (`people_boss_id`) → `people` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `people_work_area_id_foreign`: (`work_area_id`) → `work_areas` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `image` | `varchar(191)` | YES | `` | NULL | `` |  |
| `first_name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `last_name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `type_domain` | `int` | YES | `` | NULL | `` |  |
| `preferred_first_name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `preferred_last_name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `document_number` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `ruc` | `int` | YES | `` | NULL | `` |  |
| `dv` | `int` | YES | `` | NULL | `` |  |
| `license_number` | `int` | YES | `` | NULL | `` |  |
| `email` | `varchar(191)` | YES | `` | NULL | `` |  |
| `dni_expiration` | `date` | NO | `` | NULL | `` |  |
| `patronal_number_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `city_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `neighborhood_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `nationality_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `civil_status` | `int` | NO | `` | NULL | `` |  |
| `birthdate` | `date` | NO | `` | NULL | `` |  |
| `gender` | `int` | NO | `` | NULL | `` |  |
| `job_position_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `work_area_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `business_department_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `people_boss_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `corporate_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `imei_code` | `varchar(191)` | YES | `` | NULL | `` |  |
| `cell_phone_brand` | `varchar(191)` | YES | `` | NULL | `` |  |
| `cell_phone_model` | `varchar(191)` | YES | `` | NULL | `` |  |
| `internal_number` | `int` | YES | `` | NULL | `` |  |
| `corporate_email` | `varchar(191)` | YES | `` | NULL | `` |  |
| `address` | `varchar(191)` | NO | `` | NULL | `` |  |
| `house_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `address_references` | `varchar(191)` | YES | `` | NULL | `` |  |
| `spouse` | `varchar(191)` | YES | `` | NULL | `` |  |
| `spouse_occupation` | `varchar(191)` | YES | `` | NULL | `` |  |
| `children` | `int` | NO | `` | 0 | `` |  |
| `spouse_birthdate` | `date` | YES | `` | NULL | `` |  |
| `spouse_enterprise` | `varchar(191)` | YES | `` | NULL | `` |  |
| `phone_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `movil_phone_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `blood_type` | `varchar(191)` | YES | `` | NULL | `` |  |
| `alergic` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `alergic_comment` | `varchar(191)` | YES | `` | NULL | `` |  |
| `emergency_contact` | `varchar(191)` | YES | `` | NULL | `` |  |
| `emergency_contact_relationship` | `varchar(191)` | YES | `` | NULL | `` |  |
| `emergency_contact_phone_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `emergency_contact_address` | `varchar(191)` | YES | `` | NULL | `` |  |
| `admission_date` | `date` | YES | `` | NULL | `` |  |
| `health_insurance` | `tinyint(1)` | NO | `` | 2 | `` |  |
| `health_insurance_name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `health_insurance_phone` | `varchar(191)` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `schedule_type` | `int` | NO | `` | 1 | `` |  |
| `gerency_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `sync` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `update_file` | `int` | NO | `` | 0 | `` |  |
| `uniform` | `smallint` | YES | `` | NULL | `` |  |
| `tshirt_size` | `varchar(191)` | YES | `` | NULL | `` |  |
| `pants_size` | `varchar(191)` | YES | `` | NULL | `` |  |
| `shoe_size` | `varchar(191)` | YES | `` | NULL | `` |  |
| `location` | `mediumtext` | YES | `` | NULL | `` |  |
| `induction` | `datetime` | YES | `` | NULL | `` |  |

### `people_admission_dates`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2826`  

- **PK:** `id`

**FK salientes:**

- `people_admission_dates_people_id_foreign`: (`people_id`) → `people` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `people_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `admission_date` | `date` | NO | `` | NULL | `` |  |
| `deleted_at` | `datetime` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `people_cost_centers`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `167`  

- **PK:** `id`

**FK salientes:**

- `people_cost_centers_cost_center_id_foreign`: (`cost_center_id`) → `cost_centers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `people_cost_centers_people_id_foreign`: (`people_id`) → `people` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `people_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `cost_center_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `permission_role`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `21624`  

- **PK:** `permission_id, role_id`

**FK salientes:**

- `permission_role_permission_id_foreign`: (`permission_id`) → `permissions` (`id`) ON UPDATE CASCADE / ON DELETE CASCADE
- `permission_role_role_id_foreign`: (`role_id`) → `roles` (`id`) ON UPDATE CASCADE / ON DELETE CASCADE

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `permission_id` | `int unsigned` | NO | `PRI` | NULL | `` |  |
| `role_id` | `int unsigned` | NO | `PRI` | NULL | `` |  |

### `permission_user`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `14006`  

- **PK:** `user_id, permission_id, user_type`

**FK salientes:**

- `permission_user_permission_id_foreign`: (`permission_id`) → `permissions` (`id`) ON UPDATE CASCADE / ON DELETE CASCADE
- `permission_user_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE CASCADE / ON DELETE CASCADE

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `permission_id` | `int unsigned` | NO | `PRI` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `PRI` | NULL | `` |  |
| `user_type` | `varchar(191)` | NO | `PRI` | NULL | `` |  |

### `permissions`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1643`  

- **PK:** `id`

**Referenciada por (muestra):**
- `permission_role` → `permissions` (`permission_role_permission_id_foreign`)
- `permission_user` → `permissions` (`permission_user_permission_id_foreign`)

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `UNI` | NULL | `` |  |
| `display_name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `description` | `varchar(191)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `person_numbers`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `694`  

- **PK:** `id`

**FK salientes:**

- `person_numbers_person_id_foreign`: (`person_id`) → `people` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `person_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `prefix` | `varchar(191)` | NO | `` | NULL | `` |  |
| `number` | `varchar(191)` | NO | `` | NULL | `` |  |
| `number_without_prefix` | `varchar(191)` | NO | `` | NULL | `` |  |
| `observation` | `varchar(191)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `phone_callbacks`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1483`  

- **PK:** `id`

**FK salientes:**

- `phone_callbacks_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `phone_callbacks_completed_user_id_foreign`: (`completed_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `phone_callbacks_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `number` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `completed_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `phone_numbers`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `417547`  

- **PK:** `id`

**Referenciada por (muestra):**
- `bancard_cards` → `phone_numbers` (`bancard_cards_phone_number_id_foreign`)

**FK salientes:**

- `phone_numbers_ibfk_1`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `prefix` | `varchar(191)` | YES | `` | NULL | `` |  |
| `number_without_prefix` | `varchar(191)` | YES | `` | NULL | `` |  |
| `number` | `varchar(191)` | NO | `` | NULL | `` |  |
| `inactive` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `type_number` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `has_whatsapp` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `turns` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `place_services`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `76`  

- **PK:** `id`

**Referenciada por (muestra):**
- `emergency_guard_exceptions` → `place_services` (`emergency_guard_exceptions_place_service_id_foreign`)
- `emergency_guards` → `place_services` (`emergency_guards_place_service_id_foreign`)
- `emergency_teams` → `place_services` (`emergency_teams_place_service_id_foreign`)
- `employee_contract_activities` → `place_services` (`employee_contract_activities_place_service_id_foreign`)
- `employee_contract_assistances` → `place_services` (`employee_contract_assistances_place_service_id_foreign`)

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `polls_services`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `17243`  

- **PK:** `id`

**Referenciada por (muestra):**
- `cases_to_calls_trackings` → `polls_services` (`cases_to_calls_trackings_polls_service_id_foreign`)

**FK salientes:**

- `polls_services_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `polls_services_calendar_event_id_foreign`: (`calendar_event_id`) → `calendar_events` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `polls_services_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `polls_services_dental_office_id_foreign`: (`dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `polls_services_doctor_id_foreign`: (`doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `polls_services_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `polls_services_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `calendar_event_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `phone_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `branch_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `doctor_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `dental_office_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `poll_1` | `int` | YES | `` | NULL | `` |  |
| `poll_2` | `int` | YES | `` | NULL | `` |  |
| `poll_3` | `int` | YES | `` | NULL | `` |  |
| `poll_4` | `int` | YES | `` | NULL | `` |  |
| `poll_4_califications` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `poll_5` | `int unsigned` | YES | `` | NULL | `` |  |
| `recomendation` | `int` | YES | `` | NULL | `` |  |
| `coment_poll_2` | `longtext` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `type` | `int` | NO | `` | 1 | `` |  |
| `comentary` | `longtext` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `portfolio_assignment_config_enterprise`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `158`  

- **PK:** `id`

**FK salientes:**

- `portfolio_assignment_config_enterprise_configuration_id_foreign`: (`configuration_id`) → `portfolio_assignment_configurations` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `portfolio_assignment_config_enterprise_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `configuration_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `portfolio_assignment_configuration_user`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `163`  

- **PK:** `id`

**FK salientes:**

- `portfolio_assignment_configuration_user_configuration_id_foreign`: (`configuration_id`) → `portfolio_assignment_configurations` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `portfolio_assignment_configuration_user_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `configuration_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `portfolio_assignment_configurations`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `172`  

- **PK:** `id`

**Referenciada por (muestra):**
- `portfolio_assignment_config_enterprise` → `portfolio_assignment_configurations` (`portfolio_assignment_config_enterprise_configuration_id_foreign`)
- `portfolio_assignment_configuration_user` → `portfolio_assignment_configurations` (`portfolio_assignment_configuration_user_configuration_id_foreign`)

**FK salientes:**

- `portfolio_assignment_configurations_client_portfolio_id_foreign`: (`client_portfolio_id`) → `client_portfolios` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `portfolio_assignment_configurations_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `from_tramo` | `smallint` | NO | `` | NULL | `` |  |
| `until_tramo` | `smallint` | NO | `` | NULL | `` |  |
| `limit_per_user` | `smallint` | NO | `` | NULL | `` |  |
| `assignment_type` | `enum('fija','variable')` | NO | `` | NULL | `` |  |
| `client_portfolio_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `incluir_cobrador` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `incluir_debito` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `active` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `last_processed_at` | `datetime` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |

### `portfolio_filters`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `portfolio_filters_clientportfolio_id_foreign`: (`clientportfolio_id`) → `client_portfolios` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `clientportfolio_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `portfolio_movements`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `111186`  

- **PK:** `id`

**FK salientes:**

- `portfolio_movements_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `portfolio_movements_destination_portfolio_id_foreign`: (`destination_portfolio_id`) → `client_portfolios` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `portfolio_movements_origin_portfolio_id_foreign`: (`origin_portfolio_id`) → `client_portfolios` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `portfolio_movements_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `type` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `origin_portfolio_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `destination_portfolio_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `reason` | `mediumtext` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `price_update_logs`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `224902`  

- **PK:** `id`

**FK salientes:**

- `price_update_logs_purchases_product_id_foreign`: (`purchases_product_id`) → `purchases_products` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `price_update_logs_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `social_reason_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `datetime` | `datetime` | NO | `` | NULL | `` |  |
| `purchases_product_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `price_cost` | `decimal(13,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `procedures`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `119`  

- **PK:** `id`

**Referenciada por (muestra):**
- `calendar_events_doctor_services` → `procedures` (`calendar_events_doctor_services_procedure_id_foreign`)
- `service_doctor_procedures` → `procedures` (`service_doctor_procedures_procedure_id_foreign`)

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `duration` | `int` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `product_money_loans`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `48`  

- **PK:** `id`

**Referenciada por (muestra):**
- `collection_forms` → `product_money_loans` (`collection_forms_product_money_loan_id_foreign`)
- `contracts` → `product_money_loans` (`contracts_product_money_loan_id_foreign`)

**FK salientes:**

- `product_money_loans_cuotera_id_foreign`: (`cuotera_id`) → `cuoteras` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `product_money_loans_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `cuotera_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `percentage_rate` | `decimal(5,2)` | YES | `` | NULL | `` |  |
| `days_for_first_expiration` | `int` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `is_aso` | `tinyint(1)` | NO | `` | 0 | `` |  |

### `product_stocks`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `product_stocks_esth_treatment_id_foreign`: (`esth_treatment_id`) → `esth_treatments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `availability` | `int` | NO | `` | NULL | `` |  |
| `esth_treatment_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `productos_ctacontable`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `5869`  

- **PK:** *(no declarada como `PRIMARY` en information_schema)*

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int` | YES | `` | NULL | `` |  |
| `name` | `varchar(80)` | YES | `` | NULL | `` |  |
| `cuenta_gastos_idem` | `varchar(100)` | YES | `` | NULL | `` |  |
| `cuenta_gastos_infoco` | `varchar(100)` | YES | `` | NULL | `` |  |
| `cuenta_activo_idem` | `varchar(100)` | YES | `` | NULL | `` |  |
| `cuenta_activo_infoco` | `varchar(100)` | YES | `` | NULL | `` |  |
| `cuenta_gastos_idem_id` | `int` | YES | `` | NULL | `` |  |
| `cuenta_gastos_infoco_id` | `int` | YES | `` | NULL | `` |  |
| `cuenta_activo_idem_id` | `int` | YES | `` | NULL | `` |  |
| `cuenta_activo_infoco_id` | `int` | YES | `` | NULL | `` |  |

### `professionals`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1937`  

- **PK:** `id`

**Referenciada por (muestra):**
- `especiality_professional` → `professionals` (`especiality_professional_professional_id_foreign`)

**FK salientes:**

- `professionals_provider_id_foreign`: (`provider_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `provider_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `name` | `text` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `promotion_services_doctors_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `641`  

- **PK:** `id`

**FK salientes:**

- `promotion_services_doctors_details_contract_promotion_id_foreign`: (`contract_promotion_id`) → `contract_promotions` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `promotion_services_doctors_details_services_doctor_id_foreign`: (`services_doctor_id`) → `services_doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_promotion_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `services_doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `quantity_services_doctor` | `int` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `doctor_commision` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `group` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `prosthesis_laboratories`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**Referenciada por (muestra):**
- `prosthesis_laboratories` → `prosthesis_laboratories` (`prosthesis_laboratories_prosthesis_laboratory_id_foreign`)

**FK salientes:**

- `prosthesis_laboratories_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `prosthesis_laboratories_client_service_id_foreign`: (`client_service_id`) → `client_services` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `prosthesis_laboratories_deleted_user_id_foreign`: (`deleted_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `prosthesis_laboratories_dental_budget_id_foreign`: (`dental_budget_id`) → `dental_budgets` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `prosthesis_laboratories_dental_office_id_foreign`: (`dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `prosthesis_laboratories_doctor_id_foreign`: (`doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `prosthesis_laboratories_finish_user_id_foreign`: (`finish_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `prosthesis_laboratories_laboratory_id_foreign`: (`laboratory_id`) → `laboratories` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `prosthesis_laboratories_laboratory_job_id_foreign`: (`laboratory_job_id`) → `laboratory_jobs` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `prosthesis_laboratories_patient_id_foreign`: (`patient_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `prosthesis_laboratories_prosthesis_laboratory_id_foreign`: (`prosthesis_laboratory_id`) → `prosthesis_laboratories` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `prosthesis_laboratories_received_user_id_foreign`: (`received_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `prosthesis_laboratories_return_user_id_foreign`: (`return_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `prosthesis_laboratories_sent_user_id_foreign`: (`sent_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `prosthesis_laboratories_services_doctor_id_foreign`: (`services_doctor_id`) → `services_doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `prosthesis_laboratories_shipping_user_id_foreign`: (`shipping_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `prosthesis_laboratories_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `laboratory_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `laboratory_job_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `services_doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `doctor_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `dental_office_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `client_service_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `dental_budget_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `client_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `prosthesis_laboratory_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `patient_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `patient_name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `tooth_piece` | `varchar(191)` | YES | `` | NULL | `` |  |
| `colour` | `varchar(191)` | YES | `` | NULL | `` |  |
| `deliver_date` | `date` | YES | `` | NULL | `` |  |
| `price_sale` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `int unsigned` | NO | `` | NULL | `` |  |
| `sent_at` | `datetime` | YES | `` | NULL | `` |  |
| `sent_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `received_at` | `datetime` | YES | `` | NULL | `` |  |
| `received_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `finish_at` | `datetime` | YES | `` | NULL | `` |  |
| `finish_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `shipping_at` | `datetime` | YES | `` | NULL | `` |  |
| `shipping_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `return_at` | `datetime` | YES | `` | NULL | `` |  |
| `return_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `deleted_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `deleted_motive` | `longtext` | YES | `` | NULL | `` |  |
| `deleted_at` | `datetime` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `prosthesis_laboratory_retirements`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `prosthesis_laboratory_retirements_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `prosthesis_laboratory_retirements_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `client_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `client_name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `address` | `varchar(191)` | YES | `` | NULL | `` |  |
| `phone` | `varchar(191)` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `provider_autorizathion_payment_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `provider_autorizathion_payment_id` | `int unsigned` | NO | `` | NULL | `` |  |
| `purchases_collect_id` | `int unsigned` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `provider_autorizathion_payments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `provider_autorizathion_payments_currency_id_foreign`: (`currency_id`) → `currencies` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `provider_autorizathion_payments_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `provider_autorizathion_payments_user_deleted_foreign`: (`user_deleted`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `provider_autorizathion_payments_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `social_reason_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `currency_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `date_deleted` | `datetime` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `purchase_receipts`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `6963`  

- **PK:** `id`

**Referenciada por (muestra):**
- `receipt_purchases_pending` → `purchase_receipts` (`receipt_purchases_pending_purchase_receipt_id_foreign`)

**FK salientes:**

- `purchase_receipts_user_delete_id_foreign`: (`user_delete_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchase_receipts_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `number` | `varchar(191)` | NO | `` | NULL | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | 0.00 | `` |  |
| `file` | `varchar(191)` | YES | `` | NULL | `` |  |
| `file_original_name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_delete_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `reason_delete` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `purchases`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `197673`  

- **PK:** `id`

**Referenciada por (muestra):**
- `calendar_payments` → `purchases` (`calendar_payments_purchase_id_foreign`)
- `op_massive_details` → `purchases` (`op_massive_details_purchase_id_foreign`)
- `op_massive_details` → `purchases` (`op_massive_details_purchase_op_id_foreign`)
- `paym_serv_auth_details` → `purchases` (`paym_serv_auth_details_purchase_id_foreign`)
- `payment_services_authorizations` → `purchases` (`payment_services_authorizations_purchase_id_foreign`)
- `purchases_accounting_plans` → `purchases` (`purchases_accounting_plans_purchase_id_foreign`)
- `purchases_advances` → `purchases` (`purchases_advances_purchase_advance_id_foreign`)
- `purchases_advances` → `purchases` (`purchases_advances_purchase_id_foreign`)
- `purchases_collect_payments` → `purchases` (`purchases_collect_payments_purchase_id_foreign`)
- `purchases_collects` → `purchases` (`purchases_collects_purchase_id_foreign`)
- `purchases_cost_centers` → `purchases` (`purchases_cost_centers_purchase_id_foreign`)
- `purchases_details` → `purchases` (`purchases_details_purchase_id_foreign`)
- `purchases_movements` → `purchases` (`purchases_movements_purchase_id_foreign`)
- `purchases_note_credits` → `purchases` (`purchases_note_credits_purchase_id_foreign`)
- `purchases_note_credits` → `purchases` (`purchases_note_credits_purchase_invoice_id_foreign`)
- `purchases_payments` → `purchases` (`purchases_payments_purchase_id_foreign`)
- `purchases_pending_receipts` → `purchases` (`purchases_pending_receipts_purchase_id_foreign`)
- `tapo_idem_fees` → `purchases` (`tapo_idem_fees_purchase_id_foreign`)

**FK salientes:**

- `purchases_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_cancel_user_id_foreign`: (`cancel_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_cash_box_id_foreign`: (`cash_box_id`) → `cash_boxes` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_currency_id_foreign`: (`currency_id`) → `currencies` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_payment_services_authorization_id_foreign`: (`payment_services_authorization_id`) → `payment_services_authorizations` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_purchases_provider_id_foreign`: (`purchases_provider_id`) → `purchases_providers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_received_user_id_foreign`: (`received_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_user_deleted_foreign`: (`user_deleted`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `first_expiration` | `date` | YES | `` | NULL | `` |  |
| `type` | `tinyint unsigned` | NO | `` | NULL | `` |  |
| `fiscal_credit` | `int` | YES | `` | NULL | `` |  |
| `electronic_document` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `social_reason_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `currency_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `change` | `int` | YES | `` | NULL | `` |  |
| `condition` | `tinyint unsigned` | NO | `` | NULL | `` |  |
| `is_paid` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `number` | `varchar(191)` | NO | `` | NULL | `` |  |
| `stamped` | `varchar(191)` | YES | `` | NULL | `` |  |
| `stamped_validity` | `date` | YES | `` | NULL | `` |  |
| `purchases_provider_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `provider_type` | `smallint` | YES | `` | NULL | `` |  |
| `payment_services_authorization_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `razon_social` | `varchar(191)` | NO | `` | NULL | `` |  |
| `ruc` | `varchar(191)` | NO | `` | NULL | `` |  |
| `phone` | `varchar(191)` | YES | `` | NULL | `` |  |
| `address` | `varchar(191)` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `amount_paid` | `decimal(11,2)` | NO | `` | 0.00 | `` |  |
| `advance` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `cash_box_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `total_excenta` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `total_iva5` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `total_iva10` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `amount_iva5` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `amount_iva10` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `cancel_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `canceled_at` | `datetime` | YES | `` | NULL | `` |  |
| `reason_canceled` | `varchar(191)` | YES | `` | NULL | `` |  |
| `date_deleted` | `datetime` | YES | `` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `invoice_copy` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `received_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `received_date` | `date` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `file` | `varchar(191)` | YES | `` | NULL | `` |  |
| `accounting_seated` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `request_json` | `longtext` | YES | `` | NULL | `` |  |

### `purchases_accounting_plans`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `331238`  

- **PK:** `id`

**FK salientes:**

- `purchases_accounting_plans_accounting_plan_id_foreign`: (`accounting_plan_id`) → `accounting_plans` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_accounting_plans_bank_detail_id_foreign`: (`bank_detail_id`) → `bank_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_accounting_plans_purchase_id_foreign`: (`purchase_id`) → `purchases` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `purchase_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `accounting_plan_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `bank_detail_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `type` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `purchases_advances`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `5049`  

- **PK:** `id`

**FK salientes:**

- `purchases_advances_purchase_advance_id_foreign`: (`purchase_advance_id`) → `purchases` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_advances_purchase_id_foreign`: (`purchase_id`) → `purchases` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `purchase_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `purchase_advance_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `purchases_categories`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `32`  

- **PK:** `id`

**Referenciada por (muestra):**
- `purchases_product_inventories` → `purchases_categories` (`purchases_product_inventories_purchases_category_id_foreign`)
- `purchases_products` → `purchases_categories` (`purchases_products_purchases_category_id_foreign`)

**FK salientes:**

- `purchases_categories_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `stockeable` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `purchases_collect_payments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `81033`  

- **PK:** `id`

**FK salientes:**

- `purchases_collect_payments_purchase_id_foreign`: (`purchase_id`) → `purchases` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_collect_payments_purchases_collect_id_foreign`: (`purchases_collect_id`) → `purchases_collects` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `purchase_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `purchases_collect_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `purchases_collects`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `87162`  

- **PK:** `id`

**Referenciada por (muestra):**
- `calendar_payments` → `purchases_collects` (`calendar_payments_purchases_collect_id_foreign`)
- `purchases_collect_payments` → `purchases_collects` (`purchases_collect_payments_purchases_collect_id_foreign`)
- `purchases_pending_receipts` → `purchases_collects` (`purchases_pending_receipts_purchases_collect_id_foreign`)

**FK salientes:**

- `purchases_collects_purchase_id_foreign`: (`purchase_id`) → `purchases` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `purchase_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `number` | `int` | NO | `` | NULL | `` |  |
| `expiration` | `date` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `residue` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `purchases_cost_centers`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `141095`  

- **PK:** `id`

**FK salientes:**

- `purchases_cost_centers_cost_center_id_foreign`: (`cost_center_id`) → `cost_centers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_cost_centers_purchase_id_foreign`: (`purchase_id`) → `purchases` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `purchase_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `cost_center_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `percentage` | `decimal(3,0)` | YES | `` | NULL | `` |  |
| `amount` | `decimal(12,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `purchases_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `182331`  

- **PK:** `id`

**FK salientes:**

- `purchases_details_accounting_plan_id_foreign`: (`accounting_plan_id`) → `accounting_plans` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_details_emergency_mobile_id_foreign`: (`emergency_mobile_id`) → `emergency_mobiles` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_details_purchase_id_foreign`: (`purchase_id`) → `purchases` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_details_purchases_order_detail_id_foreign`: (`purchases_order_detail_id`) → `purchases_order_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_details_purchases_product_id_foreign`: (`purchases_product_id`) → `purchases_products` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `purchase_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `purchases_product_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `accounting_plan_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `purchases_order_detail_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `emergency_mobile_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `description` | `varchar(191)` | NO | `` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `discount_amount` | `decimal(12,2)` | YES | `` | NULL | `` |  |
| `excenta` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `iva5` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `iva10` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `purchases_existences`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `68350`  

- **PK:** `id`

**Referenciada por (muestra):**
- `purchases_movement_details` → `purchases_existences` (`purchases_movement_details_purchases_existence_id_foreign`)
- `voucher_detail_existences` → `purchases_existences` (`voucher_detail_existences_purchases_existence_id_foreign`)

**FK salientes:**

- `purchases_existences_deposit_id_foreign`: (`deposit_id`) → `deposits` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_existences_purchases_product_id_foreign`: (`purchases_product_id`) → `purchases_products` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_existences_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `purchases_product_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `social_reason_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `expiration_date` | `datetime` | YES | `` | NULL | `` |  |
| `deposit_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `residue` | `int` | YES | `` | NULL | `` |  |
| `price_cost` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `price_cost_iva` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `purchases_movement_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `265130`  

- **PK:** `id`

**FK salientes:**

- `purchases_movement_details_purchases_existence_id_foreign`: (`purchases_existence_id`) → `purchases_existences` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_movement_details_purchases_movements_id_foreign`: (`purchases_movements_id`) → `purchases_movements` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_movement_details_purchases_order_detail_id_foreign`: (`purchases_order_detail_id`) → `purchases_order_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_movement_details_purchases_product_id_foreign`: (`purchases_product_id`) → `purchases_products` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_movement_details_restocking_detail_id_foreign`: (`restocking_detail_id`) → `restocking_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `purchases_movements_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `purchases_existence_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `purchases_product_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `purchases_order_detail_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `restocking_detail_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `price_cost` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `affects_stock` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `purchases_movements`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `84908`  

- **PK:** `id`

**Referenciada por (muestra):**
- `purchases_movement_details` → `purchases_movements` (`purchases_movement_details_purchases_movements_id_foreign`)
- `purchases_movements` → `purchases_movements` (`purchases_movements_movements_destiny_id_foreign`)

**FK salientes:**

- `purchases_movements_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_movements_currency_id_foreign`: (`currency_id`) → `currencies` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_movements_deposit_destiny_id_foreign`: (`deposit_destiny_id`) → `deposits` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_movements_deposits_id_foreign`: (`deposits_id`) → `deposits` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_movements_doctor_id_foreign`: (`doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_movements_movements_destiny_id_foreign`: (`movements_destiny_id`) → `purchases_movements` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_movements_purchase_id_foreign`: (`purchase_id`) → `purchases` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_movements_purchases_department_id_foreign`: (`purchases_department_id`) → `purchases_requesting_departments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_movements_purchases_product_inventory_id_foreign`: (`purchases_product_inventory_id`) → `purchases_product_inventories` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_movements_user_deleted_foreign`: (`user_deleted`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_movements_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `deposits_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `deposit_destiny_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `movements_destiny_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `purchases_department_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `purchases_product_inventory_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `doctor_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `type_operation` | `int` | NO | `` | NULL | `` |  |
| `type_movement` | `int` | NO | `` | NULL | `` |  |
| `recived_person` | `varchar(191)` | YES | `` | NULL | `` |  |
| `branch_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `currency_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `invoice_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `purchase_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `invoice_condition` | `int` | YES | `` | NULL | `` |  |
| `invoice_date` | `date` | YES | `` | NULL | `` |  |
| `invoice_stamped` | `int` | YES | `` | NULL | `` |  |
| `stamp_validity` | `date` | YES | `` | NULL | `` |  |
| `date_payment` | `date` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `date_deleted` | `datetime` | YES | `` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `accounting_seated` | `tinyint(1)` | NO | `` | 0 | `` |  |

### `purchases_note_credits`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1028`  

- **PK:** `id`

**FK salientes:**

- `purchases_note_credits_purchase_id_foreign`: (`purchase_id`) → `purchases` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_note_credits_purchase_invoice_id_foreign`: (`purchase_invoice_id`) → `purchases` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `purchase_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `purchase_invoice_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `purchases_order_cost_centers`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `33864`  

- **PK:** `id`

**FK salientes:**

- `purchases_order_cost_centers_cost_center_id_foreign`: (`cost_center_id`) → `cost_centers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_order_cost_centers_purchases_order_id_foreign`: (`purchases_order_id`) → `purchases_orders` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `purchases_order_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `cost_center_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `percentage` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `purchases_order_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `61249`  

- **PK:** `id`

**Referenciada por (muestra):**
- `purchases_details` → `purchases_order_details` (`purchases_details_purchases_order_detail_id_foreign`)
- `purchases_movement_details` → `purchases_order_details` (`purchases_movement_details_purchases_order_detail_id_foreign`)

**FK salientes:**

- `purchases_order_details_emergency_mobile_id_foreign`: (`emergency_mobile_id`) → `emergency_mobiles` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_order_details_product_presentations_id_foreign`: (`product_presentations_id`) → `purchases_product_presentations` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_order_details_purchases_order_id_foreign`: (`purchases_order_id`) → `purchases_orders` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_order_details_purchases_product_id_foreign`: (`purchases_product_id`) → `purchases_products` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_order_details_restocking_detail_id_foreign`: (`restocking_detail_id`) → `restocking_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `purchases_order_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `purchases_product_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `product_presentations_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `restocking_detail_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `emergency_mobile_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `description` | `varchar(191)` | NO | `` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `quantity_received` | `int` | YES | `` | NULL | `` |  |
| `residue` | `int` | NO | `` | NULL | `` |  |
| `quantity_cereada` | `varchar(191)` | NO | `` | 0 | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `exenta` | `decimal(11,2)` | NO | `` | 0.00 | `` |  |
| `cost_Iva10` | `decimal(11,2)` | NO | `` | 0.00 | `` |  |
| `iva10` | `decimal(11,2)` | NO | `` | 0.00 | `` |  |
| `cost_Iva5` | `decimal(11,2)` | NO | `` | 0.00 | `` |  |
| `iva5` | `decimal(11,2)` | NO | `` | 0.00 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `purchases_orders`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `29951`  

- **PK:** `id`

**Referenciada por (muestra):**
- `purchases_order_cost_centers` → `purchases_orders` (`purchases_order_cost_centers_purchases_order_id_foreign`)
- `purchases_order_details` → `purchases_orders` (`purchases_order_details_purchases_order_id_foreign`)

**FK salientes:**

- `purchases_orders_authorized_user_id_foreign`: (`authorized_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_orders_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_orders_controlled_user_id_foreign`: (`controlled_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_orders_currency_id_foreign`: (`currency_id`) → `currencies` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_orders_purchases_provider_id_foreign`: (`purchases_provider_id`) → `purchases_providers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_orders_requesting_departments_id_foreign`: (`requesting_departments_id`) → `purchases_requesting_departments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_orders_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_orders_user_deleted_foreign`: (`user_deleted`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_orders_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_orders_verified_user_id_foreign`: (`verified_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `number` | `int` | NO | `` | NULL | `` |  |
| `social_reason_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `requesting_departments_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `requested_by` | `varchar(191)` | YES | `` | NULL | `` |  |
| `currency_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `change` | `int` | NO | `` | NULL | `` |  |
| `condition` | `tinyint unsigned` | NO | `` | NULL | `` |  |
| `purchases_provider_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `razon_social` | `varchar(191)` | NO | `` | NULL | `` |  |
| `ruc` | `varchar(191)` | NO | `` | NULL | `` |  |
| `phone` | `varchar(191)` | YES | `` | NULL | `` |  |
| `address` | `varchar(191)` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `image` | `varchar(191)` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `authorized_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `verified_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `controlled_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `date_deleted` | `datetime` | YES | `` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `authorized_date` | `datetime` | YES | `` | NULL | `` |  |
| `verified_date` | `datetime` | YES | `` | NULL | `` |  |
| `controlled_date` | `datetime` | YES | `` | NULL | `` |  |

### `purchases_payments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `103293`  

- **PK:** `id`

**FK salientes:**

- `purchases_payments_bank_detail_id_foreign`: (`bank_detail_id`) → `bank_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_payments_purchase_id_foreign`: (`purchase_id`) → `purchases` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `purchase_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `type` | `tinyint unsigned` | NO | `` | NULL | `` |  |
| `bank_detail_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `purchases_pending_receipts`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `23604`  

- **PK:** `id`

**Referenciada por (muestra):**
- `receipt_purchases_pending` → `purchases_pending_receipts` (`receipt_purchases_pending_purchases_pending_receipt_id_foreign`)

**FK salientes:**

- `purchases_pending_receipts_purchase_id_foreign`: (`purchase_id`) → `purchases` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_pending_receipts_purchases_collect_id_foreign`: (`purchases_collect_id`) → `purchases_collects` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `purchase_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `purchases_collect_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `residue` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `purchases_product_brands`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `76`  

- **PK:** `id`

**Referenciada por (muestra):**
- `purchases_products` → `purchases_product_brands` (`purchases_products_purchases_product_brand_id_foreign`)

**FK salientes:**

- `purchases_product_brands_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `purchases_product_costs`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `9500`  

- **PK:** `id`

**FK salientes:**

- `purchases_product_costs_purchases_product_id_foreign`: (`purchases_product_id`) → `purchases_products` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_product_costs_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `social_reason_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `purchases_product_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `price_cost` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `quantity` | `int` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `purchases_product_inventories`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `746`  

- **PK:** `id`

**Referenciada por (muestra):**
- `purchases_movements` → `purchases_product_inventories` (`purchases_movements_purchases_product_inventory_id_foreign`)
- `purchases_product_inventory_details` → `purchases_product_inventories` (`purchases_product_inventory_details_inventory_id_foreign`)

**FK salientes:**

- `purchases_product_inventories_deposit_destiny_id_foreign`: (`deposit_destiny_id`) → `deposits` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_product_inventories_deposit_id_foreign`: (`deposit_id`) → `deposits` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_product_inventories_purchases_category_id_foreign`: (`purchases_category_id`) → `purchases_categories` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_product_inventories_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_product_inventories_user_deleted_id_foreign`: (`user_deleted_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_product_inventories_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `social_reason_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `purchases_category_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `deposit_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `deposit_destiny_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `int` | NO | `` | 1 | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_deleted_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `date_deleted` | `datetime` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `purchases_product_inventory_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `310298`  

- **PK:** `id`

**FK salientes:**

- `purchases_product_inventory_details_inventory_id_foreign`: (`inventory_id`) → `purchases_product_inventories` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_product_inventory_details_product_id_foreign`: (`product_id`) → `purchases_products` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `inventory_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `product_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `existence` | `int` | NO | `` | NULL | `` |  |
| `old_cost` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `purchases_product_minimums`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `3`  

- **PK:** `id`

**FK salientes:**

- `purchases_product_minimums_deposit_id_foreign`: (`deposit_id`) → `deposits` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_product_minimums_purchases_product_id_foreign`: (`purchases_product_id`) → `purchases_products` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `purchases_product_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `deposit_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `stock_minimum` | `int` | YES | `` | NULL | `` |  |
| `stock_maximum` | `int` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `purchases_product_presentations`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `4`  

- **PK:** `id`

**Referenciada por (muestra):**
- `purchases_order_details` → `purchases_product_presentations` (`purchases_order_details_product_presentations_id_foreign`)
- `restocking_details` → `purchases_product_presentations` (`restocking_details_product_presentations_id_foreign`)

**FK salientes:**

- `purchases_product_presentations_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `purchases_product_prices`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `168`  

- **PK:** `id`

**FK salientes:**

- `purchases_product_prices_purchases_product_id_foreign`: (`purchases_product_id`) → `purchases_products` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_product_prices_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `social_reason_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `purchases_product_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `type` | `int` | NO | `` | NULL | `` |  |
| `price` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `purchases_products`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `9640`  

- **PK:** `id`

**Referenciada por (muestra):**
- `closing_inventory_stock_details` → `purchases_products` (`closing_inventory_stock_details_purchases_product_id_foreign`)
- `esth_combo_details` → `purchases_products` (`esth_combo_details_purchases_product_id_foreign`)
- `price_update_logs` → `purchases_products` (`price_update_logs_purchases_product_id_foreign`)
- `purchases_details` → `purchases_products` (`purchases_details_purchases_product_id_foreign`)
- `purchases_existences` → `purchases_products` (`purchases_existences_purchases_product_id_foreign`)
- `purchases_movement_details` → `purchases_products` (`purchases_movement_details_purchases_product_id_foreign`)
- `purchases_order_details` → `purchases_products` (`purchases_order_details_purchases_product_id_foreign`)
- `purchases_product_costs` → `purchases_products` (`purchases_product_costs_purchases_product_id_foreign`)
- `purchases_product_inventory_details` → `purchases_products` (`purchases_product_inventory_details_product_id_foreign`)
- `purchases_product_minimums` → `purchases_products` (`purchases_product_minimums_purchases_product_id_foreign`)
- `purchases_product_prices` → `purchases_products` (`purchases_product_prices_purchases_product_id_foreign`)
- `purchases_providers_products` → `purchases_products` (`purchases_providers_products_purchases_product_id_foreign`)
- `restocking_details` → `purchases_products` (`restocking_details_purchases_product_id_foreign`)
- `voucher_details` → `purchases_products` (`voucher_details_purchases_product_id_foreign`)

**FK salientes:**

- `purchases_products_purchases_category_id_foreign`: (`purchases_category_id`) → `purchases_categories` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_products_purchases_product_brand_id_foreign`: (`purchases_product_brand_id`) → `purchases_product_brands` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_products_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `bar_code` | `varchar(191)` | YES | `` | NULL | `` |  |
| `purchases_category_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `type` | `tinyint unsigned` | NO | `` | NULL | `` |  |
| `type_iva` | `tinyint unsigned` | NO | `` | NULL | `` |  |
| `purchases_product_brand_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `conversion_amount` | `int` | YES | `` | 1 | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `requires_mobile` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `requires_expiration` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `purchases_providers`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `7475`  

- **PK:** `id`

**Referenciada por (muestra):**
- `bank_details` → `purchases_providers` (`bank_details_purchases_provider_id_foreign`)
- `calendar_payments` → `purchases_providers` (`calendar_payments_purchases_provider_id_foreign`)
- `creditors` → `purchases_providers` (`creditors_purchases_provider_id_foreign`)
- `occ_med_provider_payments` → `purchases_providers` (`occ_med_provider_payments_provider_id_foreign`)
- `occupational_medicine_client_file_statuses` → `purchases_providers` (`occupational_medicine_client_file_statuses_provider_id_foreign`)
- `occupational_medicine_doctors` → `purchases_providers` (`occupational_medicine_doctors_provider_id_foreign`)
- `occupational_medicine_lender_service` → `purchases_providers` (`occupational_medicine_lender_service_provider_id_foreign`)
- `op_massive_details` → `purchases_providers` (`op_massive_details_purchases_provider_id_foreign`)
- `purchases` → `purchases_providers` (`purchases_purchases_provider_id_foreign`)
- `purchases_orders` → `purchases_providers` (`purchases_orders_purchases_provider_id_foreign`)
- `purchases_providers_products` → `purchases_providers` (`purchases_providers_products_purchases_provider_id_foreign`)
- `restocking_details` → `purchases_providers` (`restocking_details_purchases_provider_id_foreign`)

**FK salientes:**

- `purchases_providers_bank_id_foreign`: (`bank_id`) → `banks` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_providers_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `razon_social` | `varchar(191)` | YES | `` | NULL | `` |  |
| `ruc` | `varchar(191)` | NO | `` | NULL | `` |  |
| `dv` | `varchar(191)` | YES | `` | NULL | `` |  |
| `days_of_grace` | `int` | YES | `` | NULL | `` |  |
| `provider_type` | `int` | YES | `` | NULL | `` |  |
| `address` | `varchar(191)` | NO | `` | NULL | `` |  |
| `phone1` | `varchar(191)` | NO | `` | NULL | `` |  |
| `phone2` | `varchar(191)` | YES | `` | NULL | `` |  |
| `bank_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `bank_account` | `varchar(191)` | YES | `` | NULL | `` |  |
| `email` | `varchar(191)` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `purchases_providers_products`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2105`  

- **PK:** `id`

**FK salientes:**

- `purchases_providers_products_purchases_product_id_foreign`: (`purchases_product_id`) → `purchases_products` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `purchases_providers_products_purchases_provider_id_foreign`: (`purchases_provider_id`) → `purchases_providers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `purchases_provider_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `purchases_product_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `purchases_requesting_departments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `54`  

- **PK:** `id`

**Referenciada por (muestra):**
- `deposit_requesting_departments` → `purchases_requesting_departments` (`deposit_requesting_departments_requesting_department_id_foreign`)
- `purchases_movements` → `purchases_requesting_departments` (`purchases_movements_purchases_department_id_foreign`)
- `purchases_orders` → `purchases_requesting_departments` (`purchases_orders_requesting_departments_id_foreign`)
- `restockings` → `purchases_requesting_departments` (`restockings_requesting_departments_id_foreign`)

**FK salientes:**

- `purchases_requesting_departments_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `quality_controls`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `230975`  

- **PK:** `id`

**Referenciada por (muestra):**
- `internal_notifications` → `quality_controls` (`internal_notifications_quality_control_id_foreign`)

**FK salientes:**

- `quality_controls_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `quality_controls_insurance_id_foreign`: (`insurance_id`) → `insurances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `quality_controls_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `quality_controls_voucher_id_foreign`: (`voucher_id`) → `vouchers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `created_at` | `timestamp` | YES | `MUL` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `observation` | `text` | YES | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `type` | `varchar(191)` | YES | `` | TAPO | `` |  |
| `management_status` | `int` | YES | `` | NULL | `` |  |
| `exception_authorizer` | `smallint` | YES | `` | NULL | `` |  |
| `exception_motive` | `smallint` | YES | `` | NULL | `` |  |
| `contract_type_id` | `int unsigned` | YES | `` | NULL | `` |  |
| `first_payment_made` | `int` | NO | `` | NULL | `` |  |
| `voucher_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `debitentity_id` | `int unsigned` | YES | `` | NULL | `` |  |
| `first_amount` | `int` | YES | `` | NULL | `` |  |
| `attended` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `whatsapp` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `sms` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `insurance_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `payment_channel` | `int unsigned` | YES | `` | NULL | `` |  |
| `date_new_control` | `date` | YES | `` | NULL | `` |  |
| `hour_new_control` | `time` | YES | `` | NULL | `` |  |
| `adherent_added` | `mediumtext` | YES | `` | NULL | `` |  |
| `adherent_removed` | `mediumtext` | YES | `` | NULL | `` |  |
| `plan_fee` | `int` | YES | `` | NULL | `` |  |
| `additional_services` | `mediumtext` | YES | `` | NULL | `` |  |
| `salary_date` | `date` | YES | `` | NULL | `` |  |
| `payment_date` | `date` | YES | `` | NULL | `` |  |
| `copy_of_contract` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `clinical_guide` | `tinyint(1)` | YES | `` | NULL | `` |  |

### `query_exceptions`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `4653`  

- **PK:** `id`

**FK salientes:**

- `query_exceptions_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `query_exceptions_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `date_from` | `datetime` | NO | `` | NULL | `` |  |
| `date_to` | `datetime` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | NO | `` | NULL | `` |  |
| `reason` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `raffles_cupons`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `4910`  

- **PK:** `id`

**FK salientes:**

- `raffles_cupons_voucher_id_foreign`: (`voucher_id`) → `vouchers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `voucher_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `int` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `receipt_purchases_pending`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `13558`  

- **PK:** `id`

**FK salientes:**

- `receipt_purchases_pending_purchase_receipt_id_foreign`: (`purchase_receipt_id`) → `purchase_receipts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `receipt_purchases_pending_purchases_pending_receipt_id_foreign`: (`purchases_pending_receipt_id`) → `purchases_pending_receipts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `purchase_receipt_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `purchases_pending_receipt_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `record_of_impressions`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `7896`  

- **PK:** `id`

**FK salientes:**

- `record_of_impressions_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `record_of_impressions_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `record_of_impressions_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `type_document` | `int` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `recovery_trackings`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `3883651`  

- **PK:** `id`

**Referenciada por (muestra):**
- `call_center_call_phones` → `recovery_trackings` (`call_center_call_phones_recovery_tracking_id_foreign`)
- `detail_client_portfolios` → `recovery_trackings` (`detail_client_portfolios_last_tracking_id_foreign`)
- `pending_claims` → `recovery_trackings` (`pending_claims_recovery_tracking_id_foreign`)

**FK salientes:**

- `recovery_trackings_address_id_foreign`: (`address_id`) → `addresses` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `recovery_trackings_city_id_foreign`: (`city_id`) → `cities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `recovery_trackings_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `recovery_trackings_debt_collector_id_foreign`: (`debt_collector_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `recovery_trackings_neighborhood_id_foreign`: (`neighborhood_id`) → `neighborhoods` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `recovery_trackings_user_deleted_foreign`: (`user_deleted`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `recovery_trackings_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `attended` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `not_attended` | `int` | YES | `` | NULL | `` |  |
| `contact_form_id` | `int` | YES | `` | NULL | `` |  |
| `used_number_phone` | `varchar(191)` | YES | `` | NULL | `` |  |
| `call_again` | `date` | YES | `` | NULL | `` |  |
| `payment_date` | `date` | YES | `` | NULL | `` |  |
| `collection_way_id` | `int unsigned` | YES | `` | NULL | `` |  |
| `debt_collector_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `city_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `address_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `address_address` | `varchar(191)` | YES | `` | NULL | `` |  |
| `address_type` | `int` | YES | `` | NULL | `` |  |
| `neighborhood_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `non_payment_reason_id` | `int unsigned` | YES | `` | NULL | `` |  |
| `amount_receivable` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `carry_pending` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `by_seller` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `import` | `tinyint` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `MUL` | NULL | `` |  |
| `reason_deleted` | `longtext` | YES | `` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `MUL` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `report_sending_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `48`  

- **PK:** `id`

**FK salientes:**

- `report_sending_details_report_sending_id_foreign`: (`report_sending_id`) → `report_sendings` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `report_sending_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `type_attachment` | `int` | NO | `` | NULL | `` |  |
| `frecuency` | `int` | NO | `` | NULL | `` |  |
| `day_of_week` | `int` | YES | `` | NULL | `` |  |
| `day_of_month` | `int` | YES | `` | NULL | `` |  |
| `hour_at` | `time` | YES | `` | NULL | `` |  |
| `job_id` | `int unsigned` | YES | `` | NULL | `` |  |
| `last_run` | `datetime` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `report_sending_emails`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `80`  

- **PK:** `id`

**FK salientes:**

- `report_sending_emails_email_id_foreign`: (`email_id`) → `emails` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `report_sending_emails_report_sending_id_foreign`: (`report_sending_id`) → `report_sendings` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `email_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `report_sending_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `report_sendings`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `48`  

- **PK:** `id`

**Referenciada por (muestra):**
- `report_sending_details` → `report_sendings` (`report_sending_details_report_sending_id_foreign`)
- `report_sending_emails` → `report_sendings` (`report_sending_emails_report_sending_id_foreign`)

**FK salientes:**

- `report_sendings_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `report_sendings_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `type_report` | `int` | NO | `` | NULL | `` |  |
| `header` | `varchar(191)` | YES | `` | NULL | `` |  |
| `body` | `longtext` | NO | `` | NULL | `` |  |
| `status` | `int` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `request_changes`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `51691`  

- **PK:** `id`

**Referenciada por (muestra):**
- `bancard_card_contracts` → `request_changes` (`bancard_card_contracts_request_change_id_foreign`)
- `request_changes_details` → `request_changes` (`request_changes_details_request_change_id_foreign`)

**FK salientes:**

- `request_changes_applicant_id_foreign`: (`applicant_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_changes_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_changes_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_changes_dental_budget_id_foreign`: (`dental_budget_id`) → `dental_budgets` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_changes_insurance_id_foreign`: (`new_insurance_id`) → `insurances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_changes_manager_id_foreign`: (`manager_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_changes_new_budget_contract_id_foreign`: (`new_budget_contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_changes_new_debitentity_id_foreign`: (`new_debitentity_id`) → `debit_entities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_changes_new_manager_id_foreign`: (`new_manager_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_changes_new_seller_id_foreign`: (`new_seller_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_changes_new_supervisor_id_foreign`: (`new_supervisor_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_changes_new_treatment_convention_id_foreign`: (`new_treatment_convention_id`) → `treatment_conventions` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_changes_old_budget_contract_id_foreign`: (`old_budget_contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_changes_old_debitentity_id_foreign`: (`old_debitentity_id`) → `debit_entities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_changes_old_insurance_id_foreign`: (`old_insurance_id`) → `insurances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_changes_old_seller_id_foreign`: (`old_seller_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_changes_old_supervisor_id_foreign`: (`old_supervisor_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_changes_old_treatment_convention_id_foreign`: (`old_treatment_convention_id`) → `treatment_conventions` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_changes_requesting_user_id_foreign`: (`requesting_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `applicant_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `requesting_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `observation` | `longtext` | NO | `` | NULL | `` |  |
| `manager_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `reject_motive` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `int unsigned` | NO | `` | 1 | `` |  |
| `client_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `accounting_plan_id` | `bigint unsigned` | YES | `MUL` | NULL | `` |  |
| `dental_budget_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `old_supervisor_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `new_supervisor_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `old_seller_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `new_seller_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `new_treatment_convention_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `old_treatment_convention_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `old_budget_contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `new_budget_contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `new_amount` | `decimal(11,2)` | NO | `` | 0.00 | `` |  |
| `old_amount` | `decimal(11,2)` | NO | `` | 0.00 | `` |  |
| `quantity_quotas` | `int` | YES | `` | NULL | `` |  |
| `new_insurance_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `old_insurance_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `old_contract_type` | `int unsigned` | YES | `` | NULL | `` |  |
| `new_contract_type` | `int unsigned` | YES | `` | NULL | `` |  |
| `old_type_plan` | `int unsigned` | YES | `` | NULL | `` |  |
| `new_type_plan` | `int unsigned` | YES | `` | NULL | `` |  |
| `type` | `int` | NO | `` | NULL | `` |  |
| `new_manager_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `old_debitentity_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `old_card_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `old_account_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `old_account_manager` | `varchar(191)` | YES | `` | NULL | `` |  |
| `old_document_manager` | `varchar(191)` | YES | `` | NULL | `` |  |
| `new_debitentity_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `new_card_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `new_account_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `new_account_manager` | `varchar(191)` | YES | `` | NULL | `` |  |
| `new_document_manager` | `varchar(191)` | YES | `` | NULL | `` |  |
| `old_expiration_fee` | `date` | YES | `` | NULL | `` |  |
| `new_expiration_fee` | `date` | YES | `` | NULL | `` |  |
| `old_quantity_quotas` | `int` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `request_changes_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `28223`  

- **PK:** `id`

**FK salientes:**

- `request_changes_details_cash_box_close_id_foreign`: (`cash_box_close_id`) → `cash_box_closes` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_changes_details_cash_box_id_foreign`: (`cash_box_id`) → `cash_boxes` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_changes_details_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_changes_details_fee_contract_id_foreign`: (`fee_contract_id`) → `contract_fees` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_changes_details_request_change_id_foreign`: (`request_change_id`) → `request_changes` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_changes_details_service_doctor_id_foreign`: (`service_doctor_id`) → `services_doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `request_change_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `client_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `service_doctor_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `treatmen_name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `relationship` | `int unsigned` | YES | `` | NULL | `` |  |
| `new_promotion_amount` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `new_budget_amount` | `decimal(11,2)` | NO | `` | 0.00 | `` |  |
| `old_budget_amount` | `decimal(11,2)` | NO | `` | 0.00 | `` |  |
| `type` | `int unsigned` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `admission_date` | `date` | YES | `` | NULL | `` |  |
| `fee_contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `new_fee_expiration_date` | `date` | YES | `` | NULL | `` |  |
| `old_fee_expiration_date` | `date` | YES | `` | NULL | `` |  |
| `cash_box_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `cash_box_close_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `old_close_date` | `date` | YES | `` | NULL | `` |  |
| `new_close_date` | `date` | YES | `` | NULL | `` |  |
| `fromable_type` | `varchar(191)` | YES | `MUL` | NULL | `` |  |
| `fromable_id` | `bigint unsigned` | YES | `` | NULL | `` |  |
| `old_fromable_id` | `bigint unsigned` | YES | `` | NULL | `` |  |
| `new_fromable_id` | `bigint unsigned` | YES | `` | NULL | `` |  |

### `request_eme_event_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `request_eme_event_details_eme_serv_detail_id_foreign`: (`eme_serv_detail_id`) → `request_eme_serv_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `pacient` | `varchar(191)` | NO | `` | NULL | `` |  |
| `motive` | `varchar(191)` | NO | `` | NULL | `` |  |
| `idx` | `varchar(191)` | NO | `` | NULL | `` |  |
| `treatment` | `varchar(191)` | NO | `` | NULL | `` |  |
| `eme_serv_detail_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `request_eme_serv_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `7461`  

- **PK:** `id`

**Referenciada por (muestra):**
- `emergency_dispatchers` → `request_eme_serv_details` (`emergency_dispatchers_request_eme_serv_id_foreign`)
- `emergency_services` → `request_eme_serv_details` (`emergency_services_request_eme_serv_det_id_foreign`)
- `request_eme_event_details` → `request_eme_serv_details` (`request_eme_event_details_eme_serv_detail_id_foreign`)

**FK salientes:**

- `request_eme_serv_details_canceled_user_id_foreign`: (`canceled_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_eme_serv_details_city_id_foreign`: (`city_id`) → `cities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_eme_serv_details_emergency_service_id_foreign`: (`emergency_service_id`) → `request_emergency_services` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_eme_serv_details_emergency_type_service_id_foreign`: (`emergency_type_service_id`) → `emergency_type_services` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_eme_serv_details_finish_user_id_foreign`: (`finish_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_eme_serv_details_init_user_id_foreign`: (`init_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_eme_serv_details_neighborhood_id_foreign`: (`neighborhood_id`) → `neighborhoods` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_eme_serv_details_type_event_id_foreign`: (`type_event_id`) → `type_events` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `emergency_service_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `arrive_before` | `int` | YES | `` | NULL | `` |  |
| `from_hour` | `datetime` | YES | `` | NULL | `` |  |
| `until_hour` | `datetime` | YES | `` | NULL | `` |  |
| `init_at` | `datetime` | YES | `` | NULL | `` |  |
| `init_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `finish_at` | `datetime` | YES | `` | NULL | `` |  |
| `finish_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `finish_observation` | `longtext` | YES | `` | NULL | `` |  |
| `init_observation` | `longtext` | YES | `` | NULL | `` |  |
| `quantity_medic` | `int` | NO | `` | 0 | `` |  |
| `quantity_paramedic` | `int` | NO | `` | 0 | `` |  |
| `quantity_ambulance` | `int` | NO | `` | 0 | `` |  |
| `quantity_patient` | `int` | YES | `` | NULL | `` |  |
| `amount_per_hour` | `decimal(11,2)` | NO | `` | 0.00 | `` |  |
| `emergency_type_service_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `type_event_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `address` | `varchar(191)` | NO | `` | NULL | `` |  |
| `address_map` | `varchar(191)` | YES | `` | NULL | `` |  |
| `home_number` | `int` | YES | `` | NULL | `` |  |
| `city_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `neighborhood_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `canceled_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `reason_deleted` | `longtext` | YES | `` | NULL | `` |  |
| `canceled_at` | `datetime` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `document_image` | `varchar(191)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `request_emergency_services`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2345`  

- **PK:** `id`

**Referenciada por (muestra):**
- `request_eme_serv_details` → `request_emergency_services` (`request_eme_serv_details_emergency_service_id_foreign`)

**FK salientes:**

- `request_emergency_services_cancel_user_id_foreign`: (`cancel_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_emergency_services_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_emergency_services_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_emergency_services_seller_id_foreign`: (`seller_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `request_emergency_services_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `fantasy_name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `manager_fullname` | `varchar(191)` | YES | `` | NULL | `` |  |
| `prefix_manager_phone_number` | `varchar(5)` | YES | `` | NULL | `` |  |
| `without_prefix_manager_phone_number` | `varchar(10)` | YES | `` | NULL | `` |  |
| `manager_phone_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | 0.00 | `` |  |
| `advance_invoice` | `int` | YES | `` | NULL | `` |  |
| `amount_advance` | `int` | YES | `` | NULL | `` |  |
| `reason_canceled` | `longtext` | YES | `` | NULL | `` |  |
| `cancel_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `seller_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `restocking_budgets`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `restocking_budgets_confirmation_user_id_foreign`: (`confirmation_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `restocking_budgets_restocking_id_foreign`: (`restocking_id`) → `restockings` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `restocking_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `confirmation_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `confirmation_date` | `datetime` | YES | `` | NULL | `` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `original_name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `int` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `restocking_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `20287`  

- **PK:** `id`

**Referenciada por (muestra):**
- `purchases_movement_details` → `restocking_details` (`purchases_movement_details_restocking_detail_id_foreign`)
- `purchases_order_details` → `restocking_details` (`purchases_order_details_restocking_detail_id_foreign`)

**FK salientes:**

- `restocking_details_product_presentations_id_foreign`: (`product_presentations_id`) → `purchases_product_presentations` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `restocking_details_purchases_product_id_foreign`: (`purchases_product_id`) → `purchases_products` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `restocking_details_purchases_provider_id_foreign`: (`purchases_provider_id`) → `purchases_providers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `restocking_details_restocking_id_foreign`: (`restocking_id`) → `restockings` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `restocking_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `purchases_product_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `product_presentations_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `purchases_provider_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `provider_name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `provider_phone` | `varchar(191)` | YES | `` | NULL | `` |  |
| `description` | `varchar(191)` | NO | `` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `residue` | `int` | NO | `` | NULL | `` |  |
| `approved_amount` | `tinyint` | YES | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `last_cost` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `restockings`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1273`  

- **PK:** `id`

**Referenciada por (muestra):**
- `restocking_budgets` → `restockings` (`restocking_budgets_restocking_id_foreign`)
- `restocking_details` → `restockings` (`restocking_details_restocking_id_foreign`)

**FK salientes:**

- `restockings_approve_user_id_foreign`: (`approve_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `restockings_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `restockings_currency_id_foreign`: (`currency_id`) → `currencies` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `restockings_deposit_id_foreign`: (`deposit_id`) → `deposits` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `restockings_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `restockings_requesting_departments_id_foreign`: (`requesting_departments_id`) → `purchases_requesting_departments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `restockings_social_reason_id_foreign`: (`social_reason_id`) → `social_reasons` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `restockings_user_deleted_foreign`: (`user_deleted`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `restockings_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `number` | `int` | NO | `` | NULL | `` |  |
| `type` | `tinyint` | YES | `` | NULL | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `date_requirement` | `date` | NO | `` | NULL | `` |  |
| `social_reason_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `currency_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `requesting_departments_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `requested_by` | `varchar(191)` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `branch_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `image` | `varchar(191)` | YES | `` | NULL | `` |  |
| `deposit_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `approve_date` | `datetime` | YES | `` | NULL | `` |  |
| `approve_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `date_deleted` | `datetime` | YES | `` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `role_user`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `3383`  

- **PK:** `user_id, role_id, user_type`

**FK salientes:**

- `role_user_role_id_foreign`: (`role_id`) → `roles` (`id`) ON UPDATE CASCADE / ON DELETE CASCADE
- `role_user_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `role_id` | `int unsigned` | NO | `PRI` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `PRI` | NULL | `` |  |
| `user_type` | `varchar(191)` | NO | `PRI` | NULL | `` |  |

### `roles`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `170`  

- **PK:** `id`

**Referenciada por (muestra):**
- `permission_role` → `roles` (`permission_role_role_id_foreign`)
- `role_user` → `roles` (`role_user_role_id_foreign`)

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `UNI` | NULL | `` |  |
| `display_name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `description` | `varchar(191)` | YES | `` | NULL | `` |  |
| `scheduling_area` | `smallint` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `room_reservations`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `460`  

- **PK:** `id`

**FK salientes:**

- `room_reservations_room_id_foreign`: (`room_id`) → `rooms` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `room_reservations_user_from_foreign`: (`user_from`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `room_reservations_user_to_foreign`: (`user_to`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `user_from` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_to` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `room_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `start` | `datetime` | NO | `` | NULL | `` |  |
| `end` | `datetime` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | NO | `` | NULL | `` |  |
| `status` | `int` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `rooms`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `9`  

- **PK:** `id`

**Referenciada por (muestra):**
- `room_reservations` → `rooms` (`room_reservations_room_id_foreign`)

**FK salientes:**

- `rooms_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `room_name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `sale_opportunity_tasks`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `13488`  

- **PK:** `id`

**Referenciada por (muestra):**
- `sales_opportunity_trackings` → `sale_opportunity_tasks` (`sales_opportunity_trackings_sale_opportunity_task_id_foreign`)

**FK salientes:**

- `sale_opportunity_tasks_sale_opportunity_id_foreign`: (`sale_opportunity_id`) → `sales_opportunities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sale_opportunity_tasks_task_status_id_foreign`: (`task_status_id`) → `task_statuses` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sale_opportunity_tasks_task_type_id_foreign`: (`task_type_id`) → `task_types` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sale_opportunity_tasks_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `sale_opportunity_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `description` | `varchar(191)` | NO | `` | NULL | `` |  |
| `start_date` | `date` | NO | `` | NULL | `` |  |
| `scheduled_time` | `time` | YES | `` | NULL | `` | Horario específico para la tarea |
| `end_date` | `date` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `task_type_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `task_status_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |

### `sale_portfolio_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `15371`  

- **PK:** `id`

**FK salientes:**

- `sale_portfolio_details_portfolio_id_foreign`: (`portfolio_id`) → `sale_portfolios` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sale_portfolio_details_sale_opportunity_id_foreign`: (`sale_opportunity_id`) → `sales_opportunities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sale_portfolio_details_seller_id_foreign`: (`seller_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `portfolio_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `sale_opportunity_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `seller_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `sale_portfolios`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `50`  

- **PK:** `id`

**Referenciada por (muestra):**
- `ad_sets_portfolios` → `sale_portfolios` (`ad_sets_portfolios_sale_portfolio_id_foreign`)
- `sale_portfolio_details` → `sale_portfolios` (`sale_portfolio_details_portfolio_id_foreign`)
- `sales_opportunity_movements` → `sale_portfolios` (`sales_opportunity_movements_new_portfolio_id_foreign`)
- `sales_opportunity_movements` → `sale_portfolios` (`sales_opportunity_movements_old_portfolio_id_foreign`)
- `sales_opportunity_trackings` → `sale_portfolios` (`sales_opportunity_trackings_portfolio_id_foreign`)

**FK salientes:**

- `sale_portfolios_opportunity_campaign_id_foreign`: (`opportunity_campaign_id`) → `opportunity_campaigns` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sale_portfolios_user_deleted_foreign`: (`user_deleted`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sale_portfolios_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `opportunity_campaign_id` | `int unsigned` | YES | `MUL` | NULL | `` | Id de la campaña |
| `name` | `longtext` | YES | `` | NULL | `` | Nombre de la cartera |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_deleted` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `sales_estetics`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `6`  

- **PK:** `id`

**FK salientes:**

- `sales_estetics_insurance_id_foreign`: (`insurance_id`) → `insurances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sales_estetics_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `document_number` | `varchar(191)` | NO | `` | NULL | `` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `insurance_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `number` | `varchar(191)` | NO | `` | NULL | `` |  |
| `motive` | `varchar(191)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `sales_opportunities`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `675931`  

- **PK:** `id`

**Referenciada por (muestra):**
- `call_center_calls` → `sales_opportunities` (`call_center_calls_sales_opportunity_id_foreign`)
- `crm_contacts` → `sales_opportunities` (`crm_contacts_opportunity_id_foreign`)
- `sale_opportunity_tasks` → `sales_opportunities` (`sale_opportunity_tasks_sale_opportunity_id_foreign`)
- `sale_portfolio_details` → `sales_opportunities` (`sale_portfolio_details_sale_opportunity_id_foreign`)
- `sales_opportunity_files` → `sales_opportunities` (`sales_opportunity_files_sales_opportunity_id_foreign`)
- `sales_opportunity_messages` → `sales_opportunities` (`sales_opportunity_messages_sales_opportunity_id_foreign`)
- `sales_opportunity_movements` → `sales_opportunities` (`sales_opportunity_movements_sales_opportunity_id_foreign`)
- `sales_opportunity_trackings` → `sales_opportunities` (`sales_opportunity_trackings_sales_opportunity_id_foreign`)

**FK salientes:**

- `sales_opportunities_ad_set_id_foreign`: (`ad_set_id`) → `ad_sets` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sales_opportunities_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sales_opportunities_city_id_foreign`: (`city_id`) → `cities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sales_opportunities_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE SET NULL
- `sales_opportunities_closer_id_foreign`: (`closer_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sales_opportunities_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sales_opportunities_contract_promotion_id_foreign`: (`contract_promotion_id`) → `contract_promotions` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sales_opportunities_deleted_user_id_foreign`: (`deleted_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sales_opportunities_dental_budget_id_foreign`: (`dental_budget_id`) → `dental_budgets` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sales_opportunities_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sales_opportunities_half_contact_id_foreign`: (`half_contact_id`) → `half_contacts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sales_opportunities_insurance_id_foreign`: (`insurance_id`) → `insurances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sales_opportunities_opportunity_campaign_id_foreign`: (`opportunity_campaign_id`) → `opportunity_campaigns` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sales_opportunities_rejected_motive_id_foreign`: (`rejected_motive_id`) → `sales_opportunity_rejection_motives` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sales_opportunities_seller_id_foreign`: (`seller_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sales_opportunities_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_type` | `int` | NO | `` | 1 | `` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `seller_city` | `int unsigned` | YES | `` | NULL | `` |  |
| `half_contact_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `chat_platform` | `varchar(50)` | YES | `` | NULL | `` |  |
| `chat_channel_id` | `varchar(100)` | YES | `MUL` | NULL | `` |  |
| `bm_customer_id` | `varchar(100)` | YES | `` | NULL | `` |  |
| `message_id` | `varchar(191)` | YES | `` | NULL | `` |  |
| `fullname` | `varchar(191)` | NO | `` | NULL | `` |  |
| `dental_office` | `varchar(191)` | YES | `` | NULL | `` |  |
| `type_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `prefix` | `varchar(191)` | YES | `` | NULL | `` |  |
| `number_without_prefix` | `varchar(191)` | YES | `` | NULL | `` |  |
| `phone` | `varchar(191)` | YES | `MUL` | NULL | `` |  |
| `whatsapp_number` | `varchar(30)` | YES | `` | NULL | `` |  |
| `email` | `varchar(191)` | YES | `` | NULL | `` |  |
| `contact_name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `contact_charge` | `varchar(191)` | YES | `` | NULL | `` |  |
| `document_number` | `bigint` | YES | `` | NULL | `` |  |
| `ruc` | `varchar(191)` | YES | `` | NULL | `` |  |
| `insurance_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `contract_promotion_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `type_plan` | `int unsigned` | YES | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `lead` | `varchar(191)` | YES | `` | NULL | `` |  |
| `form_id` | `varchar(191)` | YES | `` | NULL | `` |  |
| `ad_id` | `varchar(191)` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `creator` | `int unsigned` | NO | `` | 0 | `` |  |
| `seller_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `client_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `closer_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `closed_in` | `int` | YES | `` | NULL | `` |  |
| `city_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `deadline` | `date` | YES | `` | NULL | `` |  |
| `address` | `varchar(191)` | YES | `` | NULL | `` |  |
| `location` | `varchar(191)` | YES | `` | NULL | `` |  |
| `json_request` | `longtext` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `deleted_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `deleted_reason` | `longtext` | YES | `` | NULL | `` |  |
| `deleted_at` | `datetime` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `processed_at` | `datetime` | YES | `` | NULL | `` |  |
| `closed_at` | `datetime` | YES | `` | NULL | `` |  |
| `drawer_sale_at` | `datetime` | YES | `` | NULL | `` |  |
| `selled_at` | `datetime` | YES | `` | NULL | `` |  |
| `rejected_at` | `datetime` | YES | `` | NULL | `` |  |
| `rejected_motive_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `latitude` | `varchar(191)` | YES | `` | NULL | `` |  |
| `longitude` | `varchar(191)` | YES | `` | NULL | `` |  |
| `contract_type` | `int` | YES | `` | NULL | `` |  |
| `online_call` | `int` | YES | `` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `ip_address` | `varchar(191)` | YES | `` | NULL | `` |  |
| `section` | `int unsigned` | YES | `` | NULL | `` |  |
| `dental_budget_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `notificated` | `int` | YES | `` | NULL | `` |  |
| `scheduled` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `ad_set_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `opportunity_campaign_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |

### `sales_opportunity_files`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `5`  

- **PK:** `id`

**FK salientes:**

- `sales_opportunity_files_sales_opportunity_id_foreign`: (`sales_opportunity_id`) → `sales_opportunities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sales_opportunity_files_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `sales_opportunity_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `description` | `varchar(191)` | YES | `` | NULL | `` |  |
| `file` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |

### `sales_opportunity_messages`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1189`  

- **PK:** `id`

**FK salientes:**

- `sales_opportunity_messages_sales_opportunity_id_foreign`: (`sales_opportunity_id`) → `sales_opportunities` (`id`) ON UPDATE NO ACTION / ON DELETE CASCADE

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `sales_opportunity_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `from` | `varchar(20)` | YES | `MUL` | NULL | `` |  |
| `from_name` | `varchar(150)` | YES | `` | NULL | `` |  |
| `message_id` | `varchar(150)` | YES | `MUL` | NULL | `` |  |
| `message` | `longtext` | YES | `` | NULL | `` |  |
| `message_at` | `datetime` | YES | `` | NULL | `` |  |
| `operator_id` | `varchar(150)` | YES | `` | NULL | `` |  |
| `operator_email` | `varchar(150)` | YES | `` | NULL | `` |  |
| `operator_name` | `varchar(150)` | YES | `` | NULL | `` |  |
| `operator_role` | `varchar(50)` | YES | `` | NULL | `` |  |
| `intent_name` | `varchar(150)` | YES | `` | NULL | `` |  |
| `has_attachment` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `attachment_image` | `text` | YES | `` | NULL | `` |  |
| `attachment_audio` | `text` | YES | `` | NULL | `` |  |
| `attachment_video` | `text` | YES | `` | NULL | `` |  |
| `attachment_file` | `text` | YES | `` | NULL | `` |  |
| `payload` | `varchar(255)` | YES | `` | NULL | `` |  |
| `client_payload` | `varchar(255)` | YES | `` | NULL | `` |  |
| `button` | `varchar(100)` | YES | `` | NULL | `` |  |
| `template_name` | `varchar(150)` | YES | `` | NULL | `` |  |
| `location` | `varchar(100)` | YES | `` | NULL | `` |  |
| `caption` | `varchar(255)` | YES | `` | NULL | `` |  |
| `queue` | `varchar(100)` | YES | `` | NULL | `` |  |
| `whatsapp_referral` | `longtext` | YES | `` | NULL | `` |  |
| `cart` | `longtext` | YES | `` | NULL | `` |  |
| `raw` | `longtext` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `sales_opportunity_movements`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `385442`  

- **PK:** `id`

**FK salientes:**

- `sales_opportunity_movements_new_campaign_id_foreign`: (`new_campaign_id`) → `opportunity_campaigns` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sales_opportunity_movements_new_portfolio_id_foreign`: (`new_portfolio_id`) → `sale_portfolios` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sales_opportunity_movements_new_seller_id_foreign`: (`new_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sales_opportunity_movements_old_campaign_id_foreign`: (`old_campaign_id`) → `opportunity_campaigns` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sales_opportunity_movements_old_portfolio_id_foreign`: (`old_portfolio_id`) → `sale_portfolios` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sales_opportunity_movements_old_seller_id_foreign`: (`old_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sales_opportunity_movements_sales_opportunity_id_foreign`: (`sales_opportunity_id`) → `sales_opportunities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sales_opportunity_movements_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `type` | `int unsigned` | NO | `` | NULL | `` |  |
| `sales_opportunity_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `old_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `new_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `old_campaign_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `new_campaign_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `old_portfolio_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `new_portfolio_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |

### `sales_opportunity_rejection_motives`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `11`  

- **PK:** `id`

**Referenciada por (muestra):**
- `sales_opportunities` → `sales_opportunity_rejection_motives` (`sales_opportunities_rejected_motive_id_foreign`)

**FK salientes:**

- `sales_opportunity_rejection_motives_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `type` | `int` | YES | `` | 1 | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `sales_opportunity_trackings`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1112727`  

- **PK:** `id`

**Referenciada por (muestra):**
- `call_center_call_phones` → `sales_opportunity_trackings` (`call_center_call_phones_sales_opportunity_tracking_id_foreign`)

**FK salientes:**

- `sales_opportunity_trackings_opportunity_campaign_id_foreign`: (`opportunity_campaign_id`) → `opportunity_campaigns` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sales_opportunity_trackings_opportunity_management_id_foreign`: (`opportunity_management_id`) → `opportunity_management` (`id`) ON UPDATE NO ACTION / ON DELETE SET NULL
- `sales_opportunity_trackings_portfolio_id_foreign`: (`portfolio_id`) → `sale_portfolios` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sales_opportunity_trackings_sale_opportunity_task_id_foreign`: (`sale_opportunity_task_id`) → `sale_opportunity_tasks` (`id`) ON UPDATE NO ACTION / ON DELETE SET NULL
- `sales_opportunity_trackings_sales_opportunity_id_foreign`: (`sales_opportunity_id`) → `sales_opportunities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sales_opportunity_trackings_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `sales_opportunity_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `sale_opportunity_task_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `attended` | `int` | YES | `` | NULL | `` |  |
| `contact_form` | `int` | YES | `` | NULL | `` |  |
| `action` | `int` | YES | `` | NULL | `` |  |
| `not_attended` | `int` | YES | `` | NULL | `` |  |
| `opportunity_management_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `call_again` | `date` | YES | `` | NULL | `` |  |
| `scheduled_time` | `time` | YES | `` | NULL | `` | Horario agendado para el seguimiento |
| `reassigned` | `int` | YES | `` | NULL | `` |  |
| `closer` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `sold` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `reject` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `opportunity_status` | `int` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `scheduled` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `portfolio_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `opportunity_campaign_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |

### `scale_viatics`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `6`  

- **PK:** `id`

**Referenciada por (muestra):**
- `commission_types` → `scale_viatics` (`commission_types_scale_viatic_id_foreign`)
- `employee_seller_type_commissions` → `scale_viatics` (`employee_seller_type_commissions_scale_viatic_id_foreign`)
- `viatic_types` → `scale_viatics` (`viatic_types_scale_viatic_id_foreign`)

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `type_viatic` | `smallint` | YES | `` | NULL | `` |  |
| `type_amount` | `smallint` | YES | `` | NULL | `` |  |
| `type_payment` | `smallint` | YES | `` | 1 | `` |  |
| `contract_type` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `scale_type` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `seller_team_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `161`  

- **PK:** `id`

**FK salientes:**

- `seller_team_details_seller_team_id_foreign`: (`seller_team_id`) → `seller_teams` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `seller_team_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `from_date` | `date` | NO | `` | NULL | `` |  |
| `until_date` | `date` | NO | `` | NULL | `` |  |
| `goal` | `decimal(11,2)` | NO | `` | 0.00 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `seller_team_users`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1682`  

- **PK:** `id`

**FK salientes:**

- `seller_team_users_seller_id_foreign`: (`seller_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `seller_team_users_seller_team_id_foreign`: (`seller_team_id`) → `seller_teams` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `seller_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `seller_team_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `seller_teams`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `152`  

- **PK:** `id`

**Referenciada por (muestra):**
- `facebook_ad_teams` → `seller_teams` (`facebook_ad_teams_seller_team_id_foreign`)
- `seller_team_details` → `seller_teams` (`seller_team_details_seller_team_id_foreign`)
- `seller_team_users` → `seller_teams` (`seller_team_users_seller_team_id_foreign`)
- `users` → `seller_teams` (`users_seller_team_id_foreign`)

**FK salientes:**

- `seller_teams_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `seller_teams_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `goal` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `from_time` | `time` | NO | `` | NULL | `` |  |
| `until_time` | `time` | NO | `` | NULL | `` |  |
| `type_team` | `int` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `service_doctor_prices`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `11385`  

- **PK:** `id`

**FK salientes:**

- `service_doctor_prices_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `service_doctor_prices_doctor_id_foreign`: (`doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `service_doctor_prices_services_doctor_id_foreign`: (`services_doctor_id`) → `services_doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `services_doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `service_doctor_procedures`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1138`  

- **PK:** `id`

**FK salientes:**

- `service_doctor_procedures_procedure_id_foreign`: (`procedure_id`) → `procedures` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `service_doctor_procedures_services_doctor_id_foreign`: (`services_doctor_id`) → `services_doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `services_doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `procedure_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `service_invoice_branch_enterprices`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `334`  

- **PK:** `id`

**FK salientes:**

- `service_invoice_branch_enterprices_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `service_invoice_branch_enterprices_cost_center_id_foreign`: (`cost_center_id`) → `cost_centers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `service_invoice_branch_enterprices_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `service_invoice_branch_enterprices_service_invoice_id_foreign`: (`service_invoice_id`) → `service_invoices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `service_invoice_branch_enterprices_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `service_invoice_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `cost_center_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `service_invoices`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `89`  

- **PK:** `id`

**Referenciada por (muestra):**
- `closed_invoices` → `service_invoices` (`closed_invoices_service_invoice_id_foreign`)
- `emergency_type_services` → `service_invoices` (`emergency_type_services_service_invoice_id_foreign`)
- `esth_combos` → `service_invoices` (`esth_combos_service_invoice_id_foreign`)
- `invoice_masives` → `service_invoices` (`invoice_masives_service_invoice_id_foreign`)
- `occ_med_client_advances` → `service_invoices` (`occ_med_client_advances_service_invoice_id_foreign`)
- `occupational_medicine_products` → `service_invoices` (`occupational_medicine_products_service_invoice_id_foreign`)
- `pending_invoices` → `service_invoices` (`pending_invoices_service_invoice_id_foreign`)
- `service_invoice_branch_enterprices` → `service_invoices` (`service_invoice_branch_enterprices_service_invoice_id_foreign`)
- `service_invoices_enterprises` → `service_invoices` (`service_invoices_enterprises_service_invoices_id_foreign`)
- `voucher_details` → `service_invoices` (`voucher_details_service_invoice_id_foreign`)

**FK salientes:**

- `service_invoices_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `ascont_id` | `int` | NO | `` | NULL | `` |  |
| `commisionable_collector` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `ocupational_medicine` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `type` | `int` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `service_invoices_enterprises`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `109`  

- **PK:** `id`

**FK salientes:**

- `service_invoices_enterprises_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `service_invoices_enterprises_service_invoices_id_foreign`: (`service_invoices_id`) → `service_invoices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `service_invoices_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `service_levels`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `271893`  

- **PK:** `id`

**FK salientes:**

- `service_levels_dental_office_id_foreign`: (`dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `service_levels_doctor_id_foreign`: (`doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `service_levels_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `dental_office_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `total_event` | `int` | NO | `` | NULL | `` |  |
| `type` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `time_7` | `int` | YES | `` | NULL | `` |  |
| `time_8` | `int` | YES | `` | NULL | `` |  |
| `time_9` | `int` | YES | `` | NULL | `` |  |
| `time_10` | `int` | YES | `` | NULL | `` |  |
| `time_11` | `int` | YES | `` | NULL | `` |  |
| `time_12` | `int` | YES | `` | NULL | `` |  |
| `time_13` | `int` | YES | `` | NULL | `` |  |
| `time_14` | `int` | YES | `` | NULL | `` |  |
| `time_15` | `int` | YES | `` | NULL | `` |  |
| `time_16` | `int` | YES | `` | NULL | `` |  |
| `time_17` | `int` | YES | `` | NULL | `` |  |
| `time_18` | `int` | YES | `` | NULL | `` |  |
| `time_19` | `int` | YES | `` | NULL | `` |  |
| `time_20` | `int` | YES | `` | NULL | `` |  |
| `time_21` | `int` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `services`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `14`  

- **PK:** `id`

**Referenciada por (muestra):**
- `calendar_payments` → `services` (`calendar_payments_service_id_foreign`)

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `category` | `int` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `services_authorization_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `188538`  

- **PK:** `id`

**Referenciada por (muestra):**
- `client_services` → `services_authorization_details` (`client_services_services_authorization_detail_id_foreign`)
- `paym_serv_auth_details` → `services_authorization_details` (`paym_serv_auth_details_services_authorization_detail_id_foreign`)

**FK salientes:**

- `services_authorization_details_services_authorization_id_foreign`: (`services_authorization_id`) → `services_authorizations` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `services_authorization_details_services_doctor_id_foreign`: (`services_doctor_id`) → `services_doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `services_authorization_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `services_doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `coverage` | `int` | NO | `` | NULL | `` |  |
| `detail` | `varchar(191)` | NO | `` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `amount` | `int` | NO | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `services_authorizations`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `73642`  

- **PK:** `id`

**Referenciada por (muestra):**
- `services_authorization_details` → `services_authorizations` (`services_authorization_details_services_authorization_id_foreign`)
- `services_authorizations_images` → `services_authorizations` (`services_authorizations_images_services_authorization_id_foreign`)

**FK salientes:**

- `services_authorizations_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `services_authorizations_diagnostic_id_foreign`: (`diagnostic_id`) → `diagnostics` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `services_authorizations_internment_id_foreign`: (`internment_id`) → `internments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `services_authorizations_user_canceled_foreign`: (`user_canceled`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `services_authorizations_user_edit_id_foreign`: (`user_edit_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `services_authorizations_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `number` | `int` | NO | `` | NULL | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `expiration_date` | `date` | NO | `` | NULL | `` |  |
| `authorization_type` | `int` | NO | `` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `internment_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `treating_doctor` | `varchar(191)` | YES | `` | NULL | `` |  |
| `type_of_patient` | `int` | NO | `` | NULL | `` |  |
| `nro_transaccion_promed` | `varchar(191)` | YES | `` | NULL | `` |  |
| `doctor_id` | `int unsigned` | NO | `` | NULL | `` |  |
| `total` | `int` | NO | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `diagnostic_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `diagnosis` | `varchar(191)` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | NO | `` | NULL | `` |  |
| `private_observation` | `longtext` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `reason_canceled` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_canceled` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_edit_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `services_authorizations_images`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `7699`  

- **PK:** `id`

**FK salientes:**

- `services_authorizations_images_services_authorization_id_foreign`: (`services_authorization_id`) → `services_authorizations` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `original_name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `services_authorization_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `services_doctor_especialities`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `19`  

- **PK:** `id`

**FK salientes:**

- `services_doctor_especialities_especiality_id_foreign`: (`especiality_id`) → `especialities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `services_doctor_especialities_services_doctor_id_foreign`: (`services_doctor_id`) → `services_doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `services_doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `especiality_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `services_doctors`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `5319`  

- **PK:** `id`

**Referenciada por (muestra):**
- `calendar_events_doctor_services` → `services_doctors` (`calendar_events_doctor_services_services_doctor_id_foreign`)
- `client_laboratories` → `services_doctors` (`client_laboratories_services_doctor_id_foreign`)
- `client_services` → `services_doctors` (`client_services_services_doctor_id_foreign`)
- `dental_budget_details` → `services_doctors` (`dental_budget_details_services_doctor_id_foreign`)
- `doctor_type_commissions` → `services_doctors` (`doctor_type_commissions_services_doctor_id_foreign`)
- `laboratory_job_services_doctor` → `services_doctors` (`laboratory_job_services_doctor_services_doctor_id_foreign`)
- `laboratory_price_list_details` → `services_doctors` (`laboratory_price_list_details_services_doctor_id_foreign`)
- `medical_coverages` → `services_doctors` (`medical_coverages_services_doctor_id_foreign`)
- `promotion_services_doctors_details` → `services_doctors` (`promotion_services_doctors_details_services_doctor_id_foreign`)
- `prosthesis_laboratories` → `services_doctors` (`prosthesis_laboratories_services_doctor_id_foreign`)
- `request_changes_details` → `services_doctors` (`request_changes_details_service_doctor_id_foreign`)
- `service_doctor_prices` → `services_doctors` (`service_doctor_prices_services_doctor_id_foreign`)
- `service_doctor_procedures` → `services_doctors` (`service_doctor_procedures_services_doctor_id_foreign`)
- `services_authorization_details` → `services_doctors` (`services_authorization_details_services_doctor_id_foreign`)
- `services_doctor_especialities` → `services_doctors` (`services_doctor_especialities_services_doctor_id_foreign`)
- `services_doctors_session_percentages` → `services_doctors` (`services_doctors_session_percentages_services_doctor_id_foreign`)
- `treatment_convention_exceptions` → `services_doctors` (`treatment_convention_exceptions_services_doctor_id_foreign`)
- `treatment_prices` → `services_doctors` (`treatment_prices_services_doctor_id_foreign`)

**FK salientes:**

- `services_doctors_service_type_id_foreign`: (`service_type_id`) → `services_type_doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `services_doctors_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `odontology` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `general_code` | `int` | YES | `` | NULL | `` |  |
| `not_commissionable` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `consent` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `session_limit` | `int` | YES | `` | NULL | `` |  |
| `service_type_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `authorization_type` | `int` | YES | `` | NULL | `` |  |
| `control_type` | `int` | YES | `` | NULL | `` |  |
| `phase_type` | `int` | YES | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `amount_suggested` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `amount_laboratory` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `cost_service` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `services_doctors_session_percentages`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `624`  

- **PK:** `id`

**FK salientes:**

- `services_doctors_session_percentages_services_doctor_id_foreign`: (`services_doctor_id`) → `services_doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `services_doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `session_number` | `int` | NO | `` | NULL | `` |  |
| `percentage` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `services_type_doctors`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `132`  

- **PK:** `id`

**Referenciada por (muestra):**
- `services_doctors` → `services_type_doctors` (`services_doctors_service_type_id_foreign`)

**FK salientes:**

- `services_type_doctors_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `set_rucs`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `3552644`  

- **PK:** `id`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `nro_ruc` | `varchar(32)` | NO | `` | NULL | `` |  |
| `denominacion` | `varchar(512)` | NO | `` | NULL | `` |  |
| `digito_verificador` | `varchar(8)` | NO | `` | NULL | `` |  |
| `ruc_anterior` | `varchar(32)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `settings`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `settings_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `settings_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `service_block_debt_collector` | `int` | NO | `` | NULL | `` |  |
| `service_block_debit` | `int` | NO | `` | NULL | `` |  |
| `quantity_assignments_collector` | `int` | NO | `` | NULL | `` |  |
| `salary_minimum` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `ips_employee` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `ips_employee_hours` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `ips_employer` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `bonus_percentage` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `bonus_age_child` | `int` | NO | `` | NULL | `` |  |
| `collectors_list_order` | `int unsigned` | NO | `` | 0 | `` |  |
| `branch_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `backwardness` | `int` | YES | `` | NULL | `` |  |
| `maximum_amount_show` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `employee_percentage_advance` | `int` | YES | `` | NULL | `` |  |
| `gratification_discount_percentage` | `int` | NO | `` | NULL | `` |  |
| `tapo_monthly_rate` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `tapo_administrative_expense` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `days_call_again_leads` | `int` | NO | `` | NULL | `` |  |
| `change_rule_services` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `percentage_tapo` | `decimal(8,2)` | YES | `` | NULL | `` |  |
| `daily_minimun_amount` | `decimal(8,2)` | YES | `` | NULL | `` |  |
| `rrhh_amount_limit` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `module_app_collector` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `module_app_collector_calculation` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `module_app_collector_amount` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `days_suspension_accrual` | `int` | NO | `` | NULL | `` |  |
| `monthly_ips_daily_amount` | `decimal(8,2)` | YES | `` | NULL | `` |  |
| `jornalero_ips_daily_amount` | `decimal(8,2)` | YES | `` | NULL | `` |  |
| `monthly_ips_hourly_amount` | `decimal(8,2)` | YES | `` | NULL | `` |  |
| `jornalero_ips_hourly_amount` | `decimal(8,2)` | YES | `` | NULL | `` |  |
| `kindergarten_bonus` | `decimal(8,2)` | YES | `` | NULL | `` |  |
| `hourly_ips_amount` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `tapo_administrative_expenses_max_limit_fixed_term` | `decimal(12,2)` | YES | `` | NULL | `` |  |
| `tapo_administrative_expenses_min_limit_fixed_term` | `decimal(12,2)` | YES | `` | NULL | `` |  |
| `infusions_email_notifications` | `longtext` | YES | `` | NULL | `` |  |

### `sms_campaigns`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2351`  

- **PK:** `id`

**Referenciada por (muestra):**
- `sms_messages` → `sms_campaigns` (`sms_messages_sms_campaign_id_foreign`)

**FK salientes:**

- `sms_campaigns_client_city_id_foreign`: (`client_city_id`) → `cities` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sms_campaigns_collection_section_id_foreign`: (`collection_section_id`) → `collection_sections` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sms_campaigns_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sms_campaigns_insurance_id_foreign`: (`insurance_id`) → `insurances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sms_campaigns_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `type` | `int unsigned` | NO | `` | NULL | `` |  |
| `all_clients` | `tinyint(1)` | YES | `` | 0 | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `collection_section_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `insurance_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `contract_status` | `int unsigned` | YES | `` | NULL | `` |  |
| `client_type` | `int unsigned` | YES | `` | NULL | `` |  |
| `client_city_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `message` | `longtext` | NO | `` | NULL | `` |  |
| `send_after` | `datetime` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `sms_messages`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2403916`  

- **PK:** `id`

**Referenciada por (muestra):**
- `sms_tokens` → `sms_messages` (`sms_tokens_sms_message_id_foreign`)

**FK salientes:**

- `sms_messages_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sms_messages_sms_campaign_id_foreign`: (`sms_campaign_id`) → `sms_campaigns` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sms_messages_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `sms_campaign_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `type` | `int unsigned` | NO | `` | NULL | `` |  |
| `client_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `number` | `varchar(191)` | NO | `` | NULL | `` |  |
| `message` | `longtext` | NO | `` | NULL | `` |  |
| `status` | `int unsigned` | NO | `` | 1 | `` |  |
| `gateway_status` | `int unsigned` | NO | `` | 0 | `` |  |
| `error_message` | `varchar(191)` | YES | `` | NULL | `` |  |
| `sent_at` | `datetime` | YES | `` | NULL | `` |  |
| `status_at` | `datetime` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `sms_messages_inboxes`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `8799`  

- **PK:** `id`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `date` | `datetime` | NO | `` | NULL | `` |  |
| `number` | `varchar(191)` | NO | `` | NULL | `` |  |
| `message` | `varchar(191)` | NO | `` | NULL | `` |  |
| `request` | `longtext` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `sms_tokens`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `21687`  

- **PK:** `id`

**FK salientes:**

- `sms_tokens_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sms_tokens_calendar_event_id_foreign`: (`calendar_event_id`) → `calendar_events` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sms_tokens_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sms_tokens_dental_office_id_foreign`: (`dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sms_tokens_doctor_id_foreign`: (`doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `sms_tokens_sms_message_id_foreign`: (`sms_message_id`) → `sms_messages` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `calendar_event_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `sms_message_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `token` | `longtext` | NO | `` | NULL | `` |  |
| `dental_office_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `calification` | `int` | YES | `` | NULL | `` |  |
| `status` | `int` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `social_reasons`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `7`  

- **PK:** `id`

**Referenciada por (muestra):**
- `accounting_closings` → `social_reasons` (`accounting_closings_social_reason_id_foreign`)
- `accounting_entries` → `social_reasons` (`accounting_entries_social_reason_id_foreign`)
- `accounting_plan_unions` → `social_reasons` (`accounting_plan_unions_social_reason_id_foreign`)
- `accounting_plans` → `social_reasons` (`accounting_plans_social_reason_id_foreign`)
- `accounting_type_ivas` → `social_reasons` (`accounting_type_ivas_social_reason_id_foreign`)
- `bank_account_balances` → `social_reasons` (`bank_account_balances_social_reason_id_foreign`)
- `bank_accounts` → `social_reasons` (`bank_accounts_social_reason_id_foreign`)
- `bank_transfers` → `social_reasons` (`bank_transfers_social_reason_id_foreign`)
- `calendar_payments` → `social_reasons` (`calendar_payments_social_reason_id_foreign`)
- `contract_debiteds` → `social_reasons` (`contract_debiteds_social_reason_id_foreign`)
- `cost_centers` → `social_reasons` (`cost_centers_social_reason_id_foreign`)
- `creditors` → `social_reasons` (`creditors_social_reason_id_foreign`)
- `dismissals` → `social_reasons` (`dismissals_social_reason_id_foreign`)
- `employee_contracts` → `social_reasons` (`employee_contracts_social_reason_id_foreign`)
- `employee_discount_massives` → `social_reasons` (`employee_discount_massives_social_reason_id_foreign`)
- `engagement_letters` → `social_reasons` (`engagement_letters_social_reason_id_foreign`)
- `enterprises` → `social_reasons` (`enterprises_social_reason_id_foreign`)
- `model_accounting_entries` → `social_reasons` (`model_accounting_entries_social_reason_id_foreign`)
- `op_massives` → `social_reasons` (`op_massives_social_reason_id_foreign`)
- `patronal_numbers` → `social_reasons` (`patronal_numbers_social_reason_id_foreign`)
- `payroll_salaries` → `social_reasons` (`payroll_salaries_social_reason_id_foreign`)
- `price_update_logs` → `social_reasons` (`price_update_logs_social_reason_id_foreign`)
- `provider_autorizathion_payments` → `social_reasons` (`provider_autorizathion_payments_social_reason_id_foreign`)
- `purchases` → `social_reasons` (`purchases_social_reason_id_foreign`)
- `purchases_existences` → `social_reasons` (`purchases_existences_social_reason_id_foreign`)
- `purchases_orders` → `social_reasons` (`purchases_orders_social_reason_id_foreign`)
- `purchases_product_costs` → `social_reasons` (`purchases_product_costs_social_reason_id_foreign`)
- `purchases_product_inventories` → `social_reasons` (`purchases_product_inventories_social_reason_id_foreign`)
- `purchases_product_prices` → `social_reasons` (`purchases_product_prices_social_reason_id_foreign`)
- `restockings` → `social_reasons` (`restockings_social_reason_id_foreign`)

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `razon_social` | `varchar(191)` | NO | `` | NULL | `` |  |
| `ruc` | `varchar(191)` | NO | `` | NULL | `` |  |
| `patronal_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `label` | `varchar(191)` | YES | `` | NULL | `` |  |
| `status` | `tinyint` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `stampeds`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `200`  

- **PK:** `id`

**Referenciada por (muestra):**
- `invoice_masives` → `stampeds` (`invoice_masives_stamped_id_foreign`)
- `stampeds` → `stampeds` (`stampeds_next_stamped_id_foreign`)
- `voucher_boxes` → `stampeds` (`voucher_boxes_stamped_id_foreign`)
- `voucher_boxes` → `stampeds` (`voucher_boxes_stamped_note_credit_id_foreign`)
- `vouchers` → `stampeds` (`vouchers_stamped_id_foreign`)

**FK salientes:**

- `stampeds_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `stampeds_next_stamped_id_foreign`: (`next_stamped_id`) → `stampeds` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `stampeds_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `number` | `varchar(191)` | NO | `` | NULL | `` |  |
| `authorization` | `varchar(191)` | NO | `` | NULL | `` |  |
| `from_date` | `date` | NO | `` | NULL | `` |  |
| `until_date` | `date` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `method_print` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `next_stamped_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `tablets`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `17`  

- **PK:** `id`

**Referenciada por (muestra):**
- `users` → `tablets` (`users_poll_tablet_id_foreign`)

**FK salientes:**

- `tablets_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `tapo_idem_fees`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1050`  

- **PK:** `id`

**FK salientes:**

- `tapo_idem_fees_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `tapo_idem_fees_purchase_id_foreign`: (`purchase_id`) → `purchases` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `number` | `int` | NO | `` | NULL | `` |  |
| `expiration` | `date` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `residue` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `purchase_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `task_statuses`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `4`  

- **PK:** `id`

**Referenciada por (muestra):**
- `sale_opportunity_tasks` → `task_statuses` (`sale_opportunity_tasks_task_status_id_foreign`)

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `is_initial_default` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `is_final_default` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `order` | `int` | NO | `` | 0 | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `task_types`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2`  

- **PK:** `id`

**Referenciada por (muestra):**
- `sale_opportunity_tasks` → `task_types` (`sale_opportunity_tasks_task_type_id_foreign`)

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `te_buscamos`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1077`  

- **PK:** `id`

**FK salientes:**

- `te_buscamos_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `response` | `longtext` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `temp_contratos`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `cuenta` | `varchar(100)` | YES | `` | NULL | `` |  |
| `cantidad` | `int` | YES | `` | NULL | `` |  |
| `contract_id` | `int` | YES | `` | NULL | `` |  |
| `test` | `int` | YES | `` | NULL | `` |  |

### `temporary_activations`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `4065`  

- **PK:** `id`

**FK salientes:**

- `temporary_activations_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `temporary_activations_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `temporary_activations_user_processed_id_foreign`: (`user_processed_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `from_date` | `date` | NO | `` | NULL | `` |  |
| `expiration_date` | `date` | NO | `` | NULL | `` |  |
| `amount_to_pay` | `int` | NO | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `processed_date` | `datetime` | YES | `` | NULL | `` |  |
| `user_processed_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `modify_convention` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `ticket_copies`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `41446`  

- **PK:** `id`

**FK salientes:**

- `ticket_copies_ticket_id_foreign`: (`ticket_id`) → `tickets` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `ticket_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `cc` | `varchar(191)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `ticket_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `18492`  

- **PK:** `id`

**FK salientes:**

- `ticket_details_agent_id_foreign`: (`agent_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `ticket_details_ticket_id_foreign`: (`ticket_id`) → `tickets` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `ticket_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `agent_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `ticket_note_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `17271`  

- **PK:** `id`

**FK salientes:**

- `ticket_note_details_ticket_note_id_foreign`: (`ticket_note_id`) → `ticket_notes` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `ticket_note_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `file` | `longtext` | NO | `` | NULL | `` |  |
| `original_name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `ticket_notes`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `54187`  

- **PK:** `id`

**Referenciada por (muestra):**
- `ticket_note_details` → `ticket_notes` (`ticket_note_details_ticket_note_id_foreign`)

**FK salientes:**

- `ticket_notes_ticket_id_foreign`: (`ticket_id`) → `tickets` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `ticket_notes_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `ticket_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `note` | `longtext` | YES | `` | NULL | `` |  |
| `comment_type` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `ticket_tasks`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `936`  

- **PK:** `id`

**FK salientes:**

- `ticket_tasks_ticket_id_foreign`: (`ticket_id`) → `tickets` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `ticket_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `task` | `longtext` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `tickets`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `32768`  

- **PK:** `id`

**Referenciada por (muestra):**
- `medical_equipments_verifications` → `tickets` (`medical_equipments_verifications_ticket_id_foreign`)
- `ticket_copies` → `tickets` (`ticket_copies_ticket_id_foreign`)
- `ticket_details` → `tickets` (`ticket_details_ticket_id_foreign`)
- `ticket_notes` → `tickets` (`ticket_notes_ticket_id_foreign`)
- `ticket_tasks` → `tickets` (`ticket_tasks_ticket_id_foreign`)

**FK salientes:**

- `tickets_business_department_id_foreign`: (`business_department_id`) → `business_departments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `tickets_contact_id_foreign`: (`contact_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `tickets_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `tickets_finished_user_id_foreign`: (`finished_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `tickets_from_business_department_id_foreign`: (`from_business_department_id`) → `business_departments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `tickets_implementation_user_id_foreign`: (`implementation_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `tickets_last_note_user_id_foreign`: (`last_note_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `tickets_processed_user_id_foreign`: (`processed_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `tickets_received_user_id_foreign`: (`received_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `tickets_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `business_department_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `contact_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `from_business_department_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `sender` | `varchar(191)` | YES | `` | NULL | `` |  |
| `cc` | `varchar(191)` | YES | `` | NULL | `` |  |
| `affair` | `varchar(191)` | NO | `` | NULL | `` |  |
| `description` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `priority_order` | `int` | YES | `` | NULL | `` |  |
| `priority` | `int` | NO | `` | 1 | `` |  |
| `start` | `datetime` | YES | `` | NULL | `` |  |
| `end` | `datetime` | YES | `` | NULL | `` |  |
| `group_id` | `int` | YES | `` | NULL | `` |  |
| `complexity_level` | `smallint` | YES | `` | NULL | `` |  |
| `ticket_type` | `int` | YES | `` | NULL | `` |  |
| `label` | `int` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `received_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `received_at` | `datetime` | YES | `` | NULL | `` |  |
| `finished_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `finished_at` | `datetime` | YES | `` | NULL | `` |  |
| `processed_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `processed_at` | `datetime` | YES | `` | NULL | `` |  |
| `implementation_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `implementation_at` | `datetime` | YES | `` | NULL | `` |  |
| `last_note_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `first_message_id` | `varchar(191)` | YES | `` | NULL | `` |  |
| `last_message_id` | `varchar(191)` | YES | `` | NULL | `` |  |
| `references` | `varchar(191)` | YES | `` | NULL | `` |  |
| `ticket_reason` | `varchar(191)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `json_request` | `longtext` | YES | `` | NULL | `` |  |

### `tracking_team_users`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `10`  

- **PK:** `id`

**FK salientes:**

- `tracking_team_users_agent_id_foreign`: (`agent_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `tracking_team_users_tracking_team_id_foreign`: (`tracking_team_id`) → `tracking_teams` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `agent_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `tracking_team_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `tracking_teams`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `12`  

- **PK:** `id`

**Referenciada por (muestra):**
- `agent_schedules` → `tracking_teams` (`agent_schedules_tracking_team_id_foreign`)
- `tracking_team_users` → `tracking_teams` (`tracking_team_users_tracking_team_id_foreign`)
- `users` → `tracking_teams` (`users_tracking_team_id_foreign`)

**FK salientes:**

- `tracking_teams_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `varchar(191)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `treatment_convention_exceptions`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `10`  

- **PK:** `id`

**FK salientes:**

- `treatment_convention_exceptions_services_doctor_id_foreign`: (`services_doctor_id`) → `services_doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `treatment_convention_exceptions_treatment_convention_id_foreign`: (`treatment_convention_id`) → `treatment_conventions` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `treatment_convention_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `services_doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `treatment_convention_settings`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `8`  

- **PK:** `id`

**FK salientes:**

- `treatment_convention_settings_new_convention_id_foreign`: (`new_convention_id`) → `treatment_conventions` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `treatment_convention_settings_treatment_convention_id_foreign`: (`treatment_convention_id`) → `treatment_conventions` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `treatment_convention_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `math_operation` | `char(2)` | NO | `` | NULL | `` |  |
| `quotas_expirations` | `int` | NO | `` | NULL | `` |  |
| `new_convention_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `treatment_conventions`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `29`  

- **PK:** `id`

**Referenciada por (muestra):**
- `dental_budgets` → `treatment_conventions` (`dental_budgets_old_treatment_convention_id_foreign`)
- `dental_budgets` → `treatment_conventions` (`dental_budgets_treatment_convention_id_foreign`)
- `insurances` → `treatment_conventions` (`insurances_treatment_convention_id_foreign`)
- `request_changes` → `treatment_conventions` (`request_changes_new_treatment_convention_id_foreign`)
- `request_changes` → `treatment_conventions` (`request_changes_old_treatment_convention_id_foreign`)
- `treatment_convention_exceptions` → `treatment_conventions` (`treatment_convention_exceptions_treatment_convention_id_foreign`)
- `treatment_convention_settings` → `treatment_conventions` (`treatment_convention_settings_new_convention_id_foreign`)
- `treatment_convention_settings` → `treatment_conventions` (`treatment_convention_settings_treatment_convention_id_foreign`)
- `treatment_prices` → `treatment_conventions` (`treatment_prices_treatment_convention_id_foreign`)

**FK salientes:**

- `treatment_conventions_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `treatment_prices`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `66250`  

- **PK:** `id`

**FK salientes:**

- `treatment_prices_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `treatment_prices_services_doctor_id_foreign`: (`services_doctor_id`) → `services_doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `treatment_prices_treatment_convention_id_foreign`: (`treatment_convention_id`) → `treatment_conventions` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `services_doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `treatment_convention_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `wholesale_price` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `finance_price` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `cost_price` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `doctor_commission_price` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `turn_caller_images`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `25`  

- **PK:** `id`

**FK salientes:**

- `turn_caller_images_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE SET NULL
- `turn_caller_images_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `image` | `varchar(191)` | NO | `` | NULL | `` |  |
| `order` | `tinyint` | NO | `` | 0 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |

### `turn_caller_occupational_meds`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `6341`  

- **PK:** `id`

**FK salientes:**

- `turn_caller_occupational_meds_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `turn_caller_occupational_meds_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `turn_caller_occupational_meds_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `consulting_type` | `int` | NO | `` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `turn_callers`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `77059`  

- **PK:** `id`

**FK salientes:**

- `turn_callers_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `turn_callers_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `turn_callers_doctor_id_foreign`: (`doctor_id`) → `doctors` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `turn_callers_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `turn_callers_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `status` | `int` | NO | `` | NULL | `` |  |
| `box_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `doctor_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `turn_portfolio_movements`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `42838`  

- **PK:** `id`

**FK salientes:**

- `turn_portfolio_movements_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `turn_portfolio_movements_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `turn_portfolio_movements_destination_turn_portfolio_id_foreign`: (`destination_turn_portfolio_id`) → `client_turn_portfolios` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `turn_portfolio_movements_origin_turn_portfolio_id_foreign`: (`origin_turn_portfolio_id`) → `client_turn_portfolios` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `turn_portfolio_movements_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `origin_turn_portfolio_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `destination_turn_portfolio_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `type` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `reason` | `mediumtext` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `type_events`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**Referenciada por (muestra):**
- `request_eme_serv_details` → `type_events` (`request_eme_serv_details_type_event_id_foreign`)

**FK salientes:**

- `type_events_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `type_section_commissions`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `45`  

- **PK:** `id`

**FK salientes:**

- `type_section_commissions_collection_sections_id_foreign`: (`collection_sections_id`) → `collection_sections` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `collection_sections_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `type_commission` | `int` | NO | `` | NULL | `` |  |
| `amount_commission` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `commission_goal` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `user_cases_types`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `580`  

- **PK:** `id`

**FK salientes:**

- `user_cases_types_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `type_case` | `int unsigned` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `user_invoices`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2972`  

- **PK:** `id`

**FK salientes:**

- `user_invoices_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `user_invoices_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `expedition_branch` | `int` | NO | `` | NULL | `` |  |
| `expedition_box` | `int` | NO | `` | NULL | `` |  |
| `stamped` | `int` | NO | `` | NULL | `` |  |
| `expiration` | `date` | NO | `` | NULL | `` |  |
| `cost_center` | `int` | YES | `` | NULL | `` |  |
| `invoice` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `note_credit` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `transfer` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `reason_delete` | `varchar(191)` | YES | `` | NULL | `` |  |
| `delete_date` | `datetime` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `user_type_modifications`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `3260`  

- **PK:** `id`

**FK salientes:**

- `user_type_modifications_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `type_modification` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `users`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `3691`  

- **PK:** `id`

**Referenciada por (muestra):**
- `accounting_entries` → `users` (`accounting_entries_user_id_foreign`)
- `accounting_types` → `users` (`accounting_types_user_id_foreign`)
- `additional_services` → `users` (`additional_services_user_id_foreign`)
- `agent_schedules` → `users` (`agent_schedules_created_user_id_foreign`)
- `agent_schedules` → `users` (`agent_schedules_deleted_user_id_foreign`)
- `anticipated_cancelations` → `users` (`anticipated_cancelations_user_delete_id_foreign`)
- `anticipated_cancelations` → `users` (`anticipated_cancelations_user_id_foreign`)
- `assistances` → `users` (`assistances_user_id_foreign`)
- `balance_changes` → `users` (`balance_changes_user_id_deleted_foreign`)
- `balance_changes` → `users` (`balance_changes_user_id_foreign`)
- `bancard_cards` → `users` (`bancard_cards_deleted_user_id_foreign`)
- `bancard_cards` → `users` (`bancard_cards_user_id_foreign`)
- `bank_accounts` → `users` (`bank_accounts_user_id_foreign`)
- `bank_concepts` → `users` (`bank_concepts_user_id_foreign`)
- `bank_details` → `users` (`bank_details_print_user_id_foreign`)
- `bank_details` → `users` (`bank_details_user_deleted_foreign`)
- `bank_details` → `users` (`bank_details_user_id_foreign`)
- `bank_transfers` → `users` (`bank_transfers_user_id_foreign`)
- `bank_transfers` → `users` (`bank_transfers_user_rejected_id_foreign`)
- `banks` → `users` (`banks_user_id_foreign`)
- `bicsas` → `users` (`bicsas_user_id_foreign`)
- `branch_cost_centers` → `users` (`branch_cost_centers_user_id_foreign`)
- `branches` → `users` (`branches_operational_manager_id_foreign`)
- `branches` → `users` (`branches_user_id_foreign`)
- `cadastres` → `users` (`cadastres_user_id_foreign`)
- `calendar_event_chats` → `users` (`calendar_event_chats_user_id_foreign`)
- `calendar_events` → `users` (`calendar_events_absent_user_id_foreign`)
- `calendar_events` → `users` (`calendar_events_cancel_user_id_foreign`)
- `calendar_events` → `users` (`calendar_events_confirm_user_id_foreign`)
- `calendar_events` → `users` (`calendar_events_user_id_foreign`)
- `calendar_payments` → `users` (`calendar_payments_user_delete_id_foreign`)
- `calendar_payments` → `users` (`calendar_payments_user_id_foreign`)
- `calendar_payments` → `users` (`calendar_payments_user_rescheduled_id_foreign`)
- `call_center_calls` → `users` (`call_center_calls_user_id_foreign`)
- `call_center_pause_motives` → `users` (`call_center_pause_motives_user_id_foreign`)
- `call_center_pauses` → `users` (`call_center_pauses_user_id_foreign`)
- `card_prints` → `users` (`card_prints_user_id_foreign`)
- `cases_to_calls` → `users` (`cases_to_calls_cases_manager_id_foreign`)
- `cases_to_calls` → `users` (`cases_to_calls_delete_user_id_foreign`)
- `cases_to_calls` → `users` (`cases_to_calls_user_id_foreign`)
- *… y 388 restricciones más*

**FK salientes:**

- `users_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `users_business_department_id_foreign`: (`business_department_id`) → `business_departments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `users_collection_sections_id_foreign`: (`collection_sections_id`) → `collection_sections` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `users_deposit_id_foreign`: (`deposit_id`) → `deposits` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `users_employee_contract_assistance_id_foreign`: (`employee_contract_assistance_id`) → `employee_contract_assistances` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `users_laboratory_id_foreign`: (`laboratory_id`) → `laboratories` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `users_person_id_foreign`: (`person_id`) → `people` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `users_poll_tablet_id_foreign`: (`poll_tablet_id`) → `tablets` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `users_seller_supervisor_id_foreign`: (`seller_supervisor_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `users_seller_team_id_foreign`: (`seller_team_id`) → `seller_teams` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `users_tracking_team_id_foreign`: (`tracking_team_id`) → `tracking_teams` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `first_name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `last_name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `preferred_first_name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `preferred_last_name` | `varchar(191)` | YES | `` | NULL | `` |  |
| `username` | `varchar(191)` | NO | `UNI` | NULL | `` |  |
| `email` | `varchar(191)` | NO | `UNI` | NULL | `` |  |
| `external_id` | `varchar(100)` | YES | `MUL` | NULL | `` |  |
| `employee_contract_assistance_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `cellphone` | `varchar(191)` | YES | `` | NULL | `` |  |
| `tickets_agent` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `collector` | `tinyint(1)` | YES | `MUL` | NULL | `` |  |
| `emergency_dispatcher` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `emergency_professional` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `emergency_on_guard` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `collector_quantity_assignments` | `int` | YES | `` | NULL | `` |  |
| `seller_supervisor` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `seller_supervisor_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `team_leader` | `int unsigned` | NO | `` | 0 | `` |  |
| `seller_supervisor_percentage` | `int` | YES | `` | NULL | `` |  |
| `sales_closer` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `seller` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `doctor_manager` | `int` | YES | `` | NULL | `` |  |
| `percentage_commission` | `int` | YES | `` | NULL | `` |  |
| `seller_team_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `seller_type` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `seller_city` | `int unsigned` | YES | `` | NULL | `` |  |
| `laboratory_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `deposit_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `collection_manager` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `collection_sections_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `call_center_queue` | `varchar(191)` | YES | `` | NULL | `` |  |
| `call_center_agent` | `varchar(191)` | YES | `` | NULL | `` |  |
| `call_center_internal` | `varchar(191)` | YES | `` | NULL | `` |  |
| `chip_id` | `int` | YES | `` | NULL | `` |  |
| `password` | `varchar(191)` | NO | `` | NULL | `` |  |
| `source_db` | `enum('DB1','DB2')` | NO | `` | NULL | `` |  |
| `old_table` | `varchar(191)` | NO | `` | NULL | `` |  |
| `old_id` | `int` | NO | `` | NULL | `` |  |
| `status` | `int unsigned` | NO | `MUL` | 0 | `` |  |
| `update_file` | `int` | NO | `` | 0 | `` |  |
| `update_file_date` | `date` | YES | `` | NULL | `` |  |
| `collector_profile` | `varchar(191)` | YES | `` | NULL | `` |  |
| `api_token` | `varchar(191)` | YES | `` | NULL | `` |  |
| `remember_token` | `varchar(100)` | YES | `` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `branches_to_manage` | `varchar(191)` | YES | `` | NULL | `` |  |
| `person_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `generic_user` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `type_printer` | `int` | YES | `` | NULL | `` |  |
| `enterprise_id` | `int` | YES | `` | NULL | `` |  |
| `online_user` | `int` | YES | `` | NULL | `` |  |
| `signature_image` | `varchar(191)` | YES | `` | NULL | `` |  |
| `location` | `varchar(191)` | YES | `` | NULL | `` |  |
| `date_last_location` | `datetime` | YES | `` | NULL | `` |  |
| `from_time_assignation` | `time` | NO | `` | 00:00:00 | `` |  |
| `until_time_assignation` | `time` | NO | `` | 23:59:59 | `` |  |
| `collector_percentage_commission` | `int` | YES | `` | NULL | `` |  |
| `collector_percentage_commission_holidays` | `int` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `document_number` | `int` | NO | `` | NULL | `` |  |
| `poll_tablet_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `cases_to_call_manager` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `tracking_team_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `password_changed_at` | `date` | YES | `` | NULL | `` |  |
| `password_token` | `varchar(191)` | YES | `` | NULL | `` |  |
| `business_department_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `nickname` | `varchar(191)` | YES | `` | NULL | `` |  |
| `external_nick` | `varchar(191)` | YES | `` | NULL | `` |  |

### `vacations`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `0`  

- **PK:** `id`

**FK salientes:**

- `vacations_delete_user_id_foreign`: (`delete_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `vacations_employee_contract_id_foreign`: (`employee_contract_id`) → `employee_contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `vacations_people_id_foreign`: (`people_id`) → `people` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `vacations_requesting_user_id_foreign`: (`requesting_user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `vacations_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `people_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `employee_contract_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `requesting_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `from_date` | `date` | NO | `` | NULL | `` |  |
| `expiration_date` | `date` | NO | `` | NULL | `` |  |
| `days` | `int` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `delete_user_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `reason_deleted` | `varchar(191)` | YES | `` | NULL | `` |  |
| `date_delete` | `date` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `viatic_types`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `158`  

- **PK:** `id`

**FK salientes:**

- `viatic_types_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `viatic_types_collector_id_foreign`: (`collector_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `viatic_types_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `viatic_types_scale_viatic_id_foreign`: (`scale_viatic_id`) → `scale_viatics` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `viatic_types_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `scale_viatic_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `type` | `int` | NO | `` | 1 | `` |  |
| `collector_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `type_amount` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `from_amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `until_amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `percentage_holidays` | `int` | NO | `` | 100 | `` |  |
| `percentage` | `int` | NO | `` | 100 | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `voucher_boxes`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `438`  

- **PK:** `id`

**Referenciada por (muestra):**
- `cash_box_voucher_boxes` → `voucher_boxes` (`cash_box_voucher_boxes_voucher_box_id_foreign`)
- `invoice_masives` → `voucher_boxes` (`invoice_masives_voucher_box_id_foreign`)
- `vouchers` → `voucher_boxes` (`vouchers_invoice_box_id_foreign`)

**FK salientes:**

- `invoice_boxes_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `invoice_boxes_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `voucher_boxes_dental_office_id_foreign`: (`dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `voucher_boxes_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `voucher_boxes_stamped_id_foreign`: (`stamped_id`) → `stampeds` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `voucher_boxes_stamped_note_credit_id_foreign`: (`stamped_note_credit_id`) → `stampeds` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `voucher_boxes_user_deleted_id_foreign`: (`user_deleted_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `default_box` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `last_voucher_number` | `int` | YES | `` | NULL | `` |  |
| `last_credit_note` | `int` | YES | `` | NULL | `` |  |
| `collector_box` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `type` | `int unsigned` | NO | `` | 1 | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `voucher_number` | `int unsigned` | NO | `` | NULL | `` |  |
| `stamped_note_credit_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `stamped_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `dental_office_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `from_invoice_number` | `int` | YES | `` | NULL | `` |  |
| `until_invoice_number` | `int` | YES | `` | NULL | `` |  |
| `from_note_credit_number` | `int` | YES | `` | NULL | `` |  |
| `until_note_credit_number` | `int` | YES | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `user_deleted_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |

### `voucher_collect_payments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `138860`  

- **PK:** `id`

**FK salientes:**

- `voucher_collect_payments_voucher_collect_id_foreign`: (`voucher_collect_id`) → `voucher_collects` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `voucher_collect_payments_voucher_id_foreign`: (`voucher_id`) → `vouchers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `voucher_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `voucher_collect_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `not_commisionable_collector` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `voucher_collects`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `142913`  

- **PK:** `id`

**Referenciada por (muestra):**
- `voucher_collect_payments` → `voucher_collects` (`voucher_collect_payments_voucher_collect_id_foreign`)

**FK salientes:**

- `voucher_collects_voucher_detail_id_foreign`: (`voucher_detail_id`) → `voucher_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `voucher_collects_voucher_id_foreign`: (`voucher_id`) → `vouchers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `voucher_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `voucher_detail_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `number` | `int` | NO | `` | NULL | `` |  |
| `expiration` | `date` | NO | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `residue` | `decimal(11,2)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `voucher_detail_existences`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `9482`  

- **PK:** `id`

**FK salientes:**

- `voucher_detail_existences_purchases_existence_id_foreign`: (`purchases_existence_id`) → `purchases_existences` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `voucher_detail_existences_voucher_detail_id_foreign`: (`voucher_detail_id`) → `voucher_details` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `voucher_detail_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `purchases_existence_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `quantity_residue` | `int` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `voucher_details`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2312361`  

- **PK:** `id`

**Referenciada por (muestra):**
- `commissions` → `voucher_details` (`commissions_voucher_detail_id_foreign`)
- `doctor_commission_details` → `voucher_details` (`doctor_commission_details_voucher_detail_id_foreign`)
- `payments` → `voucher_details` (`payments_voucher_detail_id_foreign`)
- `voucher_collects` → `voucher_details` (`voucher_collects_voucher_detail_id_foreign`)
- `voucher_detail_existences` → `voucher_details` (`voucher_detail_existences_voucher_detail_id_foreign`)

**FK salientes:**

- `voucher_details_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `voucher_details_occ_med_product_id_foreign`: (`occ_med_product_id`) → `occupational_medicine_products` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `voucher_details_purchases_product_id_foreign`: (`purchases_product_id`) → `purchases_products` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `voucher_details_service_invoice_id_foreign`: (`service_invoice_id`) → `service_invoices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `voucher_details_voucher_id_foreign`: (`voucher_id`) → `vouchers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `voucher_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `service_invoice_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `purchases_product_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `occ_med_product_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `description` | `longtext` | NO | `` | NULL | `` |  |
| `quantity` | `int` | NO | `` | NULL | `` |  |
| `quantity_residue` | `int` | NO | `` | NULL | `` |  |
| `amount` | `decimal(13,2)` | NO | `` | NULL | `` |  |
| `residue` | `decimal(12,2)` | YES | `` | NULL | `` |  |
| `excenta` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `iva5` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `iva10` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `voucher_payments`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2031116`  

- **PK:** `id`

**Referenciada por (muestra):**
- `collection_income_details` → `voucher_payments` (`collection_income_details_voucher_payment_id_foreign`)
- `commission_payment_details` → `voucher_payments` (`commission_payment_details_voucher_payment_id_foreign`)

**FK salientes:**

- `voucher_payments_payment_method_id_foreign`: (`payment_method_id`) → `payment_methods` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `voucher_payments_voucher_id_foreign`: (`voucher_id`) → `vouchers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `voucher_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `payment_method_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `check_number` | `varchar(191)` | YES | `` | NULL | `` |  |
| `check_expiration` | `date` | YES | `` | NULL | `` |  |
| `amount` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `residue` | `decimal(11,2)` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `vouchers`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `2325002`  

- **PK:** `id`

**Referenciada por (muestra):**
- `bank_transfer_details` → `vouchers` (`bank_transfer_details_voucher_id_foreign`)
- `cash_box_details` → `vouchers` (`cash_box_details_voucher_id_foreign`)
- `client_laboratories` → `vouchers` (`client_laboratories_voucher_id_foreign`)
- `client_service_advances` → `vouchers` (`client_service_advances_voucher_id_foreign`)
- `commission_payment_details` → `vouchers` (`commission_payment_details_voucher_id_foreign`)
- `commissions` → `vouchers` (`commissions_voucher_id_foreign`)
- `contract_fee_vouchers` → `vouchers` (`contract_fee_vouchers_voucher_id_foreign`)
- `contracts` → `vouchers` (`contracts_voucher_id_foreign`)
- `contracts_vouchers_details` → `vouchers` (`contracts_vouchers_details_voucher_id_foreign`)
- `esth_client_services_advances` → `vouchers` (`esth_client_services_advances_voucher_id_foreign`)
- `invoice_masive_details` → `vouchers` (`invoice_masive_details_voucher_id_foreign`)
- `occ_med_client_advances` → `vouchers` (`occ_med_client_advances_voucher_id_foreign`)
- `payments` → `vouchers` (`payments_voucher_id_foreign`)
- `pending_invoices` → `vouchers` (`pending_invoices_voucher_id_foreign`)
- `quality_controls` → `vouchers` (`quality_controls_voucher_id_foreign`)
- `raffles_cupons` → `vouchers` (`raffles_cupons_voucher_id_foreign`)
- `voucher_collect_payments` → `vouchers` (`voucher_collect_payments_voucher_id_foreign`)
- `voucher_collects` → `vouchers` (`voucher_collects_voucher_id_foreign`)
- `voucher_details` → `vouchers` (`voucher_details_voucher_id_foreign`)
- `voucher_payments` → `vouchers` (`voucher_payments_voucher_id_foreign`)
- `vouchers` → `vouchers` (`vouchers_invoice_id_foreign`)

**FK salientes:**

- `vouchers_bank_account_id_foreign`: (`bank_account_id`) → `bank_accounts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `vouchers_branch_id_foreign`: (`branch_id`) → `branches` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `vouchers_client_id_foreign`: (`client_id`) → `clients` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `vouchers_cnote_reason_id_foreign`: (`cnote_reason_id`) → `credit_note_reason` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `vouchers_contract_fee_id_foreign`: (`contract_fee_id`) → `contract_fees` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `vouchers_contract_id_foreign`: (`contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `vouchers_currency_id_foreign`: (`currency_id`) → `currencies` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `vouchers_debt_collector_id_foreign`: (`debt_collector_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `vouchers_dental_office_id_foreign`: (`dental_office_id`) → `dental_offices` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `vouchers_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `vouchers_invoice_box_id_foreign`: (`voucher_box_id`) → `voucher_boxes` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `vouchers_invoice_id_foreign`: (`invoice_id`) → `vouchers` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `vouchers_payment_id_foreign`: (`payment_id`) → `payments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `vouchers_stamped_id_foreign`: (`stamped_id`) → `stampeds` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `vouchers_tapo_contract_id_foreign`: (`tapo_contract_id`) → `contracts` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `vouchers_user_canceled_foreign`: (`user_canceled`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `vouchers_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `unique_id` | `bigint` | YES | `UNI` | NULL | `` |  |
| `date` | `date` | NO | `` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `branch_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `currency_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `change` | `int` | NO | `` | NULL | `` |  |
| `voucher_box_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `stamped_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `voucher_condition` | `tinyint unsigned` | NO | `` | NULL | `` |  |
| `voucher_type` | `tinyint unsigned` | NO | `` | NULL | `` |  |
| `voucher_number` | `int` | NO | `` | NULL | `` |  |
| `voucher_fullnumber` | `varchar(191)` | YES | `` | NULL | `` |  |
| `invoice_fullnumber` | `varchar(191)` | YES | `` | NULL | `` |  |
| `invoice_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `purchase_statement` | `varchar(191)` | YES | `` | NULL | `` |  |
| `dental_office_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `expiration` | `date` | YES | `` | NULL | `` |  |
| `client_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `insurer` | `tinyint` | YES | `` | NULL | `` |  |
| `razon_social` | `varchar(191)` | NO | `` | NULL | `` |  |
| `ruc` | `varchar(191)` | NO | `` | NULL | `` |  |
| `type_document` | `int` | NO | `` | 11 | `` |  |
| `phone` | `varchar(191)` | YES | `` | NULL | `` |  |
| `address` | `varchar(191)` | YES | `` | NULL | `` |  |
| `observation` | `longtext` | YES | `` | NULL | `` |  |
| `app_observation` | `longtext` | YES | `` | NULL | `` |  |
| `debt_collector_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `seller_id` | `int unsigned` | YES | `` | NULL | `` |  |
| `payment_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `bank_account_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `amount` | `decimal(13,2)` | NO | `` | NULL | `` |  |
| `total_excenta` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `total_iva5` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `total_iva10` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `amount_iva5` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `amount_iva10` | `decimal(13,2)` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `reason_canceled` | `varchar(191)` | YES | `` | NULL | `` |  |
| `cnote_reason_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `construction` | `varchar(191)` | YES | `` | NULL | `` |  |
| `client_branch` | `varchar(191)` | YES | `` | NULL | `` |  |
| `user_canceled` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `contract_fee_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `ascont_migration` | `tinyint` | NO | `` | 0 | `` |  |
| `accounting_seated` | `tinyint(1)` | NO | `` | 0 | `` |  |
| `tapo_contract_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `concepts_received` | `varchar(191)` | YES | `` | NULL | `` |  |
| `devolution_fromable_id` | `varchar(191)` | YES | `` | NULL | `` |  |
| `devolution_fromable_type` | `varchar(191)` | YES | `` | NULL | `` |  |
| `estado_fact_elect_desc` | `text` | YES | `` | NULL | `` |  |
| `estado_fact_elect` | `varchar(255)` | YES | `` | NULL | `` |  |
| `cdc` | `varchar(255)` | YES | `` | NULL | `` |  |
| `anul_estado_fe` | `varchar(255)` | YES | `` | NULL | `` |  |
| `inut_estado_fe` | `varchar(255)` | YES | `` | NULL | `` |  |

### `web_contacts`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `1810`  

- **PK:** `id`

**FK salientes:**

- `web_contacts_enterprise_id_foreign`: (`enterprise_id`) → `enterprises` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `fullname` | `varchar(191)` | NO | `` | NULL | `` |  |
| `enterprise_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `email` | `varchar(191)` | NO | `` | NULL | `` |  |
| `phone` | `varchar(191)` | YES | `` | NULL | `` |  |
| `ip_address` | `varchar(191)` | NO | `` | NULL | `` |  |
| `message` | `longtext` | YES | `` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |

### `web_work_forms`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `4166`  

- **PK:** `id`

**FK salientes:**

- `web_work_forms_working_interest_1_id_foreign`: (`working_interest_1_id`) → `working_interests` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION
- `web_work_forms_working_interest_2_id_foreign`: (`working_interest_2_id`) → `working_interests` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `fullname` | `varchar(191)` | NO | `` | NULL | `` |  |
| `nationality` | `varchar(191)` | NO | `` | NULL | `` |  |
| `cellphone` | `varchar(191)` | NO | `` | NULL | `` |  |
| `birth_date` | `date` | NO | `` | NULL | `` |  |
| `has_children` | `tinyint(1)` | YES | `` | NULL | `` |  |
| `civil_status` | `smallint` | NO | `` | NULL | `` |  |
| `cv` | `varchar(191)` | NO | `` | NULL | `` |  |
| `working_interest_1_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `working_interest_2_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `salary_expectation` | `longtext` | NO | `` | NULL | `` |  |
| `city` | `longtext` | NO | `` | NULL | `` |  |
| `department` | `longtext` | NO | `` | NULL | `` |  |
| `neighborhood` | `longtext` | NO | `` | NULL | `` |  |
| `finished_school` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `university_formation` | `varchar(191)` | NO | `` | NULL | `` |  |
| `family_working` | `tinyint(1)` | NO | `` | NULL | `` |  |
| `what_do_you_know` | `longtext` | NO | `` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |

### `work_areas`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `50`  

- **PK:** `id`

**Referenciada por (muestra):**
- `dismissals` → `work_areas` (`dismissals_work_area_id_foreign`)
- `employee_complaints` → `work_areas` (`employee_complaints_work_area_id_foreign`)
- `job_positions` → `work_areas` (`job_positions_work_area_id_foreign`)
- `people` → `work_areas` (`people_work_area_id_foreign`)

**FK salientes:**

- `work_areas_business_department_id_foreign`: (`business_department_id`) → `business_departments` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `business_department_id` | `int unsigned` | YES | `MUL` | NULL | `` |  |
| `status` | `tinyint(1)` | NO | `` | 1 | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |

### `working_interests`

- **Engine:** `InnoDB`  
- **TABLE_ROWS (estimado):** `23`  

- **PK:** `id`

**Referenciada por (muestra):**
- `web_work_forms` → `working_interests` (`web_work_forms_working_interest_1_id_foreign`)
- `web_work_forms` → `working_interests` (`web_work_forms_working_interest_2_id_foreign`)

**FK salientes:**

- `working_interests_user_id_foreign`: (`user_id`) → `users` (`id`) ON UPDATE NO ACTION / ON DELETE NO ACTION

| Columna | Tipo | Null | Key | Default | Extra | Comentario |
|---------|------|------|-----|---------|-------|------------|
| `id` | `int unsigned` | NO | `PRI` | NULL | `auto_increment` |  |
| `name` | `varchar(191)` | NO | `` | NULL | `` |  |
| `user_id` | `int unsigned` | NO | `MUL` | NULL | `` |  |
| `created_at` | `timestamp` | YES | `` | NULL | `` |  |
| `updated_at` | `timestamp` | YES | `` | NULL | `` |  |
| `deleted_at` | `timestamp` | YES | `` | NULL | `` |  |
