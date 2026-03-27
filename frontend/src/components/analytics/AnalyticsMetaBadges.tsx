import React, { useMemo } from "react";
import type { AnalyticsMeta } from "../../shared/api";
import { formatAnalyticsTimestampForDisplay } from "../../shared/formatters";

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
  const chips = useMemo(() => {
    const out: { key: string; text: string; title?: string; cacheTone?: "ok" | "warn" | "" }[] = [];
    if (meta?.source_table) {
      out.push({ key: `src-${meta.source_table}`, text: `Fuente: ${meta.source_table}` });
    }
    if (meta?.data_freshness_at) {
      const local = formatAnalyticsTimestampForDisplay(meta.data_freshness_at);
      out.push({
        key: `fresh-${meta.data_freshness_at}`,
        text: `Actualizado: ${local}`,
        title: `Valor desde la base (UTC, sin zona en API): ${meta.data_freshness_at}. Hora local según tu navegador.`,
      });
    }
    const cacheLabel = formatCacheHit(meta?.cache_hit);
    if (cacheLabel) {
      out.push({
        key: `cache-${cacheLabel}`,
        text: cacheLabel,
        cacheTone: cacheLabel === "Cache hit" ? "ok" : cacheLabel === "Cache miss" ? "warn" : "",
      });
    }
    if (meta?.pipeline_version) {
      out.push({ key: `pipe-${meta.pipeline_version}`, text: `Pipeline: ${meta.pipeline_version}` });
    }
    return out;
  }, [meta?.cache_hit, meta?.data_freshness_at, meta?.pipeline_version, meta?.source_table]);

  if (chips.length === 0) return null;

  return (
    <div className={`analysis-meta-row analytics-meta-badges ${className}`.trim()} aria-label="Metadata de analytics">
      {chips.map((c) => (
        <span
          key={c.key}
          title={c.title}
          className={`analysis-meta-chip ${c.cacheTone === "ok" ? "analysis-meta-chip-ok" : ""} ${c.cacheTone === "warn" ? "analysis-meta-chip-warn" : ""}`.trim()}
        >
          {c.text}
        </span>
      ))}
    </div>
  );
}
