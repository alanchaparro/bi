import React, { useMemo, useState } from 'react'
import { Input } from '@heroui/react'
import { AnalyticsPageHeader } from '../../components/analytics/AnalyticsPageHeader'

type Row = {
  year: string
  month: string
  supervisor: string
  un: string
  via: string
  count: number
  mora3m: number
  montoCuota: number
}

type Props = {
  rows: Row[]
}

export function BrokersMoraView({ rows }: Props) {
  const [supervisor, setSupervisor] = useState('')
  const [un, setUn] = useState('')
  const [via, setVia] = useState('')

  const options = useMemo(() => {
    return {
      supervisors: Array.from(new Set(rows.map((r) => r.supervisor))).sort(),
      uns: Array.from(new Set(rows.map((r) => r.un))).sort(),
      vias: Array.from(new Set(rows.map((r) => r.via))).sort(),
    }
  }, [rows])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (supervisor && r.supervisor !== supervisor) return false
      if (un && r.un !== un) return false
      if (via && r.via !== via) return false
      return Number(r.mora3m || 0) > 0
    })
  }, [rows, supervisor, un, via])

  return (
    <section className="analysis-panel-card">
      <AnalyticsPageHeader
        title="Mora de brokers"
        subtitle="Filtrá por supervisor, UN o vía para revisar contratos con mora a 3 meses."
      />
      <div className="brokers-mora-filters">
        <Input
          className="brokers-mora-input"
          aria-label="mora-supervisor"
          value={supervisor}
          onChange={(e) => setSupervisor(e.target.value)}
          placeholder="Supervisor"
          list="mora-supervisors-list"
        />
        <Input
          className="brokers-mora-input"
          aria-label="mora-un"
          value={un}
          onChange={(e) => setUn(e.target.value)}
          placeholder="UN"
          list="mora-uns-list"
        />
        <Input
          className="brokers-mora-input"
          aria-label="mora-via"
          value={via}
          onChange={(e) => setVia(e.target.value)}
          placeholder="Vía"
          list="mora-vias-list"
        />
        <datalist id="mora-supervisors-list">
          {options.supervisors.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <datalist id="mora-uns-list">
          {options.uns.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <datalist id="mora-vias-list">
          {options.vias.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
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
              <th>Monto cuota</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, idx) => (
              <tr key={`${r.month}-${r.supervisor}-${r.un}-${idx}`}>
                <td>{r.year}</td>
                <td>{r.month}</td>
                <td>{r.supervisor}</td>
                <td>{r.un}</td>
                <td>{r.via}</td>
                <td>{r.count}</td>
                <td>{r.mora3m}</td>
                <td>{Number(r.montoCuota || 0).toFixed(2)}</td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8}>Sin filas de mora para los filtros seleccionados.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
