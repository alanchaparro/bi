import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Skeleton } from "@heroui/react";
import { MultiSelectFilter } from "../../components/filters/MultiSelectFilter";
import { ActiveFilterChips, type FilterChip } from "../../components/filters/ActiveFilterChips";
import { SegmentedControl } from "../../components/filters/SegmentedControl";
import { ToastStack, type ToastMessage, type ToastType } from "../../components/feedback/ToastStack";
import { LoadingState } from "../../components/feedback/LoadingState";
import { AnalysisFiltersSkeleton } from "../../components/feedback/AnalysisFiltersSkeleton";
import { ErrorState } from "../../components/feedback/ErrorState";
import { EmptyState } from "../../components/feedback/EmptyState";
import { AnalyticsPageHeader } from "../../components/analytics/AnalyticsPageHeader";
import { AnalyticsMetaBadges } from "../../components/analytics/AnalyticsMetaBadges";
import { AnalysisSelectionSummary } from "../../components/analytics/AnalysisSelectionSummary";
import { MetricExplainer } from "../../components/analytics/MetricExplainer";
import {
  getPortfolioCorteFirstPaint,
  getPortfolioCorteOptions,
  getPortfolioCorteSummary,
  markPerfReady,
  type PortfolioCorteOptionsResponse,
  type PortfolioCorteSummaryResponse,
} from "../../shared/api";
import { formatCount, formatGsCompact, formatGsFull } from "../../shared/formatters";
import { getApiErrorMessage } from "../../shared/apiErrors";

type Filters = {
  uns: string[];
  supervisors: string[];
  years: string[];
  vias: string[];
  tramos: string[];
  categorias: string[];
  gestionMonths: string[];
  closeMonths: string[];
};

type ChartId =
  | "by_un"
  | "by_tramo"
  | "by_via"
  | "by_contract_year"
  | "series_vig_mor_month"
  | "series_via_month";
type KpiId = "total" | "monto" | "vigentes" | "morosos" | "cobrador" | "debito";
type YearSort = "desc" | "asc";
type SummaryLoadReason = "initial" | "apply" | "reset";
type KpiIconId = "doc" | "money" | "check" | "alert" | "user" | "card";
type KpiMode = "filters" | "last_close";

const DEFAULT_FILTERS: Filters = {
  uns: [],
  supervisors: [],
  years: [],
  vias: [],
  tramos: [],
  categorias: [],
  gestionMonths: [],
  closeMonths: [],
};

const DEFAULT_CHART_ORDER: ChartId[] = [
  "series_vig_mor_month",
  "series_via_month",
  "by_un",
  "by_tramo",
  "by_via",
  "by_contract_year",
];
const DEFAULT_KPI_ORDER: KpiId[] = ["total", "monto", "vigentes", "morosos", "cobrador", "debito"];
const STORAGE_KPI_ORDER = "analisis_cartera_kpi_order_v1";
const STORAGE_CHART_ORDER = "analisis_cartera_chart_order_v1";
const STORAGE_AMOUNT_VIEW = "analisis_cartera_amount_view_v1";
const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
];
const CHART_COLORS_LIGHT = CHART_COLORS;
const STORAGE_KPI_MODE = "analisis_cartera_kpi_mode_v1";

const formatPct = (value: number, total: number) => `${((Number(value || 0) / Math.max(1, Number(total || 0))) * 100).toFixed(1)}%`;

const monthFromRank = (rank: number) => {
  if (!Number.isFinite(rank) || rank <= 0) return "";
  const year = Math.floor(rank / 100);
  const month = rank % 100;
  if (month < 1 || month > 12) return "";
  return `${String(month).padStart(2, "0")}/${year}`;
};

const enumerateMonths = (months: string[]) => {
  const valid = [...new Set((months || []).filter((month) => monthRank(month) > 0))].sort((a, b) => monthRank(a) - monthRank(b));
  if (valid.length <= 1) return valid;
  const start = monthRank(valid[0]);
  const end = monthRank(valid[valid.length - 1]);
  const result: string[] = [];
  let current = start;
  while (current <= end) {
    const month = monthFromRank(current);
    if (month) result.push(month);
    const year = Math.floor(current / 100);
    const mm = current % 100;
    current = mm === 12 ? (year + 1) * 100 + 1 : year * 100 + (mm + 1);
  }
  return result;
};

function KpiIcon({ icon }: { icon: KpiIconId }) {
  const common = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (icon === "doc") return <svg {...common}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg>;
  if (icon === "money") return <svg {...common}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>;
  if (icon === "check") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.2 2.2 4.8-4.8" /></svg>;
  if (icon === "alert") return <svg {...common}><path d="M10.3 3.9 1.8 18.1A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>;
  if (icon === "user") return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0 1 16 0" /></svg>;
  return <svg {...common}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>;
}

const monthRank = (value: string) => {
  const parts = String(value || "").split("/");
  if (parts.length !== 2) return 0;
  const month = Number(parts[0] || 0);
  const year = Number(parts[1] || 0);
  if (!Number.isFinite(month) || !Number.isFinite(year)) return 0;
  return year * 100 + month;
};

function readStoredOrder<T extends string>(storageKey: string, defaults: T[]): T[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return defaults;
    const parsedSet = new Set(parsed);
    const next = defaults.filter((item) => parsedSet.has(item));
    const missing = defaults.filter((item) => !next.includes(item));
    return [...next, ...missing];
  } catch {
    return defaults;
  }
}

