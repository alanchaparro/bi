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
- **Estado:** Listo para verificar
- **Área:** tests/tooling (`tests/test_sync_sql_loader.py`, árbol `sql/*`)
- **Descripción:** el origen en tests quedó corregido para no crear temporales bajo `sql/*`; quedan residuos históricos `sql/common/tmp*` y `sql/v2/tmp*` con ACL bloqueada en Windows.
- **Dev (2026-03-23):** `tests/test_sync_sql_loader.py` dejó de usar `TemporaryDirectory(dir=sql/*)` y ahora usa `mkstemp` en `sql/common` / `sql/v2` con limpieza explícita de archivos. Se añadió `scripts/cleanup_sql_tmp_safe.ps1` con allowlist estricta (`sql/common`, `sql/v2`) y borrado por `LiteralPath` sin comandos masivos; soporta `-RepairAcl` para intentar `takeown/icacls` de forma acotada.
- **Criterio de cierre:** verificar que nuevas corridas no dejen `tmp*` en `sql/*`; ejecutar `cleanup_sql_tmp_safe.ps1 -RepairAcl` en terminal elevada para limpiar residuos históricos.

### AUD-2026-03-23-33 — Regresión de despliegue un clic: `INICIAR` falla en instalación limpia por `APP_ENV=dev` por defecto
- **Severidad:** Alta
- **Prioridad:** P1
- **Estado:** Listo para verificar
- **Área:** launchers/operación (`scripts/start_one_click.ps1`, `iniciar.sh`, `.env.example`)
- **Descripción:** En una máquina limpia, `INICIAR.bat`/`iniciar.sh` crea `.env` desde `.env.example` y acto seguido falla por guardrail (`APP_ENV` debe ser `prod`). Eso introduce un paso manual previo (editar `.env`) y rompe el contrato de despliegue “un clic”.
- **Evidencia:** `start_one_click.ps1` aborta si `APP_ENV != prod`; `iniciar.sh` hace el mismo `fail`; `.env.example` mantiene `APP_ENV=dev`.
- **Dev (2026-03-23):** los launchers canónicos de prod ahora fuerzan `APP_ENV=prod` en `.env` antes del bootstrap (`Set-EnvValue` en PowerShell y `set_env_value` en Bash), y validan post-escritura para fallar solo ante problemas reales de permisos/escritura.
- **Criterio de cierre:** validar en entorno limpio que `INICIAR`/`iniciar.sh` ya no piden edición manual de `.env` y continúan el flujo one-click manteniendo perfil `prod`.

## Backlog abierto
| Orden | Prioridad | ID | Resumen |
|---|---|---|---|
| 1 | P1 | AUD-2026-03-23-33 | **Listo para verificar**: launcher one-click fuerza `APP_ENV=prod` y preserva guardrail. |
| 2 | P2 | AUD-2026-03-25-32 | **Listo para verificar**: mitigación en tests + script de limpieza segura; validar limpieza final en host con permisos suficientes. |

## Historial
| Fecha | Acción |
|---|---|
| 2026-03-23 | Recuperación post-incidente: recreado `bugs.md` canónico y estado recuperado de auditorías previas. |
| 2026-03-23 | Dev: AUD-32 pasa a **Listo para verificar** (tests sin temporales en `sql/*` + script `cleanup_sql_tmp_safe.ps1` con allowlist y borrado seguro por ruta absoluta). |
| 2026-03-23 | Validación adicional: `tests/test_sync_sql_loader.py` (5/5 OK) y `frontend` (`npm run typecheck`, `npm run build`) sin errores; persiste bloqueo ACL en residuos históricos `tmp*` de `sql/*`. |
| 2026-03-23 | Dev: AUD-33 pasa a **Listo para verificar** al forzar `APP_ENV=prod` en launchers one-click (`scripts/start_one_click.ps1`, `iniciar.sh`) con validación posterior de escritura. |
| 2026-03-23 | Auditoría **audit**: añadido **AUD-2026-03-23-33** (**Abierto**, **P1**) por regresión de “un clic” en `INICIAR`/`iniciar.sh` (guardrail `APP_ENV=prod` + `.env.example` en `dev`). |
| 2026-03-23 | Auditoría **audit**: sin hallazgos técnicos nuevos en esta pasada; se mantiene el backlog en **Listo para verificar** para **AUD-32** y **AUD-33**. |
