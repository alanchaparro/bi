import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card } from '@heroui/react'
import { ActiveFilterChips, type FilterChip } from '../../components/filters/ActiveFilterChips'
import { MultiSelectFilter } from '../../components/filters/MultiSelectFilter'
import { SegmentedControl } from '../../components/filters/SegmentedControl'
import { AnalyticsPageHeader } from '../../components/analytics/AnalyticsPageHeader'
import { AnalyticsMetaBadges } from '../../components/analytics/AnalyticsMetaBadges'
import { AnalysisSelectionSummary } from '../../components/analytics/AnalysisSelectionSummary'
import { MetricExplainer } from '../../components/analytics/MetricExplainer'
import { AnalysisFiltersSkeleton } from '../../components/feedback/AnalysisFiltersSkeleton'
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

type CohorteKpiIconId = 'doc' | 'money' | 'check' | 'user' | 'card'

function CohorteKpiIcon({ icon }: { icon: CohorteKpiIconId }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (icon === 'doc')
    return (
      <svg {...common}>
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <path d="M14 3v6h6" />
      </svg>
    )
  if (icon === 'money')
    return (
      <svg {...common}>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    )
  if (icon === 'check')
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12.5 2.2 2.2 4.8-4.8" />
      </svg>
    )
  if (icon === 'user')
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20a8 8 0 0 1 16 0" />
      </svg>
    )
  return (
    <svg {...common}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  )
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

  const kpiCards: Record<
    KpiId,
    {
      title: string
      value: string
      fullValue?: string
      note?: string
      borderColor: string
      valueColor?: string
      icon: CohorteKpiIconId
    }
  > = {
    total_cobrado: {
      title: 'TOTAL COBRADO',
      value: formatGsFull(totals?.cobrado || 0),
      fullValue: formatGsFull(totals?.cobrado || 0),
      note: `${formatCount(totals?.pagaron || 0)} contratos pagaron`,
      borderColor: 'var(--color-primary)',
      valueColor: 'var(--color-primary)',
      icon: 'card',
    },
    deberia_cobrar: {
      title: 'DEBERÍA COBRAR',
      value: formatGsFull(totals?.deberia || 0),
      fullValue: formatGsFull(totals?.deberia || 0),
      note: `${formatCount(totals?.activos || 0)} contratos activos`,
      borderColor: 'var(--color-chart-5)',
      valueColor: 'var(--color-chart-5)',
      icon: 'money',
    },
    pago_contratos: {
      title: '% PAGO CONTRATOS',
      value: pct(totals?.pct_pago_contratos || 0),
      borderColor: 'var(--color-chart-2)',
      valueColor: 'var(--color-chart-2)',
      icon: 'check',
    },
    cobertura_monto: {
      title: '% COBERTURA MONTO',
      value: pct(totals?.pct_cobertura_monto || 0),
      borderColor: 'var(--color-chart-4)',
      valueColor: 'var(--color-chart-4)',
      icon: 'money',
    },
    ticket_transaccional: {
      title: 'TICKET TRANSACCIONAL',
      value: formatGsFull(ticketTransaccional),
      fullValue: formatGsFull(ticketTransaccional),
      note: `${formatCount(totals?.transacciones || 0)} transacciones`,
      borderColor: 'var(--color-chart-3)',
      valueColor: 'var(--color-chart-3)',
      icon: 'card',
    },
    ticket_contrato: {
      title: 'TICKET CONTRATO',
      value: formatGsFull(ticketContrato),
      fullValue: formatGsFull(ticketContrato),
      note: `${formatCount(totals?.pagaron || 0)} contratos con pago`,
      borderColor: 'var(--color-chart-6)',
      valueColor: 'var(--color-chart-6)',
      icon: 'user',
    },
  }

  const gestionBase = String(summary?.effective_cartera_month || summary?.cutoff_month || '')
  const cierreBase = monthMinusOne(gestionBase)

  const metaCohorte = (
    <>
      <AnalyticsMetaBadges meta={summary?.meta} />
      {summary?.cutoff_month ? (
        <span className="analysis-meta-chip">Corte de cobranza: <strong>{summary.cutoff_month}</strong></span>
      ) : null}
      {gestionBase ? (
        <span className="analysis-meta-chip">
          Gestion usada: <strong>{gestionBase}</strong>
          {cierreBase ? <> (Cierre base: <strong>{cierreBase}</strong>)</> : null}
        </span>
      ) : null}
    </>
  )

  return (
    <section className="analysis-card-wrap">
      <Card className="analysis-panel-card border border-[var(--color-border)] shadow-lg overflow-hidden p-6">
        <AnalyticsPageHeader
        kicker="COHORTE"
        pill="Analytics v2"
        title="Analisis de cobranzas por corte"
        subtitle="Cobro del corte seleccionado, segmentado por mes o año de venta y alineado a la gestion operativa."
        meta={metaCohorte}
      />
      <MetricExplainer
        items={[
          {
            label: "Corte y gestion",
            formula: "gestion_month = cierre + 1 mes",
            note: "La cohorte usa un corte de cobranza y una cartera efectiva alineada a gestion.",
          },
          {
            label: "Cobertura de monto",
            formula: "cobrado / deberia",
            note: "Compara lo cobrado frente a lo que se deberia cobrar en la cohorte activa.",
          },
          {
            label: "Pago por contratos",
            formula: "pagaron / activos",
            note: "Sigue la efectividad por cantidad de contratos dentro del corte seleccionado.",
          },
        ]}
      />

      {loadingOptions ? (
        <AnalysisFiltersSkeleton filterCount={5} kpiCount={6} showTable />
      ) : null}

      {!loadingOptions ? (
        <>
          <div className="rendimiento-filters-panel">
            <div className="cohorte-filters-grid-3" data-testid="analysis-filters-grid">
              <div className="analysis-filter-control">
                <label className="input-label" id="cutoff-month-label">Mes de cobro</label>
                <select
                  className="input input-heroui-tokens w-full min-h-10 rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--color-text)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  value={filters.cutoffMonth}
                  onChange={(e) => setFilters((prev) => ({ ...prev, cutoffMonth: e.target.value }))}
                  aria-labelledby="cutoff-month-label"
                >
                  {options.cutoffMonths.map((month) => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </select>
              </div>

              <MultiSelectFilter
                className="analysis-filter-control"
                label="Unidad de negocio"
                options={options.uns}
                selected={filters.uns}
                onChange={(values) => setFilters((prev) => ({ ...prev, uns: values }))}
                placeholder="Todos"
              />

              <SegmentedControl
                className="analysis-filter-control"
                label="Vía de cobro"
                options={[
                  { value: '', label: 'Todos' },
                  { value: 'DEBITO', label: 'Débito' },
                  { value: 'COBRADOR', label: 'Cobrador' },
                ]}
                value={selectedVia}
                onChange={(v) => setFilters((prev) => ({ ...prev, vias: v === '' ? [] : [v] }))}
              />

              <MultiSelectFilter
                className="analysis-filter-control"
                label="Supervisor"
                options={options.supervisors}
                selected={filters.supervisors}
                onChange={(values) => setFilters((prev) => ({ ...prev, supervisors: values }))}
                placeholder="Todos"
              />

              <SegmentedControl
                className="analysis-filter-control"
                label="Categoría"
                options={[
                  { value: '', label: 'Todas' },
                  { value: 'VIGENTE', label: 'Vigente' },
                  { value: 'MOROSO', label: 'Moroso' },
                ]}
                value={selectedCategoria}
                onChange={(v) => setFilters((prev) => ({ ...prev, categorias: v === '' ? [] : [v] }))}
              />
            </div>
            <div className="rendimiento-filter-hints" role="note" aria-label="Ayuda de filtros">
              <span className="rendimiento-filter-hint">Mes de cobro define el corte consultado.</span>
              <span className="rendimiento-filter-hint">La cartera efectiva se alinea a gestion operativa.</span>
              <span className="rendimiento-filter-hint">Vía de cobro y categoría segmentan la cohorte activa.</span>
            </div>

            <div className="analysis-actions-row analysis-actions">
              <Button variant="primary" onPress={onApply} isDisabled={applying}>
                {applying ? <span className="inline-spinner" aria-hidden /> : null}
                {applying ? 'Aplicando...' : 'Aplicar filtros'}
              </Button>
              <Button variant="outline" onPress={clearFilters} isDisabled={applying}>Limpiar</Button>
              <Button variant="outline" onPress={onReset} isDisabled={applying}>Restablecer</Button>
              <span className="analysis-active-count">
                {activeFilterChips.length} filtro{activeFilterChips.length === 1 ? '' : 's'} activo{activeFilterChips.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="analysis-active-filters">
              <ActiveFilterChips chips={activeFilterChips} onRemove={removeChip} />
            </div>
          </div>

          <AnalysisSelectionSummary
            items={[
              { label: "Mes de cobro", value: appliedFilters.cutoffMonth || "-" },
              { label: "UN", value: appliedFilters.uns.length ? appliedFilters.uns.join(", ") : "Todas" },
              { label: "Vía de cobro", value: appliedFilters.vias.length ? appliedFilters.vias.join(", ") : "Todas" },
              { label: "Categoría", value: appliedFilters.categorias.length ? appliedFilters.categorias.join(", ") : "Todas" },
              { label: "Supervisor", value: appliedFilters.supervisors.length ? appliedFilters.supervisors.join(", ") : "Todos" },
            ]}
          />

          {noCohorteData ? (
            <EmptyState
              className="analysis-empty"
              message="No hay datos de cobranzas por corte para los criterios seleccionados."
              suggestion="Prueba a cambiar el mes de cobro o los filtros. Si el sistema acaba de sincronizar, puede que aún no se hayan cargado los datos."
            />
          ) : null}

          {error ? <ErrorState message={error} className="analysis-error" onRetry={() => void retryLastRequest()} disabled={applying} /> : null}

          {applying && summary ? <LoadingState message="Actualizando resultados..." className="summary-loading-note" /> : null}
          {loadingSummary && !summary ? <LoadingState message="Cargando resumen inicial..." className="summary-loading-note" /> : null}
          {loadingDetail && summary ? <LoadingState message="Cargando detalle..." className="summary-loading-note" /> : null}

          <div className={`analysis-results data-transition ${applying || loadingSummary || loadingDetail ? 'data-transition--loading' : ''}`}>
            <div className="summary-grid rendimiento-kpi-summary-grid">
              {kpiOrder.map((kpiId) => {
                const card = kpiCards[kpiId]
                const isDragging = draggingKpi === kpiId
                const isDropTarget = dragOverKpi === kpiId && draggingKpi !== kpiId
                return (
                  <article
                    key={kpiId}
                    className={`card kpi-card analysis-card-pad ${isDragging ? 'dragging-card' : ''} ${isDropTarget ? 'chart-drop-target' : ''}`}
                    style={{ borderLeft: `4px solid ${card.borderColor}` }}
                    draggable
                    onDragStart={(e) => {
                      setDraggingKpi(kpiId)
                      setDragOverKpi(kpiId)
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', kpiId)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      if (dragOverKpi !== kpiId) setDragOverKpi(kpiId)
                      e.dataTransfer.dropEffect = 'move'
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const fromId = (e.dataTransfer.getData('text/plain') || draggingKpi || '') as KpiId
                      if (fromId) moveKpi(fromId, kpiId)
                      setDraggingKpi(null)
                      setDragOverKpi(null)
                    }}
                    onDragEnd={() => {
                      setDraggingKpi(null)
                      setDragOverKpi(null)
                    }}
                  >
                    <div className="chart-card-header">
                      <div className="kpi-card-title-wrap">
                        <span className="kpi-card-icon" aria-hidden>
                          <CohorteKpiIcon icon={card.icon} />
                        </span>
                        <span className="analysis-kpi-title">{card.title}</span>
                      </div>
                      <span className="chart-drag-handle" title="Arrastrar para reordenar" aria-hidden>
                        ::
                      </span>
                    </div>
                    <div
                      className="kpi-card-value"
                      style={{ color: card.valueColor || 'var(--color-text)' }}
                      title={card.fullValue || card.value}
                    >
                      {card.value}
                    </div>
                    {card.note ? <div className="analysis-kpi-note kpi-card-footnote">{card.note}</div> : null}
                  </article>
                )
              })}
            </div>

            {!hasRows ? <EmptyState className="analysis-empty" message="Sin datos para los filtros seleccionados." suggestion="Ajusta los filtros y vuelve a aplicar para ver resultados." /> : null}

            <div className="analysis-table-section">
              <p className="analysis-table-caption">
                {usesTramoBreakdown ? 'Resumen de efectividad por tramo.' : 'Resumen de efectividad por año de venta.'}
              </p>
              <p className="table-scroll-hint">Desliza la tabla horizontalmente para revisar todas las métricas.</p>
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
              <p className="table-scroll-hint">Desliza la tabla horizontalmente para revisar todas las métricas.</p>
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
                  <Button variant="outline" onPress={() => void loadDetail(appliedFilters, detailPage + 1, true)} isDisabled={loadingDetail || applying}>
                    {loadingDetail ? 'Cargando...' : 'Cargar más'}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
      </Card>
    </section>
  )
}
