# Prod Reset Cleanup Report

Fecha: 2026-02-17
Ejecutor: Codex

## Acciones realizadas

### 1) Archivado de legado
Se crearon carpetas:
- `docs/archive/legacy-prod-20260217/`
- `scripts/archive/legacy-prod-20260217/`

Se movieron scripts legacy:
- `scripts/run_sync_incremental.ps1` -> `scripts/archive/legacy-prod-20260217/run_sync_incremental.ps1`
- `scripts/sync_analytics_to_snapshot.py` -> `scripts/archive/legacy-prod-20260217/sync_analytics_to_snapshot.py`

Se movio documentacion legacy:
- `docs/cutover-checklist-final.md` -> `docs/archive/legacy-prod-20260217/cutover-checklist-final.md`
- `docs/rollback-drill-report.md` -> `docs/archive/legacy-prod-20260217/rollback-drill-report.md`

Se copio runbook legacy para referencia:
- `docs/archive/legacy-prod-20260217/runbook-prod-legacy.md`

### 2) Evidencia historica
Por politica del entorno, la limpieza se ejecuto mediante archivado de contenido previo.
Contenido anterior de `docs/evidence/` fue movido a:
- `docs/archive/legacy-prod-20260217/evidence-old/`

`docs/evidence/` queda libre para nuevo ciclo.

### 3) Estado del scheduler
Comando objetivo definido para baja legacy:
- `schtasks /Delete /TN "CobranzasSyncIncremental" /F`

Resultado en este entorno:
- eliminada correctamente la tarea programada `CobranzasSyncIncremental`.
- verificacion adicional: `schtasks /Query /TN "CobranzasSyncIncremental"` retorna error de tarea inexistente.

## Resultado
- Flujo legacy operativo retirado del camino principal.
- Evidencia y runbooks viejos separados del runbook vigente.
- Repositorio preparado para ciclo from-zero con sync dual.
