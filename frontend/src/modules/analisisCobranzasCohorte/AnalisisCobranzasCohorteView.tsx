import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActiveFilterChips, type FilterChip } from '../../components/filters/ActiveFilterChips'
import { MultiSelectFilter } from '../../components/filters/MultiSelectFilter'
import {
  getCobranzasCohorteOptions,
  getCobranzasCohorteSummary,
  type CobranzasCohorteSummaryResponse,
} from '../../shared/api'
import { getApiErrorMessage } from '../../shared/apiErrors'
import { formatCount, formatGsFull } from '../../shared/formatters'

type Filters = {
  cutoffMonth: string
  uns: string[]
  vias: string[]
  categorias: string[]
  supervisors: string[]
}
type MultiValueFilterKey = Exclude<keyof Filters, 'cutoffMonth'>
type KpiId =
  | 'total_cobrado'
  | 'deberia_cobrar'
  | 'pago_contratos'
  | 'cobertura_monto'
  | 'ticket_transaccional'
  | 'ticket_contrato'

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

const COHORTE_KPI_ORDER_STORAGE = 'analisis_cobranzas_cohorte_kpi_order_v1'
const DEFAULT_KPI_ORDER: KpiId[] = [
  'total_cobrado',
  'deberia_cobrar',
  'ticket_transaccional',
  'ticket_contrato',
  'pago_contratos',
  'cobertura_monto',
]

