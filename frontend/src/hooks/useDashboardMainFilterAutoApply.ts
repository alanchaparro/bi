"use client";

import { useMemo } from "react";
import type { AnalyticsFilterId } from "@/config/analyticsFilterLayouts";
import { snapshotFloatingFilterValues } from "@/config/analyticsFilterLayouts";
import { useFilterAutoApplyAfterIdle } from "@/hooks/useFilterAutoApplyAfterIdle";

/** Recorte de `buildEffectiveFilterLayout`: filas macro + micro del panel principal. */
export type DashboardMainFilterLayoutSlice = {
  readonly macro: readonly AnalyticsFilterId[];
  readonly micro: readonly AnalyticsFilterId[];
};

export type UseDashboardMainFilterAutoApplyParams = {
  /** Mismo objeto que `buildEffectiveFilterLayout` (macro/micro alineados al grid principal). */
  effective: DashboardMainFilterLayoutSlice;
  pickDraft: (filterId: string) => readonly string[];
  pickApplied: (filterId: string) => readonly string[];
  onApply: () => void | Promise<void>;
  /** `true` cuando el panel lateral de filtros rápidos está abierto (no duplicar el temporizador). */
  floatSidebarOpen: boolean;
  applyDisabled?: boolean;
  applying?: boolean;
  idleMs?: number;
  /** Por defecto `true`; `false` solo en módulos que no deban auto-aplicar. */
  enabled?: boolean;
};

/**
 * Comportamiento estándar del producto: tras ~4 s sin cambiar el borrador del panel principal,
 * aplica filtros si difieren de lo cargado. Debe usarse junto a `FloatingQuickFilters` (misma política).
 */
export function useDashboardMainFilterAutoApply({
  effective,
  pickDraft,
  pickApplied,
  onApply,
  floatSidebarOpen,
  applyDisabled = false,
  applying = false,
  idleMs,
  enabled = true,
}: UseDashboardMainFilterAutoApplyParams): void {
  const mainFilterSlotIds = useMemo(
    () => [...effective.macro, ...effective.micro],
    [effective.macro, effective.micro],
  );
  const draftKey = useMemo(
    () => snapshotFloatingFilterValues(mainFilterSlotIds, pickDraft),
    [mainFilterSlotIds, pickDraft],
  );
  const appliedKey = useMemo(
    () => snapshotFloatingFilterValues(mainFilterSlotIds, pickApplied),
    [mainFilterSlotIds, pickApplied],
  );
  useFilterAutoApplyAfterIdle({
    draftKey,
    appliedKey,
    onApply,
    enabled: enabled && !floatSidebarOpen,
    applyDisabled,
    applying,
    idleMs,
  });
}
