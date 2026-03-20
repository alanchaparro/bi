# PLAN — Rebuild completo del frontend con tema HeroUI

## Tarea
Tirar el frontend actual y rehacerlo con **HeroUI** usando un **tema de HeroUI** (botones, menú, sidebar, componentes y tokens del sistema). Conservar todas las secciones y flujos; solo cambia la presentación y el sistema de diseño.

## Inventario de secciones (no puede faltar ninguna)
Ver **docs/frontend-sections-inventory.md**. Resumen:
- **Rutas**: `/`, `/login`, `/analisis-cartera`, `/analisis-anuales`, `/rendimiento`, `/cobranzas-cohorte`, `/config`
- **Grupos de menú**: "Análisis de Cartera" (4 ítems), "Sistema" (Configuración)
- **Layout**: header con título, toggle sidebar, sync/schedule pills, rol, tema, logout; sidebar con nav por grupos; contenido principal

---

## Subtarea 1 — DevOps
- Verificar salud del entorno Docker (postgres, api-v1, frontend-prod, sync-worker).
- Confirmar que los servicios están Up y que los puertos responden.
- Entregar: reporte de estado (OK / NO LISTO).

---

## Subtarea 2 — UI Designer
- Definir la **spec visual completa** del nuevo shell con tema HeroUI:
  - Tema HeroUI (tokens: colores, tipografía, espaciado, bordes) para dark/light.
  - **Navbar/AppBar**: componente HeroUI, altura, botón toggle sidebar, título, pills de sync, rol, botón tema, botón Cerrar sesión.
  - **Sidebar**: componente HeroUI (Sidebar o equivalente), ítems agrupados, iconos, estado activo, overlay y colapso en móvil.
  - **Botones**: variantes (solid, bordered, ghost) y tamaños según contexto (navbar, sidebar, formularios).
  - **Menú**: estructura de navegación (grupos "Análisis de Cartera" y "Sistema"), links con `Link` de Next.js.
  - Página de **Login**: Card, Input, Button HeroUI; estados loading/error.
  - Contenedor principal y espaciado del contenido.
- Incluir estados visuales: loading, vacío, error donde aplique.
- Entregar: spec en documento o comentarios listos para que frontend implemente.

---

## Subtarea 3 — Frontend
- Leer **docs/frontend-sections-inventory.md** y la **spec del UI Designer**.
- Rehacer el frontend con tema HeroUI:
  1. Configurar **HeroUI Provider** y tema (dark/light) en `app/layout.tsx` o `app/providers.tsx`.
  2. Reemplazar **DashboardLayout** por layout basado en componentes HeroUI: Navbar, Sidebar (o navegación equivalente), botones y menú con componentes HeroUI.
  3. Asegurar que **todas las rutas** del inventario existan y rendericen la vista correspondiente (módulos existentes o wrappers).
  4. **Login**: página con Card, Input, Button HeroUI; misma lógica de auth y redirección.
  5. **Rutas** y **NAV_ITEMS** sin cambios (mismas URLs y labels).
  6. Sidebar con grupos e ítems según `NAV_ITEMS`; activo por `pathname`.
  7. Header: título, toggle sidebar, pills de sync/schedule (mantener lógica actual), rol, toggle tema, Cerrar sesión.
- No cambiar: `shared/api`, contratos con backend, rutas de API, lógica de negocio.
- Solo tocar archivos en `frontend/`.
- Entregar: lista de archivos creados/modificados; si se agregaron dependencias en package.json, indicarlo.

---

## Subtarea 4 — UI Designer (revisión)
- Revisar que la implementación del frontend cumpla la spec (tema, Navbar, Sidebar, botones, menú, Login).
- Verificar: colores, tipografía, espaciado, estados visuales.
- Si hay desvíos, indicar exactamente qué corregir.

---

## Subtarea 5 — Tester
- Tests E2E o de componentes que cubran: navegación a cada sección, login, logout, toggle sidebar, toggle tema.
- Verificar que las rutas del inventario responden y que no se perdió ninguna.
- Reportar si hace falta algún `data-testid` en componentes nuevos.

---

## Subtarea 6 — QA
- Revisar flujos de negocio: login, análisis de cartera, rendimiento, cohortes, configuración.
- Verificar que los datos en pantalla siguen coherentes con AGENTS.md (filtros por gestión, UN, etc.).
- Veredicto: APROBADO / APROBADO CON OBSERVACIONES / RECHAZADO.

---

## Contrato compartido
- **Rutas de la app**: no cambiar paths; mismo `ROUTES` y `NAV_ITEMS` en `config/routes.ts`.
- **Auth**: mismo flujo (login → refresh token → access token; redirección a `/analisis-cartera`).
- **API**: mismas llamadas y tipos; frontend solo cambia UI.

---

# Fase 2 — Próximos pasos (avance)

## Tarea: Tests, más tema HeroUI y QA

### Subtarea 1 — DevOps
- Verificar salud del entorno (contenedores Up, puertos 8000/8080, API health).
- Reporte: OK / NO LISTO.

### Subtarea 2 — Frontend (más tema HeroUI)
- Componentes de feedback (EmptyState, LoadingState) y filtros: usar componentes/variantes HeroUI donde aplique (Button, Text, Skeleton, Card).
- Config y vistas de análisis: botones y controles con variantes HeroUI explícitas (primary, outline, ghost).
- Solo archivos en `frontend/`.

### Subtarea 3 — Tester
- Añadir dependencias de test: vitest, @testing-library/react (y tipos si faltan) para que `npm run typecheck` pase.
- Verificar que los tests existentes corran (App.test, AppNav.test, filterOptions, rowUtils).
- Reportar si hace falta `data-testid` en componentes modificados.

### Subtarea 4 — QA
- Checklist de validación: login, navegación por secciones, toggle tema, cerrar sesión, filtros en análisis de cartera y rendimiento.
- Documentar en `docs/qa-checklist-heroui.md` para revisión manual.

**Estado Fase 2:** ✅ Completado (devops OK, frontend HeroUI en LoadingState/EmptyState, tests con vitest pasan, checklist QA creado).

### Cómo seguir (ejecución orquestada)
1. **DevOps**: Rebuild `frontend-prod` (dependencias nuevas), levantar entorno, verificar contenedores + API health + frontend responde. ✅ Contenedores Up.
2. **Tester**: Ejecutar `vitest run` y Playwright E2E contra frontend en 8080. ✅ Vitest 7/7; Playwright 17/17 (retries: 1 para flaky: toggle sidebar, Rendimiento).
3. **QA**: Smoke automatizado vía E2E; checklist manual en `docs/qa-checklist-heroui.md`. ✅ Reporte en `docs/qa-report-heroui-followup.md`.
