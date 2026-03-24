import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@heroui/react'
import { AnalyticsPageHeader } from '../../components/analytics/AnalyticsPageHeader'
import { EmptyState } from '../../components/feedback/EmptyState'
import { ErrorState } from '../../components/feedback/ErrorState'
import { LoadingState } from '../../components/feedback/LoadingState'
import { MultiSelectFilter } from '../../components/filters/MultiSelectFilter'
import { api } from '../../shared/api'
import { getApiErrorMessage } from '../../shared/apiErrors'
import type { BrokersFilters } from '../../shared/contracts'
import { EMPTY_BROKERS_FILTERS } from '../../shared/contracts'
import { loadCarteraPreferences, persistCarteraPreferences } from '../../store/userPreferences'

type PortfolioRow = {
  contract_id?: string
  supervisor?: string
  un?: string
  via?: string
  year?: string
  month?: string
  tramo?: string
  category?: string
  debt?: number
  expired?: number
}

const formatGs = (value: number) => `Gs. ${Math.round(Number(value || 0)).toLocaleString('es-PY')}`
const formatCount = (value: number) => Math.round(Number(value || 0)).toLocaleString('es-PY')

export function CarteraView() {
  const [filters, setFilters] = useState<BrokersFilters>(EMPTY_BROKERS_FILTERS)
  const [draftFilters, setDraftFilters] = useState<BrokersFilters>(EMPTY_BROKERS_FILTERS)
  const [rows, setRows] = useState<PortfolioRow[]>([])
  const [summary, setSummary] = useState<Record<string, unknown>>({})
  const [options, setOptions] = useState<{
    supervisors: string[]
    uns: string[]
    vias: string[]
    years: string[]
    months: string[]
  }>({ supervisors: [], uns: [], vias: [], years: [], months: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadSummary = useCallback(async (nextFilters: BrokersFilters) => {
    setLoading(true)
    setError('')
    try {
      const payload = {
        supervisor: nextFilters.supervisors,
        un: nextFilters.uns,
        via_cobro: nextFilters.vias,
        anio: nextFilters.years,
        contract_month: nextFilters.months,
        gestion_month: [],
        via_pago: [],
        categoria: [],
        tramo: [],
      }
      const res = await api.post('/analytics/portfolio/summary', payload)
      const data = (res.data || {}) as Record<string, unknown>
      const rawRows = Array.isArray(data.rows) ? (data.rows as PortfolioRow[]) : []
      const apiOptions = (data.options || {}) as Record<string, unknown>

      setRows(rawRows)
      setSummary(data)
      setOptions({
        supervisors: Array.isArray(apiOptions.supervisors) ? (apiOptions.supervisors as string[]) : [],
        uns: Array.isArray(apiOptions.uns) ? (apiOptions.uns as string[]) : [],
        vias: Array.isArray(apiOptions.vias) ? (apiOptions.vias as string[]) : [],
        years: Array.isArray(apiOptions.years) ? (apiOptions.years as string[]) : [],
        months: Array.isArray(apiOptions.months) ? (apiOptions.months as string[]) : [],
      })
    } catch (e: unknown) {
      setError(getApiErrorMessage(e))
      setRows([])
      setSummary({})
      setOptions({ supervisors: [], uns: [], vias: [], years: [], months: [] })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const boot = async () => {
      try {
        const pref = await loadCarteraPreferences()
        const next = pref.filters || EMPTY_BROKERS_FILTERS
        setFilters(next)
        setDraftFilters(next)
        await loadSummary(next)
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

  const summaryCards = useMemo(() => {
    const totalContracts = Number(summary.total_contracts || 0)
    const totalRows = Number(summary.total_rows || 0)
    const debtTotal = Number(summary.debt_total || 0)
    const expiredTotal = Number(summary.expired_total || 0)
    return [
      { label: 'Contratos', value: formatCount(totalContracts) },
      { label: 'Registros de detalle', value: formatCount(totalRows) },
      { label: 'Saldo Total', value: formatGs(debtTotal) },
      { label: 'Vencido', value: formatGs(expiredTotal) },
    ]
  }, [summary])

  return (
    <section className="analysis-panel-card">
      <AnalyticsPageHeader
        title="Cartera"
        subtitle="Resumen operativo de cartera con filtros manuales por supervisor, UN, vía y período."
      />

      <div className="filters-grid mb-1">
        <MultiSelectFilter label="Supervisor" options={options.supervisors} selected={draftFilters.supervisors} onChange={(values) => setDraftFilters((prev) => ({ ...prev, supervisors: values }))} />
        <MultiSelectFilter label="UN" options={options.uns} selected={draftFilters.uns} onChange={(values) => setDraftFilters((prev) => ({ ...prev, uns: values }))} />
        <MultiSelectFilter label="Vía" options={options.vias} selected={draftFilters.vias} onChange={(values) => setDraftFilters((prev) => ({ ...prev, vias: values }))} />
        <MultiSelectFilter label="Año" options={options.years} selected={draftFilters.years} onChange={(values) => setDraftFilters((prev) => ({ ...prev, years: values }))} />
        <MultiSelectFilter label="Mes" options={options.months} selected={draftFilters.months} onChange={(values) => setDraftFilters((prev) => ({ ...prev, months: values }))} />
      </div>
      <div className="flex-actions">
        <Button variant="primary" onPress={() => void applyFilters(draftFilters)} isDisabled={loading}>
          {loading ? 'Aplicando…' : 'Aplicar filtros'}
        </Button>
        <Button variant="outline" onPress={() => void resetFilters()} isDisabled={loading}>
          Restablecer
        </Button>
      </div>

      {loading && <LoadingState message="Cargando resumen de cartera..." />}
      {!loading && error && <ErrorState message={error} onRetry={() => void loadSummary(filters)} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyState
          message="Sin datos para los filtros seleccionados."
          suggestion="Probá ajustar Supervisor, UN, Vía o período."
        />
      )}

      {!loading && !error && summaryCards.length > 0 && (
        <div className="summary-cards-grid">
          {summaryCards.map((item) => (
            <article key={item.label} className="card summary-card">
              <div className="summary-card-label">{item.label}</div>
              <div className="summary-card-value">{item.value}</div>
            </article>
          ))}
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Contrato</th>
                <th>Supervisor</th>
                <th>UN</th>
                <th>Vía</th>
                <th>Mes</th>
                <th>Saldo</th>
                <th>Vencido</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 300).map((row, idx) => (
                <tr key={`${row.contract_id || 'c'}-${idx}`}>
                  <td>{String(row.contract_id || '-')}</td>
                  <td>{String(row.supervisor || '-')}</td>
                  <td>{String(row.un || '-')}</td>
                  <td>{String(row.via || '-')}</td>
                  <td>{String(row.month || '-')}</td>
                  <td>{formatGs(Number(row.debt || 0))}</td>
                  <td>{formatGs(Number(row.expired || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(Boolean(summary.rows_limited) || Number(summary.total_rows || 0) > 300) && (
            <p className="text-muted-sm">
              Mostrando 300 de {Number(summary.total_rows || rows.length).toLocaleString('es-PY')} filas.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
