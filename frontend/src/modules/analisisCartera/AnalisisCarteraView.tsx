import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MultiSelectFilter } from '../../components/filters/MultiSelectFilter'
import { api, getPortfolioOptions, type PortfolioOptionsResponse } from '../../shared/api'
import { getApiErrorMessage } from '../../shared/apiErrors'

type Filters = {
  uns: string[]
  vias: string[]
  tramos: string[]
  categorias: string[]
  months: string[]
  closeMonths: string[]
}

type SummaryResponse = {
  rows?: Array<Record<string, unknown>>
  charts?: {
    by_un?: Record<string, number>
    by_tramo?: Record<string, number>
    by_via?: Record<string, number>
    by_category?: Record<string, number>
    by_contract_year?: Record<string, number>
  }
  total_contracts?: number
  debt_total?: number
  expired_total?: number
  cuota_total?: number
}

type ChartId = 'by_un' | 'by_tramo' | 'by_via' | 'by_contract_year'
type YearSort = 'desc' | 'asc'

const formatGs = (value: number) => `Gs. ${Math.round(Number(value || 0)).toLocaleString('es-PY')}`
const formatCount = (value: number) => Math.round(Number(value || 0)).toLocaleString('es-PY')
const formatPct = (value: number, total: number) => `${((Number(value || 0) / Math.max(1, Number(total || 0))) * 100).toFixed(1)}%`

const CHART_COLORS = ['#42b9ee', '#8b8eff', '#9c7df2', '#4dd7a4', '#f8d34f', '#ff9b6a', '#67a4ff']

function DonutChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({})
  const visible = data.filter((d) => !hidden[d.label])
  const total = visible.reduce((a, b) => a + b.value, 0) || 1
  let acc = 0

  useEffect(() => {
    const labels = new Set(data.map((d) => d.label))
    setHidden((prev) => {
      const next: Record<string, boolean> = {}
      Object.entries(prev).forEach(([k, v]) => {
        if (labels.has(k)) next[k] = v
      })
      return next
    })
  }, [data])

  const toggle = (label: string) => {
    setHidden((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <svg width="210" height="210" viewBox="0 0 210 210" role="img" aria-label="Contratos por tramo">
        <g transform="translate(105,105)">
          {visible.map((d, idx) => {
            const start = (acc / total) * Math.PI * 2
            acc += d.value
            const end = (acc / total) * Math.PI * 2
            const rOuter = 86
            const rInner = 50
            const large = end - start > Math.PI ? 1 : 0
            const x1 = Math.cos(start) * rOuter
            const y1 = Math.sin(start) * rOuter
            const x2 = Math.cos(end) * rOuter
            const y2 = Math.sin(end) * rOuter
            const x3 = Math.cos(end) * rInner
            const y3 = Math.sin(end) * rInner
            const x4 = Math.cos(start) * rInner
            const y4 = Math.sin(start) * rInner
            const path = `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4} Z`
            return <path key={d.label} d={path} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
          })}
          <circle r="40" fill="#1a2740" />
        </g>
      </svg>
      <div style={{ fontSize: '0.85rem' }}>
        {data.map((d, idx) => {
          const isHidden = !!hidden[d.label]
          return (
            <button
              key={d.label}
              type="button"
              onClick={() => toggle(d.label)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                marginBottom: '0.25rem',
                background: 'transparent',
                border: 'none',
                color: isHidden ? 'var(--color-text-muted)' : 'var(--color-text)',
                cursor: 'pointer',
                textDecoration: isHidden ? 'line-through' : 'none',
                padding: 0,
              }}
              title={isHidden ? 'Mostrar serie' : 'Ocultar serie'}
            >
              <span style={{ width: 12, height: 12, background: CHART_COLORS[idx % CHART_COLORS.length], borderRadius: 2 }} />
              <span>{d.label}: {formatCount(d.value)} ({formatPct(d.value, total)})</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function BarChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({})
  const visible = data.filter((d) => !hidden[d.label])
  const max = Math.max(1, ...visible.map((d) => d.value))
  const total = Math.max(1, visible.reduce((acc, d) => acc + Number(d.value || 0), 0))

  useEffect(() => {
    const labels = new Set(data.map((d) => d.label))
    setHidden((prev) => {
      const next: Record<string, boolean> = {}
      Object.entries(prev).forEach(([k, v]) => {
        if (labels.has(k)) next[k] = v
      })
      return next
    })
  }, [data])

  const toggle = (label: string) => {
    setHidden((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <div style={{ display: 'grid', gap: '0.45rem' }}>
      {data.map((d, idx) => {
        const isHidden = !!hidden[d.label]
        const widthPct = isHidden ? 0 : Math.max(3, Math.round((d.value / max) * 100))
        return (
          <button
            key={d.label}
            type="button"
            onClick={() => toggle(d.label)}
            title={isHidden ? 'Mostrar serie' : 'Ocultar serie'}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              textAlign: 'left',
              cursor: 'pointer',
              color: isHidden ? 'var(--color-text-muted)' : 'var(--color-text)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.15rem' }}>
              <span style={{ textDecoration: isHidden ? 'line-through' : 'none' }}>{d.label}</span>
              <span>{formatCount(d.value)} ({formatPct(d.value, total)})</span>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.12)' }}>
              <div
                style={{
                  width: `${widthPct}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: CHART_COLORS[idx % CHART_COLORS.length],
                }}
              />
            </div>
          </button>
        )
      })}
    </div>
  )
}

export function AnalisisCarteraView() {
  const summaryRequestSeq = useRef(0)
  const [filters, setFilters] = useState<Filters>({
    uns: [],
    vias: [],
    tramos: [],
    categorias: [],
    months: [],
    closeMonths: [],
  })
  const [appliedFilters, setAppliedFilters] = useState<Filters>({
    uns: [],
    vias: [],
    tramos: [],
    categorias: [],
    months: [],
    closeMonths: [],
  })
  const [optionsData, setOptionsData] = useState<PortfolioOptionsResponse | null>(null)
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null)
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [optionsError, setOptionsError] = useState('')
  const [summaryError, setSummaryError] = useState('')
  const [optionsReady, setOptionsReady] = useState(false)
  const [chartOrder, setChartOrder] = useState<ChartId[]>(['by_un', 'by_tramo', 'by_via', 'by_contract_year'])
  const [draggingChart, setDraggingChart] = useState<ChartId | null>(null)
  const [dragOverChart, setDragOverChart] = useState<ChartId | null>(null)
  const [yearSort, setYearSort] = useState<YearSort>('desc')
  const isInitialOptionsLoading = loadingOptions && !optionsData && !optionsError

  const toPayload = useCallback((next: Filters) => ({
    supervisor: [],
    un: next.uns,
    via_cobro: next.vias,
    anio: [],
    contract_month: next.months,
    gestion_month: next.months,
    close_month: next.closeMonths,
    via_pago: [],
    categoria: next.categorias,
    tramo: next.tramos,
  }), [])

  const loadOptions = useCallback(async (next: Filters) => {
    setLoadingOptions(true)
    setOptionsReady(false)
    setOptionsError('')
    try {
      const res = await getPortfolioOptions(toPayload(next))
      setOptionsData(res || { options: {} })
    } catch (e: unknown) {
      setOptionsError(getApiErrorMessage(e))
      setOptionsData(null)
    } finally {
      setLoadingOptions(false)
      setOptionsReady(true)
    }
  }, [toPayload])

  const loadSummary = useCallback(async (next: Filters) => {
    const requestId = ++summaryRequestSeq.current
    setLoadingSummary(true)
    setSummaryError('')
    try {
      const res = await api.post<SummaryResponse>('/analytics/portfolio/summary', {
        ...toPayload(next),
        include_rows: false,
      })
      if (requestId !== summaryRequestSeq.current) return
      setSummaryData(res.data || {})
    } catch (e: unknown) {
      if (requestId !== summaryRequestSeq.current) return
      setSummaryError(getApiErrorMessage(e))
      setSummaryData(null)
    } finally {
      if (requestId !== summaryRequestSeq.current) return
      setLoadingSummary(false)
    }
  }, [toPayload])

  useEffect(() => {
    void loadOptions(filters)
  }, [loadOptions])

  useEffect(() => {
    if (!optionsReady) return
    void loadSummary(appliedFilters)
  }, [appliedFilters, loadSummary, optionsReady])

  const applyFilters = useCallback(() => {
    setAppliedFilters(filters)
  }, [filters])

  const clearFilters = useCallback(() => {
    const empty: Filters = {
      uns: [],
      vias: [],
      tramos: [],
      categorias: [],
      months: [],
      closeMonths: [],
    }
    setFilters(empty)
    setAppliedFilters(empty)
  }, [])

  const options = optionsData?.options || {}

  const byUn = useMemo(() => {
    const src = summaryData?.charts?.by_un || {}
    return Object.entries(src)
      .map(([label, value]) => ({ label, value: Number(value || 0) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [summaryData])

  const byTramo = useMemo(() => {
    const src = summaryData?.charts?.by_tramo || {}
    return Object.entries(src)
      .map(([label, value]) => ({ label: `Tramo ${label}`, value: Number(value || 0) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [summaryData])

  const byVia = useMemo(() => {
    const src = summaryData?.charts?.by_via || {}
    return Object.entries(src)
      .map(([label, value]) => ({ label: String(label), value: Number(value || 0) }))
      .sort((a, b) => b.value - a.value)
  }, [summaryData])

  const byContractYear = useMemo(() => {
    const src = summaryData?.charts?.by_contract_year || {}
    const rows = Object.entries(src)
      .map(([label, value]) => ({ label: String(label), value: Number(value || 0) }))
      .filter((x) => x.label && x.label !== 'null')
    if (yearSort === 'asc') {
      return rows.sort((a, b) => a.value - b.value || Number(a.label) - Number(b.label))
    }
    return rows.sort((a, b) => b.value - a.value || Number(a.label) - Number(b.label))
  }, [summaryData, yearSort])

  const totalContracts = Number(summaryData?.total_contracts || 0)
  const cuotaTotal = Number(summaryData?.cuota_total || 0)
  const totalAmount = cuotaTotal > 0
    ? cuotaTotal + Number(summaryData?.expired_total || 0)
    : Number(summaryData?.debt_total || 0) + Number(summaryData?.expired_total || 0)

  const moveChart = useCallback((fromId: ChartId, toId: ChartId) => {
    if (fromId === toId) return
    setChartOrder((prev) => {
      const fromIdx = prev.indexOf(fromId)
      const toIdx = prev.indexOf(toId)
      if (fromIdx < 0 || toIdx < 0) return prev
      const next = [...prev]
      next.splice(fromIdx, 1)
      next.splice(toIdx, 0, fromId)
      return next
    })
  }, [])

  const chartCards: Record<ChartId, { title: string; content: JSX.Element }> = {
    by_un: { title: 'Contratos por Unidad de Negocio', content: <BarChart data={byUn} /> },
    by_tramo: { title: 'Contratos por Tramo', content: <DonutChart data={byTramo} /> },
    by_via: { title: 'Contratos por Via de Cobro', content: <BarChart data={byVia} /> },
    by_contract_year: { title: 'Contratos por Ano de Contrato', content: <BarChart data={byContractYear} /> },
  }

  return (
    <section className="card analysis-card">
      <h2>Análisis de Cartera</h2>

      <div className="filters-grid">
        <MultiSelectFilter label="Unidad de Negocio" options={options.uns || []} selected={filters.uns} onChange={(uns) => setFilters((f) => ({ ...f, uns }))} />
        <MultiSelectFilter label="Vía de Cobro" options={options.vias || []} selected={filters.vias} onChange={(vias) => setFilters((f) => ({ ...f, vias }))} />
        <MultiSelectFilter label="Tramo" options={options.tramos || []} selected={filters.tramos} onChange={(tramos) => setFilters((f) => ({ ...f, tramos }))} />
        <MultiSelectFilter label="Categoria" options={options.categories || []} selected={filters.categorias} onChange={(categorias) => setFilters((f) => ({ ...f, categorias }))} />
        <MultiSelectFilter label="Fecha de Gestión" options={options.months || []} selected={filters.months} onChange={(months) => setFilters((f) => ({ ...f, months }))} />
        <MultiSelectFilter label="Fecha de Cierre" options={options.close_months || []} selected={filters.closeMonths} onChange={(closeMonths) => setFilters((f) => ({ ...f, closeMonths }))} />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button type="button" className="btn btn-primary" onClick={applyFilters} disabled={loadingOptions}>
          Aplicar filtros
        </button>
        <button type="button" className="btn btn-secondary" onClick={clearFilters} disabled={loadingOptions}>
          Limpiar filtros
        </button>
      </div>

      {isInitialOptionsLoading && (
        <div className="analysis-skeleton-wrap" aria-live="polite" aria-busy="true">
          <div className="analysis-skeleton-grid">
            <div className="analysis-skeleton-input" />
            <div className="analysis-skeleton-input" />
            <div className="analysis-skeleton-input" />
            <div className="analysis-skeleton-input" />
            <div className="analysis-skeleton-input" />
            <div className="analysis-skeleton-input" />
          </div>
          <div className="analysis-skeleton-summary">
            <div className="analysis-skeleton-kpi" />
            <div className="analysis-skeleton-kpi" />
          </div>
        </div>
      )}
      {loadingOptions && !isInitialOptionsLoading && <p>Cargando filtros...</p>}
      {!loadingOptions && optionsError && <div className="alert-error">{optionsError}</div>}
      {loadingSummary && <p>Cargando resumen...</p>}
      {!loadingSummary && summaryError && <div className="alert-error">{summaryError}</div>}

      {!summaryError && (
        <>
          <div className="summary-grid">
            <article className="card" style={{ padding: '1rem', borderLeft: '4px solid #8ca8c9' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>TOTAL CONTRATOS</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.1 }}>{formatCount(totalContracts)}</div>
            </article>
            <article className="card" style={{ padding: '1rem', borderLeft: '4px solid #ffcd38' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>MONTO TOTAL (CUOTA + VENCIDO)</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.1, color: '#ffcd38' }}>{formatGs(totalAmount)}</div>
            </article>
          </div>

          <div className="charts-grid">
            {chartOrder.map((chartId) => {
              const card = chartCards[chartId]
              return (
                <article
                  key={chartId}
                  className={`card chart-card ${dragOverChart === chartId ? 'chart-drop-target' : ''}`}
                  style={{ padding: '1rem' }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (draggingChart && draggingChart !== chartId) setDragOverChart(chartId)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const fromId = (e.dataTransfer.getData('text/plain') || draggingChart || '') as ChartId
                    if (fromId) moveChart(fromId, chartId)
                    setDraggingChart(null)
                    setDragOverChart(null)
                  }}
                >
                  <div className="chart-card-header">
                    <h3 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1rem' }}>{card.title}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {chartId === 'by_contract_year' && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                          onClick={() => setYearSort((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                          title="Ordenar por cantidad"
                        >
                          {yearSort === 'desc' ? 'Mayor->Menor' : 'Menor->Mayor'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="chart-drag-handle"
                        draggable
                        title="Arrastrar para reordenar"
                        onDragStart={(e) => {
                          setDraggingChart(chartId)
                          e.dataTransfer.effectAllowed = 'move'
                          e.dataTransfer.setData('text/plain', chartId)
                        }}
                        onDragEnd={() => {
                          setDraggingChart(null)
                          setDragOverChart(null)
                        }}
                      >
                        Mover
                      </button>
                    </div>
                  </div>
                  {card.content}
                </article>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}
