# Guía de Consultas MySQL - Facturación TAPO

## Propósito

Esta guía documenta todo lo aprendido sobre las consultas MySQL para identificar facturación de tratamientos odontológicos financiados por TAPO en IDEM, incluyendo su relación con los asientos contables correspondientes.

## Ubicación

`docs/agents/guiamysql.md`

---

## 1. Resumen del Modelo de Negocio

### Flujo de Facturación TAPO

1. **Cliente quiere tratamiento odontológico** pero necesita financiamiento
2. **TAPO** (entidad financiera) financia al cliente
3. **Odontología** (empresa de IDEM) factura como **contado** porque TAPO ya le pagó
4. **TAPO** luego cobra al cliente en cuotas (entra como cartera para TAPO)

### Empresas y Razones Sociales

| Razon Social | Empresas |
|--------------|----------|
| **IDEM** | Odontología, Emergencias, Laboral |
| **INFOCO** | Estética, Medicina prepaga, Laboratorio dental |

### Filtros Identificados

| Filtro | Valor SQL | Descripción |
|--------|-----------|-------------|
| `enterprise_id` | `1` | Empresa Odontología |
| `service_invoice_id` | `2` | Tratamiento Odontológico |
| `financing` | `1` | Método de pago con financiamiento |
| `payment_methods.name` | `LIKE 'FINANCIACIÓN DE PRESUPUESTO%'` | Nombre del método de pago |

---

## 2. Estructura de Tablas Relevantes

### 2.1 Vouchers (Facturas)

```sql
-- Tabla principal de facturas
vouchers (
    id,                  -- ID del voucher
    date,                -- Fecha de factura
    voucher_number,      -- Número de comprobante
    enterprise_id,       -- Empresa (1 = Odontología)
    client_id,           -- Cliente
    contract_id,         -- Contrato
    amount,              -- Monto total
    total_iva10,          -- Base imponible IVA 10%
    amount_iva10,         -- Monto IVA 10%
    total_iva5,           -- Base imponible IVA 5%
    amount_iva5,          -- Monto IVA 5%
    total_excenta,        -- Monto exento
    status,              -- Estado (1 = activo)
    tapo_contract_id,     -- Contrato TAPO (opcional)
    accounting_seated    -- ¿Tiene asiento contable? (1 = sí)
)
```

### 2.2 Voucher Details (Detalles de Factura)

```sql
-- Detalles de cada factura
voucher_details (
    id,
    voucher_id,           -- FK a vouchers
    service_invoice_id,   -- FK a service_invoices (tipo de servicio)
    contract_id,          -- FK a contracts
    amount,               -- Monto del detalle
    excenta,              -- Monto exento
    iva5,                 -- Monto IVA 5%
    iva10,                -- Monto IVA 10%
    description           -- Descripción
)
```

### 2.3 Voucher Payments (Pagos)

```sql
-- Métodos de pago de cada factura
voucher_payments (
    id,
    voucher_id,           -- FK a vouchers
    payment_method_id,    -- FK a payment_methods
    amount                -- Monto pagado
)
```

### 2.4 Payment Methods (Métodos de Pago)

```sql
-- Métodos de pago disponibles
payment_methods (
    id,
    name,                 -- Nombre del método
    financing,            -- ¿Es financiamiento? (1 = sí)
    type,                 -- Tipo de método
    status                -- Estado (1 = activo)
)

-- Métodos de financiamiento TAPO (financing = 1):
-- 122: FINANCIACIÓN DE PRESUPUESTO MCAL
-- 123: FINANCIACIÓN DE PRESUPUESTO CDE
-- 124: FINANCIACIÓN DE PRESUPUESTO ENC
-- 125: FINANCIACIÓN DE PRESUPUESTO MRA
-- 126: FINANCIACIÓN DE PRESUPUESTO ÑBY
-- 127: FINANCIACIÓN DE PRESUPUESTO SLO
-- 128: FINANCIACIÓN DE PRESUPUESTO BRA
-- 138: FINANCIACIÓN DE PRESUPUESTO LUQUE
-- 166: FINANCIACIÓN DE PRESUPUESTO LAMBARE
```

### 2.5 Service Invoices (Tipos de Servicio)

```sql
-- Tipos de servicio facturables
service_invoices (
    id,
    name                  -- Nombre del servicio
)

-- ID 2 = TRATAMIENTO ODONTOLOGICO
```

### 2.6 Accounting Entries (Asientos Contables)

