import React, { useEffect, useMemo, useState } from 'react'
import { getApiErrorMessage } from '../../shared/apiErrors'

type Props = {
  allSupervisors: string[]
  enabledSupervisors: string[]
  canEdit: boolean
  onSave: (supervisors: string[]) => Promise<void>
}

export function BrokersSupervisorsView({ allSupervisors, enabledSupervisors, canEdit, onSave }: Props) {
  const [selected, setSelected] = useState<string[]>(enabledSupervisors)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
    setError('')
    setSaving(true)
    try {
      await onSave(selected)
    } catch (e: unknown) {
      setError(getApiErrorMessage(e) || 'No se pudo guardar supervisores')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card">
      <h2>Supervisores habilitados</h2>
      {error ? <div className="alert-error">{error}</div> : null}
      <div className="table-wrap" style={{ maxHeight: 220, overflow: 'auto', padding: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.25rem' }}>
          {options.map((v) => (
            <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: canEdit ? 'pointer' : 'default' }}>
              <input
                type="checkbox"
                checked={selected.includes(v)}
                disabled={!canEdit}
                onChange={() => toggle(v)}
              />
              <span>{v}</span>
            </label>
          ))}
        </div>
      </div>
      <div style={{ marginTop: '1rem' }}>
        <button type="button" className="btn btn-primary" onClick={save} disabled={!canEdit || saving}>
          {saving ? 'Guardando…' : 'Guardar supervisores'}
        </button>
      </div>
    </section>
  )
}
