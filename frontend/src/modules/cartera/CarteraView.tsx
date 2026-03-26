import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@heroui/react'
import { AnalyticsPageHeader } from '../../components/analytics/AnalyticsPageHeader'
import { EmptyState } from '../../components/feedback/EmptyState'
import { ErrorState } from '../../components/feedback/ErrorState'
import { LoadingState } from '../../components/feedback/LoadingState'
import { MultiSelectFilter } from '../../components/filters/MultiSelectFilter'
import { getPortfolioCorteOptions, getPortfolioCorteSummary } from '../../shared/api'
import type { PortfolioCorteSummaryResponse } from '../../shared/api'
import { getApiErrorMessage } from '../../shared/apiErrors'
import type { BrokersFilters } from '../../shared/contracts'
import { EMPTY_BROKERS_FILTERS } from '../../shared/contracts'
import { loadCarteraPreferences, persistCarteraPreferences } from '../../store/userPreferences'

const formatCount = (value: number) => Math.round(Number(value || 0)).toLocaleString('es-PY')

function gestionMonthRank(value: string): number {
  const parts = String(value || '')
    .trim()
    .split('/')
  if (parts.length !== 2) return 0
  const m = Number(parts[0])
  const y = Number(parts[1])
  if (!Number.isFinite(m) || !Number.isFinite(y) || m < 1 || m > 12) return 0
  return y * 100 + m
}

function filtersToCortePayload(next: BrokersFilters) {
  return {
    supervisor: next.supervisors,
    un: next.uns,
    via_cobro: next.vias,
    anio: next.years,
    gestion_month: next.months,
    categoria: next.categorias,
    tramo: next.tramos,
  }
}

