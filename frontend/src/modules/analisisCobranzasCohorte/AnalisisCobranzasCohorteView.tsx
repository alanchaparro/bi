import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, Chip, Label, ListBox, Select, Slider, Table, Tabs } from '@heroui/react'
import { ActiveFilterChips, type FilterChip } from '../../components/filters/ActiveFilterChips'
import { MultiSelectFilter } from '../../components/filters/MultiSelectFilter'
import {
  ConfigurableCategoriaFilter,
  ConfigurableUnFilter,
  ConfigurableViaFilter,
} from '../../components/filters/ConfigurableAnalyticsFilters'
import { FloatingQuickFilters } from '../../components/filters/FloatingQuickFilters'
import {
  DashboardFiltersLayout,
  DashboardFloatingFiltersLayout,
  useDashboardMainFilterAutoApply,
} from '@/components/filters/DashboardFiltersLayout'
import { useFilterLayoutConfig } from '@/components/filters/FilterLayoutConfigContext'
import {
  buildEffectiveFilterLayout,
  snapshotFloatingFilterValues,
  type AnalyticsFilterId,
} from '@/config/analyticsFilterLayouts'
import { VIA_DEBITO_COBRADOR_ABBREV_OPTIONS } from '../../components/filters/analyticsAbbrev'
import { AnalyticsPageHeader } from '../../components/analytics/AnalyticsPageHeader'
import { AnalyticsMetaBadges } from '../../components/analytics/AnalyticsMetaBadges'
import { AnalysisSelectionSummary } from '../../components/analytics/AnalysisSelectionSummary'
import { MetricExplainer } from '../../components/analytics/MetricExplainer'
import { AnalysisFiltersSkeleton } from '../../components/feedback/AnalysisFiltersSkeleton'
import { EmptyState } from '../../components/feedback/EmptyState'
import { ErrorState } from '../../components/feedback/ErrorState'
import { LoadingState } from '../../components/feedback/LoadingState'
import {
  clearAnalyticsApiCache,
  getCobranzasCohorteFirstPaint,
  getCobranzasCohorteOptions,
  getCobranzasCohorteOrphanDetail,
  markPerfReady,
  peekCobranzasCohorteOptionsUncached,
  type CobranzasCohorteFirstPaintResponse,
  type CobranzasCohorteOrphanDetailResponse,
  type CobranzasCohorteSummaryResponse,
} from '../../shared/api'
import { getApiErrorMessage } from '../../shared/apiErrors'
import { sortMesGestionDesc } from '../../shared/sortMesGestionOptions'
import { formatCount, formatGsFull } from '../../shared/formatters'
import {
  distinctYearsFromMonthOptions,
  expandGestionForYears,
  monthShortEs,
  parseGestionMonth,
} from '@/modules/eerr/eerrGestionRange'

