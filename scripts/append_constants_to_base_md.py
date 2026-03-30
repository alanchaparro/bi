"""Merge docs/constants.txt into docs/base.md (§10 onward + Apéndice A) and delete the txt.

Idempotente: ancla en `## 10. Diccionario de tablas MySQL`. Hacer commit antes de re-ejecutar.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "docs" / "base.md"
CONST = ROOT / "docs" / "constants.txt"

ANCHOR = "\n## 10. Diccionario de tablas MySQL"


def main() -> None:
    if not CONST.exists():
        raise SystemExit(f"Missing {CONST} (export PHP del legacy)")
    php = CONST.read_text(encoding="utf-8", errors="replace")
    if "```" in php:
        raise SystemExit("constants.txt contains triple-backtick; escape manually")

    base = BASE.read_text(encoding="utf-8", errors="replace")
    if ANCHOR not in base:
        raise SystemExit(f"base.md: falta ancla {ANCHOR!r} (no reemplazar a ciegas)")
    head, _, _ = base.partition(ANCHOR)

    new_tail = """
## 10. Diccionario de tablas MySQL (`epem`, nucleo extraccion v2)

Referencias cruzadas: `sql/v2/*`, §3 de este doc, **Apéndice A** (catalogos id→texto del legacy). Los **alias del SELECT** son los que consume el sync donde aplica.

### `contracts`

| Columna / uso en v2 | Significado | Catalogo / notas |
|---------------------|-------------|------------------|
| `id` | PK contrato | `id_contrato`, `contract_id` en extractos |
| `date` | Fecha de contrato | |
| `number` | Numero de contrato | cobranzas |
| `request_number`, `request_financing_number` | Solicitud / financiacion | Si `request_financing_number` IS NOT NULL → UN **ODONTOLOGIA TTO** (`un_rules`) |
| `enterprise_id` | Empresa | Scope `AGENTS.md` / `enterprise_scope.sql` |
| `branch_id` | Sucursal del contrato | JOIN `branches` |
| `account_holder_id` | Cliente titular | FK → `clients.id` |
| `contract_type` | Via contractual | **1** COBRADOR, **2** DEBITO (`Apendice A` → `contract_type`) |
| `status` | Estado del contrato | Entero; etiquetas dependen de flujo (prestamos vs ventas). Mapas: `contract_status`, `contract_status_sales`, `contract_status_loans` en Apéndice A. `query_cartera` traduce con `CASE` por `enterprise_id` |
| `type_plan` | Tipo de plan | **1** Individual, otro familiar (en cartera: `IF(type_plan=1,'INDIVIDUAL','FAMILIAR')`) |
| `seller_id`, `seller_supervisor_id` | Vendedor / supervisor | FK → `users`; supervisor efectivo: `supervisor_rules.sql` |
| `insurance_id` | Seguro | FK → `insurances` |
| `product_money_loan_id` | Producto | FK → `product_money_loans` |
| `client_sales_process` | Proceso de venta | **1** OIMA, **2** TAPO (`query_cartera`); catalogo relacionado `client_sales_process_type` en Apéndice A |
| `persons_amount` | Asegurados / cupo personas (`asegurados` en cartera) | |
| `quotas_amount` | **Plazo original** en N cuotas (ej. 12, 18). Alias cartera: `periodo_cuotas`. | Ver `quantity-cuota` en Apéndice A. |
| `amount` | Monto cuota | Alias `monto_cuota` |
| `actual_fee_quantity` | Cuotas/cargos **acumulados** incl. **renovaciones** (multiplo de `quotas_amount` si cada renovación suma el mismo plazo). Alias: `total_cuotas`. | Ej. verificado: contrato 41857, `quotas_amount`=18, `actual_fee_quantity`=72 (4 periodos x 18). |
| `inscription` | Inscripcion | |
| `observation` | Observacion libre | |

#### Tramo 7+ y monto_a_cobrar (AGENTS.md 5.1)

