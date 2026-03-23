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
- **Criterio de cierre:**
  1. Fronteras del canónico cumplidas (runtime, rutas, UI, estilos, contratos).
  2. Módulos nuevos sin marcadores legacy en flujo principal.
  3. `bugs_visual.md` sin V-* abiertos por mezcla legacy/nuevo.
  4. Auditoría `verifica` confirma desacople sin drift.

## Backlog abierto
| Orden | Prioridad | ID | Resumen |
|---|---|---|---|
| - | - | - | Sin hallazgos técnicos abiertos al cierre de esta pasada. |

## Historial
| Fecha | Acción |
|---|---|
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