export function CarteraView() {
  const [filters, setFilters] = useState<BrokersFilters>(EMPTY_BROKERS_FILTERS)
  const [draftFilters, setDraftFilters] = useState<BrokersFilters>(EMPTY_BROKERS_FILTERS)
  const [summary, setSummary] = useState<PortfolioCorteSummaryResponse | null>(null)
  const [options, setOptions] = useState<{
    supervisors: string[]
    uns: string[]
    vias: string[]
    years: string[]
    months: string[]
    categories: string[]
    tramos: string[]
  }>({ supervisors: [], uns: [], vias: [], years: [], months: [], categories: [], tramos: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadOptions = useCallback(async (ctx: BrokersFilters) => {
    const res = await getPortfolioCorteOptions(filtersToCortePayload(ctx))
    const o = res.options || {}
    setOptions({
      supervisors: Array.isArray(o.supervisors) ? o.supervisors : [],
      uns: Array.isArray(o.uns) ? o.uns : [],
      vias: Array.isArray(o.vias) ? o.vias : [],
      years: Array.isArray(o.contract_years) ? o.contract_years : [],
      months: Array.isArray(o.gestion_months) ? o.gestion_months : [],
      categories: Array.isArray(o.categories) ? o.categories : [],
      tramos: Array.isArray(o.tramos) ? o.tramos : [],
    })
    return o
  }, [])

  const loadSummary = useCallback(async (nextFilters: BrokersFilters) => {
    setLoading(true)
    setError('')
    try {
      await loadOptions(nextFilters)
      const data = await getPortfolioCorteSummary(filtersToCortePayload(nextFilters))
      setSummary(data || null)
    } catch (e: unknown) {
      setError(getApiErrorMessage(e))
      setSummary(null)
      setOptions({ supervisors: [], uns: [], vias: [], years: [], months: [], categories: [], tramos: [] })
    } finally {
      setLoading(false)
    }
  }, [loadOptions])

  useEffect(() => {
    const boot = async () => {
      try {
        const pref = await loadCarteraPreferences()
        let next = pref.filters || EMPTY_BROKERS_FILTERS
        const o = await getPortfolioCorteOptions(filtersToCortePayload(next))
        const gestionMonths = Array.isArray(o.options?.gestion_months) ? o.options.gestion_months : []
        if (!next.months.length && gestionMonths.length) {
          next = { ...next, months: [gestionMonths[gestionMonths.length - 1]] }
          await persistCarteraPreferences({ filters: next })
        }
        setFilters(next)
        setDraftFilters(next)
        setOptions({
          supervisors: Array.isArray(o.options?.supervisors) ? o.options.supervisors : [],
          uns: Array.isArray(o.options?.uns) ? o.options.uns : [],
          vias: Array.isArray(o.options?.vias) ? o.options.vias : [],
          years: Array.isArray(o.options?.contract_years) ? o.options.contract_years : [],
          months: gestionMonths,
          categories: Array.isArray(o.options?.categories) ? o.options.categories : [],
          tramos: Array.isArray(o.options?.tramos) ? o.options.tramos : [],
        })
        setLoading(true)
        setError('')
        try {
          const data = await getPortfolioCorteSummary(filtersToCortePayload(next))
          setSummary(data || null)
        } catch (e: unknown) {
          setError(getApiErrorMessage(e))
          setSummary(null)
        } finally {
          setLoading(false)
        }
      } catch {
        setFilters(EMPTY_BROKERS_FILTERS)
        setDraftFilters(EMPTY_BROKERS_FILTERS)
        await loadSummary(EMPTY_BROKERS_FILTERS)
      }
    }
    void boot()
  }, [loadSummary])

  const applyFilters = useCallback(
    async (next: BrokersFilters) => {
      setFilters(next)
      await persistCarteraPreferences({ filters: next })
      await loadSummary(next)
    },
    [loadSummary]
  )

  const resetFilters = useCallback(async () => {
    setDraftFilters(EMPTY_BROKERS_FILTERS)
    await applyFilters(EMPTY_BROKERS_FILTERS)
  }, [applyFilters])

  const kpis = summary?.kpis
  const totalCartera = Number(kpis?.total_cartera ?? 0)

  const byUnRows = useMemo(() => {
    const byUn = summary?.charts?.by_un
    if (!byUn || typeof byUn !== 'object') return []
    return Object.entries(byUn)
      .map(([un, n]) => ({ un, count: Number(n || 0) }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)
  }, [summary?.charts?.by_un])

  const monthColumns = useMemo(() => {
    const valid = filters.months.filter((m) => gestionMonthRank(m) > 0)
    return [...valid].sort((a, b) => gestionMonthRank(a) - gestionMonthRank(b))
  }, [filters.months])

  const byUnByGestion = summary?.charts?.by_un_by_gestion_month
  const showPivotByMonth = !!(byUnByGestion && monthColumns.length > 0)

  const showEmpty = !loading && !error && (!kpis || totalCartera === 0)

  return (
    <section className="analysis-panel-card rendimiento-panel">
      <AnalyticsPageHeader
        kicker="CARTERA"
        pill="Analytics v2"
        title="Cartera"
        subtitle="Resumen por corte operativo (agregados v2). Filtros por mes de gestión, UN, vía, supervisor, categoría (VIGENTE/MOROSO) y tramo — alineado a reportes de cartera. Para detalle por contrato usá «Análisis de cartera»."
      />

      <div className="rendimiento-filters-panel cartera-filters-grid-3">
        <MultiSelectFilter label="Supervisor" options={options.supervisors} selected={draftFilters.supervisors} onChange={(values) => setDraftFilters((prev) => ({ ...prev, supervisors: values }))} />
        <MultiSelectFilter label="UN" options={options.uns} selected={draftFilters.uns} onChange={(values) => setDraftFilters((prev) => ({ ...prev, uns: values }))} />
        <MultiSelectFilter label="Vía de cobro" options={options.vias} selected={draftFilters.vias} onChange={(values) => setDraftFilters((prev) => ({ ...prev, vias: values }))} />
        <MultiSelectFilter label="Categoría" options={options.categories} selected={draftFilters.categorias} onChange={(values) => setDraftFilters((prev) => ({ ...prev, categorias: values }))} />
        <MultiSelectFilter label="Tramo" options={options.tramos} selected={draftFilters.tramos} onChange={(values) => setDraftFilters((prev) => ({ ...prev, tramos: values }))} />
        <MultiSelectFilter label="Año de contrato" options={options.years} selected={draftFilters.years} onChange={(values) => setDraftFilters((prev) => ({ ...prev, years: values }))} />
        <MultiSelectFilter label="Mes de gestión" options={options.months} selected={draftFilters.months} onChange={(values) => setDraftFilters((prev) => ({ ...prev, months: values }))} />
      </div>
      <div className="analysis-actions-row analysis-actions">
        <Button variant="primary" onPress={() => void applyFilters(draftFilters)} isDisabled={loading}>
          {loading ? 'Aplicando…' : 'Aplicar filtros'}
        </Button>
        <Button variant="outline" onPress={() => void resetFilters()} isDisabled={loading}>
          Restablecer
        </Button>
      </div>

      {loading && <LoadingState message="Cargando resumen de cartera…" />}
      {!loading && error && <ErrorState message={error} onRetry={() => void loadSummary(filters)} />}
      {!loading && !error && showEmpty && (
        <EmptyState
          message="Sin datos para los filtros seleccionados."
          suggestion="Probá ajustar supervisor, UN, vía, categoría, tramo o mes de gestión. Para filas por contrato, abrí Análisis de cartera."
        />
      )}

      {!loading && !error && !showEmpty && byUnRows.length > 0 && (
        <>
          <p className="table-scroll-hint mt-4">
            {showPivotByMonth && monthColumns.length > 1
              ? 'Contratos por unidad de negocio y mes de gestión (una columna por mes seleccionado). Desplazá la tabla horizontalmente si hay muchos meses.'
              : showPivotByMonth
                ? 'Contratos por unidad de negocio — mes de gestión seleccionado.'
                : 'Contratos por unidad de negocio (agregado del corte seleccionado).'}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>UN</th>
                  {showPivotByMonth
                    ? monthColumns.map((m) => (
                        <th key={m} className="text-end align-bottom">
                          <span className="block whitespace-nowrap">Gestión {m}</span>
                          <span className="block text-muted-sm font-normal">Contratos</span>
                        </th>
                      ))
                    : (
                      <th>Contratos</th>
                    )}
                </tr>
              </thead>
              <tbody>
                {byUnRows.slice(0, 60).map((row) => (
                  <tr key={row.un}>
                    <td>{row.un}</td>
                    {showPivotByMonth
                      ? monthColumns.map((m) => (
                          <td key={`${row.un}-${m}`} className="text-end tabular-nums">
                            {formatCount(Number(byUnByGestion[m]?.[row.un] ?? 0))}
                          </td>
                        ))
                      : (
                        <td className="text-end tabular-nums">{formatCount(row.count)}</td>
                      )}
                  </tr>
                ))}
              </tbody>
            </table>
            {byUnRows.length > 60 && (
              <p className="text-muted-sm">Mostrando 60 de {byUnRows.length.toLocaleString('es-PY')} UN con contratos.</p>
            )}
          </div>
        </>
      )}
    </section>
  )
}
