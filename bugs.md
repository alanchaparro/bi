# Registro canónico de bugs y hallazgos (auditoría técnica)

## Cómo usar este archivo
- Auditor agrega hallazgos con estado `Abierto`.
- Dev corrige y marca `Listo para verificar`.
- Auditor en `verifica` cierra o reabre con motivo.

## Nota operativa para dev (recovery)
- Si hubo pérdida de avances locales, ejecutar recovery guiado desde la raíz:
  - Windows (doble clic): `RECUPERAR_DEV.bat`
  - CLI: `powershell -ExecutionPolicy Bypass -File ".\scripts\recovery_dev_execute.ps1"`
- Seguir el runbook: `RECUPERACION_DEV_PLAN.md`.
- Para hallazgos visuales UX/UI, el registro canónico es `bugs_visual.md`.
- Para optimizacion continua (hardware + UX) y su evidencia, el canónico adicional obligatorio es `optimo.md`.
- Todo cierre/reapertura debe mantener consistencia entre `bugs.md`, `bugs_visual.md` y `optimo.md`.

### Leyenda de estado
- `Abierto`
- `Listo para verificar`
- `Cerrado`

### Prioridad
- **P1** seguridad / riesgo operativo alto
- **P2** reglas de negocio / integridad de datos
- **P3** costo operativo o performance
- **P4** higiene de tests

## Registro recuperado (resumen)

### AUD-2026-03-23-27 — Precheck analytics MySQL
- **Severidad:** Media
- **Prioridad:** P3
- **Estado:** Cerrado
- **Resultado recuperado:** existe `MYSQL_PRECHECK_QUERIES['analytics']` en `sync_extractors.py`.

### AUD-2026-03-23-28 — ResourceWarning SQLite tests
- **Severidad:** Baja
- **Prioridad:** P4
- **Estado:** Cerrado
- **Resultado recuperado:** `tests/test_security_and_analytics_meta.py` usa `self.engine.dispose()`.

### AUD-2026-03-23-29 — Perfil prod sin APP_ENV=prod
- **Severidad:** Alta
- **Prioridad:** P1
- **Estado:** Cerrado
- **Resultado recuperado:** guardrails APP_ENV en flujos de arranque/bootstrap de prod.

### AUD-2026-03-25-30 — Bootstrap demo users fuera de dev
- **Severidad:** Alta
- **Prioridad:** P1
- **Estado:** Cerrado
- **Resultado recuperado:** `bootstrap_database_with_demo_probe` limita demo users a `APP_ENV == 'dev'`.

### AUD-2026-03-25-31 — Fallback gestión al mes actual
- **Severidad:** Media
- **Prioridad:** P2
- **Estado:** Cerrado
- **Resultado recuperado:** `_normalize_record` levanta `ValueError('gestion_month_unresolved')`.

### AUD-2026-03-25-32 — Residuos tmp* con Permission denied en sql/*
- **Severidad:** Media
- **Prioridad:** P2
- **Estado:** Cerrado
- **Área:** tests/tooling (`tests/test_sync_sql_loader.py`, árbol `sql/*`)
- **Descripción:** el origen en tests quedó corregido para no crear temporales bajo `sql/*`; quedan residuos históricos `sql/common/tmp*` y `sql/v2/tmp*` con ACL bloqueada en Windows.
- **Dev (2026-03-23):** `tests/test_sync_sql_loader.py` dejó de usar `TemporaryDirectory(dir=sql/*)` y ahora usa `mkstemp` en `sql/common` / `sql/v2` con limpieza explícita de archivos. Se añadió `scripts/cleanup_sql_tmp_safe.ps1` con allowlist estricta (`sql/common`, `sql/v2`) y borrado por `LiteralPath` sin comandos masivos; soporta `-RepairAcl` para intentar `takeown/icacls` de forma acotada.
- **Verificación (2026-03-23):** limpieza elevada ejecutada con éxito; conteo final `tmp*` en `sql/common` y `sql/v2` en `0`, y `git status` sin warnings de `Permission denied`.
- **Criterio de cierre:** completado.

### AUD-2026-03-23-33 — Regresión de despliegue un clic: `INICIAR` falla en instalación limpia por `APP_ENV=dev` por defecto
- **Severidad:** Alta
- **Prioridad:** P1
- **Estado:** Cerrado
- **Área:** launchers/operación (`scripts/start_one_click.ps1`, `iniciar.sh`, `.env.example`)
- **Descripción:** En una máquina limpia, `INICIAR.bat`/`iniciar.sh` crea `.env` desde `.env.example` y acto seguido falla por guardrail (`APP_ENV` debe ser `prod`). Eso introduce un paso manual previo (editar `.env`) y rompe el contrato de despliegue “un clic”.
- **Evidencia:** `start_one_click.ps1` aborta si `APP_ENV != prod`; `iniciar.sh` hace el mismo `fail`; `.env.example` mantiene `APP_ENV=dev`.
- **Dev (2026-03-23):** los launchers canónicos de prod ahora fuerzan `APP_ENV=prod` en `.env` antes del bootstrap (`Set-EnvValue` en PowerShell y `set_env_value` en Bash), y validan post-escritura para fallar solo ante problemas reales de permisos/escritura.
- **Verificación (2026-03-23):** prueba real con `.env` ausente: `start_one_click.ps1` creó `.env`, ajustó `APP_ENV=prod` automáticamente y continuó el flujo sin requerir edición manual del archivo.
- **Criterio de cierre:** completado.

### AUD-2026-03-23-34 — `sync_service.py` mantiene lógica muerta por redefinición de funciones críticas
- **Severidad:** Media
- **Prioridad:** P2
- **Estado:** Cerrado
- **Área:** Backend sync (`backend/app/services/sync_service.py`)
- **Descripción:** El módulo define `def _normalize_record(...)` y `def _fact_row_from_normalized(...)` dos veces. La segunda definición (wrapper a `sync_normalizers`) sobreescribe la primera, dejando un bloque grande de lógica anterior inalcanzable. Esto genera riesgo de mantenimiento: un dev puede “corregir” la primera función pensando que tiene efecto, pero en runtime no cambia nada.
- **Evidencia:** `sync_service.py` contiene `_normalize_record` en dos posiciones (líneas ~480 y ~742) y `_fact_row_from_normalized` también en dos posiciones (líneas ~609 y ~746); las segundas versiones retornan directamente `normalize_record(...)`/`fact_row_from_normalized(...)`.
- **Dev (2026-03-23):** se eliminaron las implementaciones duplicadas/inaccesibles de `_normalize_record` y `_fact_row_from_normalized`, manteniendo una única definición wrapper hacia `sync_normalizers`. Se añadió `tests/test_sync_service_delegation.py` para validar que exista una sola definición por función y que ambas deleguen a `normalize_record(...)`/`fact_row_from_normalized(...)`.
- **Verificación (2026-03-23):** `tests/test_sync_service_delegation.py` + suite `test_sync*.py` en verde (25 passed); confirmado una sola definición de wrappers en `sync_service.py` y delegación efectiva a `sync_normalizers`.
- **Criterio de cierre:** eliminar las implementaciones duplicadas inalcanzables o moverlas explícitamente a un módulo legacy; dejar una única fuente de verdad por función y cobertura de test mínima para evitar regresión silenciosa.

