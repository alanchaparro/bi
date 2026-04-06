# Avance del Proyecto: Canon Ejecutivo Power

**Fecha de actualizacion:** 2026-04-04  
**Estado general:** activo  
**Objetivo:** llevar todas las vistas analytics a una lectura ejecutiva homogenea segun `power.md`.

## Resumen ejecutivo
- `power.md` queda consolidado como canon narrativo del dashboard ejecutivo.
- La conciliacion documental elimina el conflicto entre KPIs y filtros: primero resumen ejecutivo, luego motor de filtros.
- El rollout debe medirse por modulo, no solo por componentes sueltos.

## Estado por seccion

| Seccion | Ruta | Estado power | Observacion |
|--------|------|--------------|-------------|
| Resumen de cartera | `/cartera` | avanzado | ya usa header + KPIs + filtros jerarquicos + tabla |
| Analisis de cartera | `/analisis-cartera` | avanzado | base robusta; revisar orden definitivo KPI/filtros en cada iteracion |
| Rolo de cartera | `/analisis-cartera/rolo-cartera` | avanzado | ya muestra resumen ejecutivo antes de filtros; queda ajuste fino visual si aparece nuevo drift |
| Analisis anuales | `/analisis-anuales` | avanzado | ya suma KPIs ejecutivos y transicion narrativa antes de la tabla |
| Rendimiento de cartera | `/rendimiento` | avanzado | referencia principal del patron ejecutivo |
| Analisis cobranzas corte | `/cobranzas-cohorte` | avanzado | patron ejecutivo ya visible; mantener consistencia |
| EERR | `/eerr` | avanzado | tablero ejecutivo financiero; validar siempre margen/EBITDA canonicos |
| Configuracion | `/config` | fuera de scope power | aplica canon de producto/sistema, no tablero ejecutivo |

## Criterio de cierre por modulo
Un modulo se considera cerrado en canon power cuando cumple:

1. Header con kicker, titulo, subtitulo y meta compacta.
2. KPIs arriba del panel de filtros.
3. Filtros separados en macro, micro y acciones.
4. Texto de transicion o seleccion actual antes del detalle.
5. Charts y tablas con narrativa clara de lectura ejecutiva.
6. Empty, loading y error states coherentes con el patron premium.

## Proximos pasos
1. Revisar `Analisis de cartera`, `Cobranzas corte` y `EERR` para asegurar que no quede drift frente al nuevo orden canonico.
2. Homogeneizar detalles visuales secundarios entre cards KPI, hints y transiciones de lectura.
3. Registrar en este archivo cada modulo cerrado en el mismo PR que haga el ajuste visual.
