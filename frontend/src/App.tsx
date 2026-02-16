import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  api,
  getCommissionsRules,
  getPrizesRules,
  getSupervisorsScope,
  login,
  logout,
  restoreSession,
  saveCommissionsRules,
  savePrizesRules,
  saveSupervisorsScope,
  setAuthToken,
  setOnUnauthorized,
} from './shared/api'
import { loadBrokersPreferences, persistBrokersPreferences } from './store/userPreferences'
import type {
  BrokersFilters,
  LoginRequest,
  LoginResponse,
} from './shared/contracts'
import { EMPTY_BROKERS_FILTERS } from './shared/contracts'
import { setStoredRefreshToken } from './shared/sessionStorage'
import { BrokersView } from './modules/brokers/BrokersView'
import { BrokersCommissionsView } from './modules/brokersCommissions/BrokersCommissionsView'
import { BrokersPrizesView } from './modules/brokersPrizes/BrokersPrizesView'
import { BrokersSupervisorsView } from './modules/brokersSupervisors/BrokersSupervisorsView'
import { BrokersMoraView } from './modules/brokersMora/BrokersMoraView'
import { getApiErrorMessage } from './shared/apiErrors'
import { LoginView } from './modules/auth/LoginView'

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

export default function App() {
  const [auth, setAuth] = useState<LoginResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [supervisorsEnabled, setSupervisorsEnabled] = useState<string[]>([])
  const [rows, setRows] = useState<BrokerRow[]>([])
  const [commissionRules, setCommissionRules] = useState<Record<string, unknown>[]>([])
  const [prizeRules, setPrizeRules] = useState<Record<string, unknown>[]>([])
  const [filters, setFilters] = useState<BrokersFilters>(EMPTY_BROKERS_FILTERS)

  const role = auth?.role ?? ''
  const permissions = auth?.permissions ?? []
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
    } catch (e: unknown) {
      setError(getApiErrorMessage(e))
    }
  }

  const onSaveCommissions = async (rules: Record<string, unknown>[]) => {
    const res = await saveCommissionsRules({ rules })
    setCommissionRules(res.rules || [])
  }

  const onSavePrizes = async (rules: Record<string, unknown>[]) => {
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

  const handleLogin = useCallback(async (payload: LoginRequest) => {
    setLoginError(null)
    const authRes = await login(payload)
    setAuthToken(authRes.access_token)
    if (authRes.refresh_token) setStoredRefreshToken(authRes.refresh_token)
    setAuth(authRes)
    setLoginError(null)

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
  }, [])

  const handleLogout = useCallback(() => {
    logout()
    setAuth(null)
    setError('')
    setLoginError(null)
  }, [])

  useEffect(() => {
    setOnUnauthorized(() => {
      setAuth(null)
      setError('Sesión expirada. Vuelve a iniciar sesión.')
    })
    return () => setOnUnauthorized(null)
  }, [])

  useEffect(() => {
    const boot = async () => {
      try {
        const restored = await restoreSession()
        if (restored) {
          setAuth(restored)
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
        }
      } catch {
        // restoreSession already clears on failure
      } finally {
        setLoading(false)
      }
    }
    boot()
  }, [])

  if (loading) {
    return (
      <main style={{ fontFamily: 'Outfit, sans-serif', padding: 24 }}>
        <p>Cargando…</p>
      </main>
    )
  }

  if (!auth) {
    return (
      <LoginView
        onSubmit={async (payload) => {
          try {
            await handleLogin(payload)
          } catch (e: unknown) {
            setLoginError(getApiErrorMessage(e))
            throw e
          }
        }}
        error={loginError}
      />
    )
  }

  return (
    <main style={{ fontFamily: 'Outfit, sans-serif', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ margin: 0 }}>Frontend v1 - Brokers</h1>
          <p style={{ margin: '4px 0 0', color: '#666' }}>
            Paridad funcional Brokers con persistencia server-side y dual-run de analytics.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14 }}>
            Rol: <strong>{role || '-'}</strong> | Permisos: {permissions.join(', ') || '-'}
          </span>
          <button type="button" onClick={handleLogout} style={{ padding: '6px 12px', fontSize: 14 }}>
            Cerrar sesión
          </button>
        </div>
      </div>
      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}

      <BrokersView
        options={options}
        filters={filters}
        onFiltersChange={onFiltersChange}
        rows={filteredRows}
        loading={false}
        error={error}
      />
      <BrokersCommissionsView
        rules={commissionRules}
        canEdit={canWrite}
        loading={false}
        error={error}
        onSave={onSaveCommissions}
      />
      <BrokersPrizesView
        rules={prizeRules}
        canEdit={canWrite}
        loading={false}
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
