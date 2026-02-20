import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MultiSelectFilter } from "../../components/filters/MultiSelectFilter";
import { ActiveFilterChips, type FilterChip } from "../../components/filters/ActiveFilterChips";
import { ToastStack, type ToastMessage, type ToastType } from "../../components/feedback/ToastStack";
import {
  getPortfolioCorteOptions,
  getPortfolioCorteSummary,
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
const CHART_COLORS = ["#42b9ee", "#8b8eff", "#9c7df2", "#4dd7a4", "#f8d34f", "#ff9b6a", "#67a4ff"];
const CHART_COLORS_LIGHT = ["#0ea5e9", "#6366f1", "#8b5cf6", "#22c55e", "#f59e0b", "#f97316", "#3b82f6"];
const STORAGE_KPI_MODE = "analisis_cartera_kpi_mode_v1";

const formatPct = (value: number, total: number) => `${((Number(value || 0) / Math.max(1, Number(total || 0))) * 100).toFixed(1)}%`;

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
  const visible = data.filter((d) => !hidden[d.label]);
  const total = visible.reduce((a, b) => a + b.value, 0) || 1;
  let acc = 0;
  const legendTextColor = isLight ? "#0f172a" : "var(--color-text)";
  const legendHiddenColor = isLight ? "#64748b" : "var(--color-text-muted)";

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
    <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
      <svg width="210" height="210" viewBox="0 0 210 210" role="img" aria-label="Contratos por tramo">
        <g transform="translate(105,105)">
          {visible.map((d, idx) => {
            const start = (acc / total) * Math.PI * 2;
            acc += d.value;
            const end = (acc / total) * Math.PI * 2;
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
            return <path key={d.label} d={path} fill={colors[idx % colors.length]} />;
          })}
          <circle r="40" fill={isLight ? "rgba(255,255,255,0.9)" : "var(--color-surface-elevated)"} />
        </g>
      </svg>
      <div style={{ fontSize: "0.85rem" }}>
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
            >
              <span style={{ width: 12, height: 12, background: colors[idx % colors.length], borderRadius: 2 }} />
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
  const textColor = isLight ? "#0f172a" : "var(--color-text)";
  const textMutedColor = isLight ? "#64748b" : "var(--color-text-muted)";
  const trackBg = isLight ? "rgba(15,23,42,0.14)" : "var(--chart-grid)";

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
    <div style={{ display: "grid", gap: "0.45rem" }}>
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
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "0.15rem" }}>
              <span style={{ textDecoration: isHidden ? "line-through" : "none" }}>{d.label}</span>
              <span>{formatCount(d.value)} ({formatPct(d.value, total)})</span>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: trackBg }}>
              <div style={{ width: `${widthPct}%`, height: "100%", borderRadius: 999, background: colors[idx % colors.length] }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function LegacyStackedColumnChart({
  data,
  aLabel,
  bLabel,
  aColor = "#42b9ee",
  bColor = "#f5a623",
  isLight = false,
}: {
  data: Array<{ label: string; a: number; b: number }>;
  aLabel: string;
  bLabel: string;
  aColor?: string;
  bColor?: string;
  isLight?: boolean;
}) {
  const [hidden, setHidden] = useState<{ a: boolean; b: boolean }>({ a: false, b: false });
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const maxY = Math.max(1, ...data.map((d) => (hidden.a ? 0 : Number(d.a || 0)) + (hidden.b ? 0 : Number(d.b || 0))));
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(maxY * r));
  const chartHeight = 300;
  const barWidth = 10;
  const barGap = 4;
  const minChartWidth = Math.max(620, data.length * (barWidth + barGap) + 24);
  const barTotalPct = (value: number) => Math.max(0, Math.min(100, (value / Math.max(1, maxY)) * 100));
  const axisTextColor = isLight ? "#334155" : "var(--color-text-muted)";
  const legendTextColor = isLight ? "#0f172a" : "var(--color-text)";
  const legendWeight = isLight ? 600 : 500;
  const axisBorder = isLight ? "1.2px solid var(--chart-grid)" : "1px solid var(--chart-grid)";

  return (
    <div style={{ display: "grid", gap: "0.45rem" }}>
      <div style={{ display: "flex", gap: "0.85rem", fontSize: "0.8rem", marginBottom: "0.2rem" }}>
        <button type="button" onClick={() => setHidden((s) => ({ ...s, a: !s.a }))} style={{ background: "transparent", border: "none", color: hidden.a ? axisTextColor : legendTextColor, cursor: "pointer", textDecoration: hidden.a ? "line-through" : "none", padding: 0, fontWeight: legendWeight }} title={hidden.a ? "Mostrar serie" : "Ocultar serie"}>
          <span style={{ display: "inline-block", width: 9, height: 9, background: aColor, marginRight: 6, borderRadius: 2 }} />{aLabel}
        </button>
        <button type="button" onClick={() => setHidden((s) => ({ ...s, b: !s.b }))} style={{ background: "transparent", border: "none", color: hidden.b ? axisTextColor : legendTextColor, cursor: "pointer", textDecoration: hidden.b ? "line-through" : "none", padding: 0, fontWeight: legendWeight }} title={hidden.b ? "Mostrar serie" : "Ocultar serie"}>
          <span style={{ display: "inline-block", width: 9, height: 9, background: bColor, marginRight: 6, borderRadius: 2 }} />{bLabel}
        </button>
      </div>
      <div style={{ height: 34, display: "flex", flexWrap: "nowrap", alignItems: "center", gap: "0.55rem", fontSize: "0.78rem", color: axisTextColor, marginBottom: "0.2rem", overflow: "hidden", whiteSpace: "nowrap" }}>
        {(() => {
          if (!hoveredLabel) return <span style={{ opacity: 0.75 }}>Pasa el mouse sobre una barra para ver porcentajes</span>;
          const row = data.find((d) => d.label === hoveredLabel);
          const a = hidden.a ? 0 : Number(row?.a || 0);
          const b = hidden.b ? 0 : Number(row?.b || 0);
          const total = Math.max(1, a + b);
          const aPct = ((a / total) * 100).toFixed(1);
          const bPct = ((b / total) * 100).toFixed(1);
          return (
            <>
              <span style={{ color: isLight ? "#0f172a" : "var(--color-text)", flex: "0 0 auto" }}>{hoveredLabel}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: isLight ? "#f8fafc" : "transparent", border: isLight ? "1px solid rgba(15,23,42,0.18)" : "none", borderRadius: 999, padding: isLight ? "0.1rem 0.45rem" : 0, color: isLight ? "#0f172a" : "var(--color-text)", flex: "0 0 auto" }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: aColor }} />
                {aLabel}: {aPct}%
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: isLight ? "#f8fafc" : "transparent", border: isLight ? "1px solid rgba(15,23,42,0.18)" : "none", borderRadius: 999, padding: isLight ? "0.1rem 0.45rem" : 0, color: isLight ? "#0f172a" : "var(--color-text)", flex: "0 0 auto" }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: bColor }} />
                {bLabel}: {bPct}%
              </span>
            </>
          );
        })()}
      </div>
      <div style={{ overflowX: "auto", paddingBottom: "0.35rem" }}>
        <div style={{ minWidth: minChartWidth, display: "grid", gridTemplateColumns: "56px 1fr", gap: "0.35rem" }}>
          <div style={{ position: "relative", height: chartHeight }}>
            {yTicks.map((tick, idx) => <div key={tick} style={{ position: "absolute", left: 0, right: 0, bottom: `${(idx / (yTicks.length - 1)) * 100}%`, transform: "translateY(50%)", fontSize: "0.72rem", color: axisTextColor }}>{formatCount(tick)}</div>)}
          </div>
          <div style={{ position: "relative", height: chartHeight, borderLeft: axisBorder, borderBottom: axisBorder, display: "flex", alignItems: "flex-end", gap: `${barGap}px`, padding: "0", width: "100%" }}>
            {yTicks.map((tick, idx) => <div key={`grid-${tick}`} style={{ position: "absolute", left: 0, right: 0, bottom: `${(idx / (yTicks.length - 1)) * 100}%`, borderTop: "1px solid var(--chart-grid-soft)" }} />)}
            {data.map((d) => {
              const a = hidden.a ? 0 : Number(d.a || 0);
              const b = hidden.b ? 0 : Number(d.b || 0);
              const aPct = barTotalPct(a);
              const bPct = barTotalPct(b);
              const isHovered = hoveredLabel === d.label;
              const canSeparate = isHovered && aPct > 0 && bPct > 0;
              return (
                <div
                  key={d.label}
                  onMouseEnter={() => setHoveredLabel(d.label)}
                  onMouseLeave={() => setHoveredLabel((prev) => (prev === d.label ? null : prev))}
                  style={{ flex: "1 1 0", minWidth: `${barWidth}px`, height: "100%", position: "relative", cursor: "pointer", overflow: "visible" }}
                  title={`${d.label} | ${aLabel}: ${formatCount(a)} | ${bLabel}: ${formatCount(b)} | Total: ${formatCount(a + b)}`}
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
                        transform: "scaleX(1) translateY(0)",
                        transformOrigin: "center top",
                        filter: "none",
                        transition: "transform 260ms cubic-bezier(0.22, 1, 0.36, 1), filter 260ms ease",
                        willChange: "transform, filter",
                        pointerEvents: "none",
                      }}
                    />
                  )}
                  {bPct > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: `calc(${aPct}% - 1px)`,
                        height: `${bPct}%`,
                        background: bColor,
                        transform: canSeparate ? "scaleX(0.84) translateY(-8px)" : "scaleX(1) translateY(0)",
                        transformOrigin: "center bottom",
                        filter: canSeparate ? "brightness(1.07) saturate(1.03)" : "none",
                        transition: "transform 340ms cubic-bezier(0.22, 1, 0.36, 1), filter 340ms ease",
                        willChange: "transform, filter",
                        pointerEvents: "none",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div />
          <div style={{ display: "flex", alignItems: "flex-start", gap: `${barGap}px`, padding: "0", minHeight: 54 }}>
            {data.map((d) => <div key={`lbl-${d.label}`} style={{ flex: "1 1 0", minWidth: `${barWidth}px`, fontSize: "0.62rem", color: axisTextColor, writingMode: "vertical-rl", transform: "rotate(180deg)", textAlign: "left" }}>{d.label}</div>)}
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

  const toPayload = useCallback((next: Filters) => ({
    supervisor: next.supervisors,
    un: next.uns,
    via_cobro: next.vias,
    anio: next.years,
    contract_month: next.gestionMonths,
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
          const optionsRes = await getPortfolioCorteOptions(toPayload(next));
          const availableCloseMonths = optionsRes?.options?.close_months || [];
          lastMonth = getLatestCloseMonth(availableCloseMonths);
        }
        if (lastMonth) {
          payloadFilters = {
            ...next,
            closeMonths: [lastMonth],
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
  }, [getLatestCloseMonth, kpiMode, pushToast, toPayload]);

  useEffect(() => { void loadOptions(filters); }, [loadOptions]);
  useEffect(() => {
    if (!optionsReady || summaryData) return;
    void Promise.all([loadSummary(appliedFilters, "initial"), loadKpiSummary(appliedFilters)]);
  }, [optionsReady, summaryData, loadSummary, loadKpiSummary, appliedFilters]);

  useEffect(() => {
    if (!optionsReady || !summaryData) return;
    void loadKpiSummary(appliedFilters);
  }, [kpiMode, appliedFilters, optionsReady, summaryData, loadKpiSummary]);

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
  const byUn = useMemo(() => Object.entries(summaryData?.charts?.by_un || {}).map(([label, value]) => ({ label, value: Number(value || 0) })).sort((a, b) => b.value - a.value).slice(0, 8), [summaryData]);
  const byTramo = useMemo(() => Object.entries(summaryData?.charts?.by_tramo || {}).map(([label, value]) => ({ label: `Tramo ${label}`, value: Number(value || 0) })).sort((a, b) => b.value - a.value).slice(0, 6), [summaryData]);
  const byVia = useMemo(() => Object.entries(summaryData?.charts?.by_via || {}).map(([label, value]) => ({ label: String(label), value: Number(value || 0) })).sort((a, b) => b.value - a.value), [summaryData]);
  const byContractYear = useMemo(() => {
    const rows = Object.entries(summaryData?.charts?.by_contract_year || {}).map(([label, value]) => ({ label: String(label), value: Number(value || 0) })).filter((x) => x.label && x.label !== "null");
    return yearSort === "asc" ? rows.sort((a, b) => a.value - b.value || Number(a.label) - Number(b.label)) : rows.sort((a, b) => b.value - a.value || Number(a.label) - Number(b.label));
  }, [summaryData, yearSort]);
  const vigMorByMonth = useMemo(() => Object.entries(summaryData?.charts?.series_vigente_moroso_by_month || {}).map(([label, val]) => ({ label, a: Number(val?.vigente || 0), b: Number(val?.moroso || 0) })).sort((a, b) => monthRank(a.label) - monthRank(b.label)), [summaryData]);
  const viaByMonth = useMemo(() => Object.entries(summaryData?.charts?.series_cobrador_debito_by_month || {}).map(([label, val]) => ({ label, a: Number(val?.cobrador || 0), b: Number(val?.debito || 0) })).sort((a, b) => monthRank(a.label) - monthRank(b.label)), [summaryData]);
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

  const chartCards: Record<ChartId, { title: string; content: JSX.Element }> = {
    series_vig_mor_month: { title: "Cartera por Gestion: Vigente vs Moroso", content: <LegacyStackedColumnChart data={vigMorByMonth} aLabel="Vigente" bLabel="Moroso" aColor={isLightTheme ? "#22c55e" : "#31d17c"} bColor={isLightTheme ? "#f59e0b" : "#f5a623"} isLight={isLightTheme} /> },
    series_via_month: { title: "Cartera por Gestion: Cobrador vs Debito", content: <LegacyStackedColumnChart data={viaByMonth} aLabel="Cobrador" bLabel="Debito" aColor={isLightTheme ? "#0ea5e9" : "#42b9ee"} bColor={isLightTheme ? "#6366f1" : "#8b8eff"} isLight={isLightTheme} /> },
    by_un: { title: "Contratos por Unidad de Negocio", content: <BarChart data={byUn} isLight={isLightTheme} colors={chartPalette} /> },
    by_tramo: { title: "Contratos por Tramo", content: <DonutChart data={byTramo} isLight={isLightTheme} colors={chartPalette} /> },
    by_via: { title: "Contratos por Via de Cobro", content: <BarChart data={byVia} isLight={isLightTheme} colors={chartPalette} /> },
    by_contract_year: { title: "Contratos por Ano de Contrato", content: <BarChart data={byContractYear} isLight={isLightTheme} colors={chartPalette} /> },
  };

  const kpiCards: Record<KpiId, { title: string; value: string; fullValue?: string; valueColor?: string; borderColor: string; icon: KpiIconId; isHero?: boolean; isZeroHint?: boolean }> = {
    total: { title: "TOTAL CONTRATOS", value: formatCount(totalContracts), borderColor: "#8ca8c9", icon: "doc" },
    monto: {
      title: "MONTO TOTAL CORTE",
      value: showFullAmounts ? formatGsFull(totalAmount) : formatGsCompact(totalAmount),
      fullValue: formatGsFull(totalAmount),
      valueColor: "#f4c84a",
      borderColor: "#f4c84a",
      icon: "money",
      isHero: true,
    },
    vigentes: { title: "VIGENTES", value: formatCount(vigentesTotal), valueColor: "#50d3a5", borderColor: "#50d3a5", icon: "check" },
    morosos: { title: "MOROSOS", value: formatCount(morososTotal), valueColor: "#9b86e8", borderColor: "#9b86e8", icon: "alert", isZeroHint: true },
    cobrador: { title: "VIA COBRADOR", value: formatCount(viaCobradorTotal), valueColor: "#49b5e9", borderColor: "#49b5e9", icon: "user" },
    debito: { title: "VIA DEBITO", value: formatCount(viaDebitoTotal), valueColor: "#7f86ef", borderColor: "#7f86ef", icon: "card" },
  };

  const activeFilterChips = useMemo<FilterChip[]>(() => {
    const blocks: Array<{ key: keyof Filters; label: string }> = [
      { key: "uns", label: "UN" }, { key: "supervisors", label: "Supervisor" }, { key: "years", label: "Ano Contrato" },
      { key: "vias", label: "Via" }, { key: "tramos", label: "Tramo" }, { key: "categorias", label: "Categoria" },
      { key: "gestionMonths", label: "Gestion" }, { key: "closeMonths", label: "Cierre" },
    ];
    return blocks.flatMap((b) => filters[b.key].map((value) => ({ key: b.key, label: b.label, value })));
  }, [filters]);

  const removeChip = useCallback((chip: FilterChip) => {
    setFilters((prev) => ({ ...prev, [chip.key]: (prev[chip.key as keyof Filters] as string[]).filter((item) => item !== chip.value) }));
  }, []);

  return (
    <section className="card analysis-card">
      <ToastStack items={toastQueue} onDismiss={dismissToast} />
      <h2>Analisis de Cartera</h2>
      <div className="filters-grid analysis-filters-grid">
        <MultiSelectFilter label="Unidad de Negocio" options={options.uns || []} selected={filters.uns} onChange={(uns) => setFilters((f) => ({ ...f, uns }))} />
        <MultiSelectFilter label="Supervisor" options={options.supervisors || []} selected={filters.supervisors} onChange={(supervisors) => setFilters((f) => ({ ...f, supervisors }))} />
        <MultiSelectFilter label="Ano de Contrato" options={options.contract_years || []} selected={filters.years} onChange={(years) => setFilters((f) => ({ ...f, years }))} />
        <MultiSelectFilter label="Via de Cobro" options={options.vias || []} selected={filters.vias} onChange={(vias) => setFilters((f) => ({ ...f, vias }))} />
        <MultiSelectFilter label="Tramo" options={options.tramos || []} selected={filters.tramos} onChange={(tramos) => setFilters((f) => ({ ...f, tramos }))} />
        <MultiSelectFilter label="Categoria" options={options.categories || []} selected={filters.categorias} onChange={(categorias) => setFilters((f) => ({ ...f, categorias }))} />
        <MultiSelectFilter label="Fecha de Gestion" options={options.gestion_months || []} selected={filters.gestionMonths} onChange={(gestionMonths) => setFilters((f) => ({ ...f, gestionMonths }))} />
        <MultiSelectFilter label="Fecha de Cierre" options={options.close_months || []} selected={filters.closeMonths} onChange={(closeMonths) => setFilters((f) => ({ ...f, closeMonths }))} />
      </div>
      <div className="analysis-actions-row">
        <button type="button" className="btn btn-primary" onClick={() => void applyFilters()} disabled={loadingOptions || isApplyingFilters}>{isApplyingFilters ? <span className="inline-spinner" aria-hidden /> : null}{isApplyingFilters ? "Aplicando..." : "Aplicar filtros"}</button>
        <button type="button" className="btn btn-secondary" onClick={clearFilters} disabled={loadingOptions || isApplyingFilters}>Limpiar filtros</button>
        <button type="button" className="btn btn-ghost" onClick={() => void resetDefaults()} disabled={loadingOptions || isApplyingFilters}>Resetear default</button>
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
      <ActiveFilterChips chips={activeFilterChips} onRemove={removeChip} />
      {isInitialOptionsLoading && <div className="analysis-skeleton-wrap" aria-live="polite" aria-busy="true"><div className="analysis-skeleton-grid"><div className="analysis-skeleton-input" /><div className="analysis-skeleton-input" /><div className="analysis-skeleton-input" /><div className="analysis-skeleton-input" /><div className="analysis-skeleton-input" /><div className="analysis-skeleton-input" /></div><div className="analysis-skeleton-summary"><div className="analysis-skeleton-kpi" /><div className="analysis-skeleton-kpi" /></div></div>}
      {loadingOptions && !isInitialOptionsLoading && <p>Cargando filtros...</p>}
      {!loadingOptions && optionsError && <div className="alert-error">{optionsError}</div>}
      {!loadingSummary && summaryError && (
        <div className="alert-error" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.8rem", flexWrap: "wrap" }}>
          <span>{summaryError}</span>
          <button type="button" className="btn btn-secondary" onClick={() => void Promise.all([loadSummary(appliedFilters, "apply"), loadKpiSummary(appliedFilters)])}>
            Reintentar
          </button>
        </div>
      )}

      {!summaryError && <>
        <div className="selection-summary">Seleccion actual: UN: {appliedFilters.uns.join(", ") || "Todas"} | Ano contrato: {appliedFilters.years.join(", ") || "Todos"} | Gestion: {appliedFilters.gestionMonths.join(", ") || "Todos"} | Cierre: {appliedFilters.closeMonths.join(", ") || "Todos"} | Via: {appliedFilters.vias.join(", ") || "Todas"} | Supervisor: {appliedFilters.supervisors.join(", ") || "Todos"} | Categoria: {appliedFilters.categorias.join(", ") || "Todas"} | Tramo: {appliedFilters.tramos.join(", ") || "Todos"}</div>
        {!loadingSummary && !loadingKpis && totalContracts === 0 ? (
          <div className="analysis-empty">
            No hay datos para la combinacion seleccionada. Ajusta filtros y vuelve a aplicar.
          </div>
        ) : null}
        <div className="kpi-mode-toggle">
          <button
            type="button"
            className={`btn btn-secondary ${kpiMode === "last_close" ? "active" : ""}`}
            onClick={() => setKpiMode("last_close")}
            disabled={isApplyingFilters}
          >
            Usar ultimo cierre de la seleccion
          </button>
          <button
            type="button"
            className={`btn btn-secondary ${kpiMode === "filters" ? "active" : ""}`}
            onClick={() => setKpiMode("filters")}
            disabled={isApplyingFilters}
          >
            Usar filtros (acumulado)
          </button>
        </div>
        {loadingSummary || loadingKpis ? <div className="summary-loading-note">Cargando resumen...</div> : null}
        <div className={`summary-grid ${loadingSummary || loadingKpis ? "summary-grid-loading" : ""}`}>
          {kpiOrder.map((kpiId) => {
            const k = kpiCards[kpiId];
            if (loadingSummary || loadingKpis) {
              return (
                <article key={`s-${kpiId}`} className={`card kpi-card ${k.isHero ? "kpi-card-hero" : ""}`} style={{ padding: "1rem" }}>
                  <div className="kpi-skeleton" />
                </article>
              );
            }
            return (
              <article
                key={kpiId}
                className={`card kpi-card ${k.isHero ? "kpi-card-hero" : ""} ${dragOverKpi === kpiId ? "chart-drop-target" : ""} ${draggingKpi === kpiId ? "dragging-card" : ""}`}
                style={{ padding: "1rem", borderLeft: `4px solid ${k.borderColor}` }}
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
                    <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", fontWeight: 600 }}>{k.title}</span>
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
              <article key={chartId} className={`card chart-card ${isWideStacked ? "chart-card-wide" : ""} ${dragOverChart === chartId ? "chart-drop-target" : ""} ${draggingChart === chartId ? "dragging-card" : ""}`} style={{ padding: "1rem" }} draggable onDragStart={(e) => { setDraggingChart(chartId); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", chartId); }} onDragEnd={() => { setDraggingChart(null); setDragOverChart(null); }} onDragOver={(e) => { e.preventDefault(); if (draggingChart && draggingChart !== chartId) setDragOverChart(chartId); }} onDrop={(e) => { e.preventDefault(); const fromId = (e.dataTransfer.getData("text/plain") || draggingChart || "") as ChartId; if (fromId) moveChart(fromId, chartId); setDraggingChart(null); setDragOverChart(null); }}>
                <div className="chart-card-header">
                  <h3 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "1rem" }}>{card.title}</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    {chartId === "by_contract_year" && <button type="button" className="btn btn-secondary" style={{ padding: "0.2rem 0.45rem", fontSize: "0.72rem" }} onClick={() => setYearSort((prev) => (prev === "desc" ? "asc" : "desc"))} title="Ordenar por cantidad">{yearSort === "desc" ? "Mayor->Menor" : "Menor->Mayor"}</button>}
                    <span className="chart-drag-handle" title="Arrastrar para reordenar" aria-hidden>::</span>
                  </div>
                </div>
                {card.content}
              </article>
            );
          })}
        </div>
      </>}
    </section>
  );
}