Si cuotas_vencidas >= 7, el monto_vencido en cartera_fact se acota a primera vuelta: min(vencido_raw, quotas_amount * monto_cuota). Ver AGENTS.md.

### `contract_closed_dates`

| Columna | Significado |
|---------|-------------|
| `contract_id` | FK → `contracts.id` |
| `closed_date` | Fecha de cierre de cartera (corte) |
| `quotas_expirations` | Cuotas vencidas (tramo operativo se deriva en negocio) |
| `expired_amount`, `total_residue`, `capital_*`, `interest_*`, `accrued_amount` | Montos cartera corte |
| `next_expiration_to_pay`, `last_payment`, `days_late` | Vencimiento, ultimo pago, dias atraso |
| `check_discount_status` | Estado descuento cheque | Ver `status_check_discount` Apéndice A |
| `last_collection_manager_id` | Ultimo gestor cobranza | FK → `users` |

### `contract_situations`

| Columna | Significado |
|---------|-------------|
| `contract_id` | FK contrato |
| `type` | **1** Inubicable, **2** Incobrable, **3** Culminado — `contracts_situation_type` (Apéndice A) |
| `status` | En v2 culminacion: `type=3` y `status=1` |
| `date` | Fecha registro / culminacion |

### `clients`

| Columna | Significado |
|---------|-------------|
| `id` | PK |
| `document_number`, `first_name`, `last_name` | Documento y nombre titular |

### `enterprises`

| Columna | Significado |
|---------|-------------|
| `id`, `name` | UN operativa; `un_rules` mezcla con TTO |

### `payments`

| Columna | Significado |
|---------|-------------|
| `id` | PK pago |
| `contract_id` | FK |
| `date` | Fecha pago (cohorte / anio-mes-dia en extracto) |
| `status` | Activo: filtro v2 `status = 1` |
| `type` | Filtro v2 `type < 2` |
| `branch_id` | Sucursal del pago |
| `created_at`, `updated_at` | Auditoria |

### `account_payment_ways`

| Columna | Significado |
|---------|-------------|
| `payment_id` | FK → `payments.id` |
| `payment_method_id` | FK → `payment_methods` |
| `amount` | Monto por linea de medio |

### `payment_methods`

| Columna | Significado |
|---------|-------------|
| `id`, `name` | Clasificacion **DEBITO** vs **COBRADOR** en SQL por nombre (`query_cobranzas`) |

### `contract_clients` (no en v2 extract principal; FK a `clients`)

| Columna | Significado |
|---------|-------------|
| `contract_id`, `client_id` | Vinculo adicional al titular |
| Tipo / relacion | Ver `contract-client-type`, `contract-clients-relationships` en Apéndice A |

### `client_portfolios` / `detail_client_portfolios`

| Columna | Significado |
|---------|-------------|
| `manager_id` | Gestor FK `users` |
| `from_date`, `status` | Vigencia cartera (`query_gestores`: `status=1`, desde 2024-01-01) |
| `contract_id`, `enterprise_id` | Alcance |

### `contracting_entities` / `debit_entities`

| Columna | Significado |
|---------|-------------|
| `contract_id`, `debitentity_id` | Via debito agregada (`ce_via` en cartera) |

---

## 11. Catalogos legacy (PHP): codigo → etiqueta

El **listado integral** del export (`return [...]`) vive solo en este documento: **Apéndice A**. Buscar dentro del bloque la clave entre comillas (ej. `'contract_type'`, `'payment-status'`). Puede haber **claves duplicadas** en el PHP original; prevalece la ultima aparicion en el archivo.

**Mantenimiento:** al actualizar el monolito, sustituir el bloque del Apéndice A completo y registrar fecha en el mensaje de commit.

---

## Apéndice A — `constants` legacy (texto PHP integral)

```php
"""

    out = head.rstrip() + "\n" + new_tail + php + "\n```\n"
    BASE.write_text(out, encoding="utf-8", newline="\n")
    CONST.unlink()
    print("Updated base.md; removed docs/constants.txt")


if __name__ == "__main__":
    main()
