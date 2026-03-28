import React, { useMemo, useState, useEffect } from "react"
import { Button } from "@heroui/react"
import { AnalyticsPageHeader } from "../../components/analytics/AnalyticsPageHeader"
import { EmptyState } from "../../components/feedback/EmptyState"
import { ErrorState } from "../../components/feedback/ErrorState"
import { LoadingState } from "../../components/feedback/LoadingState"
import { MultiSelectFilter } from "../../components/filters/MultiSelectFilter"
import { ViaSegmentedOrMulti } from "../../components/filters/ViaSegmentedOrMulti"

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

  const formatGs = (value: number) => `Gs. ${Math.round(Number(value || 0)).toLocaleString("es-PY")}`

  return (
    <section className="analysis-panel-card">
      <AnalyticsPageHeader
        title="Resumen de brokers"
        subtitle="Vista operativa por supervisor, UN, vía y período de gestión."
      />
      <div className="kpi-row">
        <span>Contratos: <strong>{totals.contracts}</strong></span>
        <span>Mora 3M: <strong>{totals.mora3m}</strong></span>
        <span>Monto cuota: <strong>{formatGs(totals.montoCuota)}</strong></span>
        <span>Comisiones: <strong>{formatGs(totals.commission)}</strong></span>
      </div>

      <div className="grid-cards">
        <MultiSelectFilter label="Supervisor" options={props.options.supervisors} selected={draft.supervisors} onChange={(v) => setFilter("supervisors", v)} />
        <MultiSelectFilter label="UN" options={props.options.uns} selected={draft.uns} onChange={(v) => setFilter("uns", v)} />
        <ViaSegmentedOrMulti
          label="Vía"
          options={props.options.vias}
          selected={draft.vias}
          onChange={(v) => setFilter("vias", v)}
        />
        <MultiSelectFilter label="Año" options={props.options.years} selected={draft.years} onChange={(v) => setFilter("years", v)} />
        <MultiSelectFilter label="Mes" options={props.options.months} selected={draft.months} onChange={(v) => setFilter("months", v)} />
      </div>
      <div className="flex-actions">
        <Button variant="primary" onPress={applyFilters} isDisabled={props.loading}>
          {props.loading ? "Aplicando..." : "Aplicar filtros"}
        </Button>
        <Button variant="outline" onPress={resetFilters} isDisabled={props.loading}>
          Restablecer
        </Button>
      </div>

      {props.loading ? <LoadingState message="Cargando resumen de brokers..." /> : null}
      {props.error ? <ErrorState message={props.error} /> : null}

      {props.rows.length === 0 && !props.loading && !props.error ? (
        <EmptyState
          message="No hay datos para los filtros seleccionados."
          suggestion="Prueba ajustando el período, la vía o verificando los supervisores habilitados."
          className="w-full max-w-none"
        />
      ) : (
        <>
          <p className="table-scroll-hint">Desliza la tabla horizontalmente para ver supervisor, vía y métricas completas.</p>
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
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
