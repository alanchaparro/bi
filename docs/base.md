# Canon `base.md` — Origen MySQL, destino Postgres y scripts del repo

## Propósito

Documento único de consulta para:

- Saber **de qué tablas MySQL** salen los datos de importación/sync.
- Ver **JOINs y claves lógicas** alineados a los SQL versionados en el repo (`sql/v2/*`, `query_analytics.sql`, `sql/common/*`).
- Tener un **mapa de relaciones declaradas** (FKs en `epem`) junto con los **alias de columnas** que ya usamos en extracción, para **entender cómo se arma el dato** antes de tocar código o nuevos reportes.
- Enlazar con **tablas Postgres** del analytics v2 (facts, aggs, MVs, sync).
- Ejecutar en el servidor de origen (p. ej. `192.168.0.241`) consultas de **inventario de FKs** para mantener este doc al día, o regenerar anexos con `scripts/dump_epem_fks.ps1`.

### Uso al pedir SQL para dominios nuevos

Este canon existe para que **desarrolladores y asistentes** (p. ej. en Cursor) puedan **consultar una base común** al proponer `query_*.sql` o vistas: no sustituye a `information_schema` en vivo, pero **reduce el ensayo y error** al combinar:

1. **Grafo de tablas y FKs** (secciones 3 y 7, más `archive-md-no-canonico/docs/archive/epem_mysql_verified_*.md` y el TSV completo si hace falta).
2. **Contrato de nombres** que ya consume el sync: alias de salida en §4 y los `AS` de `sql/v2/*` (el backend asume esos nombres de columnas).
3. **Reglas de negocio** que filtran o transforman (`sql/common/*`, `AGENTS.md`).
4. **Diccionario de campos y catálogos** (§10, §11, Apéndice A) para interpretar columnas y códigos numéricos del legacy.

Flujo recomendado ante un **dominio nuevo**: leer `base.md` + el query v2 más parecido + `AGENTS.md`; si el esquema MySQL cambió, actualizar el anexo FK (§7 / script) y luego diseñar el SQL nuevo **reutilizando patrones de JOIN y alias** ya establecidos.

### Cómo encaja `base.md` con los `.sql` y los alias

| Pieza | Qué aporta |
|-------|------------|
| **`base.md` + anexos FK** | **Mapa relacional**: qué tablas existen, cómo se **pueden** enlazar por FK declarada y qué tablas entran en cada dominio de extracción. Responde “¿por qué este `JOIN` es coherente con el modelo?” |
| **`sql/v2/*` y `sql/common/*`** | **Verdad operativa de uniones**: cómo **este proyecto** une tablas hoy (rutas concretas, filtros, subconsultas). Es la referencia prioritaria al armar SQL nuevo: copiar patrones de `JOIN` y condiciones ya probadas. |
| **§10–§11 y Apéndice A (este doc)** | **Diccionario de columnas** (tablas núcleo v2) y **catálogos PHP** integrados (id → etiqueta para decodificar enteros en MySQL). |
| **Alias (`AS` en el `SELECT`)** | **Contrato con el pipeline**: los nombres de columnas **devueltos** por el query deben coincidir con lo que el sync/API espera (`sync_service.py` y dominios). Cambiar un alias rompe la carga si no se actualiza código. §4 resume significados; el detalle fino está en cada `.sql`. |

Con esto un asistente o dev puede **proponer consultas nuevas** (p. ej. otro corte por cliente/contrato/UN) **sin adivinar**: une lo que dicen las FKs, lo que ya hace un query v2 parecido y las reglas de `AGENTS.md`. **Lo que no sustituye** es la **ejecución** en MySQL: conteos, promedios o “cuántos hay hoy” exigen correr el SQL en el servidor (o pegar aquí el resultado).

