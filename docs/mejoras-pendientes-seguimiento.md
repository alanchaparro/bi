# Mejoras Pendientes y Seguimiento

Fecha de inicio: 2026-02-16  
Objetivo: controlar qué mejoras faltan, su estado real y evidencia de cumplimiento.

## Convenciones
- Estado:
  - `PENDIENTE`
  - `EN_PROGRESO`
  - `BLOQUEADO`
  - `CUMPLIDO`
- Evidencia: ruta de archivo, log, commit o enlace interno.
- Criterio de cierre: condición objetiva para marcar `CUMPLIDO`.

## Tablero de seguimiento
| ID | Mejora | Estado | Prioridad | Responsable | Fecha objetivo | Criterio de cierre | Evidencia |
|---|---|---|---|---|---|---|---|
| M-001 | Estabilizar `dashboard` para evitar reinicios intermitentes en corridas largas | BLOQUEADO | Alta | Ops/Backend | 2026-02-20 | 0 reinicios en ventana de 60 min bajo carga de monitoreo/perf | `docs/cutover-checklist-final.md` |
| M-002 | Completar monitoreo de cutover 30-60 min sin interrupciones | EN_PROGRESO | Alta | Ops | 2026-02-20 | `cutover_window_monitor.py` con ventana completa y error_rate/p95 dentro de umbral | `docs/evidence/cutover-window-metrics.jsonl` |
| M-003 | Ejecutar 2 ciclos consecutivos de parity + perf estables | EN_PROGRESO | Alta | Backend/QA | 2026-02-20 | 2 ejecuciones consecutivas en verde sin fallos transitorios de red/contenedor | `docs/evidence/release_finalize_cycle*.log` |
| M-004 | Ejecutar rollback drill real en staging | PENDIENTE | Alta | Ops/QA | 2026-02-21 | Timeline real documentado y tiempo total < 15 min | `docs/rollback-drill-report.md` |
| M-005 | Completar firmas de salida (Backend/Frontend/Ops/QA) | PENDIENTE | Alta | Líderes técnicos | 2026-02-21 | Firmas completas en checklist y rollback report | `docs/cutover-checklist-final.md`, `docs/rollback-drill-report.md` |
| M-006 | Cierre formal de cutover con flag v1 y plan de apagado legacy | PENDIENTE | Alta | Plataforma | 2026-02-21 | Checklist de cutover/post-cutover en `[x]` + criterio de apagado cumplido | `docs/cutover-checklist-final.md` |
| M-007 | Mantener Cobranzas sin filtro de sucursal y con filtro/gráfico por UN (verificación UX) | EN_PROGRESO | Media | Frontend | 2026-02-18 | Validación funcional en UI y smoke manual documentado | `dashboard.html`, `dashboard.js` |

### Criterios de aceptación M-007 (Cobranzas UX)
- **Sin filtro de sucursal:** En el módulo Cobranzas (legacy), no debe existir filtro por sucursal o debe estar deshabilitado/oculto según regla de negocio.
- **Filtro y gráfico por UN:** Debe existir filtro por Unidad de Negocio (UN) y al menos un gráfico que permita desglose o vista por UN.
- **Evidencia:** Smoke manual en legacy (dashboard): 1) Abrir Cobranzas, comprobar ausencia de filtro sucursal. 2) Aplicar filtro por UN y comprobar que el gráfico (o tabla) refleja datos por UN. Documentar en este archivo o en `docs/cutover-checklist-final.md`.

## Registro de avances
### 2026-02-16
- Se creó el documento de seguimiento.
- Se incorporaron mejoras operativas pendientes de cierre (cutover, perf/parity, rollback, firmas).

## Plantilla para actualizar cada mejora
### ID: M-XXX
- Estado actual:
- Último avance:
- Bloqueadores:
- Próxima acción:
- Fecha de próxima revisión:
- Evidencia nueva:

