import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MultiSelectFilter } from "../../components/filters/MultiSelectFilter";
import { ActiveFilterChips, type FilterChip } from "../../components/filters/ActiveFilterChips";
import { AnalyticsPageHeader } from "../../components/analytics/AnalyticsPageHeader";
import { AnalysisSelectionSummary } from "../../components/analytics/AnalysisSelectionSummary";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { getApiErrorMessage } from "../../shared/apiErrors";
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
          contractMonths: data.options.contract_months || [],
        });
        const defaults: Filters = { ...EMPTY_FILTERS };
        setFilters(defaults);
        setAppliedFilters(defaults);
        setApplying(true);
        const fp = await getAnualesFirstPaint({});
        setSummary({ rows: fp.rows_top || [], cutoff: fp.cutoff || "-", meta: fp.meta });
        await markPerfReady("anuales");
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

  const onApply = useCallback(async () => {
    try {
      setApplying(true);
      setError(null);
      setAppliedFilters(filters);
      const fp = await getAnualesFirstPaint({
        un: filters.uns,
        anio: filters.years,
        contract_month: filters.contractMonths,
      });
      setSummary({ rows: fp.rows_top || [], cutoff: fp.cutoff || "-", meta: fp.meta });
      await markPerfReady("anuales");
      void loadSummary(filters).catch((e: unknown) => setError(getApiErrorMessage(e)));
    } catch (e: unknown) {
      setError(getApiErrorMessage(e));
      setLoadingSummary(false);
    } finally {
      setApplying(false);
    }
  }, [filters, loadSummary]);

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
      await markPerfReady("anuales");
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
    <section className="card analysis-card analysis-panel-card">
      <AnalyticsPageHeader
        kicker="Panel ejecutivo"
        pill="Anuales"
        title="Análisis Anuales"
        subtitle="Resumen anual por cierre de gestión con TKP y culminados."
      />

      {loadingOptions ? (
        <div className="analysis-skeleton-wrap" aria-live="polite" aria-busy="true">
          <div className="analysis-skeleton-grid">
            <div className="analysis-skeleton-input" />
            <div className="analysis-skeleton-input" />
            <div className="analysis-skeleton-input" />
            <div className="analysis-skeleton-input" />
            <div className="analysis-skeleton-input" />
          </div>
          <div className="analysis-skeleton-kpis">
            <div className="analysis-skeleton-kpi" />
            <div className="analysis-skeleton-kpi" />
            <div className="analysis-skeleton-kpi" />
            <div className="analysis-skeleton-kpi" />
            <div className="analysis-skeleton-kpi" />
            <div className="analysis-skeleton-kpi" />
          </div>
          <div className="analysis-skeleton-table" />
        </div>
      ) : (
        <>
          <div className="analysis-filters-grid">
            <MultiSelectFilter
              className="analysis-filter-control"
              label="Unidad de Negocio"
              options={options.uns}
              selected={filters.uns}
              onChange={(values) => setFilters((prev) => ({ ...prev, uns: values }))}
              placeholder="Todas"
            />
            <MultiSelectFilter
              className="analysis-filter-control"
              label="Año de Contrato"
              options={options.years}
              selected={filters.years}
              onChange={(values) => setFilters((prev) => ({ ...prev, years: values }))}
              placeholder="Todos"
            />
            <MultiSelectFilter
              className="analysis-filter-control"
              label="Mes/Año de Contrato"
              options={options.contractMonths}
              selected={filters.contractMonths}
              onChange={(values) => setFilters((prev) => ({ ...prev, contractMonths: values }))}
              placeholder="Todos"
            />
          </div>

          <div className="analysis-actions-row analysis-actions">
            <button type="button" className="btn btn-primary" onClick={() => void onApply()} disabled={applying}>
              {applying ? "Aplicando..." : "Aplicar filtros"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={clearFilters} disabled={applying}>
              Limpiar filtros
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => void onReset()} disabled={applying}>
              Resetear filtros
            </button>
            <span className="analysis-active-count">
              {activeFilterChips.length} filtro{activeFilterChips.length === 1 ? "" : "s"} activo{activeFilterChips.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="analysis-active-filters">
            <ActiveFilterChips chips={activeFilterChips} onRemove={removeChip} />
          </div>

          <AnalysisSelectionSummary
            items={[
              { label: "UN", value: selectionLabel(appliedFilters.uns, "Todas") },
              { label: "Año", value: selectionLabel(appliedFilters.years, "Todos") },
              { label: "Mes/Año Contrato", value: selectionLabel(appliedFilters.contractMonths, "Todos") },
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
      {loadingSummary && !error ? <LoadingState message="Actualizando resumen anual..." className="analysis-selection-summary" /> : null}

      {!loadingOptions && !error ? (
        <div className="analysis-table-section">
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
                      <EmptyState message="Sin datos para filtros seleccionados." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
