# Canonico de desacople: Legacy vs Nuevo

## Objetivo
Separar por completo el flujo **legacy** del flujo **nuevo** para evitar dependencia cruzada, regresiones de UX y deuda de mantenimiento.

## Principio rector
- El sistema queda dividido en dos dominios independientes:
  - `nuevo` (Next/App Router + HeroUI + contratos v2)
  - `legacy` (flujo heredado aislado)
- Ningun modulo de `nuevo` debe depender de componentes, ids de navegacion, estilos o helpers de `legacy`.

## Fronteras canonicas (obligatorias)

### 1) Entrada y runtime
- `nuevo` se ejecuta por `frontend/src/app/**` y su shell `DashboardLayout`.
- `legacy` no se monta dentro del runtime principal de `nuevo`.
- Si `legacy` sigue activo, debe exponerse como ruta/entry aislado (por ejemplo `legacy/` o app separada), no embebido en navegacion principal de `nuevo`.

### 2) Navegacion y routing
- Prohibido en `nuevo`:
  - ids/rutas con sufijo `Legacy` (ej: `analisisCarteraRendimientoLegacy`)
  - iconografia/texto legacy (`RL`, `->`, etc) en sidebar nuevo
- El menu de `nuevo` debe usar solo `NAV_ITEMS` canonicos del dashboard actual.

### 3) UI y componentes
- `nuevo` usa exclusivamente:
  - `AnalyticsPageHeader`, `LoadingState`, `ErrorState`, `MultiSelectFilter`, componentes HeroUI.
- Se consideran marcadores de `legacy` en modulos del dashboard:
  - `SectionHeader` como cabecera de paginas analiticas
  - `<input className="input">`, `<select className="input">`
  - `window.confirm(...)` para acciones destructivas
  - `style={{ ... }}` estructural para layout/estados que debe vivir en clases CSS
  - `alert-error` en vistas donde ya existe `ErrorState`

### 4) Backend/contratos
- No mezclar payloads legacy y v2 en el mismo contenedor UI.
- El frontend nuevo consume rutas v2 por defecto (segun `AGENTS.md`).
- Si un endpoint legacy permanece, debe consumirse desde el dominio legacy aislado.

### 5) Estilos
- `nuevo` usa tokens y clases compartidas (`globals.css`/`index.css`) del sistema visual.
- Cualquier excepcion visual en `legacy` debe quedar encapsulada bajo clases namespace legacy (sin contaminar vistas nuevas).

## Checklist de cierre para dev
- [x] No hay referencias `*Legacy*` en navegacion del shell nuevo.
- [x] No hay imports de `SidebarNav`/`App.tsx` legacy en runtime nuevo.
- [x] Modulos nuevos (brokers/cartera/config) sin `SectionHeader`, sin `window.confirm`, sin `input/select` legacy.
- [x] Vistas usan `AnalyticsPageHeader` + estados `LoadingState/ErrorState`.
- [x] Hallazgos V-* en `bugs_visual.md` cerrados y alineados con este canonico.
- [x] Hallazgo tecnico de desacople en `bugs.md` pasa a `Cerrado`.

## Criterio de auditoria
- Si reaparece un marcador legacy en modulos nuevos, se considera **regresion de desacople** y se reabre el hallazgo tecnico.

## Handoff Auditor -> Dev
- Auditor registra el estado en `bugs.md` (tecnico) y `bugs_visual.md` (UX/UI).
- Dev corrige en rama de recovery o feature branch.
- Auditor ejecuta `verifica` y solo cierra cuando las fronteras anteriores se cumplen completas.
# Guia de desacople total de legacy

## Objetivo
Desacoplar y eliminar de forma ordenada el flujo legacy para que solo quede operativo el proyecto nuevo (frontend Next + API v1 con analytics v2), dejando trazabilidad de lo que existia en legacy.

## Alcance y resultado esperado
- Solo se levanta stack nuevo en el flujo canonico (`INICIAR.bat` / `iniciar.sh`).
- Se elimina el runtime legacy (`start_dashboard.py` + `dashboard` service) del camino principal.
- Se retiran variables, endpoints de compatibilidad y pruebas acopladas a legacy.
- Se conserva documentacion historica del legado en `docs/archive/legacy-retired/`.

## Inventario: que tenia el legacy (baseline antes de borrado)

### 1) Runtime legacy
- `start_dashboard.py`: servidor HTTP propio en puerto 5000.
- `dashboard.html`, `dashboard.js`, `dashboard.css`.
- Front estático legacy: carpetas `tabs/`, `ui/`, `core/`, `data/`, y artefactos `served_dashboard.js`, `served_raw.js`.

### 2) Orquestacion y contenedores
- `docker-compose.yml`: servicio `dashboard` con perfiles `dev`, `prod`, `legacy`.
- `Dockerfile`: `CMD ["python", "start_dashboard.py"]`.
- `.env.example`: `DASHBOARD_PORT`, `ANALYTICS_LEGACY_BASE_URL`.

### 3) Compatibilidad legacy en frontend nuevo
- `frontend/src/modules/analisisCarteraLegacy/AnalisisCarteraLegacyView.tsx` (iframe a puerto 5000).
- `frontend/src/shared/env.ts`: `LEGACY_DASHBOARD_URL`.
- `frontend/README.md`: referencia a `NEXT_PUBLIC_LEGACY_DASHBOARD_URL`.

### 4) Compatibilidad legacy en backend/scripts/tests
- `backend/app/core/config.py`: `analytics_legacy_base_url`.
- Endpoints proxy legacy en `start_dashboard.py`: `/api/v1proxy/*`.
- Scripts/CI que compilan o validan `start_dashboard.py`:
  - `.github/workflows/docker-ci.yml`
  - `.github/workflows/release.yml`
  - `Makefile`
  - `scripts/docker-compile.ps1`
  - `scripts/docker-validate.ps1`
  - `scripts/docker-release-finalize.ps1`
