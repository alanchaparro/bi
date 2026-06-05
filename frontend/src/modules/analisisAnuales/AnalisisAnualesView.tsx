import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { MultiSelectFilter } from "../../components/filters/MultiSelectFilter";
import { ConfigurableUnFilter } from "../../components/filters/ConfigurableAnalyticsFilters";
import {
  DashboardFiltersLayout,
  DashboardFloatingFiltersLayout,
  useDashboardMainFilterAutoApply,
} from "@/components/filters/DashboardFiltersLayout";
import { useFilterLayoutConfig } from "@/components/filters/FilterLayoutConfigContext";
import { FloatingQuickFilters } from "../../components/filters/FloatingQuickFilters";
import {
  buildEffectiveFilterLayout,
  snapshotFloatingFilterValues,
  type AnalyticsFilterId,
} from "@/config/analyticsFilterLayouts";
import { ActiveFilterChips, type FilterChip } from "../../components/filters/ActiveFilterChips";
import { AnalyticsPageHeader } from "../../components/analytics/AnalyticsPageHeader";
import { AnalyticsMetaBadges } from "../../components/analytics/AnalyticsMetaBadges";
import { AnalysisSelectionSummary } from "../../components/analytics/AnalysisSelectionSummary";
import { MetricExplainer } from "../../components/analytics/MetricExplainer";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { AnalysisFiltersSkeleton } from "../../components/feedback/AnalysisFiltersSkeleton";
import { getApiErrorMessage } from "../../shared/apiErrors";
import { sortMesGestionDesc } from "../../shared/sortMesGestionOptions";
import { formatCount, formatGsFull } from "../../shared/formatters";
import {
  getAnualesFirstPaint,
  getAnualesOptions,
  getAnualesSummary,
  markPerfReady,
  type AnualesSummaryResponse,
} from "../../shared/api";

type Filters = {
  uns: string[];
  years: string[];
  contractMonths: string[];
};

type Options = {
  uns: string[];
  years: string[];
  contractMonths: string[];
};

const EMPTY_FILTERS: Filters = {
  uns: [],
  years: [],
  contractMonths: [],
};

const EMPTY_OPTIONS: Options = {
  uns: [],
  years: [],
  contractMonths: [],
};

function selectionLabel(selected: string[], fallback: string) {
  if (selected.length === 0) return fallback;
  if (selected.length === 1) return selected[0];
  return `${selected.length} seleccionados`;
}

