import React, { useMemo } from "react";
import type { AnalyticsMeta } from "../../shared/api";
import { AnalyticsDataFreshnessHero } from "./AnalyticsDataFreshnessHero";

type Props = {
  meta?: AnalyticsMeta | null;
  className?: string;
  /** Si true, no envuelve en `analysis-meta-row` (para filas compuestas con acciones a la derecha). */
  embed?: boolean;
};

type TextChip = {
  key: string;
  kind: "text";
  text: string;
  title?: string;
  cacheTone?: "ok" | "warn" | "";
};

type FreshnessChip = {
  key: string;
  kind: "freshness";
  at: string;
  title?: string;
};

type Chip = TextChip | FreshnessChip;

function formatCacheHit(value?: boolean) {
  if (value === true) return "Cache hit";
  if (value === false) return "Cache miss";
  return "";
}

export function AnalyticsMetaBadges({ meta, className = "", embed = false }: Props) {
  const chips = useMemo(() => {
    const out: Chip[] = [];
    if (meta?.source_table) {
      out.push({ key: `src-${meta.source_table}`, kind: "text", text: `Fuente: ${meta.source_table}` });
    }
    if (meta?.data_freshness_at) {
      out.push({
        key: `fresh-${meta.data_freshness_at}`,
        kind: "freshness",
        at: meta.data_freshness_at,
        title: `Valor desde la base (UTC, sin zona en API): ${meta.data_freshness_at}. Hora local según tu navegador.`,
      });
    }
    const cacheLabel = formatCacheHit(meta?.cache_hit);
    if (cacheLabel) {
      out.push({
        key: `cache-${cacheLabel}`,
        kind: "text",
        text: cacheLabel,
        cacheTone: cacheLabel === "Cache hit" ? "ok" : cacheLabel === "Cache miss" ? "warn" : "",
      });
    }
    if (meta?.pipeline_version) {
      out.push({ key: `pipe-${meta.pipeline_version}`, kind: "text", text: `Pipeline: ${meta.pipeline_version}` });
    }
    return out;
  }, [meta?.cache_hit, meta?.data_freshness_at, meta?.pipeline_version, meta?.source_table]);

  if (chips.length === 0) return null;

  const chipClass = (c: Chip) =>
    `analysis-meta-chip ${c.kind === "text" && c.cacheTone === "ok" ? "analysis-meta-chip-ok" : ""} ${c.kind === "text" && c.cacheTone === "warn" ? "analysis-meta-chip-warn" : ""} ${c.kind === "freshness" ? "analysis-meta-chip--freshness" : ""}`.trim();

  const chipNodes = chips.map((c) =>
    c.kind === "freshness" ? (
      <span key={c.key} title={c.title} className={chipClass(c)}>
        <AnalyticsDataFreshnessHero dataFreshnessAt={c.at} title={c.title} />
      </span>
    ) : (
      <span key={c.key} title={c.title} className={chipClass(c)}>
        {c.text}
      </span>
    ),
  );

  if (embed) {
    return (
      <div className={`analytics-meta-badges-embed ${className}`.trim()} aria-label="Metadata de analytics">
        {chipNodes}
      </div>
    );
  }

  return (
    <div className={`analysis-meta-row analytics-meta-badges ${className}`.trim()} aria-label="Metadata de analytics">
      {chipNodes}
    </div>
  );
}
