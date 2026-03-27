export function formatCount(value: number): string {
  return Math.round(Number(value || 0)).toLocaleString("es-PY");
}

export function formatGsFull(value: number): string {
  return `Gs. ${formatCount(value)}`;
}

export function formatGsCompact(value: number): string {
  const numeric = Number(value || 0);
  const abs = Math.abs(numeric);
  if (abs >= 1_000_000_000_000) return `Gs. ${(numeric / 1_000_000_000_000).toFixed(1)}T`;
  if (abs >= 1_000_000_000) return `Gs. ${(numeric / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `Gs. ${(numeric / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `Gs. ${(numeric / 1_000).toFixed(1)}K`;
  return `Gs. ${Math.round(numeric)}`;
}

/** Timestamps analytics/sync: API suele devolver UTC naive sin sufijo; alineado a Config (parse como UTC). */
export function formatAnalyticsTimestampForDisplay(value?: string | null): string {
  if (value == null || String(value).trim() === "") return "";
  const raw = String(value).trim();
  const normalized = /[zZ]|[+\-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString("es-PY", { dateStyle: "short", timeStyle: "medium" });
}
