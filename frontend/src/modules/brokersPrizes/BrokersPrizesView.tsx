import React, { useEffect, useState } from 'react'
import { Button, Input, Modal, useOverlayState } from '@heroui/react'
import { AnalyticsPageHeader } from '../../components/analytics/AnalyticsPageHeader'
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
  const deleteConfirm = useOverlayState()
  const [pendingDeleteIdx, setPendingDeleteIdx] = useState<number | null>(null)

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
  const requestRemoveRule = (idx: number) => {
    setPendingDeleteIdx(idx)
    deleteConfirm.open()
  }
  const confirmRemoveRule = () => {
    if (pendingDeleteIdx === null) return
    removeRule(pendingDeleteIdx)
    setPendingDeleteIdx(null)
    deleteConfirm.close()
  }

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
    <section className="analysis-panel-card">
      <AnalyticsPageHeader
        title="Configuración de premios"
        subtitle="Escalas en formato meta:premio. Ejemplo: 1:50000, 3:150000."
      />
      {loading ? <p className="config-muted-text">Cargando...</p> : null}
      {error ? <div className="alert-error">{error}</div> : null}
      {localError ? <div className="alert-error">{localError}</div> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Supervisores (csv)</th>
              <th>UNs (csv)</th>
              <th>Escalas</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {draft.map((rule, idx) => (
              <tr key={idx}>
                <td>
                  <Input
                    className="brokers-prizes-input"
                    aria-label={`prize-supervisors-${idx}`}
                    value={(rule.supervisors || []).join(', ')}
                    onChange={(e) => updateText(idx, 'supervisors', e.target.value)}
                    disabled={!canEdit}
                  />
                </td>
                <td>
                  <Input
                    className="brokers-prizes-input"
                    aria-label={`prize-uns-${idx}`}
                    value={(rule.uns || []).join(', ')}
                    onChange={(e) => updateText(idx, 'uns', e.target.value)}
                    disabled={!canEdit}
                  />
                </td>
                <td>
                  <Input
                    className="brokers-prizes-input"
                    aria-label={`prize-scales-${idx}`}
                    value={(rule.scales || []).map((s) => `${Number(s.threshold || 0)}:${Number(s.prize || 0)}`).join(', ')}
                    onChange={(e) => updateScales(idx, e.target.value)}
                    disabled={!canEdit}
                  />
                </td>
                <td>
                  <Button size="sm" variant="danger" onPress={() => requestRemoveRule(idx)} isDisabled={!canEdit}>
                    Eliminar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex-actions flex-actions--top">
        <Button variant="outline" onPress={addRule} isDisabled={!canEdit}>Agregar regla</Button>
        <Button variant="primary" onPress={save} isDisabled={!canEdit || saving}>{saving ? 'Guardando…' : 'Guardar premios'}</Button>
      </div>
      <Modal state={deleteConfirm}>
        <Modal.Backdrop />
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Confirmar eliminación</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              Esta acción elimina la regla de premios seleccionada y no se puede deshacer. ¿Deseás continuar?
            </Modal.Body>
            <Modal.Footer className="brokers-rule-delete-modal__footer">
              <Button variant="outline" onPress={() => deleteConfirm.close()}>
                Cancelar
              </Button>
              <Button variant="danger" onPress={confirmRemoveRule}>
                Eliminar
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal>
    </section>
  )
}
