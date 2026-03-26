import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@heroui/react";
import { AnalyticsMetaBadges } from "../../components/analytics/AnalyticsMetaBadges";
import { AnalyticsPageHeader } from "../../components/analytics/AnalyticsPageHeader";
import { AnalysisSelectionSummary } from "../../components/analytics/AnalysisSelectionSummary";
import { MetricExplainer } from "../../components/analytics/MetricExplainer";
import { MultiSelectFilter } from "../../components/filters/MultiSelectFilter";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { LoadingState } from "../../components/feedback/LoadingState";
import {
  getPortfolioCorteOptions,
  getPortfolioRoloSummary,
  type PortfolioCorteOptionsResponse,
  type PortfolioRoloSummaryResponse,
} from "../../shared/api";
import { getApiErrorMessage } from "../../shared/apiErrors";
import { useIsLightTheme } from "../../shared/useIsLightTheme";
import { formatCount } from "../../shared/formatters";

type Filters = {
  closeMonths: string[];
  uns: string[];
  supervisors: string[];
  vias: string[];
  years: string[];
};

const DEFAULT_FILTERS: Filters = {
  closeMonths: [],
  uns: [],
  supervisors: [],
  vias: [],
  years: [],
};

function RoloContributionChart({
  rows,
  isLight,
}: {
  rows: NonNullable<PortfolioRoloSummaryResponse["rows"]>;
  isLight: boolean;
}) {
  const max = Math.max(1, ...rows.map((row) => Math.abs(Number(row.neto_rolo || 0))));
  const trackBg = "var(--chart-grid)";
  return (
    <div className={`analysis-bars-wrap ${isLight ? "analysis-bars-wrap--light" : ""}`.trim()}>
      {rows.map((row) => {
        const value = Number(row.neto_rolo || 0);
        const widthPct = Math.max(6, Math.round((Math.abs(value) / max) * 100));
        const color = value > 0 ? "var(--color-state-ok)" : value < 0 ? "var(--color-state-error)" : "var(--color-text-muted)";
        return (
          <div key={row.un}>
            <div className="analysis-bars-row-meta">
              <span>{row.un}</span>
              <span>{value > 0 ? "+" : ""}{formatCount(value)}</span>
            </div>
            <div className="analysis-bars-track" style={{ background: trackBg }}>
              <div className="analysis-bars-fill" style={{ width: `${widthPct}%`, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RoloCompositionChart({
  kpis,
  isLight,
}: {
  kpis: NonNullable<PortfolioRoloSummaryResponse["kpis"]>;
  isLight: boolean;
}) {
  const items = [
    { label: "Vigente inicial", value: Number(kpis.vigente_inicial || 0), tone: "var(--color-text-muted)" },
    { label: "Ventas nuevas", value: Number(kpis.ventas_nuevas || 0), tone: "var(--color-chart-1)" },
    { label: "Recuperados", value: Number(kpis.recuperados_a_vigente || 0), tone: "var(--color-state-ok)" },
    { label: "Culminados vig.", value: -Number(kpis.culminados_vigentes || 0), tone: "var(--color-chart-2)" },
    { label: "Caídos a moroso", value: -Number(kpis.caidos_a_moroso || 0), tone: "var(--color-state-error)" },
    { label: "Neto", value: Number(kpis.neto_rolo || 0), tone: "var(--color-primary)" },
    { label: "Vigente final", value: Number(kpis.vigente_final || 0), tone: "var(--color-chart-5)" },
  ];
  const max = Math.max(1, ...items.map((item) => Math.abs(item.value)));
  const trackBg = "var(--chart-grid)";
  return (
    <div className={`analysis-bars-wrap ${isLight ? "analysis-bars-wrap--light" : ""}`.trim()}>
      {items.map((item) => {
        const widthPct = Math.max(6, Math.round((Math.abs(item.value) / max) * 100));
        return (
          <div key={item.label}>
            <div className="analysis-bars-row-meta">
              <span>{item.label}</span>
              <span style={{ color: item.tone }}>{item.value > 0 ? "+" : ""}{formatCount(item.value)}</span>
            </div>
            <div className="analysis-bars-track" style={{ background: trackBg }}>
              <div className="analysis-bars-fill" style={{ width: `${widthPct}%`, background: item.tone }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SignedCount({ value }: { value: number }) {
  const sign = value > 0 ? "+" : "";
  const tone = value > 0 ? "var(--color-state-ok)" : value < 0 ? "var(--color-state-error)" : "var(--color-text)";
  return <span style={{ color: tone }}>{`${sign}${formatCount(value)}`}</span>;
}

export function AnalisisRoloCarteraView() {
  const isLightTheme = useIsLightTheme();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [isFloatingFiltersOpen, setIsFloatingFiltersOpen] = useState(false);
  const [floatingCloseMonths, setFloatingCloseMonths] = useState<string[]>([]);
  const [floatingUns, setFloatingUns] = useState<string[]>([]);
  const [floatingPosition, setFloatingPosition] = useState<{ left: number; top: number } | null>(null);
  const [isClient, setIsClient] = useState(false);
  const floatingWrapRef = useRef<HTMLDivElement | null>(null);
  const [optionsData, setOptionsData] = useState<PortfolioCorteOptionsResponse | null>(null);
  const [summaryData, setSummaryData] = useState<PortfolioRoloSummaryResponse | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const toPayload = useCallback(
    (source: Filters) => ({
      close_month: source.closeMonths,
      un: source.uns,
      supervisor: source.supervisors,
      via_cobro: source.vias,
      anio: source.years,
    }),
    [],
  );

  const loadOptions = useCallback(async () => {
    try {
      setLoadingOptions(true);
      setOptionsError(null);
      const data = await getPortfolioCorteOptions({});
      setOptionsData(data);
      const latestClose = [...(data.options.close_months || [])]
        .sort((a, b) => {
          const [am, ay] = a.split("/").map(Number);
          const [bm, by] = b.split("/").map(Number);
          return ay * 100 + am - (by * 100 + bm);
        })
        .pop();
      if (latestClose) {
        const nextFilters = { ...DEFAULT_FILTERS, closeMonths: [latestClose] };
        setFilters(nextFilters);
        setAppliedFilters(nextFilters);
      }
    } catch (error) {
      setOptionsError(getApiErrorMessage(error));
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  const loadSummary = useCallback(async (source: Filters) => {
    try {
      setLoadingSummary(true);
      setSummaryError(null);
      const data = await getPortfolioRoloSummary(toPayload(source));
      setSummaryData(data);
    } catch (error) {
      setSummaryError(getApiErrorMessage(error));
    } finally {
      setLoadingSummary(false);
    }
  }, [toPayload]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    if (!appliedFilters.closeMonths.length) return;
    void loadSummary(appliedFilters);
  }, [appliedFilters, loadSummary]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const applyMergedFilters = useCallback(async (next: Filters) => {
    setFilters(next);
    setAppliedFilters(next);
    await loadSummary(next);
  }, [loadSummary]);

  const applyFilters = useCallback(async () => {
    await applyMergedFilters(filters);
  }, [applyMergedFilters, filters]);

  const openFloatingFilters = useCallback(() => {
    setFloatingCloseMonths(filters.closeMonths);
    setFloatingUns(filters.uns);
    setIsFloatingFiltersOpen(true);
  }, [filters.closeMonths, filters.uns]);

  const applyFloatingFilters = useCallback(async () => {
    const nextFilters: Filters = {
      ...filters,
      closeMonths: floatingCloseMonths.length ? [floatingCloseMonths[floatingCloseMonths.length - 1]] : [],
      uns: floatingUns,
    };
    await applyMergedFilters(nextFilters);
    setIsFloatingFiltersOpen(false);
  }, [applyMergedFilters, filters, floatingCloseMonths, floatingUns]);

  const startFloatingDrag = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const wrap = floatingWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    document.body.classList.add("is-dragging-floating-filter");
    const onPointerMove = (moveEvent: PointerEvent) => {
      const currentWrap = floatingWrapRef.current;
      if (!currentWrap) return;
      const currentRect = currentWrap.getBoundingClientRect();
      const maxLeft = Math.max(0, window.innerWidth - currentRect.width);
      const maxTop = Math.max(0, window.innerHeight - currentRect.height);
      const nextLeft = Math.min(maxLeft, Math.max(0, moveEvent.clientX - offsetX));
      const nextTop = Math.min(maxTop, Math.max(0, moveEvent.clientY - offsetY));
      setFloatingPosition({ left: nextLeft, top: nextTop });
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      document.body.classList.remove("is-dragging-floating-filter");
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
    window.addEventListener("pointercancel", onPointerUp, { once: true });
  }, []);

  const kpis = summaryData?.kpis || {};
  const rows = summaryData?.rows || [];
  const options = optionsData?.options || {};

  const kpiCards = useMemo(
    () => [
      { label: "Vigente inicial", value: formatCount(Number(kpis.vigente_inicial || 0)), border: "var(--color-text-muted)" },
      { label: "Ventas nuevas", value: <SignedCount value={Number(kpis.ventas_nuevas || 0)} />, border: "var(--color-chart-1)" },
      { label: "Recuperados a vigente", value: <SignedCount value={Number(kpis.recuperados_a_vigente || 0)} />, border: "var(--color-state-ok)" },
      { label: "Culminados vigentes", value: <SignedCount value={-Number(kpis.culminados_vigentes || 0)} />, border: "var(--color-chart-2)" },
      { label: "Caídos a moroso", value: <SignedCount value={-Number(kpis.caidos_a_moroso || 0)} />, border: "var(--color-state-error)" },
      { label: "Neto del rolo", value: <SignedCount value={Number(kpis.neto_rolo || 0)} />, border: "var(--color-primary)" },
      { label: "Vigente final", value: formatCount(Number(kpis.vigente_final || 0)), border: "var(--color-chart-5)" },
      { label: "Otros ajustes", value: <SignedCount value={Number(kpis.otros_ajustes || 0)} />, border: "var(--color-text-muted)" },
    ],
    [kpis],
  );

  const floatingWidget = (
    <div
      ref={floatingWrapRef}
      className={`rolo-floating-filter-wrap ${isFloatingFiltersOpen ? "is-open" : ""}`}
      style={floatingPosition ? { left: `${floatingPosition.left}px`, top: `${floatingPosition.top}px`, right: "auto", bottom: "auto", transform: "none" } : undefined}
    >
      <button
        type="button"
        className="rolo-floating-drag-btn"
        onPointerDown={startFloatingDrag}
        aria-label="Mover filtros rápidos"
        title="Mover filtros rápidos"
      >
        ::
      </button>
      {isFloatingFiltersOpen ? (
        <div className="card rolo-floating-filter-card">
          <div className="rolo-floating-filter-title">Filtros rápidos</div>
          <div className="rolo-floating-filter-grid">
            <MultiSelectFilter
              className="analysis-filter-control"
              label="Mes de cierre"
              options={options.close_months || []}
              selected={floatingCloseMonths}
              onChange={(closeMonths) => setFloatingCloseMonths(closeMonths.length ? [closeMonths[closeMonths.length - 1]] : [])}
            />
            <MultiSelectFilter
              className="analysis-filter-control"
              label="Unidad de negocio"
              options={options.uns || []}
              selected={floatingUns}
              onChange={setFloatingUns}
            />
          </div>
          <div className="rolo-floating-filter-actions">
            <Button size="sm" variant="primary" onPress={() => void applyFloatingFilters()} isDisabled={loadingSummary || !floatingCloseMonths.length}>
              Aplicar
            </Button>
            <Button size="sm" variant="ghost" onPress={() => setIsFloatingFiltersOpen(false)}>
              Contraer
            </Button>
          </div>
        </div>
      ) : (
        <Button className="rolo-floating-filter-fab rolo-floating-filter-fab-vertical" variant="primary" onPress={openFloatingFilters}>
          Filtros
        </Button>
      )}
    </div>
  );

  return (
    <>
      <section className="card analysis-card analysis-panel-card">
      <AnalyticsPageHeader
        kicker="ROLO"
        pill="Analytics v2"
        title="Rolo de cartera"
        subtitle="Conciliación del vigente entre cierre actual y cierre anterior para detectar qué KPI explicó el movimiento neto."
        meta={<AnalyticsMetaBadges meta={summaryData?.meta || optionsData?.meta} />}
      />
      <MetricExplainer
        items={[
          {
            label: "Fórmula del rolo",
            formula: "vigente final = vigente inicial + ventas + recuperados - culminados - caídos",
            note: "Se compara el cierre analizado contra el cierre inmediatamente anterior.",
          },
          {
            label: "Ventas nuevas",
            formula: "contract_month = cierre analizado",
            note: "Ejemplo: para 02/2026, ventas nuevas son todos los contratos con fecha de contrato 02/2026.",
          },
          {
            label: "Culminados vigentes",
            formula: "vigentes del cierre anterior que culminaron en el cierre analizado",
            note: "Salen de la cartera vigente base del rolo.",
          },
        ]}
      />
      <div className="rendimiento-filters-panel">
        <div className="analysis-filters-grid">
          <MultiSelectFilter
            className="analysis-filter-control"
            label="Mes de cierre"
            options={options.close_months || []}
            selected={filters.closeMonths}
            onChange={(closeMonths) => setFilters((prev) => ({ ...prev, closeMonths: closeMonths.length ? [closeMonths[closeMonths.length - 1]] : [] }))}
          />
          <MultiSelectFilter className="analysis-filter-control" label="Unidad de negocio" options={options.uns || []} selected={filters.uns} onChange={(uns) => setFilters((prev) => ({ ...prev, uns }))} />
          <MultiSelectFilter className="analysis-filter-control" label="Supervisor" options={options.supervisors || []} selected={filters.supervisors} onChange={(supervisors) => setFilters((prev) => ({ ...prev, supervisors }))} />
          <MultiSelectFilter className="analysis-filter-control" label="Vía de cobro" options={options.vias || []} selected={filters.vias} onChange={(vias) => setFilters((prev) => ({ ...prev, vias }))} />
          <MultiSelectFilter className="analysis-filter-control" label="Año de contrato" options={options.contract_years || []} selected={filters.years} onChange={(years) => setFilters((prev) => ({ ...prev, years }))} />
        </div>
        <div className="analysis-actions-row analysis-actions">
          <Button variant="primary" onPress={() => void applyFilters()} isDisabled={loadingOptions || !filters.closeMonths.length || loadingSummary}>
            {loadingSummary ? "Aplicando..." : "Aplicar filtros"}
          </Button>
        </div>
      </div>
      {optionsError ? <ErrorState message={optionsError} onRetry={() => void loadOptions()} retryLabel="Reintentar" /> : null}
      {summaryError ? <ErrorState message={summaryError} onRetry={() => void loadSummary(appliedFilters)} retryLabel="Reintentar" /> : null}
      {loadingOptions || loadingSummary ? <LoadingState message="Cargando rolo de cartera..." /> : null}
      {!loadingSummary && !summaryError ? (
        <>
          <AnalysisSelectionSummary
            items={[
              { label: "Cierre analizado", value: String(kpis.resolved_close_month || appliedFilters.closeMonths[0] || "-") },
              { label: "Cierre anterior", value: String(kpis.previous_close_month || "-") },
              { label: "Gestión operativa", value: String(kpis.resolved_gestion_month || "-") },
              { label: "UN", value: appliedFilters.uns.join(", ") || "Todas" },
              { label: "Supervisor", value: appliedFilters.supervisors.join(", ") || "Todos" },
              { label: "Vía de cobro", value: appliedFilters.vias.join(", ") || "Todas" },
            ]}
          />
          {!rows.length ? (
            <EmptyState
              message="No hay datos para el rolo con la selección actual."
              suggestion="Prueba con otro mes de cierre o amplía el alcance de los filtros."
              className="analysis-empty"
            />
          ) : (
            <>
              <div className="summary-grid">
                {kpiCards.map((card) => (
                  <article key={card.label} className="card kpi-card analysis-card-pad" style={{ borderLeft: `4px solid ${card.border}` }}>
                    <div className="analysis-kpi-title">{card.label}</div>
                    <div className="kpi-card-value">{card.value}</div>
                  </article>
                ))}
              </div>
              <div className="charts-grid">
                <article className="card chart-card analysis-card-pad">
                  <div className="chart-card-header">
                    <h3 className="analysis-chart-title">Neto del rolo por unidad de negocio</h3>
                  </div>
                  <RoloContributionChart rows={rows} isLight={isLightTheme} />
                </article>
                <article className="card chart-card analysis-card-pad">
                  <div className="chart-card-header">
                    <h3 className="analysis-chart-title">Composición del movimiento</h3>
                  </div>
                  <RoloCompositionChart kpis={kpis} isLight={isLightTheme} />
                </article>
              </div>
            </>
          )}
        </>
      ) : null}
      </section>
      {isClient ? createPortal(floatingWidget, document.body) : null}
    </>
  );
}
