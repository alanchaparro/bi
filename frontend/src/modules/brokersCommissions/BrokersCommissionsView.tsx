import React, { useEffect, useState } from 'react'
import { getApiErrorMessage } from '../../shared/apiErrors'

type CommissionRule = {
  supervisors?: string[]
  uns?: string[]
  vias?: string[]
  months?: string[]
  rate?: number
}

type Props = {
  rules: CommissionRule[]
  canEdit: boolean
  loading?: boolean
  error?: string
  onSave: (rules: CommissionRule[]) => Promise<void>
}

const EMPTY_RULE: CommissionRule = { supervisors: ['__ALL__'], uns: ['__ALL__'], vias: ['__ALL__'], months: [], rate: 0 }

export function BrokersCommissionsView({ rules, canEdit, loading, error, onSave }: Props) {
  const [draft, setDraft] = useState<CommissionRule[]>([])
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    setDraft(Array.isArray(rules) ? rules : [])
  }, [rules])

  const update = (idx: number, key: keyof CommissionRule, raw: string) => {
    const next = draft.slice()
    const row = { ...(next[idx] || EMPTY_RULE) }
    if (key === 'rate') row.rate = Number(raw || 0)
    else row[key] = raw.split(',').map((x) => x.trim()).filter(Boolean)
    next[idx] = row
    setDraft(next)
  }

  const addRule = () => setDraft([...draft, { ...EMPTY_RULE }])
  const removeRule = (idx: number) => setDraft(draft.filter((_, i) => i !== idx))

  const save = async () => {
    setLocalError('')
    setSaving(true)
    try {
      await onSave(draft)
    } catch (e: unknown) {
      setLocalError(getApiErrorMessage(e) || 'No se pudo guardar comisiones')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <h2>Configuracion de Comisiones</h2>
      {loading ? <p>loading...</p> : null}
      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
      {localError ? <p style={{ color: 'crimson' }}>{localError}</p> : null}
      <table>
        <thead>
          <tr>
            <th>Supervisores (csv)</th>
            <th>UNs (csv)</th>
            <th>Vias (csv)</th>
            <th>Meses MM/YYYY (csv)</th>
            <th>Tasa</th>
            <th>Accion</th>
          </tr>
        </thead>
        <tbody>
          {draft.map((rule, idx) => (
            <tr key={idx}>
              <td>
                <input
                  aria-label={`commission-supervisors-${idx}`}
                  value={(rule.supervisors || []).join(', ')}
                  onChange={(e) => update(idx, 'supervisors', e.target.value)}
                  disabled={!canEdit}
                />
              </td>
              <td>
                <input
                  aria-label={`commission-uns-${idx}`}
                  value={(rule.uns || []).join(', ')}
                  onChange={(e) => update(idx, 'uns', e.target.value)}
                  disabled={!canEdit}
                />
              </td>
              <td>
                <input
                  aria-label={`commission-vias-${idx}`}
                  value={(rule.vias || []).join(', ')}
                  onChange={(e) => update(idx, 'vias', e.target.value)}
                  disabled={!canEdit}
                />
              </td>
              <td>
                <input
                  aria-label={`commission-months-${idx}`}
                  value={(rule.months || []).join(', ')}
                  onChange={(e) => update(idx, 'months', e.target.value)}
                  disabled={!canEdit}
                />
              </td>
              <td>
                <input
                  aria-label={`commission-rate-${idx}`}
                  type="number"
                  value={Number(rule.rate || 0)}
                  onChange={(e) => update(idx, 'rate', e.target.value)}
                  disabled={!canEdit}
                />
              </td>
              <td>
                <button onClick={() => removeRule(idx)} disabled={!canEdit}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={addRule} disabled={!canEdit}>Agregar regla</button>
        <button onClick={save} disabled={!canEdit || saving}>{saving ? 'Guardando...' : 'Guardar comisiones'}</button>
      </div>
    </section>
  )
}
