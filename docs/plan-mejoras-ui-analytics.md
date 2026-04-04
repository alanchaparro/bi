# PLAN DE IMPLEMENTACIÓN DE MEJORAS UI ANALYTICS
## Basado en DESIGN.md del repositorio VoltAgent/awesome-design-md

---

## 1. PROPÓSITO

Este documento define el plan de implementación para incorporar patrones de UI de alto nivel (Linear, Vercel, Supabase) al frontend analytics de **EPEM - Cartera de Cobranzas**.

**Objetivo principal:**  
Mejorar la experiencia de usuario, densidad de información, estética y rendimiento del dashboard analítico consumiendo los patrones de diseño de sitios de referencia.

**Alcance:**
- Frontend nuevo (HeroUI/Next.js) en `/api/v1`
- Dashboards de cartera, cobranzas, EERR, rendimiento
- Tablas densas de datos, KPIs, filtros interactivos
- No tocar frontend legacy (v1) ni rutas marcadas en `desacople.md`

**Fuente de verdad de reglas:**
- `AGENTS.md` — reglas de negocio y canónicos
- `desacople.md` — fronteras frontend nuevo/legacy
- `docs/spec-canon-patrones-ui-analytics.md` — UI analytics operativo
- `docs/design-tokens.md` — tokens visuales (si aplica)

---

## 2. PRINCIPIOS DE IMPLEMENTACIÓN

### 2.1. Jerarquía de implementación

1. **Linear** — prioridad 1 (dark-mode-first, ideal para dashboards densos)
2. **Vercel** — prioridad 2 (white mode para documentación, secciones de lectura)
3. **Supabase** — prioridad 3 (dark mode con identidad, para modales/superposiciones)

### 2.2. Límites no tocar

- ❌ **NO** modificar componentes marcados en `desacople.md` como legacy
- ❌ **NO** cambiar rutas de API v1 sin revisión de contratos
- ❌ **NO** alterar canónicos de negocio (`gestion_month`, categorías, tramos)
- ❌ **NO** usar colores fuera del sistema de tokens validado en `docs/design-tokens.md`
- ❌ **NO** modificar `frontend-prod` (build Docker) sin validar `INICIAR.bat`

### 2.3. Seguridad de UI

- [ ] No hardcodear tokens visuales en componentes; usar CSS variables o Tailwind config
- [ ] Validar que cambios visuales no afecten SLA (p95 <= 1200ms para analytics)
- [ ] Revisar que no haya drift entre código y `AGENTS.md`

---

## 3. FASES DE IMPLEMENTACIÓN

### FASE 1: Investigación y alineación (1–3 días)

**Objetivo:**  
Validar que los patrones propuestos no rompen reglas de negocio ni UX canónico.

**Tareas:**

1.1. **Inventario de componentes afectados**
   - Listar todos los componentes UI en frontend analytics que requieren cambios (botones, select, tablas, modales, tarjetas, filtros)
   - Identificar dónde se usan actualmente (rutas de API, componentes HeroUI, librerías)
   - Validar que no haya marcadores de UI legacy en estos componentes

1.2. **Validación de tokens de color**
   - Verificar que los colores de Linear/Vercel/Supabase no entren en conflicto con `AGENTS.md`
   - Definir mapeo de tokens:
     - Background: `#08090a` (Linear) o `#171717` (Supabase)
     - Text primary: `#f7f8f8` o `#fafafa`
     - Accent: `#5e6ad2` (Linear) o `#3ecf8e` (Supabase)
   - Confirmar que estos colores no rompan accesibilidad (WCAG AA)

1.3. **Alineación con canónicos**
   - Revisar `docs/spec-canon-patrones-ui-analytics.md` para verificar compatibilidad
   - Validar con `docs/design-tokens.md` (si existe)
   - Confirmar que cambios visuales no afectan KPIs de negocio

1.4. **Definición de excepciones**
   - Documentar cualquier desviación del DESIGN.md original (p. ej., colores de negocio obligatorios)
   - Registrar en `bugs_visual.md` o `pendientes.md` si aplica

**Entregables:**
- ✅ Inventario de componentes afectados (lista en Excel/Markdown)
- ✅ Tabla de tokens de color mapeada
- ✅ Documento de excepciones alineado con canónicos

---

### FASE 2: Prototipado y validación (3–5 días)

**Objetivo:**  
Crear prototipos de componentes clave y validar visualmente antes de implementación.

**Tareas:**