function DonutChart({ data, isLight = false, colors = CHART_COLORS }: { data: Array<{ label: string; value: number }>; isLight?: boolean; colors?: string[] }) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const visible = data.filter((d) => !hidden[d.label]);
  const total = visible.reduce((a, b) => a + b.value, 0) || 1;
  const hoveredItem = hoveredLabel ? visible.find((item) => item.label === hoveredLabel) : null;
  let acc = 0;
  const legendTextColor = "var(--color-text)";
  const legendHiddenColor = "var(--color-text-muted)";

  useEffect(() => {
    const labels = new Set(data.map((d) => d.label));
    setHidden((prev) => {
      const next: Record<string, boolean> = {};
      Object.entries(prev).forEach(([k, v]) => {
        if (labels.has(k)) next[k] = v;
      });
      return next;
    });
  }, [data]);
  useEffect(() => {
    if (hoveredLabel && !visible.some((item) => item.label === hoveredLabel)) {
      setHoveredLabel(null);
    }
  }, [hoveredLabel, visible]);

  const toggle = (label: string) => setHidden((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <div className="analysis-donut-wrap">
      <svg
        width="210"
        height="210"
        viewBox="0 0 210 210"
        role="img"
        aria-label="Contratos por tramo"
        onMouseLeave={() => setHoveredLabel(null)}
      >
        <g transform="translate(105,105)">
          {visible.map((d, idx) => {
            const start = (acc / total) * Math.PI * 2;
            acc += d.value;
            const end = (acc / total) * Math.PI * 2;
            const mid = (start + end) / 2;
            const rOuter = 86;
            const rInner = 50;
            const large = end - start > Math.PI ? 1 : 0;
            const x1 = Math.cos(start) * rOuter;
            const y1 = Math.sin(start) * rOuter;
            const x2 = Math.cos(end) * rOuter;
            const y2 = Math.sin(end) * rOuter;
            const x3 = Math.cos(end) * rInner;
            const y3 = Math.sin(end) * rInner;
            const x4 = Math.cos(start) * rInner;
            const y4 = Math.sin(start) * rInner;
            const path = `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4} Z`;
            const isHovered = hoveredLabel === d.label;
            const hoverOffset = isHovered ? 8 : 0;
            const tx = Math.cos(mid) * hoverOffset;
            const ty = Math.sin(mid) * hoverOffset;
            return (
              <path
                key={d.label}
                d={path}
                fill={colors[idx % colors.length]}
                className={`analysis-donut-segment ${isHovered ? "is-hovered" : ""}`}
                style={{ transform: `translate(${tx}px, ${ty}px)` }}
                onMouseEnter={() => setHoveredLabel(d.label)}
              />
            );
          })}
          <circle r="40" fill="var(--color-surface-elevated)" />
          <text className="analysis-donut-center-label" y={hoveredItem ? -4 : 0}>
            {hoveredItem ? hoveredItem.label : "Total"}
          </text>
          <text className="analysis-donut-center-value" y={hoveredItem ? 14 : 18}>
            {hoveredItem ? formatPct(hoveredItem.value, total) : formatCount(total)}
          </text>
        </g>
      </svg>
      <div className="analysis-donut-legend">
        {data.map((d, idx) => {
          const isHidden = !!hidden[d.label];
          return (
            <button
              key={d.label}
              type="button"
              onClick={() => toggle(d.label)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                marginBottom: "0.25rem",
                background: "transparent",
                border: "none",
                color: isHidden ? legendHiddenColor : legendTextColor,
                cursor: "pointer",
                textDecoration: isHidden ? "line-through" : "none",
                padding: 0,
              }}
              title={isHidden ? "Mostrar serie" : "Ocultar serie"}
              onMouseEnter={() => setHoveredLabel(isHidden ? null : d.label)}
              onMouseLeave={() => setHoveredLabel((current) => (current === d.label ? null : current))}
            >
              <span className="analysis-legend-swatch" style={{ background: colors[idx % colors.length] }} />
              <span>{d.label}: {formatCount(d.value)} ({formatPct(d.value, total)})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BarChart({ data, isLight = false, colors = CHART_COLORS }: { data: Array<{ label: string; value: number }>; isLight?: boolean; colors?: string[] }) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const visible = data.filter((d) => !hidden[d.label]);
  const max = Math.max(1, ...visible.map((d) => d.value));
  const total = Math.max(1, visible.reduce((acc, d) => acc + Number(d.value || 0), 0));
  const textColor = "var(--color-text)";
  const textMutedColor = "var(--color-text-muted)";
  const trackBg = "var(--chart-grid)";

  useEffect(() => {
    const labels = new Set(data.map((d) => d.label));
    setHidden((prev) => {
      const next: Record<string, boolean> = {};
      Object.entries(prev).forEach(([k, v]) => {
        if (labels.has(k)) next[k] = v;
      });
      return next;
    });
  }, [data]);

  const toggle = (label: string) => setHidden((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <div className="analysis-bars-wrap">
      {data.map((d, idx) => {
        const isHidden = !!hidden[d.label];
        const widthPct = isHidden ? 0 : Math.max(3, Math.round((d.value / max) * 100));
        return (
          <button
            key={d.label}
            type="button"
            onClick={() => toggle(d.label)}
            title={isHidden ? "Mostrar serie" : "Ocultar serie"}
            style={{ background: "transparent", border: "none", padding: 0, textAlign: "left", cursor: "pointer", color: isHidden ? textMutedColor : textColor }}
          >
            <div className="analysis-bars-row-meta">
              <span style={{ textDecoration: isHidden ? "line-through" : "none" }}>{d.label}</span>
              <span>{formatCount(d.value)} ({formatPct(d.value, total)})</span>
            </div>
            <div className="analysis-bars-track" style={{ background: trackBg }}>
              <div style={{ width: `${widthPct}%`, height: "100%", borderRadius: 999, background: colors[idx % colors.length] }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function StackedColumnChart({
  data,
  aLabel,
  bLabel,
  aColor = "var(--color-chart-1)",
  bColor = "var(--color-chart-5)",
  isLight = false,
  labelZoomStorageKey,
}: {
  data: Array<{ label: string; a: number; b: number }>;
  aLabel: string;
  bLabel: string;
  aColor?: string;
  bColor?: string;
  isLight?: boolean;
  labelZoomStorageKey?: string;
}) {
  const [hidden, setHidden] = useState<{ a: boolean; b: boolean }>({ a: false, b: false });
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [showBarPercent, setShowBarPercent] = useState<boolean>(() => {
    if (!labelZoomStorageKey) return true;
    const raw = window.localStorage.getItem(`${labelZoomStorageKey}_show_pct`);
    if (raw == null) return true;
    return raw === "1";
  });
  const [showBarNumbers, setShowBarNumbers] = useState<boolean>(() => {
    if (!labelZoomStorageKey) return true;
    const raw = window.localStorage.getItem(`${labelZoomStorageKey}_show_num`);
    if (raw == null) return true;
    return raw === "1";
  });
  const [labelZoom, setLabelZoom] = useState<number>(() => {
    if (!labelZoomStorageKey) return 100;
    const raw = window.localStorage.getItem(labelZoomStorageKey);
    const parsed = Number(raw || 100);
    if (!Number.isFinite(parsed)) return 100;
    return Math.min(200, Math.max(70, parsed));
  });
  const rawMaxY = Math.max(1, ...data.map((d) => (hidden.a ? 0 : Number(d.a || 0)) + (hidden.b ? 0 : Number(d.b || 0))));
  const maxY = Math.max(1, rawMaxY * 1.08);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(maxY * r));
  const chartHeight = 320;
  const barWidth = data.length <= 1 ? 56 : data.length <= 3 ? 36 : data.length <= 8 ? 20 : 14;
  const barGap = data.length <= 3 ? 10 : data.length <= 8 ? 7 : 4;
  const useFluidBars = data.length >= 6;
  const centerSparseBars = data.length <= 3;
  const yAxisWidth = 96;
  const barTotalPct = (value: number) => Math.max(0, Math.min(100, (value / Math.max(1, maxY)) * 100));
  const axisBorder = isLight ? "1.2px solid var(--chart-grid)" : "1px solid var(--chart-grid)";
  const legendBtnClass = `analysis-legend-btn min-w-0 w-auto p-0 ${isLight ? "analysis-legend-btn--light" : ""}`.trim();
  const labelZoomScale = Math.max(0.7, Math.min(2, labelZoom / 100));
  const zoomOutDisabled = labelZoom <= 70;
  const zoomInDisabled = labelZoom >= 200;
  const showAnyBarDetail = showBarPercent || showBarNumbers;
  const labelWidthBase = showBarPercent && showBarNumbers ? 56 : 40;
  const labelAwareBarMinWidth = showAnyBarDetail ? Math.max(barWidth, Math.round(labelWidthBase * labelZoomScale)) : barWidth;
  const horizontalDetailLayout = showAnyBarDetail && labelAwareBarMinWidth >= 62;
  const chartBarWidthForLayout = useFluidBars ? labelAwareBarMinWidth : barWidth;
  const chartMinWidth = Math.max(280, data.length * (chartBarWidthForLayout + barGap) + 24);
  const stackWrapStyle = { "--analysis-stack-label-zoom": String(labelZoomScale) } as React.CSSProperties;

  useEffect(() => {
    if (!labelZoomStorageKey) return;
    window.localStorage.setItem(labelZoomStorageKey, String(labelZoom));
  }, [labelZoom, labelZoomStorageKey]);
  useEffect(() => {
    if (!labelZoomStorageKey) return;
    window.localStorage.setItem(`${labelZoomStorageKey}_show_pct`, showBarPercent ? "1" : "0");
  }, [showBarPercent, labelZoomStorageKey]);
  useEffect(() => {
    if (!labelZoomStorageKey) return;
    window.localStorage.setItem(`${labelZoomStorageKey}_show_num`, showBarNumbers ? "1" : "0");
  }, [showBarNumbers, labelZoomStorageKey]);

  return (
    <div className="analysis-stack-wrap" style={stackWrapStyle}>
      <div className="analysis-stack-legend">
        <Button size="sm" variant="ghost" className={legendBtnClass} data-hidden={hidden.a ? "true" : undefined} aria-label={hidden.a ? "Mostrar serie" : "Ocultar serie"} onPress={() => setHidden((s) => ({ ...s, a: !s.a }))}>
          <span className="analysis-legend-swatch-sm" style={{ background: aColor }} />{aLabel}
        </Button>
        <Button size="sm" variant="ghost" className={legendBtnClass} data-hidden={hidden.b ? "true" : undefined} aria-label={hidden.b ? "Mostrar serie" : "Ocultar serie"} onPress={() => setHidden((s) => ({ ...s, b: !s.b }))}>
          <span className="analysis-legend-swatch-sm" style={{ background: bColor }} />{bLabel}
        </Button>
        <div className="analysis-stack-detail-controls">
          <span className="analysis-stack-detail-label">Etiquetas:</span>
          <Button size="sm" variant="ghost" className={`${legendBtnClass} analysis-stack-detail-btn`.trim()} data-hidden={!showBarPercent ? "true" : undefined} aria-label="Mostrar u ocultar porcentajes en barras" onPress={() => setShowBarPercent((prev) => !prev)}>
            Ver %
          </Button>
          <Button size="sm" variant="ghost" className={`${legendBtnClass} analysis-stack-detail-btn`.trim()} data-hidden={!showBarNumbers ? "true" : undefined} aria-label="Mostrar u ocultar números en barras" onPress={() => setShowBarNumbers((prev) => !prev)}>
            Ver #
          </Button>
        </div>
        <div className="analysis-stack-zoom">
          <span className="analysis-stack-zoom-label">Zoom etiquetas</span>
          <Button size="sm" variant="ghost" className={legendBtnClass} isDisabled={zoomOutDisabled} onPress={() => setLabelZoom((prev) => Math.max(70, prev - 10))} aria-label="Reducir zoom de etiquetas">
            -
          </Button>
          <span className="analysis-stack-zoom-value">{labelZoom}%</span>
          <Button size="sm" variant="ghost" className={legendBtnClass} isDisabled={zoomInDisabled} onPress={() => setLabelZoom((prev) => Math.min(200, prev + 10))} aria-label="Aumentar zoom de etiquetas">
            +
          </Button>
        </div>
      </div>
      <div className="analysis-stack-hoverline">
        {(() => {
          if (!hoveredLabel) return <span className="analysis-hover-hint">Pasa el mouse sobre una barra para ver porcentajes</span>;
          const row = data.find((d) => d.label === hoveredLabel);
          const a = hidden.a ? 0 : Number(row?.a || 0);
          const b = hidden.b ? 0 : Number(row?.b || 0);
          const total = Math.max(1, a + b);
          const aPct = ((a / total) * 100).toFixed(1);
          const bPct = ((b / total) * 100).toFixed(1);
          return (
            <>
              <span className="analysis-stack-hover-label">{hoveredLabel}</span>
              <span className="analysis-stack-hover-badge">
                <span className="analysis-legend-swatch-xs" style={{ background: aColor }} />
                {aLabel}: {formatCount(a)} ({aPct}%)
              </span>
              <span className="analysis-stack-hover-badge">
                <span className="analysis-legend-swatch-xs" style={{ background: bColor }} />
                {bLabel}: {formatCount(b)} ({bPct}%)
              </span>
            </>
          );
        })()}
      </div>
      <div className="analysis-chart-scroll">
        <div style={{ width: "100%", minWidth: chartMinWidth, display: "grid", gridTemplateColumns: `${yAxisWidth}px 1fr`, gap: "0.55rem" }}>
          <div style={{ position: "relative", height: chartHeight }}>
            {yTicks.map((tick, idx) => {
              const isBottomTick = idx === 0;
              const isTopTick = idx === yTicks.length - 1;
              return (
                <div
                  key={tick}
                  className="analysis-axis-tick"
                  style={
                    isTopTick
                      ? { bottom: "calc(100% - 0.95rem)", transform: "none" }
                      : {
                          bottom: `${(idx / (yTicks.length - 1)) * 100}%`,
                          transform: isBottomTick ? "translateY(0)" : "translateY(50%)",
                        }
                  }
                >
                  {formatCount(tick)}
                </div>
              );
            })}
          </div>
          <div style={{ position: "relative", height: chartHeight, borderLeft: axisBorder, borderBottom: axisBorder, display: "flex", alignItems: "flex-end", justifyContent: centerSparseBars ? "center" : "flex-start", gap: `${barGap}px`, padding: "0.85rem 0.25rem 0 0.1rem", width: "100%" }}>
            {yTicks.map((tick, idx) => <div key={`grid-${tick}`} style={{ position: "absolute", left: 0, right: 0, bottom: `${(idx / (yTicks.length - 1)) * 100}%`, borderTop: "1px solid var(--chart-grid-soft)" }} />)}
            {data.map((d) => {
              const a = hidden.a ? 0 : Number(d.a || 0);
              const b = hidden.b ? 0 : Number(d.b || 0);
              const rowTotal = Math.max(1, a + b);
              const aShare = ((a / rowTotal) * 100).toFixed(1);
              const bShare = ((b / rowTotal) * 100).toFixed(1);
              const aPct = barTotalPct(a);
              const bPct = barTotalPct(b);
              const isHovered = hoveredLabel === d.label;
              const totalPct = Math.max(aPct + bPct, 0);
              const minPctForDetails = horizontalDetailLayout ? 20 : 14;
              const showInsideDetails = showAnyBarDetail && totalPct >= minPctForDetails;
              const aDetail = showBarPercent && showBarNumbers ? `V ${aShare}% | ${formatCount(a)}` : showBarPercent ? `V ${aShare}%` : `V ${formatCount(a)}`;
              const bDetail = showBarPercent && showBarNumbers ? `M ${bShare}% | ${formatCount(b)}` : showBarPercent ? `M ${bShare}%` : `M ${formatCount(b)}`;
              return (
                <div
                  key={d.label}
                  onMouseEnter={() => setHoveredLabel(d.label)}
                  onMouseLeave={() => setHoveredLabel((prev) => (prev === d.label ? null : prev))}
                  style={{
                    flex: useFluidBars ? "1 1 0" : "0 0 auto",
                    width: useFluidBars ? undefined : `${barWidth}px`,
                    minWidth: useFluidBars ? `${labelAwareBarMinWidth}px` : `${barWidth}px`,
                    height: "100%",
                    position: "relative",
                    cursor: "pointer",
                    overflow: "visible",
                  }}
                  title={`${d.label} | ${aLabel}: ${formatCount(a)} | ${bLabel}: ${formatCount(b)} | Total: ${formatCount(a + b)}`}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: "8%",
                      right: "8%",
                      bottom: 0,
                      height: `${totalPct}%`,
                      borderRadius: "999px",
                      overflow: "hidden",
                      pointerEvents: "none",
                      transform: isHovered ? "scaleX(0.9) translateY(-2px)" : "scaleX(1) translateY(0)",
                      transformOrigin: "center bottom",
                      filter: isHovered ? "brightness(1.04) saturate(1.03)" : "none",
                      transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1), filter 320ms ease",
                      willChange: "transform, filter",
                    }}
                  >
                    {aPct > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          bottom: 0,
                          height: `${aPct}%`,
                          background: aColor,
                          borderBottomLeftRadius: "999px",
                          borderBottomRightRadius: "999px",
                          borderTopLeftRadius: bPct > 0 ? 0 : "999px",
                          borderTopRightRadius: bPct > 0 ? 0 : "999px",
                        }}
                      />
                    )}
                    {bPct > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          bottom: `${aPct}%`,
                          height: `${bPct}%`,
                          minHeight: b > 0 ? "1.5px" : undefined,
                          background: bColor,
                          borderTopLeftRadius: "999px",
                          borderTopRightRadius: "999px",
                        }}
                      />
                    )}
                    {showInsideDetails ? (
                      <div className={`analysis-stack-bar-overlay ${horizontalDetailLayout ? "analysis-stack-bar-overlay--horizontal" : ""}`.trim()}>
                        {!hidden.b ? (
                          <div className="analysis-stack-bar-tag">
                            <span className="analysis-stack-bar-tag-main">{bDetail}</span>
                          </div>
                        ) : null}
                        {!hidden.a ? (
                          <div className="analysis-stack-bar-tag">
                            <span className="analysis-stack-bar-tag-main">{aDetail}</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div />
          <div className="analysis-stack-labels" style={{ gap: `${barGap}px`, marginTop: "0.22rem" }}>
            {data.map((d) => (
              <div
                key={`lbl-${d.label}`}
                className="analysis-bar-label"
                style={{
                  minWidth: `${barWidth}px`,
                  width: useFluidBars ? undefined : `${barWidth}px`,
                  flex: useFluidBars ? "1 1 0" : "0 0 auto",
                }}
              >
                {d.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AnalisisCarteraView() {
  const summaryRequestSeq = useRef(0);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [optionsData, setOptionsData] = useState<PortfolioCorteOptionsResponse | null>(null);
  const [summaryData, setSummaryData] = useState<PortfolioCorteSummaryResponse | null>(null);
  const [kpiSummaryData, setKpiSummaryData] = useState<PortfolioCorteSummaryResponse | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingKpis, setLoadingKpis] = useState(false);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  const [optionsError, setOptionsError] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [optionsReady, setOptionsReady] = useState(false);
  const [chartOrder, setChartOrder] = useState<ChartId[]>(() => readStoredOrder(STORAGE_CHART_ORDER, DEFAULT_CHART_ORDER));
  const [draggingChart, setDraggingChart] = useState<ChartId | null>(null);
  const [dragOverChart, setDragOverChart] = useState<ChartId | null>(null);
  const [kpiOrder, setKpiOrder] = useState<KpiId[]>(() => readStoredOrder(STORAGE_KPI_ORDER, DEFAULT_KPI_ORDER));
  const [draggingKpi, setDraggingKpi] = useState<KpiId | null>(null);
  const [dragOverKpi, setDragOverKpi] = useState<KpiId | null>(null);
  const [yearSort, setYearSort] = useState<YearSort>("desc");
  const [kpiMode, setKpiMode] = useState<KpiMode>(() => (window.localStorage.getItem(STORAGE_KPI_MODE) as KpiMode) || "filters");
  const [showFullAmounts, setShowFullAmounts] = useState<boolean>(() => window.localStorage.getItem(STORAGE_AMOUNT_VIEW) === "full");
  const [toastQueue, setToastQueue] = useState<ToastMessage[]>([]);
  const isLightTheme = document.documentElement.dataset.theme === "light";
  const chartPalette = isLightTheme ? CHART_COLORS_LIGHT : CHART_COLORS;
  const isInitialOptionsLoading = loadingOptions && !optionsData && !optionsError;

  const dismissToast = useCallback((id: string) => setToastQueue((prev) => prev.filter((t) => t.id !== id)), []);

  const pushToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToastQueue((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => dismissToast(id), 3500);
  }, [dismissToast]);

  useEffect(() => { window.localStorage.setItem(STORAGE_CHART_ORDER, JSON.stringify(chartOrder)); }, [chartOrder]);
  useEffect(() => { window.localStorage.setItem(STORAGE_KPI_ORDER, JSON.stringify(kpiOrder)); }, [kpiOrder]);
  useEffect(() => { window.localStorage.setItem(STORAGE_AMOUNT_VIEW, showFullAmounts ? "full" : "compact"); }, [showFullAmounts]);
  useEffect(() => { window.localStorage.setItem(STORAGE_KPI_MODE, kpiMode); }, [kpiMode]);

  const getLatestCloseMonth = useCallback((months: string[]) => {
    if (!months || months.length === 0) return null;
    return [...months].sort((a, b) => monthRank(b) - monthRank(a))[0];
  }, []);

  const deriveLatestCloseMonthFromGestion = useCallback((gestionMonths: string[]) => {
    if (!gestionMonths || gestionMonths.length === 0) return null;
    const latestGestion = [...gestionMonths].sort((a, b) => monthRank(b) - monthRank(a))[0];
    const latestGestionRank = monthRank(latestGestion);
    if (!latestGestionRank) return null;
    const year = Math.floor(latestGestionRank / 100);
    const month = latestGestionRank % 100;
    const previousMonthRank = month === 1 ? (year - 1) * 100 + 12 : year * 100 + (month - 1);
    return monthFromRank(previousMonthRank) || null;
  }, []);

  const toPayload = useCallback((next: Filters) => ({
    supervisor: next.supervisors,
    un: next.uns,
    via_cobro: next.vias,
    anio: next.years,
    contract_month: [],
    gestion_month: next.gestionMonths,
    close_month: next.closeMonths,
    via_pago: [],
    categoria: next.categorias,
    tramo: next.tramos,
  }), []);

  const loadOptions = useCallback(async (next: Filters) => {
    setLoadingOptions(true);
    setOptionsReady(false);
    setOptionsError("");
    try {
      const res = await getPortfolioCorteOptions(toPayload(next));
      setOptionsData(res || { options: {} });
    } catch (e: unknown) {
      setOptionsError(getApiErrorMessage(e));
      setOptionsData(null);
    } finally {
      setLoadingOptions(false);
      setOptionsReady(true);
    }
  }, [toPayload]);

  const loadSummary = useCallback(async (next: Filters, reason: SummaryLoadReason) => {
    const requestId = ++summaryRequestSeq.current;
    setLoadingSummary(true);
    setSummaryError("");
    try {
      const res = await getPortfolioCorteSummary({ ...toPayload(next), include_rows: false });
      if (requestId !== summaryRequestSeq.current) return;
      const safeRes = res || {};
      setSummaryData(safeRes);
      if (reason !== "initial") {
        const total = Number(safeRes?.kpis?.total_cartera || 0);
        pushToast(total <= 0 ? "info" : "success", total <= 0 ? "Sin datos para los filtros seleccionados." : "Filtros aplicados.");
      }
    } catch (e: unknown) {
      if (requestId !== summaryRequestSeq.current) return;
      const message = getApiErrorMessage(e);
      setSummaryError(message);
      setSummaryData(null);
      pushToast("error", message);
    } finally {
      if (requestId !== summaryRequestSeq.current) return;
      setLoadingSummary(false);
    }
  }, [pushToast, toPayload]);

  const loadKpiSummary = useCallback(async (next: Filters) => {
    setLoadingKpis(true);
    try {
      let payloadFilters = next;
      if (kpiMode === "last_close") {
        let lastMonth = getLatestCloseMonth(next.closeMonths);
        if (!lastMonth) {
          lastMonth = deriveLatestCloseMonthFromGestion(next.gestionMonths);
        }
        if (!lastMonth) {
          const optionsRes = await getPortfolioCorteOptions(toPayload(next));
          const availableCloseMonths = optionsRes?.options?.close_months || [];
          lastMonth = getLatestCloseMonth(availableCloseMonths);
        }
        if (lastMonth) {
          payloadFilters = {
            ...next,
            closeMonths: [lastMonth],
            gestionMonths: next.gestionMonths.length ? [next.gestionMonths.sort((a, b) => monthRank(b) - monthRank(a))[0]] : next.gestionMonths,
          };
        }
      }
      const res = await getPortfolioCorteSummary({ ...toPayload(payloadFilters), include_rows: false });
      setKpiSummaryData(res || {});
    } catch (e: unknown) {
      pushToast("error", getApiErrorMessage(e));
      setKpiSummaryData(null);
    } finally {
      setLoadingKpis(false);
      setIsApplyingFilters(false);
    }
  }, [deriveLatestCloseMonthFromGestion, getLatestCloseMonth, kpiMode, pushToast, toPayload]);

  useEffect(() => { void loadOptions(filters); }, [loadOptions]);
  useEffect(() => {
    if (!optionsReady || summaryData) return;
    void Promise.all([loadSummary(appliedFilters, "initial"), loadKpiSummary(appliedFilters)]);
  }, [optionsReady, summaryData, loadSummary, loadKpiSummary, appliedFilters]);

  useEffect(() => {
    if (!optionsReady || summaryData) return;
    void (async () => {
      try {
        const fp = await getPortfolioCorteFirstPaint({ ...toPayload(appliedFilters), include_rows: false });
        if (fp?.kpis) {
          setKpiSummaryData((prev) => ({ ...(prev || {}), kpis: fp.kpis }));
        }
      } catch {
        // non-blocking fallback
      }
    })();
  }, [appliedFilters, optionsReady, summaryData, toPayload]);

  useEffect(() => {
    if (!optionsReady || !summaryData) return;
    void loadKpiSummary(appliedFilters);
  }, [kpiMode, appliedFilters, optionsReady, summaryData, loadKpiSummary]);

  useEffect(() => {
    if (!summaryData || !optionsReady || loadingSummary || loadingKpis) return;
    void markPerfReady("cartera");
  }, [loadingKpis, loadingSummary, optionsReady, summaryData]);

  const applyFilters = useCallback(async () => {
    if (loadingOptions) return;
    setIsApplyingFilters(true);
    setAppliedFilters(filters);
    await Promise.all([loadSummary(filters, "apply"), loadKpiSummary(filters)]);
  }, [filters, loadSummary, loadKpiSummary, loadingOptions]);

  const clearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);
  const resetDefaults = useCallback(async () => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setIsApplyingFilters(true);
    await Promise.all([loadSummary(DEFAULT_FILTERS, "reset"), loadKpiSummary(DEFAULT_FILTERS)]);
  }, [loadSummary, loadKpiSummary]);

  const options = optionsData?.options || {};
  const expectedGestionMonths = useMemo(() => {
    if (appliedFilters.gestionMonths.length) {
      return enumerateMonths(appliedFilters.gestionMonths);
    }
    if (appliedFilters.closeMonths.length) {
      const derived = appliedFilters.closeMonths
        .map((closeMonth) => {
          const rank = monthRank(closeMonth);
          if (!rank) return "";
          const year = Math.floor(rank / 100);
          const month = rank % 100;
          return monthFromRank(month === 12 ? (year + 1) * 100 + 1 : year * 100 + (month + 1));
        })
        .filter(Boolean) as string[];
      return enumerateMonths(derived);
    }
    return [];
  }, [appliedFilters.closeMonths, appliedFilters.gestionMonths]);

  const byUn = useMemo(() => Object.entries(summaryData?.charts?.by_un || {}).map(([label, value]) => ({ label, value: Number(value || 0) })).sort((a, b) => b.value - a.value).slice(0, 8), [summaryData]);
  const byTramo = useMemo(() => Object.entries(summaryData?.charts?.by_tramo || {}).map(([label, value]) => ({ label: `Tramo ${label}`, value: Number(value || 0) })).sort((a, b) => b.value - a.value).slice(0, 6), [summaryData]);
  const byVia = useMemo(() => Object.entries(summaryData?.charts?.by_via || {}).map(([label, value]) => ({ label: String(label), value: Number(value || 0) })).sort((a, b) => b.value - a.value), [summaryData]);
  const byContractYear = useMemo(() => {
    const rows = Object.entries(summaryData?.charts?.by_contract_year || {}).map(([label, value]) => ({ label: String(label), value: Number(value || 0) })).filter((x) => x.label && x.label !== "null");
    return yearSort === "asc" ? rows.sort((a, b) => a.value - b.value || Number(a.label) - Number(b.label)) : rows.sort((a, b) => b.value - a.value || Number(a.label) - Number(b.label));
  }, [summaryData, yearSort]);
  const vigMorByMonth = useMemo(() => {
    const raw = summaryData?.charts?.series_vigente_moroso_by_month || {};
    const months = expectedGestionMonths.length ? expectedGestionMonths : Object.keys(raw);
    return months.map((label) => ({ label, a: Number(raw[label]?.vigente || 0), b: Number(raw[label]?.moroso || 0) })).sort((a, b) => monthRank(a.label) - monthRank(b.label));
  }, [expectedGestionMonths, summaryData]);
  const viaByMonth = useMemo(() => {
    const raw = summaryData?.charts?.series_cobrador_debito_by_month || {};
    const months = expectedGestionMonths.length ? expectedGestionMonths : Object.keys(raw);
    return months.map((label) => ({ label, a: Number(raw[label]?.cobrador || 0), b: Number(raw[label]?.debito || 0) })).sort((a, b) => monthRank(a.label) - monthRank(b.label));
  }, [expectedGestionMonths, summaryData]);
  const missingGestionMonths = useMemo(() => {
    const available = new Set(Object.keys(summaryData?.charts?.series_vigente_moroso_by_month || {}));
    return expectedGestionMonths.filter((month) => !available.has(month));
  }, [expectedGestionMonths, summaryData]);
  const effectiveMeta = kpiSummaryData?.meta || summaryData?.meta || optionsData?.meta;
  const effectiveKpis = kpiSummaryData?.kpis || summaryData?.kpis;
  const totalContracts = Number(effectiveKpis?.total_cartera || 0);
  const totalAmount = Number(effectiveKpis?.monto_total_corte || 0);
  const vigentesTotal = Number(effectiveKpis?.vigentes_total || 0);
  const morososTotal = Number(effectiveKpis?.morosos_total || 0);
  const viaCobradorTotal = Number(effectiveKpis?.via_cobrador_total || 0);
  const viaDebitoTotal = Number(effectiveKpis?.via_debito_total || 0);

  const moveChart = useCallback((fromId: ChartId, toId: ChartId) => {
    if (fromId === toId) return;
    setChartOrder((prev) => { const fromIdx = prev.indexOf(fromId); const toIdx = prev.indexOf(toId); if (fromIdx < 0 || toIdx < 0) return prev; const next = [...prev]; next.splice(fromIdx, 1); next.splice(toIdx, 0, fromId); return next; });
  }, []);

  const moveKpi = useCallback((fromId: KpiId, toId: KpiId) => {
    if (fromId === toId) return;
    setKpiOrder((prev) => { const fromIdx = prev.indexOf(fromId); const toIdx = prev.indexOf(toId); if (fromIdx < 0 || toIdx < 0) return prev; const next = [...prev]; next.splice(fromIdx, 1); next.splice(toIdx, 0, fromId); return next; });
  }, []);

  const chartCards: Record<ChartId, { title: string; content: React.ReactElement }> = {
    series_vig_mor_month: { title: "Cartera por Gestión: Vigente vs Moroso", content: <StackedColumnChart data={vigMorByMonth} aLabel="Vigente" bLabel="Moroso" aColor="var(--color-state-ok)" bColor="var(--color-state-warn)" isLight={isLightTheme} labelZoomStorageKey="analisis_cartera_zoom_vig_mor_v1" /> },
    series_via_month: { title: "Cartera por Gestión: Cobrador vs Débito", content: <StackedColumnChart data={viaByMonth} aLabel="Cobrador" bLabel="Débito" aColor="var(--color-chart-1)" bColor="var(--color-chart-2)" isLight={isLightTheme} labelZoomStorageKey="analisis_cartera_zoom_via_v1" /> },
    by_un: { title: "Contratos por Unidad de Negocio", content: <BarChart data={byUn} isLight={isLightTheme} colors={chartPalette} /> },
    by_tramo: { title: "Contratos por Tramo", content: <DonutChart data={byTramo} isLight={isLightTheme} colors={chartPalette} /> },
    by_via: { title: "Contratos por Via de Cobro", content: <BarChart data={byVia} isLight={isLightTheme} colors={chartPalette} /> },
    by_contract_year: { title: "Contratos por Año de Contrato", content: <BarChart data={byContractYear} isLight={isLightTheme} colors={chartPalette} /> },
  };

  const kpiCards: Record<KpiId, { title: string; value: string; fullValue?: string; valueColor?: string; borderColor: string; icon: KpiIconId; isHero?: boolean; isZeroHint?: boolean }> = {
    total: { title: "TOTAL CONTRATOS", value: formatCount(totalContracts), borderColor: "var(--color-text-muted)", icon: "doc" },
    monto: {
      title: "MONTO TOTAL CORTE",
      value: showFullAmounts ? formatGsFull(totalAmount) : formatGsCompact(totalAmount),
      fullValue: formatGsFull(totalAmount),
      valueColor: "var(--color-chart-5)",
      borderColor: "var(--color-chart-5)",
      icon: "money",
      isHero: true,
    },
    vigentes: { title: "VIGENTES", value: formatCount(vigentesTotal), valueColor: "var(--color-state-ok)", borderColor: "var(--color-state-ok)", icon: "check" },
    morosos: { title: "MOROSOS", value: formatCount(morososTotal), valueColor: "var(--color-state-warn)", borderColor: "var(--color-state-warn)", icon: "alert", isZeroHint: true },
    cobrador: { title: "VÍA COBRADOR", value: formatCount(viaCobradorTotal), valueColor: "var(--color-chart-1)", borderColor: "var(--color-chart-1)", icon: "user" },
    debito: { title: "VÍA DÉBITO", value: formatCount(viaDebitoTotal), valueColor: "var(--color-chart-2)", borderColor: "var(--color-chart-2)", icon: "card" },
  };

  const activeFilterChips = useMemo<FilterChip[]>(() => {
    const blocks: Array<{ key: keyof Filters; label: string }> = [
      { key: "uns", label: "UN" }, { key: "supervisors", label: "Supervisor" }, { key: "years", label: "Año Contrato" },
      { key: "vias", label: "Vía de cobro" }, { key: "tramos", label: "Tramo" }, { key: "categorias", label: "Categoría" },
      { key: "gestionMonths", label: "Mes de gestión" }, { key: "closeMonths", label: "Mes de cierre" },
    ];
    return blocks.flatMap((b) => filters[b.key].map((value) => ({ key: b.key, label: b.label, value })));
  }, [filters]);

  const removeChip = useCallback((chip: FilterChip) => {
    setFilters((prev) => ({ ...prev, [chip.key]: (prev[chip.key as keyof Filters] as string[]).filter((item) => item !== chip.value) }));
  }, []);

  return (
    <section className="card analysis-card analysis-panel-card rendimiento-panel">
      <ToastStack items={toastQueue} onDismiss={dismissToast} />
      <AnalyticsPageHeader
        kicker="CARTERA"
        pill="Analytics v2"
        title="Analisis de cartera"
        subtitle="Corte de cartera por unidad de negocio, tramo, via de cobro, mes de gestion y mes de cierre."
        meta={<AnalyticsMetaBadges meta={effectiveMeta} />}
      />
      <MetricExplainer
        items={[
          {
            label: "Mes de gestion",
            formula: "gestion_month = cierre + 1 mes",
            note: "Los reportes operativos trabajan por gestion; no confundir con mes de cierre.",
          },
          {
            label: "Categorias por tramo",
            formula: "VIGENTE = 0..3 | MOROSO = >3",
            note: "La clasificacion visible en cartera debe respetar esta regla en todos los cortes.",
          },
          {
            label: "Monto a cobrar",
            formula: "monto_vencido + monto_cuota",
            note: "Monto vencido no es igual a monto a cobrar.",
          },
        ]}
      />
      {loadingOptions ? (
        <AnalysisFiltersSkeleton filterCount={8} kpiCount={6} showTable />
      ) : (
        <>
      <div className="rendimiento-filters-panel">
      <div className="analysis-filters-grid">
        <MultiSelectFilter className="analysis-filter-control" label="Unidad de negocio" options={options.uns || []} selected={filters.uns} onChange={(uns) => setFilters((f) => ({ ...f, uns }))} />
        <MultiSelectFilter className="analysis-filter-control" label="Supervisor" options={options.supervisors || []} selected={filters.supervisors} onChange={(supervisors) => setFilters((f) => ({ ...f, supervisors }))} />
        <MultiSelectFilter className="analysis-filter-control" label="Año de contrato" options={options.contract_years || []} selected={filters.years} onChange={(years) => setFilters((f) => ({ ...f, years }))} />
        <MultiSelectFilter className="analysis-filter-control" label="Vía de cobro" options={options.vias || []} selected={filters.vias} onChange={(vias) => setFilters((f) => ({ ...f, vias }))} />
        <MultiSelectFilter className="analysis-filter-control" label="Tramo" options={options.tramos || []} selected={filters.tramos} onChange={(tramos) => setFilters((f) => ({ ...f, tramos }))} />
        <MultiSelectFilter className="analysis-filter-control" label="Categoría" options={options.categories || []} selected={filters.categorias} onChange={(categorias) => setFilters((f) => ({ ...f, categorias }))} />
        <MultiSelectFilter className="analysis-filter-control" label="Mes de gestión" options={options.gestion_months || []} selected={filters.gestionMonths} onChange={(gestionMonths) => setFilters((f) => ({ ...f, gestionMonths }))} />
        <MultiSelectFilter className="analysis-filter-control" label="Mes de cierre" options={options.close_months || []} selected={filters.closeMonths} onChange={(closeMonths) => setFilters((f) => ({ ...f, closeMonths }))} />
      </div>
      <div className="rendimiento-filter-hints" role="note" aria-label="Ayuda de filtros">
        <span className="rendimiento-filter-hint">Mes de gestión usa `gestion_month`.</span>
        <span className="rendimiento-filter-hint">Mes de cierre no equivale a gestión.</span>
        <span className="rendimiento-filter-hint">ODONTOLOGIA TTO se mantiene separada de ODONTOLOGIA.</span>
      </div>
      <div className="analysis-actions-row analysis-actions">
        <Button variant="primary" onPress={() => void applyFilters()} isDisabled={loadingOptions || isApplyingFilters}>{isApplyingFilters ? <span className="inline-spinner" aria-hidden /> : null}{isApplyingFilters ? "Aplicando..." : "Aplicar filtros"}</Button>
        <Button variant="outline" onPress={clearFilters} isDisabled={loadingOptions || isApplyingFilters}>Limpiar</Button>
        <Button variant="outline" onPress={() => void resetDefaults()} isDisabled={loadingOptions || isApplyingFilters}>Restablecer</Button>
        <span className="analysis-active-count">
          {activeFilterChips.length} filtro{activeFilterChips.length === 1 ? "" : "s"} activo{activeFilterChips.length === 1 ? "" : "s"}
        </span>
        <label className="amount-toggle">
          <input
            type="checkbox"
            checked={showFullAmounts}
            onChange={(e) => setShowFullAmounts(e.target.checked)}
            disabled={loadingOptions || isApplyingFilters}
          />
          <span>Monto detallado</span>
        </label>
      </div>
      <div className="analysis-active-filters">
        <ActiveFilterChips chips={activeFilterChips} onRemove={removeChip} />
      </div>
      </div>
      {optionsError && (
        <ErrorState
          message={optionsError}
          onRetry={() => void loadOptions(filters)}
          retryLabel="Reintentar"
        />
      )}
      {!loadingSummary && summaryError && (
        <ErrorState
          message={summaryError}
          onRetry={() => void Promise.all([loadSummary(appliedFilters, "apply"), loadKpiSummary(appliedFilters)])}
          retryLabel="Reintentar"
        />
      )}

      {!summaryError && (
        <div className={`data-transition ${loadingSummary || loadingKpis ? "data-transition--loading" : ""}`}>
        <AnalysisSelectionSummary
          items={[
            { label: "UN", value: appliedFilters.uns.join(", ") || "Todas" },
            { label: "Año contrato", value: appliedFilters.years.join(", ") || "Todos" },
            { label: "Mes de gestión", value: appliedFilters.gestionMonths.join(", ") || "Todos" },
            { label: "Mes de cierre", value: appliedFilters.closeMonths.join(", ") || "Todos" },
            { label: "Vía de cobro", value: appliedFilters.vias.join(", ") || "Todas" },
            { label: "Supervisor", value: appliedFilters.supervisors.join(", ") || "Todos" },
            { label: "Categoría", value: appliedFilters.categorias.join(", ") || "Todas" },
            { label: "Tramo", value: appliedFilters.tramos.join(", ") || "Todos" },
          ]}
        />
        {!loadingSummary && !loadingKpis && totalContracts === 0 ? (
          <EmptyState
            message="No hay datos para la combinación seleccionada."
            suggestion="Ajusta mes de gestión, mes de cierre, categoría o unidad de negocio y vuelve a aplicar filtros."
            className="analysis-empty"
          />
        ) : null}
        <SegmentedControl
          className="kpi-mode-toggle"
          label="Criterio de KPIs"
          options={[
            { value: "last_close", label: "Usar último cierre de la selección" },
            { value: "filters", label: "Usar filtros (acumulado)" },
          ]}
          value={kpiMode}
          onChange={(v) => setKpiMode(v as KpiMode)}
          isDisabled={isApplyingFilters}
          size="md"
          fullWidth={false}
          aria-label="Criterio de KPIs: último cierre o filtros acumulados"
        />
        {loadingSummary || loadingKpis ? <LoadingState message="Cargando resumen..." className="summary-loading-note" /> : null}
        {!loadingSummary && missingGestionMonths.length > 0 ? (
          <div className="analysis-inline-note">
            Faltaban meses sin datos reales en la serie y se completaron en cero: {missingGestionMonths.join(", ")}.
          </div>
        ) : null}
        <div className={`summary-grid ${loadingSummary || loadingKpis ? "summary-grid-loading" : ""}`}>
          {kpiOrder.map((kpiId) => {
            const k = kpiCards[kpiId];
            if (loadingSummary || loadingKpis) {
              return (
                <article key={`s-${kpiId}`} className={`card kpi-card analysis-card-pad ${k.isHero ? "kpi-card-hero" : ""}`}>
                  <Skeleton className="kpi-skeleton kpi-skeleton-heroui" animationType="shimmer" />
                </article>
              );
            }
            return (
              <article
                key={kpiId}
                className={`card kpi-card analysis-card-pad ${k.isHero ? "kpi-card-hero" : ""} ${dragOverKpi === kpiId ? "chart-drop-target" : ""} ${draggingKpi === kpiId ? "dragging-card" : ""}`}
                style={{ borderLeft: `4px solid ${k.borderColor}` }}
                draggable
                onDragStart={(e) => {
                  setDraggingKpi(kpiId);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", kpiId);
                }}
                onDragEnd={() => {
                  setDraggingKpi(null);
                  setDragOverKpi(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggingKpi && draggingKpi !== kpiId) setDragOverKpi(kpiId);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromId = (e.dataTransfer.getData("text/plain") || draggingKpi || "") as KpiId;
                  if (fromId) moveKpi(fromId, kpiId);
                  setDraggingKpi(null);
                  setDragOverKpi(null);
                }}
              >
                <div className="chart-card-header">
                  <div className="kpi-card-title-wrap">
                    <span className="kpi-card-icon" aria-hidden><KpiIcon icon={k.icon} /></span>
                    <span className="analysis-kpi-title">{k.title}</span>
                  </div>
                  <span className="chart-drag-handle" title="Arrastrar para reordenar" aria-hidden>::</span>
                </div>
                <div
                  className="kpi-card-value"
                  style={{ color: k.valueColor || "var(--color-text)" }}
                  title={k.fullValue || k.value}
                  aria-label={k.fullValue || k.value}
                >
                  {k.value}
                </div>
                {k.isZeroHint && morososTotal === 0 ? (
                  <div className="kpi-zero-hint">Sin casos</div>
                ) : null}
              </article>
            );
          })}
        </div>
        <div className={`charts-grid ${loadingSummary ? "summary-grid-loading" : ""}`}>
          {chartOrder.map((chartId) => {
            const card = chartCards[chartId];
            const isWideStacked = chartId === "series_vig_mor_month" || chartId === "series_via_month";
            return (
              <article key={chartId} className={`card chart-card analysis-card-pad ${isWideStacked ? "chart-card-wide" : ""} ${dragOverChart === chartId ? "chart-drop-target" : ""} ${draggingChart === chartId ? "dragging-card" : ""}`} draggable onDragStart={(e) => { setDraggingChart(chartId); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", chartId); }} onDragEnd={() => { setDraggingChart(null); setDragOverChart(null); }} onDragOver={(e) => { e.preventDefault(); if (draggingChart && draggingChart !== chartId) setDragOverChart(chartId); }} onDrop={(e) => { e.preventDefault(); const fromId = (e.dataTransfer.getData("text/plain") || draggingChart || "") as ChartId; if (fromId) moveChart(fromId, chartId); setDraggingChart(null); setDragOverChart(null); }}>
                <div className="chart-card-header">
                  <h3 className="analysis-chart-title">{card.title}</h3>
                  <div className="analysis-chart-actions">
                    {chartId === "by_contract_year" && <Button size="sm" variant="outline" className="analysis-sort-btn" onPress={() => setYearSort((prev) => (prev === "desc" ? "asc" : "desc"))} aria-label="Ordenar por cantidad">{yearSort === "desc" ? "Mayor->Menor" : "Menor->Mayor"}</Button>}
                    <span className="chart-drag-handle" title="Arrastrar para reordenar" aria-hidden>::</span>
                  </div>
                </div>
                {card.content}
              </article>
            );
          })}
        </div>
        </div>
      )}
        </>
      )}
    </section>
  );
}