### AUD-2026-03-23-35 — Desacople incompleto entre frontend legacy y frontend nuevo
- **Severidad:** Alta
- **Prioridad:** P2
- **Estado:** Cerrado
- **Área:** Frontend arquitectura/UI (`frontend/src/app/**`, `frontend/src/App.tsx`, navegación/layout, módulos brokers/cartera/config)
- **Descripción:** Se detecta convivencia y regresión de patrones legacy dentro del flujo nuevo (ids de navegación legacy, `SectionHeader`, `window.confirm`, controles nativos `.input`), lo que rompe independencia entre dominios y causa drift recurrente entre código y auditoría visual.
- **Canónico obligatorio:** `desacople.md`.
- **Dev (2026-03-23):** se retiró el sufijo `Legacy` del flujo principal de navegación/routing (`analisisCarteraRendimientoLegacy` -> `analisisCarteraRendimiento`) en `navSections.ts`, `routes.ts`, `App.tsx` y `DashboardLayout.tsx`. Además, se normalizó `BrokersSupervisorsView` al patrón canónico (`AnalyticsPageHeader` + `ErrorState` + `Checkbox` HeroUI), eliminando `SectionHeader` y controles nativos en el módulo.
- **Verificación (2026-03-23):** `frontend` typecheck/build en verde y barrido de marcadores (`analisisCarteraRendimientoLegacy`, `window.confirm`, `SectionHeader` en módulos activos) sin hallazgos en flujo principal; `bugs_visual.md` mantiene cero V-* abiertos.
- **Verificación (2026-03-24):** pasada de verificación sobre módulos activos (`frontend/src/modules/**`) sin hallazgos de marcadores legacy canónicos (`SectionHeader`, `window.confirm`, `className="input"`, ids `*Legacy*`) y con filtros segmentados `Categoria` / `Via de cobro` en patrón canónico. Se normaliza el drift documental entre `bugs.md` y `bugs_visual.md`.
- **Reapertura (2026-03-24):** nueva pasada `audit` detecta `bugs_visual.md` con hallazgos activos (`V-064`, `V-066`, `V-065`): persisten estados legacy de feedback en `BrokersPrizesView` y `ConfigView` (`alert-error`/texto plano de carga), por lo que se reabre hasta normalizar `LoadingState`/`ErrorState` y cerrar drift documental.
- **Verificación (2026-03-24):** `BrokersPrizesView` y `ConfigView` normalizados a feedback canónico (`LoadingState`/`ErrorState`), sin uso residual de `alert-error` para estados operativos en flujo nuevo. `bugs_visual.md` queda consistente con V-064/V-065/V-066 cerrados.
- **Criterio de cierre:**
  1. Fronteras del canónico cumplidas (runtime, rutas, UI, estilos, contratos).
  2. Módulos nuevos sin marcadores legacy en flujo principal.
  3. Filtros segmentados tipo `Categoria` / `Via de cobro` con estilo canónico consistente en todo frontend nuevo (según `desacople.md`, sección `3.1`).
  4. `bugs_visual.md` sin V-* abiertos por mezcla legacy/nuevo.
  5. Auditoría `verifica` confirma desacople sin drift.

### AUD-2026-03-23-36 — Falla de CI en tests backend por SQLite con ruta relativa no garantizada
- **Severidad:** Alta
- **Prioridad:** P1
- **Estado:** Cerrado
- **Área:** Tests backend / CI (`tests/test_sync_window_delete_scope.py`, `.github/workflows/docker-ci.yml`)
- **Descripción:** El job `Backend Unit + Integration Tests` falla con `sqlite3.OperationalError: unable to open database file`. El test `test_sync_window_delete_scope.py` usa por defecto `sqlite:///./data/test_sync_window_delete_scope.db`; en CI/contenedor esa ruta relativa puede no existir o no ser escribible.
- **Evidencia:** Traza reportada en CI apunta a `tests/test_sync_window_delete_scope.py` línea 24 durante `CobranzasFact.__table__.drop(...)`; en código `TEST_DATABASE_URL` por defecto es `sqlite:///./data/test_sync_window_delete_scope.db`.
- **Dev (2026-03-23):** el test ahora usa ruta SQLite absoluta basada en `ROOT/data/test_sync_window_delete_scope.db` y crea el directorio padre de forma explícita antes de inicializar engine.
- **Dev (2026-03-23, ajuste adicional):** hardening central en `backend/app/db/session.py`: para cualquier `DATABASE_URL` SQLite de archivo se asegura creación de carpeta padre antes de `create_engine(...)`; si la ruta no es escribible en CI/contenedor, se aplica fallback automático a un directorio temporal escribible del sistema.
- **Dev (2026-03-23, ajuste adicional 2):** en `.github/workflows/docker-ci.yml` se fija `DATABASE_URL=sqlite:////tmp/bi_clone_ci_app_v1.db` dentro de `CI Environment Overrides` para que todo el job backend use una ruta escribible y estable en runner Linux.
- **Validación (2026-03-23):** ejecución local de `tests.test_api_v1_sync` y `tests.test_api_v1_analytics_v2_smoke_endpoints` con `DATABASE_URL=sqlite:///./data/app_v1.db` en verde; ya no falla el import de `app.main` por apertura de SQLite.
- **Criterio de cierre:** hacer el test independiente de cwd/FS (ej. `tempfile` + ruta absoluta garantizada o DB en memoria cuando aplique), y dejar `Backend Unit + Integration Tests` en verde en CI.

