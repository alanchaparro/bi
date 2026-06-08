import React, { useMemo, useState } from 'react'
import { Input } from '@heroui/react'
import { AnalyticsPageHeader } from '../../components/analytics/AnalyticsPageHeader'
import { VirtualTable } from '../../components/tables/VirtualTable'
import { EmptyState } from '../../components/feedback/EmptyState'

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
      {filtered.length === 0 ? (
        <EmptyState
          message="Sin filas de mora para los filtros seleccionados."
          suggestion="Probá limpiar o ampliar los filtros por supervisor, UN o vía."
        />
      ) : (
        <VirtualTable
          data={filtered}
          virtualizeThreshold={100}
          columns={[
            { key: "year", label: "Año", accessor: (r) => r.year },
            { key: "month", label: "Mes", accessor: (r) => r.month },
            { key: "supervisor", label: "Supervisor", accessor: (r) => r.supervisor },
            { key: "un", label: "UN", accessor: (r) => r.un },
            { key: "via", label: "Vía", accessor: (r) => r.via },
            { key: "count", label: "Contratos", accessor: (r) => r.count, className: "p-2 text-sm text-right font-mono" },
            { key: "mora3m", label: "Mora 3M", accessor: (r) => r.mora3m, className: "p-2 text-sm text-right font-mono" },
            { key: "montoCuota", label: "Monto cuota", accessor: (r) => Number(r.montoCuota || 0).toFixed(2), className: "p-2 text-sm text-right font-mono" },
          ]}
        />
      )}
    </section>
  )
}
