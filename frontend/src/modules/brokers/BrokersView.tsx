import React from 'react'
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
}

type Props = {
  supervisors: string[]
  selectedSupervisors: string[]
  onSupervisorsChange: (values: string[]) => void
  rows: Row[]
  loading: boolean
  error: string
}

export function BrokersView(props: Props) {
  return (
    <section>
      <h2>Brokers</h2>
      <MultiSelectFilter
        label="Supervisor"
        options={props.supervisors}
        selected={props.selectedSupervisors}
        onChange={props.onSupervisorsChange}
      />
      {props.loading ? <p>loading...</p> : null}
      {props.error ? <p style={{ color: 'crimson' }}>{props.error}</p> : null}
      <table>
        <thead>
          <tr>
            <th>Año</th>
            <th>Mes</th>
            <th>Supervisor</th>
            <th>UN</th>
            <th>Vía</th>
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
              <td>{r.montoCuota}</td>
              <td>{r.commission}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