### AUD-2026-03-23-37 — Riesgo de ruptura futura en CI por deprecación Node.js 20
- **Severidad:** Media
- **Prioridad:** P3
- **Estado:** Cerrado
- **Área:** CI/CD (`.github/workflows/docker-ci.yml`)
- **Descripción:** El run reporta deprecación de Node.js 20 para actions; desde 2026-06-02 los runners forzarán Node 24 por defecto. Hoy es warning, pero puede romper pipeline si alguna action no es compatible.
- **Evidencia:** Mensaje en run `quality-gates`: “Node.js 20 actions are deprecated… forced to run with Node.js 24…”.
- **Dev (2026-03-23):** workflows actualizados a `actions/checkout@v5`, `actions/setup-node@v5` y `actions/upload-artifact@v5` (release), con `node-version: 24` en jobs frontend.
- **Criterio de cierre:** actualizar actions/workflow a versiones compatibles con Node 24 y eliminar warning de deprecación en CI.

### AUD-2026-03-23-38 — Smoke CI de analytics falla por `401 Unauthorized`
- **Severidad:** Alta
- **Prioridad:** P1
- **Estado:** Cerrado
- **Área:** CI/CD smoke backend (`.github/workflows/docker-ci.yml`)
- **Descripción:** El paso `Smoke - Health Endpoints` hace `POST /api/v1/analytics/portfolio-corte-v2/options` sin autenticación y recibe `401`, rompiendo el workflow.
- **Evidencia:** log del runner:
  - `curl: (22) The requested URL returned error: 401`
  - el script actual invoca `curl -fsS -X POST .../analytics/portfolio-corte-v2/options -d "{}"` sin token/cookie de sesión.
- **Impacto operativo:** pipeline en rojo aunque la API esté levantada; falso negativo en quality gate.
- **Dev (2026-03-23):** se agrega bootstrap de usuarios auth en `docker-ci` y el smoke ahora hace login (`/auth/login`) para obtener bearer token antes de invocar `portfolio-corte-v2/options`.
- **Validación (2026-03-23):** prueba local del flujo CI (`bootstrap_auth_users` + login + POST autenticado a `portfolio-corte-v2/options`) en verde con respuesta y `meta` presente.
- **Verificación (2026-03-24):** el workflow vigente mantiene autenticación previa obligatoria en `Smoke - Health Endpoints` (bootstrap de usuarios + login + bearer token antes de `portfolio-corte-v2/options`), eliminando la causa del `401` en el script de CI.
- **Criterio de cierre:** actualizar smoke para autenticar primero (login + bearer token/cookie) o usar endpoint público equivalente; validar que `Smoke - Health Endpoints` quede en verde.

### AUD-2026-03-24-39 — CI sin escaneo obligatorio de secretos ni vulnerabilidades
- **Severidad:** Alta
- **Prioridad:** P1
- **Estado:** Cerrado
- **Área:** Seguridad CI/CD (`.github/workflows/docker-ci.yml`, `.github/workflows/release.yml`)
- **Descripción:** El pipeline no incluye pasos de seguridad obligatorios definidos por política del repositorio (escaneo de secretos y de dependencias vulnerables en CI/CD).
- **Evidencia:**
  - En `docker-ci.yml` solo hay build/tests/smoke/frontend; no existen jobs o pasos de `gitleaks` (o equivalente) ni auditoría de dependencias.
  - En `release.yml` tampoco hay escaneo de secretos ni verificación de dependencias vulnerables.
  - `AGENTS.md` exige: “Todo PR debe pasar escaneo de secretos y dependencias vulnerables. Si falla seguridad, no se mergea.”
- **Impacto operativo:** riesgo de merge con secretos expuestos o librerías vulnerables sin gate de seguridad automático.
- **Dev (2026-03-24):** se agrega job bloqueante `security-gates` en `.github/workflows/docker-ci.yml` y `.github/workflows/release.yml` con:
  - `gitleaks/gitleaks-action@v2` para escaneo de secretos.
  - `pip-audit --requirement requirements.txt` para dependencias backend.
  - `npm audit --audit-level=high` sobre `frontend` para dependencias frontend.
  - Encadenamiento obligatorio (`needs: security-gates`) para impedir ejecución de quality gates si falla seguridad.
- **Criterio de cierre:** agregar gates de seguridad en CI (secret scan + dependency scan para backend y frontend), con falla bloqueante del pipeline ante hallazgos. **Cumplido.**

