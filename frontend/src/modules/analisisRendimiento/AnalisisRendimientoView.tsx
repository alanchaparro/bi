import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@heroui/react'
import { MultiSelectFilter } from '../../components/filters/MultiSelectFilter'
import { FloatingQuickFilters } from '../../components/filters/FloatingQuickFilters'
import { SegmentedControl } from '../../components/filters/SegmentedControl'
import { ViaSegmentedOrMulti } from '../../components/filters/ViaSegmentedOrMulti'
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

/** Paleta secuencial alineada al análisis de cartera (barras por categoría / tramo). */
const RENDIMIENTO_BAR_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-chart-6)',
  'var(--color-chart-7)',
]

const pct = (num: number, den: number) => `${den > 0 ? ((num / den) * 100).toFixed(1) : '0.0'}%`
const pctNum = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0)

type RendimientoKpiIconId = 'doc' | 'money' | 'check' | 'user' | 'card'

function RendimientoKpiIcon({ icon }: { icon: RendimientoKpiIconId }) {
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

/** Escala Y en % (tope 100): zoom cuando el máximo real es bajo, para separar barras cercanas a cero. */
function buildPercentYAxis(values: Iterable<number>): { axisMax: number; yTicks: number[] } {
  let m = 0
  for (const v of values) {
    if (Number.isFinite(v)) m = Math.max(m, v)
  }
  m = Math.max(0, Math.min(100, m))
  if (m >= 92.5) {
    return { axisMax: 100, yTicks: [0, 25, 50, 75, 100] }
  }
  if (m <= 0) {
    return { axisMax: 25, yTicks: [0, 5, 10, 15, 20, 25] }
  }
  const target = Math.min(100, m * 1.12)
  let step: number
  if (target <= 30) step = 5
  else if (target <= 60) step = 10
  else step = 20
  const axisMax = Math.min(100, Math.max(step, Math.ceil(target / step) * step))
  const yTicks: number[] = []
  for (let t = 0; t <= axisMax + 1e-9; t += step) {
    yTicks.push(Math.round(t * 100) / 100)
  }
  return { axisMax, yTicks }
}

function toSummaryFromFirstPaint(data: Awaited<ReturnType<typeof getRendimientoFirstPaint>>): RendimientoSummaryResponse {
  return {
    totalDebt: Number(data?.totals?.totalDebt || 0),
    totalPaid: Number(data?.totals?.totalPaid || 0),
    totalContracts: Number(data?.totals?.totalContracts || 0),
    totalContractsPaid: Number(data?.totals?.totalContractsPaid || 0),
    tramoStatsByGestionMonth: {},
    unStatsByGestionMonth: {},
    viaCStatsByGestionMonth: {},
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
  colors,
  showLabels,
  ariaLabel,
}: {
  data: SeriesPoint[]
  color?: string
  colors?: string[]
  showLabels: boolean
  ariaLabel: string
}) {
  const width = 980
  const height = 280
  const tiltX =
    data.length > 5 || data.some((p) => (p.label || '').length > 12)
  const padding = { top: 28, right: 16, bottom: tiltX ? 84 : 56, left: 42 }
  const plotW = Math.max(1, width - padding.left - padding.right)
  const plotH = Math.max(1, height - padding.top - padding.bottom)
  const gap = 10
  const barWidth = Math.max(12, Math.min(36, (plotW - Math.max(0, data.length - 1) * gap) / Math.max(1, data.length)))
  const { axisMax, yTicks } = buildPercentYAxis(data.map((p) => p.value))
  const labelStep = data.length > 18 ? Math.ceil(data.length / 18) : 1

  const barFill = (index: number) => {
    if (colors?.length) return colors[index % colors.length]
    return color || 'var(--color-chart-1)'
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="rend-chart-svg" role="img" aria-label={ariaLabel}>
      {yTicks.map((tick) => {
        const y = padding.top + (1 - tick / axisMax) * plotH
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
        const barHeight = (Math.min(value, axisMax) / axisMax) * plotH
        const y = height - padding.bottom - barHeight
        const cornerR = Math.min(10, barWidth * 0.42, barHeight > 1 ? Math.max(barHeight * 0.18, 3) : 0)
        const showX = index % labelStep === 0 || index === data.length - 1
        const cx = x + barWidth / 2
        const labelAboveY = y - 6
        const putInside = showLabels && labelAboveY < padding.top + 2 && barHeight > 16
        const lx = cx
        const ly = height - padding.bottom + (tiltX ? 10 : 18)
        return (
          <g key={`${point.label}-${index}`}>
            <g className="rend-vbar-hover-target">
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 0)}
                rx={cornerR}
                ry={cornerR}
                fill={barFill(index)}
                opacity={0.96}
                className="rend-vbar-fill"
              />
              {showLabels && barHeight > 12 ? (
                <text
                  x={cx}
                  y={putInside ? y + 15 : labelAboveY}
                  textAnchor="middle"
                  className={`rend-vbar-pct-label ${putInside ? 'rend-vbar-inlabel' : 'rend-vbar-outlabel'}`}
                  fontSize="11"
                  fontWeight={600}
                >
                  {value.toFixed(1)}%
                </text>
              ) : null}
            </g>
            {showX ? (
              <text
                x={lx}
                y={ly}
                textAnchor={tiltX ? 'end' : 'middle'}
                className="rend-axis-text"
                fontSize={tiltX ? 10 : 11}
                transform={tiltX ? `rotate(-38 ${lx} ${ly})` : undefined}
              >
                {point.label}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

/** Barras agrupadas: un cluster por categoría (tramo, UN, vía…), una barra redondeada por mes de gestión. */
function GroupedPercentBarChart({
  months,
  categoryKeys,
  byMonth,
  formatCategory,
  showLabels,
  ariaLabel,
}: {
  months: string[]
  categoryKeys: string[]
  byMonth: Record<string, Record<string, { d: number; p: number }>>
  formatCategory: (key: string) => string
  showLabels: boolean
  ariaLabel: string
}) {
  const width = 980
  const height = 400
  const tiltX = categoryKeys.some((c) => formatCategory(c).length > 11)
  const axisLabelReserve = tiltX ? 72 : 44
  const legendReserve = 48
  const padding = { top: 24, right: 12, bottom: axisLabelReserve + legendReserve, left: 42 }
  const plotW = Math.max(1, width - padding.left - padding.right)
  const plotH = Math.max(1, height - padding.top - padding.bottom)
  const nT = Math.max(1, categoryKeys.length)
  const nM = Math.max(1, months.length)
  const slotW = plotW / nT
  const clusterPad = 6
  const innerGap = 2
  const barW = Math.max(4, Math.min(24, (slotW - 2 * clusterPad - (nM - 1) * innerGap) / nM))

  const valueAt = (month: string, cat: string) =>
    pctNum(Number(byMonth[month]?.[cat]?.p || 0), Number(byMonth[month]?.[cat]?.d || 0))

  const allValues: number[] = []
  for (const month of months) {
    for (const cat of categoryKeys) {
      allValues.push(valueAt(month, cat))
    }
  }
  const { axisMax, yTicks } = buildPercentYAxis(allValues)

  const monthColor = (mi: number) => RENDIMIENTO_BAR_COLORS[mi % RENDIMIENTO_BAR_COLORS.length]

  const baselineY = padding.top + plotH
  const categoryLabelY = baselineY + (tiltX ? 14 : 18)
  const legendY = baselineY + axisLabelReserve + 4
  const legendX0 = padding.left

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="rend-chart-svg" role="img" aria-label={ariaLabel}>
      {yTicks.map((tick) => {
        const y = padding.top + (1 - tick / axisMax) * plotH
        return (
          <g key={tick}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="rend-grid-line" />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="rend-axis-text">{tick}%</text>
          </g>
        )
      })}
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={baselineY} className="rend-axis-line" />
      <line x1={padding.left} y1={baselineY} x2={width - padding.right} y2={baselineY} className="rend-axis-line" />

      {categoryKeys.map((cat, ti) => {
        const slotLeft = padding.left + ti * slotW
        const cxSlot = slotLeft + slotW / 2
        const lx = cxSlot
        const ly = categoryLabelY
        return (
          <g key={`cat-${cat}`}>
            {months.map((month, mi) => {
              const value = valueAt(month, cat)
              const barHeight = (Math.max(0, Math.min(axisMax, value)) / axisMax) * plotH
              const y = baselineY - barHeight
              const x = slotLeft + clusterPad + mi * (barW + innerGap)
              const cornerR = Math.min(10, barW * 0.42, barHeight > 1 ? Math.max(barHeight * 0.18, 3) : 0)
              const labelAboveY = y - 4
              const putInside = showLabels && labelAboveY < padding.top + 2 && barHeight > 14
              const cxb = x + barW / 2
              return (
                <g key={`${cat}-${month}`}>
                  <g className="rend-vbar-hover-target">
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={Math.max(barHeight, 0)}
                      rx={cornerR}
                      ry={cornerR}
                      fill={monthColor(mi)}
                      opacity={0.96}
                      className="rend-vbar-fill"
                    />
                    {showLabels && barHeight > 10 ? (
                      <text
                        x={cxb}
                        y={putInside ? y + 13 : labelAboveY}
                        textAnchor="middle"
                        className={`rend-vbar-pct-label ${putInside ? 'rend-vbar-inlabel' : 'rend-vbar-outlabel'}`}
                        fontSize={nM > 4 ? 9 : 10}
                        fontWeight={600}
                      >
                        {value.toFixed(1)}%
                      </text>
                    ) : null}
                  </g>
                </g>
              )
            })}
            <text
              x={lx}
              y={ly}
              textAnchor={tiltX ? 'end' : 'middle'}
              className="rend-axis-text"
              fontSize={tiltX ? 9 : 11}
              transform={tiltX ? `rotate(-35 ${lx} ${ly})` : undefined}
            >
              {formatCategory(cat)}
            </text>
          </g>
        )
      })}

      <text x={legendX0} y={legendY - 6} className="rend-axis-text" fontSize="11" fontWeight={600}>
        Mes de gestión:
      </text>
      {months.map((month, mi) => {
        const lx = legendX0 + mi * 118
        return (
          <g key={`leg-${month}`}>
            <rect x={lx} y={legendY} width={12} height={12} rx={3} fill={monthColor(mi)} opacity={0.96} />
            <text x={lx + 16} y={legendY + 10} className="rend-axis-text" fontSize="10">
              {month}
            </text>
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
  const [floatOpen, setFloatOpen] = useState(false)
  const [floatGestion, setFloatGestion] = useState<string[]>([])
  const [floatUns, setFloatUns] = useState<string[]>([])
  const [floatCategoria, setFloatCategoria] = useState<string>('')
  const [floatViasCobro, setFloatViasCobro] = useState<string[]>([])

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

  const commitAndLoad = useCallback(
    async (next: Filters) => {
      try {
        setApplying(true)
        setError(null)
        setFilters(next)
        setAppliedFilters(next)
        await loadSummary(next, true)
        await markPerfReady('rendimiento')
      } catch (e: unknown) {
        setError(getApiErrorMessage(e))
      } finally {
        setApplying(false)
      }
    },
    [loadSummary],
  )

  const onApply = useCallback(() => void commitAndLoad(filters), [commitAndLoad, filters])

  const openFloatFilters = useCallback(() => {
    setFloatGestion(filters.gestionMonths)
    setFloatUns(filters.uns)
    setFloatCategoria((filters.categorias[0] || '').toUpperCase())
    setFloatViasCobro(filters.viasCobro)
    setFloatOpen(true)
  }, [filters.categorias, filters.gestionMonths, filters.uns, filters.viasCobro])

  const applyFloatFilters = useCallback(async () => {
    const next: Filters = {
      ...filters,
      gestionMonths: floatGestion,
      uns: floatUns,
      categorias: floatCategoria ? [floatCategoria] : [],
      viasCobro: floatViasCobro,
    }
    await commitAndLoad(next)
    setFloatOpen(false)
  }, [commitAndLoad, filters, floatCategoria, floatGestion, floatUns, floatViasCobro])

  const hasUnOptions = options.uns.length > 0

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
      await loadSummary(resetFilters, true)
      await markPerfReady('rendimiento')
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

  const tramoGroupedChart = useMemo(() => {
    const byMonth = summary?.tramoStatsByGestionMonth
    if (!byMonth || typeof byMonth !== 'object') return null
    const months = Object.keys(byMonth).sort((a, b) => monthSerial(a) - monthSerial(b))
    if (months.length <= 1) return null
    const tramoSet = new Set<string>()
    for (const m of months) {
      Object.keys(byMonth[m] || {}).forEach((t) => tramoSet.add(t))
    }
    const tramoKeys = [...tramoSet].sort((a, b) => Number(a) - Number(b))
    if (tramoKeys.length === 0) return null
    return { months, tramoKeys, byMonth }
  }, [summary?.tramoStatsByGestionMonth])

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

  const unGroupedChart = useMemo(() => {
    const byMonth = summary?.unStatsByGestionMonth
    if (!byMonth || typeof byMonth !== 'object') return null
    const months = Object.keys(byMonth).sort((a, b) => monthSerial(a) - monthSerial(b))
    if (months.length <= 1) return null
    const cat = new Set<string>()
    for (const m of months) {
      Object.keys(byMonth[m] || {}).forEach((k) => cat.add(k))
    }
    const categoryKeys = [...cat].sort((a, b) => a.localeCompare(b))
    if (categoryKeys.length === 0) return null
    return { months, categoryKeys, byMonth }
  }, [summary?.unStatsByGestionMonth])

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

  const viaGroupedChart = useMemo(() => {
    const byMonth = summary?.viaCStatsByGestionMonth
    if (!byMonth || typeof byMonth !== 'object') return null
    const months = Object.keys(byMonth).sort((a, b) => monthSerial(a) - monthSerial(b))
    if (months.length <= 1) return null
    const cat = new Set<string>()
    for (const m of months) {
      Object.keys(byMonth[m] || {}).forEach((k) => cat.add(k))
    }
    const categoryKeys = [...cat].sort((a, b) => a.localeCompare(b))
    if (categoryKeys.length === 0) return null
    return { months, categoryKeys, byMonth }
  }, [summary?.viaCStatsByGestionMonth])

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

  const kpiCards: Record<
    KpiId,
    { title: string; value: string; fullValue?: string; note?: string; borderColor: string; valueColor?: string; icon: RendimientoKpiIconId }
  > = {
    rendimiento_monto: {
      title: 'RENDIMIENTO POR MONTO',
      value: pct(Number(summary?.totalPaid || 0), Number(summary?.totalDebt || 0)),
      note: 'Cobrado / monto a cobrar',
      borderColor: 'var(--color-chart-1)',
      valueColor: 'var(--color-chart-1)',
      icon: 'money',
    },
    rendimiento_cantidad: {
      title: 'RENDIMIENTO POR CANTIDAD',
      value: pct(Number(summary?.totalContractsPaid || 0), Number(summary?.totalContracts || 0)),
      note: 'Contratos con cobro / contratos por cobrar',
      borderColor: 'var(--color-chart-2)',
      valueColor: 'var(--color-chart-2)',
      icon: 'check',
    },
    contratos_por_cobrar: {
      title: 'CONTRATOS POR COBRAR',
      value: formatCount(summary?.totalContracts || 0),
      note: 'Base filtrada por mes de gestión',
      borderColor: 'var(--color-text-muted)',
      icon: 'doc',
    },
    contratos_con_cobro: {
      title: 'CONTRATOS CON COBRO',
      value: formatCount(summary?.totalContractsPaid || 0),
      note: 'Contratos con pago registrado',
      borderColor: 'var(--color-state-ok)',
      valueColor: 'var(--color-state-ok)',
      icon: 'user',
    },
    monto_a_cobrar: {
      title: 'MONTO A COBRAR',
      value: formatGsFull(summary?.totalDebt || 0),
      fullValue: formatGsFull(summary?.totalDebt || 0),
      note: 'Monto vencido + monto cuota',
      borderColor: 'var(--color-chart-5)',
      valueColor: 'var(--color-chart-5)',
      icon: 'money',
    },
    total_cobrado: {
      title: 'TOTAL COBRADO',
      value: formatGsFull(summary?.totalPaid || 0),
      fullValue: formatGsFull(summary?.totalPaid || 0),
      note: `${formatCount(summary?.totalContractsPaid || 0)} contratos con cobro`,
      borderColor: 'var(--color-primary)',
      valueColor: 'var(--color-primary)',
      icon: 'card',
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
            <ViaSegmentedOrMulti
              className="analysis-filter-control"
              label="Vía de cobro"
              options={options.viasCobro}
              selected={filters.viasCobro}
              onChange={(values) => setFilters((prev) => ({ ...prev, viasCobro: values }))}
            />
            <ViaSegmentedOrMulti
              className="analysis-filter-control"
              label="Vía de pago"
              options={options.viasPago}
              selected={filters.viasPago}
              onChange={(values) => setFilters((prev) => ({ ...prev, viasPago: values }))}
            />
            <SegmentedControl
              className="analysis-filter-control"
              label="Categoría"
              options={[
                { value: '', label: 'Todas' },
                { value: 'VIGENTE', label: 'Vigente' },
                { value: 'MOROSO', label: 'Moroso' },
              ]}
              value={(filters.categorias[0] || '').toUpperCase()}
              onChange={(value) => setFilters((prev) => ({ ...prev, categorias: value ? [value] : [] }))}
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
                  <div className="chart-card-header">
                    <div className="kpi-card-title-wrap">
                      <span className="kpi-card-icon" aria-hidden>
                        <RendimientoKpiIcon icon={card.icon} />
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
              subtitle={
                tramoGroupedChart
                  ? 'Una barra por cada mes de gestión seleccionado dentro de cada tramo (comparación entre cortes).'
                  : 'Barras redondeadas por tramo en el corte de gestión elegido; si el resumen usa Historia, el desglose toma el último mes con datos.'
              }
              hasData={tramoGroupedChart ? tramoGroupedChart.tramoKeys.length > 0 : tramoSeries.length > 0}
              emptyMessage={emptyCopy.message}
              emptySuggestion={emptyCopy.suggestion}
            >
              {tramoGroupedChart ? (
                <GroupedPercentBarChart
                  months={tramoGroupedChart.months}
                  categoryKeys={tramoGroupedChart.tramoKeys}
                  byMonth={tramoGroupedChart.byMonth}
                  formatCategory={(t) => `Tramo ${t}`}
                  showLabels={showChartLabels}
                  ariaLabel="Rendimiento por tramo comparando meses de gestión"
                />
              ) : (
                <PercentBarChart
                  data={tramoSeries}
                  colors={RENDIMIENTO_BAR_COLORS}
                  showLabels={showChartLabels}
                  ariaLabel="Rendimiento por tramo en porcentaje"
                />
              )}
            </ChartSection>

            <ChartSection
              title="Rendimiento por unidad de negocio"
              subtitle={
                unGroupedChart
                  ? 'Una barra por mes de gestión dentro de cada UN (misma lógica de cortes que por tramo).'
                  : 'Mismo corte que las barras por tramo: mes(es) seleccionados o último mes disponible con Historia.'
              }
              hasData={unGroupedChart ? unGroupedChart.categoryKeys.length > 0 : unSeries.length > 0}
              emptyMessage={emptyCopy.message}
              emptySuggestion={emptyCopy.suggestion}
            >
              {unGroupedChart ? (
                <GroupedPercentBarChart
                  months={unGroupedChart.months}
                  categoryKeys={unGroupedChart.categoryKeys}
                  byMonth={unGroupedChart.byMonth}
                  formatCategory={(u) => u}
                  showLabels={showChartLabels}
                  ariaLabel="Rendimiento por unidad de negocio comparando meses de gestión"
                />
              ) : (
                <PercentBarChart
                  data={unSeries}
                  colors={RENDIMIENTO_BAR_COLORS}
                  showLabels={showChartLabels}
                  ariaLabel="Rendimiento por unidad de negocio en porcentaje"
                />
              )}
            </ChartSection>

            <ChartSection
              title="Rendimiento por vía de cobro"
              subtitle={
                viaGroupedChart
                  ? 'Una barra por mes de gestión dentro de cada vía de cobro.'
                  : 'Comparación por vía de cobro en el mismo corte que los otros desgloses.'
              }
              hasData={viaGroupedChart ? viaGroupedChart.categoryKeys.length > 0 : viaCobroSeries.length > 0}
              emptyMessage={emptyCopy.message}
              emptySuggestion={emptyCopy.suggestion}
            >
              {viaGroupedChart ? (
                <GroupedPercentBarChart
                  months={viaGroupedChart.months}
                  categoryKeys={viaGroupedChart.categoryKeys}
                  byMonth={viaGroupedChart.byMonth}
                  formatCategory={(v) => v}
                  showLabels={showChartLabels}
                  ariaLabel="Rendimiento por vía de cobro comparando meses de gestión"
                />
              ) : (
                <PercentBarChart
                  data={viaCobroSeries}
                  colors={RENDIMIENTO_BAR_COLORS}
                  showLabels={showChartLabels}
                  ariaLabel="Rendimiento por vía de cobro en porcentaje"
                />
              )}
            </ChartSection>
          </div>
        </div>
      ) : null}

      <FloatingQuickFilters
        isOpen={floatOpen}
        onOpen={openFloatFilters}
        onCollapse={() => setFloatOpen(false)}
        onApply={() => void applyFloatFilters()}
        applyDisabled={applying || loadingSummary || loadingOptions || !floatGestion.length}
        applying={applying || loadingSummary}
      >
        <MultiSelectFilter
          className="analysis-filter-control"
          label="Mes de gestión"
          options={options.gestionMonths}
          selected={floatGestion}
          onChange={setFloatGestion}
          placeholder="Historia"
        />
        {hasUnOptions ? (
          <MultiSelectFilter
            className="analysis-filter-control"
            label="Unidad de negocio"
            options={options.uns}
            selected={floatUns}
            onChange={setFloatUns}
            placeholder="Todas"
          />
        ) : (
          <>
            <ViaSegmentedOrMulti
              className="analysis-filter-control"
              label="Vía de cobro"
              options={options.viasCobro}
              selected={floatViasCobro}
              onChange={setFloatViasCobro}
            />
            <SegmentedControl
              className="analysis-filter-control"
              label="Categoría"
              options={[
                { value: '', label: 'Todas' },
                { value: 'VIGENTE', label: 'Vigente' },
                { value: 'MOROSO', label: 'Moroso' },
              ]}
              value={floatCategoria}
              onChange={(value) => setFloatCategoria(value)}
            />
          </>
        )}
      </FloatingQuickFilters>
    </section>
  )
}
