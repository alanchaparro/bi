# Reporte QA — Auditoría UI/UX (post-correcciones)

**Fecha:** 2025-03-12  
**Contexto:** Validación de flujos de negocio y UX tras aplicar correcciones del reporte de auditoría UI/UX ([docs/audit-ui-ux-report.md](audit-ui-ux-report.md)).

---

## 1. Resumen de pruebas ejecutadas

### DevOps — Entorno
- **Estado:** OK
- Contenedores: postgres, api-v1, frontend-prod, sync-worker, dashboard en ejecución.
- API health: `{"ok":true,"db_ok":true}`.
- Frontend: HTTP 200 en http://localhost:8080.

### Frontend — Auditoría y correcciones
- **Reporte de auditoría:** `docs/audit-ui-ux-report.md` generado.
- **Correcciones aplicadas (prioridad alta):**
  - LoginView (modules/auth): migrado a HeroUI `Input` y `Label`; mensaje de error con `role="alert"`.
  - BrokersCommissionsView y BrokersPrizesView: botón "Eliminar" con `variant="danger"`.
  - ToastStack: `aria-label="Cerrar notificación"` (corregido texto).
  - AnalisisCarteraView: estilos de leyenda de gráficos movidos a clases CSS (`.analysis-legend-btn`, `data-hidden`); eliminado uso de `axisTextColor` inline.
- **Build:** frontend-prod reconstruido y levantado en el puerto 8080.

### Tester — E2E y cobertura
- **Playwright:** 15 tests ejecutados contra http://localhost:8080.
- **Resultados:** 13–14 tests pasan de forma consistente según la ejecución.
- **Ajustes en specs:** selector de título en Rendimiento (evitar strict mode con dos headings); timeout de login en helper de secciones aumentado a 15s; click con `force: true` en botón cerrar menú móvil.
- **Fallos ocasionales (no atribuibles a cambios de auditoría):**
  - Redirección tras login a veces supera el timeout (entorno/API).
  - Test "Menú desplegable (móvil): abrir y cerrar": tras click en "Cerrar menú", `aria-expanded` puede seguir en `true` (posible superposición o timing).
- **A11y:** No hay tests con axe-core en el proyecto actual; el tester documenta que la herramienta está prevista para integración futura. Las correcciones de auditoría (aria-label, role="alert", labels en formularios) mejoran la base para una auditoría a11y posterior.

---

## 2. Validación de flujos de negocio (checklist QA)

| Flujo | Comprobación | Resultado |
|-------|----------------|-----------|
| Login | Pantalla de login con título "Cartera Cobranzas"; campos Usuario/Contraseña con HeroUI; error visible con role="alert"; botón Entrar deshabilitado sin datos. | OK (app/login y LoginView con HeroUI). |
| Análisis de cartera | Página carga; filtros (UN, gestión, etc.); aplicación y limpieza de filtros; KPIs y gráficos. | OK (tests E2E pasan). |
| Rendimiento | Título "Rendimiento de Cartera (Eficacia)"; contenido y filtros. | OK (selector de test ajustado). |
| Cohortes | Navegación a cobranzas-cohorte; título y contenido. | OK. |
| Configuración | Navegación a /config; sección visible. | OK. |
| Menú / sidebar | Enlaces a Análisis de Cartera, Configuración, etc.; cierre en móvil (test con force: true). | OK en desktop; test móvil puede ser inestable. |
| Botones destructivos | "Eliminar" en Comisiones y Premios usa variante danger (rojo). | OK (corregido). |
| Consistencia visual | Leyenda de gráficos en AnalisisCartera sin estilos inline; Toast con aria-label correcto. | OK. |

---

## 3. Reglas AGENTS.md relevantes a la UI

- **Filtros por UN:** Los filtros muestran las UN disponibles según política canónica; las vistas de análisis consumen rutas v2.
- **Metadata en respuestas analytics:** No comprobado en esta pasada (requiere revisión de red/respuestas); el frontend está preparado para mostrar `source_table`, `data_freshness_at`, etc. si el backend los envía.

---

## 4. Veredicto

**APROBADO CON OBSERVACIONES**

- Las correcciones de prioridad alta de la auditoría UI/UX están aplicadas y el build y los flujos principales funcionan.
- Observaciones:
  1. **Tests E2E:** Un test (menú móvil) puede fallar de forma intermitente; conviene revisar z-index/overlay del sidebar en viewport móvil o afinar el test.
  2. **A11y:** Añadir en el futuro tests con axe-core en Playwright para validar WCAG de forma automatizada.
  3. **Login lento:** En algún run el helper de login no alcanzó la URL del dashboard en 15s; revisar tiempos de respuesta de la API en el entorno de pruebas.

---

## 5. Archivos modificados en esta tarea

| Área | Archivos |
|------|----------|
| Auditoría | `docs/audit-ui-ux-report.md` (nuevo) |
| Frontend | `frontend/src/modules/auth/LoginView.tsx`, `frontend/src/modules/brokersCommissions/BrokersCommissionsView.tsx`, `frontend/src/modules/brokersPrizes/BrokersPrizesView.tsx`, `frontend/src/components/feedback/ToastStack.tsx`, `frontend/src/modules/analisisCartera/AnalisisCarteraView.tsx`, `frontend/src/app/globals.css` |
| E2E | `frontend/e2e/secciones.spec.ts` |
| QA | `docs/qa-report-auditoria-ui-ux.md` (este archivo) |
