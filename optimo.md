# optimo.md - Guia de optimizacion continua

## Proposito
Este documento define como optimizar codigo para reducir consumo de hardware (CPU, RAM, I/O, red, disco) y mejorar la experiencia del cliente final (UX, tiempos de respuesta, estabilidad).

Principio base:
- Mal codigo fuerza hardware innecesariamente.
- Buen codigo aumenta performance en el mismo hardware.

## Regla de oro
Toda mejora debe cumplir ambas condiciones:
1. **Menor costo tecnico**: menos recursos por operacion.
2. **Mayor valor usuario**: respuesta mas rapida, interfaz mas fluida, menos errores.

Si una optimizacion mejora metricas tecnicas pero empeora UX, no se considera terminada.

## Flujo de trabajo con bugs del equipo
Este repo ya usa registros canonicos de bugs:
- `bugs.md` para hallazgos tecnicos/operativos.
- `bugs_visual.md` para hallazgos UX/UI visuales.

Cuando llegue un bug o mejora:
1. Tomar el item del backlog (ID AUD-* o V-* si aplica).
2. Clasificar impacto:
   - Hardware: CPU, RAM, I/O, red, disco.
   - UX: latencia, fluidez, feedback visual, errores percibidos.
3. Definir hipotesis de mejora en una frase:
   - "Si cambiamos X por Y, reducimos Z% de costo y mejoramos T en UX."
4. Implementar cambio minimo seguro.
5. Medir antes/despues con evidencia.
6. Actualizar estado del bug con resultado verificable.

### Regla de seguimiento canónico
- `optimo.md` se considera backlog operativo activo al mismo nivel que `bugs.md` y `bugs_visual.md`.
- Ninguna pasada se considera completa si hay drift de estado entre estos tres archivos.

## Prioridad de optimizacion (orden estricto)
1. **Cuellos de botella de usuario** (pantallas o endpoints lentos).
2. **Trabajo innecesario repetido** (recalculos, consultas duplicadas, rerenders evitables).
3. **Uso excesivo de memoria** (objetos grandes, buffers, leaks).
4. **I/O y red ineficiente** (N+1, payloads grandes, sin paginacion/cache).
5. **Higiene de codigo y deuda tecnica** (complejidad que impide escalar).

## Checklist obligatorio por cambio
Antes de cerrar un item:
- Existe baseline de rendimiento (antes).
- Existe medicion posterior (despues) con mismo escenario.
- No se rompen reglas de negocio del proyecto.
- No se degrada UX (loading/error/empty coherentes).
- Hay evidencia en tests/smoke/logs segun corresponda.
- Se actualiza `bugs.md` o `bugs_visual.md` con estado y evidencia.

## Patrones concretos para bajar consumo de hardware

### Backend/API
- Evitar consultas repetidas y N+1; agrupar y paginar.
- Seleccionar solo columnas necesarias.
- Aplicar cache donde el dato sea reutilizable.
- Mover calculos costosos fuera del request sincrono cuando sea posible.
- Evitar serializacion/deserializacion redundante.
- Definir timeouts y limites para proteger recursos.

### Frontend
- Reducir rerenders (memoizacion selectiva, particion de estado).
- Cargar codigo por demanda (lazy loading) en modulos pesados.
- Minimizar trabajo en hilo principal (calculos pesados fuera de render).
- Evitar efectos duplicados o loops de estado.
- Mantener feedback inmediato al usuario (loading/error/empty consistentes).

### Datos y sync
- Procesar por ventanas acotadas.
- Evitar refresh global cuando alcanza refresh incremental.
- Reusar resultados intermedios si no cambiaron fuentes.
- Registrar meses aplicados/detectados/usados para trazabilidad.

## Evidencia minima esperada en cada entrega
Toda optimizacion cerrada debe dejar:
1. Que se cambio.
2. Por que reduce costo de hardware.
3. Como mejora UX final.
4. Metricas antes/despues.
5. Riesgos y plan de rollback simple.

Formato corto sugerido:
- **Cambio**: ...
- **Costo reducido**: ...
- **UX mejorada**: ...
- **Antes**: ...
- **Despues**: ...
- **Riesgo**: ...

## Criterio de "Listo para verificar"
Un item pasa a "Listo para verificar" solo si:
- El diff es claro y acotado.
- La mejora es medible, no opinion.
- El codigo queda mas simple o igual de mantenible.
- El consumo de hardware no empeora en escenarios de carga realistas.
- El usuario final percibe mejora (tiempo, claridad, estabilidad).

## Antipatrones prohibidos
- "Optimizar" sin medir.
- Resolver lentitud agregando solo mas hardware.
- Introducir complejidad excesiva por micro-optimizaciones sin impacto.
- Cerrar bug sin evidencia reproducible.
- Mejorar backend degradando experiencia visual (o viceversa).

## Cadencia de mejora continua
- Cada ciclo de trabajo debe cerrar al menos 1 mejora de rendimiento con evidencia.
- Si hay conflicto entre tareas, priorizar las que impactan mas usuarios y mas costo operativo.
- Mantener backlog vivo y sin drift entre codigo y archivos de bugs.

---

Si este documento queda desalineado con la realidad del repo o con nuevas reglas de negocio, debe actualizarse en el mismo ciclo donde se detecta la diferencia.
