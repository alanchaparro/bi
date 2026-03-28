# Spec canónico — Patrones UI analytics

## Propósito
Definir un canon visual y de interacción claro para todo el frontend analytics, con reglas concretas tipo `si pasa X, usar Y`.

Esta spec existe para evitar que cada vista invente su propia solución para filtros, acciones, tablas, densidad o jerarquía.

## Precedencia
Cuando haya dudas, usar este orden:
1. `AGENTS.md`
2. `desacople.md`
3. este archivo
4. `docs/frontend-visual-standard.md`
5. `docs/spec-visual-appbar-sidebar-buttons.md`
6. tokens compartidos en `frontend/src/app/globals.css` y `frontend/src/index.css`

## Principios rectores
- El dato manda; el chrome no compite con el contenido.
- Un usuario operativo escanea; no lee pantallas completas.
- Desktop debe sentirse correcto al `100%` de zoom en `1366x768` o superior.
- Si un patrón necesita explicación extra para entenderse, probablemente no es el patrón correcto.
- Un mismo problema de UI debe resolverse siempre con la misma familia visual.

## Regla de densidad
- El sistema debe verse usable en desktop sin depender de `70%`, `80%` o `90%` de zoom del navegador.
- El objetivo base de revisión es `1366x768` a `100%`.
- Si una vista obliga a bajar zoom para “entrar”, se considera incumplimiento visual.

## Árbol de decisión canónico

### 1. Filtros de selección única

#### 1.1 Cuando hay 2 o 3 opciones fijas
Usar `segmented control` canónico.

Ejemplos:
- `Categoría`: `Todas | Vigente | Moroso`
- `Vía`: `Todas | Caja | Débito`
- `Vista`: `Resumen | Detalle`

Reglas:
- label arriba, alineado al sistema
- contenedor tipo pill group
- opción activa rellena, clara y táctil
- opciones inactivas legibles pero secundarias
- no usar `select` si solo hay 2 o 3 opciones fijas y visibles

#### 1.2 Cuando hay 4 a 6 opciones cortas y comparables
Usar `segmented control` solo si:
- todas las etiquetas son cortas
- caben sin romper desktop ni mobile
- el usuario gana velocidad viendo todas juntas

Si no se cumplen esas tres condiciones, usar `select`.

#### 1.3 Cuando hay más de 6 opciones o la lista es dinámica
Usar `select` o `multi-select`.

Ejemplos:
- unidad de negocio
- supervisor
- año de contrato
- mes/año

#### 1.4 Cuando es una decisión booleana
Usar:
- `switch` para activar/desactivar comportamiento persistente
- `checkbox` para inclusión puntual dentro de un formulario

No usar segmented para `sí/no` salvo que el contexto lo justifique operativamente.

### 2. Filtros múltiples
- Si el usuario puede elegir varias opciones, usar `MultiSelectFilter` o patrón equivalente compartido.
- Si las opciones son pocas pero múltiples, no convertirlas en una fila de botones improvisados.
- Toda selección múltiple debe dejar feedback visible de estado aplicado.

### 3. Acciones
- Una sola acción primaria por bloque.
- El resto son secundarias o terciarias.
- Orden canónico:
  - `Aplicar`
  - `Limpiar`
  - `Restablecer`

Reglas:
- no mezclar tres estilos visuales distintos en la misma barra
- acciones del mismo nivel deben compartir variante
- metadata no debe parecer botón

### 4. Tabs y navegación local
- Si cambia de subvista o modo de lectura, usar tabs o segmented según cantidad y semántica.
- Si cambia filtros, no usar tabs falsas.
- Navegación principal nunca debe parecer un grupo de filtros.

### 5. Tablas
- Si la tabla supera 6 columnas útiles, asumir que puede necesitar scroll horizontal.
- Toda tabla ancha debe:
  - tener wrapper compartido
  - mantener encabezado claro
  - permitir exploración horizontal
  - mostrar hint en mobile cuando aplique

