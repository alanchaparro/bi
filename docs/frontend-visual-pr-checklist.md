# Frontend Visual PR Checklist

## Proposito
Checklist corta para revisar PRs que tocan vistas analytics, shell o componentes visuales compartidos.

Referencia obligatoria:
- [frontend-visual-standard.md](C:/desarrollos/bi-clone-nuevo/docs/frontend-visual-standard.md)

## 1. KPI cards
- [ ] Usa `card kpi-card analysis-card-pad` o una base visual equivalente ya estandarizada.
- [ ] Mantiene borde izquierdo semantico de color.
- [ ] El valor usa tipografia monoespaciada y no queda pegado a bordes.
- [ ] El hover es corto y sobrio; no introduce animaciones llamativas.

## 2. Chart cards
- [ ] Usa `chart-card` o `ChartSection` como base.
- [ ] Comparte superficie, cabecera y hover con el estandar de `Analisis de Cartera`.
- [ ] No introduce otro estilo de contenedor para charts.

## 3. Metadata y estados
- [ ] La metadata analytics usa `AnalyticsMetaBadges`.
- [ ] Los estados vacios usan `EmptyState`.
- [ ] No se crean badges, alerts o estados ad hoc con otra direccion visual.

## 4. Tables
- [ ] Usa `table-wrap` y las variantes analytics existentes.
- [ ] El encabezado es sticky cuando aplica.
- [ ] Hover y contraste de filas siguen el estandar del proyecto.

## 5. Paleta y consistencia
- [ ] No reintroduce azul/celeste como base decorativa dominante.
- [ ] Usa los tokens de [frontend/src/index.css](C:/desarrollos/bi-clone-nuevo/frontend/src/index.css).
- [ ] La vista nueva se percibe como parte del mismo sistema que `cartera`, `rendimiento`, `cohorte` y `anuales`.

## 6. Layout
- [ ] Header del modulo, contexto, filtros, seleccion, KPIs y charts respetan la jerarquia definida.
- [ ] No hay overlays, dropdowns o paneles que se solapen incorrectamente.
- [ ] Sidebar, topbar y contenido no generan cortes, tapas o offsets raros.

## 7. Verificacion minima
- [ ] `npm run typecheck` pasa.
- [ ] `npm run build` pasa o `docker compose build frontend-prod` pasa.
- [ ] Se valida manualmente en `localhost:8080` con `Ctrl + F5`.

## Criterio de aprobacion
- [ ] La PR respeta el estandar visual del proyecto y no introduce una familia nueva de componentes.
