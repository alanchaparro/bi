import React, { useEffect, useMemo, useState } from "react"
import { Button, Checkbox } from "@heroui/react"
import { AnalyticsPageHeader } from "../../components/analytics/AnalyticsPageHeader"
import { EmptyState } from "../../components/feedback/EmptyState"
import { ErrorState } from "../../components/feedback/ErrorState"
import { getApiErrorMessage } from "../../shared/apiErrors"

type Props = {
  allSupervisors: string[]
  enabledSupervisors: string[]
  canEdit: boolean
  onSave: (supervisors: string[]) => Promise<void>
}

export function BrokersSupervisorsView({ allSupervisors, enabledSupervisors, canEdit, onSave }: Props) {
  const [selected, setSelected] = useState<string[]>(enabledSupervisors)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const options = useMemo(() => {
    const s = new Set<string>([...allSupervisors, ...enabledSupervisors])
    return Array.from(s).sort()
  }, [allSupervisors, enabledSupervisors])

  useEffect(() => {
    setSelected(enabledSupervisors)
  }, [enabledSupervisors])

  const toggle = (value: string) => {
    if (selected.includes(value)) setSelected(selected.filter((s) => s !== value))
    else setSelected([...selected, value])
  }

  const save = async () => {
    setError("")
    setSaving(true)
    try {
      await onSave(selected)
    } catch (e: unknown) {
      setError(getApiErrorMessage(e) || "No se pudo guardar supervisores")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="analysis-panel-card">
      <AnalyticsPageHeader
        title="Supervisores habilitados"
        subtitle="Seleccioná los supervisores que pueden acceder al sistema."
      />
      {error ? <ErrorState message={error} /> : null}
      {options.length === 0 ? (
        <EmptyState
          message="No hay supervisores disponibles para configurar."
          suggestion="Verifica la carga de supervisores o recarga la configuración antes de guardar."
          className="w-full max-w-none"
        />
      ) : (
        <div className="table-wrap supervisors-checkbox-wrap">
          <div className="supervisors-grid">
            {options.map((v) => (
              <Checkbox
                key={v}
                className="supervisors-label"
                isSelected={selected.includes(v)}
                isDisabled={!canEdit}
                onChange={() => toggle(v)}
              >
                {v}
              </Checkbox>
            ))}
          </div>
        </div>
      )}
      <div className="flex-actions flex-actions--top">
        <Button variant="primary" onPress={save} isDisabled={!canEdit || saving || options.length === 0}>
          {saving ? "Guardando..." : "Guardar supervisores"}
        </Button>
      </div>
    </section>
  )
}
