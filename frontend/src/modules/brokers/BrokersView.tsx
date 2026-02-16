import React, { useMemo, useState, useEffect } from 'react'
import { MultiSelectFilter } from '../../components/filters/MultiSelectFilter'

type Row = {
  year: string
  month: string
  supervisor: string
  un: string
  via: string
  count: number
  mora3m: number
  montoCuota: number
  commission: number
  prize?: number
}

type Filters = {
  supervisors: string[]
  uns: string[]
  vias: string[]
  years: string[]
  months: string[]
}

type Props = {
  options: {
    supervisors: string[]
    uns: string[]
    vias: string[]
    years: string[]
    months: string[]
  }
  filters: Filters
  onFiltersChange: (next: Filters) => void
  rows: Row[]
  loading: boolean
  error: string
}

export function BrokersView(props: Props) {
  const [draft, setDraft] = useState<Filters>(props.filters)
  useEffect(() => {
    setDraft(props.filters)
  }, [props.filters])

  const totals = useMemo(() => {
    return props.rows.reduce(
      (acc, row) => {
        acc.contracts += Number(row.count || 0)
        acc.mora3m += Number(row.mora3m || 0)
        acc.montoCuota += Number(row.montoCuota || 0)
        acc.commission += Number(row.commission || 0)
        return acc
      },
      { contracts: 0, mora3m: 0, montoCuota: 0, commission: 0 }
    )
  }, [props.rows])

  const setFilter = (key: keyof Filters, values: string[]) => {
    setDraft((prev) => ({ ...prev, [key]: values }))
  }

  const applyFilters = () => {
    props.onFiltersChange(draft)
  }

  const resetFilters = () => {
    const empty: Filters = {
      supervisors: [],
      uns: [],
      vias: [],
      years: [],
      months: [],
    }
    setDraft(empty)
    props.onFiltersChange(empty)
  }

  return (
    <section className="card">
      <h2>Resumen Brokers</h2>
      <div className="kpi-row">
        <span>Contratos: <strong>{totals.contracts}</strong></span>
        <span>Mora 3M: <strong>{totals.mora3m}</strong></span>
        <span>Monto cuota: <strong>{totals.montoCuota.toFixed(2)}</strong></span>
        <span>Comisiones: <strong>{totals.commission.toFixed(2)}</strong></span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <MultiSelectFilter
          label="Supervisor"
          options={props.options.supervisors}
          selected={draft.supervisors}
          onChange={(v) => setFilter('supervisors', v)}
        />
        <MultiSelectFilter
          label="UN"
          options={props.options.uns}
          selected={draft.uns}
          onChange={(v) => setFilter('uns', v)}
        />
        <MultiSelectFilter
          label="Vía"
          options={props.options.vias}
          selected={draft.vias}
          onChange={(v) => setFilter('vias', v)}
        />
        <MultiSelectFilter
          label="Año"
          options={props.options.years}
          selected={draft.years}
          onChange={(v) => setFilter('years', v)}
        />
        <MultiSelectFilter
          label="Mes"
          options={props.options.months}
          selected={draft.months}
          onChange={(v) => setFilter('months', v)}
        />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" onClick={applyFilters} disabled={props.loading}>
          {props.loading ? 'Aplicando…' : 'Aplicar filtros'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={resetFilters} disabled={props.loading}>
          Resetear filtros
        </button>
      </div>

      {props.loading ? <p style={{ color: 'var(--color-text-muted)' }}>Cargando…</p> : null}
      {props.error ? <div className="alert-error">{props.error}</div> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Año</th>
              <th>Mes</th>
              <th>Supervisor</th>
              <th>UN</th>
              <th>Vía</th>
              <th>Contratos</th>
              <th>Mora 3M</th>
              <th>Monto</th>
              <th>Comisiones</th>
            </tr>
          </thead>
          <tbody>
            {props.rows.map((r, i) => (
              <tr key={`${r.month}-${r.supervisor}-${r.un}-${r.via}-${i}`}>
                <td>{r.year}</td>
                <td>{r.month}</td>
                <td>{r.supervisor}</td>
                <td>{r.un}</td>
                <td>{r.via}</td>
                <td>{r.count}</td>
                <td>{r.mora3m}</td>
                <td>{Number(r.montoCuota || 0).toFixed(2)}</td>
                <td>{Number(r.commission || 0).toFixed(2)}</td>
              </tr>
            ))}
            {props.rows.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  {props.error
                    ? 'Sin datos'
                    : 'No hay datos. Verifique que la tabla analytics_contract_snapshot tenga datos y que los supervisores estén habilitados en Supervisores Brokers.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