```sql
-- Asientos contables
accounting_entries (
    id,
    date,                 -- Fecha del asiento
    number,                -- Número de asiento
    concept,               -- Concepto
    total,                 -- Monto total
    fromable_type,         -- Tipo de origen (App\Models\Voucher)
    fromable_id,           -- ID del origen (voucher_id)
    social_reason_id       -- Razón social (1 = IDEM)
)
```

### 2.7 Accounting Entry Details (Detalles de Asientos)

```sql
-- Detalles de cada asiento
accounting_entry_details (
    id,
    accounting_entry_id,   -- FK a accounting_entries
    accounting_plan_id,     -- FK a accounting_plans
    debit,                 -- Débito
    credit,                -- Crédito
    concept                -- Concepto
)
```

### 2.8 Accounting Plans (Plan de Cuentas)

```sql
-- Plan de cuentas
accounting_plans (
    id,
    number,                -- Código de cuenta (ej: 1.1.1.01.94)
    name,                   -- Nombre de la cuenta
    accounting_type_id     -- FK a accounting_types (puede ser NULL)
)
```

### 2.9 Accounting Types (Tipos de Cuenta)

```sql
-- Tipos de cuenta contable
accounting_types (
    id,
    name,                  -- Nombre del tipo
    type                   -- 1=Ingresos, 2=Costos, 3=Gastos, etc.
)

-- Nota: Las cuentas de CAJA e IVA tienen accounting_type_id = NULL
```

---

## 3. Consultas SQL Principales

### 3.1 Facturación TAPO - Enero 2025

```sql
-- Facturación Odontología - Tratamiento Odontológico - Financiamiento TAPO
-- Enero 2025
-- Resultado: 139,867,750 (87 vouchers)

SELECT
    'ENERO_2025_ODONTOLOGIA_TAPO' AS periodo,
    COUNT(DISTINCT v.id) AS cantidad_facturas,
    COUNT(DISTINCT vd.id) AS cantidad_detalles,
    SUM(vd.amount) AS subtotal_con_iva,
    SUM(vd.excenta) AS excenta,
    SUM(vd.iva5) AS iva5,
    SUM(vd.iva10) AS iva10
FROM vouchers v
INNER JOIN voucher_details vd ON v.id = vd.voucher_id
INNER JOIN voucher_payments vp ON v.id = vp.voucher_id
INNER JOIN payment_methods pm ON vp.payment_method_id = pm.id
WHERE
    v.enterprise_id = 1              -- Odontología
    AND vd.service_invoice_id = 2     -- Tratamiento Odontológico
    AND v.date >= '2025-01-01'
    AND v.date <= '2025-01-31'
    AND v.status = 1                  -- Activo
    AND pm.financing = 1;             -- Método de pago con financiamiento
```

### 3.2 Detalle por Sucursal (Método de Pago)

```sql
-- Desglose por sucursal (método de pago)
SELECT
    pm.id AS payment_method_id,
    pm.name AS metodo_pago,
    COUNT(DISTINCT v.id) AS cantidad_facturas,
    SUM(v.amount) AS monto_total
FROM vouchers v
INNER JOIN voucher_payments vp ON v.id = vp.voucher_id
INNER JOIN payment_methods pm ON vp.payment_method_id = pm.id
INNER JOIN voucher_details vd ON v.id = vd.voucher_id
WHERE v.enterprise_id = 1
  AND vd.service_invoice_id = 2
  AND v.date >= '2025-01-01'
  AND v.date <= '2025-01-31'
  AND v.status = 1
  AND pm.financing = 1
GROUP BY pm.id, pm.name
ORDER BY monto_total DESC;
```

### 3.3 Asientos Contables de Facturación TAPO

```sql
-- Asientos contables relacionados con facturación TAPO
SELECT
    ae.id AS asiento_id,
    ae.date AS fecha,
    ae.concept,
    ae.total,
    v.id AS voucher_id,
    v.voucher_number,
    v.amount AS monto_voucher
FROM accounting_entries ae
INNER JOIN vouchers v ON ae.fromable_id = v.id
INNER JOIN voucher_details vd ON v.id = vd.voucher_id
INNER JOIN voucher_payments vp ON v.id = vp.voucher_id
INNER JOIN payment_methods pm ON vp.payment_method_id = pm.id
WHERE v.enterprise_id = 1
  AND vd.service_invoice_id = 2
  AND v.date >= '2025-01-01'
  AND v.date <= '2025-01-31'
  AND v.status = 1
  AND pm.financing = 1
  AND ae.fromable_type = 'App\\Models\\Voucher'
ORDER BY ae.date, ae.id;
```

