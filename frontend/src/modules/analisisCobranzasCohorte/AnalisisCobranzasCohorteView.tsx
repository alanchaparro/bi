import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActiveFilterChips, type FilterChip } from '../../components/filters/ActiveFilterChips'
import { MultiSelectFilter } from '../../components/filters/MultiSelectFilter'
import {
  getCobranzasCohorteOptions,
  getCobranzasCohorteSummary,
  type CobranzasCohorteSummaryResponse,
} from '../../shared/api'
import { getApiErrorMessage } from '../../shared/apiErrors'
import { formatCount, formatGsCompact, formatGsFull } from '../../shared/formatters'

type Filters = {
  cutoffMonth: string
  uns: string[]
  vias: string[]
  categorias: string[]
  supervisors: string[]
}
type MultiValueFilterKey = Exclude<keyof Filters, 'cutoffMonth'>

type Options = {
  cutoffMonths: string[]
  uns: string[]
  vias: string[]
  categorias: string[]
  supervisors: string[]
}

const EMPTY_OPTIONS: Options = {
  cutoffMonths: [],
  uns: [],
  vias: [],
  categorias: [],
  supervisors: [],
}

const EMPTY_FILTERS: Filters = {
  cutoffMonth: '',
  uns: [],
  vias: [],
  categorias: [],
  supervisors: [],
}

const pct = (v: number) => `${(Number(v || 0) * 100).toFixed(1)}%`

