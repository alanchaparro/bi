import React, { useEffect, useState } from 'react'
import { getApiErrorMessage } from '../../shared/apiErrors'

type PrizeScale = {
  threshold?: number
  prize?: number
}

type PrizeRule = {
  supervisors?: string[]
  uns?: string[]
  scales?: PrizeScale[]
}

type Props = {
  rules: PrizeRule[]
  canEdit: boolean
  loading?: boolean
  error?: string
  onSave: (rules: PrizeRule[]) => Promise<void>
}

const EMPTY_RULE: PrizeRule = { supervisors: ['FVBROKEREAS', 'FVBROKEREASCDE'], uns: ['__ALL__'], scales: [{ threshold: 1, prize: 0 }] }

export function BrokersPrizesView({ rules, canEdit, loading, error, onSave }: Props) {
  const [draft, setDraft] = useState<PrizeRule[]>([])
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    setDraft(Array.isArray(rules) ? rules : [])
  }, [rules])

  const updateText = (idx: number, key: 'supervisors' | 'uns', raw: string) => {
    const next = draft.slice()
    const row = { ...(next[idx] || EMPTY_RULE) }
    row[key] = raw.split(',').map((x) => x.trim()).filter(Boolean)
    next[idx] = row
    setDraft(next)
  }

  const updateScales = (idx: number, raw: string) => {
    const next = draft.slice()
    const row = { ...(next[idx] || EMPTY_RULE) }
    const scales = raw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .map((pair) => {
        const parts = pair.split(':')
        return { threshold: Number(parts[0] || 0), prize: Number(parts[1] || 0) }
      })
      .filter((p) => Number.isFinite(p.threshold) && Number.isFinite(p.prize))
    row.scales = scales
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
      setLocalError(getApiErrorMessage(e) || 'No se pudo guardar premios')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <h2>Configuracion de Premios</h2>
      <p>Escalas formato: <code>meta:premio, meta:premio</code>. Se unifica FVBROKERS en backend legacy.</p>
      {loading ? <p>loading...</p> : null}
      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
      {localError ? <p style={{ color: 'crimson' }}>{localError}</p> : null}
      <table>
        <thead>
          <tr>
            <th>Supervisores (csv)</th>
            <th>UNs (csv)</th>
            <th>Escalas</th>
            <th>Accion</th>
          </tr>
        </thead>
        <tbody>
          {draft.map((rule, idx) => (
            <tr key={idx}>
              <td>
                <input
                  aria-label={`prize-supervisors-${idx}`}
                  value={(rule.supervisors || []).join(', ')}
                  onChange={(e) => updateText(idx, 'supervisors', e.target.value)}
                  disabled={!canEdit}
                />
              </td>
              <td>
                <input
                  aria-label={`prize-uns-${idx}`}
                  value={(rule.uns || []).join(', ')}
                  onChange={(e) => updateText(idx, 'uns', e.target.value)}
                  disabled={!canEdit}
                />
              </td>
              <td>
                <input
                  aria-label={`prize-scales-${idx}`}
                  value={(rule.scales || []).map((s) => `${Number(s.threshold || 0)}:${Number(s.prize || 0)}`).join(', ')}
                  onChange={(e) => updateScales(idx, e.target.value)}
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
        <button onClick={save} disabled={!canEdit || saving}>{saving ? 'Guardando...' : 'Guardar premios'}</button>
      </div>
    </section>
  )
}