2.1. **Selección de componentes piloto**
   - Componente 1: Tabla densa de cartera (KPIs por UN, categoría, tramo)
   - Componente 2: Modal de filtros de cobranzas
   - Componente 3: Tarjetas de resumen de rendimiento
   - Componente 4: Dropdown/Select para elección de periodos/UNs

2.2. **Prototipado en código**
   - Usar HeroUI + Tailwind para crear componentes prototipo
   - Aplicar tokens de Linear (o Vercel/Supabase según corresponda)
   - Validar que no haya dependencias de UI legacy

2.3. **Validación visual con stakeholders no técnicos**
   - Mostrar prototipos a equipo de negocio (experiencia de uso, usabilidad percibida)
   - Recibir feedback en `pendientes.md` (ítems PEND-*)
   - Validar que estética no afecte percepción de profesionalismo

2.4. **Validación técnica**
   - Correr smoke API para verificar que prototipos no rompen contratos
   - Validar que cambios visuales no afectan rendimiento (p95 metrics)
   - Confirmar que no hay drift en `AGENTS.md`

**Entregables:**
- ✅ Prototipos de componentes (branches separados)
- ✅ Feedback de stakeholders (capturado en `pendientes.md`)
- ✅ Reporte de validación técnica (logs de rendimiento, smoke tests)

---

### FASE 3: Implementación por componentes (1–2 semanas)

**Objetivo:**  
Implementar cambios visuales en componentes, uno por uno, con validación en cada paso.

**Tareas:**

3.1. **Implementación por componente**
   - Para cada componente piloto:
     - Actualizar tokens en Tailwind config o CSS variables
     - Aplicar estilos de Linear/Vercel/Supabase (según corresponda)
     - Validar que no haya drift en `AGENTS.md`
     - Confirmar que no hay marcadores de UI legacy

3.2. **Validación de cada cambio**
   - Correr smoke API para cada cambio
   - Validar que no afecta KPIs de negocio (rendimiento_monto_%, LTV, etc.)
   - Revisar `bugs_visual.md` para detectar nuevos hallazgos
   - Confirmar que cambios no rompen `desacople.md`

3.3. **Registro de cambios**
   - Documentar cada cambio en un commit separado
   - Actualizar `docs/design-tokens.md` con tokens nuevos
   - Revisar `docs/spec-canon-patrones-ui-analytics.md` y marcar cambios

**Entregables:**
- ✅ Componentes implementados (uno por commit)
- ✅ Logs de validación (smoke API, rendimiento)
- ✅ Actualizaciones de documentación

---

### FASE 4: Validación de regresión y QA (2–3 días)

**Objetivo:**  
Confirmar que cambios no rompen funcionalidad ni afectan negocio.

**Tareas:**

4.1. **Correrte matrix de QA**
   - Ejecutar test suite para cada componente modificado
   - Validar contra golden datasets (pruebas de paridad con legacy)
   - Confirmar que no hay discrepancia >0.5% en agregados principales

4.2. **Validación de rendimiento**
   - Correr `perf_current.json` para comparar p95 antes/después
   - Confirmar que no hay degradación crítica (>2x umbral)
   - Validar que SLA se mantienen (p95 analytics <= 1200ms)

4.3. **Revisión de UX por stakeholders no técnicos**
   - Mostrar dashboard completo a equipo de negocio
   - Validar que usabilidad percibida no se ve afectada
   - Actualizar `pendientes.md` si hay hallazgos

**Entregables:**
- ✅ Reporte de regresión (test suite + QA)
- ✅ Comparativa de rendimiento (antes/después)
- ✅ Validación de UX por stakeholders

---

### FASE 5: Despliegue y monitorización (1 día)

**Objetivo:**  
Poner cambios en producción y monitorizar impacto.

**Tareas:**

5.1. **Pre-despliegue**
   - Revisar `release-checklist.md` (si existe) o crear checklist específico
   - Correr `INICIAR.bat` / `iniciar.sh` para validar despliegue
   - Confirmar que no hay secretos expuestos en diffs (escaneo `gitleaks`)

5.2. **Despliegue**
   - Ejecutar `docker compose --profile prod up -d`
   - Validar logs de sync (meses detectados, upserts, fallbacks)
   - Confirmar que servicios están salud (nginx + API + front)

5.3. **Monitorización inicial**
   - Monitorizar p95 en endpoints de analytics
   - Validar que no hay error rate >2% en 5 min
   - Revisar logs de errores por endpoint

