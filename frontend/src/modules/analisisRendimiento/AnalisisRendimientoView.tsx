import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { MultiSelectFilter } from '../../components/filters/MultiSelectFilter'
import { ActiveFilterChips, type FilterChip } from '../../components/filters/ActiveFilterChips'
import { getApiErrorMessage } from '../../shared/apiErrors'
import { formatCount, formatGsFull } from '../../shared/formatters'
import {
  getRendimientoFirstPaint,
  getRendimientoOptions,
  getRendimientoSummary,
  markPerfReady,
  type RendimientoSummaryResponse,
} from '../../shared/api'

type Filters = {
  gestionMonths: string[]
  uns: string[]
  tramos: string[]
  viasCobro: string[]
  viasPago: string[]
  categorias: string[]
  supervisors: string[]
}

type Options = {
  gestionMonths: string[]
  uns: string[]
  tramos: string[]
  viasCobro: string[]
  viasPago: string[]
  categorias: string[]
  supervisors: string[]
}

type KpiId =
  | 'recuperacion_global'
  | 'contratos_asignados'
  | 'deuda_asignada'
  | 'contratos_con_cobro'
  | 'total_cobrado'
type SeriesPoint = { label: string; value: number }
type MultiValueFilterKey = keyof Filters

const EMPTY_FILTERS: Filters = {
  gestionMonths: [],
  uns: [],
  tramos: [],
  viasCobro: [],
  viasPago: [],
  categorias: [],
  supervisors: [],
}

const EMPTY_OPTIONS: Options = {
  gestionMonths: [],
  uns: [],
  tramos: [],
  viasCobro: [],
  viasPago: [],
  categorias: [],
  supervisors: [],
}

const pct = (num: number, den: number) => `${den > 0 ? ((num / den) * 100).toFixed(1) : '0.0'}%`
const pctNum = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0)
const RENDIMIENTO_KPI_ORDER_STORAGE = 'analisis_rendimiento_kpi_order_v1'
const RENDIMIENTO_CHART_LABELS_STORAGE = 'analisis_rendimiento_chart_labels_v1'
const DEFAULT_KPI_ORDER: KpiId[] = [
  'recuperacion_global',
  'contratos_asignados',
  'deuda_asignada',
  'contratos_con_cobro',
  'total_cobrado',
]

