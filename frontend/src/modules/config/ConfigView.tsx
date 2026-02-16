import React, { useState, useCallback } from 'react'
import axios from 'axios'
import { api } from '../../shared/api'
import { getApiErrorMessage } from '../../shared/apiErrors'

type Props = {
  onReloadBrokers?: () => Promise<void>
}

export function ConfigView({ onReloadBrokers }: Props) {
  const [health, setHealth] = useState<{ ok?: boolean; db_ok?: boolean; service?: string; error?: string } | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [reloadLoading, setReloadLoading] = useState(false)
  const [brokersTest, setBrokersTest] = useState<{ loading?: boolean; rows?: number; error?: string } | null>(null)

  const checkHealth = useCallback(async () => {
    setHealthLoading(true)
    setHealth(null)
    try {
      const res = await api.get('/health')
      setHealth(res.data as { ok?: boolean; db_ok?: boolean; service?: string })
    } catch (e: unknown) {
      const msg = getApiErrorMessage(e)
      const status = axios.isAxiosError(e) ? e.response?.status : undefined
      const detail = axios.isAxiosError(e) && e.response?.data ? JSON.stringify(e.response.data) : undefined
      setHealth({
        ok: false,
        error: msg + (status ? ` (HTTP ${status})` : '') + (detail ? ` — ${detail}` : ''),
      })
    } finally {
      setHealthLoading(false)
    }
  }, [])

  const handleReload = useCallback(async () => {
    if (!onReloadBrokers) return
    setReloadLoading(true)
    try {
      await onReloadBrokers()
    } finally {
      setReloadLoading(false)
    }
  }, [onReloadBrokers])

  const testBrokersEndpoint = useCallback(async () => {
    setBrokersTest({ loading: true })
    try {
      const res = await api.post('/analytics/brokers/summary', {
        supervisor: [],
        un: [],
        via_cobro: [],
        anio: [],
        contract_month: [],
        gestion_month: [],
        via_pago: [],
        categoria: [],
        tramo: [],
      })
      const rows = Array.isArray(res.data?.rows) ? res.data.rows.length : 0
      setBrokersTest({ rows })
    } catch (e: unknown) {
      setBrokersTest({ error: getApiErrorMessage(e) })
    } finally {
      setBrokersTest((prev) => (prev ? { ...prev, loading: false } : null))
    }
  }, [])

  const baseUrl = api.defaults.baseURL || 'http://localhost:8000/api/v1'

  return (
    <section className="card">
      <h2>Configuración</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>API</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Base URL: <code>{baseUrl}</code>
          </p>
        </div>
        <div>
          <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Estado de conexión</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={checkHealth}
              disabled={healthLoading}
            >
              {healthLoading ? 'Comprobando…' : 'Comprobar conexión'}
            </button>
            {health && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span
                  style={{
                    color: health.ok ? 'var(--color-primary)' : 'var(--color-error)',
                    fontWeight: 500,
                  }}
                >
                  {health.ok ? '✓ Conectado' : '✗ Sin conexión'}
                  {health.db_ok !== undefined && ` (DB: ${health.db_ok ? 'OK' : 'Error'})`}
                </span>
                {health.error && (
                  <div className="alert-error" style={{ fontSize: '0.85rem', maxWidth: '40rem' }}>
                    {health.error}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div>
          <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Probar endpoint Brokers</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={testBrokersEndpoint}
              disabled={brokersTest?.loading}
            >
              {brokersTest?.loading ? 'Probando…' : 'Probar endpoint Brokers'}
            </button>
            {brokersTest && !brokersTest.loading && (
              <span
                style={{
                  color: brokersTest.error ? 'var(--color-error)' : 'var(--color-primary)',
                  fontWeight: 500,
                }}
              >
                {brokersTest.error
                  ? `✗ ${brokersTest.error}`
                  : `✓ ${brokersTest.rows ?? 0} filas devueltas`}
              </span>
            )}
          </div>
        </div>
        {onReloadBrokers && (
          <div>
            <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Datos</h3>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleReload}
              disabled={reloadLoading}
            >
              {reloadLoading ? 'Recargando…' : 'Recargar datos Brokers'}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
