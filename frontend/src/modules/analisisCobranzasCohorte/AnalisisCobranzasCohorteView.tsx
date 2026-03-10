import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActiveFilterChips, type FilterChip } from '../../components/filters/ActiveFilterChips'
import { MultiSelectFilter } from '../../components/filters/MultiSelectFilter'
import { AnalyticsPageHeader } from '../../components/analytics/AnalyticsPageHeader'
import { AnalysisSelectionSummary } from '../../components/analytics/AnalysisSelectionSummary'
import { EmptyState } from '../../components/feedback/EmptyState'
import { ErrorState } from '../../components/feedback/ErrorState'
import { LoadingState } from '../../components/feedback/LoadingState'
import {
  getCobranzasCohorteDetail,
  getCobranzasCohorteFirstPaint,
  getCobranzasCohorteOptions,
  markPerfReady,
  type CobranzasCohorteDetailResponse,
  type CobranzasCohorteFirstPaintResponse,
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

const monthMinusOne = (mmYYYY: string | undefined | null): string => {
  const value = String(mmYYYY || '').trim()
  const match = /^(\d{1,2})\/(\d{4})$/.exec(value)
  if (!match) return ''
  const month = Number(match[1])
  const year = Number(match[2])
  if (!Number.isInteger(month) || !Number.isInteger(year) || month < 1 || month > 12) return ''
  if (month === 1) return `12/${year - 1}`
  return `${String(month - 1).padStart(2, '0')}/${year}`
}

export function AnalisisCobranzasCohorteView() {
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [options, setOptions] = useState<Options>(EMPTY_OPTIONS)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS)
  const [summary, setSummary] = useState<CobranzasCohorteFirstPaintResponse | CobranzasCohorteSummaryResponse | null>(null)
  const [detailRows, setDetailRows] = useState<CobranzasCohorteDetailResponse['items']>([])
  const [detailPage, setDetailPage] = useState(1)
  const [detailHasNext, setDetailHasNext] = useState(false)
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

  const loadFirstPaint = useCallback(async (next: Filters, withLoader = false) => {
    if (withLoader) setLoadingSummary(true)
    try {
      const data = await getCobranzasCohorteFirstPaint({
        cutoff_month: next.cutoffMonth || undefined,
        un: next.uns,
        via_cobro: next.vias,
        categoria: next.categorias,
        supervisor: next.supervisors,
        top_n_sale_months: 12,
      })
      setSummary(data)
    } finally {
      if (withLoader) setLoadingSummary(false)
    }
  }, [])

  const loadDetail = useCallback(async (next: Filters, page: number, append: boolean) => {
    setLoadingDetail(true)
    try {
      const detail = await getCobranzasCohorteDetail({
        cutoff_month: next.cutoffMonth || undefined,
        un: next.uns,
        via_cobro: next.vias,
        categoria: next.categorias,
        supervisor: next.supervisors,
        page,
        page_size: 24,
        sort_by: 'sale_month',
        sort_dir: 'asc',
      })
      setDetailRows((prev) => (append ? [...prev, ...(detail.items || [])] : (detail.items || [])))
      setDetailPage(detail.page || page)
      setDetailHasNext(Boolean(detail.has_next))
    } finally {
      setLoadingDetail(false)
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
        await loadFirstPaint(nextFilters, true)
        await loadDetail(nextFilters, 1, false)
        await markPerfReady('cohorte')
      } catch (e: unknown) {
        setError(getApiErrorMessage(e))
      } finally {
        setApplying(false)
        setLoadingOptions(false)
      }
    }

    void boot()
  }, [loadDetail, loadFirstPaint])

  const onApply = useCallback(async () => {
    try {
      setApplying(true)
      setError(null)
      setAppliedFilters(filters)
      await loadFirstPaint(filters)
      await loadDetail(filters, 1, false)
    } catch (e: unknown) {
      setError(getApiErrorMessage(e))
    } finally {
      setApplying(false)
    }
  }, [filters, loadDetail, loadFirstPaint])

  const clearFilters = useCallback(() => {
    setFilters({
      ...EMPTY_FILTERS,
      cutoffMonth: options.cutoffMonths?.[options.cutoffMonths.length - 1] ?? '',
    })
  }, [options.cutoffMonths])

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
      await loadFirstPaint(resetFilters)
      await loadDetail(resetFilters, 1, false)
    } catch (e: unknown) {
      setError(getApiErrorMessage(e))
    } finally {
      setApplying(false)
    }
  }, [loadDetail, loadFirstPaint, options.cutoffMonths])

  const retryLastRequest = useCallback(async () => {
    try {
      setApplying(true)
      setError(null)
      await loadFirstPaint(appliedFilters)
      await loadDetail(appliedFilters, 1, false)
    } catch (e: unknown) {
      setError(getApiErrorMessage(e))
    } finally {
      setApplying(false)
    }
  }, [appliedFilters, loadDetail, loadFirstPaint])

  useEffect(() => {
    if (!summary || loadingSummary || loadingDetail || applying) return
    void markPerfReady('cohorte')
  }, [applying, detailRows.length, loadingDetail, loadingSummary, summary])

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

  const byTramoEntries = useMemo(() => {
    const byTramo = summary?.by_tramo || {}
    const tramoEntries = Object.entries(byTramo)
    if (tramoEntries.length > 0) {
      return tramoEntries.sort((a, b) => Number(a[0] || 0) - Number(b[0] || 0))
    }
    return Object.entries(summary?.by_year || {}).sort((a, b) => Number(b[0] || 0) - Number(a[0] || 0))
  }, [summary?.by_tramo, summary?.by_year])
  const usesTramoBreakdown = useMemo(() => Object.keys(summary?.by_tramo || {}).length > 0, [summary?.by_tramo])

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

  const hasRows = detailRows.length > 0 || byTramoEntries.length > 0
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
      className: 'analysis-kpi-primary',
    },
    deberia_cobrar: {
      title: 'Debería Cobrar',
      value: formatGsFull(totals?.deberia || 0),
      note: `${formatCount(totals?.activos || 0)} contratos activos`,
      className: 'analysis-kpi-gold',
    },
    pago_contratos: {
      title: '% Pago Contratos',
      value: pct(totals?.pct_pago_contratos || 0),
      className: 'analysis-kpi-emerald',
    },
    cobertura_monto: {
      title: '% Cobertura Monto',
      value: pct(totals?.pct_cobertura_monto || 0),
      className: 'analysis-kpi-violet',
    },
    ticket_transaccional: {
      title: 'Ticket Transaccional',
      value: formatGsFull(ticketTransaccional),
      note: `${formatCount(totals?.transacciones || 0)} transacciones`,
      className: 'analysis-kpi-cyan',
    },
    ticket_contrato: {
      title: 'Ticket Contrato',
      value: formatGsFull(ticketContrato),
      note: `${formatCount(totals?.pagaron || 0)} contratos con pago`,
      className: 'analysis-kpi-amber',
    },
  }

  const gestionBase = String(summary?.effective_cartera_month || summary?.cutoff_month || '')
  const cierreBase = monthMinusOne(gestionBase)

  const metaCohorte = (summary?.cutoff_month != null || summary?.effective_cartera_month != null) ? (
    <>
      {summary?.cutoff_month ? (
        <span className="analysis-meta-chip">Corte de cobranza: <strong>{summary.cutoff_month}</strong></span>
      ) : null}
      {gestionBase ? (
        <span className="analysis-meta-chip">
          Gesti&oacute;n usada: <strong>{gestionBase}</strong>
          {cierreBase ? <> (Cierre base: <strong>{cierreBase}</strong>)</> : null}
        </span>
      ) : null}
    </>
  ) : undefined

  return (
    <section className="card analysis-card analysis-panel-card">
      <AnalyticsPageHeader
        kicker="Panel ejecutivo"
        pill="Cobranzas corte"
        title="Análisis de Cobranzas por Corte"
        subtitle="Cobro del corte seleccionado, segmentado por mes/año de venta."
        meta={metaCohorte}
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
          <div className="analysis-skeleton-table" />
        </div>
      ) : null}

      {!loadingOptions ? (
        <>
          <div className="analysis-filters-grid">
            <div className="analysis-filter-control">
              <label className="input-label">Mes/Año de Cobro</label>
              <select
                className="input"
                value={filters.cutoffMonth}
                onChange={(e) => setFilters((prev) => ({ ...prev, cutoffMonth: e.target.value }))}
                aria-label="Mes/Año de Cobro"
              >
                {options.cutoffMonths.map((month) => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
            </div>

            <MultiSelectFilter
              className="analysis-filter-control"
              label="Unidad de Negocio"
              options={options.uns}
              selected={filters.uns}
              onChange={(values) => setFilters((prev) => ({ ...prev, uns: values }))}
              placeholder="Todos"
            />

            <div className="analysis-filter-control analysis-via-control">
              <label className="input-label">Vía de Cobro</label>
              <div className="analysis-via-toggle" role="radiogroup" aria-label="Vía de Cobro">
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedVia === ''}
                  className={`analysis-via-btn ${selectedVia === '' ? 'is-active' : ''}`}
                  onClick={() => setFilters((prev) => ({ ...prev, vias: [] }))}
                >
                  Todos
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedVia === 'DEBITO'}
                  className={`analysis-via-btn ${selectedVia === 'DEBITO' ? 'is-active' : ''}`}
                  onClick={() => setFilters((prev) => ({ ...prev, vias: ['DEBITO'] }))}
                >
                  Debito
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedVia === 'COBRADOR'}
                  className={`analysis-via-btn ${selectedVia === 'COBRADOR' ? 'is-active' : ''}`}
                  onClick={() => setFilters((prev) => ({ ...prev, vias: ['COBRADOR'] }))}
                >
                  Cobrador
                </button>
              </div>
            </div>

            <MultiSelectFilter
              className="analysis-filter-control"
              label="Supervisor"
              options={options.supervisors}
              selected={filters.supervisors}
              onChange={(values) => setFilters((prev) => ({ ...prev, supervisors: values }))}
              placeholder="Todos"
            />

            <div className="analysis-filter-control analysis-category-control">
              <label className="input-label">Categoría</label>
              <div className="analysis-category-toggle" role="radiogroup" aria-label="Categoría">
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedCategoria === ''}
                  className={`analysis-category-btn ${selectedCategoria === '' ? 'is-active' : ''}`}
                  onClick={() => setFilters((prev) => ({ ...prev, categorias: [] }))}
                >
                  Todas
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedCategoria === 'VIGENTE'}
                  className={`analysis-category-btn ${selectedCategoria === 'VIGENTE' ? 'is-active' : ''}`}
                  onClick={() => setFilters((prev) => ({ ...prev, categorias: ['VIGENTE'] }))}
                >
                  Vigente
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedCategoria === 'MOROSO'}
                  className={`analysis-category-btn ${selectedCategoria === 'MOROSO' ? 'is-active' : ''}`}
                  onClick={() => setFilters((prev) => ({ ...prev, categorias: ['MOROSO'] }))}
                >
                  Moroso
                </button>
              </div>
            </div>
          </div>

          <div className="analysis-actions-row analysis-actions">
            <button type="button" className="btn btn-primary" onClick={onApply} disabled={applying}>
              {applying ? <span className="inline-spinner" aria-hidden /> : null}
              {applying ? 'Aplicando...' : 'Aplicar filtros'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={clearFilters} disabled={applying}>
              Limpiar filtros
            </button>
            <button type="button" className="btn btn-secondary" onClick={onReset} disabled={applying}>
              Resetear filtros
            </button>
            <span className="analysis-active-count">
              {activeFilterChips.length} filtro{activeFilterChips.length === 1 ? '' : 's'} activo{activeFilterChips.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="analysis-active-filters">
            <ActiveFilterChips chips={activeFilterChips} onRemove={removeChip} />
          </div>

          <AnalysisSelectionSummary
            items={[
              { label: "Mes/Año Cobro", value: appliedFilters.cutoffMonth || "—" },
              { label: "UN", value: appliedFilters.uns.length ? appliedFilters.uns.join(", ") : "Todas" },
              { label: "Vía", value: appliedFilters.vias.length ? appliedFilters.vias.join(", ") : "Todas" },
              { label: "Categoría", value: appliedFilters.categorias.length ? appliedFilters.categorias.join(", ") : "Todas" },
              { label: "Supervisor", value: appliedFilters.supervisors.length ? appliedFilters.supervisors.join(", ") : "Todos" },
            ]}
          />

          {noCohorteData ? (
            <EmptyState
              className="analysis-empty"
              message={
                <>
                  Sin datos de cobranzas por corte. Debe sincronizar dominios <strong>cartera</strong> y <strong>cobranzas</strong>
                  para poblar <code>cobranzas_cohorte_agg</code>.
                </>
              }
            />
          ) : null}

          {error ? <ErrorState message={error} className="analysis-error" onRetry={() => void retryLastRequest()} disabled={applying} /> : null}

          {applying && summary ? <div className="summary-loading-note">Actualizando resultados...</div> : null}
          {loadingSummary && !summary ? <LoadingState message="Cargando resumen inicial..." className="summary-loading-note" /> : null}
          {loadingDetail && summary ? <div className="summary-loading-note">Cargando detalle...</div> : null}

          <div className={`analysis-results ${applying ? 'analysis-results-updating' : ''}`}>
            <div className="analysis-kpis">
              {kpiOrder.map((kpiId) => {
                const card = kpiCards[kpiId]
                return (
                  <article
                    key={kpiId}
                    className={`card kpi-card analysis-kpi-card ${card.className} ${dragOverKpi === kpiId ? 'chart-drop-target' : ''} ${draggingKpi === kpiId ? 'dragging-card' : ''}`}
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
                    {card.note ? <small className="analysis-kpi-note">{card.note}</small> : null}
                  </article>
                )
              })}
            </div>

            {!hasRows ? <EmptyState className="analysis-empty" message="Sin datos para los filtros seleccionados. Ajusta filtros y vuelve a aplicar." /> : null}

            <div className="analysis-table-section">
              <p className="analysis-table-caption">
                {usesTramoBreakdown ? 'Resumen de efectividad por tramo.' : 'Resumen de efectividad por año de venta.'}
              </p>
              <div className="table-wrap analysis-table-wrap analysis-table-wrap-annual">
                <table>
                  <thead>
                    <tr>
                      <th>{usesTramoBreakdown ? 'Tramo' : 'Año'}</th>
                      <th className="num">Activos</th>
                      <th className="num">Pagaron</th>
                      <th className="num">% Pago Contratos</th>
                      <th className="num">Debería</th>
                      <th className="num">Cobrado</th>
                      <th className="num">% Cobertura Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byTramoEntries.map(([key, row]) => (
                      <tr key={key}>
                        <td className="analysis-key-cell">{usesTramoBreakdown ? `Tramo ${key}` : key}</td>
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

            <div className="analysis-table-section">
              <p className="analysis-table-caption">Detalle mensual por cohorte de contratos.</p>
              <div className="table-wrap analysis-table-wrap analysis-table-wrap-monthly">
                <table>
                  <thead>
                    <tr>
                      <th>Mes/Año Contrato</th>
                      <th className="num">Activos</th>
                      <th className="num">Pagaron</th>
                      <th className="num">% Pago Contratos</th>
                      <th className="num">Debería</th>
                      <th className="num">Cobrado</th>
                      <th className="num">% Cobertura Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detailRows || []).map((row) => (
                      <tr key={row.sale_month}>
                        <td className="analysis-key-cell">{row.sale_month}</td>
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
              {detailHasNext ? (
                <div className="analysis-detail-more-wrap">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void loadDetail(appliedFilters, detailPage + 1, true)}
                    disabled={loadingDetail || applying}
                  >
                    {loadingDetail ? 'Cargando...' : 'Cargar más'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}