function readStoredOrder(defaults: KpiId[]): KpiId[] {
  try {
    const raw = window.localStorage.getItem(RENDIMIENTO_KPI_ORDER_STORAGE)
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

function monthSerial(value: string): number {
  const raw = String(value || '').trim()
  const parts = raw.split('/')
  if (parts.length !== 2) return 0
  const month = Number(parts[0] || 0)
  const year = Number(parts[1] || 0)
  if (!Number.isFinite(month) || !Number.isFinite(year) || month < 1 || month > 12 || year < 1) return 0
  return year * 12 + month
}

function readStoredChartLabels(): boolean {
  try {
    const raw = window.localStorage.getItem(RENDIMIENTO_CHART_LABELS_STORAGE)
    return raw === null ? true : raw !== '0'
  } catch {
    return true
  }
}

function toSummaryFromFirstPaint(data: Awaited<ReturnType<typeof getRendimientoFirstPaint>>): RendimientoSummaryResponse {
  return {
    totalDebt: Number(data?.totals?.totalDebt || 0),
    totalPaid: Number(data?.totals?.totalPaid || 0),
    totalContracts: Number(data?.totals?.totalContracts || 0),
    totalContractsPaid: Number(data?.totals?.totalContractsPaid || 0),
    tramoStats: {},
    unStats: {},
    viaCStats: {},
    gestorStats: {},
    matrixStats: {},
    trendStats: data?.mini_trend || {},
    meta: data?.meta,
  }
}

function percentLinePath(points: SeriesPoint[], width: number, height: number, padding: { top: number; right: number; bottom: number; left: number }) {
  if (!points.length) return ''
  const plotW = Math.max(1, width - padding.left - padding.right)
  const plotH = Math.max(1, height - padding.top - padding.bottom)
  return points
    .map((point, index) => {
      const x = padding.left + (index * plotW) / Math.max(1, points.length - 1)
      const y = padding.top + (1 - Math.max(0, Math.min(100, point.value)) / 100) * plotH
      return `${index === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')
}

function PercentLineChart({
  data,
  color,
  showLabels,
  ariaLabel,
}: {
  data: SeriesPoint[]
  color: string
  showLabels: boolean
  ariaLabel: string
}) {
  const width = 980
  const height = 270
  const padding = { top: 12, right: 16, bottom: 46, left: 42 }
  const plotW = Math.max(1, width - padding.left - padding.right)
  const plotH = Math.max(1, height - padding.top - padding.bottom)
  const linePath = percentLinePath(data, width, height, padding)
  const yTicks = [0, 25, 50, 75, 100]
  const labelStep = data.length > 12 ? Math.ceil(data.length / 12) : 1

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="rend-chart-svg" role="img" aria-label={ariaLabel}>
      {yTicks.map((tick) => {
        const y = padding.top + (1 - tick / 100) * plotH
        return (
          <g key={tick}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="rend-grid-line" />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="rend-axis-text">{tick}%</text>
          </g>
        )
      })}
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} className="rend-axis-line" />
      <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} className="rend-axis-line" />
      {linePath ? <path d={linePath} fill="none" stroke={color} strokeWidth={2.4} /> : null}
      {data.map((point, index) => {
        const x = padding.left + (index * plotW) / Math.max(1, data.length - 1)
        const y = padding.top + (1 - Math.max(0, Math.min(100, point.value)) / 100) * plotH
        const showX = index % labelStep === 0 || index === data.length - 1
        return (
          <g key={`${point.label}-${index}`}>
            <circle cx={x} cy={y} r={2.8} fill={color} />
            {showLabels ? (
              <g>
                <rect x={x - 22} y={y - 26} width={44} height={16} rx={6} className="rend-label-bg" />
                <text x={x} y={y - 14} textAnchor="middle" className="rend-label-text">{point.value.toFixed(1)}%</text>
              </g>
            ) : null}
            {showX ? <text x={x} y={height - padding.bottom + 16} textAnchor="middle" className="rend-axis-text">{point.label}</text> : null}
          </g>
        )
      })}
    </svg>
  )
}

function PercentBarChart({
  data,
  color,
  showLabels,
  ariaLabel,
}: {
  data: SeriesPoint[]
  color: string
  showLabels: boolean
  ariaLabel: string
}) {
  const width = 980
  const height = 280
  const padding = { top: 12, right: 16, bottom: 56, left: 42 }
  const plotW = Math.max(1, width - padding.left - padding.right)
  const plotH = Math.max(1, height - padding.top - padding.bottom)
  const gap = 10
  const barWidth = Math.max(10, (plotW - Math.max(0, data.length - 1) * gap) / Math.max(1, data.length))
  const yTicks = [0, 25, 50, 75, 100]
  const labelStep = data.length > 18 ? Math.ceil(data.length / 18) : 1

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="rend-chart-svg" role="img" aria-label={ariaLabel}>
      {yTicks.map((tick) => {
        const y = padding.top + (1 - tick / 100) * plotH
        return (
          <g key={tick}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="rend-grid-line" />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="rend-axis-text">{tick}%</text>
          </g>
        )
      })}
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} className="rend-axis-line" />
      <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} className="rend-axis-line" />
      {data.map((point, index) => {
        const x = padding.left + index * (barWidth + gap)
        const value = Math.max(0, Math.min(100, point.value))
        const barHeight = (value / 100) * plotH
        const y = height - padding.bottom - barHeight
        const showX = index % labelStep === 0 || index === data.length - 1
        return (
          <g key={`${point.label}-${index}`}>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx={6} fill={color} opacity={0.92} />
            {showLabels && barHeight > 18 ? (
              <text
                x={x + barWidth / 2}
                y={y + barHeight / 2}
                textAnchor="middle"
                className="rend-label-text"
                transform={`rotate(-90 ${x + barWidth / 2} ${y + barHeight / 2})`}
              >
                {value.toFixed(1)}%
              </text>
            ) : null}
            {showX ? <text x={x + barWidth / 2} y={height - padding.bottom + 18} textAnchor="middle" className="rend-axis-text">{point.label}</text> : null}
          </g>
        )
      })}
    </svg>
  )
}

export function AnalisisRendimientoView() {
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [options, setOptions] = useState<Options>(EMPTY_OPTIONS)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS)
  const [summary, setSummary] = useState<RendimientoSummaryResponse | null>(null)
  const [kpiOrder, setKpiOrder] = useState<KpiId[]>(() => readStoredOrder(DEFAULT_KPI_ORDER))
  const [draggingKpi, setDraggingKpi] = useState<KpiId | null>(null)
  const [dragOverKpi, setDragOverKpi] = useState<KpiId | null>(null)
  const [showChartLabels, setShowChartLabels] = useState<boolean>(() => readStoredChartLabels())

  useEffect(() => {
    try {
      window.localStorage.setItem(RENDIMIENTO_KPI_ORDER_STORAGE, JSON.stringify(kpiOrder))
    } catch {
      // ignore storage failures
    }
  }, [kpiOrder])

  useEffect(() => {
    try {
      window.localStorage.setItem(RENDIMIENTO_CHART_LABELS_STORAGE, showChartLabels ? '1' : '0')
    } catch {
      // ignore storage failures
    }
  }, [showChartLabels])

  const loadSummary = useCallback(async (next: Filters, withLoader = false) => {
    if (withLoader) setLoadingSummary(true)
    try {
      const payload = {
        gestion_month: next.gestionMonths,
        un: next.uns,
        tramo: next.tramos,
        via_cobro: next.viasCobro,
        via_pago: next.viasPago,
        categoria: next.categorias,
        supervisor: next.supervisors,
      }
      const data = await getRendimientoSummary(payload)
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
        const opts = await getRendimientoOptions({})
        const nextOptions: Options = {
          gestionMonths: opts.options.gestion_months || [],
          uns: opts.options.uns || [],
          tramos: opts.options.tramos || [],
          viasCobro: opts.options.vias_cobro || [],
          viasPago: opts.options.vias_pago || [],
          categorias: opts.options.categorias || [],
          supervisors: opts.options.supervisors || [],
        }
        const defaultMonth = opts.default_gestion_month || nextOptions.gestionMonths[nextOptions.gestionMonths.length - 1] || ''
        const nextFilters: Filters = { ...EMPTY_FILTERS, gestionMonths: defaultMonth ? [defaultMonth] : [] }
        setOptions(nextOptions)
        setFilters(nextFilters)
        setAppliedFilters(nextFilters)
        const payload = {
          gestion_month: nextFilters.gestionMonths,
          un: nextFilters.uns,
          tramo: nextFilters.tramos,
          via_cobro: nextFilters.viasCobro,
          via_pago: nextFilters.viasPago,
          categoria: nextFilters.categorias,
          supervisor: nextFilters.supervisors,
        }
        const fp = await getRendimientoFirstPaint(payload)
        setSummary(toSummaryFromFirstPaint(fp))
        await loadSummary(nextFilters, true)
        await markPerfReady('rendimiento')
      } catch (e: unknown) {
        setError(getApiErrorMessage(e))
      } finally {
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
      const defaultMonth = options.gestionMonths[options.gestionMonths.length - 1] || ''
      const resetFilters: Filters = { ...EMPTY_FILTERS, gestionMonths: defaultMonth ? [defaultMonth] : [] }
      setFilters(resetFilters)
      setAppliedFilters(resetFilters)
      await loadSummary(resetFilters)
    } catch (e: unknown) {
      setError(getApiErrorMessage(e))
    } finally {
      setApplying(false)
    }
  }, [loadSummary, options.gestionMonths])

  useEffect(() => {
    if (!summary || loadingSummary || applying) return
    void markPerfReady('rendimiento')
  }, [applying, loadingSummary, summary])

  const trendAmountSeries = useMemo<SeriesPoint[]>(
    () =>
      Object.entries(summary?.trendStats || {})
        .sort((a, b) => monthSerial(a[0]) - monthSerial(b[0]))
        .map(([label, values]) => ({
          label,
          value: pctNum(Number(values?.p || 0), Number(values?.d || 0)),
        })),
    [summary?.trendStats],
  )

  const trendCountSeries = useMemo<SeriesPoint[]>(
    () =>
      Object.entries(summary?.trendStats || {})
        .sort((a, b) => monthSerial(a[0]) - monthSerial(b[0]))
        .map(([label, values]) => ({
          label,
          value: pctNum(Number(values?.cp || 0), Number(values?.c || 0)),
        })),
    [summary?.trendStats],
  )

  const tramoSeries = useMemo<SeriesPoint[]>(
    () =>
      Object.entries(summary?.tramoStats || {})
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([label, values]) => ({
          label: `Tramo ${label}`,
          value: pctNum(Number(values?.p || 0), Number(values?.d || 0)),
        })),
    [summary?.tramoStats],
  )

  const unSeries = useMemo<SeriesPoint[]>(
    () =>
      Object.entries(summary?.unStats || {})
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([label, values]) => ({
          label,
          value: pctNum(Number(values?.p || 0), Number(values?.d || 0)),
        })),
    [summary?.unStats],
  )

  const viaCobroSeries = useMemo<SeriesPoint[]>(
    () =>
      Object.entries(summary?.viaCStats || {})
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([label, values]) => ({
          label,
          value: pctNum(Number(values?.p || 0), Number(values?.d || 0)),
        })),
    [summary?.viaCStats],
  )

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
    recuperacion_global: {
      title: 'Recuperación Global',
      value: pct(Number(summary?.totalPaid || 0), Number(summary?.totalDebt || 0)),
      className: 'cohorte-kpi-emerald',
    },
    contratos_asignados: {
      title: 'Contratos Asignados',
      value: formatCount(summary?.totalContracts || 0),
      className: 'cohorte-kpi-primary',
    },
    deuda_asignada: {
      title: 'Deuda Asignada',
      value: formatGsFull(summary?.totalDebt || 0),
      className: 'cohorte-kpi-gold',
    },
    contratos_con_cobro: {
      title: 'Contratos con Cobro',
      value: formatCount(summary?.totalContractsPaid || 0),
      className: 'cohorte-kpi-cyan',
    },
    total_cobrado: {
      title: 'Total Cobrado',
      value: formatGsFull(summary?.totalPaid || 0),
      note: `${formatCount(summary?.totalContractsPaid || 0)} contratos con cobro`,
      className: 'cohorte-kpi-primary',
    },
  }

  const activeFilterChips = useMemo<FilterChip[]>(() => {
    const blocks: Array<{ key: MultiValueFilterKey; label: string }> = [
      { key: 'gestionMonths', label: 'Mes de Gestión' },
      { key: 'uns', label: 'Unidad de Negocio' },
      { key: 'tramos', label: 'Tramo' },
      { key: 'viasCobro', label: 'Vía Cobro' },
      { key: 'viasPago', label: 'Vía Pago' },
      { key: 'categorias', label: 'Categoría' },
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

  return (
    <section className="card analysis-card rendimiento-card">
      <div className="cohorte-header">
        <div className="cohorte-header-row">
          <span className="cohorte-kicker">Panel ejecutivo</span>
          <span className="cohorte-live-pill">Rendimiento</span>
        </div>
        <h2>Rendimiento de Cartera (Eficacia)</h2>
        <p className="cohorte-subtitle">Cruce de cartera con cobranzas por contrato y mes de gestión.</p>
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
        </div>
      ) : (
        <>
          <div className="cohorte-filters-grid">
            <MultiSelectFilter
              className="cohorte-filter-control"
              label="Mes de Gestión"
              options={options.gestionMonths}
              selected={filters.gestionMonths}
              onChange={(values) => setFilters((prev) => ({ ...prev, gestionMonths: values }))}
              placeholder="Historia"
            />

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
              label="Tramo"
              options={options.tramos}
              selected={filters.tramos}
              onChange={(values) => setFilters((prev) => ({ ...prev, tramos: values }))}
              placeholder="Todos"
            />
            <MultiSelectFilter
              className="cohorte-filter-control"
              label="Vía Cobro (Intención)"
              options={options.viasCobro}
              selected={filters.viasCobro}
              onChange={(values) => setFilters((prev) => ({ ...prev, viasCobro: values }))}
              placeholder="Todas"
            />
            <MultiSelectFilter
              className="cohorte-filter-control"
              label="Vía Pago (Real)"
              options={options.viasPago}
              selected={filters.viasPago}
              onChange={(values) => setFilters((prev) => ({ ...prev, viasPago: values }))}
              placeholder="Todas"
            />
            <MultiSelectFilter
              className="cohorte-filter-control"
              label="Categoría"
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

          <div className="cohorte-actions-row">
            <button type="button" className="btn btn-primary" onClick={() => void onApply()} disabled={applying || loadingSummary}>
              {applying ? 'Aplicando...' : 'Aplicar filtros'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => void onReset()} disabled={applying || loadingSummary}>
              Resetear
            </button>
            <label className="rendimiento-label-toggle">
              <input
                type="checkbox"
                checked={showChartLabels}
                onChange={(event) => setShowChartLabels(event.target.checked)}
              />
              Mostrar números en gráficos
            </label>
            <span className="cohorte-actions-hint">
              Gestión aplicada: <strong>{appliedFilters.gestionMonths.length ? `${appliedFilters.gestionMonths.length} mes(es)` : 'Historia'}</strong>
            </span>
          </div>

          <div className="cohorte-active-filters">
            <ActiveFilterChips chips={activeFilterChips} onRemove={removeChip} />
          </div>
        </>
      )}

      {error ? <div className="alert-error rendimiento-alert">{error}</div> : null}

      {!loadingOptions && !error ? (
        <>
          <div className="cohorte-kpis rendimiento-kpis-auto">
            {kpiOrder.map((kpiId) => {
              const card = kpiCards[kpiId]
              const isDragging = draggingKpi === kpiId
              const isDropTarget = dragOverKpi === kpiId && draggingKpi !== kpiId
              return (
                <article
                  key={kpiId}
                  className={`cohorte-kpi-card ${card.className} ${isDragging ? 'is-dragging' : ''} ${isDropTarget ? 'is-drop-target' : ''}`}
                  draggable
                  onDragStart={(event) => {
                    setDraggingKpi(kpiId)
                    setDragOverKpi(kpiId)
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', kpiId)
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    if (dragOverKpi !== kpiId) setDragOverKpi(kpiId)
                    event.dataTransfer.dropEffect = 'move'
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const sourceId = (event.dataTransfer.getData('text/plain') || draggingKpi || '') as KpiId
                    if (sourceId) moveKpi(sourceId, kpiId)
                    setDraggingKpi(null)
                    setDragOverKpi(null)
                  }}
                  onDragEnd={() => {
                    setDraggingKpi(null)
                    setDragOverKpi(null)
                  }}
                >
                  <div className="kpi-card-title">{card.title}</div>
                  <strong className="kpi-card-value">{card.value}</strong>
                  {card.note ? <small>{card.note}</small> : null}
                </article>
              )
            })}
          </div>

          <div className="charts-grid rendimiento-charts-grid">
            <article className="card chart-card chart-card-wide rend-chart-card">
              <h3 className="rend-chart-title">Evolución de Rendimiento (Tendencia)</h3>
              {trendAmountSeries.length ? <PercentLineChart data={trendAmountSeries} color="#38bdf8" showLabels={showChartLabels} ariaLabel="Evolución de rendimiento por mes en porcentaje de eficacia" /> : <div className="rend-no-data">Sin datos.</div>}
            </article>

            <article className="card chart-card chart-card-wide rend-chart-card">
              <h3 className="rend-chart-title">% Eficacia por Cantidad (Tendencia)</h3>
              {trendCountSeries.length ? <PercentLineChart data={trendCountSeries} color="#f59e0b" showLabels={showChartLabels} ariaLabel="Eficacia por cantidad por mes en porcentaje" /> : <div className="rend-no-data">Sin datos.</div>}
            </article>

            <article className="card chart-card chart-card-wide rend-chart-card">
              <h3 className="rend-chart-title">% Eficacia por Tramo</h3>
              {tramoSeries.length ? <PercentBarChart data={tramoSeries} color="#818cf8" showLabels={showChartLabels} ariaLabel="Eficacia por tramo en porcentaje" /> : <div className="rend-no-data">Sin datos.</div>}
            </article>

            <article className="card chart-card chart-card-wide rend-chart-card">
              <h3 className="rend-chart-title">% Eficacia por UN</h3>
              {unSeries.length ? <PercentBarChart data={unSeries} color="#6366f1" showLabels={showChartLabels} ariaLabel="Eficacia por unidad de negocio en porcentaje" /> : <div className="rend-no-data">Sin datos.</div>}
            </article>

            <article className="card chart-card chart-card-wide rend-chart-card">
              <h3 className="rend-chart-title">% Eficacia por Vía de Cobro (Intención)</h3>
              {viaCobroSeries.length ? <PercentBarChart data={viaCobroSeries} color="#10b981" showLabels={showChartLabels} ariaLabel="Eficacia por vía de cobro intención en porcentaje" /> : <div className="rend-no-data">Sin datos.</div>}
            </article>
          </div>
        </>
      ) : null} 
    </section>
  )
}