export function AnalisisAnualesView() {
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<Options>(EMPTY_OPTIONS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [summary, setSummary] = useState<AnualesSummaryResponse | null>(null);
  const [floatOpen, setFloatOpen] = useState(false);
  const [floatUns, setFloatUns] = useState<string[]>([]);
  const [floatYears, setFloatYears] = useState<string[]>([]);
  const [floatContractMonths, setFloatContractMonths] = useState<string[]>([]);

  const loadSummary = useCallback(async (next: Filters) => {
    setLoadingSummary(true);
    try {
      const data = await getAnualesSummary({
        un: next.uns,
        anio: next.years,
        contract_month: next.contractMonths,
      });
      setSummary(data);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    const boot = async () => {
      try {
        setLoadingOptions(true);
        setError(null);
        const data = await getAnualesOptions({});
        setOptions({
          uns: data.options.uns || [],
          years: data.options.years || [],
          contractMonths: sortMesGestionDesc(data.options.contract_months || []),
        });
        const defaults: Filters = { ...EMPTY_FILTERS };
        setFilters(defaults);
        setAppliedFilters(defaults);
        setApplying(true);
        const fp = await getAnualesFirstPaint({});
        setSummary({ rows: fp.rows_top || [], cutoff: fp.cutoff || "-", meta: fp.meta });
        void markPerfReady("anuales");
        void loadSummary(defaults).catch((e: unknown) => setError(getApiErrorMessage(e)));
      } catch (e: unknown) {
        setError(getApiErrorMessage(e));
        setLoadingSummary(false);
      } finally {
        setApplying(false);
        setLoadingOptions(false);
      }
    };
    void boot();
  }, [loadSummary]);

  const commitAndLoad = useCallback(
    async (next: Filters) => {
      try {
        setApplying(true);
        setError(null);
        setFilters(next);
        setAppliedFilters(next);
        const fp = await getAnualesFirstPaint({
          un: next.uns,
          anio: next.years,
          contract_month: next.contractMonths,
        });
        setSummary({ rows: fp.rows_top || [], cutoff: fp.cutoff || "-", meta: fp.meta });
        void markPerfReady("anuales");
        void loadSummary(next).catch((e: unknown) => setError(getApiErrorMessage(e)));
      } catch (e: unknown) {
        setError(getApiErrorMessage(e));
        setLoadingSummary(false);
      } finally {
        setApplying(false);
      }
    },
    [loadSummary],
  );

  const onApply = useCallback(() => void commitAndLoad(filters), [commitAndLoad, filters]);

  const { doc: filterLayoutDoc } = useFilterLayoutConfig();
  const floatLayoutEff = useMemo(
    () => buildEffectiveFilterLayout("analisisCarteraAnuales", [], filterLayoutDoc),
    [filterLayoutDoc],
  );
  const floatSlots = useMemo<Partial<Record<AnalyticsFilterId, React.ReactNode>>>(
    () => ({
      un: (
        <ConfigurableUnFilter
          sectionId="analisisCarteraAnuales"
          className="analysis-filter-control"
          label="UN"
          options={options.uns}
          selected={floatUns}
          onChange={setFloatUns}
        />
      ),
      contract_year: (
        <MultiSelectFilter
          className="analysis-filter-control"
          label="Año de contrato"
          options={options.years}
          selected={floatYears}
          onChange={setFloatYears}
          placeholder="Todos"
        />
      ),
      contract_month_combo: (
        <MultiSelectFilter
          className="analysis-filter-control"
          label="Mes/Año de contrato"
          options={options.contractMonths}
          selected={floatContractMonths}
          onChange={setFloatContractMonths}
          placeholder="Todos"
        />
      ),
    }),
    [options.uns, options.years, options.contractMonths, floatUns, floatYears, floatContractMonths],
  );
  const showFloatingFilters = useMemo(
    () => floatLayoutEff.floating.some((id) => floatSlots[id] != null),
    [floatLayoutEff.floating, floatSlots],
  );

  const openFloatFilters = useCallback(() => {
    setFloatUns(filters.uns);
    setFloatYears(filters.years);
    setFloatContractMonths(filters.contractMonths);
    setFloatOpen(true);
  }, [filters.contractMonths, filters.uns, filters.years]);

  const applyFloatFilters = useCallback(async () => {
    const fl = floatLayoutEff.floating;
    const next: Filters = { ...filters };
    if (fl.includes("un")) next.uns = floatUns;
    if (fl.includes("contract_year")) next.years = floatYears;
    if (fl.includes("contract_month_combo")) next.contractMonths = floatContractMonths;
    await commitAndLoad(next);
    setFloatOpen(false);
  }, [
    commitAndLoad,
    filters,
    floatLayoutEff.floating,
    floatContractMonths,
    floatUns,
    floatYears,
  ]);

  const pickFloatDraft = useCallback(
    (id: string): readonly string[] => {
      switch (id) {
        case "un":
          return floatUns;
        case "contract_year":
          return floatYears;
        case "contract_month_combo":
          return floatContractMonths;
        default:
          return [];
      }
    },
    [floatUns, floatYears, floatContractMonths],
  );

  const pickFloatApplied = useCallback(
    (id: string): readonly string[] => {
      switch (id) {
        case "un":
          return appliedFilters.uns;
        case "contract_year":
          return appliedFilters.years;
        case "contract_month_combo":
          return appliedFilters.contractMonths;
        default:
          return [];
      }
    },
    [appliedFilters],
  );

  const floatDraftActivityKey = useMemo(
    () => snapshotFloatingFilterValues(floatLayoutEff.floating, pickFloatDraft),
    [floatLayoutEff.floating, pickFloatDraft],
  );

  const floatAppliedActivityKey = useMemo(
    () => snapshotFloatingFilterValues(floatLayoutEff.floating, pickFloatApplied),
    [floatLayoutEff.floating, pickFloatApplied],
  );

  const pickMainDraft = useCallback(
    (id: string): readonly string[] => {
      switch (id) {
        case "un":
          return filters.uns;
        case "contract_year":
          return filters.years;
        case "contract_month_combo":
          return filters.contractMonths;
        default:
          return [];
      }
    },
    [filters],
  );
  const pickMainApplied = useCallback(
    (id: string): readonly string[] => {
      switch (id) {
        case "un":
          return appliedFilters.uns;
        case "contract_year":
          return appliedFilters.years;
        case "contract_month_combo":
          return appliedFilters.contractMonths;
        default:
          return [];
      }
    },
    [appliedFilters],
  );
  useDashboardMainFilterAutoApply({
    effective: floatLayoutEff,
    pickDraft: pickMainDraft,
    pickApplied: pickMainApplied,
    onApply: () => void commitAndLoad(filters),
    floatSidebarOpen: floatOpen,
    applyDisabled: applying,
    applying,
  });

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
  }, []);

  const onReset = useCallback(async () => {
    try {
      const reset = { ...EMPTY_FILTERS };
      setApplying(true);
      setError(null);
      setFilters(reset);
      setAppliedFilters(reset);
      const fp = await getAnualesFirstPaint({});
      setSummary({ rows: fp.rows_top || [], cutoff: fp.cutoff || "-", meta: fp.meta });
      void markPerfReady("anuales");
      void loadSummary(reset).catch((e: unknown) => setError(getApiErrorMessage(e)));
    } catch (e: unknown) {
      setError(getApiErrorMessage(e));
      setLoadingSummary(false);
    } finally {
      setApplying(false);
    }
  }, [loadSummary]);

  const rows = useMemo(() => summary?.rows || [], [summary?.rows]);
  const hasRows = rows.length > 0;
  const cutoff = summary?.cutoff || "-";
  const summaryCards = useMemo(() => {
    const totals = rows.reduce(
      (acc, row) => {
        acc.contracts += Number(row.contracts || 0);
        acc.contractsVigentes += Number(row.contractsVigentes || 0);
        acc.culminados += Number(row.culminados || 0);
        acc.ltv += Number(row.ltvCulminadoVigente || 0);
        return acc;
      },
      { contracts: 0, contractsVigentes: 0, culminados: 0, ltv: 0 },
    );
    const avgLtv = rows.length ? totals.ltv / rows.length : 0;
    return [
      { label: "Cohortes visibles", value: formatCount(rows.length), note: "Años con datos en el corte actual" },
      { label: "Contratos", value: formatCount(totals.contracts), note: "Base anual filtrada" },
      { label: "Vigentes en corte", value: formatCount(totals.contractsVigentes), note: "Contratos vigentes al cierre anual" },
      { label: "LTV promedio", value: `${avgLtv.toFixed(2)}%`, note: "Promedio simple de LTV culminado vigente" },
    ];
  }, [rows]);

  const activeFilterChips = useMemo<FilterChip[]>(() => {
    const blocks: Array<{ key: keyof Filters; label: string }> = [
      { key: "uns", label: "UN" },
      { key: "years", label: "Año" },
      { key: "contractMonths", label: "Mes/Año Contrato" },
    ];
    return blocks.flatMap((b) =>
      filters[b.key].map((value) => ({ key: b.key, label: b.label, value })),
    );
  }, [filters]);

  const removeChip = useCallback((chip: FilterChip) => {
    setFilters((prev) => ({
      ...prev,
      [chip.key]: (prev[chip.key as keyof Filters] as string[]).filter((item) => item !== chip.value),
    }));
  }, []);

  useEffect(() => {
    if (!summary || applying || loadingOptions) return;
    void markPerfReady("anuales");
  }, [applying, loadingOptions, summary]);

  return (
    <section className="card analysis-card analysis-panel-card rendimiento-panel">
      <AnalyticsPageHeader
        kicker="ANUALES"
        pill="Analytics v2"
        title="Analisis anuales"
        subtitle="Resumen anual por cierre de gestion con TKP, culminados y LTV."
        meta={
          <div className="analysis-meta-row--with-info">
            <div className="analysis-meta-chips-cluster">
              <AnalyticsMetaBadges meta={summary?.meta} embed />
            </div>
            <MetricExplainer
              className="metric-explainer--meta-trailing"
              items={[
                {
                  label: "LTV",
                  formula: "cobrado / deberia_cobrar",
                  note: "Se usa siempre la sigla LTV para el seguimiento de lo cobrado vs lo que se deberia cobrar.",
                },
                {
                  label: "Corte anual",
                  formula: "gestion_month = cierre + 1 mes",
                  note: "El resumen anual se interpreta con el mismo calendario operativo de gestion.",
                },
                {
                  label: "Culminados vigentes",
                  formula: "tramo 0..3",
                  note: "La categoria vigente sigue la regla de tramo definida por negocio.",
                },
              ]}
            />
          </div>
        }
      />

      {loadingOptions ? (
        <AnalysisFiltersSkeleton filterCount={3} kpiCount={6} showTable />
      ) : (
        <>
          {hasRows ? (
            <div className="summary-cards-grid">
              {summaryCards.map((card) => (
                <article key={card.label} className="summary-card">
                  <div className="summary-card-label">{card.label}</div>
                  <div className="summary-card-value tabular-nums">{card.value}</div>
                  <p className="analysis-kpi-note">{card.note}</p>
                </article>
              ))}
            </div>
          ) : null}

          <div className="rendimiento-filters-panel">
            <DashboardFiltersLayout
              sectionId="analisisCarteraAnuales"
              slots={{
                un: (
                  <ConfigurableUnFilter
                    sectionId="analisisCarteraAnuales"
                    className="analysis-filter-control"
                    label="UN"
                    options={options.uns}
                    selected={filters.uns}
                    onChange={(values) => setFilters((prev) => ({ ...prev, uns: values }))}
                  />
                ),
                contract_year: (
                  <MultiSelectFilter
                    className="analysis-filter-control"
                    label="Año de contrato"
                    options={options.years}
                    selected={filters.years}
                    onChange={(values) => setFilters((prev) => ({ ...prev, years: values }))}
                    placeholder="Todos"
                  />
                ),
                contract_month_combo: (
                  <MultiSelectFilter
                    className="analysis-filter-control"
                    label="Mes/Año de contrato"
                    options={options.contractMonths}
                    selected={filters.contractMonths}
                    onChange={(values) => setFilters((prev) => ({ ...prev, contractMonths: values }))}
                    placeholder="Todos"
                  />
                ),
              }}
            />
            <div className="rendimiento-filter-hints" role="note" aria-label="Ayuda de filtros">
              <span className="rendimiento-filter-hint">Los filtros son de contrato, no de gestion.</span>
              <span className="rendimiento-filter-hint">LTV compara cobrado vs deberia cobrar.</span>
              <span className="rendimiento-filter-hint">El corte anual debe leerse con calendario de gestion.</span>
            </div>

            <div className="analysis-actions-row analysis-actions">
              <Button variant="primary" onPress={() => void onApply()} isDisabled={applying}>
                {applying ? "Aplicando..." : "Aplicar filtros"}
              </Button>
              <Button variant="outline" onPress={clearFilters} isDisabled={applying}>
                Limpiar
              </Button>
              <Button variant="outline" onPress={() => void onReset()} isDisabled={applying}>
                Restablecer
              </Button>
              <span className="analysis-active-count">
                {activeFilterChips.length} filtro{activeFilterChips.length === 1 ? "" : "s"} activo
                {activeFilterChips.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="analysis-active-filters">
              <ActiveFilterChips chips={activeFilterChips} onRemove={removeChip} />
            </div>
          </div>

          <AnalysisSelectionSummary
            items={[
              { label: "UN", value: selectionLabel(appliedFilters.uns, "Todas") },
              { label: "Año", value: selectionLabel(appliedFilters.years, "Todos") },
              { label: "Mes/Año contrato", value: selectionLabel(appliedFilters.contractMonths, "Todos") },
              { label: "Corte", value: cutoff },
            ]}
          />
        </>
      )}

      {error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            setError(null);
            void loadSummary(appliedFilters);
          }}
          retryLabel="Reintentar"
        />
      ) : null}
      {loadingSummary && !error ? (
        <LoadingState message="Actualizando resumen anual..." className="analysis-selection-summary" />
      ) : null}

      {!loadingOptions && !error ? (
        <div className={`data-transition ${loadingSummary ? "data-transition--loading" : ""}`}>
          <div className="analysis-table-section">
            <p className="table-scroll-hint">
              Mostrando {rows.length.toLocaleString("es-PY")} cohorte{rows.length === 1 ? "" : "s"} anual
              {rows.length === 1 ? "" : "es"} para el corte {cutoff}. Desliza la tabla horizontalmente para ver todas las columnas.
            </p>
            <div className="table-wrap analysis-table-wrap analysis-table-wrap-annual">
              <table>
                <thead>
                  <tr>
                    <th>AÑO</th>
                    <th className="num">CONTRATOS</th>
                    <th className="num">CONTRATOS VIGENTES (CORTE)</th>
                    <th className="num">TKP CONTRATO</th>
                    <th className="num">TKP TRANSACCIONAL</th>
                    <th className="num">TKP PAGO</th>
                    <th className="num">CULMINADOS</th>
                    <th className="num">CULMINADOS VIGENTES</th>
                    <th className="num">TKP DEL CONTRATO CULMINADO</th>
                    <th className="num">TKP DEL PAGO CULMINADO</th>
                    <th className="num">TKP CONTRATO CULMINADO VIGENTE</th>
                    <th className="num">TKP PAGO CULMINADO VIGENTE</th>
                    <th className="num">LTV CULMINADO VIGENTE</th>
                  </tr>
                </thead>
                <tbody>
                  {hasRows ? (
                    rows.map((row) => (
                      <tr key={row.year}>
                        <td className="analysis-key-cell">{row.year}</td>
                        <td className="num">{formatCount(row.contracts)}</td>
                        <td className="num">{formatCount(row.contractsVigentes)}</td>
                        <td className="num">{formatGsFull(row.tkpContrato)}</td>
                        <td className="num">{formatGsFull(row.tkpTransaccional)}</td>
                        <td className="num">{formatGsFull(row.tkpPago)}</td>
                        <td className="num">{formatCount(row.culminados)}</td>
                        <td className="num">{formatCount(row.culminadosVigentes)}</td>
                        <td className="num">{formatGsFull(row.tkpContratoCulminado)}</td>
                        <td className="num">{formatGsFull(row.tkpPagoCulminado)}</td>
                        <td className="num">{formatGsFull(row.tkpContratoCulminadoVigente)}</td>
                        <td className="num">{formatGsFull(row.tkpPagoCulminadoVigente)}</td>
                        <td className="num">{Number(row.ltvCulminadoVigente || 0).toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={13}>
                        <EmptyState
                          message="Sin datos para filtros seleccionados."
                          suggestion="Prueba ajustando la unidad de negocio, el año o el mes/año de contrato."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {showFloatingFilters ? (
        <FloatingQuickFilters
          isOpen={floatOpen}
          onOpen={openFloatFilters}
          onCollapse={() => setFloatOpen(false)}
          onApply={() => void applyFloatFilters()}
          floatDraftActivityKey={floatDraftActivityKey}
          floatAppliedActivityKey={floatAppliedActivityKey}
          applyDisabled={applying || loadingOptions || loadingSummary}
          applying={applying || loadingSummary}
        >
          <DashboardFloatingFiltersLayout
            sectionId="analisisCarteraAnuales"
            slots={floatSlots}
          />
        </FloatingQuickFilters>
      ) : null}
    </section>
  );
}
