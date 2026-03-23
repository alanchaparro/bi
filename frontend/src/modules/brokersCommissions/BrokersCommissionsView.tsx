import React, { useEffect, useState } from 'react'
import { Button, Input, Modal, useOverlayState } from '@heroui/react'
import { AnalyticsPageHeader } from '../../components/analytics/AnalyticsPageHeader'
import { ErrorState } from '../../components/feedback/ErrorState'
import { LoadingState } from '../../components/feedback/LoadingState'
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
  const deleteConfirm = useOverlayState()
  const [pendingDeleteIdx, setPendingDeleteIdx] = useState<number | null>(null)

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
      setLocalError(getApiErrorMessage(e) || 'No se pudo guardar comisiones')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="analysis-panel-card">
      <AnalyticsPageHeader
        title="Configuración de comisiones"
        subtitle="Reglas por supervisores, UN, vías y meses. Definí tasa por segmento con confirmación antes de eliminar."
      />
      {loading ? <LoadingState message="Cargando reglas de comisiones..." /> : null}
      {error ? <ErrorState message={error} /> : null}
      {localError ? <ErrorState message={localError} /> : null}
      <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Supervisores (csv)</th>
            <th>UNs (csv)</th>
            <th>Vías (csv)</th>
            <th>Meses MM/YYYY (csv)</th>
            <th>Tasa</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {draft.map((rule, idx) => (
            <tr key={idx}>
              <td>
                <Input
                  className="w-full min-w-[100px] border border-[var(--color-border)] bg-[var(--input-bg)]"
                  aria-label={`commission-supervisors-${idx}`}
                  value={(rule.supervisors || []).join(', ')}
                  onChange={(e) => update(idx, 'supervisors', e.target.value)}
                  disabled={!canEdit}
                />
              </td>
              <td>
                <Input
                  className="w-full min-w-[100px] border border-[var(--color-border)] bg-[var(--input-bg)]"
                  aria-label={`commission-uns-${idx}`}
                  value={(rule.uns || []).join(', ')}
                  onChange={(e) => update(idx, 'uns', e.target.value)}
                  disabled={!canEdit}
                />
              </td>
              <td>
                <Input
                  className="w-full min-w-[80px] border border-[var(--color-border)] bg-[var(--input-bg)]"
                  aria-label={`commission-vias-${idx}`}
                  value={(rule.vias || []).join(', ')}
                  onChange={(e) => update(idx, 'vias', e.target.value)}
                  disabled={!canEdit}
                />
              </td>
              <td>
                <Input
                  className="w-full min-w-[100px] border border-[var(--color-border)] bg-[var(--input-bg)]"
                  aria-label={`commission-months-${idx}`}
                  value={(rule.months || []).join(', ')}
                  onChange={(e) => update(idx, 'months', e.target.value)}
                  disabled={!canEdit}
                />
              </td>
              <td>
                <Input
                  type="number"
                  className="w-20 border border-[var(--color-border)] bg-[var(--input-bg)]"
                  aria-label={`commission-rate-${idx}`}
                  value={String(rule.rate ?? 0)}
                  onChange={(e) => update(idx, 'rate', e.target.value)}
                  disabled={!canEdit}
                />
              </td>
              <td>
                <Button size="sm" variant="danger" onPress={() => requestRemoveRule(idx)} isDisabled={!canEdit}>Eliminar</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <div className="flex-actions flex-actions--top">
        <Button variant="outline" onPress={addRule} isDisabled={!canEdit}>Agregar regla</Button>
        <Button variant="primary" onPress={save} isDisabled={!canEdit || saving}>{saving ? 'Guardando…' : 'Guardar comisiones'}</Button>
      </div>
      <Modal state={deleteConfirm}>
        <Modal.Backdrop />
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Confirmar eliminación</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              Esta acción elimina la regla de comisiones seleccionada y no se puede deshacer. ¿Deseás continuar?
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