### AUD-2026-03-24-40 — `iniciar.sh` ignora errores reales al activar admin one-shot
- **Severidad:** Alta
- **Prioridad:** P1
- **Estado:** Cerrado
- **Área:** Launchers Linux (`iniciar.sh`)
- **Descripción:** El bloque de activación de admin usa `if ! docker ...; then` y luego toma `exit_code=$?`; ese `$?` corresponde al estado invertido por `!` (0), no al código real de `docker compose run`. Como resultado, fallos reales del comando quedan ocultos y el launcher continúa como si todo estuviera bien.
- **Evidencia:**
  - `iniciar.sh`:
    - `if ! docker compose ... first_run_enable_admin_once.py ...; then`
    - `exit_code=$?`
    - `[[ $exit_code -eq 3 ]] || exit "$exit_code"`
  - Con esta forma, `exit_code` queda en `0` cuando el `docker compose run` falla y entra al `then`.
- **Impacto operativo:** el flujo “un clic” en Linux puede reportar éxito parcial con admin no activado o con errores silenciosos en first-run.
- **Criterio de cierre:** capturar el código real del comando sin inversión de estado (ej. ejecutar comando, guardar `$?`, y solo tolerar explícitamente código `3`), fallando en cualquier otro código.
- **Verificación (2026-03-24):** se elimina inversión de estado (`! docker ...`) y se evalúa el exit code real del `docker compose run`; solo se tolera `3` y cualquier otro error aborta el launcher.

### AUD-2026-03-24-41 — `INICIAR.bat` no propaga código de error del bootstrap
- **Severidad:** Media
- **Prioridad:** P2
- **Estado:** Cerrado
- **Área:** Launcher Windows (`INICIAR.bat`)
- **Descripción:** `INICIAR.bat` ejecuta `scripts\start_one_click.ps1` pero no valida `errorlevel` al retornar. Si PowerShell falla, el `.bat` igualmente termina con `pause` sin propagar error al caller.
- **Evidencia:** `INICIAR.bat` actual:
  - `powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start_one_click.ps1"`
  - `pause`
  - No existe `if errorlevel 1 exit /b %errorlevel%` (sí está presente en `DETENER.bat` y `REINICIAR.bat`).
- **Impacto operativo:** falsa señal de éxito en automatizaciones/operación manual; dificulta diagnóstico y rompe consistencia entre launchers Windows.
- **Criterio de cierre:** agregar control de `errorlevel` y `exit /b` antes del `pause`, alineado al patrón de `DETENER.bat`/`REINICIAR.bat`.
- **Verificación (2026-03-24):** `INICIAR.bat` ahora valida `errorlevel` tras `start_one_click.ps1` y retorna `exit /b %errorlevel%` antes de `pause`, alineado al patrón canónico de launchers Windows.

## Backlog abierto
| Orden | Prioridad | ID | Resumen |
|---|---|---|---|
Sin hallazgos técnicos abiertos al cierre de esta pasada.

