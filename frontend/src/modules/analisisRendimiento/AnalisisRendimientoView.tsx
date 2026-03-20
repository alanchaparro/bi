import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@heroui/react'
import { MultiSelectFilter } from '../../components/filters/MultiSelectFilter'
import { ActiveFilterChips, type FilterChip } from '../../components/filters/ActiveFilterChips'
import { AnalyticsPageHeader } from '../../components/analytics/AnalyticsPageHeader'
import { AnalyticsMetaBadges } from '../../components/analytics/AnalyticsMetaBadges'
import { AnalysisSelectionSummary } from '../../components/analytics/AnalysisSelectionSummary'
import { ChartSection } from '../../components/analytics/ChartSection'
import { MetricExplainer } from '../../components/analytics/MetricExplainer'
import { ErrorState } from '../../components/feedback/ErrorState'
import { LoadingState } from '../../components/feedback/LoadingState'
import { AnalysisFiltersSkeleton } from '../../components/feedback/AnalysisFiltersSkeleton'
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
  defaultGestionMonth: string
  uns: string[]
  tramos: string[]
  viasCobro: string[]
  viasPago: string[]
  categorias: string[]
  supervisors: string[]
}

type KpiId =
  | 'rendimiento_monto'
  | 'rendimiento_cantidad'
  | 'contratos_por_cobrar'
  | 'contratos_con_cobro'
  | 'monto_a_cobrar'
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
  defaultGestionMonth: '',
  uns: [],
  tramos: [],
  viasCobro: [],
  viasPago: [],
  categorias: [],
  supervisors: [],
}

