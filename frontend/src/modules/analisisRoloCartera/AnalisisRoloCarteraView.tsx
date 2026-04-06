import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { AnalyticsMetaBadges } from "../../components/analytics/AnalyticsMetaBadges";
import { AnalyticsPageHeader } from "../../components/analytics/AnalyticsPageHeader";
import { AnalysisSelectionSummary } from "../../components/analytics/AnalysisSelectionSummary";
import { MetricExplainer } from "../../components/analytics/MetricExplainer";
import { MultiSelectFilter } from "../../components/filters/MultiSelectFilter";
import {
  ConfigurableUnFilter,
  ConfigurableViaFilter,
} from "../../components/filters/ConfigurableAnalyticsFilters";
import {
  DashboardFiltersLayout,
  DashboardFloatingFiltersLayout,
} from "@/components/filters/DashboardFiltersLayout";
import { useFilterLayoutConfig } from "@/components/filters/FilterLayoutConfigContext";
import { FloatingQuickFilters } from "../../components/filters/FloatingQuickFilters";
import {
  buildEffectiveFilterLayout,
  type AnalyticsFilterId,
} from "@/config/analyticsFilterLayouts";
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
import { sortMesGestionDesc } from "../../shared/sortMesGestionOptions";

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
        const color =
          value > 0
            ? "var(--color-state-ok)"
            : value < 0
              ? "var(--color-state-error)"
              : "var(--color-text-muted)";
        return (
          <div key={row.un}>
            <div className="analysis-bars-row-meta">
              <span>{row.un}</span>
              <span>
                {value > 0 ? "+" : ""}
                {formatCount(value)}
              </span>
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
    { label: "Caidos a moroso", value: -Number(kpis.caidos_a_moroso || 0), tone: "var(--color-state-error)" },
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
              <span style={{ color: item.tone }}>
                {item.value > 0 ? "+" : ""}
                {formatCount(item.value)}
              </span>
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
  const tone =
    value > 0
      ? "var(--color-state-ok)"
      : value < 0
        ? "var(--color-state-error)"
        : "var(--color-text)";
  return <span style={{ color: tone }}>{`${sign}${formatCount(value)}`}</span>;
}