**No es** un volcado automático desde red: Cursor/CI **no** tienen acceso a tu LAN salvo que tú ejecutes consultas o el script con Docker. Tras cambios en el esquema MySQL, correr la sección [7](#7-consultas-para-correr-en-mysql-servidor-de-importación) o `dump_epem_fks.ps1` y dejar el resultado en `archive-md-no-canonico/docs/archive/` fechado.

**Precedencia** con otros canónicos: `AGENTS.md` (reglas de negocio) → `desacople.md` → este archivo para **origen de datos y tablas** → `archive-md-no-canonico/docs/sync-business-keys.md` (business keys en Postgres) → `archive-md-no-canonico/docs/data-contracts.md` (columnas esperadas en CSV/UI legacy).

---

## 1. Dos bases en juego

| Rol | Motor | Uso en el proyecto |
|-----|--------|-------------------|
| **Origen / importaciones** | **MySQL** (instancia operativa; host típico LAN tipo `192.168.0.241`, vía `MYSQL_*` en `.env`) | Lectura con los `query_*.sql`; sin escritura del pipeline hacia este motor. |
| **Analytics / API** | **Postgres** (Docker o servicio del stack) | Facts, agregados, materialized options, auth, sync metadata. |

Conexión desde contenedor API a MySQL en otra máquina: usar IP alcanzable (no `localhost` dentro del contenedor). Ver `archive-md-no-canonico/docs/analytics-data-dependencies.md`.

### 1.1 Variables de entorno (credenciales solo en `.env` local)

| Variable | Valor operativo típico (EPEM) | Nota |
|----------|-------------------------------|------|
| `MYSQL_HOST` | IP LAN del servidor MySQL (ej. `192.168.0.241`) | Desde contenedor Docker debe ser la IP/host que **vea** el contenedor, no `127.0.0.1` del PC salvo `host.docker.internal` según doc de despliegue. |
| `MYSQL_PORT` | `3306` | Ajustar si el servicio escucha otro puerto. |
| `MYSQL_USER` | Usuario de solo lectura recomendado para sync | **No** versionar usuario/contraseña reales. |
| `MYSQL_PASSWORD` | — | Solo variable de entorno o secret manager; **prohibido** en Git, `docs/` o capturas. |
| `MYSQL_DATABASE` | **`epem`** | Base donde viven las tablas referenciadas por `sql/v2/*` (muchas con prefijo `epem.` o `USE` implícito). |

Plantilla: `.env.example` (`MYSQL_*`). Copiar a `.env` en cada entorno y rellenar ahí. Si una contraseña se expuso (chat, ticket, historial), **rotarla** en MySQL y actualizar solo el `.env` local.

---

## 2. Scripts SQL canónicos por dominio

| Dominio | Archivo en repo | Incluye comunes | Notas |
|---------|-----------------|-----------------|--------|
| **cartera** | `sql/v2/query_cartera.sql` | `un_rules`, `supervisor_rules`, `enterprise_scope` | Grano: cierre por contrato (`contract_closed_dates`). |
| **cobranzas** | `sql/v2/query_cobranzas.sql` | `enterprise_scope` | Pagos + vías; exclusión de contratos en `WHERE`. |
| **contratos** | `sql/v2/query_contratos.sql` | `un_rules`, `supervisor_rules`, `enterprise_scope` | Contratos confirmados/culminados. |
| **gestores** | `sql/v2/query_gestores.sql` | `enterprise_scope` | Cartera asignada a gestor (`detail_client_portfolios`). |
| **EERR — ingresos (ventas)** | `sql/v2/query_eerr_ventas.sql` | — | Mismo criterio que el primer bloque de `query_eerr.sql` (`type = 1`, `YEAR >= 2020`). Archivo **de referencia / consultas aisladas**; el batch sync no lo invoca por separado. |
| **EERR — costos** | `sql/v2/query_eerr_costos.sql` | — | Igual que costos en `query_eerr.sql` (`type = 2`, `YEAR >= 2020`). Referencia; sync usa el unificado. |
| **EERR — gastos** | `sql/v2/query_eerr_gastos.sql` | — | Igual que gastos en `query_eerr.sql` (`type = 3`, `YEAR >= 2020`). Referencia; sync usa el unificado. |
| **EERR — sync (union)** | `sql/v2/query_eerr.sql` | — | **UNION ALL** ventas + costos + gastos con `eerr_block`; dominio sync **`eerr`** → Postgres **`eerr_fact`**; API **`eerr-v2`**, UI `/eerr`. |
| **analytics snapshot (brokers legacy)** | `query_analytics.sql` (raíz) | inline `enterprise_id IN (1,2,5)` | Puebla `analytics_contract_snapshot` desde Configuración / servicio; **no** está bajo `sql/v2/`. |

El sync batch usa **v2** para cartera/cobranzas/contratos/gestores/**eerr** (`sync_extractors.py`). **EERR** fuerza variante v2 (`query_eerr.sql`). La ruta v1 en raíz (`query_cobranzas.sql`, etc.) es legado de referencia; operación actual = **v2**.

**Includes reutilizables** (`sql/common/`):

- `enterprise_scope.sql` → `c.enterprise_id IN (1, 2, 5)` (alineado a `AGENTS.md`).
- `un_rules.sql` → UN canónica: `ODONTOLOGIA TTO` si `request_financing_number` no nulo, si no `enterprises.name`.
- `supervisor_rules.sql` → excepción FVBROKEREAS / FVBROKEREASCDE; si no, supervisor desde `seller_supervisor_id`.

---

## 3. Grafo lógico MySQL (desde JOINs de los SQL v2)

Esquema en archivos: muchas tablas van prefijadas `epem.` (ej. `epem.contract_closed_dates`). Otros fragmentos usan nombres sin prefijo asumiendo **database por defecto** = `epem` en la conexión. Unificar en documentación como **base `epem`**.

### 3.1 Cartera (`query_cartera.sql`)

| Tabla | Rol | Une con |
|-------|-----|---------|
| `contract_closed_dates` | Hecho de cierre | `contracts` (`contract_id` = `contracts.id`) |
| `contracts` | Contrato | `clients` (`account_holder_id`), `enterprises`, `branches`, `insurances`, `product_money_loans`, `users` (vendedor `seller_id`, supervisor `seller_supervisor_id`) |
| `contract_situations` | Subconsulta culminación | `contract_id`, `type=3`, `status=1` |
| `contracting_entities` + `debit_entities` | Subconsulta `ce_via` vía débito | `contract_id` |

### 3.2 Cobranzas (`query_cobranzas.sql`)

| Tabla | Rol | Une con |
|-------|-----|---------|
| `payments` | Pago | `contracts` (`contract_id`), `enterprises` (vía `contracts.enterprise_id`) |
| `account_payment_ways` | Detalle de medio/monto | `payments.id` = `payment_id` |
| `branches` | Sucursal del pago | `payments.branch_id` |
| `payment_methods` | Clasificación débito vs cobrador | `apw.payment_method_id` |

**Fecha mínima de pago** en el extracto: `payments.date >= '2020-01-01'` (histórico desde 2020; alinear precheck MySQL en `sync_extractors.MYSQL_PRECHECK_QUERIES['cobranzas']`).

**Exclusión fija de contratos** (negocio): `contract_id NOT IN (55411, 55414, 59127, 59532, 60402)` — debe mantenerse alineado con `AGENTS.md` y `query_cobranzas.sql`.

### 3.3 Contratos (`query_contratos.sql`)

| Tabla | Rol |
|-------|-----|
| `contracts` | Principal |
| `enterprises` | Filtro empresas |
| `users` | Vendedor / supervisor |
| `contract_situations` | Fecha culminación (subconsulta) |

### 3.4 Gestores (`query_gestores.sql`)

| Tabla | Rol | Une con |
|-------|-----|---------|
| `detail_client_portfolios` | Líneas de cartera | `contracts`, `client_portfolios` |
| `client_portfolios` | Cartera de cliente | `manager_id` → `users.id` |
| `users` | Nombre del gestor | |

Filtros: `users.id <> 696`, `cp.status = 1`, `cp.from_date >= '2024-01-01'` (ajustar si cambia política).

### 3.5 Analytics (`query_analytics.sql`)

Subconsultas sobre `contract_closed_dates`, `contracts`, `enterprises`, `users` (supervisor), más agregados de `payments` / `account_payment_ways` / `payment_methods` por `gestion_month`. Es la base del snapshot brokers; revisar archivo completo para nuevas columnas.

### 3.6 EERR — ingresos / ventas (`query_eerr_ventas.sql`)

Contabilidad (MySQL): movimientos de detalle de asientos agrupados por mes/año, razón social del **plan** (`social_reasons` vía `accounting_plans`), y cuenta (`accounting_plans` + `accounting_types`). El `GROUP BY` incluye además `accounting_entries.social_reason_id` (cabecera del asiento); si diverge del `social_reason_id` del plan, revisar criterio de negocio.

| Tabla | Rol | Une con |
|-------|-----|---------|
| `accounting_entry_details` | Líneas del asiento (débito/crédito) | `accounting_entries` (`accounting_entry_id`), `accounting_plans` (`accounting_plan_id`) |
| `accounting_entries` | Cabecera del asiento (fecha, `social_reason_id`) | `id` |
| `accounting_plans` | Plan de cuenta | `accounting_types` (`accounting_type_id`), `social_reasons` (`social_reason_id`) |
| `accounting_types` | Tipo / “mayor” | `id`; filtro `status = 1` y `type = 1` para este extracto de **ingresos** |
| `social_reasons` | Razón social (nombre) | `id` |

Filtros de alcance en el SQL: `YEAR(date) >= 2020`, `social_reasons.id <= 3`. No reutilizan `sql/common/enterprise_scope.sql` (criterio distinto al de contratos/cobranzas).

**Exclusión GESE (ventas, costos y gastos):** se excluyen filas donde `LOWER(IFNULL(accounting_types.name,''))` o `LOWER(IFNULL(accounting_plans.name,''))` contenga la subcadena `gese`. En el sync unificado el fragmento está en `sql/common/eerr_exclude_mayor_cuenta_gese.sql` (vía `-- @include` en `query_eerr.sql`).

### 3.7 EERR — costos (`query_eerr_costos.sql`)

Mismo grafo de tablas que §3.6. Extracto de **costos** para el margen (`ingresos − costos` en `AGENTS.md` regla 10): `accounting_types.status = 1` y `type = 2`, con `YEAR(accounting_entries.date) >= 2020` y `social_reasons.id <= 3`. Salida: mismos alias que `query_eerr_ventas.sql` (`Mes`, `Año`, `Empresa`, `Mayor`, `Cuenta`, `debit`, `credit`, etc.).

### 3.8 EERR — gastos (`query_eerr_gastos.sql`)

Mismo grafo que §3.6. Extracto de **gastos** para el EBITDA (`margen − gastos` en `AGENTS.md` regla 10): `accounting_types.status = 1` y `type = 3`, con `YEAR(accounting_entries.date) >= 2020` y `social_reasons.id <= 3`. Salida: mismos alias que los demás extractos EERR contables.

**Resumen tipos `accounting_types.type` en EERR (legado):** `1` ingresos/ventas, `2` costos, `3` gastos.

### 3.9 EERR — sync unificado (`query_eerr.sql`)

Mismo grafo de tablas que §3.6. Tres bloques `UNION ALL` con discriminador `eerr_block` (`ventas`, `costos`, `gastos`). Salida adicional respecto a los extractos por separado: **`eerr_block`** (primera columna). Destino de carga: tabla Postgres **`eerr_fact`** vía sync batch dominio `eerr`.

**Columna `is_tapo`** (agregada en migración `0027_eerr_fact_is_tapo`): identifica asientos contables de tratamientos odontológicos financiados por TAPO. Se calcula con un LEFT JOIN a una subconsulta derivada `tapo` que precalcula (`SELECT DISTINCT`) los `accounting_entry_id` de asientos provenientes de vouchers de Odontología (`enterprise_id = 1`) con al menos un detail `service_invoice_id = 2` (Tratamiento Odontológico) y un payment con método `financing = 1`. La expresión `CASE WHEN tapo.accounting_entry_id IS NOT NULL THEN 1 ELSE 0 END AS is_tapo` se **incluye en el `GROUP BY`** para que los montos TAPO y no-TAPO queden en filas separadas. Así, al filtrar "Sin TAPO" (`is_tapo = 0`), solo se excluye la porción financiada TAPO de cada cuenta, preservando la porción no-TAPO. Si se usara `MAX(is_tapo)` sin incluirlo en el GROUP BY, los montos se mezclarían y toda la fila quedaría marcada como TAPO, eliminando la cuenta completa al filtrar. **Clave única de negocio** (migración `0028_eerr_fact_unique_key_is_tapo`): `is_tapo` forma parte de la constraint única `ux_eerr_fact_business_key` junto con `(gestion_month, social_reason_id, accounting_plan_id, eerr_block)`. Sin `is_tapo` en la clave, el upsert ON CONFLICT sobreescribiría la fila `is_tapo=0` con la `is_tapo=1` (o viceversa) para la misma cuenta, anulando la separación del GROUP BY. El filtro UI (`exclude_tapo`) excluye filas con `is_tapo = TRUE` del resultado; la API pasa el flag al backend que filtra `EerrFact.is_tapo == False` cuando está activo. El agregado `eerr_monthly_agg` no tiene esta columna, por lo que el backend hace fallback directo a `eerr_fact` cuando el filtro TAPO está activo.

Los `WHERE` por bloque son equivalentes al legado `IF(accounting_types.status = 1 AND accounting_types.type = N, 1, 0) = 1` con umbral de año alineado en los tres bloques: **`YEAR(accounting_entries.date) >= 2020`**. En cada bloque se aplica además la exclusión GESE descrita en §3.6 (`-- @include sql/common/eerr_exclude_mayor_cuenta_gese.sql`).

**Modelo de dimensiones (estado actual vs cobranzas/cartera):** no hay tablas `dim_*` dedicadas para EERR. El hecho **`eerr_fact`** lleva **desnormalizado** `empresa`, `mayor`, `cuenta`, `social_reason_id`, `accounting_plan_id` en el grano del sync (una fila por clave de negocio mes + razón social + plan + bloque). Es el mismo patrón “fact como vista analítica” que otros dominios antes de introducir agregados.

**Glosario de cuentas (referencia negocio, no sync):** `docs/eerr/glosario_cuentas.json` (y `glosario_cuentas.csv` derivado) — partidas agrupadas en **COSTOS** y **GASTOS** con `rubro`, `cuenta_concepto` y `descripcion`; útil para mapeos y textos en UI EERR. El front importa una copia en `frontend/src/modules/eerr/glosario_cuentas.json` (mantener alineada si se actualiza el glosario en `docs/eerr/`).

**Fases de seguimiento sugeridas (roadmap):**

| Fase | Alcance | Notas |
|------|---------|--------|
| **F0** | Hecho + sync + API `eerr-v2` + UI | Hecho: `eerr_fact`, `query_eerr.sql`, endpoints, `EerrView`. |
| **F1** | Validación contable KPI | Cerrar convención débito/crédito por bloque con finanzas; ajustar `fetch_eerr_summary_v2` si hiciera falta. |
| **F2** | Agregados Postgres | **`eerr_monthly_agg`** implementada: refresco post-sync dominio `eerr`; KPIs en API leen el agg con fallback a `GROUP BY` sobre `eerr_fact`. |
| **F3** | Dimensiones catálogo (opcional) | Sync liviano de `accounting_plans` / `accounting_types` / `social_reasons` solo si se necesitan etiquetas históricas o SCD sin replicar en fact. |
| **F4** | Incremental / watermark (opcional) | Solo si el extracto completo supera presupuesto de tiempo en MySQL; hoy el dominio lee el SQL unificado completo como el resto de facts. |

### 3.10 EERR — propuesta F2 (agregado mensual) y F3 (dimensiones)

Esta sección **no** sustituye a `eerr_fact`: el hecho sigue siendo la fuente de verdad del sync. **F2 está implementada en código** (migración Alembic, `refresh_eerr_monthly_agg` en `sync_refresh.py`, enganche en `sync_service` tras sync `eerr`, KPIs en `fetch_eerr_summary_v2`). **F3** sigue siendo opcional según medición.

#### F2 — Tabla `eerr_monthly_agg` (implementada)

**Grano:** un mes de gestión (`gestion_month` formato `MM/YYYY`) × razón social (`social_reason_id`) × bloque EERR (`eerr_block` ∈ `ventas`, `costos`, `gastos`).

**Columnas sugeridas:**

| Columna | Tipo | Nota |
|---------|------|------|
| `gestion_month` | `VARCHAR(7)` | Parte de clave de negocio. |
| `social_reason_id` | `INTEGER` | Parte de clave; alinea con fact y filtros actuales. |
| `eerr_block` | `VARCHAR(16)` | Parte de clave. |
| `empresa` | `VARCHAR(256)` | Etiqueta para UI; p. ej. `MAX(empresa)` al agrupar desde `eerr_fact` (misma convención que hoy en fact). |
| `debit_total` | `DOUBLE` | `SUM(debit_total)` del fact en ese grano. |
| `credit_total` | `DOUBLE` | `SUM(credit_total)` del fact en ese grano. |
| `plan_lines` | `INTEGER` | Opcional: `COUNT(DISTINCT accounting_plan_id)` (diagnóstico / densidad). |
| `updated_at` | `TIMESTAMP` | Último refresco del agregado. |

**Restricción única:** `(gestion_month, social_reason_id, eerr_block)` — análoga al desglose “por bloque” de los KPI en `fetch_eerr_summary_v2`.

**Índices:** `(gestion_month DESC)`, `(gestion_month, social_reason_id)` para options/summary filtrados.

**Refresco (patrón alineado a cartera):** tras sync `eerr` exitoso y upsert en `eerr_fact`, para el conjunto `applied_months` / meses afectados:

1. `DELETE FROM eerr_monthly_agg WHERE gestion_month IN (:meses)` (o borrado selectivo por `(gestion_month, social_reason_id)` si se optimiza).
2. `INSERT ... SELECT gestion_month, social_reason_id, eerr_block, MAX(empresa), SUM(debit_total), SUM(credit_total), COUNT(DISTINCT accounting_plan_id), NOW() FROM eerr_fact WHERE gestion_month IN (:meses) GROUP BY 1,2,3`.

**API/UI (implementado):** el detalle de filas sigue viniendo de `eerr_fact` (hasta 50k filas). **Totales por bloque y KPIs** se calculan primero con `GROUP BY eerr_block` sobre `eerr_monthly_agg`; si no hay filas en el agg para el filtro pero sí hay hechos, se hace **fallback** a agregación SQL sobre `eerr_fact` (p. ej. tras migración antes del primer sync).

**Guardrail (implementado):** en `sync_service`, si `rows_upserted > 0` y el refresh del agg inserta 0 filas, se reintenta `refresh_eerr_monthly_agg` con `source_months` / `applied_months` como fallback.

**Población inicial:** tras `alembic upgrade` en un entorno que ya tenga `eerr_fact`, ejecutar un sync `eerr` o llamar a `refresh_eerr_monthly_agg` con el conjunto de meses presentes en el fact.

#### F3 — Dimensiones contables (solo si el dolor es etiqueta / catálogo / histórico)

**Objetivo:** que renombres de cuenta o tipo en MySQL no obliguen a re-leer todo el fact para “último nombre”, o exponer jerarquía sin duplicar lógica en la API.

**Opción A — Mínima (una tabla):** `dim_eerr_accounting_plan`

| Columna | Nota |
|---------|------|
| `accounting_plan_id` | PK. |
| `social_reason_id` | Del plan (o del scope EERR). |
| `plan_name`, `mayor_name` | Snapshots desde `accounting_plans` / `accounting_types`. |
| `group_type` | `accounting_types.type` (1/2/3). |
| `legacy_updated_at` | `MAX` o columna de versión si existiera en origen; si no, `updated_at` del sync. |

**Opción B — Completa:** añadir `dim_eerr_social_reason` (`social_reason_id`, `razon_social`) sincronizada desde `social_reasons` con filtro `id <= 3` (o la política vigente).

**Sync:** nuevo dominio **`eerr_dims`** con un SQL único MySQL tipo `SELECT ap.id AS accounting_plan_id, ... FROM accounting_plans ap JOIN ...` **o** refresco piggyback al final del sync `eerr` (menos dominios, más acoplamiento). Recomendación: dominio separado **`eerr_catalog`** si el catálogo cambia con otra cadencia que los movimientos.

**Join en API:** `eerr-v2/summary` haría `LEFT JOIN dim_eerr_accounting_plan` solo cuando se pida “etiqueta canónica”; el fact conserva copia desnormalizada para auditoría y offline.

#### Orden de implementación sugerido

1. Medir: filas en `eerr_fact`, p95 de `POST /eerr-v2/summary` con filtros vacíos y con 1 mes.  
2. Si p95 > umbral acordado (p. ej. 2s) → **F2**.  
3. Si el negocio pide renombrados retroactivos sin re-sync de hechos → **F3 Opción A**.  
4. **F4** solo tras perfilar el extracto MySQL (no adelantar).

---

## 4. Aliases de columnas (salida → significado operativo)

### 4.1 Cartera (extracto de columnas principales)

| Alias en SQL | Uso / nota |
|--------------|------------|
| `UN` | Regla `un_rules` (UN canónica). |
| `Supervisor` | Regla `supervisor_rules`. |
| `id_contrato` | `contract_id`. |
| `fecha_contrato` | `contracts.date`. |
| `via_de_cobro` | COBRADOR si `contract_type=1`, else vía desde débito. |
| `fecha_cierre` | Cierre (`closed_date`). |
| `cuotas_vencidas` | Tramo operativo (tope 7 en negocio). |
| `periodo_cuotas` | **`contracts.quotas_amount`**: plazo **original** en N cuotas (12, 18…). |
| `total_cuotas` | **`contracts.actual_fee_quantity`**: cargos/cuotas **acumulados**, incluye **renovaciones** (puede ser >> `periodo_cuotas`). |
| `monto_vencido`, `total_saldo`, etc. | Montos cartera corte. |

### 4.2 Cobranzas

| Alias | Uso |
|-------|-----|
| `UN` | `un_rules` sobre contrato. |
| `VP` | Clasificación `DEBITO` / `COBRADOR` por nombre de `payment_methods`. |
| `monto` | `apw.amount`. |
| `contract_id` | Contrato. |

### 4.3 Contratos / gestores

Ver selects en `sql/v2/`; contratos exporta `Supervisor`, `UN`, `fecha_de_culminacion`; gestores exporta `Gestor`, `contract_id`, `from_date`.

---

## 5. Postgres (aplicación) — capas y enlaces

No reemplaza el catálogo de migraciones; resume **dónde caen** los datos tras el sync.

| Capa | Tablas representativas | Documentación |
|------|------------------------|---------------|
| Facts | `cartera_fact`, `cobranzas_fact`, `analytics_fact`, `contratos_fact`, `gestores_fact` | `archive-md-no-canonico/docs/sync-business-keys.md`, Alembic `0006`, `0007` |
| Agregados analytics | `cartera_corte_agg`, `cobranzas_cohorte_agg`, `analytics_rendimiento_agg`, … | `archive-md-no-canonico/docs/dwh-v2-target-architecture.md` |
| Dimensiones / mapas | `dim_negocio_un_map`, `dim_negocio_contrato`, … | Mismo |
| Options MV | `mv_options_cartera`, … | Refresh post-sync |
| Sync / jobs | `sync_runs`, `sync_records`, `sync_staging_rows`, `sync_jobs`, `sync_schedules` | `sync_schedules.id` ← FK `sync_jobs.schedule_id` |
| Auth / config | `auth_users`, `brokers_supervisor_scope`, … | Modelos en `backend/app/models/brokers.py` |

**FK explícita en SQLAlchemy (app):** `sync_jobs.schedule_id` → `sync_schedules.id`. El resto de facts/aggs se integra por **claves de negocio** e índices únicos, no por FKs declarativas a entidades MySQL.

---

## 6. Cuándo actualizar este documento

- Nuevo `JOIN` o tabla en `sql/v2/*` o `query_analytics.sql`.
- Cambio en `sql/common/*` o en exclusiones de contratos / `enterprise_id`.
- Nuevo dominio de sync o tabla Postgres de agregados relevante para importaciones.
- Resultado de auditoría en MySQL (sección 7) que muestre FKs nuevas o renombres.

---

## 7. Consultas para correr en MySQL (servidor de importación)

Ejecutar conectado a la base operativa (`epem` o la que use el DSN). Guardar salida con fecha en `archive-md-no-canonico/docs/archive/` si es muy larga.

### 7.1 Foreign keys declaradas en el servidor

```sql
SELECT
  k.TABLE_SCHEMA,
  k.TABLE_NAME,
  k.COLUMN_NAME,
  k.REFERENCED_TABLE_SCHEMA,
  k.REFERENCED_TABLE_NAME,
  k.REFERENCED_COLUMN_NAME,
  k.CONSTRAINT_NAME
FROM information_schema.KEY_COLUMN_USAGE k
WHERE k.TABLE_SCHEMA = DATABASE()
  AND k.REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY k.TABLE_NAME, k.ORDINAL_POSITION;
```

### 7.2 Tablas del esquema (inventario rápido)

```sql
SELECT TABLE_NAME, TABLE_ROWS, ENGINE
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME;
```

### 7.3 Columnas de tablas usadas en los queries v2 (checklist manual)

Comparar con los `FROM`/`JOIN` de la sección 3: `contract_closed_dates`, `contracts`, `clients`, `enterprises`, `branches`, `payments`, `account_payment_ways`, `payment_methods`, `detail_client_portfolios`, `client_portfolios`, `users`, `contract_situations`, `contracting_entities`, `debit_entities`, `insurances`, `product_money_loans`.

```sql
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'contract_closed_dates','contracts','clients','enterprises','branches',
    'payments','account_payment_ways','payment_methods',
    'detail_client_portfolios','client_portfolios','users',
    'contract_situations','contracting_entities','debit_entities',
    'insurances','product_money_loans'
  )
ORDER BY TABLE_NAME, ORDINAL_POSITION;
```

### 7.4 Evidencia verificada (Docker + MySQL en LAN)

En **2026-03-28** se ejecutó el inventario con imagen `mysql:8` (`docker run --rm mysql:8 mysql ...`) contra la base **`epem`** (MySQL **8.0.27**): **546** tablas `BASE TABLE`, **1536** filas en `KEY_COLUMN_USAGE` con `REFERENCED_TABLE_NAME` (participación de columnas en FKs).

El detalle de **FK declaradas** para las tablas núcleo de extracción v2 está en:

- `archive-md-no-canonico/docs/archive/epem_mysql_verified_2026-03-28.md`

Para repetir la extracción sin guardar la contraseña en el historial del shell, usar variable de entorno en la sesión o un `.env` leído solo localmente (no commitear).

**Script (Windows / PowerShell):** desde la raíz del repo, con Docker en ejecución y `.env` con `MYSQL_*` válidos:

`.\scripts\dump_epem_fks.ps1`

Genera `epem_mysql_verified_YYYY-MM-DD.md` y `epem_mysql_all_fks_YYYY-MM-DD.tsv` en `archive-md-no-canonico/docs/archive/`. La clave solo se escribe en un archivo temporal consumido por `docker --env-file` (no queda en los anexos). El cliente usa `--protocol=TCP` para que `localhost` no intente socket Unix dentro del contenedor. `MYSQL_HOST` debe ser alcanzable **desde Docker** (IP LAN del servidor MySQL, o `host.docker.internal` si el motor corre en el mismo PC que Docker Desktop).

**Guía completa para agentes (todas las tablas, columnas, PK y FK):** desde la raíz del repo, con `MYSQL_*` en `.env` y red hasta el servidor:

`python scripts/mysql_schema_to_agent_guide.py`

Escribe `docs/agents/mysql-epem-schema-agent-guide.md` (regenerable; no incluye credenciales). Útil cuando se necesita el catálogo entero del esquema; para el subconjunto núcleo v2 siguen siendo preferibles los anexos FK anteriores y la sección 3 de este documento.

---

## 8. Índice rápido “necesito…”

| Necesito… | Ir a… |
|-----------|--------|
| Reglas UN / supervisor / empresas permitidas | `sql/common/*.sql`, `AGENTS.md` |
| Query de extracción cartera/cobranzas | `sql/v2/query_cartera.sql`, `query_cobranzas.sql` |
| Clasificación débito vs cobrador en SQL | `query_cobranzas.sql`, `query_analytics.sql` (patrón `payment_methods`) |
| Business keys y upsert Postgres | `archive-md-no-canonico/docs/sync-business-keys.md` |
| Columnas esperadas CSV legacy | `archive-md-no-canonico/docs/data-contracts.md` |
| Arquitectura aggs/MV | `archive-md-no-canonico/docs/dwh-v2-target-architecture.md` |
| Código que elige archivo SQL | `backend/app/services/sync_extractors.py` |
| FKs MySQL `epem` ya volcadas (tablas v2) | `archive-md-no-canonico/docs/archive/epem_mysql_verified_2026-03-28.md` |
| Esquema MySQL completo (agentes: tablas/columnas/FK) | Regenerar con `python scripts/mysql_schema_to_agent_guide.py` → `docs/agents/mysql-epem-schema-agent-guide.md` |
| Significado de **enteros/códigos** y columnas núcleo `epem` | `base.md` §10–§11 y **Apéndice A** |

---

## 9. Referencias cruzadas

- `AGENTS.md` — `gestion_month`, tramos, LTV, exclusiones, scope `enterprise_id`, contratos excluidos cobranzas.
- `archive-md-no-canonico/docs/sync-business-keys.md` — unicidad en Postgres.
- `archive-md-no-canonico/docs/data-contracts.md` — contratos de columnas por dominio CSV.
- `archive-md-no-canonico/docs/analytics-data-dependencies.md` — MySQL → snapshot brokers.
- Modelos SQLAlchemy: `backend/app/models/brokers.py`.
- Migraciones: `backend/alembic/versions/`.
- `archive-md-no-canonico/docs/archive/epem_mysql_verified_2026-03-28.md` — FKs verificadas en servidor (metadatos).
- `base.md` §10–§11 y **Apéndice A** — columnas núcleo y catálogos legacy (PHP).

---

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
| `quotas_amount` | **Plazo original del contrato en cantidad de cuotas** (ej. 12, 18). Alias en cartera: `periodo_cuotas`. No suma renovaciones. | Coherente con catálogo `quantity-cuota` (Apéndice A: 12, 15, 18, 24…). |
| `amount` | Monto de la cuota | Alias `monto_cuota` |
| `actual_fee_quantity` | **Cuotas / periodos de cargo acumulados en el tiempo**, incluyendo **renovaciones** y extensiones del mismo contrato. Puede ser **multiplo** de `quotas_amount` (ej. `72` con plazo base **18** → 4 ciclos de 18). Alias en cartera: `total_cuotas` (nombre de alias **no** implica “solo plazo inicial”). | Para “cuantas cuotas tiene el producto firmado” usar `quotas_amount`; para alcance total de cargos incl. renovar, usar `actual_fee_quantity` y/o reglas de negocio de renovación. |
| `inscription` | Inscripcion | |
| `observation` | Observacion libre | |

#### Tramo 7+ y `monto_a_cobrar` (regla `AGENTS.md` 5.1)

Si **`cuotas_vencidas >= 7`** (mora máxima operativa; tramo mostrado **7**), al armar **`monto_a_cobrar = monto_vencido + monto_cuota`** el **`monto_vencido`** que usa el pipeline **no debe** asumir mora de **todas** las vueltas de un contrato renovado. Solo la **primera vuelta** (**`quotas_amount`** cuotas). En sync (`cartera_fact`) se aplica cota **`min(monto_vencido_raw, quotas_amount * monto_cuota)`** mientras el extracto no desglose mora por ciclo. Ver **`AGENTS.md`** 5.1 y 9.

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

### `branches`

| Columna | Significado |
|---------|-------------|
| `id`, `name` | Sucursal (cartera: alias `sucursal`; cobranzas: `Suc` desde pago) |

### `users`

| Columna | Significado |
|---------|-------------|
| `id` | PK (vendedor, supervisor, gestor) |
| `first_name`, `last_name` | Nombre para `CONCAT_WS` en extractos |

### `insurances` / `product_money_loans`

| Columna | Significado |
|---------|-------------|
| `id`, `name` | Seguro / producto financiero en cartera (`seguro`, `producto`) |

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

**Mantenimiento:** al actualizar el monolito, guardar el export PHP como `docs/constants.txt`, ejecutar `python scripts/append_constants_to_base_md.py` (hacer **commit** antes: reescribe desde §10 hasta el final) o pegar manualmente el contenido del Apéndice A. Registrar fecha en el commit.

---

## Apéndice A — `constants` legacy (texto PHP integral)

```php
<?php

return [

    'engagement-letters-status' => [
        1 => [
            'id' => 1,
            'name' => 'Nuevo',
            'label' => 'default',
            'color' => '#ddd',
            'text-color' => '#000',
        ],
        5 => [
            'id' => 5,
            'name' => 'Confirmado',
            'label' => 'success',
            'color' => '#5cb85c',
            'text-color' => '#fff',
        ],
        10 => [
            'id' => 10,
            'name' => 'Cancelado',
            'label' => 'danger',
            'color' => '#d9534f',
            'text-color' => '#fff',
        ],
    ],

    'tshirt-size' => [
        'XS' => 'XS',
        'P' => 'P',
        'M' => 'M',
        'G' => 'G',
        'GG' => 'GG',
        'XL' => 'XL',
        'XXL' => 'XXL',
        'XXXL' => 'XXXL',
        'XXXXL' => 'XXXXL',
        'XXXXXL' => 'XXXXXL',
    ],

    'pants-size' => [
        '27' => '27',
        '30' => '30',
        '32' => '32',
        '34' => '34',
        '36' => '36',
        '38' => '38',
        '40' => '40',
        '42' => '42',
        '44' => '44',
        '46' => '46',
        '48' => '48',
        '50' => '50',
        '52' => '52',
        '54' => '54',
        '56' => '56',
        '58' => '58',
        '60' => '60',
    ],

    'motive-reject-check' => [
        1 => 'ENDOSO DIFICIENTE',
        2 => 'NO VÁLIDO COMO CH. BANCARIO',
        3 => 'FECHA DEFICIENTE',
        4 => 'TEXTO DEFICIENTE',
        5 => 'FIRMA DIFICIENTE',
        6 => 'PRESENTACIÓN EXTEMPORÁNEA',
        7 => 'FALTA DE FONDOS',
        8 => 'ENDOSO DIFICIENTE',
        9 => 'CUENTA CANCELADA',
        10 => 'FIRMANTE INHAB. PARA OPERAR EN CTAS. CTES.',
        11 => 'ORDEN DE NO PAGO',
    ],

    'employee-complaint-types' => [
        1 => [
            'id' => 1,
            'name' => 'Sugerencia',
            'label' => 'warning',
        ],
        2 => [
            'id' => 2,
            'name' => 'Reclamo',
            'label' => 'primary',
        ],
        3 => [
            'id' => 3,
            'name' => 'Denuncia',
            'label' => 'danger',
        ],
    ],

    'web-work-forms-civil-status' => [
        1 => 'Soltero/a',
        2 => 'Casado/a',
    ],

    'web-work-forms-civil-status' => [
        1 => 'Soltero/a',
        2 => 'Casado/a',
    ],

    'collector-list-order' => [
        1 => 'Débitos que pagaron en efectivo',
        2 => 'Segmentación por sucursal',
        3 => 'Por unidad de negocio',
        4 => 'Por tramos de atraso',
        5 => 'Pagaron el mes pasado',
        6 => 'Tienen tratamientos realizados',
        7 => 'Pagos parciales'
    ],

    'contract-clients-relationships' => [
        1 => 'Padres (Padre/Madre)',
        2 => 'Abuelo/a',
        3 => 'Hijo/a',
        4 => 'Primo/a',
        5 => 'Amigo/a',
        6 => 'Concubino/a',
        7 => 'Esposo/a',
        8 => 'Sobrino/a',
        9 => 'Hermano/a',
        10 => 'Tio/a',
        11 => 'Nuero/a',
        12 => 'Novio/a',
        13 => 'Cuñado/a',
        14 => 'Ahijado/a',
        15 => 'Nieto/a'
    ],

    'restockings-status' => [
        1 => 'Pendiente',
        2 => 'Anulado',
        3 => 'Aprobado',
        4 => 'Culminado'
    ],

    'restockings-status-label' => [
        1 => 'primary',
        2 => 'danger',
        3 => 'info',
        4 => 'success'
    ],

    'complaint-departments' => [
        1 => 'Ventas',
        2 => 'ATC',
        3 => 'Fidelización',
        4 => 'Cobranzas',
        5 => 'Agendamiento',
        6 => 'Clínicas Terciarizadas',
        7 => 'Doctores',
        8 => 'Control de Calidad',
    ],

    'pronet-api-bankids' => [
        44   => 'COOPERATIVA UNIVERSITARIA',
        64   => 'FINANCIERA PYO. JAPONESA',
        65   => 'INTERFISA BANCO',
        67   => 'BANCO ATLAS S.A.',
        75   => 'ASO. PYA. ADVENTISTAS DEL 7MO. DIA - SAMAP',
        79   => 'FINANCIERA FINLATINA',
        88   => 'COOPERATIVA MBURICAO LTDA.',
        95   => 'BANCO ITAPUA S.A.E.C.A.',
        96   => 'SOLAR AHORRO Y FINANZAS S.A.E.C.A.',
        111  => 'COOP. MULTIACTIVA SAN CRISTOBAL LTDA.',
        123  => 'SERVIFACIL S.R.L.',
        223  => 'BANCO NACIONAL DE FOMENTO',
        514  => 'BANCO PARA LA COMERCIALIZACION Y LA PRODUCCION',
        663  => 'BANCO REGIONAL S.A.E.C.A.',
        854  => 'BBVA PARAGUAY S.A.',
        1329 => 'BANCO ITAU S A PARAGUAY',
        3069 => 'EGLOBAL S.A.',
    ],

    'contract-promotion-types' => [
        1 => '%',
        2 => 'Monto',
    ],

    'summary_movements_tapo_type' => [
        1 => 'Producto',
        2 => 'Vía Cobro'
    ],

    'bank-account-types' => [
        1 => 'Cuenta Corriente',
        2 => 'Caja de Ahorro',
    ],

    'bank-concept-types' => [
        1 => 'Debe',
        2 => 'Haber',
    ],

    'bank-detail-types' => [
        1 => 'Crédito',
        2 => 'Débito',
    ],

    'type_salary' => [
        1 => 'Mensual',
        2 => 'Por Horas',
        3 => 'Comisionista',
        4 => 'Jornal',
        5 => 'Tiempo Parcial'
    ],

    'type_fund' => [
        1 => 'Efectivo',
        2 => 'Cheque',
        3 => 'Renovaciones'
    ],

    'email-messages-types' => [
        1 => 'Clientes',
        2 => 'Excel',
    ],

    'email-messages-types-label' => [
        1 => 'warning',
        2 => 'success',
    ],

    'sms-messages-types' => [
        1 => 'Clientes',
        2 => 'Excel',
    ],

    'sms-messages-types-label' => [
        1 => 'warning',
        2 => 'success',
    ],

    'phone-prefixes' => [
        '0981' => '0981',
        '0982' => '0982',
        '0983' => '0983',
        '0984' => '0984',
        '0985' => '0985',
        '0986' => '0986',
        '0987' => '0987',
        '0988' => '0988',
        '0971' => '0971',
        '0972' => '0972',
        '0973' => '0973',
        '0974' => '0974',
        '0975' => '0975',
        '0976' => '0976',
        '0991' => '0991',
        '0992' => '0992',
        '0993' => '0993',
        '0994' => '0994',
        '0995' => '0995',
        '0961' => '0961',
        '0962' => '0962',
        '0963' => '0963',
        '021' => '021',
        '0224' => '0224',
        '0226' => '0226',
        '0228' => '0228',
        '0271' => '0271',
        '0275' => '0275',
        '032' => '032',
        '038' => '038',
        '0336' => '0336',
        '044' => '044',
        '046' => '046',
        '048' => '048',
        '0514' => '0514',
        '0521' => '0521',
        '0532' => '0532',
        '0542' => '0542',
        '0547' => '0547',
        '061' => '061',
        '071' => '071',
        '072' => '072',
        '073' => '073',
        '0775' => '0775',
        '0780' => '0780',
        '081' => '081',
        '083' => '083',
        '+54' => '+54',
        '+55' => '+55',
        '0294' => '0294',
        '+57' => '+57',
        '+34' => '+34',
    ],

    'type-phone-prefixes' => [
        '0981' => ['3', '4', '5'],
        '0982' => ['3', '4', '5'],
        '0983' => ['3', '4', '5'],
        '0984' => ['3', '4', '5'],
        '0985' => ['3', '4', '5'],
        '0986' => ['3', '4', '5'],
        '0987' => ['3', '4', '5'],
        '0988' => ['3', '4', '5'],
        '0971' => ['3', '4', '5'],
        '0972' => ['3', '4', '5'],
        '0973' => ['3', '4', '5'],
        '0974' => ['3', '4', '5'],
        '0975' => ['3', '4', '5'],
        '0976' => ['3', '4', '5'],
        '0991' => ['3', '4', '5'],
        '0992' => ['3', '4', '5'],
        '0993' => ['3', '4', '5'],
        '0994' => ['3', '4', '5'],
        '0995' => ['3', '4', '5'],
        '0961' => ['3', '4', '5'],
        '0962' => ['3', '4', '5'],
        '0963' => ['3', '4', '5'],
        '021' => ['1', '2', '4'],
        '0224' => ['1', '2', '4'],
        '0226' => ['1', '2', '4'],
        '0228' => ['1', '2', '4'],
        '0271' => ['1', '2', '4'],
        '0275' => ['1', '2', '4'],
        '032' => ['1', '2', '4'],
        '038' => ['1', '2', '4'],
        '0336' => ['1', '2', '4'],
        '044' => ['1', '2', '4'],
        '046' => ['1', '2', '4'],
        '048' => ['1', '2', '4'],
        '0514' => ['1', '2', '4'],
        '0521' => ['1', '2', '4'],
        '0532' => ['1', '2', '4'],
        '0542' => ['1', '2', '4'],
        '0547' => ['1', '2', '4'],
        '061' => ['1', '2', '4'],
        '071' => ['1', '2', '4'],
        '072' => ['1', '2', '4'],
        '073' => ['1', '2', '4'],
        '0775' => ['1', '2', '4'],
        '0780' => ['1', '2', '4'],
        '081' => ['1', '2', '4'],
        '083' => ['1', '2', '4'],
        '+54' => ['1', '2', '3', '4', '5'],
        '+55' => ['1', '2', '3', '4', '5'],
        '0294' => ['1', '2', '4'],
        '+57' => ['1', '2', '3', '4', '5'],
    ],

    'sales-opportunity-type-status' => [
        1 => 'Vendedor',
        2 => 'Cerrador',
    ],

    'collector-app-type-income' => [
        'C' => 'COBRO EXTRAORDINARIO',
        'S' => 'COBRO DE HOJA DE RUTA',
        'N' => 'NO COBRO',
    ],

    'sales-opportunity-type-status-label' => [
        1 => 'warning',
        2 => 'primary',
    ],

    'loyalty-type' => [
        1 => 'Cupon de beneficios',
        2 => 'Cupon aleatorio',
        3 => 'Gift Card',
        4 => 'Cupo de decuento',
        5 => 'Membresia'
    ],

    'loyalty-coupons-status' => [
        1  => 'Nuevo',
        3  => 'Pendiente',
        4  => 'En uso',
        5  => 'Utilizado',
        10 => 'Eliminado',
    ],

    'loyalty-coupons-status-label' => [
        1  => 'primary',
        3  => 'warning',
        4  => 'info',
        5  => 'success',
        10 => 'danger',
    ],

    'loyalty-detail-status' => [
        1 => 'Pendiente',
        2 => 'Utilizado'
    ],

    'loyalty-detail-status-label' => [
        1 => 'warning',
        2 => 'success'
    ],

    'te-buscamos-status' => [
        0 => 'No Encontrado',
        1 => 'Encontrado',
    ],

    'te-buscamos-status-label' => [
        0 => 'danger',
        1 => 'success',
    ],

    'reports-discounts-gratifications' => [
        1 => 'Gratificación',
        2 => 'Descuento',
    ],

    'reports-discounts-gratifications-label' => [
        1 => 'success',
        2 => 'danger',
    ],

    'occupational-medicine-client-files-status' => [
        1 => 'Nuevo',
        5 => 'En Proceso',
        10 => 'Finalizado',
        15 => 'Cancelado',
        20 => 'No Entregado',
        // 25 => 'Eliminado',
    ],

    'occupational-medicine-client-files-status-label' => [
        1 => 'primary', //green
        5 => 'warning', //orange
        10 => 'success', //blue
        15 => 'danger', //red
        20 => 'info',  //light blue
    ],

    'type-status-board-collection-label' => [
        0 => 'success',
        1 => 'danger'
    ],

    'occupational-medicine-work-order-status' => [
        1 => 'Nuevo',
        3 => 'Pendiente',
        5 => 'En Proceso',
        10 => 'Finalizado',
        15 => 'Cancelado',
        20 => 'Eliminado',
    ],

    'occupational-medicine-work-order-status-label' => [
        1 => 'success',
        3 => 'default',
        5 => 'warning',
        10 => 'primary',
        15 => 'info',
        20 => 'danger',
    ],

    'complaints-status' => [
        1 => 'Nuevo',
        3 => 'Remitido',
        5 => 'En Proceso',
        8 => 'Resuelto',
        10 => 'Terminado',
        15 => 'Cancelado',
        20 => 'Eliminado',
    ],

    'complaints-status-label' => [
        1 => 'success',
        3 => 'success',
        5 => 'warning',
        8 => 'warning',
        10 => 'primary',
        15 => 'info',
        20 => 'danger',
    ],

    'sms-messages-type' => [
        1 => 'Campañas',
        2 => 'Promesa de Pago',
        3 => 'Bienvenida',
        4 => 'Encuesta de Satisfacción Odontología',
    ],

    'sms-messages-status' => [
        1  => 'Generado',
        5  => 'Pendiente',
        10 => 'Entregado',
        15 => 'Error',
    ],

    'sms-messages-status-label' => [
        1 => 'warning',
        5 => 'primary',
        10 => 'success',
        15 => 'danger',
    ],

    'client-laboratories-status' => [
        1  => 'Pendiente de Entrega',
        5  => 'En Laboratorio',
        10 => 'Recibido',
        15 => 'Colocado',
        20 => 'Rechazado',
        25 => 'Eliminado',
    ],

    'qualification-evaluation-period' => [
        1 => 'Regular',
        2 => 'Bueno',
        3 => 'Muy Bueno',
        4 => 'Excelente'
    ],

    'date-range-client-laboratories' => [
        1  => 'Creación',
        2  => 'Enviado a Laboratorio',
        3  => 'Recibido',
        4  => 'Facturado'
    ],

    'date-range-client-laboratories-denpro' => [
        1  => 'Creación',
        2  => 'Enviado a Laboratorio',
        3  => 'Terminado',
        4  => 'Entregado',
        5  => 'Recepcion',
        6  => 'Facturado'
    ],

    'client-laboratories-prosthesis-status' => [
        1  => 'Pendiente',
        5  => 'Recepción',
        10 => 'Laboratorio',
        13 => 'En proceso',
        15 => 'Terminado',
        20 => 'Entregado',
        25 => 'Eliminado',
        30 => 'Trabajo Rechazado',
        35 => 'Muestra Rechazada'
    ],

    'client-laboratories-prosthesis-process-status' => [
        10 => 'Pendiente',
        13 => 'En Proceso',
        15 => 'Terminado'
    ],

    'discount-interests-status' => [
        1  => 'Pendiente',
        2  => 'Utilizado',
        3  => 'Borrado'
    ],

    'discount-interests-status-label' => [
        1 => 'success',
        2 => 'info',
        3 => 'danger'
    ],

    'client-laboratories-prosthesis-delivered-status' => [
        5  => 'Recepción',
        10 => 'Laboratorio'
    ],

    'client-laboratories-prosthesis-process-status-label' => [
        10 => 'danger',
        13 => 'info',
        15 => 'success'
    ],

    'client-laboratories-prosthesis-status-label' => [
        1  => 'primary',
        5  => 'info',
        10 => 'warning',
        13 => 'warning',
        15 => 'success',
        20 => 'success',
        25 => 'danger',
        30 => 'danger',
        35 => 'danger'
    ],

    'client-laboratories-status-label' => [
        1 => 'default',
        5 => 'info',
        10 => 'warning',
        15 => 'success',
        20 => 'danger',
        25 => 'danger',
    ],

    'sales-opportunity-creator' => [
        1 => 'Vendedor',
        2 => 'Jefe de Canales',
        3 => 'API',
        4 => 'Sistema'
    ],

    'type_iva' => [
        1 => 'Exenta',
        2 => '5 %',
        3 => '10 %'
    ],

    'type_purchases_payments' => [
        1 => 'Efectivo',
        2 => 'Cheque',
        3 => 'Transferencia'
    ],

    'invoice_copy' => [
        0 => 'Cargado',
        1 => 'Original',
        2 => 'Copia'
    ],

    'purchases-accounting-plan-type' => [
        0 => 'No Pago',
        1 => 'Pago',
    ],

    'type_accounting_entry' => [
        1 => 'Automatica',
        2 => 'Manual'
    ],

    'accounting-planes-configuration' => [
        1 => 'Venta - 5 %',
        2 => 'Venta - 10 %',
        3 => 'Compra - 5 %',
        4 => 'Compra - 10 %',
        5 => 'Cta Crédito - Recaudación',
        6 => 'Cta Débito - Cobros Mediante App',
        7 => 'Factura Crédito',
        8 => 'Estado de Resultados'
    ],

    'sales-opportunity-status' => [
        1 => 'Nuevo',
        5 => 'En Proceso',
        10 => 'Asignado a Cerrador',
        13 => 'Venta Cajon',
        15 => 'Vendido',
        20 => 'Rechazado',
        30 => 'Eliminado'
    ],

    'sale-closing-type' => [
        1 => 'Asignado a Cerrador',
        2 => 'Cierre en Sucursal'
    ],

    'sale-closing-type-label' => [
        1 => 'defalt',
        2 => 'info'
    ],

    'sales-opportunity-status-label' => [
        1 => 'default',
        5 => 'info',
        10 => 'warning',
        15 => 'success',
        13 => 'warning',
        20 => 'danger',
        30 => 'danger',
    ],

    'employee-searches-status' => [
        1 => 'Nuevo',
        2 => 'En Seguimiento',
        3 => 'Aprobado',
        4 => 'Rechazado',
        5 => 'Eliminado',
        6 => 'Completada',
        7 => 'En Pausa',
    ],

    'employee-searches-status-label' => [
        1 => 'default',
        2 => 'info',
        3 => 'primary',
        4 => 'warning',
        5 => 'danger',
        6 => 'success',
        7 => 'white',
    ],

    'dismissals-status' => [
        1 => 'Nuevo',
        2 => 'En Seguimiento',
        3 => 'Aprobado',
        4 => 'Rechazado',
        5 => 'Eliminado',
        6 => 'Completada',
        7 => 'En Pausa',
    ],

    'dismissals-status-label' => [
        1 => 'default',
        2 => 'info',
        3 => 'primary',
        4 => 'warning',
        5 => 'danger',
        6 => 'success',
        7 => 'white',
    ],

    'contract-file-types' => [
        1  => 'Documentación', // no se usa
        2  => 'Cédula y/o Croquis', // no se usa
        3  => 'Solicitud',
        4  => 'Cedula',
        5  => 'Autorizacion',
        6  => 'Contrato',
        7  => 'Croquis',
        8  => 'Anexo de Cobertura',
        9  => 'Tarjeta',
        10 => 'Registro de Firmas',
        11 => 'Nota de Cancelación',
        12 => 'Pagaré',
        13 => 'Informconf',
        14 => 'IPS',
        15 => 'SET',
        16 => 'Otros',
        17 => 'Recibo de dinero'
    ],

    'employee-file-types' => [
        1  => 'Cédula',
        2  => 'Antecedente Policial',
        3  => 'Sanciones',
        4  => 'Vida y Residencia',
        5  => 'Nota de entrega de notebook',
        6  => 'Nota de entrega de telefono',
        7  => 'Servicios Publicos',
        8  => 'Registro de Conducir',
        9  => 'Curriculum Vitae',
        10 => 'Registro profesional de odontología',
        11 => 'Fotografía',
        12 => 'Ficha de ingreso',
        13 => 'Nota de entrega de uniforme',
        14 => 'Nota de entrega de equipos de seguridad',
        15 => 'Solicitud de vacaciones'
    ],

    'type_movement_purchases_movements' => [
        1 => 'Entrada',
        2 => 'Salida'
    ],

    'type_operation_purchases_movements' => [
        1 => 'Recepción',
        2 => 'Stock Inicial',
        3 => 'Transferencia',
        4 => 'Consumo',
        5 => 'Doctor',
        6 => 'Exedente',
        7 => 'Obsequio',
        8 => 'Inventario',
        9 => 'Venta'
    ],

    'type_operation_purchases_movements_entry' => [
        2 => 'Stock Inicial',
        6 => 'Exedente'
    ],

    'type_operation_purchases_movements_exit' => [
        4 => 'Consumo',
        5 => 'Doctor',
        9 => 'Venta'
    ],

    'method_print' => [
        1 => 'Formulario Pre-Impreso',
        2 => 'Auto Impresión'
    ],

    'contract-file-types-label' => [
        1 => 'success',
        2 => 'danger',
        3 => 'warning',
        4 => 'primary',
        5 => 'info',
        6 => 'default',
    ],

    'voucher-status' => [
        1 => 'Emitido',
        2 => 'Anulado',
        3 => 'Eliminado',
    ],

    'seller-type' => [
        1 => 'EXTERNO',
        2 => 'CALL CENTER BASE CALIENTE',
        3 => 'CALL CENTER BASE FRIO',
        4 => 'BROKER'
    ],

    'seller-city' => [
        1 => 'ASUNCION',
        2 => 'INTERIOR'
    ],

    'seller-city-label' => [
        1 => 'primary',
        2 => 'info',
    ],

    'seller-number-commission' => [
        1 => '1ER ANTICIPO',
        2 => '2DA DEBITO/50% COBRADOR',
        3 => '20% DEBITO/COBRADOR'
    ],

    'voucher-status-label' => [
        1 => 'primary',
        2 => 'danger',
        3 => 'warning',
    ],

    'dental-budget-status' => [
        1 => 'Pendiente',
        3 => 'Financiacion pendiente',
        5 => 'Confirmado',
        10 => 'En Proceso',
        15 => 'Culminado',
        20 => 'Anulado',
    ],

    'dental-budget-status-label' => [
        1 => 'primary',
        3 => 'primary',
        5 => 'default',
        10 => 'danger',
        15 => 'success',
        20 => 'warning',
    ],

    'dental-budget-detail-status' => [
        1 => 'Nuevo',
        10 => 'Pendiente',
        20 => 'En Proceso',
        30 => 'Terminado',
        40 => 'Cancelado',
    ],

    'dental-budget-detail-status-short' => [
        1 => 'N',
        10 => 'P',
        20 => 'E',
        30 => 'T',
        40 => 'C',
    ],

    'dental-budget-detail-status-label' => [
        1 => 'default',
        10 => 'primary',
        20 => 'warning',
        30 => 'success',
        40 => 'danger',
    ],

    'teeth-pieces' => [
        11 => 11,
        12 => 12,
        13 => 13,
        14 => 14,
        15 => 15,
        16 => 16,
        17 => 17,
        18 => 18,
        21 => 21,
        22 => 22,
        23 => 23,
        24 => 24,
        25 => 25,
        26 => 26,
        27 => 27,
        28 => 28,
        31 => 31,
        32 => 32,
        33 => 33,
        34 => 34,
        35 => 35,
        36 => 36,
        37 => 37,
        38 => 38,
        41 => 41,
        42 => 42,
        43 => 43,
        44 => 44,
        45 => 45,
        46 => 46,
        47 => 47,
        48 => 48,
        51 => 51,
        52 => 52,
        53 => 53,
        54 => 54,
        55 => 55,
        61 => 61,
        62 => 62,
        63 => 63,
        64 => 64,
        65 => 65,
        71 => 71,
        72 => 72,
        73 => 73,
        74 => 74,
        75 => 75,
        81 => 81,
        82 => 82,
        83 => 83,
        84 => 84,
        85 => 85
    ],

    'calendar-events-status' => [
        1 => 'Pendiente de Confirmación',
        // 2 => 'Entre Paciente',
        3 => 'Ausente',
        5 => 'Confirmado',
        10 => 'En Clínica / En Espera',
        15 => 'En Consultorio',
        20 => 'Atendido',
        23 => 'Reagendado',
        25 => 'Cancelado'
    ],

    'calendar-events-status-label' => [
        1 => 'warning',
        // 2 => 'out',
        3 => 'danger',
        5 => 'default',
        10 => 'primary',
        15 => 'info',
        20 => 'success',
        23 => 'change',
        25 => 'danger',
    ],

    'calendar-events-status-absence' => [
        1 => 'NO ASISTENCIA',
        2 => 'RETIRO DE LA CLINICA'
    ],

    'calendar-events-status-absence-label' => [
        1 => 'warning',
        2 => 'danger'
    ],

    'calendar-events-status-fields' => [
        // 2 => 'status_out_of_turn_date',
        5 => 'status_confirmation_date',
        3 => 'status_absent_date',
        10 => 'status_clinic_date',
        15 => 'status_consulting_room_date',
        20 => 'status_attended_date',
        23 => 'status_reschedule_date',
        25 => 'status_canceled_date'
    ],

    'css-color-labels' => [
        'warning' => 'f8ac59', // amarillo
        'out' => '808000', // aceituna
        'default' => 'd1dade', // gris
        'danger' => 'ed5565', // rojo
        'info' => '23c6c8', // celeste
        'success' => '1c84c6', // azul
        'change' => 'FF00FF', // fucsia
        'primary' => '1ab394' // verde agua
    ],

    'invoice_condition' => [
        1 => 'Contado',
        2 => 'Crédito'
    ],

    'voucher_type' => [
        1 => 'Factura',
        2 => 'Nota de Crédito',
        3 => 'Cobro Factura',
        4 => 'Exoneracion de tratamiento',
        5 => 'Exoneracion'
    ],

    'status_employee_assistances' => [
        1 => 'Pendiente de pago',
        2 => 'Pagado',
        3 => 'Borrado',
        4 => 'En Proceso',
        5 => 'Pendiente de aprobación'
    ],

    'label_status_employee_assistances' => [
        1 => 'info',
        2 => 'success',
        3 => 'danger',
        4 => 'warning',
        5 => 'primary'
    ],

    'invoice-collections-status' => [
        1 => 'Emitido',
        2 => 'Borrado',
        3 => 'Anulado'
    ],

    'label-invoice-collections-status' => [
        1 => 'primary',
        3 => 'danger'
    ],
    'meses-corto' => [
        1 => 'Ene',
        2 => 'Feb',
        3 => 'Mar',
        4 => 'Abr',
        5 => 'May',
        6 => 'Jun',
        7 => 'Jul',
        8 => 'Ago',
        9 => 'Sep',
        10 => 'Oct',
        11 => 'Nov',
        12 => 'Dic'
    ],

    'day-week' => [
        0 => 'Domingo',
        1 => 'Lunes',
        2 => 'Martes',
        3 => 'Miércoles',
        4 => 'Jueves',
        5 => 'Viernes',
        6 => 'Sábado'
    ],

    'dias-semana' => [
        1 => 'Lunes',
        2 => 'Martes',
        3 => 'Miércoles',
        4 => 'Jueves',
        5 => 'Viernes',
        6 => 'Sábado',
        7 => 'Domingo'
    ],

    'meses-largo' => [
        1 => 'Enero',
        2 => 'Febrero',
        3 => 'Marzo',
        4 => 'Abril',
        5 => 'Mayo',
        6 => 'Junio',
        7 => 'Julio',
        8 => 'Agosto',
        9 => 'Septiembre',
        10 => 'Octubre',
        11 => 'Noviembre',
        12 => 'Diciembre'
    ],

    'numero-dias-mes' => [
        1  => '01',
        2  => '02',
        3  => '03',
        4  => '04',
        5  => '05',
        6  => '06',
        7  => '07',
        8  => '08',
        9  => '09',
        10 => '10',
        11 => '11',
        12 => '12',
        13 => '13',
        14 => '14',
        15 => '15',
        16 => '16',
        17 => '17',
        18 => '18',
        19 => '19',
        20 => '20',
        21 => '21',
        22 => '22',
        23 => '23',
        24 => '24',
        25 => '25',
        26 => '26',
        27 => '27',
        28 => '28',
        29 => '29',
        30 => '30',
        31 => '31'
    ],

    'status' => [
        1 => 'Activo',
        0 => 'Inactivo'
    ],

    'status-label' => [
        1 => 'success',
        0 => 'danger'
    ],

    'employee_vacation-status' => [
        0 => 'Eliminado',
        1 => 'Pendiente',
        2 => 'Autorizado Gerencia',
        3 => 'Autorizado RRHH',
        4 => 'Causado'
    ],

    'employee_vacation-status-label' => [
        0 => 'danger',
        1 => 'success',
        2 => 'primary',
        3 => 'info'
    ],

    'type_amount' => [
        1 => 'Porcentaje',
        2 => 'Monto'
    ],

    'type_product' => [
        1 => 'Servicio',
        2 => 'Mercaderia'
    ],

    'type_amount_viatic' => [
        1 => 'Cantidad',
        2 => 'Monto'
    ],

    'type_non_payment_reasons' => [
        1 => 'Gestor',
        2 => 'Cobrador',
        3 => 'Gestor/Cobrador'
    ],

    'contracts_situation_type' => [
        1 => 'Inubicable',
        2 => 'Incobrable',
        3 => 'Culminado'
    ],

    'portfolio_movement_type' => [
        1 => 'Agregar',
        2 => 'Cambiar',
        3 => 'Eliminar'
    ],

    'period_debit' => [
        1 => 'Mensual',
        2 => 'Diario'
    ],

    'civil_status' => [
        1 => 'Soltero/a',
        2 => 'Casado/a',
        3 => 'Viudo/a',
        4 => 'Divorciado/a',
        5 => 'Empresa'
    ],

    'gender' => [
        1 => 'Femenino',
        2 => 'Masculino',
        3 => 'Indistinto'
    ],

    'type-number' => [
        1 => 'Linea Baja PY (Casa / Particular)', // Casa
        2 => 'Linea Baja PY (Trabajo)', // Trabajo
        3 => 'Celular PY (Particular)', // Particular
        4 => 'Otro',
        5 => 'Celular PY (Trabajo)',
    ],

    'type-number-mask' => [
        1 => '(999) 999-9999',
        2 => '(999) 999-9999',
        3 => '(9999) 999-999',
        4 => NULL,
        5 => '(9999) 999-999',
    ],

    'quality-control-status' => [
        1 => 'Aprobada',
        2 => 'Rechazada',
        3 => 'Eliminada',
    ],

    'quality-control-status-label' => [
        1 => 'success',
        2 => 'danger'
    ],

    'quality-control-management-status' => [
        1 => 'APROBADA',
	    2 => 'REGULARIZACIÓN DE DOCUMENTOS',
        3 => 'RECEPCIÓN DOCUMENTOS FISICOS',
        4 => 'ACTIVADO POR EXCEPCION',
        5 => 'RECHAZADA',
        6 => 'VOLVER A LLAMAR',
        7 => 'FALTA ASESORAMIENTO'
    ],

    'first_payment_made' => [
        1 => 'SI',
        2 => 'NO'
    ],

    'automatic-renewal' => [
        1 => 'SI',
        2 => 'NO'
    ],

    'not_commisionable_collector' => [
        0 => 'SI',
        1 => 'NO'
    ],

    'provider' => [
        0 => 'NO',
        1 => 'SI'
    ],

    'type_stock_minimum' => [
        1 => 'Stock Minimo',
        2 => 'Stock Maximo'
    ],

    'type_address' => [
        1 => 'Casa',
        2 => 'Trabajo',
        3 => 'Entrega de Carnet',
        4 => 'Otro',
        5 => 'Cobertura'
    ],

    'type_plan' => [
        1 => 'Individual',
        2 => 'Familiar',
        3 => 'Corporativo'
    ],

    'attended' => [
        1 => 'Positiva',
        2 => 'Negativa'
    ],

    'visit' => [
        1 => 'Positiva',
        2 => 'Negativa'
    ],

    'attended-label' => [
        1 => 'success',
        2 => 'danger'
    ],

    'form_of_commission_payment' => [
        1 => 'Completa',
        2 => 'Parcial'
    ],

    'status-authorization' => [
        1 => 'Aprobado',
        2 => 'Procesado',
        3 => 'Cancelado',
        4 => 'Pendiente'
    ],

    'authorization-status-label' => [
        1 => 'success',
        2 => 'info',
        3 => 'danger',
        4 => 'primary'
    ],

    'result_authorization' => [
        1 => 'Aprobado',
        2 => 'Rechazado'
    ],

    'authorization-type' => [
        1 => 'Laboratorio',
        2 => 'Imagen',
        3 => 'Procedimiento',
        4 => 'Internación Clínica',
        5 => 'Internación Quirurgica',
        6 => 'Fisioterapia',
        7 => 'Consultas',
        8 => 'Urgencias',
        9 => 'Maternidad'
    ],

    'control-type' => [
        1 => 'Cantidad',
        2 => 'Monto'
    ],

    'contract-client-type' => [
        1 => 'Titular',
        2 => 'Adherente'
    ],

    'entity_type' => [
        1 => 'Banco',
        2 => 'Asociación',
        3 => 'Procesadora de tarjetas',
        4 => 'Recursos Humanos'
    ],

    'contract_type' => [
        1 => 'COBRADOR',
        2 => 'DEBITO',
    ],

    'contract_status' => [
        1 => 'Pendiente',
        2 => 'Aprobado por CC',
        3 => 'Rechazado por CC',
        4 => 'Rechazado por Autorización',
        5 => 'Contrato Confirmado',
        6 => 'Contrato Culminado',
        7 => 'Contrato Borrado',
        9 => 'Contrato Inactivado',
        10 => 'Contrato Gestion de Cobranzas'
    ],

    'contract-status-label' => [
        1 => 'warning',
        2 => 'warning',
        3 => 'warning',
        4 => 'warning',
        5 => 'primary',
        6 => 'danger',
        7 => 'danger',
        9 => 'danger',
        10 => 'success'
    ],

    'contract_status_reports' => [
        1 => 'Control Calidad',
        2 => 'Autorización',
        3 => 'Rechazado CC',
        4 => 'Rechazado AC'
    ],

    'contract_status_reports_sales' => [
        1 => 'Control Calidad',
        2 => 'Autorización',
        3 => 'Pendiente',
        4 => 'Confirmado',
        5 => 'Rechazado',
        6 => 'Culminado',
        10 => 'Gestion de Cobranzas'
    ],

    'contract_status_sales' => [
        1 => 'Control Calidad',
        2 => 'Autorización',
        5 => 'Confirmados',
        6 => 'Culminados',
        10 => 'Gestion de Cobranzas'
    ],

    'contract_status_loans' => [
        1 => 'Control',
        2 => 'Rechazado Control',
        3 => 'Analisis',
        4 => 'Rechazado Analisis',
        5 => 'Confirmados',
        6 => 'Culminados',
        7 => 'Anulado',
        8 => 'Liquidacion',
        9 => 'Desembolso',
        // 10 => 'GESTION DE COBRANZA'
    ],

    'status_check_discount' => [
        1 => 'Pendiente de Analisis',
        4 => 'Desembolso',
        5 => 'Activo',
        6 => 'Depositado',
        2 => 'Acreditado',
        3 => 'Rechazado',
        7 => 'Anulado'
    ],

    'status_check_discount_label' => [
        1 => 'default',
        2 => 'info',
        3 => 'danger',
        4 => 'warning',
        5 => 'primary',
        6 => 'success',
        7 => 'danger'
    ],

    'contract_status_loans_label' => [
        1 => 'success',
        2 => 'danger',
        3 => 'success',
        4 => 'danger',
        5 => 'primary',
        6 => 'danger',
        7 => 'danger',
        8 => 'warning',
        9 => 'warning'
    ],

    'contract_status' => [
        1 => 'CONTROL CALIDAD',
        2 => 'Autorización',
        3 => 'Rechazado CC',
        4 => 'Rechazado AC',
        5 => 'ACTIVO',
        6 => 'CULMINADO',
        7 => 'BORRADO',
        9 => 'INACTIVADO',
        10 => 'GESTION DE COBRANZA'
    ],

    'status_transfers_sending' => [
        1 => 'En Transito',
        2 => 'Recibido',
        3 => 'Cancelado'
    ],

    'way_to_pay' => [
        1  => 'Efectivo',
        2  => 'Cheque Bancario',
        3  => 'Retenciones',
        4  => 'Tarjeta Debito',
        5  => 'Tarjeta Credito',
        6  => 'Pronet',
        7  => 'Dep Cta Corriente',
        8  => 'Asociación',
        9  => 'Clinica Consultorio',
        10 => 'Descuento en Planilla',
        11 => 'Transferencias',
        12 => 'Financiación',        
    ],

    'type_method_payment' => [
        1 => 'Efectivo',
        2 => 'Cheque Bancario',
        3 => 'Tarjeta',
        4 => 'Transferencias',
        5 => 'Debitos',
        6 => 'Retenciones'
    ],

    'type_voucher' => [
        1 => 'Recibo',
        2 => 'Factura',
        3 => 'Comun'
    ],

    'type_membresia' => [
        1 => 'Alivio Sonreí'
    ],

    'sales-opportunity-contact-form' => [
        1 => 'Whatsapp',
        2 => 'INFOBIP',
        3 => 'SMS',
        4 => 'Llamada Entrante',
        5 => 'Llamada Saliente',
        6 => 'En Persona',
        7 => 'Primeras Consultas'

    ],

    'contact_form' => [
        1 => 'Whatsapp',
        2 => 'SMS',
        3 => 'Llamada',
        4 => 'No consigue turno',
        5 => 'Cliente solo quiere pagar por debito'
    ],

    'collection_way' => [
        1 => 'Cobrador',
        2 => 'Aqui Pago',
        3 => 'Débito'
    ],

    'not_attended' => [
        1 => 'Apagado',
        2 => 'No Existe',
        3 => 'No Atiende',
        4 => 'Equivocado',
        5 => 'Menor de Edad',
        6 => 'Inubicable',
        7 => 'Cliente al Día',
        8 => 'Buzon de voz'
    ],

    'visit_negative' => [
        1 => 'Consultorio Cerrado',
        2 => 'No le interesa cambiar su laboratorio',
        3 => 'Tiene un laboratorio interno',
        4 => 'Otros'
    ],

    'type-payment' => [
        1 => 'Cobro',
        2 => 'Primera Cuota',
        3 => 'Exoneración'
    ],

    'employee_contract_status' => [
        1 => 'Activo',
        2 => 'Culminado',
        3 => 'Borrado'
    ],

    'employee_contract_status_label' => [
        1 => 'success',
        2 => 'danger',
        3 => 'warning'
    ],

    'type_payment_employee' => [
        1 => 'Cheque',
        2 => 'Transferencia'
    ],

    'payment-status' => [
        1 => 'Activo',
        2 => 'Borrado',
        3 => 'Revertido'
    ],

    'payment-status-label' => [
        1 => 'success',
        2 => 'danger',
        3 => 'warning'
    ],

    'cadastre-status' => [
        1 => 'Enviado a Catastro',
        2 => 'Catastrado',
        3 => 'Rechazado',
        4 => 'A Regularizacion',
        5 => 'Regularizado',
        6 => 'Borrado'
    ],

    'cadastre-status-label' => [
        1 => 'warning',
        2 => 'success',
        3 => 'danger',
        4 => 'info',
        5 => 'default'
    ],

    'quality_control_call_negative' => [
        1 => 'Volver a llamar',
        2 => 'Rechazada'
    ],

    'type_document' => [
        1 => 'Factura',
        2 => 'Carnet',
        3 => 'Autorización'
    ],

    'commssion-motive' => [
        1 => 'Pago de Comisión',
        2 => 'Descuento'
    ],

    'type_payment_employee_payment' => [
        1 => 'Efectivo',
        2 => 'Cheque',
        3 => 'Tarjeta'
    ],

    'type_commission_payment' => [
        1 => 'Comisión Externo',
        2 => 'Viático',
        3 => 'Comisión Interno',
        4 => 'Descuentos',
        5 => 'Comisión Cobranza',
        6 => 'Comisión Supervisores',
        7 => 'Comisión Cerradores',
        8 => 'Comisión Cobradores',
        9 => 'Comisión Doctores',
        10 => 'Comisión Atencion al Cliente',
        11 => 'Bonificacion',
        12 => 'Recaudacion Doctor',
        13 => 'Comisión Productos/Servicios Estética',
        14 => 'Comisión Corporativa',
        15 => 'Viático Cobradores',
    ],

    'type_collection_sections' => [
        1 => 'Cuota Vencida',
        2 => 'Días del Ultimo Pago'
    ],

    'type_collection_sections_goal' => [
        1 => 'Porcentaje',
        2 => 'Monto Cobrado'
    ],

    'type_collection_sections_commission' => [
        1 => 'Porcentaje',
        2 => 'Monto'
    ],

    'first_consultation' => [
        1 => 'SI',
        0 => 'NO'
    ],

    'cell-payments-charged' => [
        1 => 'Ruta',
        2 => 'Sugerencia',
        3 => 'Cobro Extraordinario'
    ],

    'nationalities-employee' => [
        1 => 'PARAGUAYA',
        2 => 'EXTRANJERO',
        3 => 'INDISTINTO'
    ],

    'cell-payments-charged-short' => [
        1 => 'R',
        2 => 'S',
        3 => 'E'
    ],

    'pending_claim_status' => [
        1   => 'Pendiente',
        2   => 'Procesado',
        3   => 'Entregado',
        4   => 'Cancelado'
    ],

    'temporary-activation-status' => [
        1   =>  'Pendiente',
        2   =>  'Aprobado',
        3   =>  'Rechazado',
        4   =>  'Cancelado'
    ],

    'temporary-activation-status-label' => [
        1 => 'warning',
        2 => 'success',
        3 => 'danger'
    ],

    'temporary-activation-values' => [
        30 => '30 dias'
    ],

    'yes-no' => [
        2 => 'NO',
        1 => 'SI'
    ],

    'available-buy-no' => [
        1 => 'Disponible',
        2 => 'Comprar',
        3 => 'No'
    ],
    'available-create' => [
        1 => 'Disponible',
        2 => 'Crear',
        3 => 'No'
    ],

    'fuel' => [
        1 => 'Si',
        2 => 'No',
        3 => 'S. Necesidad'
    ],

    'billet' => [
        100000 => 100000,
        50000  => 50000,
        20000  => 20000,
        10000  => 10000,
        5000   => 5000,
        2000   => 2000,
        1000   => 1000,
        500    => 500,
        100    => 100,
        50     => 50,
        10     => 10,
        5      => 5,
        1      => 1
    ],

    'type_cash_box' => [
        1 => 'Ingreso',
        2 => 'Egreso'
    ],

    'type_cash_box_label' => [
        1 => 'primary',
        2 => 'danger'
    ],

    'deposit_slip_status' => [
        1 => 'ACTIVO',
        2 => 'REVERTIDO'
    ],

    'type_purchases' => [
        1 => 'Factura',
        2 => 'Boleta',
        3 => 'Auto Factura',
        4 => 'Nota Credito',
        5 => 'Orden de Pago'
    ],

    'type_purchases_label' => [
        1 => 'primary',
        2 => 'info',
        3 => 'danger',
        4 => 'warning'
    ],

    'type_purchases_date' => [
        1 => 'Fecha Compra',
        2 => 'Fecha Ingreso'
    ],

    'purchases_type_' => [
        1 => 'Factura',
        2 => 'Boleta',
        3 => 'Auto Factura',
        4 => 'Nota Credito',
        5 => 'Orden de Pago'
    ],

    'client-service-debts-status' => [
        1 => 'Nuevo',
        5 => 'En Proceso',
        10 => 'Terminado',
    ],

    'type-commission-doctor' => [
        1 => 'Tratamiento',
        5 => 'Mantenimiento Ortodoncia'
    ],

    'cards-status' => [
        1 => 'Impreso',
        2 => 'No Impreso'
    ],
    'coverage' => [
        1 => '100%',
        2 => 'Arancel preferencial',
        3 => 'Arancel preferencial Financiado'
    ],
    'type-patient' => [
        1 => 'Ambulatorio',
        2 => 'Internacion'
    ],
    'coverage-type' => [
        1 => 'Individual',
        2 => 'Grupal'
    ],
    'period' => [
        1 => 'Mensual',
        2 => 'Trimestral',
        3 => 'Semestral',
        4 => 'Anual',
        5 => 'Contrato'

    ],
    'waiting-period' => [
        1 => '30',
        2 => '60',
        3 => '90',
        4 => '120',
        5 => '150',
        6 => '180',
        7 => '210',
        8 => '240',
        9 => '270',
        10 => '300',
        11 => '330',
        12 => '360',
        13 => '390',
        14 => '0',
        15 => '40',
        16 => '45',
        17 => '630'
    ],
    'quantity-medical-coverage' => [
        1 => '1',
        2 => '2',
        3 => '3',
        4 => '4',
        5 => '5',
        6 => '6',
        7 => '7',
        8 => '8',
        9 => '9',
        10 => '10',
        11 => '11',
        12 => '12',
        13 => '13',
        14 => '14',
        15 => '15',
        16 => '16',
        17 => '17',
        18 => '18',
        19 => '19',
        20 => '20',
        21 => '21',
        22 => '22',
        23 => '23',
        24 => '24',
        25 => '25',
        26 => '26',
        27 => '27',
        28 => '28',
        29 => '29',
        30 => '30',
        31 => '31',
        32 => '32',
        33 => '33',
        34 => '34',
        35 => '35',
        36 => '36',
        37 => '37',
        38 => '38',
        39 => '39',
        40 => '40',
        99 => 'Ilimitado'
    ],
    'patient-treatment-status' => [
        1 => 'Confirmado',
        5 => 'En Proceso',
        10 => 'Culminado',
        15 => 'Anulado',
    ],

    'patient-treatment-status-label' => [
        1 => 'default',
        5 => 'info',
        10 => 'primary',
        15 => 'danger',
    ],

    'patient-treatment-detail-status' => [
        1 => 'Pendiente',
        5 => 'En Proceso',
        10 => 'Terminado',
        15 => 'Cancelado',
    ],

    'patient-treatment-detail-status-label' => [
        1 => 'warning',
        5 => 'info',
        10 => 'primary',
        15 => 'danger',
    ],

    'accounting-plans-levels' => [
        1 => 1,
        2 => 2,
        3 => 3,
        4 => 4,
        5 => 5,
        6 => 6,
        7 => 7,
        8 => 8,
        9 => 9,
    ],

    'accounting-plans-types' => [
        1 => 'Debe',
        2 => 'Haber',
    ],

    'type_check_book' => [
        1 => 'A la Vista',
        2 => 'Diferido'
    ],

    'body-area' => [
        0 => '',
        1 => 'Abdomen',
        2 => 'Flancos',
        3 => 'Brazos',
        4 => 'Piernas',
        5 => 'Cadera',
        6 => 'Cola',
        7 => 'Rostro completo',
        8 => 'Bigote',
        9 => 'Bozo',
        10 => 'Dedos manos',
        11 => 'Dedos pies',
        12 => 'Bikini',
        13 => 'Cavado',
        14 => 'Tiro de cola',
        15 => 'Pecho',
        16 => 'Espalda',
        17 => 'Media pierna alta',
        18 => 'Media pierna baja',
        19 => 'Completo'
    ],

    'diseases' => [
        0 => 'Esta consumiendo algun medicamento',
        2 => 'Tiene algún tipo de alergia',
        4 => 'Enfermedades de la piel (infecciones, acné, psoriasis, eczema, erupción, herpes)',
        6 => 'Cardiopatías congestivas / arritmias / hipertensión',
        8 => 'Marcapasos, desfribiladores o implantes metálicos / electrónicos',
        10 => 'Hiper o hipotensión descompensada',
        12 => 'Reemplazo / cirugía de cadera / fémur o implantes en la zona',
        14 => 'Historial de cáncer, activo / reciente, lunares malignos o premalignos',
        16 => 'Patología vascular periférica (flebitis, embolias, várices)',
        18 => 'Cirugía en el área (40 días)',
        20 => 'Desordenes autoinmunes',
        22 => 'Patologías osteoarticulares (fracturas, inflamaciones agudas articulares, miopatías)',
        24 => 'Procesos infecciosos o inflamatorios',
        26 => 'Hipersensibilidad de la piel',
        28 => 'Herpes Zoster',
        30 => 'Embarazo / Fertilización in vitro',
        32 => 'Lactancia (anterior a 3 meses)',
        34 => 'Epilepsia / Convulsiones',
        36 => 'HIV',
        38 => 'Lesiones no diagnosticadas',
        40 => 'Rellenos en la zona',
        42 => 'Mesoterapia en la zona (72 hrs)',
        44 => 'Problemas renales / hepáticos',
        46 => 'DIU en el área',
        48 => 'Observación',
    ],

    'esth-client-service-status' => [
        1 => 'Pendiente',
        2 => 'Procesado',
        3 => 'Eliminado'
    ],

    'esth-client-service-status-label' => [
        1 => 'warning',
        2 => 'primary',
        3 => 'danger',
    ],

    'additional_treatment' => [
        1 => 'SI',
        0 => 'NO'
    ],

    'type-protocol' => [
        1 => 'Patologia',
        2 => 'Depilación'
    ],

    'esth-client-services-debts-status' => [
        1 => 'Pendiente',
        2 => 'Facturado'
    ],

    'accounting-plans-setteable' => [
        1 => 'Asentable',
        2 => 'No Asentable',
    ],

    'order-search-portfolio' => [
        1 => 'Cuotas Vencidas',
        2 => 'Fecha Ultimo Pago',
    ],

    'client-file-type' => [
        1 => 'Consentimiento de Tratamiento (Odontología)',
        2 => 'Consentimiento de Cirugia (Odontología)',
        3 => 'Consentimiento de Depilación (Estética)',
        4 => 'Consentimiento de Tratamientos Corporales (Estética)',
        5 => 'Teleradiografía (Odontología)',
        6 => 'Radiografía Panorámica (Odontología)',
        7 => 'Informe Radiológico (Medicina Laboral)',
        8 => 'Informe Psicológico (Medicina Laboral)',
        9 => 'Imágen STL (Odontología)',
        10 => 'Anàlisis Clìnico (Medicina Laboral)',
        11 => 'Electrocardiograma (Medicina Laboral)',
        12 => 'Ficha (Medicina Laboral)',
    ],

    'debit-entity-file-type' => [
        1 => 'Contrato'
    ],

    'payment-voucher-type' => [
        1 => 'Recibo Comun',
        2 => 'Factura'
    ],

    'print_checks_status' => [
        0 => 'Pendiente',
        1 => 'Impreso'
    ],

    'print_checks_status_label' => [
        0 => 'danger',
        1 => 'primary'
    ],

    'phase-type' => [
        1 => 'Fase 1',
        2 => 'Fase 2',
        3 => 'Fase 3',
        4 => 'Fase 4',
        5 => 'Fase 5',
        6 => 'Fase 6'
    ],

    'usufruct' => [
        1 => 'SI',
        0 => 'NO'
    ],

    'commission-agent' => [
        1 => 'Vendedor Externo',
        2 => 'Vendedor Call'
    ],

    'call-center-call-status' => [
        1 => 'Pendiente',
        2 => 'No contestado',
        3 => 'Contestado'
    ],

    'call-center-call-phone-status' => [
        1 => 'Pendiente',
        2 => 'No Contestado',
        3 => 'Contestado'
    ],

    'call-center-pauses-status' => [
        1 => 'Proceso',
        2 => 'Completado'
    ],

    'user-type' => [
        1 => 'Vendedor call',
        2 => 'Gestor de cobranza'
    ],

    'marker-register-rol-user' => [
        14 => 'Administrador',
        0 => 'Estandar'
    ],

    'bbdd-call-conection-type' => [
        1 => 'Sistema',
        2 => 'Telefonia'
    ],

    'treatment-status' => [
        1 => 'En Proceso',
        2 => 'Terminado'
    ],

    'date-range-type' => [
        1 => 'Creado',
        2 => 'Vendido',
        3 => 'Rechazado'
    ],

    'payment-service-authorization-status' => [
        1 => 'Emitido',
        2 => 'Eliminado',
        3 => 'Liquidado',
        5 => 'En Proceso'
    ],

    'payment-service-authorization-status-label' => [
        1 => 'default',
        2 => 'danger',
        3 => 'success',
        5 => 'warning',
        10 => 'info'
    ],

    'cases-to-calls-status' => [
        1  => 'Pendiente',
        5  => 'En Proceso',
        10 => 'Terminado',
        15 => 'Rechazado',
        20 => 'Anulado',
        25 => 'Eliminado'
    ],

    'cases-to-calls-status-label' => [
        1  => 'info',
        5  => 'warning',
        10 => 'success',
        15 => 'danger'
    ],

    'cases_to_calls_type' => [
        // 1  => 'Cumple Años',
        3  => 'Devolución de llamadas',
        5  => 'Turno no asistido',
        7  => 'Cliente saldo a favor',
        // 10 => 'No usa el servicio',
        13 => 'Sin Presupuesto',
        15 => 'Presupuesto no comenzado',
        17 => 'Presupuesto no terminado',
        // 20 => 'Tercerizado',
        // 25 => 'Mantenimiento de Frenillo',
        // 30 => 'No se coloco Frenillo',
        // 35 => 'Tiene Deudas',
        40 => 'Primera Consulta/No vino mas',
        45 => 'Encuesta de Calidad',
        50 => 'Otros',
    ],
    'cases-to-calls-type-label' => [
        1 => 'primary',
        3 => 'warning',
        5 => 'primary',
        7 => 'primary',
        10 => 'warning',
        13 => 'warning',
        14 => 'warning',
        15 => 'warning',
        17 => 'warning',
        20 => 'warning',
        25 => 'warning',
        30 => 'warning',
        35 => 'warning',
        40 => 'warning',
        45 => 'success'
    ],
    'room-reservations-status' => [
        1 => 'Confirmado',
        5 => 'Cancelado'
    ],
    'room-reservations-label' => [
        1 => 'success',
        5 => 'danger'
    ],

    'query-status' => [
        1 => 'En espera',
        5 => 'En consultorio / Clínico',
        10 => 'Atendido / Clínico',
        15 => 'En consultorio / Laboratorio',
        20 => 'Atendido / Laboratorio',
        25 => 'En consultorio / Radiografia',
        30 => 'Atendido / Radiografia'
    ],

    'query-status-label' => [
        1 => 'primary',
        5 => 'info',
        10 => 'primary',
        15 => 'info',
        20 => 'primary',
        25 => 'info',
        30 => 'primary',
    ],

    'query-status-field' => [
        5 => 'status_consulting_clinical_date',
        10 => 'status_clinical_attended_date',
        15 => 'status_consulting_laboratory_date',
        20 => 'status_laboratory_attended_date',
        25 => 'status_consulting_rx_date',
        30 => 'status_rx_attended_date',
    ],

    'provider-type' => [
        1 => 'Grupo Epem',
        2 => 'Odontología',
        3 => 'Medicina Prepaga',
        4 => 'Medicina Estética',
        5 => 'Medicina Laboral'
    ],

    'type-group-accounting' => [
        1 => 'NR',
        2 => 'Costos',
        3 => 'ZBB',
        4 => 'Otros',
        5 => 'Amortizaciones',
        6 => 'Intereses',
        7 => 'Imp Renta',
        8 => 'Ingresos Varios'
    ],

    'occ-med-client-advance-status' => [
        1 => 'Deshabilitado',
        2 => 'Habilitado',
    ],

    'contracts-monitoring-status' => [
        1 => 'Pendiente',
        5 => 'Recibido',
        10 => 'Cancelado',
    ],

    'contracts_monitorings_status_label' => [
        1 => 'primary',
        5 => 'success',
        10 => 'danger',
    ],

    'type-sample' => [
        1 => 'Sangre',
        5 => 'Orina',
        10 => 'Heces',
        15 => 'Radiografia',
        20 => 'Clínico',
    ],

    'cases-to-calls_resolutions' => [
        1 => 'Reagendado',
        2 => 'No quiere mas el Seguro',
        3 => 'Agendado',
        4 => 'Ya cuenta con financiacion',
        5 => 'Covid',
        6 => 'Contrato culminado'
    ],

    'client-type' => [
        1 => 'Física',
        2 => 'Jurídica'
    ],

    'outgoing-incoming-call' => [
        1 => 'Saliente',
        2 => 'Entrante',
    ],

    'banks-contract-debit-status' => [
        1 => 'Pendiente',
        2 => 'Procesado',
    ],

    'banks-contract-debit-detail-status' => [
        1 => 'Pendiente',
        2 => 'Cobrado',
        3 => 'No Cobrado',
        4 => 'Transaccion no aprobada',
    ],

    'sales-opportunity-actions' => [
        8 => 'Seguimiento por correo',
        1 => 'Contacto Telefonico',
        2 => 'Contacto Whatsapp',
        3 => 'Presentación enviada',
        4 => 'Propuesta enviada',
        5 => 'Reunion realizada',
        6 => 'No contacto',
        7 => 'Volver a llamar',
        9 => 'Visita Positiva',
        10 => 'Visita Negativa',
        11 => 'Visita Realizada',
        12 => 'Contacto Positivo',
        13 => 'Contacto Negativo',
        14 => 'Aceptado'
    ],

    'exits_purchases_motive' => [
        1 => 'Consumo',
        5 => 'Cotizacion empresa'
    ],

    'sms_tokens_status' => [
        1 => 'Pendiente',
        5 => 'Encuestado'
    ],

    'sms_tokens_status_label' => [
        1 => 'primary',
        5 => 'success'
    ],

    'online-call' => [
        1 => 'Activo',
        2 => 'Inactivo'
    ],

    'complaints-reversion-status' => [
        1 => 'Pendiente',
        5 => 'En proceso / administración',
        10 => 'Revertido',
        20 => 'Rechazado'
    ],

    'banks-contract-debit-detail-status-label' => [
        1 => 'primary',
        2 => 'success',
        3 => 'danger',
    ],

    'type_bank_concepts' => [
        1 => 'Recepción',
        2 => 'Envio',
    ],

    'type-service-invoice' => [
        1 => 'CUOTA',
        2 => 'PRIMERA CUOTA',
        3 => 'INSCRIPCION',
        4 => 'TRATAMIENTO',
        5 => 'COBERTURA',
        6 => 'CANCELACION',
        7 => 'SERVICIOS ESTETICA',
        8 => 'SERVICIOS DE EMERGENCIA',
        9 => 'SERVICIOS DE MEDICINA LABORAL'
    ],


    'occ-med-client-debt-status' => [
        1 => 'Deshabilitado',
        2 => 'Habilitado'
    ],

    'occ-med-memorandums-status' => [
        1 => 'Enviado a Cobranzas',
        2 => 'Recibido',
        3 => 'Eliminado'
    ],

    'occ-med-memorandums-status-label' => [
        1 => 'primary',
        2 => 'success',
        3 => 'danger'
    ],

    'occ-med-patient-status' => [
        1 => 'Normal',
        2 => 'Tratarse',
    ],

    'sales-opportunity-rejection-motive-type' => [
        1 => 'CRM CALL',
        2 => 'CRM CORPORATIVO',
        3 => 'CRM DENPRO'
    ],

    'odontology-service' => [
        1 => 'Servicios de Odontología',
        0 => 'Servicios de Medicina Prepaga'
    ],

    'employee-gratification-status' => [
        1 => 'Confirmado',
        2 => 'Pendiente',
        3 => 'Borrado'
    ],

    'employee-gratification-status-label' => [
        1 => 'primary',
        2 => 'warning',
        3 => 'danger'
    ],

    'time-range-value' => [
        'diurno' => '06:00:00',
        'nocturno' => '20:00:00'
    ],

    'orthodontics_status' => [
        1 => 'En proceso',
        5 => 'Terminado',
        10 => 'Anulado'
    ],

    'orthodontics_status_label' => [
        1 => 'warning',
        5 => 'success',
        10 => 'danger'
    ],

    'client_sales_process_type' => [
        1 => 'OIMA',
        2 => 'TAPO',
        3 => 'EXTERNA'
    ],

    'has_ips' => [
        1 => 'SI',
        2 => 'NO'
    ],

    'filter_contract' => [
        1 => 'Fecha de Contrato',
        2 => 'Culminación de Contrato',
        3 => 'Contratos a Vencer'
    ],

    'complaint-destiny' => [
        1 => 'SERVICIOS',
        5 => 'AGENDAMIENTO',
        10 => 'VISACION',
        15 => 'COBRANZAS',
        20 => 'MARKETING',
        25 => 'TESORERIA',
        30 => 'FIDELIZACION- OTROS',
        35 => 'GESTION DOCUMENTOS',
        40 => 'INFORMACION COBRANZAS',
    ],

    'type-method-cobranza' => [
        1 => '1RA CUOTA',
        2 => 'ASO',
        3 => 'CAJA ASU',
        4 => 'CAJA CDE',
        5 => 'CAJA ENC',
        6 => 'CAJA ÑBY',
        7 => 'CAJA SLO',
        8 => 'CANJE',
        9 => 'CHEQUE',
        10 => 'CONSULTORIO',
        11 => 'DEBITO',
        12 => 'EFECTIVO',
        13 => 'FUNCIONARIOS',
        14 => 'PAGO EXPRESS',
        15 => 'PRONET',
        16 => 'RETENCIONES',
        17 => 'TRANSFERENCIA',
        18 => 'REFINANCIACION',
        19 => 'CAJA BRA',
        20 => 'CAJA MRA',
        21 => 'CAJA LUQUE'
    ],

    'category-type-method-cobranza' => [
        1 => 'EFECTIVO',
        2 => 'DEBITO',
        3 => 'CHEQUE'
    ],

    'group-type-method-cobranza' => [
        1 => [1, 3, 4, 5, 6, 7, 10, 12, 14, 15, 16, 17, 18, 19, 20],
        2 => [2, 8, 11, 13],
        3 => [9]
    ],

    'client-type-document' => [
        1 => 'Cedula',
        2 => 'Pasaporte',
        3 => 'Sin documento',
        4 => 'Recien Nacido',
        5 => 'Cedula Extranjera'
    ],

    'infobip_status' => [
        1  => 'Enviado',
        3  => 'Agendado Mediante Chatbot',
        5  => 'Contestado',
        10 => 'No enviado'
    ],

    'employee-contract-type' => [
        1 => 'Emerg. Cootrafe',
        2 => 'Emerg. Tape Pora',
        3 => 'Emerg. Contingencia',
        4 => 'Prestador Servicio',
        5 => 'Cervepar Temp.',
        6 => 'Emergencia Operativa',
        7 => 'Emergencias IPS',
        8 => 'Funcionario IPS',
        9 => 'Prestador Cootrafe',
        10 => 'Odontologo',
        11 => 'Comisionistas',
    ],

    'employee-contract-document-type' => [
        1 => 'IPS TIEMPO INDEFINIDO',
        2 => 'IPS TIEMPO DEFINIDO',
        3 => 'PRESTADOR DE SERVICIOS',
        4 => 'ODONTOLOGO',
        5 => 'TEAMLEADER',
        6 => 'SUPERVISOR',
        7 => 'COMISIONISTA',
        8 => 'CORRETAJE'
    ],

    'distribution-type' => [
        1  => 'LEADS',
        2  => 'MOVIMIENTO'
    ],

    'education-level' => [
        1  => 'PRIMARIA',
        2  => 'SECUNDARIA',
        3  => 'UNIVERSITARIA',
        4  => 'TECNICO',
        5  => 'PRE-GRADO',
        6  => 'POS-GRADO',
        7  => 'DOCTORADO'
    ],

    'update-file-status' => [
        1  => 'Pendiente de actualizacion',
        2  => 'Postergado de actualizacion',
        3  => 'Actualizado'
    ],

    'update-file-status-label' => [
        1  => 'primary',
        2  => 'warning',
        3  => 'success'
    ],

    'education-status' => [
        1  => 'Cursando',
        2  => 'Terminado',
        3  => 'En proceso de tesis'
    ],

    'esth-protocol-order' => [
        1  => 'Respetar Orden',
        2  => 'No respetar orden'
    ],

    'viatic-type' => [
        1  => 'Vendedor',
        7  => 'Cerrador',
        8  => 'Cobrador',
        10 => 'Atencion al cliente'
    ],
    'type-team' => [
        1  => 'CALL',
        2  => 'EXTERNO'
    ],

    'trial-period' => [
        30  => '30',
        60  => '60',
        90  => '90'
    ],

    'collection-forms-status' => [
        1  => 'Pendiente',
        2  => 'Procesado',
        3  => 'Borrado'
    ],

    'collection-forms-status-label' => [
        1  => 'primary',
        2  => 'info',
        3  => 'danger'
    ],

    'emergency-team-status' => [
        1  => 'Activo',
        //2  => 'En base',
        3  => 'Inactivo'
    ],

    'emergency-team-status-label' => [
        1  => 'primary',
        2  => 'info',
        3  => 'danger'
    ],

    'emergency-services-status' => [
        1  => 'Culminado',
        5  => 'En proceso',
        10 => 'Eliminado',
        15 => 'Rechazado'
    ],

    'report-type-invoice-date' => [
        1  => 'Emisión',
        2  => 'Vencimiento',
    ],

    'contract-check-discounts-status' => [
        1  => 'PENDIENTE',
        3  => 'RECHAZADO',
        4  => 'DESEMBOLSO',
        5  => 'ACTIVO',
        6  => 'CULMINADO',
        7  => 'BORRADO'
    ],

    'contract-check-discounts-status-label' => [
        1  => 'default',
        3  => 'danger',
        4  => 'warning',
        5  => 'primary',
        6  => 'danger',
        7  => 'danger'
    ],

    'bancard-card-status' => [
        1  => 'Pendiente',
        2  => 'Catastrado',
        3  => 'Eliminado',
        4  => 'Cancelado', //para ver los casos de reintento de catastro y bancard responde con el card id anterior y el nuevo pasarlo a este estado
        5  => 'Catastro Remoto Pendiente',
    ],

    'business_name' => [
        1  => 'GRUPO IDEM',
        2  => 'INFOCO S.A.',
        3  => 'COOTRAFE',
        4  => 'TAPÓ',
        5  => 'PURO VENTA E.A.S. UNIPERSONAL'
    ],

    'bancard-cadastre-errors' => [
        'CardAlreadyRegisteredByUserError'  => 'El cliente ya ha registrado la tarjeta',
        'InvalidCiError'                    => 'El ci del usuario no coincide con el ci de la tarjeta',
        'CardRequestAlreadyProcessedError'  => 'La solicitud de tarjeta con el ID de proceso # {@ process_id} ya ha sido procesada',
        'CardInvalidDataError'              => 'Los datos de la tarjeta no son correctos',
        'NewCardRequestNotFoundError'       => 'No se encontró una nueva solicitud de tarjeta para el ID de proceso: # {@ process_id}',
        'CardNotFoundError'                 => 'La tarjeta no existe',
        'CardAliasTokenExpiredError'        => 'El token de alias de la tarjeta ha caducado',
        'CardBlockedError'                  => 'La tarjeta para el cliente está bloqueada',
        'InvalidCardStatus'                 => 'El estado dado es incorrecto',
    ],

    'bancard-payment-status' => [
        00  => 'Transacción Aprobada',
        05  => 'Tarjeta inhabilitada',
        12  => 'Transacción inválida',
        15  => 'Tarjeta inválida',
        51  => 'Fondos insuficientes'
    ],

    'last-card-used-status' => [
        1  => 'No Cobrado',
        2  => 'Cobrado',
    ],

    'commission_payments_status' => [
        1 => 'Nuevo',
        5 => 'Verificado',
        7 => 'Autorizado',
        10 => 'Aprobado',
        15 => 'Rechazado',
        20 => 'Anulado'
    ],

    'commissions_payments_label' => [
        1 => 'default',
        5 => 'primary',
        7 => 'warining',
        10 => 'success',
        15 => 'danger',
        20 => 'danger'
    ],

    'medical-coverage-group' => [
        1 => 'Normal',
        2 => 'Especializada',
        3 => 'Otras Especialidades',
        4 => 'Especialidades trimestrales',
        5 => 'Radiografia',
        6 => 'Ecografia',
        7 => 'Analisis de Laboratorio',
        8 => 'Cirugia menor',
        9 => 'Analisis de Laboratorio Especializados',
        10 => 'Tomografia'
    ],

    'request_change_types' => [
        1 => 'RENOVACIÓN',
        2 => 'CAMBIO DE SEGURO',
        3 => 'ADHERENTES',
        // 4 => 'CONVENIO DE PRESUPUESTO',
        5 => 'CAMBIO DE ASESOR',
        6 => 'CAMBIO DE ESTADO',
    ],

    'request_change_status' => [
        1   => 'Pendiente',
        3   => 'Pendiente a Renovación',
        5   => 'Procesado',
        7   => 'Anulado',
        10  => 'Rechazado',
    ],

    'request_change_label' => [
        1   => 'primary',
        3   => 'warning',
        5   => 'success',
        7   => 'danger',
        10  => 'danger',
    ],

    'scheduling-path' => [
        1 => 'Llamada Saliente',
        2 => 'Llamada Entrante',
        3 => 'Infobip',
        4 => 'Primeras Consultas',
        5 => 'Mensajes Masivos'
    ],

    'type-scheduling' => [
        1 => 'Epem',
        2 => 'Alivio',
        3 => 'Alivio Membresia',
        4 => 'RAU Asistencia',
        5 => 'CLIENTE LINE',
        6 => 'CLIENTE FAMILY'
    ],

    'financing-treatments-modality' => [
        1 => 'Contado 40%Off',
        12 => '12 Cuotas 30%Off',
        18 => '18 Cuotas 25%Off',
        24 => '24 Cuotas 20%Off',
        36 => '36 Cuotas 10%Off',
        48 => '48 Cuotas',
        60 => '60 Cuotas'
    ],

    'financing-treatments-discounts' => [
        1  => 40,
        12 => 30,
        18 => 25,
        24 => 20,
        36 => 10,
        48 => 0,
        60 => 0
    ],

    'financing-laboratory-treatments-modality' => [
        1 => 'Contado',
        6 => '6 Cuotas',
        12 => '12 Cuotas',
    ],

    'reason_for_order' => [
        1 => 'Reemplazo',
        2 => 'Vacancia',
        3 => 'Creación de Nuevo Cargo',
        4 => 'Dotación'
    ],

    'ticket-status' => [
        //TIC
        1 => [
            1 => 'Nuevo',
            3 => 'Recibido',
            5 => 'Pendiente Autorización',
            10 => 'En Desarrollo',
            13 => 'Implementación',
            14 => 'Correccion',
            15 => 'Cerrado',
            20 => 'Eliminado'
        ],
        //MARKETING
        13 => [
            1   => 'Nuevo',
            3   => 'Recibido',
            5   => 'En Desarrollo',
            10  => 'Pendiente Autorización',
            11  => 'En Producción',
            15  => 'Cerrado',
        ],
        //SERVICIOS GENERALES
        16 => [
            1 => 'Nuevo',
            3 => 'Recibido',
            5 => 'Pendiente Autorización',
            10 => 'En Desarrollo',
            13 => 'Implementación',
            15 => 'Cerrado',
            20 => 'Eliminado'
        ],
        //BUSINESS INTELIGENCE
        23 => [
            1 => 'Nuevo',
            3 => 'Recibido',
            5 => 'Pendiente Autorización',
            10 => 'En Desarrollo',
            13 => 'Implementación',
            15 => 'Cerrado',
            20 => 'Eliminado'
        ],
        //PROCESOS
        30 => [
            1   => 'Pendiente',
            3   => 'Relevamiento',
            5   => 'Redacción',
            10  => 'Borrador',
            11  => 'Revisión',
            12  => 'Gestion de Firma',
            13  => 'Implementado',
            15  => 'Vigente',
        ],

    ],

    'ticket-status-label' => [
        1 => 'default',
        3 => 'warning',
        5 => 'info',
        10 => 'primary',
        13 => 'info',
        14 => 'info',
        15 => 'success',
        20 => 'danger'
    ],

    'ticket-orderBy' => [
        1 => 'Prioridad de contacto',
        2 => 'Fecha de Creación',
        3 => 'Fecha de entrega'
    ],

    'ticket-groups' => [
        1 => [
            1 => 'No asignado',
            5 => 'Relevamiento',
            6 => 'Desarrollo',
            8 => 'Out Office Dev',
            10 => 'Consulta y configuraciones',
            15 => 'Infra',
        ],
        13 => [
            1 => 'No asignado',
        ],
        16 => [
            1 => 'No asignado',
            5 => 'Desarrollo',
            6 => 'Desarrollo a Entregar',
            8 => 'Out Office Dev',
            10 => 'Consulta y configuraciones',
            15 => 'Infra',
        ],
        23 => [
            1 => 'No asignado',
            5 => 'Desarrollo',
            6 => 'Desarrollo a Entregar',
            8 => 'Out Office Dev',
            10 => 'Consulta y configuraciones',
            15 => 'Infra',
        ],
        30 => [
            1 => 'No asignado',
        ],
    ],

    'ticket-priority' => [
        1 => 'BAJA',
        3 => 'MODERADA',
        5 => 'URGENTE',
        8 => 'MUY URGENTE',
    ],

    'ticket-type' => [
        1   => [
            1 => 'Creación de usuario',
            2 => 'Correccion de estado de cuenta de asegurado',
            3 => 'Ajustes contables',
            4 => 'Solicitud de permisos para sistema',
            5 => 'Correccion de Presupuesto odontologico y saldos',
            6 => 'Desarrollo',
            7 => 'Error de pagina',
            9 => 'Otros',
            10 => 'Correcciones RRHH'
        ],

        16 => [
            19 => 'Otros'
        ],

        23 => [
            29 => 'Otros'
        ],

        30 => [
            41 => 'Procedimiento',
            42 => 'Políticas',
            43 => 'Protocolos',
            44 => 'Instructivos',
            45 => 'Manual de Funciones',
            46 => 'Planillas/ Regidtros/ Formularios',
            47 => 'Comunicado/ Informes  ',
            49 => 'Otros',
        ],

        13 => [
            59 => 'Digital',
            60 => 'Impreso'
        ],

    ],

    'ticket-complexity-level' => [
        1 => 'BAJA',
        5 => 'MEDIA',
        10 => 'ALTA'
    ],

    'type-adherent-movement' => [
        1 => 'Agregado',
        2 => 'Eliminado'
    ],

    'raffles-coupons-status' => [
        1 => 'Activo',
        5 => 'Anulado',
        10 => 'Sorteado',
    ],

    'faja' => [
        'AAA'   => 'AAA',
        'AA'    => 'AA',
        'AAB'   => 'AAB',
        'A'     => 'A',
        'AB'    => 'AB',
        'B'     => 'B',
        'BX'    => 'BX',
        'X'     => 'X',
        'XX'    => 'XX',
        'XXX'   => 'XXX',
        'NUEVO' => 'NUEVO',
    ],

    'denpro-discounts' => [
        20   => '20',
        15   => '15',
        10   => '10',
        5    => '5'
    ],

    'denpro-phase-jobs' => [
        1 => 'En proceso',
        2 => 'Terminad'
    ],

    'purchase-status' => [
        1 => 'Activo',
        2 => 'Borrado',
        3 => 'Pendiente',
        4 => 'Autorizado por RRHH',
        5 => 'Anulado'
    ],

    'purchase-status-mpp' => [
        1 => 'Enviado a Tesoreria',
        2 => 'Borrado',
        3 => 'Pendiente',
        4 => 'Enviado a contabilidad',
        5 => 'Anulado',
        6 => 'Pagado'
    ],

    'purchase-status-label' => [
        1 => 'success',
        2 => 'danger',
        3 => 'primary',
        4 => 'warning',
        5 => 'danger',
        6 => 'info'
    ],

    'employee-iva-included' => [
        1 => 'SI',
        2 => 'NO'
    ],

    'tyoe-date-reports' => [
        1 => 'Fecha Vcmto',
        2 => 'Fecha Compra',
        3 => 'Fecha Carga'
    ],

    'contract-short-status' => [
        1 => 'CC',
        2 => 'AC',
        3 => 'RC',
        4 => 'RA',
        5 => 'A',
        6 => 'CUL',
        7 => 'CB',
        10 => 'CED'
    ],

    'pending-invoices-status' => [
        1 => 'Pendiente',
        2 => 'Facturado',
        3 => 'Exonerado',
        4 => 'Borrado'
    ],

    'type-commission-movement' => [
        1 => 'Ingreso',
        2 => 'Egreso'
    ],

    'commission-status' => [
        1 => 'Inactivo',
        3 => 'Pendiente',
        5 => 'Procesado',
        10 => 'Anulado',
    ],

    'commission-status-label' => [
        1 => 'warning',
        3 => 'primary',
        5 => 'success',
        10 => 'danger'
    ],

    'bicsa-gender-equivalent' => [
        1 => 2,
        2 => 1
    ],

    'bicsa-civil-status-equivalent' => [
        0 => 6,
        1 => 2,
        2 => 1,
        3 => 5,
        4 => 4,
        5 => 6,
        6 => 3,
        7 => 6
    ],

    'bicsa-civil-status' => [
        1 => 'Casado/a',
        2 => 'Soltero/a',
        3 => 'Concubinato',
        4 => 'Divorciado/a',
        5 => 'Viudo/a',
        6 => 'Sin Datos'
    ],

    'bicsa-civil-status-equivalent' => [
        1 => 2,
        2 => 1,
        3 => 5,
        4 => 4,
        5 => 6
    ],

    'bicsa-type-address-equivalent' => [
        1 => 1,
        2 => 2,
        3 => 5,
        4 => 5,
        5 => 5,
        6 => 4,
        7 => 3
    ],

    'bicsa-type-address' => [
        1 => 'Residencial',
        2 => 'Laboral',
        3 => 'Comercial',
        4 => 'Fiscal',
        5 => 'Sin Información'
    ],

    'epem-bicsa-client-type-document-equivalent' => [
        1 => 1,
        2 => 5,
        6 => 2,
        7 => 3,
        8 => 4
    ],

    'bicsa-client-type-document' => [
        1 => 'Documento Identidad',
        2 => 'CRC Código Persona no Residente',
        3 => 'CRP Código de Persona Residente Permanente',
        4 => 'RUC',
        5 => 'Pasaporte'
    ],

    'bicsa-address-attributes' => [
        1  => 'Direccion_Libre',
        2  => 'IdPais',
        3  => 'Ciudad',
        4  => 'Barrio',
        5  => 'Telefono',
        6  => 'FechaRegistrada',
        7  => 'IdTipoDireccion'
    ],

    'bicsa-jobs-attributes' => [
        1 => 'EsDependiente',
        2 => 'CargoTrabajo',
        3 => 'Salario',
        4 => 'FechaInformado',
        5 => 'ComprobanteIngreso',
        6 => 'LugarDeTrabajo'
    ],

    'purchase-product-inventories-status' => [
        1 => 'Procesado',
        2 => 'Pendiente',
        3 => 'Eliminado'
    ],

    'purchase-product-inventories-status-label' => [
        1 => 'primary',
        2 => 'warning',
        3 => 'danger'
    ],

    'purchase-product-type-prices' => [
        1 => 'Público'
    ],

    'tickets-accounts' => [
        1 => 'sistema@grupoepem.com.py',
        // 2 => 'serviciosgenerales@grupoepem.com.py',
        13 => 'marketing@grupoepem.com.py',
        16 => 'serviciosgenerales@grupoepem.com.py',
        23 => 'bi@grupoepem.com.py',
        30 => 'procesos@mg.grupoepem.com.py',
    ],

    'atc-type-commissions' => [
        1 => 'Clinica',
        2 => 'Por Atc'
    ],

    'pending-schedules-status' => [
        1 => 'Nuevo',
        5 => 'En Proceso',
        10 => 'Terminado',
        15 => 'Anulado'
    ],

    'pending-schedules-status-label' => [
        1 => 'default',
        5 => 'warning',
        10 => 'success',
        15 => 'danger'
    ],

    'pending-schedules-type' => [
        1 => 'Horario de Agendamiento ocupado',
        2 => 'No es cliente',
        3 => 'Turnos de Estética',
        4 => 'Es cliente'
    ],

    'cases-type-date' => [
        1 => 'Fecha de Agendamiento',
        2 => 'Fecha de Atencion',
        3 => 'Fecha de Presupuesto',
        4 => 'Fecha de Volver a llamar'
    ],

    'math-operator' => [
        '==' => '=',
        '>' => '>',
        '>=' => '>='
    ],

    'voucher-box-type' => [
        1 => 'Factura',
        2 => 'Recibo',
    ],

    'payroll-salary-status' => [
        1 => 'Pendiente',
        2 => 'Confirmado',
        3 => 'Procesado',
        4 => 'Eliminado'
    ],

    'payroll-salary-status-label' => [
        1 => 'warning',
        2 => 'success',
        3 => 'primary',
        4 => 'danger'
    ],

    'payroll-salary-type' => [
        /* 1  => 'Emergencia',
        2  => 'Primer anticipo',
        3  => 'Contrapago',
        4  => 'Premio Mensual',
        5  => 'Premio Semanal',
        6  => 'Viático', */
        7  => 'Aguinaldo',
        8  => 'Salario',
        9  => 'Prestadores de Servicios',
        10 => 'Variables',
        11 => 'Anticipos',
        12 => 'Odontologos',
        13 => 'Bonificacion Anual',
        14 => 'Bonificacion Anual - Comisionistas',
    ],

    'ips-code' => [
        0 => '0 -',
        1 => '1 -',
        2 => '2 -'
    ],

    'ips-category' => [
        0 => 'Empleado',
        1 => 'Obrero'
    ],

    'services-authorization-detail-status' => [
        0 => 'NO CARGADO',
        1 => 'CARGADO'
    ],

    'services-authorization-detail-status-label' => [
        0 => 'danger',
        1 => 'success'
    ],

    'emergency-assistances-type' => [
        1 => 'Entrada',
        2 => 'Salida'
    ],

    'ambulance-parts' => [
        1 => 'Antena',
        2 => 'Sirena',
        3 => 'Equipo de comunicación',
        4 => 'Cinturon de seguridad',
        5 => 'Linterna',
        6 => 'Tijera'
    ],

    'check-discounts-files' => [
        1 => 'Cheques',
        2 => 'Contrato',
        3 => 'Proforma',
        4 => 'Liquidación',
        5 => 'Pagare',
        6 => 'Autorización de datos'
    ],

    'check-discounts-client-files' => [
        1 => 'Cédula',
        2 => 'Extracto de cuenta',
        3 => 'Iva',
        4 => 'Constitución',
        5 => 'Documentos Tributarios',
        6 => 'Documentos respaldatorios',
        7 => 'Informconf',
        8 => 'Bicsa',
    ],

    'check-discount-type-client' => [
        1 => 'Solicitante',
        2 => 'Librador'
    ],

    'client-service-expirations' => [
        1 => 'Pendiente',
        2 => 'Procesado'
    ],

    'accounting-bugs-type' => [
        1 => 'Facturas duplicadas',
        2 => 'Comprobantes sin asientos',
        3 => 'Asientos desbalanceados',
        4 => 'Asientos sin detalles',
        5 => 'Asientos con cuentas incorrectas',
    ],

    'schedules-dashboard-type-filter' => [
        1 => 'Mes',
        2 => 'Hora'
    ],

    'orderBy' => [
        1 => 'Menor a mayor',
        2 => 'Mayor a menor',
        3 => 'Fecha/Hora'
    ],

    'corporate-agreements-percentages' => [
        15 => '15%',
        20 => '20%',
        25 => '25%'
    ],

    'type-lender' => [
        1 => 'Medico',
        2 => 'Clinica/Sanatorio',
        3 => 'Laboratorio',
        4 => 'Centro de Imagenes'
    ],

    'lender-medic-type-files' => [
        1 => 'CONTRATO',
        2 => 'C.I',
        3 => 'CV',
        4 => 'TITULO',
        5 => 'REGISTRO',
        6 => 'CERTIFICADOS',
        7 => 'ANEXOS',
    ],

    'lender-clinic-type-files' => [
        1 => 'CONTRATO',
        2 => 'CÉDULA TRIBUTARIA',
        3 => 'REGISTRO S.S',
        4 => 'CONSTITUCION',
        5 => 'C.I REPRESENTANTE',
        6 => 'HABILITACION MSPBS',
        7 => 'ANEXOS',
        8 => 'REGISTRO LAB',
        9 => 'REGISTRO IMAG',
        10 => 'C.I REGENTE',
        11 => 'OTROS',
    ],

    'services-adquireds' => [
        1 => 'Consultas',
        2 => 'Emergencias',
        3 => 'Internaciones',
        4 => 'Laboratorios',
        5 => 'Imagenes'
    ],

    'scheduling-user' => [
        1 => 'Infobip',
        2 => 'Agendamiento',
        3 => 'ATC',
        4 => 'Sistema'
    ],

    'scheduling-user-label' => [
        1 => 'primary',
        2 => 'succes',
        3 => 'info',
        4 => 'success'
    ],

    'request-emergency-services-status' => [
        1 => 'Pendiente',
        5 => 'En proceso',
        7 => 'Anulado',
        10 => 'Terminado'
    ],

    'request-emergency-services-status-label' => [
        1 => 'primary',
        5 => 'warning',
        7 => 'danger',
        10 => 'success'
    ],

    'request-emergency-service-detail-status' => [
        1 => 'Pendiente',
        3 => 'En proceso',
        5 => 'Realizado',
        7 => 'Cancelado'
    ],

    'request-emergency-service-detail-status-label' => [
        1 => 'primary',
        3 => 'warning',
        5 => 'success',
        7 => 'danger'
    ],

    'purchases-payment-status' => [
        1 => 'Activo',
        2 => 'Eliminado',
    ],

    'purchases-payment-status-label' => [
        1 => 'primary',
        2 => 'danger',
    ],

    'accounting-entry-type' => [
        1 => 'Debito',
        2 => 'Credito',
    ],

    'model-accounting-entry-type' => [
        1 => 'Prestamos Externos',
        2 => 'Desembolso Alivio',
        3 => 'Cobro Alivio',
        4 => 'Desembolso Descuento Cheques',
        5 => 'Desembolso Tapo Consumo',
        6 => 'Devengamiento de Intereses',
        7 => 'Suspension de Devengamiento'
    ],

    'accounting-entry-type-field' => [
        1 => [
                1 => 'CAPITAL',
                2 => 'INTERES + IVA',
                3 => 'INTERES SIN IVA',
                4 => 'COMISION POR DESEMBOLSO',
                5 => 'CAPITAL - COMISION DE DESEMBOLSO'
              ],

        2 => [
                6 => 'CARTERA',
                7 => 'CAJA'
             ],
        3 => [
                8 => 'CAJA',
                9 => 'CARTERA'
             ],
        4 => [
                10 => 'INTERESES',
                11 => 'CARTERA',
                12 => 'INTERESE A DEVENGAR',
                13 => 'GASTOS ADMINISTRATIVOS',
                14 => 'IVA DEBITO FISCAL',
                15 => 'RETENCION INFOCO',
                16 => 'CAJA',
                17 => 'BANCO',
                18 => 'RETENCION DE TERCEROS'
              ],
        5 => [
                19 => 'INTERESES',
                20 => 'CARTERA',
                21 => 'INTERESE A DEVENGAR',
                22 => 'GASTOS ADMINISTRATIVOS',
                23 => 'IVA DEBITO FISCAL',
                24 => 'RETENCION INFOCO',
                25 => 'CAJA',
                26 => 'BANCO',
                27 => 'RETENCION DE TERCEROS'
              ],
        6 => [
                28 => 'INTERESES DEVENGADOS',
                29 => 'INGRESOS POR INTERESES'
              ],
        7 => [
                30 => 'INTERESES A DEVENGAR',
                31 => 'SUSPENSION'
              ],
    ],

    'emergency-assistances-type' => [
        1 => 'Entrada',
        2 => 'Salida'
    ],

    'ambulance-parts' => [
        1 => 'Antena',
        2 => 'Sirena',
        3 => 'Equipo de comunicación',
        4 => 'Cinturon de seguridad',
        5 => 'Linterna',
        6 => 'Tijera'
    ],

    'check-status' => [
        1 => 'Pendiente de Deposito',
        3 => 'Depositado',
        5 => 'Acreditado',
        6 => 'Anulado',
        7 => 'Rechazado'
    ],

    'check-status-label' => [
        1 => 'primary',
        3 => 'warning',
        5 => 'success',
        7 => 'danger'
    ],

    'check-bank-deposits' => [
        1 => 'Emitido',
        2 => 'Depositado',
        3 => 'Anulado'
    ],

    'check-reject-motive' => [
        1 => 'Firma no coincide',
        2 => 'Cheque roto',
        3 => 'Monto incorrecto'
    ],

    'poll_calification' => [
        1 => 'Detractores',
        2 => 'Pasivo',
        3 => 'Promotores',
    ],

    'type-dispatchers' => [
        1 => 'Chofer',
        2 => 'Médico',
        3 => 'Paramedico'
    ],

    'reason-cancel' => [
        1 => 'Nota de Crédito',
        2 => 'Turnos',
        3 => 'Cancelacion de Tratamientos',
    ],

    'internal-notifications-status' => [
        1 => 'Pendiente',
        3 => 'En proceso',
        5 => 'Publicado',
        7 => 'Borrado',
    ],

    'internal-notifications-status-label' => [
        1 => 'primary',
        3 => 'warning',
        5 => 'success',
        7 => 'danger',
    ],

    'load-authorizations-type-filter' => [
        1 => 'Número de visación',
        2 => 'Número de consulta',
        3 => 'Cédula del cliente',
        4 => 'Transacción de promed',
        5 => 'Rango de fecha'
    ],
    
    'type-confidential' => [
        1 => 'Divulgación',
        2 => 'Condiciones Contractuales',
    ],

    'weeks-pregnant' => [
        1 => 'Semana - 1',
        2 => 'Semana - 2',
        3 => 'Semana - 3',
        4 => 'Semana - 4',
        5 => 'Semana - 5',
        6 => 'Semana - 6',
        7 => 'Semana - 7',
        8 => 'Semana - 8',
        9 => 'Semana - 9',
        10 => 'Semana - 10',
        11 => 'Semana - 11',
        12 => 'Semana - 12',
        13 => 'Semana - 13',
        14 => 'Semana - 14',
        15 => 'Semana - 15',
        16 => 'Semana - 16',
        17 => 'Semana - 17',
        18 => 'Semana - 18',
        19 => 'Semana - 19',
        20 => 'Semana - 20',
        21 => 'Semana - 21',
        22 => 'Semana - 22',
        23 => 'Semana - 23',
        24 => 'Semana - 24',
        25 => 'Semana - 25',
        26 => 'Semana - 26',
        27 => 'Semana - 27',
        28 => 'Semana - 28',
        29 => 'Semana - 29',
        30 => 'Semana - 30',
        31 => 'Semana - 31',
        32 => 'Semana - 32',
        33 => 'Semana - 33',
        34 => 'Semana - 34',
        35 => 'Semana - 35',
        36 => 'Semana - 36',
        37 => 'Semana - 37',
        38 => 'Semana - 38',
        39 => 'Semana - 39',
        40 => 'Semana - 40'
    ],

    'medicine-files-reports-frequency' => [
        1 => 'Diario',
        2 => 'Semanal',
    ],
    'medicine-files-reports-type' => [
        1 => 'Asistido',
        2 => 'Finalizado',
        40 => 'Semana - 40',
    ],

    'service-level-type' => [
        1 => 'Atendidos',
        2 => 'Atendidos con retrasos',
        3 => 'Atendidos sin retrasos'
    ],

    'esthetic-type-fees' => [
        '1' => 'Con Contrato',
        '2' => 'Sin contrato',
    ],

    'cash-open' => [
        1 => 'Abierto',
        2 => 'Cerrado'
    ],

    'type-times' => [
        1 => 'Dias',
        2 => 'Horas',
        3 => 'Minutos'
    ],

    'extra-hours-type' => [
        1 => 'Extra',
        2 => 'Recuperatorio'
    ],

    'extra-hours-status' => [
        1 => 'Pendiente',
        3 => 'Anulado',
        5 => 'Aprobado',
        7 => 'Rechazado'
    ],

    'extra-hours-status-label' => [
        1 => 'warning',
        3 => 'danger',
        5 => 'success',
        7 => 'danger'
    ],

    'type-assistances' => [
        1 => 'Entrada',
        2 => 'Salida'
    ],

    'schedule-type' => [
        1 => 'Flexible',
        2 => 'Riguroso'
    ],

    'type-accrual' => [
        1 => 'Devengamiento Diario',
        2 => 'Suspenso',
        3 => 'Devengamiento Por Pago',
        4 => 'Suspenso Devengado'
    ],

    'promotion-types' => [
        1 => 'Ventas',
        2 => 'Exoneración de Cuotas',
    ],

    'bancard_contracts-status' => [
        1 => 'Activo',
        2 => 'Rechazado',
        3 => 'Pendiente',
        4 =>  'Inactivo',
    ],

    'process-ticket-reasons' => [
        1 => 'Nuevo Documento',
        2 => 'Modificación o cambio del proceso',
        3 => 'Creación de formularios',
        4 => 'Relevamiento para ajustes del sistema',
        5 => 'Revisión de Documentos legales',
        6 => 'Validación de datos u información',
        7 => 'Implementaciones',
        8 => 'Otros',
    ],

    'emergency-schedule' => [
        1 => 'DIA',
        2 => 'NOCHE'
    ],

    'promotion-types' => [
        1 => 'Ventas',
        2 => 'Exoneración de Cuotas',
    ],
    'employee-receipt-type' => [
        1 => 'Liquidacion de Haberes',
        2 => 'Aguinaldo'
    ],
    'dispatch-order-status' => [
        1 => 'Nuevo',
        2 => 'Recibido',
        3 => 'En Proceso',
        4 => 'Finalizado',
        5 => 'Cancelada',
        6 => 'Eliminada',
    ],

    'esthetic-type-fees' => [
        '1' => 'Con Contrato',
        '2' => 'Sin contrato',
    ],

    'company-budget-purpose-type' => [
        1  => 'Mensual',
        2  => 'Diario'
    ],
    'company-budget-tracking-type' => [
        1 => 'Automatico',
        2 => 'Manual'
    ],

    'purchases-order-status' => [
        1 => 'Emitido',
        2 => 'Eliminado'
    ],

    'purchases-order-status-label' => [
        1 => 'primary',
        2 => 'danger',
        3 => 'warning',
    ],

    'accounting-closing-status' => [
        0 => 'Cerrado',
        1 => 'Abierto'
    ],

    'accounting-closing-status-label' => [
        0 => 'danger',
        1 => 'primary',
    ],

    'tramo-cobranza' => [
        0 => 'TRAMO 0',
        1 => 'TRAMO 1',
        2 => 'TRAMO 2',
        3 => 'TRAMO 3',
        4 => 'TRAMO 4',
        5 => 'TRAMO 5',
        6 => 'TRAMO 6',
        7 => 'TRAMO 7'
    ],

    'type-client' => [
        1 => 'NO ASEGURADO',
        2 => 'ASEGURADO'
    ],

    'dashboard-filters' => [
        1 => 'VIGENTES',
        5 => 'MOROSOS'
    ],

    'type-domains'   => [
        1 => '@grupoepem.com.py',
        2 => '@epem.com.py',
        3 => '@tapo.com.py',
        4 => '@alivio.com.py',
        5 => '@denpro.com.py'
    ],

    'esthetic-package-validity'   => [
        3 => '3 Meses',
        6 => '6 Meses',
        12 => '12 Meses',
    ],

    'esthetic-treatment-type'   => [
        1 => 'CORPORAL',
        2 => 'FACIAL',
        3 => 'DIODO',
        4 => 'IPL',
        5 => 'CRIOLIPOLISIS',
        6 => 'INVASIVO'
    ],

    'specialities' => [
        1 => [
            1 => 'Consulta',
            2 => 'Conducto',
            3 => 'Ortodoncia',
            4 => 'Pròtesis',
            5 => 'Implantes',
            6 => 'Restauración en general'
        ],
        2 => [
            1 => 'Clínico',
            2 => 'Pediatría',
            3 => 'Traumatología',
        ]
    ],

    'examen-type'   => [
        1 => 'Pre Ocupacional',
        2 => 'Ocupacional',
    ],

    'payment-period'   => [
        1 => 'Mensual',
        2 => 'Semanal',
    ],

    'hiring-type'   => [
        1 => 'CONTRATO CON IPS',
        2 => 'PRESTADOR DE SERVICIOS',
        3 => 'TERCERIZACIÓN COOTRAFE',
    ],

    'contributor-type'   => [
        1 => 'GENERAL',
        2 => 'JORNALERO',
        3 => 'TIEMPO PARCIAL',
    ],
    'branches-phone-numbers' => [
        'GRUPO EPEM'        => '(021) 237 1100',
        'MEDICINA ESTETICA' => '(021) 237 1100',
        'ODONTOLOGIA'       => '(021) 237 1100',
        'MEDICINA PREPAGA'  => '(021) 237 1100'
    ],

    'type-printer' => [
        1 => 'GO-LINK',
        2 => 'SIN MARCA'
    ],

    'culminated-motive'   => [
        1 => 'DESVINCULACION',
        2 => 'REESTRUCTURACION',
        3 => 'RENUNCIA',
        4 => 'PERIODO DE PRUEBA',
        5 => 'RENOVACION',
        6 => 'ABANDONO'
    ],

    'type-printer' => [
        1 => 'GO-LINK',
        2 => 'SIN MARCA'
    ],

    'vouchers-type-documents' => [
        11 => 'RUC',
        12 => 'CÉDULA DE IDENTIDAD',
        13 => 'PASAPORTE',
        14 => 'CÉDULA EXTRANJERA',
        15 => 'SIN NOMBRE',
        16 => 'DIPLOMATICO',
        17 => 'IDENTIFICACIÓN TRIBURARIA'
    ],
    'employee-types' => [
        1 => 'ODONTOLOGO',
        2 => 'VENDEDORES'
    ],

    'cash-box-list' => [
        1 => 'Comprobante',
        2 => 'Factura',
    ],

    'model-accounting-entry-type-account' => [
        1 => 'Usar esta cuenta',
        2 => 'Usar cuenta hija'
    ],
    'employee-type-annexed' => [
        1 => 'ODONTOLOGO',
        2 => 'VENDEDORES',
        3 => 'SUPERVISORES',
        4 => 'TEAM LEADERS',
        5 => 'EMERGENCIAS',
    ],
    'exclude' => [
        1 => 'Excluir Clientes Agendados',
    ],

    'is-aso' => [
        1 => 'SI',
        0 => 'NO',
    ],

    'rate_frequency' => [
        1 => 'Mensual',
        2 => 'Bimestral',
        4 => 'Trimestral',
        3 => 'Cuatrimestral',
        6 => 'Semestral',
        12 => 'Anual'
    ],

    'exception-auth'  => [
        1 => 'BELEN JARA',
        2 => 'MARCELA FIEGEHEN',
        3 => 'FLAVIA CORDON',
        4 => 'ARMINDA GUILLEN',
        5 => 'MARTIN ZURBRIGGEN',
    ],
    
    'exception-motive'  => [
        1 => 'Plazo de Contrato',
        2 => 'Exoneración de Inscripción',
        3 => 'Promocion Comercial.',
        4 => 'Falta firma pagare(MPP)',
        5 => 'Cedula Vencida',
    ],

    
    'type-reporte-accrual'  => [
        1 => 'Diario Listado',
        2 => 'Diario devengado',
    ],

    'epem-whatsapp-account'  => [
        1 => '595992809000',
    ],

    'invoice-interest-payment'  => [
        0 => 'SI SE HA FACTURADO INTERES EN EL DESEMBOLSO',
        1 => 'NO SE HA FACTURADO INTERES EN EL DESEMBOLSO'
    ],

    'rrhh-monthly-reports'  => [
        1 => 'Sueldos Y Jornales',
        2 => 'Empleados Y Obreros',
        // 3 => 'Vacaciones'
    ],

    'sworn-fields'  => [
        'congenital_diseases' => 'Enfermedades Congénitas',
        'palpitations_pressure_fever' => 'Palpitaciones dolorosas del pecho, presión alta, fiebre reumática, murmullos en el corazón o las arterias?',
        'asthma_hepatitis_lupus' => 'Asma, Bronquitis, Hepatitis, Lupus, Artrosis, Anemia, Gastritis, Ulcera, Neumonia',
        'hyperthyroidism_obesity_goiter' => 'Hipertiroidismo, Hipotiroidismo, Obesidad Mórbida, Bocio',
        'diabetes_cholesterol_triglycerides' => 'Diabetes, Dislipidemia, cuenta con su colesterol o triglicéridos alto',
        'oncological_history' => 'Antecedentes Oncológicos; en que año',
        'year' => 'Año de Antecedentes Oncológicos',
        'parkinson_dementia_epilepsies' => 'Meningitis, Secuelas de Accidentes ACV, Parkinson, Alzheimer, Demencia Senil, Epilepsias',
        'cataracts_sinusitis_lithiasis' => 'Miomas, Quistes, Adenoides, Cataratas, Sinusitis crónica, Adenoma de próstata, Litiasis Vesicular o Renal',
        'transplanted_organ' => 'Usted posee algún órgano transplantado',
        'pregnant' => 'Esta usted actualmente embarazada, cuanto tiempo',
        'weeks' => 'Semanas de Embarazo',
        'herpes_hiv_hpv' => 'Herpes, Sida/HIV, Infección por HPV',
        'surgical_procedure' => 'Ha sido sometido a algún procedimiento quirúrgico?',
        'observation_surgical' => 'Observación de procedimiento quirúrgico:',
        'year_surgical' => 'Fecha de procedimiento quirúrgico:',
        'receives_medication' => '¿Recibe algún tipo de medicación actualmente?',
        'observation_receives' => 'Observación de medicación actual:',
        'covid_19' => 'COVID-19'
    ],

    'loan-period'  => [
        1 => 'PERIODOS FIJOS',
        2 => 'DIGITAR PERIODOS'
    ],

    'loan-period-options'  => [
        1 => 'Cada Mes',
        2 => '30 Dias',
        3 => '60 Dias',
        4 => '90 Dias'
    ],

    'loan-period-options-value'  => [
        1 => '30.4166',
        2 => '30',
        3 => '60',
        4 => '90'
    ],
    
    'status-internments' => [
        1 => 'Internado', 
        2 => 'Alta',
        3 => 'Eliminado',
    ],

    'internments-status-label' => [
        1 => 'info',  //light blue
        2 => 'warning', //orange
        3 => 'danger', //red
    ],

    'ticket-comment-type' => [
        1 => 'Comentario Publico',
        2 => 'Comentario Privado'
    ],

    'gratification-type'  => [
        1 => 'OCASIONAL',
        2 => 'RECURRENTE'
    ],

    'reports-sendings-status' => [
        1 => 'Activo',
        2 => 'Inactivo'
    ],

    'reports-sendings-status-label' => [
        1 => 'success',
        2 => 'danger'
    ],

    'reports-sendings-type-attachment' => [
        1 => 'Resumen sin adjunto',
        2 => 'Adjuntar excel',
        3 => 'Ambas opciones',
    ],

    'reports-sendings-type' => [
        1 => 'Fichas ML nuevas',
        // 2 => 'Fichas ML finalizadas',
    ],

    'reports-sendings-frecuency' => [
        1 => 'DIARIO',
        2 => 'SEMANAL',
        3 => 'MENSUAL',
        4 => 'CUALQUIER DIA',
        5 => 'CARGA NUEVO PROCESO',
        6 => 'FINALIZAR PROCESO',
    ],

    'contracts-situations-status' => [
        1 => 'Activo',
        2 => 'Eliminado'
    ],

    'ticket-task-status' => [
        1 => 'Pendiente',
        2 => 'Completada'
    ],

    'goals-types'  => [
        1 => 'Vendedores',
        2 => 'Gestores de Cobranza',
    ],

    'goals-categories' => [
        1 => [
            10 => 'Otros'
        ],
        2 => [
            11 => 'Cartera de Cobranzas',
            12 => 'Por Cantidad de Llamadas',
        ]
    ],

    'money-loans-type-calc' => [
        1 => 'Francés',
        2 => 'Plazo Fijo'
    ],
    
    'employee-type-commissions' => [
        1 => 'Tratamiento',
        2 => 'Ortodoncia',
        3 => 'Paciente atendido',
        4 => 'Viático de Cobradores',
        5 => 'Cobranzas',
    ],

    'type_collector_commission' => [
        1 => 'Cobranzas',
        2 => 'Viático',
        3 => 'Porcentaje Feriado'
    ],

    'conditional_operators' => [
        1 => '>',
        2 => '>=',
        3 => '==',
        4 => '<=',
        5 => '<',
        6 => '<>'
    ],

    'services-invoices-payment'  => [
        1 => 'Cuota Seguro',
        2 => 'Primera Cuota Seguro',
    ],
    
    'field-voucher-fullnumber'  => [
        1 => 'voucher_number',
        2 => 'voucher_number_infoco',
        3 => 'voucher_number_tapo',
        4 => 'voucher_number_puro_venta',
        5 => 'voucher_number_gepem'
    ],
    
    'cash-box-close-status' => [
        0 => 'Inactivo',
        1 => 'Cerrado',
        2 => 'Cerrado automatico'
    ],
    
    'calendar-type-accounts' => [
        1 => 'Directorio',
        2 => 'Servicios',
        3 => 'Proveedores'
    ],

    // 'calendar-type-services' => [
    //     1 => [
    //         1 => 'Escuela',
    //         5 => 'Cursos'
    //     ],
    //     2 => [
    //         1 => 'ANDE',
    //         5 => 'ESAAP'
    //     ]
    // ],

    'calendar-type-accounts-label' => [
        1 => 'warning',
        2 => 'danger',
        3 => 'primary'
    ],

    'calendar-type-scheduler' => [
        1 => 'Recurrente',
        5 => 'Ocasional'
    ],

    'calendar-payments-status' => [
        1 => 'Pendiente',
        3 => 'A confirmar',
        5 => 'Pagado',
        7 => 'Reagendado',
        10 => 'Anulado'
    ],

    'quantity-cuota' => [
        12 => '12',
        15 => '15',
        18 => '18',
        24 => '24'
    ],

    'purchases-provider-type' => [
        1 => 'PRESTADOR GRUPOEPEM',
        2 => 'PRESTADOR MPP',
        3 => 'PROVEEDORES',
        99 => 'OTROS'
    ],

    'bank-detail-status' => [
        1 => 'ACTIVO',
        2 => 'ELIMINADO'
    ],
    'period-type'=>[
        1 => 'Periodo Largo',
        2 => 'Periodo Corto'
    ],
    
    'emergency_mobile_categories' => [
        1 => 'Ambulancia',
        2 => 'Usos Varios',
    ],

    'emergency_mobile_green_document' => [
        0 => 'SI',
        1 => 'NO'
    ],

    'permission-groups' => [
        1 => 'Usuarios',
        2 => 'Roles',
        3 => 'Supervisores de Vendedores',
        4 => 'Cerradores De Ventas',
        5 => 'Cobradores',
        6 => 'Vendedores',
        7 => 'Clientes',
        8 => 'Empresas de Clientes',
        9 => 'Medios de Contacto',
        10 => 'Doctores',
        11 => 'Sucursales',
        12 => 'Consultorios Odontológicos',
        13 => 'Departamentos / Ciudades',
        14 => 'Nacionalidades',
        15 => 'Seguros',
        16 => 'Servicios Adicionales',
        17 => 'Formas de Pagos',
        18 => 'Empresas',
        19 => 'Entidades Debitadoras',
        20 => 'Motivos de No Pago',
        21 => 'Motivos de Reclamo',
        22 => 'Contratos',
        23 => 'Catastros',
        24 => 'Control de Calidad',
        25 => 'Autorización de Contratos',
        26 => 'Cobros',
        27 => 'Cartera de Cobranzas',
        28 => 'Reportes',
        29 => 'Tipos de Comisiones',
        30 => 'Reserva de Turnos',
        31 => 'Facturas',
        32 => 'Puntos de Expedición Facturación',
        33 => 'Presupuestos Odontológicos',
        34 => 'Tratamientos de Clientes',
        35 => 'Notas de Crédito',
        36 => 'Servicios a Facturar',
        37 => 'Impresión de Carnets',
        38 => 'Exoneraciones',
        39 => 'Configuración',
        40 => 'Servicios de los Doctores',
        41 => 'Tipos de Servicios de los Doctores',
        42 => 'Convenios de Tratamientos',
        43 => 'Precios de Tratamientos',
        44 => 'Archivos de Contratos',
        45 => 'Comisiones de Vendedores',
        46 => 'Activación Temporal del Servicio',
        47 => 'Timbrados',
        48 => 'Comisiones de Doctores',
        49 => 'Cobro de Facturas',
        50 => 'Bitácora de Contratos',
        51 => 'Oportunidades de Venta',
        52 => 'Tramos de Cobranza',
        53 => 'Gestores de Cobranza',
        54 => 'Promociones de Contratos',
        55 => 'Motivos de Contratos Culminados',
        56 => 'Laboratorios',
        57 => 'Laboratorios de Clientes',
        58 => 'Trabajos de Laboratorio',
        59 => 'Recibos de Trabajos de Laboratorio',
        60 => 'Reclamos',
        61 => 'Odontología',
        62 => 'SMS',
        63 => 'Brackets',
        64 => 'Tratamiento de Ortodoncia',
        65 => 'Fichas de Medicina Laboral',
        66 => 'Productos de Medicina Laboral',
        67 => 'Prestadores de Medicina Laboral',
        68 => 'Te Buscamos',
        69 => 'Doctores de Medicina Laboral',
        70 => 'Servicios de Medicina Laboral',
        71 => 'Bancos',
        72 => 'Cuentas Bancarias',
        73 => 'Recaudación',
        74 => 'Órdenes de Trabajo de Medicina Laboral',
        75 => 'RRHH Departamentos',
        76 => 'RRHH Personas',
        77 => 'RRHH Cargo',
        78 => 'Ciclos de Facturación',
        79 => 'Visaciones de Servicios',
        80 => 'Motivos de Rechazo de Oportunidades de Venta',
        81 => 'Monedas',
        82 => 'Movimientos de Oportunidades de Venta',
        83 => 'Prestamos de dinero',
        84 => 'Emergencia Paramedicos',
        85 => 'Emergencia Chofer',
        86 => 'Emergencia Movil',
        87 => 'Emergencia Tipo Servicio',
        88 => 'Cajas',
        89 => 'Cajas de Usuarios',
        90 => 'Conceptos de Cajas',
        91 => 'Saldo Inicial Caja',
        92 => 'Egresos de Caja',
        93 => 'Cierre de Caja',
        94 => 'Prestadores de Servicios',
        95 => 'Cobertura de Planes Médicas',
        96 => 'Tablero',
        97 => 'Contratos a Debitar (TXT)',
        98 => 'Emergencia Solicitud de Servicio',
        99 => 'Estética - Reserva de Turnos',
        100 => 'Estética - Patologia',
        101 => 'Estética - Protocolos',
        102 => 'Estética - Tratamientos',
        103 => 'Estética - Expediente Clínico',
        104 => 'RRHH Actividad de Empleado',
        105 => 'RRHH Contrato de Empleado',
        106 => 'RRHH Configuración',
        107 => 'Devolución de Llamadas',
        108 => 'RRHH Conceptos',
        109 => 'RRHH Descuentos',
        110 => 'RRHH Pagos a Empleados',
        111 => 'Fidelización Cupones',
        112 => 'RRHH Asistencias',
        113 => 'Imágenes Llamador de Turnos',
        114 => 'Facebook FORMS',
        115 => 'Facebook ADS',
        116 => 'Razones Sociales',
        117 => 'Plan De Cuentas',
        118 => 'Asientos Contables',
        119 => 'Equifax - InformConf',
        120 => 'Barrios',
        121 => 'Compras Proveedores',
        122 => 'Compras Productos',
        123 => 'Compras Categoria de Productos',
        124 => 'Compras',
        125 => 'Compras Pagos',
        126 => 'Archivos de Empleados',
        127 => 'RRHH Gratificaciones',
        128 => 'Orden de Compra',
        129 => 'Estética - Equipos',
        130 => 'Archivos de clientes',
        131 => 'Centro de Costos',
        132 => 'Chequera',
        133 => 'Compras Presentación de Productos',
        134 => 'Compras Departamentos Solicitantes',
        135 => 'Motivos de Pausa Call Center',
        136 => 'Ingresos de Caja',
        137 => 'Categorias de comisiones',
        138 => 'Cambio de Agenda',
        139 => 'Marcador',
        140 => 'Depositos',
        141 => 'Reloj',
        142 => 'Ventas de Estetica',
        143 => 'Movimiento de Caja Chica',
        144 => 'Permisos',
        145 => 'Excepciones de Consulas',
        146 => 'Comisiones de Gestores de Cobranza',
        147 => 'Recepción de Productos de OC',
        148 => 'Casos a llamar',
        149 => 'Reservacion de espacio',
        150 => 'Noticias',
        151 => 'Contacto Web',
        152 => 'Imágenes de pacientes',
        153 => 'Equipos de Ventas',
        154 => 'Medicina Laboral - Pago a Proveedores',
        155 => 'Medicina Laboral - Memorándum de cobro',
        156 => 'Horario de Doctores',
        157 => 'Tipo de Cuenta Contable',
        158 => 'Monitoreo de Contratos',
        159 => 'Prestadores de Servicios MPP',
        160 => 'Notificaciones para clientes',
        161 => 'Beneficios para Clientes',
        162 => 'Laboratorio de Protesis',
        163 => 'Tablero Atenciones Clinicas',
        164 => 'Tablero de Encuestas',
        165 => 'Campañas',
        166 => 'Conceptos Bancarios',
        167 => 'Movimientos Bancarios',
        168 => 'Entrada de Productos (Stock)',
        169 => 'Salida de Productos (Stock)',
        170 => 'Transferencia - Envio',
        171 => 'Transferencia - Recepcion',
        172 => 'Destino Prestamo',
        173 => 'Facturación TAPO',
        175 => 'Comisiones de Supervisores',
        176 => 'Productos de Prestamos',
        177 => 'Cuotera Prestamo',
        178 => 'Motivo Exoneración de Cuotas',
        179 => 'Marca de Productos',
        180 => 'Cotización de Monedas',
        181 => 'Tablet de Encuestas',
        182 => 'Precios de Trabajos Laboratorio DENPRO',
        183 => 'Boxes Estetica',
        184 => 'Escala Comision Cerrador',
        185 => 'Comisiones de cerradores',
        186 => 'Comisiones de Cobradores',
        187 => 'Feriados',
        188 => 'Rubros',
        189 => 'Inventario de Productos',
        190 => 'Descuento de Interes Moratorio y Punitorio',
        191 => 'Equipos de emergencia',
        192 => 'Movimientos de Casos a llamar',
        193 => 'Tablero de Ventas',
        194 => 'Planilla de Cobro ASO TAPO',
        195 => 'Descuento de Cheques',
        196 => 'Desembolso Descuento de Cheques',
        197 => 'Deposito de Cheques (Descuento de Cheques)',
        198 => 'Facturas Prestadores',
        199 => 'Catastro de Tarjetas',
        200 => 'Cancelación Anticipada TAPO',
        201 => 'Turnos del Dia',
        202 => 'Solicitacion de Cambios',
        203 => 'Alivio',
        204 => 'Devolución de Cheques',
        205 => 'Tickets',
        206 => 'Nueva financiación TAPO (Cartera Comprada)',
        207 => 'Devengamiento TAPO',
        208 => 'Visualizacion de Tarjetas',
        209 => 'Autorización de Pagos a Proveedores',
        210 => 'Especialidades',
        211 => 'Campañas de Email',
        212 => 'Procedimientos',
        213 => 'Pendiente de Facturación',
        214 => 'BICSA',
        215 => 'Comisiones de Estética',
        216 => 'Precios Mercaderias',
        217 => 'Puestos de Interés',
        218 => 'Formulario Web Trabaja con Nosotros',
        219 => 'Comisiones',
        220 => 'Comisiones de Atc',
        221 => 'Solicitud de Compra o Reposición de Stock',
        222 => 'Turnos - Pendientes de Confirmación',
        223 => 'Generador Masivo de Orden de Pago',
        224 => 'Medicina Prepaga',
        225 => 'Pagos de Cheques (Descuento de Cheques)',
        226 => 'Planilla de Salarios',
        227 => 'Analisis Descuento de Cheques',
        228 => 'Extracto Descuento de Cheques',
        229 => 'Bancas',
        230 => 'Cierre de Inventario Stock',
        231 => 'Tablero de Agendamiento',
        232 => 'Convenios Corporativos',
        233 => 'Prestadores(Mpp)',
        234 => 'Equipamientos Médicos',
        235 => 'Verificación de Equipamientos',
        236 => 'Motivo de Nota de Créditos',
        237 => 'RRHH - Reclamos y Sugerencias',
        238 => 'Extracto de Paciente',
        239 => 'Solicitudes de Servicios de Emergencias',
        240 => 'Control de Deudas (acreedores)',
        241 => 'Excepciones de Horarios de Doctores',
        242 => 'Reporte de Cuotas al Vencida de Cierre',
        243 => 'Ordenes de Servicio',
        244 => 'Notificaciones Internas',
        245 => 'Extracto de Paciente',
        246 => 'Pendientes de Recibos',
        247 => 'Horas Extras',
        248 => 'Equipos de Casos a LLamar',
        249 => 'Agentes de Casos a Llamar',
        250 => 'Horario de Agentes de Casos a Llamar',
        251 => 'Promoción Ponete al Día',
        252 => 'Cambiar de Sucursal',
        253 => 'Número de Patronal',
        254 => 'Cierres Contables',
        255 => 'Tablero de cobranzas',
        256 => 'Cartera de Agendamiento',
        257 => 'Noticias',
        258 => 'Cartas de Compromiso',
        259 => 'Items de Hojas de Anexos',
        260 => 'Hojas de Anexos',
        261 => 'Tipos de Cliente',
        262 => 'Tasas de Interés',
        263 => 'Combos Estetica',
        264 => 'Gerencia',
        265 => 'Mallas Contables',
        266 => 'Profesiones de Clientes',
        267 => 'Visaciones Diagnosticos',
        268 => 'Reportes de RRHH',
        269 => 'Internaciones',
        270 => 'Habitaciones de Internaciones',
        271 => 'Procedimientos de Internaciones',
        272 => 'Saldos Bancarios',
        273 => 'Configuración de envio de reportes',
        274 => 'Metas',
        275 => 'Calendario de Pagos',
        276 => 'Servicios',
        999 => 'Inutilizados',
    ],
    
];

```
