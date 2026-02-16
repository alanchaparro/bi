import React, { useMemo, useState } from 'react'

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
    <section>
      <h2>Mora Brokers</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select aria-label="mora-supervisor" value={supervisor} onChange={(e) => setSupervisor(e.target.value)}>
          <option value="">Todos los supervisores</option>
          {options.supervisors.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select aria-label="mora-un" value={un} onChange={(e) => setUn(e.target.value)}>
          <option value="">Todas las UN</option>
          {options.uns.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select aria-label="mora-via" value={via} onChange={(e) => setVia(e.target.value)}>
          <option value="">Todas las vias</option>
          {options.vias.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
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
            <th>Monto Cuota</th>
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
    </section>
  )
}