export function AnalisisRoloCarteraView() {
  const isLightTheme = useIsLightTheme();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [isFloatingFiltersOpen, setIsFloatingFiltersOpen] = useState(false);
  const [floatingCloseMonths, setFloatingCloseMonths] = useState<string[]>([]);
  const [floatingUns, setFloatingUns] = useState<string[]>([]);
  const [floatingSupervisors, setFloatingSupervisors] = useState<string[]>([]);
  const [floatingVias, setFloatingVias] = useState<string[]>([]);
  const [floatingYears, setFloatingYears] = useState<string[]>([]);
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
      const latestClose = sortMesGestionDesc(data.options.close_months || [])[0];
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

  const loadSummary = useCallback(
    async (source: Filters) => {
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
    },
    [toPayload],
  );

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    if (!appliedFilters.closeMonths.length) return;
    void loadSummary(appliedFilters);
  }, [appliedFilters, loadSummary]);

  const applyMergedFilters = useCallback(
    async (next: Filters) => {
      setFilters(next);
      setAppliedFilters(next);
      await loadSummary(next);
    },
    [loadSummary],
  );

  const applyFilters = useCallback(async () => {
    await applyMergedFilters(filters);
  }, [applyMergedFilters, filters]);

  const kpis = summaryData?.kpis || {};
  const rows = summaryData?.rows || [];
  const options = optionsData?.options || {};
  const closeMonthOptions = useMemo(
    () => sortMesGestionDesc(options.close_months),
    [options.close_months],
  );

  const { doc: filterLayoutDoc } = useFilterLayoutConfig();
  const floatLayoutEff = useMemo(
    () => buildEffectiveFilterLayout("roloCartera", [], filterLayoutDoc),
    [filterLayoutDoc],
  );
  const floatSlots = useMemo<Partial<Record<AnalyticsFilterId, React.ReactNode>>>(
    () => ({
      close_month: (
        <MultiSelectFilter
          className="analysis-filter-control"
          label="Mes de cierre"
          options={closeMonthOptions}
          selected={floatingCloseMonths}
          onChange={(closeMonths) =>
            setFloatingCloseMonths(closeMonths.length ? [closeMonths[closeMonths.length - 1]] : [])
          }
        />
      ),
      un: (
        <ConfigurableUnFilter
          sectionId="roloCartera"
          className="analysis-filter-control"
          label="UN"
          options={options.uns || []}
          selected={floatingUns}
          onChange={setFloatingUns}
        />
      ),
      via_cobro: (
        <ConfigurableViaFilter
          sectionId="roloCartera"
          viaId="via_cobro"
          className="analysis-filter-control rendimiento-via-cobro-segmented"
          label="Via de cobro"
          options={options.vias || []}
          selected={floatingVias}
          onChange={setFloatingVias}
        />
      ),
      contract_year: (
        <MultiSelectFilter
          className="analysis-filter-control"
          label="Año de contrato"
          options={options.contract_years || []}
          selected={floatingYears}
          onChange={setFloatingYears}
        />
      ),
      supervisor: (
        <MultiSelectFilter
          className="analysis-filter-control"
          label="Supervisor"
          options={options.supervisors || []}
          selected={floatingSupervisors}
          onChange={setFloatingSupervisors}
        />
      ),
    }),
    [
      closeMonthOptions,
      options.uns,
      options.vias,
      options.contract_years,
      options.supervisors,
      floatingCloseMonths,
      floatingUns,
      floatingVias,
      floatingYears,
      floatingSupervisors,
    ],
  );
  const showFloatingFilters = useMemo(
    () => floatLayoutEff.floating.some((id) => floatSlots[id] != null),
    [floatLayoutEff.floating, floatSlots],
  );

  const openFloatingFilters = useCallback(() => {
    setFloatingCloseMonths(filters.closeMonths);
    setFloatingUns(filters.uns);
    setFloatingSupervisors(filters.supervisors);
    setFloatingVias(filters.vias);
    setFloatingYears(filters.years);
    setIsFloatingFiltersOpen(true);
  }, [filters.closeMonths, filters.supervisors, filters.uns, filters.vias, filters.years]);

  const applyFloatingFilters = useCallback(async () => {
    const fl = floatLayoutEff.floating;
    const nextFilters: Filters = { ...filters };
    if (fl.includes("close_month")) {
      nextFilters.closeMonths = floatingCloseMonths.length
        ? [floatingCloseMonths[floatingCloseMonths.length - 1]]
        : [];
    }
    if (fl.includes("un")) nextFilters.uns = floatingUns;
    if (fl.includes("via_cobro")) nextFilters.vias = floatingVias;
    if (fl.includes("contract_year")) nextFilters.years = floatingYears;
    if (fl.includes("supervisor")) nextFilters.supervisors = floatingSupervisors;
    await applyMergedFilters(nextFilters);
    setIsFloatingFiltersOpen(false);
  }, [
    applyMergedFilters,
    filters,
    floatLayoutEff.floating,
    floatingCloseMonths,
    floatingSupervisors,
    floatingUns,
    floatingVias,
    floatingYears,
  ]);

  const hasRows = rows.length > 0;
  const activeFilterCount = useMemo(
    () =>
      filters.closeMonths.length +
      filters.uns.length +
      filters.supervisors.length +
      filters.vias.length +
      filters.years.length,
    [filters.closeMonths.length, filters.supervisors.length, filters.uns.length, filters.vias.length, filters.years.length],
  );

  const kpiCards = useMemo(
    () => [
      { label: "Vigente inicial", value: formatCount(Number(kpis.vigente_inicial || 0)), border: "var(--color-text-muted)" },
      { label: "Ventas nuevas", value: <SignedCount value={Number(kpis.ventas_nuevas || 0)} />, border: "var(--color-chart-1)" },
      { label: "Recuperados a vigente", value: <SignedCount value={Number(kpis.recuperados_a_vigente || 0)} />, border: "var(--color-state-ok)" },
      { label: "Culminados vigentes", value: <SignedCount value={-Number(kpis.culminados_vigentes || 0)} />, border: "var(--color-chart-2)" },
      { label: "Caidos a moroso", value: <SignedCount value={-Number(kpis.caidos_a_moroso || 0)} />, border: "var(--color-state-error)" },
      { label: "Neto del rolo", value: <SignedCount value={Number(kpis.neto_rolo || 0)} />, border: "var(--color-primary)" },
      { label: "Vigente final", value: formatCount(Number(kpis.vigente_final || 0)), border: "var(--color-chart-5)" },
      { label: "Otros ajustes", value: <SignedCount value={Number(kpis.otros_ajustes || 0)} />, border: "var(--color-text-muted)" },
    ],
    [kpis],
  );

  return (
    <>
      <section className="card analysis-card analysis-panel-card rendimiento-panel">
        <AnalyticsPageHeader
          kicker="ROLO"
          pill="Analytics v2"
          title="Rolo de cartera"
          subtitle="Conciliacion del vigente entre cierre actual y cierre anterior para detectar que KPI explico el movimiento neto."
          meta={
            <div className="analysis-meta-row--with-info">
              <div className="analysis-meta-chips-cluster">
                <AnalyticsMetaBadges meta={summaryData?.meta || optionsData?.meta} embed />
              </div>
              <MetricExplainer
                className="metric-explainer--meta-trailing"
                items={[
                  {
                    label: "Formula del rolo",
                    formula: "vigente final = vigente inicial + ventas + recuperados - culminados - caidos",
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
            </div>
          }
        />

        <div className="rendimiento-filters-panel">
          <DashboardFiltersLayout
            sectionId="roloCartera"
            slots={{
              un: (
                <ConfigurableUnFilter
                  sectionId="roloCartera"
                  className="analysis-filter-control"
                  label="UN"
                  options={options.uns || []}
                  selected={filters.uns}
                  onChange={(uns) => setFilters((prev) => ({ ...prev, uns }))}
                />
              ),
              via_cobro: (
                <ConfigurableViaFilter
                  sectionId="roloCartera"
                  viaId="via_cobro"
                  className="analysis-filter-control rendimiento-via-cobro-segmented"
                  label="Via de cobro"
                  options={options.vias || []}
                  selected={filters.vias}
                  onChange={(vias) => setFilters((prev) => ({ ...prev, vias }))}
                />
              ),
              close_month: (
                <MultiSelectFilter
                  className="analysis-filter-control"
                  label="Mes de cierre"
                  options={closeMonthOptions}
                  selected={filters.closeMonths}
                  onChange={(closeMonths) =>
                    setFilters((prev) => ({
                      ...prev,
                      closeMonths: closeMonths.length ? [closeMonths[closeMonths.length - 1]] : [],
                    }))
                  }
                />
              ),
              contract_year: (
                <MultiSelectFilter
                  className="analysis-filter-control"
                  label="Año de contrato"
                  options={options.contract_years || []}
                  selected={filters.years}
                  onChange={(years) => setFilters((prev) => ({ ...prev, years }))}
                />
              ),
              supervisor: (
                <MultiSelectFilter
                  className="analysis-filter-control"
                  label="Supervisor"
                  options={options.supervisors || []}
                  selected={filters.supervisors}
                  onChange={(supervisors) => setFilters((prev) => ({ ...prev, supervisors }))}
                />
              ),
            }}
          />
          <div className="analysis-actions-row analysis-actions">
            <Button
              variant="primary"
              onPress={() => void applyFilters()}
              isDisabled={loadingOptions || !filters.closeMonths.length || loadingSummary}
            >
              {loadingSummary ? "Aplicando..." : "Aplicar filtros"}
            </Button>
            <span className="analysis-active-count">
              {activeFilterCount} filtro{activeFilterCount === 1 ? "" : "s"} activo
              {activeFilterCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {!loadingSummary && !summaryError && hasRows ? (
          <div className="summary-grid">
            {kpiCards.map((card) => (
              <article
                key={card.label}
                className="card kpi-card analysis-card-pad"
                style={{ borderLeft: `4px solid ${card.border}` }}
              >
                <div className="analysis-kpi-title">{card.label}</div>
                <div className="kpi-card-value">{card.value}</div>
              </article>
            ))}
          </div>
        ) : null}

        {optionsError ? <ErrorState message={optionsError} onRetry={() => void loadOptions()} retryLabel="Reintentar" /> : null}
        {summaryError ? <ErrorState message={summaryError} onRetry={() => void loadSummary(appliedFilters)} retryLabel="Reintentar" /> : null}
        {loadingOptions || loadingSummary ? <LoadingState message="Cargando rolo de cartera..." /> : null}

        {!loadingSummary && !summaryError ? (
          <>
            <AnalysisSelectionSummary
              items={[
                { label: "Cierre analizado", value: String(kpis.resolved_close_month || appliedFilters.closeMonths[0] || "-") },
                { label: "Cierre anterior", value: String(kpis.previous_close_month || "-") },
                { label: "Gestion operativa", value: String(kpis.resolved_gestion_month || "-") },
                { label: "UN", value: appliedFilters.uns.join(", ") || "Todas" },
                { label: "Supervisor", value: appliedFilters.supervisors.join(", ") || "Todos" },
                { label: "Via de cobro", value: appliedFilters.vias.join(", ") || "Todas" },
              ]}
            />
            {!hasRows ? (
              <EmptyState
                message="No hay datos para el rolo con la seleccion actual."
                suggestion="Prueba con otro mes de cierre o amplia el alcance de los filtros."
                className="analysis-empty"
              />
            ) : (
              <>
                <p className="table-scroll-hint">
                  Mostrando {rows.length.toLocaleString("es-PY")} unidad{rows.length === 1 ? "" : "es"} de negocio para explicar el movimiento neto del rolo.
                </p>
                <div className="charts-grid">
                  <article className="card chart-card analysis-card-pad">
                    <div className="chart-card-header">
                      <h3 className="analysis-chart-title">Neto del rolo por unidad de negocio</h3>
                    </div>
                    <RoloContributionChart rows={rows} isLight={isLightTheme} />
                  </article>
                  <article className="card chart-card analysis-card-pad">
                    <div className="chart-card-header">
                      <h3 className="analysis-chart-title">Composicion del movimiento</h3>
                    </div>
                    <RoloCompositionChart kpis={kpis} isLight={isLightTheme} />
                  </article>
                </div>
              </>
            )}
          </>
        ) : null}
      </section>

      {showFloatingFilters ? (
        <FloatingQuickFilters
          isOpen={isFloatingFiltersOpen}
          onOpen={openFloatingFilters}
          onCollapse={() => setIsFloatingFiltersOpen(false)}
          onApply={() => void applyFloatingFilters()}
          applyDisabled={
            loadingSummary ||
            (floatLayoutEff.floating.includes("close_month") && !floatingCloseMonths.length)
          }
          applying={loadingSummary}
        >
          <DashboardFloatingFiltersLayout sectionId="roloCartera" slots={floatSlots} />
        </FloatingQuickFilters>
      ) : null}
    </>
  );
}
