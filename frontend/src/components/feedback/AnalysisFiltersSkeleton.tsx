import React from "react";
import { Skeleton } from "@heroui/react";

type Props = {
  filterCount?: number;
  kpiCount?: number;
  showTable?: boolean;
  className?: string;
};

/**
 * Skeleton de carga inicial para paneles de análisis (filtros + KPIs + tabla).
 * Usa Skeleton de HeroUI para integración visual con el tema.
 */
export function AnalysisFiltersSkeleton({
  filterCount = 8,
  kpiCount = 6,
  showTable = true,
  className = "",
}: Props) {
  return (
    <div
      className={`analysis-skeleton-wrap analysis-skeleton-heroui ${className}`.trim()}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="analysis-skeleton-grid">
        {Array.from({ length: filterCount }, (_, i) => (
          <Skeleton
            key={i}
            className="analysis-skeleton-input analysis-skeleton-heroui-input"
            animationType="shimmer"
          />
        ))}
      </div>
      <div className="analysis-skeleton-kpis">
        {Array.from({ length: kpiCount }, (_, i) => (
          <Skeleton
            key={i}
            className="analysis-skeleton-kpi analysis-skeleton-heroui-kpi"
            animationType="shimmer"
          />
        ))}
      </div>
      {showTable && (
        <Skeleton
          className="analysis-skeleton-table analysis-skeleton-heroui-table"
          animationType="shimmer"
        />
      )}
    </div>
  );
}
