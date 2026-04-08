import React from "react";
import type {
  AnalyticsDashboardSectionId,
  AnalyticsFilterId,
  FilterSlotStyle,
} from "@/config/analyticsFilterLayouts";
import {
  buildEffectiveFilterLayout,
  resolveDashboardFilterRowGridClass,
} from "@/config/analyticsFilterLayouts";
import { useFilterLayoutConfig } from "@/components/filters/FilterLayoutConfigContext";

/** Contrato estándar: panel principal + FAB comparten layout; auto-aplicar idle vive en el hook. */
export {
  useDashboardMainFilterAutoApply,
  type DashboardMainFilterLayoutSlice,
  type UseDashboardMainFilterAutoApplyParams,
} from "@/hooks/useDashboardMainFilterAutoApply";

export type DashboardFiltersLayoutProps = {
  sectionId: AnalyticsDashboardSectionId;
  /** Nodos por id de filtro; solo se renderizan los que existen en el layout y tienen slot. */
  slots: Partial<Record<AnalyticsFilterId, React.ReactNode>>;
  /** Excluye ids del layout resuelto (p. ej. feature flag) sin tocar `analyticsFilterLayouts.ts`. */
  omit?: readonly AnalyticsFilterId[];
  /** Clase del grid por fila; por defecto `analysis-filters-grid`. Tiene prioridad sobre overrides del servidor. */
  gridClassByTier?: Partial<Record<"macro" | "micro", string>>;
  /** p. ej. E2E: `data-testid` en el grid de la fila macro (si existe). */
  macroGridDataTestId?: string;
};

export function wrapDashboardFilterSlot(
  id: AnalyticsFilterId,
  node: React.ReactNode,
  style?: FilterSlotStyle,
): React.ReactNode {
  const columnSpan = style?.column_span;
  const minW = style?.min_width_px;
  const scale = style?.control_scale;
  const spanAttr =
    typeof columnSpan === "number" && columnSpan >= 2
      ? String(columnSpan)
      : undefined;
  const classes = [
    "dashboard-filter-slot",
    scale && scale !== "default" ? `dashboard-filter-slot--scale-${scale}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const cssVars =
    typeof minW === "number" && minW >= 72
      ? ({
          ["--filter-slot-min-width" as string]: `${minW}px`,
        } as React.CSSProperties)
      : undefined;
  return (
    <div
      key={id}
      className={classes}
      data-filter-id={id}
      data-span={spanAttr}
      data-has-min-width={minW != null && minW >= 72 ? "1" : undefined}
      style={cssVars}
    >
      {node}
    </div>
  );
}

/**
 * Renderiza filtros en el orden canónico de la sección (macro → micro),
 * aplicando overrides guardados en configuración (admin).
 */
/**
 * Filtro lateral (FAB): mismo orden y estilos de slot que el panel, según layout admin.
 * Omití en `slots` los ids condicionales (null) para no renderizarlos.
 */
export function DashboardFloatingFiltersLayout({
  sectionId,
  slots,
  omit = [],
}: {
  sectionId: AnalyticsDashboardSectionId;
  slots: Partial<Record<AnalyticsFilterId, React.ReactNode>>;
  omit?: readonly AnalyticsFilterId[];
}) {
  const { doc } = useFilterLayoutConfig();
  const effective = buildEffectiveFilterLayout(sectionId, omit, doc);
  const nodes: React.ReactNode[] = [];
  for (const id of effective.floating) {
    const node = slots[id];
    if (node == null) continue;
    nodes.push(
      wrapDashboardFilterSlot(id, node, effective.slotStyles[id]),
    );
  }
  return <>{nodes}</>;
}

export function DashboardFiltersLayout({
  sectionId,
  slots,
  omit = [],
  gridClassByTier: gridClassByTierProp,
  macroGridDataTestId,
}: DashboardFiltersLayoutProps) {
  const { doc } = useFilterLayoutConfig();
  const effective = buildEffectiveFilterLayout(sectionId, omit, doc);

  const tiers: Array<{ key: "macro" | "micro"; ids: readonly AnalyticsFilterId[] }> =
    [
      { key: "macro", ids: effective.macro },
      { key: "micro", ids: effective.micro },
    ];

  return (
    <>
      {tiers.map(({ key, ids }) => {
        if (ids.length === 0) return null;
        const nodes: React.ReactNode[] = [];
        for (const id of ids) {
          const node = slots[id];
          if (node == null) {
            if (process.env.NODE_ENV !== "production") {
              console.warn(
                `[DashboardFiltersLayout] Falta slot para filtro "${id}" en sección "${sectionId}"`,
              );
            }
            continue;
          }
          const slotSt = effective.slotStyles[id];
          nodes.push(wrapDashboardFilterSlot(id, node, slotSt));
        }
        if (nodes.length === 0) return null;
        const gridClass = resolveDashboardFilterRowGridClass(sectionId, key, {
          gridClassByTierFromView: gridClassByTierProp,
          gridClassMacroFromDoc: effective.gridClassByTierFromServer.macro,
          gridClassMicroFromDoc: effective.gridClassByTierFromServer.micro,
        });
        return (
          <div
            key={key}
            className={`dashboard-filters-row dashboard-filters-row--${key}`}
            data-dashboard-filter-tier={key}
          >
            <div
              className={gridClass}
              data-testid={key === "macro" ? macroGridDataTestId : undefined}
            >
              {nodes}
            </div>
          </div>
        );
      })}
    </>
  );
}
