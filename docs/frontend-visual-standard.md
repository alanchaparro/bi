# Frontend Visual Standard

## Proposito
Definir el estandar visual operativo del frontend analytics para evitar que nuevas vistas vuelvan a divergir en tarjetas, charts, tablas, estados vacios y metadata.

La referencia actual de calidad visual es:
- `Analisis de Cartera`

Canon adicional obligatorio:
- [spec-canon-patrones-ui-analytics.md](C:/desarrollos/bi-clone-nuevo/docs/spec-canon-patrones-ui-analytics.md)

## Direccion visual
- Paleta base: `charcoal + olive + arena`
- Superficies oscuras, sobrias y con brillo muy sutil
- Un solo acento principal: `var(--color-primary)`
- Colores fuertes reservados para semantica de negocio y KPIs
- Movimiento corto y util: hover leve, elevacion suave, sin animaciones decorativas

## Tokens base
Fuente principal de tokens:
- [frontend/src/index.css](C:/desarrollos/bi-clone-nuevo/frontend/src/index.css)

Tokens visuales clave:
- `--color-primary`
- `--color-primary-hover`
- `--color-accent-secondary`
- `--color-surface`
- `--color-surface-elevated`
- `--card-bg`
- `--table-bg`
- `--table-head-bg`
- `--color-border`
- `--shadow-kpi-*`
- `--border-kpi-*`

## Componentes estandar

### KPI cards
Base obligatoria:
- `card kpi-card analysis-card-pad`

Variantes semanticas:
- `analysis-kpi-primary`
- `analysis-kpi-gold`
- `analysis-kpi-emerald`
- `analysis-kpi-violet`
- `analysis-kpi-cyan`
- `analysis-kpi-amber`

Reglas:
- borde izquierdo semantico de `4px`
- valor en tipografia monoespaciada
- hover con elevacion leve
- header con `chart-card-header` y `chart-drag-handle` cuando aplique

Referencias:
- [frontend/src/modules/analisisCartera/AnalisisCarteraView.tsx](C:/desarrollos/bi-clone-nuevo/frontend/src/modules/analisisCartera/AnalisisCarteraView.tsx)
- [frontend/src/modules/analisisRendimiento/AnalisisRendimientoView.tsx](C:/desarrollos/bi-clone-nuevo/frontend/src/modules/analisisRendimiento/AnalisisRendimientoView.tsx)
- [frontend/src/modules/analisisCobranzasCohorte/AnalisisCobranzasCohorteView.tsx](C:/desarrollos/bi-clone-nuevo/frontend/src/modules/analisisCobranzasCohorte/AnalisisCobranzasCohorteView.tsx)

### Chart cards
Base obligatoria:
- `card chart-card analysis-card-pad`

Si la vista usa el componente compartido:
- [frontend/src/components/analytics/ChartSection.tsx](C:/desarrollos/bi-clone-nuevo/frontend/src/components/analytics/ChartSection.tsx)

Reglas:
- misma superficie que KPI cards
- cabecera con titulo y hint/handle
- hover corto con leve elevacion
- sin fondos azules planos ni degradados agresivos

### Meta badges
Componente canonico:
- [frontend/src/components/analytics/AnalyticsMetaBadges.tsx](C:/desarrollos/bi-clone-nuevo/frontend/src/components/analytics/AnalyticsMetaBadges.tsx)

Clase base:
- `analysis-meta-chip`

Reglas:
- pills neutras
- `cache_hit` y `cache_miss` con variacion semantica
- no usar badges chillones o con saturacion alta

### Empty states
Componente canonico:
- [frontend/src/components/feedback/EmptyState.tsx](C:/desarrollos/bi-clone-nuevo/frontend/src/components/feedback/EmptyState.tsx)

Reglas:
- fondo sobrio
- borde dashed
- mensaje claro
- sugerencia concreta de accion

### Tables
Base obligatoria:
- `table-wrap`

Variantes analytics:
- `analysis-table-wrap`
- `cohorte-table-wrap`

Reglas:
- encabezado sticky
- fondo continuo y sobrio
- hover de fila discreto
- numeros con tipografia monoespaciada

## Layout y jerarquia
- header del modulo primero
- contexto/definiciones despues
- filtros en panel unico
- seleccion actual visible
- KPIs antes que charts
- charts antes que tablas de detalle

## Lo que no se debe hacer
- crear otra familia visual nueva para cards
- usar azules/celestes como base decorativa dominante
- mezclar tabs o badges con otra logica cromatica
- usar botones con padding inconsistente
- dejar tablas sin el `table-wrap` compartido
- crear empty states ad hoc cuando ya existe `EmptyState`

## Regla de implementacion
Cuando se agregue una vista nueva:
1. reutilizar `AnalyticsPageHeader`, `AnalyticsMetaBadges`, `MetricExplainer`, `ChartSection`, `EmptyState`
2. usar `kpi-card` y `chart-card` como base
3. limitar diferencias a datos y semantica, no al lenguaje visual
4. validar que la vista siga la referencia de `Analisis de Cartera`

## Modulos ya alineados
- `analisis-cartera`
- `rendimiento`
- `cobranzas-cohorte`
- `analisis-anuales`
- `analisis-cartera/rolo-cartera`