### 3.4 Detalles de Asientos Contables (Completo)

```sql
-- Detalles completos de asientos contables
-- IMPORTANTE: Usar LEFT JOIN con accounting_types porque
-- las cuentas de CAJA e IVA tienen accounting_type_id = NULL

SELECT
    ae.id AS asiento_id,
    ae.date AS fecha,
    ae.concept,
    v.voucher_number,
    v.amount AS monto_voucher,
    ap.number AS codigo_cuenta,
    ap.name AS cuenta,
    at.name AS mayor,
    at.type AS tipo,
    aed.debit,
    aed.credit
FROM vouchers v
INNER JOIN accounting_entries ae ON ae.fromable_id = v.id
INNER JOIN accounting_entry_details aed ON aed.accounting_entry_id = ae.id
INNER JOIN accounting_plans ap ON aed.accounting_plan_id = ap.id
LEFT JOIN accounting_types at ON ap.accounting_type_id = at.id
INNER JOIN voucher_details vd ON v.id = vd.voucher_id
INNER JOIN voucher_payments vp ON v.id = vp.voucher_id
INNER JOIN payment_methods pm ON vp.payment_method_id = pm.id
WHERE v.enterprise_id = 1
  AND vd.service_invoice_id = 2
  AND v.date >= '2025-01-01'
  AND v.date <= '2025-01-31'
  AND v.status = 1
  AND pm.financing = 1
  AND ae.fromable_type = 'App\\Models\\Voucher'
ORDER BY ae.id, aed.debit DESC, aed.credit DESC;
```

---

## 4. Estructura del Asiento Contable

### 4.1 Estructura Típica (3 Detalles)

| # | Código | Cuenta | Tipo | Débito | Crédito |
|---|--------|--------|------|--------|---------|
| 1 | 1.1.1.01.XX | CAJA ATC ODONTOLOGIA [Sucursal] | Activo | 1,900,000 | 0 |
| 2 | 2.1.3.01.02 | IVA DEBITO FISCAL | Pasivo | 0 | 172,727 |
| 3 | 4.1.1.01.04 | INGRESOS POR TRATAMIENTO Y MANTENIM | Ingresos | 0 | 1,727,273 |

**Totales:**
- Débito: 1,900,000
- Crédito: 1,900,000

### 4.2 Códigos de Cuenta por Sucursal

| Sucursal | Código CAJA |
|----------|-------------|
| LAMBARE | 1.1.1.01.94 |
| SAN LORENZO | 1.1.1.01.68 |
| MARISCAL LOPEZ | 1.1.1.01.66 |
| MARIANO ROQUE | 1.1.1.01.65 |
| ... | ... |

### 4.3 Códigos de Cuenta Fijos

| Concepto | Código |
|----------|--------|
| IVA DEBITO FISCAL | 2.1.3.01.02 |
| INGRESOS POR TRATAMIENTO Y MANTENIM | 4.1.1.01.04 |

---

## 5. Relaciones Entre Tablas

### 5.1 Diagrama de Relaciones

```
vouchers (facturas)
    ├── voucher_details (detalles de factura)
    │   └── service_invoices (tipo de servicio)
    ├── voucher_payments (métodos de pago)
    │   └── payment_methods (métodos con financing=1)
    └── accounting_entries (asientos contables)
        └── accounting_entry_details (detalles del asiento)
            └── accounting_plans (plan de cuentas)
                └── accounting_types (tipos de cuenta, puede ser NULL)
```

### 5.2 Relación Voucher → Asiento Contable

```sql
-- Relación entre voucher y asiento contable
-- fromable_type = 'App\Models\Voucher'
-- fromable_id = voucher_id

accounting_entries.fromable_type = 'App\Models\Voucher'
accounting_entries.fromable_id = vouchers.id
```

### 5.3 Relación Asiento → Detalles

```sql
-- Cada asiento tiene 3 detalles:
-- 1. CAJA (débito) - accounting_type_id = NULL
-- 2. IVA DEBITO FISCAL (crédito) - accounting_type_id = NULL
-- 3. INGRESOS (crédito) - accounting_type_id = 1

accounting_entry_details.accounting_entry_id = accounting_entries.id
accounting_entry_details.accounting_plan_id = accounting_plans.id
accounting_plans.accounting_type_id = accounting_types.id  -- Puede ser NULL
```

