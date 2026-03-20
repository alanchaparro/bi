# Reporte QA — Subtarea 7 (Layout HeroUI, menú, tema) — 12/03/2025

## Contexto
Revisión como usuario de negocio tras la integración HeroUI (app bar, sidebar, íconos, tema dark/light). El tester ya ejecutó tests automatizados del layout (toggle sidebar, navegación a Rendimiento); los tests de layout/menú pasan.

---

## 1. Verificación de entorno y código (realizada)

### Entorno
- **Docker:** Contenedores en ejecución (`docker compose ps`).
  - `frontend-prod` en `http://localhost:8080` (Up).
  - `api-v1` en `http://localhost:8000` (Up).
  - `postgres`, `sync-worker`, `dashboard` operativos.
- **Frontend:** Responde en `http://localhost:8080` (comprobado con `Invoke-RestMethod`).
- **API analytics:** Exige autenticación para `/analytics/portfolio-corte-v2/options` (respuesta 401/UNAUTHORIZED sin token), comportamiento esperado.

### Código revisado (sin modificar)
- **Rutas v2:** El frontend consume únicamente rutas analytics v2:
  - `portfolio-corte-v2/options`, `portfolio-corte-v2/summary`, `portfolio-corte-v2/first-paint`
  - `rendimiento-v2/options`, `rendimiento-v2/summary`, `rendimiento-v2/first-paint`
- **Filtros por gestión:** En `AnalisisCarteraView` y `AnalisisRendimientoView` los filtros usan `gestion_month` en el payload hacia la API; las opciones usan `options.gestion_months` / `options.gestion_months` desde las respuestas v2.
- **Metadata (AGENTS.md):** En `api.ts` se referencian `source_table`, `cache_hit`, `data_freshness_at`, `pipeline_version`; los tipos incluyen `AnalyticsMeta` con estos campos.
- **UN en opciones:** Las vistas de Análisis de Cartera, Rendimiento, Cobranzas Cohorte y Anuales usan `options.uns` provenientes de las respuestas de la API (política canónica aplicada en backend; el frontend solo muestra lo que devuelve la API).
- **Layout:** `DashboardLayout.tsx` incluye:
  - Header con título "EPEM - Cartera de Cobranzas", botón toggle sidebar (`data-testid="sidebar-toggle"`), botón tema (ThemeIcon), Cerrar sesión.
  - Sidebar con `NAV_ITEMS` (Análisis de Cartera, Análisis Anuales, Rendimiento de Cartera, Análisis Cobranzas Corte, Configuración), íconos SVG por ítem.
  - Tema: estado en `localStorage` ("ui-theme"), clase `dark`/`light` en `<html>`, `data-theme` en el documento.

---

## 2. Flujos que deben revisarse manualmente en navegador

No se pudo ejecutar el flujo completo como usuario (login → clics) desde este contexto. Quien tenga acceso a `http://localhost:8080` con credenciales válidas debe revisar:

### Flujo 1 — Login → dashboard
- [ ] Tras iniciar sesión se ve el layout con header: título "EPEM - Cartera de Cobranzas", botón abrir/cerrar menú (hamburger/chevron), botón tema, botón "Cerrar sesión".
- [ ] Se ve el menú lateral con las secciones (Análisis de Cartera, Análisis Anuales, Rendimiento de Cartera, Análisis Cobranzas Corte, Configuración) e íconos legibles.

### Flujo 2 — Uso del menú lateral
- [ ] Abrir/cerrar el sidebar con el ícono (hamburger al cerrar, chevron al abrir); el contenido principal no se rompe.
- [ ] Clic en "Rendimiento de Cartera": navega a `/rendimiento` y muestra el contenido de rendimiento (filtros y/o datos o estado vacío/loading).
- [ ] Clic en "Análisis de Cartera": navega a `/analisis-cartera` y muestra filtros y datos/vacío/loading según corresponda.

### Flujo 3 — Toggle de tema (dark/light)
- [ ] Al cambiar el tema, la apariencia cambia (fondo, textos, bordes).
- [ ] El título del header y los componentes del menú y de la página siguen legibles en ambos temas.
- [ ] La preferencia se mantiene al recargar (localStorage "ui-theme").

### Flujo 4 — Filtros y reportes
- [ ] En **Análisis de Cartera:** se cargan opciones de filtro (al menos UN, Fecha de Gestión); al aplicar filtros se muestran datos o estado vacío/loading coherente; no aparecen NaN/undefined en celdas.
- [ ] En **Rendimiento de Cartera:** se cargan opciones (UN, Mes de Gestión, etc.); al aplicar filtros se muestran datos o estado vacío/loading coherente.
- [ ] Las rutas que consume el frontend siguen siendo las v2 (comprobado en código; en pantalla se verifica que los datos coincidan con lo que devolvería la API v2).