export function AnalisisCobranzasCohorteView() {
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [options, setOptions] = useState<Options>(EMPTY_OPTIONS)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS)
  const [summary, setSummary] = useState<CobranzasCohorteSummaryResponse | null>(null)

  const loadSummary = useCallback(async (next: Filters, withLoader = false) => {
    if (withLoader) setLoadingSummary(true)
    try {
      const data = await getCobranzasCohorteSummary({
        cutoff_month: next.cutoffMonth || undefined,
        un: next.uns,
        via_cobro: next.vias,
        categoria: next.categorias,
        supervisor: next.supervisors,
      })
      setSummary(data)
    } finally {
      if (withLoader) setLoadingSummary(false)
    }
  }, [])

  useEffect(() => {
    const boot = async () => {
      try {
        setLoadingOptions(true)
        setError(null)

        const opts = await getCobranzasCohorteOptions({})
        const nextOptions: Options = {
          cutoffMonths: opts.options.cutoff_months || [],
          uns: opts.options.uns || [],
          vias: opts.options.vias || [],
          categorias: opts.options.categories || [],
          supervisors: opts.options.supervisors || [],
        }

        const cutoff = opts.default_cutoff || nextOptions.cutoffMonths[nextOptions.cutoffMonths.length - 1] || ''
        const nextFilters: Filters = {
          cutoffMonth: cutoff,
          uns: [],
          vias: [],
          categorias: [],
          supervisors: [],
        }

        setOptions(nextOptions)
        setFilters(nextFilters)
        setAppliedFilters(nextFilters)
        setApplying(true)
        await loadSummary(nextFilters, true)
      } catch (e: unknown) {
        setError(getApiErrorMessage(e))
      } finally {
        setApplying(false)
        setLoadingOptions(false)
      }
    }

    void boot()
  }, [loadSummary])

  const onApply = useCallback(async () => {
    try {
      setApplying(true)
      setError(null)
      setAppliedFilters(filters)
      await loadSummary(filters)
    } catch (e: unknown) {
      setError(getApiErrorMessage(e))
    } finally {
      setApplying(false)
    }
  }, [filters, loadSummary])

  const onReset = useCallback(async () => {
    try {
      setApplying(true)
      setError(null)
      const resetFilters: Filters = {
        cutoffMonth: options.cutoffMonths[options.cutoffMonths.length - 1] || '',
        uns: [],
        vias: [],
        categorias: [],
        supervisors: [],
      }
      setFilters(resetFilters)
      setAppliedFilters(resetFilters)
      await loadSummary(resetFilters)
    } catch (e: unknown) {
      setError(getApiErrorMessage(e))
    } finally {
      setApplying(false)
    }
  }, [loadSummary, options.cutoffMonths])

  const retryLastRequest = useCallback(async () => {
    try {
      setApplying(true)
      setError(null)
      await loadSummary(appliedFilters)
    } catch (e: unknown) {
      setError(getApiErrorMessage(e))
    } finally {
      setApplying(false)
    }
  }, [appliedFilters, loadSummary])

  const totals = summary?.totals

  const byYearEntries = useMemo(
    () => Object.entries(summary?.by_year || {}).sort((a, b) => Number(b[0] || 0) - Number(a[0] || 0)),
    [summary?.by_year],
  )

  const activeFilterChips = useMemo<FilterChip[]>(() => {
    const blocks: Array<{ key: MultiValueFilterKey; label: string }> = [
      { key: 'uns', label: 'UN' },
      { key: 'vias', label: 'Via de cobro' },
      { key: 'categorias', label: 'Categoria' },
      { key: 'supervisors', label: 'Supervisor' },
    ]

    return blocks.flatMap((block) =>
      filters[block.key].map((value) => ({ key: block.key, label: block.label, value })),
    )
  }, [filters])

  const removeChip = useCallback((chip: FilterChip) => {
    setFilters((prev) => ({
      ...prev,
      [chip.key]: (prev[chip.key as keyof Filters] as string[]).filter((item) => item !== chip.value),
    }))
  }, [])

  const hasRows = (summary?.by_sale_month || []).length > 0 || byYearEntries.length > 0

  return (
    <section className="card analysis-card cohorte-card">
      <div className="cohorte-header">
        <div className="cohorte-header-row">
          <span className="cohorte-kicker">Panel ejecutivo</span>
          <span className="cohorte-live-pill">Cobranzas cohorte</span>
        </div>
        <h2>Analisis de Cobranzas por Cohorte</h2>
        <p className="cohorte-subtitle">Cobro del corte seleccionado, segmentado por mes/ano de venta.</p>
        <div className="cohorte-meta-row">
          {summary?.cutoff_month ? (
            <span className="cohorte-meta-chip">Corte de cobranza: <strong>{summary.cutoff_month}</strong></span>
          ) : null}
          {summary?.effective_cartera_month ? (
            <span className="cohorte-meta-chip">Cartera usada: <strong>{summary.effective_cartera_month}</strong></span>
          ) : null}
        </div>
      </div>

      {loadingOptions ? (
        <div className="cohorte-skeleton-wrap" aria-live="polite" aria-busy="true">
          <div className="cohorte-skeleton-grid">
            <div className="analysis-skeleton-input" />
            <div className="analysis-skeleton-input" />
            <div className="analysis-skeleton-input" />
            <div className="analysis-skeleton-input" />
            <div className="analysis-skeleton-input" />
          </div>
          <div className="cohorte-skeleton-kpis">
            <div className="analysis-skeleton-kpi" />
            <div className="analysis-skeleton-kpi" />
            <div className="analysis-skeleton-kpi" />
            <div className="analysis-skeleton-kpi" />
          </div>
          <div className="cohorte-skeleton-table" />
          <div className="cohorte-skeleton-table" />
        </div>
      ) : null}

      {!loadingOptions ? (
        <>
          <div className="cohorte-filters-grid">
            <div className="cohorte-filter-control">
              <label className="input-label">Mes/Ano de Cobro</label>
              <select
                className="input"
                value={filters.cutoffMonth}
                onChange={(e) => setFilters((prev) => ({ ...prev, cutoffMonth: e.target.value }))}
                aria-label="Mes/Ano de Cobro"
              >
                {options.cutoffMonths.map((month) => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
            </div>

            <MultiSelectFilter
              className="cohorte-filter-control"
              label="Unidad de Negocio"
              options={options.uns}
              selected={filters.uns}
              onChange={(values) => setFilters((prev) => ({ ...prev, uns: values }))}
              placeholder="Todos"
            />

            <MultiSelectFilter
              className="cohorte-filter-control"
              label="Via de Cobro"
              options={options.vias}
              selected={filters.vias}
              onChange={(values) => setFilters((prev) => ({ ...prev, vias: values }))}
              placeholder="Todas"
            />

            <MultiSelectFilter
              className="cohorte-filter-control"
              label="Categoria"
              options={options.categorias}
              selected={filters.categorias}
              onChange={(values) => setFilters((prev) => ({ ...prev, categorias: values }))}
              placeholder="Todas"
            />

            <MultiSelectFilter
              className="cohorte-filter-control"
              label="Supervisor"
              options={options.supervisors}
              selected={filters.supervisors}
              onChange={(values) => setFilters((prev) => ({ ...prev, supervisors: values }))}
              placeholder="Todos"
            />
          </div>

          <div className="analysis-actions-row cohorte-actions">
            <button type="button" className="btn btn-primary" onClick={onApply} disabled={applying}>
              {applying ? <span className="inline-spinner" aria-hidden /> : null}
              {applying ? 'Aplicando...' : 'Aplicar filtros'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onReset} disabled={applying}>
              Resetear
            </button>
            <span className="cohorte-active-count">
              {activeFilterChips.length} filtro{activeFilterChips.length === 1 ? '' : 's'} activo{activeFilterChips.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="cohorte-active-filters">
            <ActiveFilterChips chips={activeFilterChips} onRemove={removeChip} />
          </div>

          {error ? (
            <div className="alert-error cohorte-error">
              <span>{error}</span>
              <button type="button" className="btn btn-secondary" onClick={() => void retryLastRequest()} disabled={applying}>
                Reintentar
              </button>
            </div>
          ) : null}

          {applying && summary ? <div className="summary-loading-note">Actualizando resultados...</div> : null}
          {loadingSummary && !summary ? <div className="summary-loading-note">Cargando resumen...</div> : null}

          <div className={`cohorte-results ${applying ? 'cohorte-results-updating' : ''}`}>
            <div className="cohorte-kpis">
              <article className="card kpi-card cohorte-kpi-card cohorte-kpi-primary">
                <div className="kpi-card-title-wrap"><h3 className="kpi-card-title">Total Cobrado</h3></div>
                <div className="kpi-card-value" title={formatGsFull(totals?.cobrado || 0)}>{formatGsCompact(totals?.cobrado || 0)}</div>
                <small className="cohorte-kpi-note">{formatCount(totals?.pagaron || 0)} contratos pagaron</small>
              </article>
              <article className="card kpi-card cohorte-kpi-card cohorte-kpi-gold">
                <div className="kpi-card-title-wrap"><h3 className="kpi-card-title">Deberia Cobrar</h3></div>
                <div className="kpi-card-value" title={formatGsFull(totals?.deberia || 0)}>{formatGsCompact(totals?.deberia || 0)}</div>
                <small className="cohorte-kpi-note">{formatCount(totals?.activos || 0)} contratos activos</small>
              </article>
              <article className="card kpi-card cohorte-kpi-card cohorte-kpi-emerald">
                <div className="kpi-card-title-wrap"><h3 className="kpi-card-title">% Pago Contratos</h3></div>
                <div className="kpi-card-value">{pct(totals?.pct_pago_contratos || 0)}</div>
              </article>
              <article className="card kpi-card cohorte-kpi-card cohorte-kpi-violet">
                <div className="kpi-card-title-wrap"><h3 className="kpi-card-title">% Cobertura Monto</h3></div>
                <div className="kpi-card-value">{pct(totals?.pct_cobertura_monto || 0)}</div>
              </article>
            </div>

            {!hasRows ? (
              <div className="analysis-empty">Sin datos para los filtros seleccionados. Ajusta filtros y vuelve a aplicar.</div>
            ) : null}

            <div className="cohorte-table-section">
              <p className="cohorte-table-caption">Resumen de efectividad por ano de venta.</p>
              <div className="table-wrap cohorte-table-wrap cohorte-table-wrap-annual">
                <table>
                  <thead>
                    <tr>
                      <th>Ano</th>
                      <th className="num">Activos</th>
                      <th className="num">Pagaron</th>
                      <th className="num">% Pago Contratos</th>
                      <th className="num">Deberia</th>
                      <th className="num">Cobrado</th>
                      <th className="num">% Cobertura Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byYearEntries.map(([year, row]) => (
                      <tr key={year}>
                        <td className="cohorte-key-cell">{year}</td>
                        <td className="num">{formatCount(row.activos || 0)}</td>
                        <td className="num">{formatCount(row.pagaron || 0)}</td>
                        <td className="num">{pct(row.pct_pago_contratos || 0)}</td>
                        <td className="num">{formatGsFull(row.deberia || 0)}</td>
                        <td className="num">{formatGsFull(row.cobrado || 0)}</td>
                        <td className="num">{pct(row.pct_cobertura_monto || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="cohorte-table-section">
              <p className="cohorte-table-caption">Detalle mensual por cohorte de contratos.</p>
              <div className="table-wrap cohorte-table-wrap cohorte-table-wrap-monthly">
                <table>
                  <thead>
                    <tr>
                      <th>Mes/Ano Contrato</th>
                      <th className="num">Activos</th>
                      <th className="num">Pagaron</th>
                      <th className="num">% Pago Contratos</th>
                      <th className="num">Deberia</th>
                      <th className="num">Cobrado</th>
                      <th className="num">% Cobertura Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(summary?.by_sale_month || []).map((row) => (
                      <tr key={row.sale_month}>
                        <td className="cohorte-key-cell">{row.sale_month}</td>
                        <td className="num">{formatCount(row.activos || 0)}</td>
                        <td className="num">{formatCount(row.pagaron || 0)}</td>
                        <td className="num">{pct(row.pct_pago_contratos || 0)}</td>
                        <td className="num">{formatGsFull(row.deberia || 0)}</td>
                        <td className="num">{formatGsFull(row.cobrado || 0)}</td>
                        <td className="num">{pct(row.pct_cobertura_monto || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}
