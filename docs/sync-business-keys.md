# Sync: business keys e índices por dominio

Este documento describe las claves de negocio (business keys) usadas en el sync para upsert y pre-filtro, y su relación con los índices UNIQUE en Postgres.

## Resumen por dominio

| Dominio    | Business key (columnas)                                                                 | Índice UNIQUE en Postgres | Notas |
|-----------|-------------------------------------------------------------------------------------------|----------------------------|--------|
| **sync_records** | domain, contract_id, gestion_month, supervisor, un, via, tramo                          | ux_sync_records_business_key | Registro de staging por fila normalizada. |
| **cartera_fact** | contract_id, close_date                                                                  | (partitioned; unique por partición) | Una fila por contrato por fecha de cierre. |
| **cobranzas_fact** | contract_id, payment_date, payment_amount, payment_via_class                            | ux_cobranzas_fact_business_key | Una fila por pago (contrato + fecha + monto + vía). |
| **analytics_fact** | contract_id, gestion_month, supervisor, un, via, tramo                                  | ux_analytics_fact_business_key | Agregado por contrato/mes/supervisor/un/vía/tramo. |
| **contratos_fact** | contract_id, gestion_month, supervisor, un, via, tramo                                  | ux_contratos_fact_business_key | Idem. |
| **gestores_fact** | contract_id, gestion_month, supervisor, un, via, tramo                                  | ux_gestores_fact_business_key | Idem. |

## Detalle

- **Cartera**: La clave `(contract_id, close_date)` identifica unívocamente un cierre de cartera por contrato. Coincide con la unicidad en origen (contract_closed_dates por contract_id y closed_date). Índice en migraciones 0006 (cartera_fact) y particionado por mes.

- **Cobranzas**: La clave `(contract_id, payment_date, payment_amount, payment_via_class)` identifica un pago. Estable frente a redondeos si payment_amount y payment_via_class no cambian. Definida en 0007 (sustituye la key anterior por gestion_month/supervisor/un/via/tramo).

- **Analytics, Contratos, Gestores**: Clave amplia `(contract_id, gestion_month, supervisor, un, via, tramo)` para alinear con agregaciones y desagregaciones por supervisor/un/vía/tramo. Índices en 0006.

## Uso en el código

- **Upsert**: `_upsert_fact_rows` en `sync_service.py` usa estas columnas como `index_elements` en `ON CONFLICT DO UPDATE`. Solo se hace UPDATE cuando `source_hash != excluded.source_hash`.
- **Pre-filtro Postgres**: `_filter_rows_changed_vs_postgres` consulta la tabla fact por estas keys y `source_hash`, y devuelve solo filas nuevas o con hash distinto para reducir carga en el upsert.
- **sync_records**: `_upsert_sync_records` usa `BUSINESS_KEY_FIELDS` (domain, contract_id, gestion_month, supervisor, un, via, tramo).

## Validación

- Revisar que en MySQL/origen no existan duplicados para la misma business key antes del sync (o que la lógica de dedup en el sync sea la deseada).
- Los UNIQUE en Postgres deben existir para que `ON CONFLICT` funcione correctamente; se crean en migraciones 0005 (sync_records), 0006 (fact tables), 0007 (cobranzas_fact key change).