Reglas:
- números alineados y monoespaciados
- encabezado más compacto que el cuerpo
- zebra y hover discretos
- no usar tablas con densidad “de planilla cruda” si se pueden resumir antes con KPIs

## Componentes y patrones canonizados

### Segmented control
Aplicación obligatoria cuando un filtro de selección única tiene `<= 3` opciones fijas.

Implementación en código: `SegmentedControl` (`frontend/src/components/filters/SegmentedControl.tsx`) con clases `.analytics-segmented*` en `frontend/src/index.css` (carril tipo píldora, activo con gradiente pizarra → teal).

**Categoría** (`Todas | Vigente | Moroso`): siempre segmented donde aplique la regla de negocio.

**Vía de cobro / pago**: `ViaSegmentedOrMulti` — segmented si hay `<= 6` vías y como máximo una vía seleccionada; si no, `MultiSelectFilter` (varias vías o lista larga).

Estilo esperado:
- cápsula contenedora neutra
- activo con relleno claro y lectura inmediata
- inactivo con texto secundario
- separación limpia, sin borders pesados

No permitido:
- mezclar segmented con botones legacy
- dejar el activo solo con texto en negrita sin superficie
- usar `select` para 2 o 3 opciones obvias

### Select / multi-select
Aplicación obligatoria cuando el universo de opciones es variable, largo o dependiente de datos.

Reglas:
- mismo alto y densidad en toda la fila
- labels consistentes
- no mezclar un select gigante con otros controles miniatura

### Metadata chips
Uso:
- `cache_hit`
- `fuente`
- `fecha de actualización`
- `pipeline`

Reglas:
- son metadata, no CTA
- deben ser compactos
- no deben dominar el header

### KPI cards
Uso:
- resumen de estado antes de charts y tablas

Reglas:
- máximo 2 filas visibles antes de empezar a sentirse ruido
- densidad compacta en desktop
- valor primero, label después o claramente subordinado

### Paneles de filtros
Reglas:
- un solo panel por bloque analítico
- grilla uniforme
- spacing consistente
- no dejar filtros flotando sin contención

## Canon de jerarquía de pantalla
Orden esperado en una vista analítica:
1. título y contexto
2. metadata compacta
3. definiciones o aclaraciones si son realmente necesarias
4. filtros
5. selección actual
6. KPIs
7. charts
8. tabla de detalle

Si una vista invierte este orden sin una razón fuerte, se considera drift.

## Canon de copy
- lenguaje de negocio primero
- no exponer labels técnicos al usuario
- los nombres de controles deben ser cortos y operativos
- evitar duplicar conceptos en título, subtítulo y hint

## Canon de escala desktop
En desktop:
- filtros, botones y chips no deben sentirse “mobile-first gigantes”
- sidebar y header deben ocupar el mínimo espacio compatible con claridad
- cards y tablas deben entrar en pantalla sin sensación de zoom forzado

Se considera bug visual:
- tener que bajar zoom del navegador para usar la app cómodamente
- header/sidebar que roban espacio al dato
- filtros que parecen hechos para tablet dentro de una pantalla desktop

## Checklist rápido para dev
- [ ] Si un filtro single-choice tiene `<= 3` opciones fijas, usa segmented control
- [ ] Si un filtro tiene muchas opciones o depende de datos, usa select/multi-select
- [ ] La vista se entiende a `100%` zoom en `1366x768`
- [ ] Hay una sola acción primaria por bloque
- [ ] Metadata no compite visualmente con acciones
- [ ] KPIs, charts y tablas usan la jerarquía canónica
- [ ] No se inventó una familia visual nueva para resolver un patrón ya definido

## Evidencia de referencia
- ejemplo canónico base para filtros cortos:
  - `Categoría: Todas | Vigente | Moroso`
- este patrón debe replicarse en todo el proyecto cuando la estructura del dato sea equivalente