type Filters = {
  cutoffMonth: string
  cutoffMonths?: string[]
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

type CohorteMainTab = 'principal' | 'sin_cierre_cartera'

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

/** Tope canónico de tramo (cuotas_vencidas ≥ 7 → 7); la tabla debe listar siempre 0..7. */
const COHORTE_TRAMO_MAX = 7

const COHORTE_POLL_MS = 30_000

function cohorteFreshnessKey(meta: { data_freshness_at?: string; pipeline_version?: string } | undefined): string {
  if (!meta) return ''
  const a = meta.data_freshness_at ?? ''
  const b = meta.pipeline_version ?? ''
  if (!a && !b) return ''
  return `${a}\u001f${b}`
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

/** Mes de corte más reciente (mm/yyyy) dentro del rectángulo año × mes calendario y opciones disponibles. */
function resolveLatestCutoffInRectangle(
  years: number[],
  monthRange: [number, number],
  cutoffOptions: string[],
): string {
  if (!cutoffOptions.length || !years.length) return ''
  const expanded = expandGestionForYears(years, monthRange[0], monthRange[1])
  const hit = expanded.filter((x) => cutoffOptions.includes(x))
  if (!hit.length) return sortMesGestionDesc(cutoffOptions)[0] ?? ''
  return sortMesGestionDesc(hit)[0] ?? ''
}

function CobranzasCohorteCutoffRangeControl({
  cutoffOptions,
  cohorteYears,
  selectedYears,
  onSelectedYearsChange,
  monthRange,
  onMonthRangeChange,
}: {
  cutoffOptions: string[]
  cohorteYears: number[]
  selectedYears: number[]
  onSelectedYearsChange: (years: number[]) => void
  monthRange: [number, number]
  onMonthRangeChange: (r: [number, number]) => void
}) {
  const yearTriggerSummary = useMemo(() => {
    const sorted = [...selectedYears].sort((a, b) => a - b)
    const isAll =
      cohorteYears.length > 0 &&
      sorted.length === cohorteYears.length &&
      cohorteYears.every((y) => sorted.includes(y))
    return { sorted, isAll }
  }, [selectedYears, cohorteYears])

  if (!cutoffOptions.length) {
    return <p className="text-sm text-[var(--color-text-muted)]" role="status">Sin meses de cobro disponibles.</p>
  }

  return (
    <div className="eerr-gestion-range-wrap w-full min-w-0">
      <p className="text-[11px] text-[var(--color-text-muted)] mb-3 leading-snug opacity-90">
        Elegí uno o más años y el rango de mes calendario del corte. La consulta usa el mes de cobro{" "}
        <strong>más reciente</strong> del rango que exista en datos (un solo corte por request, como la API v2).
      </p>
      <div className="flex flex-col gap-5 w-full min-w-0">
        <Select
          className="eerr-year-multi-select w-full min-w-0"
          selectionMode="multiple"
          variant="secondary"
          fullWidth
          placeholder={cohorteYears.length ? 'Seleccionar años' : 'Sin años en opciones'}
          isDisabled={cohorteYears.length === 0}
          value={selectedYears.map(String)}
          onChange={(keys) => {
            const raw = keys == null ? [] : [...keys]
            const nums = raw
              .map((k) => parseInt(String(k), 10))
              .filter((n) => Number.isFinite(n) && cohorteYears.includes(n))
            const next =
              nums.length > 0 ? [...new Set(nums)].sort((a, b) => a - b) : [...cohorteYears]
            onSelectedYearsChange(next)
          }}
          aria-label="Años del mes de cobro (multiselección)"
        >
          <Label className="text-sm font-medium">Año (uno o varios)</Label>
          <Select.Trigger>
            <Select.Value>
              {({ isPlaceholder }) => {
                if (isPlaceholder) return null
                const { sorted, isAll } = yearTriggerSummary
                if (sorted.length === 0) return null
                if (isAll) {
                  const lo = cohorteYears[0]
                  const hi = cohorteYears[cohorteYears.length - 1]
                  return (
                    <span className="text-sm font-medium leading-snug">
                      {lo === hi ? String(lo) : `Todos (${lo}–${hi})`}
                    </span>
                  )
                }
                if (sorted.length <= 4) {
                  return sorted.map((y) => (
                    <Chip key={y} size="sm" variant="soft" color="accent" className="text-xs font-medium">
                      {y}
                    </Chip>
                  ))
                }
                return (
                  <span className="text-sm leading-snug">
                    {sorted.slice(0, 3).join(', ')}
                    <span className="text-field-placeholder"> · +{sorted.length - 3}</span>
                  </span>
                )
              }}
            </Select.Value>
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover placement="bottom start" className="eerr-year-select-popover z-[200]">
            <ListBox className="eerr-year-listbox">
              {cohorteYears.map((y) => (
                <ListBox.Item key={y} id={String(y)} textValue={String(y)}>
                  <Label className="flex-1 text-sm font-normal tabular-nums">{y}</Label>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <Slider
          className="w-full min-w-0"
          minValue={1}
          maxValue={12}
          step={1}
          value={monthRange}
          onChange={(v) => {
            const raw = Array.isArray(v) ? v : [v, v]
            const a = Math.round(Number(raw[0]))
            const b = Math.round(Number(raw[1]))
            const lo = Math.min(a, b)
            const hi = Math.max(a, b)
            onMonthRangeChange([lo, hi] as [number, number])
          }}
        >
          <Label className="text-sm font-medium text-[var(--color-text)]">Mes de cobro (desde – hasta)</Label>
          <Slider.Output className="text-sm text-[var(--color-text-muted)] mb-1">
            {({ state }) =>
              `${monthShortEs(Math.min(state.values[0], state.values[1]))} – ${monthShortEs(Math.max(state.values[0], state.values[1]))}`
            }
          </Slider.Output>
          <Slider.Track>
            {({ state }) => (
              <>
                <Slider.Fill />
                {state.values.map((_, i) => (
                  <Slider.Thumb key={i} index={i} />
                ))}
              </>
            )}
          </Slider.Track>
        </Slider>
      </div>
    </div>
  )
}

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
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [options, setOptions] = useState<Options>(EMPTY_OPTIONS)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS)
  const [summary, setSummary] = useState<CobranzasCohorteFirstPaintResponse | CobranzasCohorteSummaryResponse | null>(null)
  const [kpiOrder, setKpiOrder] = useState<KpiId[]>(() => readStoredOrder(DEFAULT_KPI_ORDER))
  const [draggingKpi, setDraggingKpi] = useState<KpiId | null>(null)
  const [dragOverKpi, setDragOverKpi] = useState<KpiId | null>(null)
  const [floatOpen, setFloatOpen] = useState(false)
  const [floatCutoff, setFloatCutoff] = useState('')
  const [floatUns, setFloatUns] = useState<string[]>([])
  const [floatVias, setFloatVias] = useState<string[]>([])
  const [floatCategorias, setFloatCategorias] = useState<string[]>([])
  const [floatSupervisors, setFloatSupervisors] = useState<string[]>([])
  const [cohorteCutoffYears, setCohorteCutoffYears] = useState<number[]>([])
  const [cohorteCutoffMonthRange, setCohorteCutoffMonthRange] = useState<[number, number]>([1, 12])
  const [floatCohorteYears, setFloatCohorteYears] = useState<number[]>([])
  const [floatCohorteMonthRange, setFloatCohorteMonthRange] = useState<[number, number]>([1, 12])
  const [cohorteTab, setCohorteTab] = useState<CohorteMainTab>('principal')
  const [orphanDetail, setOrphanDetail] = useState<CobranzasCohorteOrphanDetailResponse | null>(null)
  const [loadingOrphan, setLoadingOrphan] = useState(false)
  const [orphanError, setOrphanError] = useState<string | null>(null)
  const [orphanPage, setOrphanPage] = useState(1)

  const lastCohorteFreshnessRef = useRef('')
  const cohortePollLockRef = useRef(false)
  const appliedFiltersRef = useRef(appliedFilters)
  appliedFiltersRef.current = appliedFilters
  const cohorteTabRef = useRef(cohorteTab)
  cohorteTabRef.current = cohorteTab
  const orphanPageRef = useRef(orphanPage)
  orphanPageRef.current = orphanPage
  const pollBlockRef = useRef({ applying: false, loadingSummary: false })
  pollBlockRef.current = { applying, loadingSummary }

  useEffect(() => {
    try {
      window.localStorage.setItem(COHORTE_KPI_ORDER_STORAGE, JSON.stringify(kpiOrder))
    } catch {
      // ignore storage failures
    }
  }, [kpiOrder])

  const cohorteYears = useMemo(
    () => distinctYearsFromMonthOptions(options.cutoffMonths),
    [options.cutoffMonths],
  )

  // Resuelve la lista completa de meses del rectangulo, no solo el mas reciente
  useEffect(() => {
    if (loadingOptions || !options.cutoffMonths.length || !cohorteCutoffYears.length) return
    const expanded = expandGestionForYears(cohorteCutoffYears, cohorteCutoffMonthRange[0], cohorteCutoffMonthRange[1])
    const hit = sortMesGestionDesc(expanded.filter((x) => options.cutoffMonths.includes(x)))
    const next = hit[0] ?? ''
    if (!next) return
    setFilters((f) => {
      if (f.cutoffMonth === next && f.cutoffMonths?.join(',') === hit.join(',')) return f
      return { ...f, cutoffMonth: next, cutoffMonths: hit }
    })
  }, [cohorteCutoffYears, cohorteCutoffMonthRange, options.cutoffMonths, loadingOptions])

  useEffect(() => {
    if (!floatOpen || !options.cutoffMonths.length || !floatCohorteYears.length) return
    const co = resolveLatestCutoffInRectangle(
      floatCohorteYears,
      floatCohorteMonthRange,
      options.cutoffMonths,
    )
    if (co) setFloatCutoff(co)
  }, [floatOpen, floatCohorteYears, floatCohorteMonthRange, options.cutoffMonths])

  const loadFirstPaint = useCallback(async (next: Filters, withLoader = false) => {
    if (withLoader) setLoadingSummary(true)
    try {
      const payload: Parameters<typeof getCobranzasCohorteFirstPaint>[0] = {
        un: next.uns,
        via_cobro: next.vias,
        categoria: next.categorias,
        supervisor: next.supervisors,
        top_n_sale_months: 12,
      }
      // Si hay cutoffMonths (rango), envialo como cutoff_months para acumulado
      if (next.cutoffMonths && next.cutoffMonths.length > 1) {
        payload.cutoff_months = next.cutoffMonths
      } else {
        payload.cutoff_month = next.cutoffMonth || undefined
      }
      const data = await getCobranzasCohorteFirstPaint(payload)
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
          cutoffMonths: sortMesGestionDesc(opts.options.cutoff_months || []),
          uns: opts.options.uns || [],
          vias: opts.options.vias || [],
          categorias: opts.options.categories || [],
          supervisors: opts.options.supervisors || [],
        }

        const fp0 = cohorteFreshnessKey(opts.meta)
        if (fp0) lastCohorteFreshnessRef.current = fp0

        const ys = distinctYearsFromMonthOptions(nextOptions.cutoffMonths)
        const initYears = ys.length ? ys : []
        const initRange: [number, number] = [1, 12]
        const resolved =
          resolveLatestCutoffInRectangle(initYears, initRange, nextOptions.cutoffMonths) ||
          opts.default_cutoff ||
          nextOptions.cutoffMonths[0] ||
          ''
        const nextFilters: Filters = {
          cutoffMonth: resolved,
          uns: [],
          vias: [],
          categorias: [],
          supervisors: [],
        }

        setOptions(nextOptions)
        setCohorteCutoffYears(initYears)
        setCohorteCutoffMonthRange(initRange)
        setFloatCohorteYears(initYears)
        setFloatCohorteMonthRange(initRange)
        setFilters(nextFilters)
        setAppliedFilters(nextFilters)
        setApplying(true)
        await loadFirstPaint(nextFilters, true)
        await markPerfReady('cohorte')
      } catch (e: unknown) {
        setError(getApiErrorMessage(e))
      } finally {
        setApplying(false)
        setLoadingOptions(false)
      }
    }

    void boot()
  }, [loadFirstPaint])

  const commitAndLoad = useCallback(
    async (next: Filters) => {
      try {
        setApplying(true)
        setError(null)
        setFilters(next)
        setAppliedFilters(next)
        setOrphanPage(1)
        await loadFirstPaint(next)
      } catch (e: unknown) {
        setError(getApiErrorMessage(e))
      } finally {
        setApplying(false)
      }
    },
    [loadFirstPaint],
  )

  const onApply = useCallback(() => void commitAndLoad(filters), [commitAndLoad, filters])

  const openFloatFilters = useCallback(() => {
    setFloatCutoff(filters.cutoffMonth)
    setFloatCohorteYears([...cohorteCutoffYears])
    setFloatCohorteMonthRange([cohorteCutoffMonthRange[0], cohorteCutoffMonthRange[1]])
    setFloatUns(filters.uns)
    setFloatVias(filters.vias)
    setFloatCategorias(filters.categorias)
    setFloatSupervisors(filters.supervisors)
    setFloatOpen(true)
  }, [
    cohorteCutoffMonthRange,
    cohorteCutoffYears,
    filters.categorias,
    filters.cutoffMonth,
    filters.supervisors,
    filters.uns,
    filters.vias,
  ])

  const { doc: filterLayoutDoc } = useFilterLayoutConfig()
  const floatLayoutEff = useMemo(
    () => buildEffectiveFilterLayout('analisisCobranzaCohorte', [], filterLayoutDoc),
    [filterLayoutDoc],
  )
  const floatSlots = useMemo<Partial<Record<AnalyticsFilterId, React.ReactNode>>>(
    () => ({
      cobro_cutoff_month: (
        <div className="analysis-filter-control">
          <label className="input-label" id="float-cutoff-month-label">
            Mes de cobro
          </label>
          <CobranzasCohorteCutoffRangeControl
            cutoffOptions={options.cutoffMonths}
            cohorteYears={cohorteYears}
            selectedYears={floatCohorteYears}
            onSelectedYearsChange={setFloatCohorteYears}
            monthRange={floatCohorteMonthRange}
            onMonthRangeChange={setFloatCohorteMonthRange}
          />
          {floatCutoff ? (
            <p className="text-[11px] text-[var(--color-text-muted)] mt-2" aria-live="polite">
              Corte efectivo: <strong className="text-[var(--color-text)]">{floatCutoff}</strong>
            </p>
          ) : null}
        </div>
      ),
      un: (
        <ConfigurableUnFilter
          sectionId="analisisCobranzaCohorte"
          className="analysis-filter-control"
          label="UN"
          options={options.uns}
          selected={floatUns}
          onChange={setFloatUns}
        />
      ),
      via_cobro: (
        <ConfigurableViaFilter
          sectionId="analisisCobranzaCohorte"
          viaId="via_cobro"
          className="analysis-filter-control"
          label="Vía de cobro"
          options={options.vias}
          selected={floatVias}
          onChange={setFloatVias}
          fixedAbbrevOptions={VIA_DEBITO_COBRADOR_ABBREV_OPTIONS}
        />
      ),
      categoria: (
        <ConfigurableCategoriaFilter
          sectionId="analisisCobranzaCohorte"
          className="analysis-filter-control"
          categoryOptions={options.categorias}
          selected={floatCategorias}
          onChange={setFloatCategorias}
        />
      ),
      supervisor: (
        <MultiSelectFilter
          className="analysis-filter-control"
          label="Supervisor"
          options={options.supervisors}
          selected={floatSupervisors}
          onChange={setFloatSupervisors}
          placeholder="Todos"
        />
      ),
    }),
    [
      cohorteYears,
      floatCohorteMonthRange,
      floatCohorteYears,
      floatCutoff,
      options.cutoffMonths,
      options.uns,
      options.vias,
      options.categorias,
      options.supervisors,
      floatUns,
      floatVias,
      floatCategorias,
      floatSupervisors,
    ],
  )
  const showFloatingFilters = useMemo(
    () => floatLayoutEff.floating.some((id) => floatSlots[id] != null),
    [floatLayoutEff.floating, floatSlots],
  )

  const applyFloatFilters = useCallback(async () => {
    const fl = floatLayoutEff.floating
    const coFromFloat =
      fl.includes('cobro_cutoff_month') && options.cutoffMonths.length
        ? resolveLatestCutoffInRectangle(
            floatCohorteYears,
            floatCohorteMonthRange,
            options.cutoffMonths,
          ) || floatCutoff
        : filters.cutoffMonth
    if (fl.includes('cobro_cutoff_month')) {
      setCohorteCutoffYears([...floatCohorteYears])
      setCohorteCutoffMonthRange([floatCohorteMonthRange[0], floatCohorteMonthRange[1]])
    }
    const next: Filters = {
      ...filters,
      cutoffMonth: fl.includes('cobro_cutoff_month') ? coFromFloat : filters.cutoffMonth,
      uns: fl.includes('un') ? floatUns : filters.uns,
      vias: fl.includes('via_cobro') ? floatVias : filters.vias,
      categorias: fl.includes('categoria') ? floatCategorias : filters.categorias,
      supervisors: fl.includes('supervisor') ? floatSupervisors : filters.supervisors,
    }
    await commitAndLoad(next)
    setFloatOpen(false)
  }, [
    commitAndLoad,
    filters,
    floatCohorteMonthRange,
    floatCohorteYears,
    floatCategorias,
    floatCutoff,
    floatLayoutEff.floating,
    floatSupervisors,
    floatUns,
    floatVias,
    options.cutoffMonths,
  ])

  const pickFloatDraft = useCallback(
    (id: string): readonly string[] => {
      switch (id) {
        case 'cobro_cutoff_month':
          return floatCutoff ? [floatCutoff] : []
        case 'un':
          return floatUns
        case 'via_cobro':
          return floatVias
        case 'categoria':
          return floatCategorias
        case 'supervisor':
          return floatSupervisors
        default:
          return []
      }
    },
    [floatCutoff, floatUns, floatVias, floatCategorias, floatSupervisors],
  )

  const pickFloatApplied = useCallback(
    (id: string): readonly string[] => {
      switch (id) {
        case 'cobro_cutoff_month':
          return appliedFilters.cutoffMonth ? [appliedFilters.cutoffMonth] : []
        case 'un':
          return appliedFilters.uns
        case 'via_cobro':
          return appliedFilters.vias
        case 'categoria':
          return appliedFilters.categorias
        case 'supervisor':
          return appliedFilters.supervisors
        default:
          return []
      }
    },
    [appliedFilters],
  )

  const floatDraftActivityKey = useMemo(
    () => snapshotFloatingFilterValues(floatLayoutEff.floating, pickFloatDraft),
    [floatLayoutEff.floating, pickFloatDraft],
  )

  const floatAppliedActivityKey = useMemo(
    () => snapshotFloatingFilterValues(floatLayoutEff.floating, pickFloatApplied),
    [floatLayoutEff.floating, pickFloatApplied],
  )

  const pickMainDraft = useCallback(
    (id: string): readonly string[] => {
      switch (id) {
        case 'cobro_cutoff_month':
          return filters.cutoffMonth ? [filters.cutoffMonth] : []
        case 'un':
          return filters.uns
        case 'via_cobro':
          return filters.vias
        case 'categoria':
          return filters.categorias
        case 'supervisor':
          return filters.supervisors
        default:
          return []
      }
    },
    [filters],
  )
  const pickMainApplied = useCallback(
    (id: string): readonly string[] => {
      switch (id) {
        case 'cobro_cutoff_month':
          return appliedFilters.cutoffMonth ? [appliedFilters.cutoffMonth] : []
        case 'un':
          return appliedFilters.uns
        case 'via_cobro':
          return appliedFilters.vias
        case 'categoria':
          return appliedFilters.categorias
        case 'supervisor':
          return appliedFilters.supervisors
        default:
          return []
      }
    },
    [appliedFilters],
  )
  useDashboardMainFilterAutoApply({
    effective: floatLayoutEff,
    pickDraft: pickMainDraft,
    pickApplied: pickMainApplied,
    onApply: () => void commitAndLoad(filters),
    floatSidebarOpen: floatOpen,
    applyDisabled: applying,
    applying,
  })

  const clearFilters = useCallback(() => {
    const ys = distinctYearsFromMonthOptions(options.cutoffMonths)
    const years = ys.length ? ys : []
    const range: [number, number] = [1, 12]
    setCohorteCutoffYears(years)
    setCohorteCutoffMonthRange(range)
    const co =
      resolveLatestCutoffInRectangle(years, range, options.cutoffMonths) || options.cutoffMonths?.[0] || ''
    setFilters({
      ...EMPTY_FILTERS,
      cutoffMonth: co,
    })
  }, [options.cutoffMonths])

  const onReset = useCallback(async () => {
    try {
      setApplying(true)
      setError(null)
      const ys = distinctYearsFromMonthOptions(options.cutoffMonths)
      const years = ys.length ? ys : []
      const range: [number, number] = [1, 12]
      const co =
        resolveLatestCutoffInRectangle(years, range, options.cutoffMonths) || options.cutoffMonths[0] || ''
      setCohorteCutoffYears(years)
      setCohorteCutoffMonthRange(range)
      const resetFilters: Filters = {
        cutoffMonth: co,
        uns: [],
        vias: [],
        categorias: [],
        supervisors: [],
      }
      setFilters(resetFilters)
      setAppliedFilters(resetFilters)
      setOrphanPage(1)
      await loadFirstPaint(resetFilters)
    } catch (e: unknown) {
      setError(getApiErrorMessage(e))
    } finally {
      setApplying(false)
    }
  }, [loadFirstPaint, options.cutoffMonths])

  const loadOrphanDetail = useCallback(async (page: number, filtersIn: Filters) => {
    setLoadingOrphan(true)
    setOrphanError(null)
    try {
      const data = await getCobranzasCohorteOrphanDetail({
        cutoff_month: filtersIn.cutoffMonth || undefined,
        un: filtersIn.uns,
        via_cobro: filtersIn.vias,
        categoria: filtersIn.categorias,
        supervisor: filtersIn.supervisors,
        page,
        page_size: 50,
        sort_by: 'cobrado',
        sort_dir: 'desc',
      })
      setOrphanDetail(data)
    } catch (e: unknown) {
      setOrphanError(getApiErrorMessage(e))
    } finally {
      setLoadingOrphan(false)
    }
  }, [])

  useEffect(() => {
    if (loadingOptions) return

    let cancelled = false

    const tick = async () => {
      if (cancelled || document.visibilityState !== 'visible') return
      if (cohortePollLockRef.current) return
      if (pollBlockRef.current.applying || pollBlockRef.current.loadingSummary) return

      try {
        const peek = await peekCobranzasCohorteOptionsUncached({})
        if (cancelled) return
        const fp = cohorteFreshnessKey(peek.meta)
        if (!fp) return
        if (lastCohorteFreshnessRef.current === '') {
          lastCohorteFreshnessRef.current = fp
          return
        }
        if (fp === lastCohorteFreshnessRef.current) return

        cohortePollLockRef.current = true
        const previousFp = lastCohorteFreshnessRef.current
        try {
          clearAnalyticsApiCache('/analytics/cobranzas-cohorte-v2')
          const opts = await getCobranzasCohorteOptions({})
          if (cancelled) return

          const nextOptions: Options = {
            cutoffMonths: sortMesGestionDesc(opts.options.cutoff_months || []),
            uns: opts.options.uns || [],
            vias: opts.options.vias || [],
            categorias: opts.options.categories || [],
            supervisors: opts.options.supervisors || [],
          }
          setOptions(nextOptions)

          let nextAf = appliedFiltersRef.current
          if (nextAf.cutoffMonth && !nextOptions.cutoffMonths.includes(nextAf.cutoffMonth)) {
            const fallback =
              opts.default_cutoff || nextOptions.cutoffMonths[0] || ''
            nextAf = { ...nextAf, cutoffMonth: fallback }
            const p = parseGestionMonth(fallback)
            if (p) {
              setCohorteCutoffYears([p.y])
              setCohorteCutoffMonthRange([1, p.m])
            }
            appliedFiltersRef.current = nextAf
            setFilters((f) => ({ ...f, cutoffMonth: fallback }))
            setAppliedFilters(nextAf)
          }

          await loadFirstPaint(nextAf, false)
          if (cancelled) return

          if (cohorteTabRef.current === 'sin_cierre_cartera') {
            await loadOrphanDetail(orphanPageRef.current, nextAf)
          }
          lastCohorteFreshnessRef.current = fp
        } catch {
          lastCohorteFreshnessRef.current = previousFp
        } finally {
          cohortePollLockRef.current = false
        }
      } catch {
        // red intermitente; el usuario puede usar Reintentar
      }
    }

    const id = window.setInterval(tick, COHORTE_POLL_MS)
    const onVis = () => {
      if (document.visibilityState === 'visible') void tick()
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelled = true
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [loadingOptions, loadFirstPaint, loadOrphanDetail])

  const retryLastRequest = useCallback(async () => {
    try {
      setApplying(true)
      setError(null)
      await loadFirstPaint(appliedFilters)
    } catch (e: unknown) {
      setError(getApiErrorMessage(e))
    } finally {
      setApplying(false)
    }
  }, [appliedFilters, loadFirstPaint])

  const retryOrphanRequest = useCallback(() => {
    void loadOrphanDetail(orphanPage, appliedFilters)
  }, [appliedFilters, loadOrphanDetail, orphanPage])

  useEffect(() => {
    if (!summary || loadingSummary || applying) return
    void markPerfReady('cohorte')
  }, [applying, loadingSummary, summary])

  const totals = summary?.totals
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
    const emptyTramoRow: NonNullable<CobranzasCohorteSummaryResponse['by_tramo']>[string] = {
      activos: 0,
      pagaron: 0,
      deberia: 0,
      cobrado: 0,
      pct_pago_contratos: 0,
      pct_cobertura_monto: 0,
    }
    const byTramo = summary?.by_tramo || {}
    const tramoEntries = Object.entries(byTramo)
    if (tramoEntries.length > 0) {
      const map = new Map(
        tramoEntries.map(([k, v]) => {
          const n = Number.parseInt(String(k), 10)
          return [Number.isFinite(n) ? String(n) : '0', v]
        }),
      )
      const maxFromApi = Math.max(0, ...[...map.keys()].map((k) => Number.parseInt(k, 10) || 0))
      const upTo = Math.max(COHORTE_TRAMO_MAX, maxFromApi)
      return Array.from({ length: upTo + 1 }, (_, i) => {
        const key = String(i)
        const row = map.get(key)
        return [key, row ?? emptyTramoRow] as [string, NonNullable<CobranzasCohorteSummaryResponse['by_tramo']>[string]]
      })
    }
    return Object.entries(summary?.by_year || {}).sort((a, b) => Number(b[0] || 0) - Number(a[0] || 0))
  }, [summary?.by_tramo, summary?.by_year])
  const usesTramoBreakdown = useMemo(() => Object.keys(summary?.by_tramo || {}).length > 0, [summary?.by_tramo])

  const cohorteResumenTableTotals = useMemo(() => {
    let activos = 0
    let pagaron = 0
    let deberia = 0
    let cobrado = 0
    for (const [, row] of byTramoEntries) {
      activos += Number(row.activos || 0)
      pagaron += Number(row.pagaron || 0)
      deberia += Number(row.deberia || 0)
      cobrado += Number(row.cobrado || 0)
    }
    const pctPagoContratos = activos > 0 ? pagaron / activos : 0
    const pctCoberturaMonto = deberia > 0 ? cobrado / deberia : 0
    return { activos, pagaron, deberia, cobrado, pctPagoContratos, pctCoberturaMonto }
  }, [byTramoEntries])

  const activeFilterChips = useMemo<FilterChip[]>(() => {
    const blocks: Array<{ key: MultiValueFilterKey; label: string }> = [
      { key: 'uns', label: 'UN' },
      { key: 'vias', label: 'Via de cobro' },
      { key: 'categorias', label: 'Categoria' },
      { key: 'supervisors', label: 'Supervisor' },
    ]

    return blocks.flatMap((block) =>
      (filters[block.key] || []).map((value) => ({ key: block.key, label: block.label, value })),
    )
  }, [filters])

  const removeChip = useCallback((chip: FilterChip) => {
    setFilters((prev) => ({
      ...prev,
      [chip.key]: (prev[chip.key as keyof Filters] as string[]).filter((item) => item !== chip.value),
    }))
  }, [])

  const hasRows = byTramoEntries.length > 0
  const noCohorteData = options.cutoffMonths.length === 0

  useEffect(() => {
    if (cohorteTab !== 'sin_cierre_cartera' || loadingOptions || noCohorteData) return
    void loadOrphanDetail(orphanPage, appliedFilters)
  }, [appliedFilters, cohorteTab, loadOrphanDetail, loadingOptions, noCohorteData, orphanPage])

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
    <div className="analysis-meta-row--with-info">
      <div className="analysis-meta-chips-cluster">
        <AnalyticsMetaBadges meta={summary?.meta} embed />
        {summary?.cutoff_month ? (
          <span className="analysis-meta-chip">Corte de cobranza: <strong>{summary.cutoff_month}</strong></span>
        ) : null}
        {gestionBase ? (
          <span className="analysis-meta-chip">
            Gestion usada: <strong>{gestionBase}</strong>
            {cierreBase ? <> (Cierre base: <strong>{cierreBase}</strong>)</> : null}
          </span>
        ) : null}
      </div>
      <MetricExplainer
        className="metric-explainer--meta-trailing"
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
    </div>
  )

  return (
    <section className="analysis-card-wrap">
      <Card className="cohorte-panel-root analysis-panel-card border border-[var(--color-border)] shadow-lg overflow-visible p-6">
        <AnalyticsPageHeader
        kicker="COHORTE"
        pill="Analytics v2"
        title="Analisis de cobranzas por corte"
        subtitle="Cobro del corte seleccionado, segmentado por mes o año de venta y alineado a la gestion operativa."
        meta={metaCohorte}
      />

      {loadingOptions ? (
        <AnalysisFiltersSkeleton filterCount={5} kpiCount={6} showTable />
      ) : null}

      {!loadingOptions ? (
        <>
          <div className="rendimiento-filters-panel">
            <DashboardFiltersLayout
              sectionId="analisisCobranzaCohorte"
              macroGridDataTestId="analysis-filters-grid"
              slots={{
                cobro_cutoff_month: (
                  <div className="analysis-filter-control">
                    <label className="input-label" id="cutoff-month-label">Mes de cobro</label>
                    <CobranzasCohorteCutoffRangeControl
                      cutoffOptions={options.cutoffMonths}
                      cohorteYears={cohorteYears}
                      selectedYears={cohorteCutoffYears}
                      onSelectedYearsChange={setCohorteCutoffYears}
                      monthRange={cohorteCutoffMonthRange}
                      onMonthRangeChange={setCohorteCutoffMonthRange}
                    />
                    {filters.cutoffMonth ? (
                      <p className="text-[11px] text-[var(--color-text-muted)] mt-2" aria-live="polite">
                        Corte efectivo: <strong className="text-[var(--color-text)]">{filters.cutoffMonth}</strong>
                      </p>
                    ) : null}
                  </div>
                ),
                via_cobro: (
                  <ConfigurableViaFilter
                    sectionId="analisisCobranzaCohorte"
                    viaId="via_cobro"
                    className="analysis-filter-control"
                    label="Vía de cobro"
                    options={options.vias}
                    selected={filters.vias}
                    onChange={(vias) => setFilters((prev) => ({ ...prev, vias }))}
                    fixedAbbrevOptions={VIA_DEBITO_COBRADOR_ABBREV_OPTIONS}
                  />
                ),
                supervisor: (
                  <MultiSelectFilter
                    className="analysis-filter-control"
                    label="Supervisor"
                    options={options.supervisors}
                    selected={filters.supervisors}
                    onChange={(values) => setFilters((prev) => ({ ...prev, supervisors: values }))}
                    placeholder="Todos"
                  />
                ),
                categoria: (
                  <ConfigurableCategoriaFilter
                    sectionId="analisisCobranzaCohorte"
                    className="analysis-filter-control"
                    categoryOptions={options.categorias}
                    selected={filters.categorias}
                    onChange={(categorias) => setFilters((prev) => ({ ...prev, categorias }))}
                  />
                ),
                un: (
                  <ConfigurableUnFilter
                    sectionId="analisisCobranzaCohorte"
                    className="analysis-filter-control"
                    label="UN"
                    options={options.uns}
                    selected={filters.uns}
                    onChange={(values) => setFilters((prev) => ({ ...prev, uns: values }))}
                  />
                ),
              }}
            />
            <div className="rendimiento-filter-hints" role="note" aria-label="Ayuda de filtros">
              <span className="rendimiento-filter-hint">
                Años y rango de mes calendario eligen el corte; se consulta el mes de cobro más reciente del rango con datos.
              </span>
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

          <Tabs
            selectedKey={cohorteTab}
            onSelectionChange={(key) => key != null && setCohorteTab(String(key) as CohorteMainTab)}
            className="cohorte-view-tabs mt-3 mb-2"
            aria-label="Vistas de análisis por corte"
          >
            <Tabs.ListContainer>
              <Tabs.List>
                <Tabs.Tab id="principal">Vista cohorte</Tabs.Tab>
                <Tabs.Tab id="sin_cierre_cartera">Cobranzas sin cierre cartera</Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>

          {noCohorteData ? (
            <EmptyState
              className="analysis-empty"
              message="No hay datos de cobranzas por corte para los criterios seleccionados."
              suggestion="Prueba a cambiar el mes de cobro o los filtros. Si el sistema acaba de sincronizar, puede que aún no se hayan cargado los datos."
            />
          ) : null}

          {cohorteTab === 'principal' ? (
            <>
              {error ? <ErrorState message={error} className="analysis-error" onRetry={() => void retryLastRequest()} disabled={applying} /> : null}

              {applying && summary ? <LoadingState message="Actualizando resultados..." className="summary-loading-note" /> : null}
              {loadingSummary && !summary ? <LoadingState message="Cargando resumen inicial..." className="summary-loading-note" /> : null}
              <div className={`analysis-results data-transition ${applying || loadingSummary ? 'data-transition--loading' : ''}`}>
                <div className="summary-grid cohorte-kpi-summary-grid rendimiento-kpi-summary-grid">
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

                <div className="analysis-table-section analysis-table-section--cohorte-resumen">
                  <Card
                    variant="transparent"
                    className="cohorte-resumen-bloc-card w-full min-w-0 gap-0 overflow-visible p-0 shadow-none"
                  >
                    <Card.Header className="flex flex-col gap-1.5 px-4 pb-3 pt-4">
                      <Card.Title className="text-sm font-semibold text-[var(--color-text)]">
                        {usesTramoBreakdown ? 'Resumen de efectividad por tramo' : 'Resumen de efectividad por año de venta'}
                      </Card.Title>
                      <p className="m-0 text-xs leading-snug text-[var(--color-text-muted)]">
                        {usesTramoBreakdown
                          ? 'Incluye tramos 0 al 7. Si el panel es estrecho, desplázate horizontalmente en la tabla.'
                          : 'Desliza la tabla horizontalmente para revisar todas las métricas.'}
                      </p>
                    </Card.Header>
                    <Card.Content className="overflow-visible pt-0 pb-4 px-1 sm:px-2">
                      <div className="cohorte-resumen-basic-table w-full min-w-0">
                        <Table variant="secondary" className="min-w-0 w-full bg-transparent">
                          <Table.ScrollContainer>
                            <Table.Content
                              aria-label={
                                usesTramoBreakdown
                                  ? 'Resumen de efectividad por tramo'
                                  : 'Resumen de efectividad por año de venta'
                              }
                              className="min-w-[600px] sm:min-w-[52rem] lg:min-w-[64rem]"
                            >
                              <Table.Header>
                                <Table.Column isRowHeader>{usesTramoBreakdown ? 'Tramo' : 'Año'}</Table.Column>
                                <Table.Column className="text-end">Activos</Table.Column>
                                <Table.Column className="text-end">Pagaron</Table.Column>
                                <Table.Column className="text-end">% Pago Contratos</Table.Column>
                                <Table.Column className="text-end">Debería</Table.Column>
                                <Table.Column className="text-end">Cobrado</Table.Column>
                                <Table.Column className="text-end">% Cobertura Monto</Table.Column>
                              </Table.Header>
                              <Table.Body>
                                {byTramoEntries.map(([key, row]) => (
                                  <Table.Row key={key}>
                                    <Table.Cell>{usesTramoBreakdown ? `Tramo ${key}` : key}</Table.Cell>
                                    <Table.Cell className="text-end tabular-nums">{formatCount(row.activos || 0)}</Table.Cell>
                                    <Table.Cell className="text-end tabular-nums">{formatCount(row.pagaron || 0)}</Table.Cell>
                                    <Table.Cell className="text-end tabular-nums">{pct(row.pct_pago_contratos || 0)}</Table.Cell>
                                    <Table.Cell className="text-end tabular-nums">{formatGsFull(row.deberia || 0)}</Table.Cell>
                                    <Table.Cell className="text-end tabular-nums">{formatGsFull(row.cobrado || 0)}</Table.Cell>
                                    <Table.Cell className="text-end tabular-nums">{pct(row.pct_cobertura_monto || 0)}</Table.Cell>
                                  </Table.Row>
                                ))}
                                {hasRows ? (
                                  <Table.Row className="cohorte-resumen-total-row">
                                    <Table.Cell>TOTAL</Table.Cell>
                                    <Table.Cell className="text-end tabular-nums">
                                      {formatCount(cohorteResumenTableTotals.activos)}
                                    </Table.Cell>
                                    <Table.Cell className="text-end tabular-nums">
                                      {formatCount(cohorteResumenTableTotals.pagaron)}
                                    </Table.Cell>
                                    <Table.Cell className="text-end tabular-nums">
                                      {pct(cohorteResumenTableTotals.pctPagoContratos)}
                                    </Table.Cell>
                                    <Table.Cell className="text-end tabular-nums">
                                      {formatGsFull(cohorteResumenTableTotals.deberia)}
                                    </Table.Cell>
                                    <Table.Cell className="text-end tabular-nums">
                                      {formatGsFull(cohorteResumenTableTotals.cobrado)}
                                    </Table.Cell>
                                    <Table.Cell className="text-end tabular-nums">
                                      {pct(cohorteResumenTableTotals.pctCoberturaMonto)}
                                    </Table.Cell>
                                  </Table.Row>
                                ) : null}
                              </Table.Body>
                            </Table.Content>
                          </Table.ScrollContainer>
                          <Table.Footer className="cohorte-resumen-table-heroui-footer sm:hidden">
                            <span className="text-center text-xs leading-snug text-[var(--color-text-muted)]">
                              Deslizá horizontalmente para ver todas las columnas.
                            </span>
                          </Table.Footer>
                        </Table>
                      </div>
                    </Card.Content>
                  </Card>
                </div>
              </div>
            </>
          ) : !noCohorteData ? (
            <>
              {orphanError ? (
                <ErrorState
                  message={orphanError}
                  className="analysis-error"
                  onRetry={() => void retryOrphanRequest()}
                  disabled={loadingOrphan}
                />
              ) : null}
              {loadingOrphan && !orphanDetail?.items?.length ? (
                <LoadingState message="Cargando detalle de cobranzas sin cierre cartera..." className="summary-loading-note" />
              ) : null}
              <div className={`analysis-results data-transition ${loadingOrphan ? 'data-transition--loading' : ''}`}>
                <p className="analysis-table-caption">
                  Cobranzas sin cierre cartera: pagos del corte <strong>{orphanDetail?.cutoff_month || appliedFilters.cutoffMonth || '—'}</strong> sin fila de cartera para la gestión efectiva{' '}
                  <strong>{orphanDetail?.effective_cartera_month || '—'}</strong>. Tramo y categoría se infieren desde el extracto de cobranzas (tramos 0 a 7).
                </p>
                <p className="table-scroll-hint">
                  Estos montos se suman al total cobrado de la cohorte; aquí puedes auditar contratos y transacciones afectadas.
                </p>
                <div className="analysis-meta-row--with-info mb-3">
                  <div className="analysis-meta-chips-cluster">
                    <AnalyticsMetaBadges meta={orphanDetail?.meta} embed />
                    {orphanDetail?.totals ? (
                      <>
                        <span className="analysis-meta-chip">
                          Contratos: <strong>{formatCount(orphanDetail.totals.contratos || 0)}</strong>
                        </span>
                        <span className="analysis-meta-chip">
                          Transacciones: <strong>{formatCount(orphanDetail.totals.transacciones || 0)}</strong>
                        </span>
                        <span className="analysis-meta-chip">
                          Cobrado sin cierre cartera: <strong>{formatGsFull(orphanDetail.totals.cobrado || 0)}</strong>
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="table-wrap analysis-table-wrap analysis-table-wrap-annual">
                  <table className="cohorte-resumen-table">
                    <thead>
                      <tr>
                        <th>Contrato</th>
                        <th>UN</th>
                        <th>Supervisor</th>
                        <th>Vía</th>
                        <th className="num">Tramo</th>
                        <th>Categoría</th>
                        <th className="num">Líneas</th>
                        <th className="num">Cobrado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(orphanDetail?.items || []).map((row) => (
                        <tr key={row.contract_id}>
                          <td className="analysis-key-cell">{row.contract_id}</td>
                          <td>{row.un}</td>
                          <td>{row.supervisor}</td>
                          <td>{row.via}</td>
                          <td className="num">{row.tramo}</td>
                          <td>{row.categoria}</td>
                          <td className="num">{formatCount(row.transacciones || 0)}</td>
                          <td className="num">{formatGsFull(row.cobrado || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                    {(orphanDetail?.items || []).length === 0 && !loadingOrphan ? (
                      <tbody>
                        <tr>
                          <td colSpan={8}>
                            <EmptyState
                              className="analysis-empty analysis-empty--inline"
                              message="No hay cobranzas sin cierre cartera para los filtros aplicados."
                              suggestion="Si esperabas filas, revisa el mes de corte o sincronización de cartera y cobranzas."
                            />
                          </td>
                        </tr>
                      </tbody>
                    ) : null}
                  </table>
                </div>
                {(() => {
                  const ps = orphanDetail?.page_size || 50
                  const total = orphanDetail?.total_items || 0
                  const pages = Math.max(1, Math.ceil(total / ps))
                  if (total <= ps) return null
                  return (
                    <div className="analysis-actions-row analysis-actions mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onPress={() => setOrphanPage((p) => Math.max(1, p - 1))}
                        isDisabled={loadingOrphan || orphanPage <= 1}
                      >
                        Anterior
                      </Button>
                      <span className="text-sm text-[var(--color-text-muted)]">
                        Página {orphanPage} de {pages} ({formatCount(total)} contratos)
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onPress={() => setOrphanPage((p) => Math.min(pages, p + 1))}
                        isDisabled={loadingOrphan || orphanPage >= pages || !orphanDetail?.has_next}
                      >
                        Siguiente
                      </Button>
                    </div>
                  )
                })()}
              </div>
            </>
          ) : null}
        </>
      ) : null}
      </Card>

      {!loadingOptions && showFloatingFilters ? (
        <FloatingQuickFilters
          isOpen={floatOpen}
          onOpen={openFloatFilters}
          onCollapse={() => setFloatOpen(false)}
          onApply={() => void applyFloatFilters()}
          floatDraftActivityKey={floatDraftActivityKey}
          floatAppliedActivityKey={floatAppliedActivityKey}
          applyDisabled={
            applying ||
            loadingSummary ||
            noCohorteData ||
            (floatLayoutEff.floating.includes('cobro_cutoff_month') && !floatCutoff)
          }
          applying={applying || loadingSummary}
        >
          <DashboardFloatingFiltersLayout
            sectionId="analisisCobranzaCohorte"
            slots={floatSlots}
          />
        </FloatingQuickFilters>
      ) : null}
    </section>
  )
}
