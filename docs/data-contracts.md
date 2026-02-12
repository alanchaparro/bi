# Data Contracts

## General Rules
- All datasets are loaded from CSV and normalized in frontend before analytics.
- Logical contract id: `_cId` (digits only string).
- Logical management month: `_feNorm` (`MM/YYYY`).
- Invalid rows are not dropped automatically; they are reported as warnings.

## cartera
- Required columns: `id_contrato`, `Fecha gestion`, `UN`, `tramo`, `monto_cuota`, `monto_vencido`.
- Optional columns: `categoria_tramo`, `via_de_cobro`, `fecha_contrato`, `fecha_cierre`.
- Derived fields: `_cId`, `_feNorm`, `_saleMonth`, `_cierreMonth`, `_saleMonthNum`, `_saleYear`.

## cobranzas
- Required columns: `monto`.
- At least one id field: `contract_id` or `id_contrato`.
- Date fields accepted for month normalization: `Mes`/`mes`/`month` + `Año`/`Ano`/`Ao`/`year`.
- Derived fields: `_cId`, `_feNorm`.

## gestores
- Required columns: `contract_id`, `from_date`, `Gestor`.
- Derived fields: `_cId`, `_feNorm`.

## contratos
- Required columns: `contract_id`.
- Optional columns: `Supervisor`, `fecha_contrato`, `fecha_culminacion`.
- Derived fields depend on normalization in `processContratos`.

## Validation Behavior
- Missing required columns: fatal error (load is rejected).
- Invalid ids/dates/numbers in sampled rows: warning with counts.