function readStoredOrder(defaults: KpiId[]): KpiId[] {
  try {
    const raw = window.localStorage.getItem(COHORTE_KPI_ORDER_STORAGE)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return defaults
    const parsedSet = new Set(parsed)
    const next = defaults.filter((item) => parsedSet.has(item))
    const missing = defaults.filter((item) => !next.includes(item))
    return [...next, ...missing]
  } catch {
    return defaults
  }
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
  const [kpiOrder, setKpiOrder] = useState<KpiId[]>(() => readStoredOrder(DEFAULT_KPI_ORDER))
  const [draggingKpi, setDraggingKpi] = useState<KpiId | null>(null)
  const [dragOverKpi, setDragOverKpi] = useState<KpiId | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(COHORTE_KPI_ORDER_STORAGE, JSON.stringify(kpiOrder))
    } catch {
      // ignore storage failures
    }
  }, [kpiOrder])

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
  const selectedCategoria = (filters.categorias[0] || '').toUpperCase()
  const selectedVia = (filters.vias[0] || '').toUpperCase()
  const ticketTransaccional = useMemo(() => {
    const transacciones = Number(totals?.transacciones || 0)
    if (transacciones <= 0) return 0
    return Number(totals?.cobrado || 0) / transacciones
  }, [totals?.cobrado, totals?.transacciones])

  const ticketContrato = useMemo(() => {
    const contratosConPago = Number(totals?.pagaron || 0)
    if (contratosConPago <= 0) return 0
    return Number(totals?.cobrado || 0) / contratosConPago
  }, [totals?.cobrado, totals?.pagaron])

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
  const noCohorteData = options.cutoffMonths.length === 0

  const moveKpi = useCallback((fromId: KpiId, toId: KpiId) => {
    if (fromId === toId) return
    setKpiOrder((prev) => {
      const fromIdx = prev.indexOf(fromId)
      const toIdx = prev.indexOf(toId)
      if (fromIdx < 0 || toIdx < 0) return prev
      const next = [...prev]
      next.splice(fromIdx, 1)
      next.splice(toIdx, 0, fromId)
      return next
    })
  }, [])

  const kpiCards: Record<KpiId, { title: string; value: string; note?: string; className: string }> = {
    total_cobrado: {
      title: 'Total Cobrado',
      value: formatGsFull(totals?.cobrado || 0),
      note: `${formatCount(totals?.pagaron || 0)} contratos pagaron`,
      className: 'cohorte-kpi-primary',
    },
    deberia_cobrar: {
      title: 'Deberia Cobrar',
      value: formatGsFull(totals?.deberia || 0),
      note: `${formatCount(totals?.activos || 0)} contratos activos`,
      className: 'cohorte-kpi-gold',
    },
    pago_contratos: {
      title: '% Pago Contratos',
      value: pct(totals?.pct_pago_contratos || 0),
      className: 'cohorte-kpi-emerald',
    },
    cobertura_monto: {
      title: '% Cobertura Monto',
      value: pct(totals?.pct_cobertura_monto || 0),
      className: 'cohorte-kpi-violet',
    },
    ticket_transaccional: {
      title: 'Ticket Transaccional',
      value: formatGsFull(ticketTransaccional),
      note: `${formatCount(totals?.transacciones || 0)} transacciones`,
      className: 'cohorte-kpi-cyan',
    },
    ticket_contrato: {
      title: 'Ticket Contrato',
      value: formatGsFull(ticketContrato),
      note: `${formatCount(totals?.pagaron || 0)} contratos con pago`,
      className: 'cohorte-kpi-amber',
    },
  }

  return (
    <section className="card analysis-card cohorte-card">
      <div className="cohorte-header">
        <div className="cohorte-header-row">
          <span className="cohorte-kicker">Panel ejecutivo</span>
          <span className="cohorte-live-pill">Cobranzas corte</span>
        </div>
        <h2>Analisis de Cobranzas por Corte</h2>
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

            <div className="cohorte-filter-control cohorte-via-control">
              <label className="input-label">Via de Cobro</label>
              <div className="cohorte-via-toggle" role="radiogroup" aria-label="Via de Cobro">
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedVia === ''}
                  className={`cohorte-via-btn ${selectedVia === '' ? 'is-active' : ''}`}
                  onClick={() => setFilters((prev) => ({ ...prev, vias: [] }))}
                >
                  Todos
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedVia === 'DEBITO'}
                  className={`cohorte-via-btn ${selectedVia === 'DEBITO' ? 'is-active' : ''}`}
                  onClick={() => setFilters((prev) => ({ ...prev, vias: ['DEBITO'] }))}
                >
                  Debito
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedVia === 'COBRADOR'}
                  className={`cohorte-via-btn ${selectedVia === 'COBRADOR' ? 'is-active' : ''}`}
                  onClick={() => setFilters((prev) => ({ ...prev, vias: ['COBRADOR'] }))}
                >
                  Cobrador
                </button>
              </div>
            </div>

            <MultiSelectFilter
              className="cohorte-filter-control"
              label="Supervisor"
              options={options.supervisors}
              selected={filters.supervisors}
              onChange={(values) => setFilters((prev) => ({ ...prev, supervisors: values }))}
              placeholder="Todos"
            />

            <div className="cohorte-filter-control cohorte-category-control">
              <label className="input-label">Categoria</label>
              <div className="cohorte-category-toggle" role="radiogroup" aria-label="Categoria">
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedCategoria === ''}
                  className={`cohorte-category-btn ${selectedCategoria === '' ? 'is-active' : ''}`}
                  onClick={() => setFilters((prev) => ({ ...prev, categorias: [] }))}
                >
                  Todas
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedCategoria === 'VIGENTE'}
                  className={`cohorte-category-btn ${selectedCategoria === 'VIGENTE' ? 'is-active' : ''}`}
                  onClick={() => setFilters((prev) => ({ ...prev, categorias: ['VIGENTE'] }))}
                >
                  Vigente
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedCategoria === 'MOROSO'}
                  className={`cohorte-category-btn ${selectedCategoria === 'MOROSO' ? 'is-active' : ''}`}
                  onClick={() => setFilters((prev) => ({ ...prev, categorias: ['MOROSO'] }))}
                >
                  Moroso
                </button>
              </div>
            </div>
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

          {noCohorteData ? (
            <div className="analysis-empty">
              Sin datos de cobranzas por corte. Debe sincronizar dominios <strong>cartera</strong> y <strong>cobranzas</strong>
              para poblar <code>cobranzas_cohorte_agg</code>.
            </div>
          ) : null}

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
              {kpiOrder.map((kpiId) => {
                const card = kpiCards[kpiId]
                return (
                  <article
                    key={kpiId}
                    className={`card kpi-card cohorte-kpi-card ${card.className} ${dragOverKpi === kpiId ? 'chart-drop-target' : ''} ${draggingKpi === kpiId ? 'dragging-card' : ''}`}
                    draggable
                    onDragStart={(e) => {
                      setDraggingKpi(kpiId)
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', kpiId)
                    }}
                    onDragEnd={() => {
                      setDraggingKpi(null)
                      setDragOverKpi(null)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      if (draggingKpi && draggingKpi !== kpiId) setDragOverKpi(kpiId)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const fromId = (e.dataTransfer.getData('text/plain') || draggingKpi || '') as KpiId
                      if (fromId) moveKpi(fromId, kpiId)
                      setDraggingKpi(null)
                      setDragOverKpi(null)
                    }}
                  >
                    <div className="chart-card-header">
                      <div className="kpi-card-title-wrap"><h3 className="kpi-card-title">{card.title}</h3></div>
                      <span className="chart-drag-handle" title="Arrastrar para reordenar" aria-hidden>::</span>
                    </div>
                    <div className="kpi-card-value" title={card.value}>{card.value}</div>
                    {card.note ? <small className="cohorte-kpi-note">{card.note}</small> : null}
                  </article>
                )
              })}
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