const pct = (num: number, den: number) => `${den > 0 ? ((num / den) * 100).toFixed(1) : '0.0'}%`
const pctNum = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0)
const RENDIMIENTO_KPI_ORDER_STORAGE = 'analisis_rendimiento_kpi_order_v2'
const RENDIMIENTO_CHART_LABELS_STORAGE = 'analisis_rendimiento_chart_labels_v1'
const DEFAULT_KPI_ORDER: KpiId[] = [
  'rendimiento_monto',
  'rendimiento_cantidad',
  'contratos_por_cobrar',
  'contratos_con_cobro',
  'monto_a_cobrar',
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

function percentLinePath(
  points: SeriesPoint[],
  width: number,
  height: number,
  padding: { top: number; right: number; bottom: number; left: number },
) {
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

function hasAnyAppliedFilter(filters: Filters): boolean {
  return Object.values(filters).some((values) => values.length > 0)
}

function getChartEmptyCopy(hasOptions: boolean, hasFilters: boolean) {
  if (!hasOptions) {
    return {
      message: 'Sin datos cargados para rendimiento.',
      suggestion: 'Verifica el sync y la carga de opciones de analytics.',
    }
  }
  if (hasFilters) {
    return {
      message: 'Sin resultados para los filtros seleccionados.',
      suggestion: 'Prueba con otro mes de gestión, tramo, categoría o unidad de negocio.',
    }
  }
  return {
    message: 'Todavía no hay resultados para mostrar.',
    suggestion: 'Vuelve a intentar luego o revisa la disponibilidad del dataset.',
  }
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
          defaultGestionMonth: opts.default_gestion_month || '',
          uns: opts.options.uns || [],
          tramos: opts.options.tramos || [],
          viasCobro: opts.options.vias_cobro || [],
          viasPago: opts.options.vias_pago || [],
          categorias: opts.options.categorias || [],
          supervisors: opts.options.supervisors || [],
        }
        const defaultMonth = nextOptions.defaultGestionMonth || nextOptions.gestionMonths[nextOptions.gestionMonths.length - 1] || ''
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
        await markPerfReady('rendimiento')
        void loadSummary(nextFilters, true).catch((e: unknown) => setError(getApiErrorMessage(e)))
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
      const fp = await getRendimientoFirstPaint({
        gestion_month: filters.gestionMonths,
        un: filters.uns,
        tramo: filters.tramos,
        via_cobro: filters.viasCobro,
        via_pago: filters.viasPago,
        categoria: filters.categorias,
        supervisor: filters.supervisors,
      })
      setSummary(toSummaryFromFirstPaint(fp))
      await markPerfReady('rendimiento')
      void loadSummary(filters, true).catch((e: unknown) => setError(getApiErrorMessage(e)))
    } catch (e: unknown) {
      setError(getApiErrorMessage(e))
    } finally {
      setApplying(false)
    }
  }, [filters, loadSummary])

  const clearFilters = useCallback(() => {
    const defaultMonth = options.defaultGestionMonth || options.gestionMonths?.[options.gestionMonths.length - 1] || ''
    setFilters({ ...EMPTY_FILTERS, gestionMonths: defaultMonth ? [defaultMonth] : [] })
  }, [options.defaultGestionMonth, options.gestionMonths])

  const onReset = useCallback(async () => {
    try {
      setApplying(true)
      setError(null)
      const defaultMonth = options.defaultGestionMonth || options.gestionMonths[options.gestionMonths.length - 1] || ''
      const resetFilters: Filters = { ...EMPTY_FILTERS, gestionMonths: defaultMonth ? [defaultMonth] : [] }
      setFilters(resetFilters)
      setAppliedFilters(resetFilters)
      const fp = await getRendimientoFirstPaint({
        gestion_month: resetFilters.gestionMonths,
      })
      setSummary(toSummaryFromFirstPaint(fp))
      await markPerfReady('rendimiento')
      void loadSummary(resetFilters, true).catch((e: unknown) => setError(getApiErrorMessage(e)))
    } catch (e: unknown) {
      setError(getApiErrorMessage(e))
    } finally {
      setApplying(false)
    }
  }, [loadSummary, options.defaultGestionMonth, options.gestionMonths])

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

  const hasOptions = useMemo(
    () => Object.values(options).some((value) => Array.isArray(value) && value.length > 0),
    [options],
  )
  const hasAppliedFilters = useMemo(() => hasAnyAppliedFilter(appliedFilters), [appliedFilters])
  const emptyCopy = useMemo(() => getChartEmptyCopy(hasOptions, hasAppliedFilters), [hasAppliedFilters, hasOptions])

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
    rendimiento_monto: {
      title: 'Rendimiento por monto',
      value: pct(Number(summary?.totalPaid || 0), Number(summary?.totalDebt || 0)),
      note: 'Cobrado / monto a cobrar',
      className: 'cohorte-kpi-emerald',
    },
    rendimiento_cantidad: {
      title: 'Rendimiento por cantidad',
      value: pct(Number(summary?.totalContractsPaid || 0), Number(summary?.totalContracts || 0)),
      note: 'Contratos con cobro / contratos por cobrar',
      className: 'cohorte-kpi-cyan',
    },
    contratos_por_cobrar: {
      title: 'Contratos por cobrar',
      value: formatCount(summary?.totalContracts || 0),
      note: 'Base filtrada por mes de gestión',
      className: 'cohorte-kpi-primary',
    },
    contratos_con_cobro: {
      title: 'Contratos con cobro',
      value: formatCount(summary?.totalContractsPaid || 0),
      note: 'Cantidad de contratos con pago registrado',
      className: 'cohorte-kpi-primary',
    },
    monto_a_cobrar: {
      title: 'Monto a cobrar',
      value: formatGsFull(summary?.totalDebt || 0),
      note: 'Monto vencido + monto cuota',
      className: 'cohorte-kpi-gold',
    },
    total_cobrado: {
      title: 'Total cobrado',
      value: formatGsFull(summary?.totalPaid || 0),
      note: `${formatCount(summary?.totalContractsPaid || 0)} contratos con cobro`,
      className: 'cohorte-kpi-primary',
    },
  }

  const activeFilterChips = useMemo<FilterChip[]>(() => {
    const blocks: Array<{ key: MultiValueFilterKey; label: string }> = [
      { key: 'gestionMonths', label: 'Mes de gestión' },
      { key: 'uns', label: 'Unidad de negocio' },
      { key: 'tramos', label: 'Tramo' },
      { key: 'viasCobro', label: 'Vía de cobro' },
      { key: 'viasPago', label: 'Vía de pago' },
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
    <section className="card analysis-card analysis-panel-card rendimiento-panel">
      <div className="rendimiento-hero">
        <AnalyticsPageHeader
          kicker="RENDIMIENTO"
          pill="Analytics v2"
          title="Rendimiento de cartera"
          subtitle="Cruce de cartera y cobranzas por contrato y mes de gestión para seguimiento por monto y cantidad."
          meta={<AnalyticsMetaBadges meta={summary?.meta} />}
        />

        <MetricExplainer
          items={[
            {
              label: 'Rendimiento por monto',
              formula: 'cobrado / monto_a_cobrar',
              note: 'Monto a cobrar = monto vencido + monto cuota.',
            },
            {
              label: 'Rendimiento por cantidad',
              formula: 'contratos_con_cobro / contratos_por_cobrar',
              note: 'La pantalla compara contratos con pago vs contratos de la base filtrada.',
            },
            {
              label: 'Categorías por tramo',
              formula: 'VIGENTE = 0..3 | MOROSO = >3',
              note: 'Los cortes operativos siguen mes de gestión, no fecha de cierre.',
            },
          ]}
        />
      </div>

      {loadingOptions ? (
        <AnalysisFiltersSkeleton filterCount={7} kpiCount={6} showTable />
      ) : (
        <div className="rendimiento-filters-panel">
          <div className="analysis-filters-grid">
            <MultiSelectFilter
              className="analysis-filter-control"
              label="Mes de gestión"
              options={options.gestionMonths}
              selected={filters.gestionMonths}
              onChange={(values) => setFilters((prev) => ({ ...prev, gestionMonths: values }))}
              placeholder="Historia"
            />
            <MultiSelectFilter
              className="analysis-filter-control"
              label="Unidad de negocio"
              options={options.uns}
              selected={filters.uns}
              onChange={(values) => setFilters((prev) => ({ ...prev, uns: values }))}
              placeholder="Todas"
            />
            <MultiSelectFilter
              className="analysis-filter-control"
              label="Tramo"
              options={options.tramos}
              selected={filters.tramos}
              onChange={(values) => setFilters((prev) => ({ ...prev, tramos: values }))}
              placeholder="Todos"
            />
            <MultiSelectFilter
              className="analysis-filter-control"
              label="Vía de cobro"
              options={options.viasCobro}
              selected={filters.viasCobro}
              onChange={(values) => setFilters((prev) => ({ ...prev, viasCobro: values }))}
              placeholder="Todas"
            />
            <MultiSelectFilter
              className="analysis-filter-control"
              label="Vía de pago"
              options={options.viasPago}
              selected={filters.viasPago}
              onChange={(values) => setFilters((prev) => ({ ...prev, viasPago: values }))}
              placeholder="Todas"
            />
            <MultiSelectFilter
              className="analysis-filter-control"
              label="Categoría"
              options={options.categorias}
              selected={filters.categorias}
              onChange={(values) => setFilters((prev) => ({ ...prev, categorias: values }))}
              placeholder="Todas"
            />
            <MultiSelectFilter
              className="analysis-filter-control"
              label="Supervisor"
              options={options.supervisors}
              selected={filters.supervisors}
              onChange={(values) => setFilters((prev) => ({ ...prev, supervisors: values }))}
              placeholder="Todos"
            />
          </div>

          <div className="rendimiento-filter-hints" role="note" aria-label="Ayuda de filtros">
            <span className="rendimiento-filter-hint">Mes de gestión usa `gestion_month`.</span>
            <span className="rendimiento-filter-hint">Vía de cobro = intención operativa.</span>
            <span className="rendimiento-filter-hint">Vía de pago = cobro real registrado.</span>
          </div>

          <div className="analysis-actions-row analysis-actions">
            <Button variant="primary" onPress={() => void onApply()} isDisabled={applying || loadingSummary}>
              {applying ? <span className="inline-spinner" aria-hidden /> : null}
              {applying ? 'Aplicando...' : 'Aplicar filtros'}
            </Button>
            <Button variant="outline" onPress={clearFilters} isDisabled={applying || loadingSummary}>
              Limpiar
            </Button>
            <Button variant="outline" onPress={() => void onReset()} isDisabled={applying || loadingSummary}>
              Restablecer
            </Button>
            <span className="analysis-active-count">
              {activeFilterChips.length} filtro{activeFilterChips.length === 1 ? '' : 's'} activo{activeFilterChips.length === 1 ? '' : 's'}
            </span>
            <label className="rendimiento-label-toggle">
              <input type="checkbox" checked={showChartLabels} onChange={(e) => setShowChartLabels(e.target.checked)} />
              Mostrar numeros en graficos
            </label>
          </div>

          <div className="analysis-active-filters">
            <ActiveFilterChips chips={activeFilterChips} onRemove={removeChip} />
          </div>
        </div>
      )}

      {error ? (
        <ErrorState
          message={error}
          className="rendimiento-alert"
          onRetry={() => void onApply()}
          retryLabel="Reintentar"
        />
      ) : null}

      {loadingSummary && !error ? <LoadingState message="Actualizando rendimiento..." /> : null}

      {!loadingOptions && !error ? (
        <div className={`data-transition ${loadingSummary ? 'data-transition--loading' : ''}`}>
          <div className="rendimiento-selection-block">
            <AnalysisSelectionSummary
              items={[
                { label: 'Mes de gestión', value: appliedFilters.gestionMonths.length ? appliedFilters.gestionMonths.join(', ') : 'Historia' },
                { label: 'UN', value: appliedFilters.uns.length ? appliedFilters.uns.join(', ') : 'Todas' },
                { label: 'Tramo', value: appliedFilters.tramos.length ? appliedFilters.tramos.join(', ') : 'Todos' },
                { label: 'Vía de cobro', value: appliedFilters.viasCobro.length ? appliedFilters.viasCobro.join(', ') : 'Todas' },
                { label: 'Vía de pago', value: appliedFilters.viasPago.length ? appliedFilters.viasPago.join(', ') : 'Todas' },
                { label: 'Categoría', value: appliedFilters.categorias.length ? appliedFilters.categorias.join(', ') : 'Todas' },
                { label: 'Supervisor', value: appliedFilters.supervisors.length ? appliedFilters.supervisors.join(', ') : 'Todos' },
              ]}
            />
          </div>

          <div className="analysis-kpis rendimiento-kpis-auto">
            {kpiOrder.map((kpiId) => {
              const card = kpiCards[kpiId]
              const isDragging = draggingKpi === kpiId
              const isDropTarget = dragOverKpi === kpiId && draggingKpi !== kpiId
              return (
                <article
                  key={kpiId}
                  className={`analysis-kpi-card ${card.className} ${isDragging ? 'is-dragging' : ''} ${isDropTarget ? 'is-drop-target' : ''}`}
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
            <ChartSection
              title="Tendencia de rendimiento por monto"
              subtitle="Sigue el porcentaje cobrado sobre monto a cobrar por mes de gestión."
              hasData={trendAmountSeries.length > 0}
              emptyMessage={emptyCopy.message}
              emptySuggestion={emptyCopy.suggestion}
            >
              <PercentLineChart
                data={trendAmountSeries}
                color="var(--color-chart-1)"
                showLabels={showChartLabels}
                ariaLabel="Tendencia de rendimiento por monto por mes de gestión"
              />
            </ChartSection>

            <ChartSection
              title="Tendencia de rendimiento por cantidad"
              subtitle="Compara contratos con cobro sobre contratos por cobrar por mes de gestión."
              hasData={trendCountSeries.length > 0}
              emptyMessage={emptyCopy.message}
              emptySuggestion={emptyCopy.suggestion}
            >
              <PercentLineChart
                data={trendCountSeries}
                color="var(--color-chart-5)"
                showLabels={showChartLabels}
                ariaLabel="Tendencia de rendimiento por cantidad por mes de gestión"
              />
            </ChartSection>

            <ChartSection
              title="Rendimiento por tramo"
              subtitle="Lectura rápida por tramo con la categoría operativa vigente o moroso."
              hasData={tramoSeries.length > 0}
              emptyMessage={emptyCopy.message}
              emptySuggestion={emptyCopy.suggestion}
            >
              <PercentBarChart
                data={tramoSeries}
                color="var(--color-chart-2)"
                showLabels={showChartLabels}
                ariaLabel="Rendimiento por tramo en porcentaje"
              />
            </ChartSection>

            <ChartSection
              title="Rendimiento por unidad de negocio"
              subtitle="Permite comparar la eficacia entre unidades de negocio de la base filtrada."
              hasData={unSeries.length > 0}
              emptyMessage={emptyCopy.message}
              emptySuggestion={emptyCopy.suggestion}
            >
              <PercentBarChart
                data={unSeries}
                color="var(--color-chart-3)"
                showLabels={showChartLabels}
                ariaLabel="Rendimiento por unidad de negocio en porcentaje"
              />
            </ChartSection>

            <ChartSection
              title="Rendimiento por vía de cobro"
              subtitle="Cruza la intención operativa de cobro con el resultado agregado de cobranzas."
              hasData={viaCobroSeries.length > 0}
              emptyMessage={emptyCopy.message}
              emptySuggestion={emptyCopy.suggestion}
            >
              <PercentBarChart
                data={viaCobroSeries}
                color="var(--color-chart-4)"
                showLabels={showChartLabels}
                ariaLabel="Rendimiento por vía de cobro en porcentaje"
              />
            </ChartSection>
          </div>
        </div>
      ) : null}
    </section>
  )
}