5.4. **Handoff de monitorización**
   - Documentar impacto en `optimo.md` (si hay mejora/pero en UX)
   - Registrar en `qa.md` corridas con evidencia
   - Actualizar `bugs_visual.md` si hay hallazgos post-despliegue

**Entregables:**
- ✅ Despliegue exitoso en `prod`
- ✅ Logs de monitorización (p95, error rate)
- ✅ Reporte de impacto (mejoras/pero en UX)

---

## 4. MATRIZ DE COMPONENTES

| Componente | Fase de implementación | Token de color | Validación técnica | Checklist UI |
|------------|------------------------|-----------------|--------------------|--------------|
| Tabla densa (cartera) | FASE 2 (componente 1) | Background: `#08090a` | Smoke API: `/portfolio-corte-v2/summary` | ✅ No hay marcadores legacy |
| Modal de filtros | FASE 2 (componente 2) | Border: `rgba(255,255,255,0.08)` | Smoke API: `/portfolio-corte-v2/options` | ✅ Validar contra `docs/spec-canon-patrones-ui-analytics.md` |
| Tarjetas KPI | FASE 2 (componente 3) | Accent: `#5e6ad2` | Smoke API: `/rendimiento-v2/summary` | ✅ Validar contra `bugs_visual.md` |
| Dropdown/Select | FASE 3 (componente 4) | Hover: `#828fff` | Smoke API: `/rendimiento-v2/options` | ✅ Validar contra `docs/heroui/README.md` |
| Botones de acción | FASE 3 (componente 5) | Button: `#5e6ad2` (ghost) | Smoke API: `/api/v1/*` | ✅ Validar contra `docs/spec-canon-patrones-ui-analytics.md` |

---

## 5. CRITERIOS DE ACEPTACIÓN

### 5.1. Funcionales

- [ ] Cada componente modificado pasa smoke API
- [ ] No hay discrepancia >0.5% en agregados vs legacy (si aplica)
- [ ] No hay error rate >2% en 5 min post-despliegue
- [ ] No hay p95 >2x umbral en analytics (1200ms max)

### 5.2. Visuales

- [ ] Cambios alineados con `docs/spec-canon-patrones-ui-analytics.md`
- [ ] No hay marcadores de UI legacy en componentes nuevos
- [ ] Tokens visuales consistentes en todos los componentes
- [ ] Accesibilidad WCAG AA mantenida (contraste, foco visible)

### 5.3. Reglas de negocio

- [ ] `gestion_month` calculado como cierre + 1 mes (no afecta)
- [ ] Categorías por tramo correctas (VIGENTE 0–3, MOROSO >3)
- [ ] KPIs de negocio intactos (rendimiento_monto_%, LTV, etc.)
- [ ] UNs mostradas según política canónica vigente

### 5.4. Documentación

- [ ] `AGENTS.md` actualizado con cambios
- [ ] `desacople.md` revisado para confirmar no rompen fronteras
- [ ] `docs/design-tokens.md` actualizado con tokens nuevos
- [ ] `bugs_visual.md` actualizado con hallazgos
- [ ] `qa.md` registrado con evidencia y estado

---

## 6. RIESGOS Y MITIGACIÓN

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| **Drift entre código y `AGENTS.md`** | Media | Alto | Revisar `AGENTS.md` en cada commit; usar `.cursor/rules` |
| **Rompínder desacople.md** | Baja | Alto | Validar cada cambio contra `desacople.md`; no tocar rutas marcadas |
| **Degradación de p95** | Media | Medio | Monitorear logs de API; revertir si p95 >2x umbral |
| **Hallazgos en `bugs_visual.md`** | Alta | Bajo | Registrar en backlog; priorizar por `optimo.md` |
| **Exposición de secretos** | Baja | Crítico | Escaneo `gitleaks` antes de commit; no commitear `.env` |
| **Cambios de color rompen negocio** | Media | Alto | Validar tokens contra `AGENTS.md`; mantener excepciones documentadas |

---

## 7. METRICAS DE ÉXITO

| Métrica | Objetivo | Fórmula |
|---------|----------|---------|
| **Reducción de bugs visuales** | -20% en 30 días | (bugs_cerrados / bugs_totales) × 100 |
| **Mejora de p95 analytics** | ≤1200ms | p95_endpoint (GET analytics agregados) |
| **Satisfacción de UX** | ≥4.5/5 | Encuesta a usuarios finales (si aplica) |
| **Cumplimiento de canónicos** | 100% | Revisión contra `AGENTS.md` |

