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
    <section className="card">
      <h2>Configuración de Comisiones</h2>
      {loading ? <p style={{ color: 'var(--color-text-muted)' }}>Cargando…</p> : null}
      {error ? <div className="alert-error">{error}</div> : null}
      {localError ? <div className="alert-error">{localError}</div> : null}
      <div className="table-wrap">
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
                  className="input"
                  aria-label={`commission-supervisors-${idx}`}
                  value={(rule.supervisors || []).join(', ')}
                  onChange={(e) => update(idx, 'supervisors', e.target.value)}
                  disabled={!canEdit}
                  style={{ width: '100%', minWidth: 100 }}
                />
              </td>
              <td>
                <input
                  className="input"
                  aria-label={`commission-uns-${idx}`}
                  value={(rule.uns || []).join(', ')}
                  onChange={(e) => update(idx, 'uns', e.target.value)}
                  disabled={!canEdit}
                  style={{ width: '100%', minWidth: 100 }}
                />
              </td>
              <td>
                <input
                  className="input"
                  aria-label={`commission-vias-${idx}`}
                  value={(rule.vias || []).join(', ')}
                  onChange={(e) => update(idx, 'vias', e.target.value)}
                  disabled={!canEdit}
                  style={{ width: '100%', minWidth: 80 }}
                />
              </td>
              <td>
                <input
                  className="input"
                  aria-label={`commission-months-${idx}`}
                  value={(rule.months || []).join(', ')}
                  onChange={(e) => update(idx, 'months', e.target.value)}
                  disabled={!canEdit}
                  style={{ width: '100%', minWidth: 100 }}
                />
              </td>
              <td>
                <input
                  className="input"
                  aria-label={`commission-rate-${idx}`}
                  type="number"
                  value={Number(rule.rate || 0)}
                  onChange={(e) => update(idx, 'rate', e.target.value)}
                  disabled={!canEdit}
                  style={{ width: 80 }}
                />
              </td>
              <td>
                <button type="button" className="btn btn-secondary" onClick={() => removeRule(idx)} disabled={!canEdit}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary" onClick={addRule} disabled={!canEdit}>Agregar regla</button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={!canEdit || saving}>{saving ? 'Guardando…' : 'Guardar comisiones'}</button>
      </div>
    </section>
  )
}