---

## 6. Fórmulas y Cálculos

### 6.1 Cálculo de IVA

```sql
-- IVA 10% incluido en el precio
-- Monto total = Base gravada + IVA
-- Base gravada = Monto total / 1.10
-- IVA = Monto total - Base gravada

-- Ejemplo: Voucher de 1,900,000
-- Base gravada = 1,900,000 / 1.10 = 1,727,272.73
-- IVA 10% = 1,900,000 - 1,727,272.73 = 172,727.27
```

### 6.2 Verificación de Cuadre

```sql
-- Verificación de cuadre contable
SELECT
    SUM(aed.debit) AS total_debito,
    SUM(aed.credit) AS total_credito,
    SUM(aed.debit) - SUM(aed.credit) AS diferencia
FROM accounting_entry_details aed
INNER JOIN accounting_entries ae ON aed.accounting_entry_id = ae.id
INNER JOIN vouchers v ON ae.fromable_id = v.id
WHERE ae.fromable_type = 'App\\Models\\Voucher'
  AND v.enterprise_id = 1
  AND v.date >= '2025-01-01'
  AND v.date <= '2025-01-31';

-- Resultado esperado: diferencia = 0 (cuadrado)
```

---

## 7. Scripts Disponibles

### 7.1 Scripts de Consulta

| Archivo | Descripción |
|---------|-------------|
| `scripts/consultas_tapo/facturacion_tapo_enero_2025.py` | Consulta principal de facturación TAPO |
| `scripts/consultas_tapo/asientos_contables_tapo_enero_2025.py` | Asientos contables relacionados |
| `scripts/consultas_tapo/asientos_tapo_completos.py` | Detalles completos de asientos (con LEFT JOIN) |
| `scripts/consultas_tapo/verificar_metodos_pago.py` | Verificación de métodos de pago |
| `scripts/consultas_tapo/investigar_voucher_asiento.py` | Investigación voucher-asiento específico |

### 7.2 Archivos SQL

| Archivo | Descripción |
|---------|-------------|
| `sql/v2/query_facturacion_tapo_enero_2025.sql` | Consulta SQL principal |

---

## 8. Notas Importantes

### 8.1 Sobre `accounting_type_id`

Las cuentas de **CAJA** e **IVA DEBITO FISCAL** tienen `accounting_type_id = NULL`. Por eso es necesario usar **LEFT JOIN** en lugar de INNER JOIN con `accounting_types`:

```sql
-- CORRECTO (con LEFT JOIN)
LEFT JOIN accounting_types at ON ap.accounting_type_id = at.id

-- INCORRECTO (con INNER JOIN)
INNER JOIN accounting_types at ON ap.accounting_type_id = at.id
-- Esto excluye las cuentas de CAJA e IVA
```

### 8.2 Sobre `fromable_type`

El valor correcto es `'App\Models\Voucher'` (con backslashes dobles en Python):

```python
# En Python
fromable_type = 'App\\\\Models\\\\Voucher'

# En SQL
fromable_type = 'App\\Models\\Voucher'
```

### 8.3 Sobre el Método de Pago

El nombre del método de pago es **"FINANCIACIÓN DE PRESUPUESTO"** (con tilde), no "PRESUPUESTO FINANCIADO":

```sql
-- Métodos de pago TAPO
WHERE pm.financing = 1
  AND pm.name LIKE 'FINANCIACIÓN DE PRESUPUESTO%'
```

---

## 9. Resultados Obtenidos (Enero 2025)

### 9.1 Facturación TAPO

| Concepto | Valor |
|----------|-------|
| Cantidad de facturas | 87 |
| Monto total | 139,867,750 |

### 9.2 Asientos Contables

| Categoría | Cantidad | Débito | Crédito |
|-----------|----------|--------|---------|
| CAJA | 87 | 139,867,750 | 0 |
| IVA | 86 | 0 | 12,442,522 |
| INGRESOS | 87 | 0 | 127,425,227 |

### 9.3 Coincidencia

✅ **Vouchers = Débitos = Créditos = 139,867,750**

---

## 10. Referencias

- `docs/base.md` - Inventario de tablas MySQL/Postgres
- `docs/agents/mysql-epem-schema-agent-guide.md` - Guía de esquema MySQL
- `AGENTS.md` - Reglas de negocio y contratos
- `sql/v2/query_facturacion_tapo_enero_2025.sql` - Consulta SQL principal