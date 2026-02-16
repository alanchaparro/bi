import React, { useEffect, useMemo, useState } from 'react'
import {
  api,
  getCommissionsRules,
  getPrizesRules,
  getSupervisorsScope,
  login,
  saveCommissionsRules,
  savePrizesRules,
  saveSupervisorsScope,
  setAuthToken,
} from './shared/api'
import { BrokersView } from './modules/brokers/BrokersView'
import { BrokersCommissionsView } from './modules/brokersCommissions/BrokersCommissionsView'
import { BrokersPrizesView } from './modules/brokersPrizes/BrokersPrizesView'
import { BrokersSupervisorsView } from './modules/brokersSupervisors/BrokersSupervisorsView'
import { BrokersMoraView } from './modules/brokersMora/BrokersMoraView'
import { loadBrokersPreferences, persistBrokersPreferences } from './store/userPreferences'

type BrokerRow = {
  year: string
  month: string
  supervisor: string
  un: string
  via: string
  count: number
  mora3m: number
  montoCuota: number
  commission: number
}

type BrokersFilters = {
  supervisors: string[]
  uns: string[]
  vias: string[]
  years: string[]
  months: string[]
}

const EMPTY_FILTERS: BrokersFilters = { supervisors: [], uns: [], vias: [], years: [], months: [] }

export default function App() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [role, setRole] = useState('')
  const [permissions, setPermissions] = useState<string[]>([])
  const [supervisorsEnabled, setSupervisorsEnabled] = useState<string[]>([])
  const [rows, setRows] = useState<BrokerRow[]>([])
  const [commissionRules, setCommissionRules] = useState<any[]>([])
  const [prizeRules, setPrizeRules] = useState<any[]>([])
  const [filters, setFilters] = useState<BrokersFilters>(EMPTY_FILTERS)

  const canWrite = permissions.includes('brokers:write_config')

  const options = useMemo(() => {
    const allRows = rows || []
    return {
      supervisors: Array.from(new Set([...supervisorsEnabled, ...allRows.map((r) => r.supervisor)])).sort(),
      uns: Array.from(new Set(allRows.map((r) => r.un))).sort(),
      vias: Array.from(new Set(allRows.map((r) => r.via))).sort(),
      years: Array.from(new Set(allRows.map((r) => r.year))).sort(),
      months: Array.from(new Set(allRows.map((r) => r.month))).sort(),
    }
  }, [rows, supervisorsEnabled])

  const filteredRows = useMemo(() => {
    return (rows || []).filter((r) => {
      if (filters.supervisors.length > 0 && !filters.supervisors.includes(r.supervisor)) return false
      if (filters.uns.length > 0 && !filters.uns.includes(r.un)) return false
      if (filters.vias.length > 0 && !filters.vias.includes(r.via)) return false
      if (filters.years.length > 0 && !filters.years.includes(r.year)) return false
      if (filters.months.length > 0 && !filters.months.includes(r.month)) return false
      return true
    })
  }, [rows, filters])

  async function loadBrokersSummary(serverFilters: BrokersFilters) {
    const res = await api.post('/analytics/brokers/summary', {
      supervisor: serverFilters.supervisors,
      un: serverFilters.uns,
      via_cobro: serverFilters.vias,
      anio: serverFilters.years,
      contract_month: serverFilters.months,
      gestion_month: [],
      via_pago: [],
      categoria: [],
      tramo: [],
    })
    setRows(Array.isArray(res.data?.rows) ? res.data.rows : [])
  }

  const saveCurrentPreferences = async (nextFilters: BrokersFilters) => {
    await persistBrokersPreferences({ filters: nextFilters })
  }

  const onFiltersChange = async (nextFilters: BrokersFilters) => {
    setFilters(nextFilters)
    try {
      await saveCurrentPreferences(nextFilters)
      await loadBrokersSummary(nextFilters)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'No se pudo aplicar filtros')
    }
  }

  const onSaveCommissions = async (rules: any[]) => {
    const res = await saveCommissionsRules({ rules })
    setCommissionRules(res.rules || [])
  }

  const onSavePrizes = async (rules: any[]) => {
    const res = await savePrizesRules({ rules })
    setPrizeRules(res.rules || [])
  }

  const onSaveSupervisors = async (supervisors: string[]) => {
    const res = await saveSupervisorsScope({ supervisors })
    const enabled = res.supervisors || []
    setSupervisorsEnabled(enabled)
    const nextFilters = { ...filters, supervisors: enabled }
    setFilters(nextFilters)
    await saveCurrentPreferences(nextFilters)
    await loadBrokersSummary(nextFilters)
  }

  useEffect(() => {
    const boot = async () => {
      try {
        const auth = await login({ username: 'admin', password: 'admin123' })
        setAuthToken(auth.access_token)
        setRole(auth.role)
        setPermissions(auth.permissions || [])

        const [prefs, scopeRes, commRes, prizeRes] = await Promise.all([
          loadBrokersPreferences(),
          getSupervisorsScope(),
          getCommissionsRules(),
          getPrizesRules(),
        ])

        const enabled = scopeRes.supervisors || []
        const nextFilters: BrokersFilters = {
          supervisors: prefs.filters?.supervisors?.length ? prefs.filters.supervisors : enabled,
          uns: prefs.filters?.uns || [],
          vias: prefs.filters?.vias || [],
          years: prefs.filters?.years || [],
          months: prefs.filters?.months || [],
        }

        setSupervisorsEnabled(enabled)
        setFilters(nextFilters)
        setCommissionRules(commRes.rules || [])
        setPrizeRules(prizeRes.rules || [])
        await loadBrokersSummary(nextFilters)
      } catch (e: any) {
        setError(e?.response?.data?.message || 'No se pudo cargar frontend v1')
      } finally {
        setLoading(false)
      }
    }
    boot()
  }, [])

  return (
    <main style={{ fontFamily: 'Outfit, sans-serif', padding: 24 }}>
      <h1>Frontend v1 - Brokers</h1>
      <p>Paridad funcional Brokers con persistencia server-side y dual-run de analytics.</p>
      {loading ? <p>loading...</p> : null}
      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
      <p>Rol: {role || '-'} | Permisos: {permissions.join(', ') || '-'}</p>

      <BrokersView
        options={options}
        filters={filters}
        onFiltersChange={onFiltersChange}
        rows={filteredRows}
        loading={loading}
        error={error}
      />
      <BrokersCommissionsView
        rules={commissionRules}
        canEdit={canWrite}
        loading={loading}
        error={error}
        onSave={onSaveCommissions}
      />
      <BrokersPrizesView
        rules={prizeRules}
        canEdit={canWrite}
        loading={loading}
        error={error}
        onSave={onSavePrizes}
      />
      <BrokersSupervisorsView
        allSupervisors={options.supervisors}
        enabledSupervisors={supervisorsEnabled}
        canEdit={canWrite}
        onSave={onSaveSupervisors}
      />
      <BrokersMoraView rows={filteredRows} />
    </main>
  )
}
