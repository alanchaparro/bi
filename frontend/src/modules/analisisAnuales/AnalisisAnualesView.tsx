import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MultiSelectFilter } from "../../components/filters/MultiSelectFilter";
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
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<Options>(EMPTY_OPTIONS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [summary, setSummary] = useState<AnualesSummaryResponse | null>(null);

  const loadSummary = useCallback(async (next: Filters) => {
    const data = await getAnualesSummary({
      un: next.uns,
      anio: next.years,
      contract_month: next.contractMonths,
    });
    setSummary(data);
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
        await loadSummary(defaults);
        await markPerfReady("anuales");
      } catch (e: unknown) {
        setError(getApiErrorMessage(e));
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
      await loadSummary(filters);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e));
    } finally {
      setApplying(false);
    }
  }, [filters, loadSummary]);

  const onReset = useCallback(async () => {
    try {
      const reset = { ...EMPTY_FILTERS };
      setApplying(true);
      setError(null);
      setFilters(reset);
      setAppliedFilters(reset);
      await loadSummary(reset);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e));
    } finally {
      setApplying(false);
    }
  }, [loadSummary]);

  const rows = useMemo(() => summary?.rows || [], [summary?.rows]);
  const hasRows = rows.length > 0;
  const cutoff = summary?.cutoff || "-";

  useEffect(() => {
    if (!summary || applying || loadingOptions) return;
    void markPerfReady("anuales");
  }, [applying, loadingOptions, summary]);

  return (
    <section className="card analysis-card cohorte-card">
      <div className="cohorte-header">
        <div className="cohorte-header-row">
          <span className="cohorte-kicker">Panel ejecutivo</span>
          <span className="cohorte-live-pill">Anuales</span>
        </div>
        <h2>Análisis Anuales</h2>
        <p className="cohorte-subtitle">Resumen anual por cierre de gestión con TKP y culminados.</p>
      </div>

      {loadingOptions ? (
        <div className="cohorte-skeleton-wrap" aria-live="polite" aria-busy="true">
          <div className="cohorte-skeleton-grid">
            <div className="analysis-skeleton-input" />
            <div className="analysis-skeleton-input" />
            <div className="analysis-skeleton-input" />
          </div>
          <div className="cohorte-skeleton-table" />
        </div>
      ) : (
        <>
          <div className="cohorte-filters-grid">
            <MultiSelectFilter
              className="cohorte-filter-control"
              label="Unidad de Negocio"
              options={options.uns}
              selected={filters.uns}
              onChange={(values) => setFilters((prev) => ({ ...prev, uns: values }))}
              placeholder="Todas"
            />
            <MultiSelectFilter
              className="cohorte-filter-control"
              label="Año de Contrato"
              options={options.years}
              selected={filters.years}
              onChange={(values) => setFilters((prev) => ({ ...prev, years: values }))}
              placeholder="Todos"
            />
            <MultiSelectFilter
              className="cohorte-filter-control"
              label="Mes/Año de Contrato"
              options={options.contractMonths}
              selected={filters.contractMonths}
              onChange={(values) => setFilters((prev) => ({ ...prev, contractMonths: values }))}
              placeholder="Todos"
            />
          </div>

          <div className="cohorte-actions-row">
            <button type="button" className="btn btn-primary" onClick={() => void onApply()} disabled={applying}>
              {applying ? "Aplicando..." : "Aplicar Filtros"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => void onReset()} disabled={applying}>
              Resetear Filtros
            </button>
          </div>

          <div className="cohorte-inline-summary">
            <strong>Selección actual:</strong>&nbsp;
            UN: {selectionLabel(appliedFilters.uns, "Todas")} | Año: {selectionLabel(appliedFilters.years, "Todos")} | Mes/Año Contrato: {selectionLabel(appliedFilters.contractMonths, "Todos")} | Corte: {cutoff}
          </div>
        </>
      )}

      {error ? <div className="alert-error">{error}</div> : null}

      {!loadingOptions && !error ? (
        <div className="cohorte-table-section">
          <div className="table-wrap cohorte-table-wrap cohorte-table-wrap-annual">
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
                      <td className="cohorte-key-cell">{row.year}</td>
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
                    <td colSpan={13} style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
                      Sin datos para filtros seleccionados.
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