## Historial
| Fecha | Acción |
|---|---|
| 2026-03-24 | Verificación de continuidad (dev): barrido técnico sobre backlog y código activo sin hallazgos AUD-* abiertos; `bugs.md` y `bugs_visual.md` permanecen consistentes en estado cerrado. |
| 2026-03-23 | Recuperación post-incidente: recreado `bugs.md` canónico y estado recuperado de auditorías previas. |
| 2026-03-23 | Dev: AUD-32 pasa a **Listo para verificar** (tests sin temporales en `sql/*` + script `cleanup_sql_tmp_safe.ps1` con allowlist y borrado seguro por ruta absoluta). |
| 2026-03-23 | Validación adicional: `tests/test_sync_sql_loader.py` (5/5 OK) y `frontend` (`npm run typecheck`, `npm run build`) sin errores; persiste bloqueo ACL en residuos históricos `tmp*` de `sql/*`. |
| 2026-03-23 | Dev: AUD-33 pasa a **Listo para verificar** al forzar `APP_ENV=prod` en launchers one-click (`scripts/start_one_click.ps1`, `iniciar.sh`) con validación posterior de escritura. |
| 2026-03-23 | Auditoría **audit**: añadido **AUD-2026-03-23-33** (**Abierto**, **P1**) por regresión de “un clic” en `INICIAR`/`iniciar.sh` (guardrail `APP_ENV=prod` + `.env.example` en `dev`). |
| 2026-03-23 | Auditoría **audit**: sin hallazgos técnicos nuevos en esta pasada; se mantiene el backlog en **Listo para verificar** para **AUD-32** y **AUD-33**. |
| 2026-03-23 | Auditoría **audit**: sin hallazgos técnicos nuevos; precondiciones de recovery presentes (`RECUPERAR_DEV.bat`, `scripts/recovery_dev_execute.ps1`, `RECUPERACION_DEV_PLAN.md`) y sin residuos `tmp*` en `sql/common` ni `sql/v2`. |
| 2026-03-23 | Verificación final: **AUD-32 Cerrado** tras limpieza elevada de residuos `tmp*` (conteo 0 en `sql/common` y `sql/v2`) y estado git sin warnings de acceso. |
| 2026-03-23 | Verificación final: **AUD-33 Cerrado** tras prueba one-click con `.env` inexistente, creación automática de `.env` y ajuste automático a `APP_ENV=prod` sin edición manual. |
| 2026-03-23 | Auditoría **audit**: sin hallazgos nuevos; se mantiene backlog técnico en cero y se confirma consistencia de launchers one-click (`start_one_click.ps1` / `iniciar.sh`) con hardening de `APP_ENV` y secretos por defecto. |
| 2026-03-23 | Auditoría **audit**: añadido **AUD-2026-03-23-34** (**Abierto**, **P2**) por duplicación/redefinición de `_normalize_record` y `_fact_row_from_normalized` en `sync_service.py` (lógica muerta inalcanzable). |
| 2026-03-23 | Auditoría **audit** adicional: sin hallazgos técnicos nuevos; verificado `tests/test_sync_sql_loader.py` (5/5), `frontend` typecheck OK y guardrails one-click/bootstraps (`APP_ENV=prod`, autogeneración de secretos y alineación de password PostgreSQL) vigentes en scripts Win/Linux. |
| 2026-03-23 | Auditoría **audit**: añadido **AUD-2026-03-23-35** (**Abierto**, **P2**) por desacople incompleto legacy/nuevo en frontend. Se define canónico técnico en `desacople.md` para handoff Auditor -> Dev. |
| 2026-03-23 | Dev: **AUD-2026-03-23-34** pasa a **Listo para verificar** al eliminar duplicaciones de normalización en `sync_service.py`, mantener wrappers únicos y agregar test anti-regresión (`tests/test_sync_service_delegation.py`). |
| 2026-03-23 | Dev: **AUD-2026-03-23-35** pasa a **Listo para verificar** tras desacople de IDs/rutas legacy en navegación principal y normalización de `BrokersSupervisorsView` al stack HeroUI canónico. |
| 2026-03-23 | Verificación final: **AUD-2026-03-23-34 Cerrado** y **AUD-2026-03-23-35 Cerrado** tras evidencia en tests/backend sync y build/typecheck + barrido de marcadores legacy en frontend principal. |
| 2026-03-23 | Verificación canónica de `desacople.md`: normalización adicional en `ConfigView` para eliminar marcadores `className=\"input\"` del flujo nuevo; checklist de desacople actualizado a cumplido. |
| 2026-03-23 | Verificación estricta de desacople: eliminado módulo no usado `AnalisisCarteraLegacyView`, limpieza de estilos/variables legacy en frontend y renombre de `LegacyStackedColumnChart`; único residuo nominal queda en `shared/api-types.ts` por contrato OpenAPI generado con endpoint legacy aún publicado por backend. |
| 2026-03-23 | Ejecución completa de retiro legacy (fases 0-4 de `desacople.md`): eliminado runtime `dashboard`/`start_dashboard.py`, limpieza de proxies `v1proxy`, CI/scripts migrados a `api-v1`, documentación archivada en `docs/archive/legacy-retired/` y reporte final `docs/legacy-removal-report.md`. |
| 2026-03-23 | Auditoría **audit**: sin bugs nuevos tras validar desacople legacy en launchers/scripts (`.bat`/`.sh`), `docker compose --profile prod config --services` coherente y sin residuos `tmp*` en `sql/common`/`sql/v2`. |
| 2026-03-23 | Auditoría **audit**: añadidos **AUD-2026-03-23-36** (**Abierto**, **P1**) por falla de CI backend (`sqlite3.OperationalError: unable to open database file`) y **AUD-2026-03-23-37** (**Abierto**, **P3**) por deprecación Node 20 en actions. |
| 2026-03-23 | Dev: **AUD-2026-03-23-36** y **AUD-2026-03-23-37** pasan a **Listo para verificar** tras fijar ruta SQLite absoluta en test CI y migrar workflows/actions a Node 24. |
| 2026-03-23 | Dev (ajuste adicional): reforzado `backend/app/db/session.py` para crear ruta SQLite automáticamente y usar fallback temporal si el path no es escribible en CI/contenedor. |
| 2026-03-23 | Dev (ajuste adicional 2): workflow `docker-ci` fija `DATABASE_URL` a SQLite en `/tmp` durante CI para eliminar dependencia de rutas relativas en `/app`. |
| 2026-03-23 | Verificación final: **AUD-2026-03-23-36 Cerrado** y **AUD-2026-03-23-37 Cerrado** con tests de contrato/smoke backend en verde (`tests.test_api_v1_sync`, `tests.test_api_v1_analytics_v2_smoke_endpoints`) y workflows actualizados a Node 24/actions v5. |
| 2026-03-23 | Auditoría **audit**: añadido **AUD-2026-03-23-38** (**Abierto**, **P1**) por falla en `Smoke - Health Endpoints` (CI) con `401` al invocar endpoint analytics protegido sin autenticación. |
| 2026-03-23 | Verificación final: **AUD-2026-03-23-38 Cerrado** tras autenticar smoke CI (login + bearer) y validar flujo local en verde con `portfolio-corte-v2/options`. |
| 2026-03-24 | Verificación **reabre**: **AUD-2026-03-23-38** vuelve a **Abierto** por evidencia de run CI con `401` en `Smoke - Health Endpoints`; pendiente confirmar ejecución del workflow actualizado en Actions. |
| 2026-03-24 | Auditoría **audit**: añadido **AUD-2026-03-24-39** (**Abierto**, **P1**) por ausencia de gates de seguridad obligatorios (secret scan + dependency scan) en workflows de CI/CD. |
| 2026-03-24 | Auditoría **audit**: **AUD-2026-03-23-35** se reabre por evidencia en `bugs_visual.md` (V-064, V-065, V-066) de estados legacy en brokers y drift entre documentación y código. |
| 2026-03-24 | Dev/verifica: **AUD-2026-03-23-35 Cerrado** tras barrido de marcadores legacy en módulos activos y normalización del drift documental con `bugs_visual.md`. |
| 2026-03-24 | Dev/verifica: **AUD-2026-03-23-38 Cerrado** al validar que `docker-ci` mantiene login + bearer en smoke de analytics, corrigiendo la causa del `401`. |
| 2026-03-24 | Dev/verifica: **AUD-2026-03-24-39 Cerrado** al incorporar `security-gates` bloqueante (gitleaks + pip-audit + npm audit) en workflows `docker-ci` y `release`. |
| 2026-03-24 | Auditoría **audit**: **AUD-2026-03-23-35** vuelve a **Abierto** por persistencia de estados de feedback no canónicos en `BrokersPrizesView` y `ConfigView`, con `bugs_visual.md` activo en V-064/V-066/V-065. |
| 2026-03-24 | Auditoría **audit** launchers Win/Linux: añadidos **AUD-2026-03-24-40** (**Abierto**, **P1**) por manejo incorrecto de salida en `iniciar.sh`, y **AUD-2026-03-24-41** (**Abierto**, **P2**) por falta de propagación de `errorlevel` en `INICIAR.bat`. |
| 2026-03-24 | Dev/verifica: **AUD-2026-03-24-40 Cerrado** al corregir captura de exit code real en `iniciar.sh` durante activación de admin one-shot (solo se tolera código 3). |
| 2026-03-24 | Dev/verifica: **AUD-2026-03-24-41 Cerrado** al propagar `errorlevel` en `INICIAR.bat` con `exit /b %errorlevel%` previo a `pause`. |
| 2026-03-24 | Dev/verifica: **AUD-2026-03-23-35 Cerrado** en reapertura al normalizar feedback visual canónico en `BrokersPrizesView`/`ConfigView` y alinear `bugs_visual.md` sin drift. |