- Tests que validan comportamiento legacy:
  - `tests/test_dashboard_static.py`
  - `tests/test_movement_endpoint_static.py`

### 5) Documentacion legacy activa
- `docs/verificacion-legacy-vs-8080.md`
- `docs/technical-architecture-v1.md` (compatibilidad temporal legacy)
- `docs/runbook-local.md` (ejecucion `start_dashboard.py`)
- Archivos de contexto historico bajo `docs/archive/legacy-prod-20260217/`.

---

## Plan de ejecucion (orden recomendado)

## Fase 0 - Preparacion y respaldo documental
1. Crear rama: `chore/remove-legacy-runtime`.
2. Crear carpeta de archivo: `docs/archive/legacy-retired/`.
3. Mover/duplicar a `docs/archive/legacy-retired/`:
   - `docs/verificacion-legacy-vs-8080.md`
   - runbooks legacy y checklists de cutover.
4. Generar un snapshot breve en `docs/archive/legacy-retired/legacy-baseline.md` con:
   - componentes legacy,
   - rutas/endpoints legacy,
   - variables legacy,
   - fecha de retiro y responsable.

## Fase 1 - Corte de runtime legacy
1. `docker-compose.yml`
   - Eliminar servicio `dashboard`.
   - Eliminar perfil `legacy` y toda dependencia de `dashboard`.
2. `Dockerfile`
   - Cambiar enfoque a backend API/worker (si se mantiene unico Dockerfile) o separar Dockerfiles por servicio.
   - Remover `CMD` apuntando a `start_dashboard.py`.
3. Launchers
   - Confirmar que `INICIAR.bat` / `iniciar.sh` no contemplen legado.
   - Verificar que `DETENER.bat` / `detener.sh` y `REINICIAR.bat` / `reiniciar.sh` sigan funcionando sin `dashboard`.

## Fase 2 - Limpieza de codigo legacy
1. Eliminar archivos legacy:
   - `start_dashboard.py`
   - `dashboard.html`, `dashboard.js`, `dashboard.css`
   - `tabs/`, `ui/`, `core/`, `data/`
   - `served_dashboard.js`, `served_raw.js`
2. Eliminar modulo legacy embebido en frontend:
   - `frontend/src/modules/analisisCarteraLegacy/AnalisisCarteraLegacyView.tsx`
3. Quitar variables/env legacy:
   - `LEGACY_DASHBOARD_URL` en `frontend/src/shared/env.ts`
   - `ANALYTICS_LEGACY_BASE_URL` y `DASHBOARD_PORT` de `.env.example`
   - Ajustar `backend/app/core/config.py` para remover `analytics_legacy_base_url`.

## Fase 3 - Limpieza de CI, scripts y tests
1. Actualizar CI/workflows:
   - quitar compile checks de `start_dashboard.py`.
2. Ajustar scripts locales:
   - remover referencias legacy en `Makefile` y scripts `docker-*.ps1`.
3. Tests:
   - retirar tests que validan `/api/v1proxy/*` o `start_dashboard.py`.
   - reemplazar por smoke tests del stack nuevo (api + frontend nuevo).

## Fase 4 - Actualizacion documental final
1. Actualizar docs principales para estado post-legacy:
   - `docs/runbook-local.md`
   - `docs/technical-architecture-v1.md`
   - `docs/api-contracts-v1.md` (si hay menciones de compatibilidad temporal ya retirada)
2. Crear `docs/legacy-removal-report.md` con:
   - fecha/hora de retiro,
   - archivos removidos,
   - variables removidas,
   - impacto esperado,
   - evidencia de pruebas.

---

## Checklist tecnico de verificacion (obligatorio)
- [ ] `docker compose --profile prod up -d` levanta sin servicio `dashboard`.
- [ ] No existen referencias a `start_dashboard.py` en repo.
- [ ] No existen referencias a `v1proxy` ni rutas legacy `/api/*` fuera de contratos vigentes.
- [ ] Frontend nuevo funciona en `http://localhost:8080`.
- [ ] Smoke API OK:
  - `portfolio-corte-v2/options`
  - `portfolio-corte-v2/summary`
  - `rendimiento-v2/options`
  - `rendimiento-v2/summary`
- [ ] Validacion reglas canonicas de negocio (AGENTS.md):
  - `gestion_month = cierre + 1`
  - categoria por tramo (`VIGENTE`/`MOROSO`)
  - rendimiento monto y cantidad.
- [ ] Escaneo de secretos pre-push sin hallazgos.

## Criterios de aceptacion para declarar legacy eliminado
- No hay runtime ni servicio legacy ejecutable desde flujo principal.
- No hay variables de entorno legacy en uso.
- No hay imports/componentes legacy en frontend nuevo.
- No hay jobs CI dependientes del legado.
- Existe reporte final en `docs/legacy-removal-report.md`.
- Documentacion historica del legacy queda archivada bajo `docs/archive/legacy-retired/`.

## Riesgos y mitigacion
- Riesgo: borrar utilidades que aun usa el flujo nuevo.
  - Mitigacion: eliminar por fases + correr smoke API/UI en cada fase.
- Riesgo: ruptura de scripts one-click.
  - Mitigacion: prueba obligatoria de `INICIAR`, `DETENER`, `REINICIAR`.
- Riesgo: desalineacion de reglas de negocio en migracion.
  - Mitigacion: validar KPIs de control y semantica canónica contra AGENTS.md.

## Entregables minimos del dev
- PR de eliminacion legacy con cambios de codigo + CI + docs.
- `docs/legacy-removal-report.md` completo.
- Evidencia de smoke tests y checklist marcado.

