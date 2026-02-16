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
    <section>
      <h2>Supervisores habilitados</h2>
      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
      <div style={{ border: '1px solid #cbd5e1', padding: 8, maxHeight: 200, overflow: 'auto' }}>
        {options.map((v) => (
          <label key={v} style={{ display: 'block' }}>
            <input
              type="checkbox"
              checked={selected.includes(v)}
              disabled={!canEdit}
              onChange={() => toggle(v)}
            />{' '}
            {v}
          </label>
        ))}
      </div>
      <button style={{ marginTop: 8 }} onClick={save} disabled={!canEdit || saving}>
        {saving ? 'Guardando...' : 'Guardar supervisores'}
      </button>
    </section>
  )
}
