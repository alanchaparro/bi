"use client";

import { useMemo } from "react";
import {
  buildEffectiveFilterLayout,
  type AnalyticsDashboardSectionId,
  type AnalyticsFilterId,
  type FilterSlotStyle,
} from "@/config/analyticsFilterLayouts";
import { useFilterLayoutConfig } from "@/components/filters/FilterLayoutConfigContext";

const EMPTY_OMIT: readonly AnalyticsFilterId[] = [];

function omitKey(omit: readonly AnalyticsFilterId[] | undefined): string {
  if (!omit?.length) return "";
  return [...omit].sort().join("|");
}

/**
 * Estilo efectivo del slot (layout persistido + canon) para un filtro en una sección.
 */
export function useEffectiveSlotStyle(
  sectionId: AnalyticsDashboardSectionId,
  filterId: AnalyticsFilterId,
  omit?: readonly AnalyticsFilterId[],
): FilterSlotStyle | undefined {
  const { doc } = useFilterLayoutConfig();
  const key = omitKey(omit);
  return useMemo(
    () =>
      buildEffectiveFilterLayout(
        sectionId,
        omit?.length ? omit : EMPTY_OMIT,
        doc,
      ).slotStyles[filterId],
    [sectionId, filterId, key, doc],
  );
}
