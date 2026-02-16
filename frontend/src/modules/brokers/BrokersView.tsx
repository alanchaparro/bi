import React, { useMemo } from 'react'
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
    props.onFiltersChange({ ...props.filters, [key]: values })
  }

  return (
    <section>
      <h2>Brokers</h2>
      <p>
        Contratos: <strong>{totals.contracts}</strong> | Mora3M: <strong>{totals.mora3m}</strong> |
        Monto: <strong>{totals.montoCuota.toFixed(2)}</strong> | Comisiones:{' '}
        <strong>{totals.commission.toFixed(2)}</strong>
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <MultiSelectFilter
          label="Supervisor"
          options={props.options.supervisors}
          selected={props.filters.supervisors}
          onChange={(v) => setFilter('supervisors', v)}
        />
        <MultiSelectFilter
          label="UN"
          options={props.options.uns}
          selected={props.filters.uns}
          onChange={(v) => setFilter('uns', v)}
        />
        <MultiSelectFilter
          label="Via"
          options={props.options.vias}
          selected={props.filters.vias}
          onChange={(v) => setFilter('vias', v)}
        />
        <MultiSelectFilter
          label="Anio"
          options={props.options.years}
          selected={props.filters.years}
          onChange={(v) => setFilter('years', v)}
        />
        <MultiSelectFilter
          label="Mes"
          options={props.options.months}
          selected={props.filters.months}
          onChange={(v) => setFilter('months', v)}
        />
      </div>

      {props.loading ? <p>loading...</p> : null}
      {props.error ? <p style={{ color: 'crimson' }}>{props.error}</p> : null}

      <table>
        <thead>
          <tr>
            <th>Anio</th>
            <th>Mes</th>
            <th>Supervisor</th>
            <th>UN</th>
            <th>Via</th>
            <th>Contratos</th>
            <th>Mora3M</th>
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
              <td colSpan={9}>Sin datos para la combinacion de filtros.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  )
}
