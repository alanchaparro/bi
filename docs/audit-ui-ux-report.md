# Reporte de auditoría UI/UX — Frontend EPEM Cartera de Cobranzas

**Fecha:** 2025-03-12  
**Alcance:** Vistas y componentes en `frontend/src/` (HeroUI v3, accesibilidad, UX, consistencia).  
**Referencias:** [HeroUI v3 Design Principles](https://v3.heroui.com/docs/design-principles), `.cursor/rules/agent-frontend-heroui.mdc`, AGENTS.md.

---

## 1. Resumen ejecutivo

| Aspecto | Cumplimiento | Bloqueantes | Mejoras |
|--------|---------------|-------------|---------|
| Uso de HeroUI | Parcial | 0 | Formularios nativos en LoginView y Brokers*; migrar a componentes HeroUI |
| Semántica de variantes | Parcial | 0 | Acciones destructivas ("Eliminar") deben usar `variant="danger"` |
| Accesibilidad | Aceptable | 0 | Labels y ARIA en general correctos; corregir typo en aria-label ToastStack |
| UX (estados, responsive) | Bueno | 0 | Loading/error/vacío cubiertos; revisar espaciado y touch targets |
| Consistencia | Bueno | 0 | Reducir estilos inline; unificar copy de botones secundarios |

**Veredicto:** No hay bloqueantes críticos. Se recomienda aplicar correcciones de prioridad **alta** (HeroUI en LoginView usado por App.tsx, botones destructivos, accesibilidad menor) y **media** (estilos inline, variante outline vs secondary según documentación).

**Actualización (post-correcciones):** Se aplicaron las correcciones del plan de auditoría UI/UX. Ítems corregidos: ConfigView botón Eliminar → HeroUI `variant="danger"`; AnalisisCarteraView leyenda/tooltips/ejes → clases CSS (`.analysis-stack-hover-badge`, `.analysis-axis-tick`, `.analysis-bar-label`); ToastStack `aria-label` contextual; ConfigView inputs formulario programación → HeroUI Input; BrokersCommissionsView inputs tabla → HeroUI Input; documentación en ui-designer.md (regla animaciones <400ms aplica a acciones de usuario).

**Refino estético (elegante / moderno / HeroUI):** Copy unificado («Limpiar» y «Restablecer» en lugar de «Limpiar filtros» / «Resetear filtros»); tokens de sombra (`--shadow-card`, `--shadow-panel`, `--shadow-button-hover`); panel de análisis con borde y sombra; header de página con tipografía más clara y kicker refinado; cards con hover y borde; resumen de selección y contador de filtros con estilo pill; botón primario con sombra en hover; toggle KPI y checkbox «Monto detallado» con mejor contraste; header del dashboard con sombra sutil; labels de filtros con mayor peso y espaciado.

---

## 2. Hallazgos por categoría

### 2.1 HeroUI y componentes

| ID | Archivo | Línea/componente | Hallazgo | Prioridad | Recomendación |
|----|---------|-------------------|----------|-----------|----------------|
| H1 | `frontend/src/modules/auth/LoginView.tsx` | Formulario completo | Usa `<input>` y clases `.input` nativas; solo el botón es HeroUI. LoginView está referenciado en `App.tsx`. | **Alta** | Sustituir por `Input` (y `Label` si aplica) de `@heroui/react`; mantener misma API (onSubmit, error, loading). |
| H2 | `frontend/src/modules/brokersCommissions/BrokersCommissionsView.tsx` | Botón "Eliminar" | ~~`variant="outline"`~~ → ya usa `variant="danger"`. | **Alta** | ✅ Corregido. |
| H3 | `frontend/src/modules/brokersPrizes/BrokersPrizesView.tsx` | Botón "Eliminar" | Igual que H2. | **Alta** | ✅ Corregido. |
| H4 | `frontend/src/modules/brokersCommissions/BrokersCommissionsView.tsx` | Inputs de tabla | Migrados a HeroUI `Input` con clases Tailwind (`w-full min-w-[100px]`, `w-20`). | **Media** | ✅ Corregido. |
| H5 | Variantes `outline` | Múltiples archivos | Uso extensivo de `variant="outline"`. En HeroUI v3 los principios hablan de primary/secondary/tertiary; confirmar si `outline` existe en la beta o usar `secondary` para acciones secundarias. | **Media** | Verificar API de HeroUI v3 beta; si solo existen semantic variants, reemplazar `outline` por `secondary` donde corresponda. |

### 2.2 Accesibilidad

| ID | Archivo | Línea/componente | Hallazgo | Prioridad | Recomendación |
|----|---------|-------------------|----------|-----------|----------------|
| A1 | `frontend/src/components/feedback/ToastStack.tsx` | Botón cerrar | `aria-label` contextual: mensaje corto → "Cerrar notificación: {mensaje}"; largo → "Cerrar notificación". | **Alta** | ✅ Corregido. |
| A2 | `frontend/src/modules/auth/LoginView.tsx` | Mensaje de error | El error se muestra en `<p className="alert-error">` sin `role="alert"`. | **Media** | Añadir `role="alert"` al contenedor del mensaje de error para que lectores de pantalla lo anuncien. |
| A3 | `frontend/src/modules/analisisCartera/AnalisisCarteraView.tsx` | Botones de leyenda | `aria-label` correctos ("Mostrar serie"/"Ocultar serie"); uso de `style={{}}` para color/decoration. | **Baja** | Mantener aria-label; mover estilos a clase CSS. |

### 2.3 UX (jerarquía, estados, responsive)

| ID | Archivo | Línea/componente | Hallazgo | Prioridad | Recomendación |
|----|---------|-------------------|----------|-----------|----------------|
| U1 | `frontend/src/components/feedback/LoadingState.tsx` | Spinner | Usa `.inline-spinner` con `aria-hidden`; mensaje con `aria-live="polite"`. | OK | — |
| U2 | `frontend/src/components/feedback/EmptyState.tsx` | Mensaje y sugerencia | `role="status"` y estructura clara. | OK | — |
| U3 | `frontend/src/components/feedback/ErrorState.tsx` | Reintentar | Botón secundario y `role="alert"` en contenedor. | OK | — |
| U4 | Layout y sidebar | `DashboardLayout.tsx`, `SidebarNav` | Touch targets con `--touch-min: 44px`; navegación con `aria-current="page"` y cierre en móvil. | OK | — |
| U5 | Filtros | `MultiSelectFilter`, `ActiveFilterChips` | Placeholders y estados vacíos claros; chips con aria-label de quitar. | OK | — |

### 2.4 Consistencia y estilo

| ID | Archivo | Línea/componente | Hallazgo | Prioridad | Recomendación |
|----|---------|-------------------|----------|-----------|----------------|
| C1 | `frontend/src/modules/analisisCartera/AnalisisCarteraView.tsx` | Leyenda y tooltips gráficos | Estilos inline movidos a clases CSS: `.analysis-stack-hover-label`, `.analysis-stack-hover-badge`, `.analysis-axis-tick`, `.analysis-bar-label`. | **Alta** | ✅ Corregido. |
| C2 | `frontend/src/modules/brokersCommissions/BrokersCommissionsView.tsx` | Inputs | Migrados a HeroUI Input con clases Tailwind. | **Media** | ✅ Corregido. |
| C3 | Copy de botones | Varias vistas | "Limpiar filtros" / "Resetear filtros" vs "Aplicar filtros" — consistente en análisis. "Cerrar notificación" en Toast. | **Baja** | Revisar glosario de copy para mantener consistencia en toda la app. |

---

## 3. Prioridad de correcciones

- **Críticos:** Ninguno.
- **Alta:** H1 (LoginView → HeroUI), H2, H3 (Eliminar → danger), A1 (ToastStack aria-label), C1 (estilos inline leyenda).
- **Media:** H4, H5, A2, C2.
- **Baja:** A3, C3.

---

## 4. Componentes revisados (checklist)

| Componente / vista | HeroUI | A11y | Estados | Responsive |
|--------------------|--------|------|--------|------------|
| LoginView (modules/auth) | Parcial (solo Button) | Labels OK; error sin role="alert" | loading/disabled OK | — |
| app/login/page.tsx | Input, Card, Label, Button | Labels + role="alert" en error | OK | OK |
| DashboardLayout | Button (ghost, outline, secondary) | aria-label, aria-expanded | loading OK | Sidebar responsive |
| SidebarNav | Button ghost | aria-current, aria-label | — | Cierre en móvil |
| MultiSelectFilter | Button outline | listbox, option, aria-activedescendant | disabled cuando options vacío | — |
| ActiveFilterChips | Button outline | aria-label por chip | — | — |
| ErrorState, EmptyState, LoadingState | Button en ErrorState | role alert/status, aria-busy/live | OK | — |
| ToastStack | Button ghost | aria-live; typo en aria-label | — | — |
| AnalysisFiltersSkeleton | Skeleton | aria-busy, aria-live | — | — |
| AnalisisCarteraView | Button, Skeleton | aria-label en leyenda/sort | loading/empty/error | — |
| AnalisisRendimientoView, AnalisisAnualesView, AnalisisCobranzasCohorteView | Button primary/outline | Varios aria-label | applying/loading | — |
| BrokersCommissionsView, BrokersPrizesView | Button, Input HeroUI | aria-label en inputs | saving/disabled | — |

---

## 5. Próximos pasos sugeridos

1. ~~Aplicar todas las correcciones de prioridad **alta** en `frontend/src/`.~~ ✅ Aplicadas (ConfigView Eliminar, AnalisisCarteraView estilos, ToastStack aria-label, BrokersCommissionsView inputs, ConfigView inputs programación).
2. Ejecutar tests E2E y auditoría a11y (axe-core) tras los cambios.
3. Validar con QA los flujos de login (App.tsx + page.tsx si ambos se usan), análisis de cartera, rendimiento, cohortes y config (programaciones).
4. Documentar en el proyecto si la ruta de login canónica es `app/login/page.tsx` y si `LoginView` en App.tsx queda como legacy o se elimina.
