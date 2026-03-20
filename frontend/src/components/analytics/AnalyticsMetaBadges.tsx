import React from "react";
import type { AnalyticsMeta } from "../../shared/api";

type Props = {
  meta?: AnalyticsMeta | null;
  className?: string;
};

function formatCacheHit(value?: boolean) {
  if (value === true) return "Cache hit";
  if (value === false) return "Cache miss";
  return "";
}

export function AnalyticsMetaBadges({ meta, className = "" }: Props) {
  const items = [
    meta?.source_table ? `Fuente: ${meta.source_table}` : "",
    meta?.data_freshness_at ? `Actualizado: ${meta.data_freshness_at}` : "",
    formatCacheHit(meta?.cache_hit),
    meta?.pipeline_version ? `Pipeline: ${meta.pipeline_version}` : "",
  ].filter(Boolean);

  if (items.length === 0) return null;

  return (
    <div className={`analysis-meta-row analytics-meta-badges ${className}`.trim()} aria-label="Metadata de analytics">
      {items.map((item) => (
        <span
          key={item}
          className={`analysis-meta-chip ${item === "Cache hit" ? "analysis-meta-chip-ok" : ""} ${item === "Cache miss" ? "analysis-meta-chip-warn" : ""}`.trim()}
        >
          {item}
        </span>
      ))}
    </div>
  );
}
