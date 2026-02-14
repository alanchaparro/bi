import React, { useEffect, useMemo, useState } from 'react'
import {
  api,
  getCommissionsRules,
  getPrizesRules,
  login,
  setAuthToken,
} from './shared/api'
import { BrokersView } from './modules/brokers/BrokersView'
import { BrokersCommissionsView } from './modules/brokersCommissions/BrokersCommissionsView'
import { BrokersPrizesView } from './modules/brokersPrizes/BrokersPrizesView'
import { BrokersSupervisorsView } from './modules/brokersSupervisors/BrokersSupervisorsView'
import { BrokersMoraView } from './modules/brokersMora/BrokersMoraView'
import { loadBrokersPreferences } from './store/userPreferences'

export default function App() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [role, setRole] = useState('')
  const [supervisors, setSupervisors] = useState<string[]>([])
  const [selectedSupervisors, setSelectedSupervisors] = useState<string[]>([])
  const [rows, setRows] = useState<any[]>([])
  const [commissionRules, setCommissionRules] = useState<any[]>([])
  const [prizeRules, setPrizeRules] = useState<any[]>([])

  const supervisorsOptions = useMemo(() => {
    const set = new Set<string>([...supervisors, ...selectedSupervisors])
    return Array.from(set).sort()
  }, [supervisors, selectedSupervisors])

  async function loadBrokersSummary(supervisorFilter: string[]) {
    const res = await api.post('/analytics/brokers/summary', {
      supervisor: supervisorFilter,
      gestion_month: [],
      anio: [],
      un: [],
      via_cobro: [],
      via_pago: [],
      categoria: [],
      tramo: [],
      contract_month: [],
    })
    setRows(res.data?.rows || [])
  }

  useEffect(() => {
    const boot = async () => {
      try {
        const auth = await login({ username: 'admin', password: 'admin123' })
        setAuthToken(auth.access_token)
        setRole(auth.role)

        const [prefs, commRes, prizeRes] = await Promise.all([
          loadBrokersPreferences(),
          getCommissionsRules(),
          getPrizesRules(),
        ])
        const enabled = prefs.supervisors || []
        setSupervisors(enabled)
        setSelectedSupervisors(enabled)
        setCommissionRules(commRes.rules || [])
        setPrizeRules(prizeRes.rules || [])
        await loadBrokersSummary(enabled)
      } catch (e: any) {
        setError(e?.response?.data?.message || 'No se pudo cargar frontend v1')
      } finally {
        setLoading(false)
      }
    }
    boot()
  }, [])

  useEffect(() => {
    if (!loading) {
      loadBrokersSummary(selectedSupervisors).catch((e: any) =>
        setError(e?.response?.data?.message || 'No se pudo refrescar brokers')
      )
    }
  }, [selectedSupervisors])

  return (
    <main style={{ fontFamily: 'Outfit, sans-serif', padding: 24 }}>
      <h1>Frontend v1 - Brokers</h1>
      <p>Migración progresiva React/TS con paridad funcional incremental.</p>
      {loading ? <p>loading...</p> : null}
      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
      <p>Rol: {role || '-'}</p>

      <BrokersView
        supervisors={supervisorsOptions}
        selectedSupervisors={selectedSupervisors}
        onSupervisorsChange={setSelectedSupervisors}
        rows={rows}
        loading={loading}
        error={error}
      />
      <BrokersCommissionsView rules={commissionRules} />
      <BrokersPrizesView rules={prizeRules} />
      <BrokersSupervisorsView supervisors={supervisors} />
      <BrokersMoraView rows={rows.filter((r) => Number(r.mora3m || 0) > 0)} />
    </main>
  )
}