---

## 8. DOCUMENTACIÓN ASOCIADA

### 8.1. Canónicos transversal

- `AGENTS.md` — reglas de negocio y canónicos
- `desacople.md` — fronteras frontend nuevo/legacy
- `docs/spec-canon-patrones-ui-analytics.md` — UI analytics operativo
- `docs/design-tokens.md` — tokens visuales (si aplica)
- `docs/heroui/README.md` — adopción de HeroUI
- `docs/heroui/PLAN-MIGRACION.md` — estado de migración UI

### 8.2. Backlogs

- `bugs.md` — backlog técnico/operativo
- `bugs_visual.md` — backlog UX/UI visual
- `optimo.md` — criterios de optimización continua
- `qa.md` — corridas QA tipo usuario final
- `pendientes.md` — voz de cliente ejecutivo no técnico

### 8.3. Despliegue

- `INICIAR.bat` / `iniciar.sh` — lanzamiento prod
- `INICIAR_LAN.bat` / `iniciar_lan.sh` — lanzamiento LAN
- `DETENER.bat` / `detener.sh` — detener stack
- `REINICIAR.bat` / `reiniciar.sh` — reinicio limpio

### 8.4. Observabilidad

- `docs/ops-observability.md` — logs y monitoring
- `docs/slo-sla.md` — objetivos de latencia/disponibilidad
- `perf_current.json` — métricas de rendimiento actual

---

## 9. CHECKLIST FINAL

### Antes de commit

- [ ] Escaneo de secretos (`gitleaks`) sin hallazgos
- [ ] Validar contra `AGENTS.md` y `desacople.md`
- [ ] Confirmar que no hay marcadores de UI legacy
- [ ] Revisar que no hay cambios de canónicos de negocio

### Antes de despliegue

- [ ] Correr smoke API (portfolio, rendimiento, eerr)
- [ ] Validar logs de sync (meses detectados, upserts, fallbacks)
- [ ] Confirmar que servicios están salud (nginx + API + front)
- [ ] Revisar `bugs_visual.md` para hallazgos abiertos

### Post-despliegue

- [ ] Monitorizar p95 en endpoints de analytics
- [ ] Validar que no hay error rate >2% en 5 min
- [ ] Revisar logs de errores por endpoint
- [ ] Actualizar `qa.md` con corridas y evidencia

### Después de 30 días

- [ ] Revisar `optimo.md` para impacto en UX
- [ ] Validar que no hay nuevos bugs en `bugs_visual.md`
- [ ] Correr comparativa de KPIs (antes/después)
- [ ] Actualizar `docs/design-tokens.md` con aprendizaje

---

## 10. HISTORIAL DE CAMBIOS

| Fecha | Autor | Descripción | Referencia |
|-------|-------|-------------|------------|
| 2025-XX-XX | [Tu nombre] | Creación del plan de mejoras UI | AGENTS.md + DESIGN.md |
| | | | |
| | | | |

---

## 11. APÉNDICES

### Apéndice A: Diseño de referencia

**Linear** (prioridad 1)
- Background: `#08090a`
- Text primary: `#f7f8f8`
- Accent: `#5e6ad2`
- Border: `rgba(255,255,255,0.08)`

**Vercel** (prioridad 2)
- Background: `#ffffff`
- Text primary: `#171717`
- Accent: `#0072f5`
- Border: `rgba(0, 0, 0, 0.08) 0px 0px 0px 1px`

**Supabase** (prioridad 3)
- Background: `#171717`
- Text primary: `#fafafa`
- Accent: `#3ecf8e`
- Border: `#2e2e2e`

### Apéndice B: Recursos del repositorio

- `https://github.com/VoltAgent/awesome-design-md`
- `design-md/linear.app/DESIGN.md`
- `design-md/vercel/DESIGN.md`
- `design-md/supabase/DESIGN.md`
- `preview.html`, `preview-dark.html` — catálogos visuales

### Apéndice C: Contacto

- Para consultas: revisar `AGENTS.md`
- Para hallazgos: actualizar `bugs_visual.md`
- Para excepciones: registrar en `pendientes.md`

---

## 12. APROBACIÓN

**Preparado por:** [Tu nombre]  
**Fecha:** 2025-XX-XX  
**Estado:** En revisión (PEND-*)  
**Aprobado por:** [Stakeholder correspondiente]

---

*Documento canónico — todo cambio debe validarse contra `AGENTS.md` antes de mergear.*