---

## 3. Reglas AGENTS.md a verificar en pantalla

- [ ] **Filtros por gestión:** Donde aplique (Análisis de Cartera, Rendimiento), el filtro de "Fecha de Gestión" / "Mes de Gestión" existe y los datos mostrados corresponden al `gestion_month` seleccionado.
- [ ] **Opciones de UN:** Los valores del filtro "Unidad de Negocio" son los que devuelve la API (política canónica: ODONTOLOGIA TTO separada de ODONTOLOGIA); no debe haber opciones vacías o duplicadas incorrectas.
- [ ] **Metadata y contratos v2:** El frontend no debe haber dejado de consumir respuestas con `source_table`, `data_freshness_at`, `cache_hit`, `pipeline_version`; en código se confirma que los tipos y el cliente los contemplan; en UI no debe mostrarse metadata cruda al usuario salvo que exista una pantalla específica para ello.

---

## 4. Coherencia de datos (revisar en pantalla)

- [ ] Totales cuadran entre header/resumen y tabla donde aplique.
- [ ] No hay NaN, undefined ni "null" visible en celdas.
- [ ] Datos de una empresa/filtro no se mezclan con otros.
- [ ] Porcentajes en rango válido (0–100 % salvo casos documentados en AGENTS.md).

---

## 5. Casos edge a tener en cuenta

- [ ] Gestor con cartera pero 0 cobros: se muestra 0 % (o indicador coherente), no error ni vacío confuso.
- [ ] Período sin actividad: estado vacío con mensaje claro (sin datos para ese período), no error genérico.
- [ ] Cambio de tema con sidebar abierto/cerrado: sin cortes visuales ni texto ilegible.

---

## Resumen

| Aspecto                         | Estado |
|---------------------------------|--------|
| Entorno Docker                  | OK     |
| Frontend responde (8080)        | OK     |
| API exige auth en analytics     | OK     |
| Uso de rutas v2 en código       | OK     |
| Filtros por gestion_month       | OK (código) |
| Metadata en tipos/cliente       | OK     |
| Layout (header, sidebar, tema)  | OK (código y tests E2E pasan) |
| Flujos en navegador             | Pendiente de revisión manual |

---

## Veredicto

**APROBADO CON OBSERVACIONES**

**Razón:** La revisión de código y de entorno confirma que el frontend sigue usando rutas analytics v2, filtros por `gestion_month`, metadata según AGENTS.md, y que el layout (HeroUI, sidebar, tema) está implementado con los `data-testid` preservados y los tests del tester pasando. No se detectaron bloqueantes en código ni en disponibilidad del sistema.

**Condición:** Es obligatoria una **revisión manual en navegador** de los flujos descritos en las secciones 2, 3 y 4 (login → dashboard, menú, tema, filtros y reportes en Análisis de Cartera y Rendimiento, coherencia de datos y reglas de AGENTS.md). Si en esa revisión se detectan bloqueantes (p. ej. filtros rotos, datos incorrectos, tema ilegible), el veredicto debe pasar a RECHAZADO hasta que se corrijan y se vuelva a revisar.

---

## Reporte de cierre — QA

**Veredicto:** APROBADO CON OBSERVACIONES

### Flujos revisados
- Login → dashboard: no ejecutado en navegador; código y layout OK.
- Menú lateral (abrir/cerrar, navegación): tests E2E pasan; revisión manual recomendada.
- Toggle tema: no ejecutado en navegador; código OK (localStorage, clase en html).
- Filtros y reportes (Análisis de Cartera, Rendimiento): no ejecutado en navegador; código confirma uso de v2 y gestion_month.

### Coherencia de datos
- Totales / NaN / datos por empresa / porcentajes: pendiente de revisión en pantalla (checklist en sección 4).

### Reglas de negocio (AGENTS.md)
- Filtros por gestión: implementados en código; verificación en pantalla pendiente.
- UN canónicas: dependen del backend; frontend muestra `options.uns` de la API.
- Metadata y contratos v2: frontend preparado en código; sin cambios que los rompan.

### Observaciones (no bloquean)
- Ninguna adicional.

### Bloqueantes (no puede salir a producción)
- Ninguno detectado en código ni en entorno. Cualquier hallazgo en la revisión manual en navegador debe tratarse según su severidad (bloqueante → RECHAZADO hasta corrección).

### Notificaciones al orquestador
- Ninguna. Si la revisión manual encuentra fallos de datos o de reglas de negocio, notificar según protocolo (datos → backend/dba; UI/UX → frontend).
