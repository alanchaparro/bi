import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import {
  api,
  createUser,
  getMysqlConnectionConfig,
  getSyncStatus,
  previewSync,
  listUsers,
  runSync,
  saveMysqlConnectionConfig,
  testMysqlConnectionConfig,
  updateUser,
  type MysqlConnectionConfig,
  type SyncDomain,
  type SyncStatusResponse,
  type UserItem,
} from '../../shared/api'
import { getApiErrorMessage } from '../../shared/apiErrors'

type Props = {
  onReloadBrokers?: () => Promise<void>
  onSyncLiveChange?: (state: SyncLive | null) => void
}

type SyncLive = {
  running?: boolean
  currentDomain?: SyncDomain | null
  log?: string[]
  progressPct?: number
  stage?: string
  message?: string
  rowsInserted?: number
  rowsUpdated?: number
  rowsSkipped?: number
  duplicatesDetected?: number
  rowsRead?: number
  rowsUpserted?: number
  rowsUnchanged?: number
  throughputRowsPerSec?: number
  etaSeconds?: number | null
  currentQueryFile?: string | null
  jobStep?: string | null
  queuePosition?: number | null
  chunkKey?: string | null
  chunkStatus?: string | null
  skippedUnchangedChunks?: number
  watermark?: {
    partitionKey?: string | null
    lastUpdatedAt?: string | null
    lastSourceId?: string | null
    updatedAt?: string | null
  } | null
  targetTable?: string | null
  error?: string | null
  lastUpdatedAt?: string | null
}

type SyncTagTone = 'ok' | 'warn' | 'info' | 'error'
type SyncRiskLevel = 'low' | 'medium' | 'high'

type MassivePreviewItem = {
  domain: SyncDomain
  estimatedRows: number
  maxRowsAllowed: number | null
  wouldExceedLimit: boolean
  estimateConfidence: 'low' | 'medium' | 'high'
  estimatedDurationSec: number | null
  riskLevel: SyncRiskLevel
}

type RuleCategory = 'VIGENTE' | 'MOROSO'

type TramoRule = {
  un: string
  category: RuleCategory
  tramos: number[]
}

type RoleType = 'admin' | 'analyst' | 'viewer'
type ConfigSection = 'usuarios' | 'negocio' | 'importaciones'
const ROLE_OPTIONS: RoleType[] = ['admin', 'analyst', 'viewer']

const SYNC_DOMAINS: Array<{ value: SyncDomain; label: string }> = [
  { value: 'analytics', label: 'Analytics' },
  { value: 'cartera', label: 'Cartera' },
  { value: 'cobranzas', label: 'Cobranzas' },
  { value: 'contratos', label: 'Contratos' },
  { value: 'gestores', label: 'Gestores' },
]

const SYNC_QUERY_FILES: Record<SyncDomain, string> = {
  analytics: 'query_analytics.sql',
  cartera: 'query.sql',
  cobranzas: 'query_cobranzas.sql',
  contratos: 'query_contratos.sql',
  gestores: 'query_gestores.sql',
}

const STATUS_POLL_MS = 2000
const STATUS_POLL_STABLE_MS = 4000
const STATUS_POLL_MAX_MS = 10000
const TRAMO_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7]
const MASSIVE_PREVIEW_SAMPLE_ROWS = 20000
const MASSIVE_PREVIEW_TIMEOUT_SECONDS = 8

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function normalizeTramos(values: number[]): number[] {
  return Array.from(new Set((values || []).map((v) => Number(v)).filter((v) => Number.isInteger(v) && v >= 0 && v <= 7))).sort((a, b) => a - b)
}

function monthSerial(mmYyyy: string): number {
  const parts = String(mmYyyy || '').split('/')
  if (parts.length !== 2) return 0
  const month = Number(parts[0])
  const year = Number(parts[1])
  if (!Number.isInteger(month) || !Number.isInteger(year) || month < 1 || month > 12) return 0
  return year * 12 + month
}

function formatSyncTimestamp(value?: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}

function toneClass(tone: SyncTagTone): string {
  return `sync-progress-tag sync-progress-tag--${tone}`
}

function riskPriority(level: SyncRiskLevel): number {
  if (level === 'high') return 3
  if (level === 'medium') return 2
  return 1
}

function formatDurationSeconds(value: number | null | undefined): string {
  if (!value || value <= 0) return '-'
  if (value < 60) return `${value}s`
  const mins = Math.round(value / 60)
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  return `${hours}h`
}

function getAppliedRows(status: Pick<SyncStatusResponse, "rows_upserted" | "rows_inserted">): number {
  const upserted = Number(status.rows_upserted || 0)
  if (upserted > 0) return upserted
  return Number(status.rows_inserted || 0)
}

export function ConfigView({ onReloadBrokers, onSyncLiveChange }: Props) {
  const resumeAttemptedRef = useRef(false)
  const previewEnabledRef = useRef(true)
  const [configSection, setConfigSection] = useState<ConfigSection>('usuarios')
  const [health, setHealth] = useState<{ ok?: boolean; db_ok?: boolean; mysql_ok?: boolean | null; service?: string; error?: string } | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [reloadLoading, setReloadLoading] = useState(false)

  const [selectedDomains, setSelectedDomains] = useState<SyncDomain[]>(['analytics'])
  const [yearFrom, setYearFrom] = useState('')
  const [closeMonthFromPart, setCloseMonthFromPart] = useState('')
  const [closeYearFromPart, setCloseYearFromPart] = useState('')
  const [closeMonthToPart, setCloseMonthToPart] = useState('')
  const [closeYearToPart, setCloseYearToPart] = useState('')
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncResult, setSyncResult] = useState<{ rows?: number; error?: string; log?: string[] } | null>(null)
  const [syncLive, setSyncLive] = useState<SyncLive | null>(null)
  const [massiveConfirmOpen, setMassiveConfirmOpen] = useState(false)
  const [massivePreviewRows, setMassivePreviewRows] = useState<MassivePreviewItem[]>([])

  const [tramoConfigLoading, setTramoConfigLoading] = useState(false)
  const [tramoConfigSaving, setTramoConfigSaving] = useState(false)
  const [tramoConfigMessage, setTramoConfigMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [availableUns, setAvailableUns] = useState<string[]>([])
  const [ruleUn, setRuleUn] = useState('')
  const [ruleCategory, setRuleCategory] = useState<RuleCategory>('VIGENTE')
  const [ruleTramos, setRuleTramos] = useState<number[]>([])
  const [tramoRules, setTramoRules] = useState<TramoRule[]>([])

  const [usersLoading, setUsersLoading] = useState(false)
  const [usersSaving, setUsersSaving] = useState(false)
  const [usersMessage, setUsersMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [users, setUsers] = useState<UserItem[]>([])
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<RoleType>('viewer')
  const [newIsActive, setNewIsActive] = useState(true)
  const [rowPasswordDraft, setRowPasswordDraft] = useState<Record<string, string>>({})
  const [mysqlLoading, setMysqlLoading] = useState(false)
  const [mysqlSaving, setMysqlSaving] = useState(false)
  const [mysqlTesting, setMysqlTesting] = useState(false)
  const [mysqlMessage, setMysqlMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [mysqlConfig, setMysqlConfig] = useState<MysqlConnectionConfig>({
    host: '',
    port: 3306,
    user: '',
    password: '',
    database: '',
    ssl_disabled: true,
  })

  const hasCarteraSelected = selectedDomains.includes('cartera')
  const closeMonthFromValue = useMemo(() => {
    const mm = closeMonthFromPart.trim()
    const yyyy = closeYearFromPart.trim()
    if (!/^\d{1,2}$/.test(mm) || !/^\d{4}$/.test(yyyy)) return undefined
    const month = Number(mm)
    if (month < 1 || month > 12) return undefined
    return `${String(month).padStart(2, '0')}/${yyyy}`
  }, [closeMonthFromPart, closeYearFromPart])

  const closeMonthToValue = useMemo(() => {
    const mm = closeMonthToPart.trim()
    const yyyy = closeYearToPart.trim()
    if (!/^\d{1,2}$/.test(mm) || !/^\d{4}$/.test(yyyy)) return undefined
    const month = Number(mm)
    if (month < 1 || month > 12) return undefined
    return `${String(month).padStart(2, '0')}/${yyyy}`
  }, [closeMonthToPart, closeYearToPart])

  const modeLabel = useMemo(() => {
    if (hasCarteraSelected && closeMonthFromValue && closeMonthToValue) {
      if (closeMonthFromValue === closeMonthToValue) {
        return `Carga por cierre (${closeMonthFromValue}) con upsert incremental`
      }
      return `Carga por rango de cierre (${closeMonthFromValue} -> ${closeMonthToValue}) con upsert incremental por mes`
    }
    const cleanYear = yearFrom.trim()
    if (/^\d{4}$/.test(cleanYear)) {
      return `Carga anual (${cleanYear}) con upsert incremental`
    }
    return 'Carga completa con upsert incremental'
  }, [closeMonthFromValue, closeMonthToValue, hasCarteraSelected, yearFrom])

  const busy = syncLoading || reloadLoading
  const allDomainsSelected = selectedDomains.length === SYNC_DOMAINS.length
  const massivePreviewSummary = useMemo(() => {
    const totalEstimatedRows = massivePreviewRows.reduce((acc, item) => acc + Number(item.estimatedRows || 0), 0)
    const totalEstimatedDurationSec = massivePreviewRows.reduce((acc, item) => acc + Number(item.estimatedDurationSec || 0), 0)
    const highestRisk = massivePreviewRows.reduce<SyncRiskLevel>((acc, item) => {
      return riskPriority(item.riskLevel) > riskPriority(acc) ? item.riskLevel : acc
    }, 'low')
    return { totalEstimatedRows, totalEstimatedDurationSec, highestRisk }
  }, [massivePreviewRows])
  const configBusy = tramoConfigLoading || tramoConfigSaving
  const usersBusy = usersLoading || usersSaving
  const syncPercent = Math.max(0, Math.min(100, Math.round(syncLive?.progressPct || 0)))
  const syncDomainLabel = useMemo(() => {
    if (!syncLive?.currentDomain) return '-'
    return SYNC_DOMAINS.find((d) => d.value === syncLive.currentDomain)?.label || syncLive.currentDomain
  }, [syncLive?.currentDomain])
  const syncQueryFile = syncLive?.currentQueryFile || (syncLive?.currentDomain ? SYNC_QUERY_FILES[syncLive.currentDomain] : '-')
  const chunkTone: SyncTagTone = syncLive?.error
    ? 'error'
    : syncLive?.chunkStatus === 'changed'
      ? 'ok'
      : syncLive?.chunkStatus === 'unchanged'
        ? 'warn'
        : 'info'
  const queueTone: SyncTagTone = typeof syncLive?.queuePosition === 'number'
    ? (syncLive.queuePosition > 0 ? 'warn' : 'ok')
    : 'info'
  const watermarkTone: SyncTagTone = syncLive?.watermark?.lastUpdatedAt ? 'ok' : 'warn'
  const throughputTone: SyncTagTone = (syncLive?.throughputRowsPerSec || 0) > 0 ? 'ok' : 'warn'
  const lastUpdatedLabel = useMemo(() => formatSyncTimestamp(syncLive?.lastUpdatedAt), [syncLive?.lastUpdatedAt])
  const isLiveFresh = useMemo(() => {
    if (!syncLive?.lastUpdatedAt) return false
    const ts = new Date(syncLive.lastUpdatedAt).getTime()
    if (Number.isNaN(ts)) return false
    return (Date.now() - ts) <= 12000
  }, [syncLive?.lastUpdatedAt])
  const liveTone: SyncTagTone = isLiveFresh ? 'ok' : 'warn'

  useEffect(() => {
    onSyncLiveChange?.(syncLive)
  }, [onSyncLiveChange, syncLive])

  const toggleDomain = useCallback((domain: SyncDomain, checked: boolean) => {
    setSelectedDomains((prev) => {
      if (checked) {
        if (prev.includes(domain)) return prev
        return [...prev, domain]
      }
      return prev.filter((d) => d !== domain)
    })
  }, [])

  const loadTramoConfig = useCallback(async () => {
    setTramoConfigLoading(true)
    setTramoConfigMessage(null)
    try {
      const [rulesRes, unsRes] = await Promise.all([
        api.get('/brokers/cartera-tramo-rules'),
        api.get('/brokers/cartera-uns'),
      ])

      const cfg = (rulesRes.data || {}) as { rules?: Array<{ un?: string; category?: string; tramos?: number[] }> }
      const uns = (unsRes.data || {}) as { uns?: string[] }

      const normalizedRules: TramoRule[] = (cfg.rules || [])
        .map((r) => ({
          un: String(r.un || '').trim().toUpperCase(),
          category: (String(r.category || '').trim().toUpperCase() === 'MOROSO' ? 'MOROSO' : 'VIGENTE') as RuleCategory,
          tramos: normalizeTramos((r.tramos || []).map((t) => Number(t))),
        }))
        .filter((r) => r.un)

      setTramoRules(normalizedRules)
      setAvailableUns(Array.from(new Set((uns.uns || []).map((u) => String(u || '').trim().toUpperCase()).filter(Boolean))).sort())
    } catch (e: unknown) {
      setTramoConfigMessage({ ok: false, text: getApiErrorMessage(e) })
    } finally {
      setTramoConfigLoading(false)
    }
  }, [])

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    setUsersMessage(null)
    try {
      const res = await listUsers()
      setUsers((res.users || []).slice().sort((a, b) => String(a.username || '').localeCompare(String(b.username || ''))))
    } catch (e: unknown) {
      setUsersMessage({ ok: false, text: getApiErrorMessage(e) })
    } finally {
      setUsersLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTramoConfig()
  }, [loadTramoConfig])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const loadMysqlConfig = useCallback(async () => {
    setMysqlLoading(true)
    setMysqlMessage(null)
    try {
      const data = await getMysqlConnectionConfig()
      setMysqlConfig({
        host: data.host || '',
        port: Number(data.port || 3306),
        user: data.user || '',
        password: data.password || '',
        database: data.database || '',
        ssl_disabled: Boolean(data.ssl_disabled),
      })
    } catch (e: unknown) {
      setMysqlMessage({ ok: false, text: getApiErrorMessage(e) })
    } finally {
      setMysqlLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMysqlConfig()
  }, [loadMysqlConfig])

  const handleSaveMysqlConfig = useCallback(async () => {
    if (!mysqlConfig.host.trim() || !mysqlConfig.user.trim() || !mysqlConfig.database.trim()) {
      setMysqlMessage({ ok: false, text: 'Host, usuario y base son obligatorios.' })
      return
    }
    setMysqlSaving(true)
    setMysqlMessage(null)
    try {
      const saved = await saveMysqlConnectionConfig({
        host: mysqlConfig.host.trim(),
        port: Number(mysqlConfig.port || 3306),
        user: mysqlConfig.user.trim(),
        password: mysqlConfig.password || '',
        database: mysqlConfig.database.trim(),
        ssl_disabled: Boolean(mysqlConfig.ssl_disabled),
      })
      setMysqlConfig(saved)
      setMysqlMessage({ ok: true, text: 'Configuracion MySQL guardada.' })
    } catch (e: unknown) {
      setMysqlMessage({ ok: false, text: getApiErrorMessage(e) })
    } finally {
      setMysqlSaving(false)
    }
  }, [mysqlConfig])

  const handleTestMysqlConfig = useCallback(async () => {
    if (!mysqlConfig.host.trim() || !mysqlConfig.user.trim() || !mysqlConfig.database.trim()) {
      setMysqlMessage({ ok: false, text: 'Host, usuario y base son obligatorios.' })
      return
    }
    setMysqlTesting(true)
    setMysqlMessage(null)
    try {
      const result = await testMysqlConnectionConfig({
        host: mysqlConfig.host.trim(),
        port: Number(mysqlConfig.port || 3306),
        user: mysqlConfig.user.trim(),
        password: mysqlConfig.password || '',
        database: mysqlConfig.database.trim(),
        ssl_disabled: Boolean(mysqlConfig.ssl_disabled),
      })
      const latency = typeof result.latency_ms === 'number' && result.latency_ms >= 0
        ? ` (${result.latency_ms} ms)`
        : ''
      setMysqlMessage({ ok: true, text: `${result.message}${latency}` })
    } catch (e: unknown) {
      setMysqlMessage({ ok: false, text: getApiErrorMessage(e) })
    } finally {
      setMysqlTesting(false)
    }
  }, [mysqlConfig])

  const checkHealth = useCallback(async () => {
    setHealthLoading(true)
    setHealth(null)
    try {
      const res = await api.get('/health')
      setHealth(res.data as { ok?: boolean; db_ok?: boolean; mysql_ok?: boolean | null; service?: string })
    } catch (e: unknown) {
      const msg = getApiErrorMessage(e)
      const status = axios.isAxiosError(e) ? e.response?.status : undefined
      const detail = axios.isAxiosError(e) && e.response?.data ? JSON.stringify(e.response.data) : undefined
      setHealth({
        ok: false,
        error: msg + (status ? ` (HTTP ${status})` : '') + (detail ? ` - ${detail}` : ''),
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

  const toggleRuleTramo = useCallback((tramo: number, checked: boolean) => {
    setRuleTramos((prev) => {
      const set = new Set(prev)
      if (checked) set.add(tramo)
      else set.delete(tramo)
      return normalizeTramos(Array.from(set))
    })
  }, [])

  const upsertRule = useCallback(() => {
    const un = ruleUn.trim().toUpperCase()
    if (!un) {
      setTramoConfigMessage({ ok: false, text: 'Seleccione una Unidad de Negocio.' })
      return
    }
    if (ruleTramos.length === 0) {
      setTramoConfigMessage({ ok: false, text: 'Seleccione al menos un tramo.' })
      return
    }

    setTramoRules((prev) => {
      const next = [...prev]
      const idx = next.findIndex((r) => r.un === un && r.category === ruleCategory)
      const payload: TramoRule = { un, category: ruleCategory, tramos: normalizeTramos(ruleTramos) }
      if (idx >= 0) next[idx] = payload
      else next.push(payload)
      return next.sort((a, b) => (a.un + a.category).localeCompare(b.un + b.category))
    })

    setRuleUn('')
    setRuleTramos([])
    setTramoConfigMessage(null)
  }, [ruleCategory, ruleTramos, ruleUn])

  const removeRule = useCallback((un: string, category: RuleCategory) => {
    setTramoRules((prev) => prev.filter((r) => !(r.un === un && r.category === category)))
    setTramoConfigMessage(null)
  }, [])

  const saveTramoRules = useCallback(async () => {
    setTramoConfigSaving(true)
    setTramoConfigMessage(null)
    try {
      const payload = {
        rules: tramoRules.map((r) => ({
          un: r.un,
          category: r.category,
          tramos: normalizeTramos(r.tramos),
        })),
      }
      const res = await api.post('/brokers/cartera-tramo-rules', payload)
      const saved = (res.data || {}) as { rules?: Array<{ un?: string; category?: string; tramos?: number[] }> }
      const normalizedRules: TramoRule[] = (saved.rules || [])
        .map((r) => ({
          un: String(r.un || '').trim().toUpperCase(),
          category: (String(r.category || '').trim().toUpperCase() === 'MOROSO' ? 'MOROSO' : 'VIGENTE') as RuleCategory,
          tramos: normalizeTramos((r.tramos || []).map((t) => Number(t))),
        }))
        .filter((r) => r.un)
      setTramoRules(normalizedRules)
      setTramoConfigMessage({ ok: true, text: 'Reglas de tramo guardadas.' })
    } catch (e: unknown) {
      setTramoConfigMessage({ ok: false, text: getApiErrorMessage(e) })
    } finally {
      setTramoConfigSaving(false)
    }
  }, [tramoRules])

  const handleCreateUser = useCallback(async () => {
    const username = newUsername.trim().toLowerCase()
    const password = newPassword
    if (!username) {
      setUsersMessage({ ok: false, text: 'Ingrese username.' })
      return
    }
    if (password.length < 6) {
      setUsersMessage({ ok: false, text: 'La contrasena debe tener al menos 6 caracteres.' })
      return
    }
    setUsersSaving(true)
    setUsersMessage(null)
    try {
      await createUser({
        username,
        password,
        role: newRole,
        is_active: newIsActive,
      })
      setUsersMessage({ ok: true, text: 'Usuario creado.' })
      setNewUsername('')
      setNewPassword('')
      setNewRole('viewer')
      setNewIsActive(true)
      await loadUsers()
    } catch (e: unknown) {
      setUsersMessage({ ok: false, text: getApiErrorMessage(e) })
    } finally {
      setUsersSaving(false)
    }
  }, [loadUsers, newIsActive, newPassword, newRole, newUsername])

  const handleUpdateUser = useCallback(async (row: UserItem) => {
    const pwd = (rowPasswordDraft[row.username] || '').trim()
    setUsersSaving(true)
    setUsersMessage(null)
    try {
      await updateUser(row.username, {
        role: row.role,
        is_active: row.is_active,
        password: pwd || undefined,
      })
      setUsersMessage({ ok: true, text: `Usuario ${row.username} actualizado.` })
      setRowPasswordDraft((prev) => ({ ...prev, [row.username]: '' }))
      await loadUsers()
    } catch (e: unknown) {
      setUsersMessage({ ok: false, text: getApiErrorMessage(e) })
    } finally {
      setUsersSaving(false)
    }
  }, [loadUsers, rowPasswordDraft])

  const pollDomainStatus = useCallback(
    async (
      domain: SyncDomain,
      jobId: string,
      domainIndex: number,
      totalDomains: number
    ): Promise<SyncStatusResponse> => {
      let consecutiveErrors = 0
      let currentDelay = STATUS_POLL_MS
      let stagnantCycles = 0
      let lastDomainProgress = -1

      while (true) {
        try {
          const status = await getSyncStatus({ domain, job_id: jobId })
          consecutiveErrors = 0

          const domainProgress = Math.max(0, Math.min(100, Number(status.progress_pct || 0)))
          const overallProgress = Math.round(((domainIndex + domainProgress / 100) / totalDomains) * 100)
          const queueWaiting = typeof status.queue_position === 'number' && status.queue_position > 0
          const progressed = domainProgress > lastDomainProgress
          if (progressed) {
            stagnantCycles = 0
          } else {
            stagnantCycles += 1
          }
          lastDomainProgress = domainProgress
          currentDelay = (queueWaiting || stagnantCycles >= 3) ? STATUS_POLL_STABLE_MS : STATUS_POLL_MS

          setSyncLive({
            running: Boolean(status.running),
            currentDomain: domain,
            log: status.log || [],
            progressPct: overallProgress,
            stage: String(status.stage || ''),
            message: `[${domain}] ${String(status.status_message || 'Sincronizando...')}`,
            rowsInserted: Number(status.rows_inserted || 0),
            rowsUpdated: Number(status.rows_updated || 0),
            rowsSkipped: Number(status.rows_skipped || 0),
            rowsRead: Number(status.rows_read || 0),
            rowsUpserted: Number(status.rows_upserted || 0),
            rowsUnchanged: Number(status.rows_unchanged || 0),
            throughputRowsPerSec: Number(status.throughput_rows_per_sec || 0),
            etaSeconds: typeof status.eta_seconds === 'number' ? status.eta_seconds : null,
            currentQueryFile: status.current_query_file || null,
            jobStep: status.job_step || null,
            queuePosition: typeof status.queue_position === 'number' ? status.queue_position : null,
            chunkKey: status.chunk_key || null,
            chunkStatus: status.chunk_status || null,
            skippedUnchangedChunks: Number(status.skipped_unchanged_chunks || 0),
            watermark: status.watermark ? {
              partitionKey: status.watermark.partition_key || null,
              lastUpdatedAt: status.watermark.last_updated_at || null,
              lastSourceId: status.watermark.last_source_id || null,
              updatedAt: status.watermark.updated_at || null,
            } : null,
            targetTable: status.target_table || null,
            duplicatesDetected: Number(status.duplicates_detected || 0),
            error: status.error || null,
            lastUpdatedAt: new Date().toISOString(),
          })

          if (!status.running) {
            return status
          }
        } catch (err) {
          consecutiveErrors += 1
          currentDelay = Math.min(STATUS_POLL_MAX_MS, currentDelay * 2)
          const errMsg = getApiErrorMessage(err)
          setSyncLive((prev) => {
            const lines = [...(prev?.log || [])]
            lines.push(`[${domain}] Estado: no se pudo consultar progreso (intento ${consecutiveErrors}): ${errMsg}`)
            return {
              ...(prev || {}),
              running: true,
              currentDomain: domain,
              log: lines.slice(-200),
              message: `[${domain}] Sin respuesta del estado de sincronizacion`,
              lastUpdatedAt: prev?.lastUpdatedAt || null,
            }
          })
          if (consecutiveErrors >= 5) {
            throw new Error(`No se pudo consultar estado para ${domain} (5 intentos). Ultimo error: ${errMsg}`)
          }
        }

        await sleep(currentDelay)
      }
    },
    []
  )

  const resumeRunningSync = useCallback(async () => {
    const domains = SYNC_DOMAINS.map((d) => d.value)
    for (const domain of domains) {
      const status = await getSyncStatus({ domain })
      if (!status.running || !status.job_id) continue

      setSyncLoading(true)
      setSyncResult(null)
      setSyncLive({
        running: true,
        currentDomain: domain,
        log: status.log || [],
        progressPct: Math.max(0, Math.min(100, Number(status.progress_pct || 0))),
        stage: String(status.stage || ''),
        message: `[${domain}] ${String(status.status_message || 'Sincronizando...')}`,
        rowsInserted: Number(status.rows_inserted || 0),
        rowsUpdated: Number(status.rows_updated || 0),
        rowsSkipped: Number(status.rows_skipped || 0),
        rowsRead: Number(status.rows_read || 0),
        rowsUpserted: Number(status.rows_upserted || 0),
        rowsUnchanged: Number(status.rows_unchanged || 0),
        throughputRowsPerSec: Number(status.throughput_rows_per_sec || 0),
        etaSeconds: typeof status.eta_seconds === 'number' ? status.eta_seconds : null,
        currentQueryFile: status.current_query_file || null,
        jobStep: status.job_step || null,
        queuePosition: typeof status.queue_position === 'number' ? status.queue_position : null,
        chunkKey: status.chunk_key || null,
        chunkStatus: status.chunk_status || null,
        skippedUnchangedChunks: Number(status.skipped_unchanged_chunks || 0),
        watermark: status.watermark
          ? {
              partitionKey: status.watermark.partition_key || null,
              lastUpdatedAt: status.watermark.last_updated_at || null,
              lastSourceId: status.watermark.last_source_id || null,
              updatedAt: status.watermark.updated_at || null,
            }
          : null,
        targetTable: status.target_table || null,
        duplicatesDetected: Number(status.duplicates_detected || 0),
        error: status.error || null,
        lastUpdatedAt: new Date().toISOString(),
      })

      try {
        const finalStatus = await pollDomainStatus(domain, status.job_id, 0, 1)
        if (finalStatus.error) {
          setSyncResult({ error: `[${domain}] ${finalStatus.error}` })
        } else {
          const applied = getAppliedRows(finalStatus)
          setSyncResult({
            rows: applied,
            log: [`[${domain}] job=${status.job_id} aplicadas=${applied}`],
          })
        }
      } catch (e: unknown) {
        setSyncResult({ error: getApiErrorMessage(e) })
      } finally {
        setSyncLoading(false)
      }
      return
    }
  }, [pollDomainStatus])

  const findRunningSyncJob = useCallback(async (preferredDomain?: SyncDomain) => {
    const orderedDomains: SyncDomain[] = preferredDomain
      ? [preferredDomain, ...SYNC_DOMAINS.map((d) => d.value).filter((d) => d !== preferredDomain)]
      : SYNC_DOMAINS.map((d) => d.value)

    for (const candidate of orderedDomains) {
      try {
        const status = await getSyncStatus({ domain: candidate })
        if (status.running && status.job_id) {
          return { domain: candidate, jobId: status.job_id }
        }
      } catch {
        // continue scanning other domains
      }
    }
    return null
  }, [])

  useEffect(() => {
    if (resumeAttemptedRef.current) return
    resumeAttemptedRef.current = true
    void resumeRunningSync()
  }, [resumeRunningSync])

  const buildSyncPayload = useCallback((domain: SyncDomain) => {
    const cleanYear = yearFrom.trim()
    const year = /^\d{4}$/.test(cleanYear) ? Number(cleanYear) : undefined
    const payload: {
      domain: SyncDomain
      year_from?: number
      close_month?: string
      close_month_from?: string
      close_month_to?: string
    } = { domain }
    if (domain === 'cartera') {
      payload.close_month_from = closeMonthFromValue
      payload.close_month_to = closeMonthToValue
      if (closeMonthFromValue && closeMonthToValue && closeMonthFromValue === closeMonthToValue) {
        payload.close_month = closeMonthFromValue
      }
    } else if (year !== undefined) {
      payload.year_from = year
    }
    return payload
  }, [closeMonthFromValue, closeMonthToValue, yearFrom])

  const executeSyncFlow = useCallback(async (skipMassiveConfirm: boolean) => {
    if (selectedDomains.length === 0) {
      setSyncResult({ error: 'Seleccione al menos un dominio SQL para ejecutar.' })
      return
    }
    if (selectedDomains.includes('cartera') && (!closeMonthFromValue || !closeMonthToValue)) {
      setSyncResult({ error: 'Para Cartera debe indicar rango de cierre: Desde y Hasta (MM + YYYY).' })
      return
    }
    if (
      selectedDomains.includes('cartera')
      && closeMonthFromValue
      && closeMonthToValue
      && monthSerial(closeMonthFromValue) > monthSerial(closeMonthToValue)
    ) {
      setSyncResult({ error: 'Rango de cierre invalido: Desde no puede ser mayor que Hasta.' })
      return
    }

    if (!skipMassiveConfirm && allDomainsSelected && previewEnabledRef.current) {
      setSyncLoading(true)
      setSyncResult(null)
      const previewRows: MassivePreviewItem[] = []
      try {
        for (const domain of selectedDomains) {
          const payload = buildSyncPayload(domain)
          setSyncLive((prev) => ({
            ...(prev || {}),
            running: true,
            currentDomain: domain,
            progressPct: 1,
            message: `[${domain}] Analizando riesgo de carga...`,
            lastUpdatedAt: new Date().toISOString(),
          }))
          try {
            const preview = await previewSync(payload, {
              sampled: true,
              sample_rows: MASSIVE_PREVIEW_SAMPLE_ROWS,
              timeout_seconds: MASSIVE_PREVIEW_TIMEOUT_SECONDS,
            })
            const confidence = preview.estimate_confidence || (preview.sampled ? 'medium' : 'high')
            const risk = preview.risk_level || (confidence === 'low' ? 'high' : confidence === 'medium' ? 'medium' : 'low')
            previewRows.push({
              domain,
              estimatedRows: Number(preview.estimated_rows || 0),
              maxRowsAllowed: preview.max_rows_allowed ?? null,
              wouldExceedLimit: Boolean(preview.would_exceed_limit),
              estimateConfidence: confidence,
              estimatedDurationSec: preview.estimated_duration_sec ?? null,
              riskLevel: risk,
            })
          } catch (previewError: unknown) {
            const msg = getApiErrorMessage(previewError)
            if (/deshabilitad/i.test(msg)) {
              previewEnabledRef.current = false
              continue
            }
            if (/timeout|timed out|exceeded/i.test(msg)) {
              previewRows.push({
                domain,
                estimatedRows: 0,
                maxRowsAllowed: null,
                wouldExceedLimit: false,
                estimateConfidence: 'low',
                estimatedDurationSec: null,
                riskLevel: 'high',
              })
              continue
            }
            throw previewError
          }
        }
        const highestRisk = previewRows.reduce<SyncRiskLevel>((acc, item) => {
          return riskPriority(item.riskLevel) > riskPriority(acc) ? item.riskLevel : acc
        }, 'low')
        setMassivePreviewRows(previewRows)
        if (highestRisk === 'medium' || highestRisk === 'high') {
          setMassiveConfirmOpen(true)
          setSyncLoading(false)
          setSyncLive((prev) => ({
            ...(prev || {}),
            running: false,
            message: 'Se requiere confirmacion para ejecutar carga masiva.',
          }))
          return
        }
      } catch (e: unknown) {
        setSyncLoading(false)
        setSyncLive((prev) => ({
          ...(prev || {}),
          running: false,
          error: getApiErrorMessage(e),
        }))
        setSyncResult({ error: getApiErrorMessage(e) })
        return
      }
    }

    setSyncLoading(true)
    setSyncResult(null)
    setSyncLive({
      running: true,
      currentDomain: null,
      log: ['Estado: iniciando sincronizacion...'],
      progressPct: 1,
      stage: 'starting',
      message: 'Iniciando sincronizacion...',
      lastUpdatedAt: new Date().toISOString(),
    })

    let totalApplied = 0
    let successfulDomains = 0
    const globalLog: string[] = []
    const skippedDomains: string[] = []

    try {
      for (let i = 0; i < selectedDomains.length; i += 1) {
        const domain = selectedDomains[i]
        const payload = buildSyncPayload(domain)
        const noFilterPayload = (
          payload.year_from === undefined
          && !payload.close_month
          && !payload.close_month_from
          && !payload.close_month_to
        )

        setSyncLive((prev) => ({
          ...(prev || {}),
          running: true,
          currentDomain: domain,
          progressPct: Math.round((i / selectedDomains.length) * 100),
          message: `[${domain}] Estimando volumen...`,
          currentQueryFile: SYNC_QUERY_FILES[domain],
          targetTable: null,
          rowsRead: 0,
          rowsInserted: 0,
          rowsUpdated: 0,
          rowsSkipped: 0,
          rowsUpserted: 0,
          rowsUnchanged: 0,
          duplicatesDetected: 0,
          queuePosition: null,
          chunkKey: null,
          chunkStatus: null,
        }))

        let previewRowsText = 'sin estimacion'
        let shouldSkipDomain = false
        if (previewEnabledRef.current) {
          try {
            const previewOptions = allDomainsSelected
              ? {
                  sampled: true,
                  sample_rows: MASSIVE_PREVIEW_SAMPLE_ROWS,
                  timeout_seconds: MASSIVE_PREVIEW_TIMEOUT_SECONDS,
                }
              : undefined
            const preview = await previewSync(payload, previewOptions)
            previewRowsText = `${preview.estimated_rows}`
            if (preview.would_exceed_limit) {
              const reason = noFilterPayload
                ? 'carga masiva sin filtros'
                : 'estimacion por encima de limite'
              globalLog.push(
                `[${domain}] ${reason}: ${preview.estimated_rows} filas estimadas `
                + `(limite ref ${preview.max_rows_allowed ?? 0}); se continua con micro-lotes protegidos.`
              )
              setSyncLive((prev) => ({
                ...(prev || {}),
                running: true,
                currentDomain: domain,
                message: `[${domain}] Modo protegido activo (micro-lotes)`,
                error: null,
              }))
            }
          } catch (previewError: unknown) {
            const previewErrorMsg = getApiErrorMessage(previewError)
            if (/deshabilitad/i.test(previewErrorMsg)) {
              previewEnabledRef.current = false
              globalLog.push(`[${domain}] preview deshabilitado por configuracion; se continua sin estimacion`)
            } else if (/timeout|timed out|exceeded/i.test(previewErrorMsg)) {
              globalLog.push(`[${domain}] preview timeout; se continua sin estimacion`)
            } else {
              shouldSkipDomain = true
              skippedDomains.push(domain)
              globalLog.push(`[${domain}] OMITIDO: ${previewErrorMsg}`)
              setSyncLive((prev) => ({
                ...(prev || {}),
                running: true,
                currentDomain: domain,
                message: `[${domain}] Omitido por error de validacion`,
                error: null,
              }))
            }
          }
        }
        if (shouldSkipDomain) {
          continue
        }

        setSyncLive((prev) => ({
          ...(prev || {}),
          running: true,
          currentDomain: domain,
          message: `[${domain}] Encolando ejecucion (${previewRowsText} filas estimadas)...`,
        }))

        try {
          const run = await runSync(payload)
          const status = await pollDomainStatus(domain, run.job_id, i, selectedDomains.length)

          if (status.error) {
            skippedDomains.push(domain)
            globalLog.push(`[${domain}] ERROR: ${status.error}`)
            continue
          }

          successfulDomains += 1
          const applied = getAppliedRows(status)
          totalApplied += applied

          globalLog.push(`[${domain}] job=${run.job_id} aplicadas=${applied} duplicados=${Number(status.duplicates_detected || 0)}`)
        } catch (domainError: unknown) {
          const msg = getApiErrorMessage(domainError)
          if (/sincronizacion en curso|ya existe/i.test(msg)) {
            try {
              const runningJob = await findRunningSyncJob(domain)
              if (runningJob) {
                const resumed = await pollDomainStatus(runningJob.domain, runningJob.jobId, i, selectedDomains.length)
                if (resumed.error) {
                  skippedDomains.push(domain)
                  globalLog.push(`[${domain}] ERROR al reanudar: ${resumed.error}`)
                  continue
                }
                successfulDomains += 1
                const applied = getAppliedRows(resumed)
                totalApplied += applied
                globalLog.push(`[${domain}] job=${runningJob.jobId} reanudado en dominio=${runningJob.domain}, aplicadas=${applied} duplicados=${Number(resumed.duplicates_detected || 0)}`)
                continue
              }
            } catch {
              // fallback to regular error handling below
            }
          }
          skippedDomains.push(domain)
          globalLog.push(`[${domain}] ERROR: ${msg}`)
          continue
        }
      }

      setSyncLive((prev) => ({
        ...(prev || {}),
        running: false,
        progressPct: 100,
        message: 'Sincronizacion finalizada',
      }))
      if (successfulDomains > 0) {
        if (skippedDomains.length > 0) {
          globalLog.push(`Dominios omitidos/error: ${Array.from(new Set(skippedDomains)).join(', ')}`)
        }
        setSyncResult({ rows: totalApplied, log: globalLog })
      } else if (skippedDomains.length > 0) {
        setSyncResult({
          error: `No se pudo ejecutar ningun dominio. Omitidos/error: ${Array.from(new Set(skippedDomains)).join(', ')}`,
          log: globalLog,
        })
      } else {
        setSyncResult({ rows: totalApplied, log: globalLog })
      }

      if (selectedDomains.includes('analytics')) {
        await onReloadBrokers?.()
      }
    } catch (e: unknown) {
      setSyncLive((prev) => ({
        ...(prev || {}),
        running: false,
        error: getApiErrorMessage(e),
      }))
      setSyncResult({ error: getApiErrorMessage(e), log: globalLog })
    } finally {
      setSyncLoading(false)
    }
  }, [
    allDomainsSelected,
    buildSyncPayload,
    closeMonthFromValue,
    closeMonthToValue,
    onReloadBrokers,
    pollDomainStatus,
    selectedDomains,
  ])

  const handleSync = useCallback(() => {
    void executeSyncFlow(false)
  }, [executeSyncFlow])

  const handleConfirmMassiveSync = useCallback(() => {
    setMassiveConfirmOpen(false)
    void executeSyncFlow(true)
  }, [executeSyncFlow])

  const baseUrl = api.defaults.baseURL || 'http://localhost:8000/api/v1'
  const showSyncResult = Boolean(syncResult) && !syncLoading && !syncLive?.running

  return (
    <section className="card config-card">
      <h2>Configuracion</h2>
      <div className="config-submenu" role="tablist" aria-label="Subsecciones de configuracion">
        <button
          type="button"
          className={`btn btn-secondary config-submenu-btn ${configSection === 'usuarios' ? 'active' : ''}`}
          onClick={() => setConfigSection('usuarios')}
          role="tab"
          aria-selected={configSection === 'usuarios'}
        >
          Usuarios
        </button>
        <button
          type="button"
          className={`btn btn-secondary config-submenu-btn ${configSection === 'negocio' ? 'active' : ''}`}
          onClick={() => setConfigSection('negocio')}
          role="tab"
          aria-selected={configSection === 'negocio'}
        >
          Configuracion de negocio
        </button>
        <button
          type="button"
          className={`btn btn-secondary config-submenu-btn ${configSection === 'importaciones' ? 'active' : ''}`}
          onClick={() => setConfigSection('importaciones')}
          role="tab"
          aria-selected={configSection === 'importaciones'}
        >
          Importaciones
        </button>
      </div>
      <div className="config-form-wrap">
        {configSection === 'negocio' && (
        <>
          <div>
            <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>API</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: 0 }}>
              Base URL: <code>{baseUrl}</code>
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Estado de conexion</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={checkHealth} disabled={healthLoading}>
                {healthLoading ? 'Comprobando...' : 'Comprobar conexion'}
              </button>
              {health && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ color: health.ok ? 'var(--color-primary)' : 'var(--color-error)', fontWeight: 500 }}>
                    {health.ok ? 'OK Conectado' : 'ERROR Sin conexion'}
                    {health.db_ok !== undefined && ` (DB: ${health.db_ok ? 'OK' : 'Error'})`}
                    {health.mysql_ok !== undefined && health.mysql_ok !== null && ` (MySQL: ${health.mysql_ok ? 'OK' : 'Error'})`}
                    {health.mysql_ok === null && ' (MySQL: no configurado)'}
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
            <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Conexion MySQL (extraccion)</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', marginTop: 0 }}>
              Esta configuracion se usa para extraer datos en sincronizacion.
            </p>
            <div className="config-grid-3" style={{ marginTop: '0.5rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Host</span>
                <input
                  className="input"
                  value={mysqlConfig.host}
                  onChange={(e) => setMysqlConfig((prev) => ({ ...prev, host: e.target.value }))}
                  placeholder="192.168.0.10"
                  disabled={mysqlLoading || mysqlSaving || mysqlTesting}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Puerto</span>
                <input
                  className="input"
                  type="number"
                  value={mysqlConfig.port}
                  onChange={(e) => setMysqlConfig((prev) => ({ ...prev, port: Number(e.target.value || 3306) }))}
                  placeholder="3306"
                  disabled={mysqlLoading || mysqlSaving || mysqlTesting}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Base</span>
                <input
                  className="input"
                  value={mysqlConfig.database}
                  onChange={(e) => setMysqlConfig((prev) => ({ ...prev, database: e.target.value }))}
                  placeholder="epem"
                  disabled={mysqlLoading || mysqlSaving || mysqlTesting}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Usuario</span>
                <input
                  className="input"
                  value={mysqlConfig.user}
                  onChange={(e) => setMysqlConfig((prev) => ({ ...prev, user: e.target.value }))}
                  placeholder="bi"
                  disabled={mysqlLoading || mysqlSaving || mysqlTesting}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Contrasena</span>
                <input
                  className="input"
                  type="password"
                  value={mysqlConfig.password}
                  onChange={(e) => setMysqlConfig((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="********"
                  disabled={mysqlLoading || mysqlSaving || mysqlTesting}
                />
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginTop: '1.8rem' }}>
                <input
                  type="checkbox"
                  checked={mysqlConfig.ssl_disabled}
                  onChange={(e) => setMysqlConfig((prev) => ({ ...prev, ssl_disabled: e.target.checked }))}
                  disabled={mysqlLoading || mysqlSaving || mysqlTesting}
                />
                <span>MYSQL_SSL_DISABLED</span>
              </label>
            </div>
            <div style={{ marginTop: '0.55rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary" onClick={() => void handleSaveMysqlConfig()} disabled={mysqlLoading || mysqlSaving || mysqlTesting}>
                {mysqlSaving ? 'Guardando...' : 'Guardar MySQL'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => void handleTestMysqlConfig()} disabled={mysqlLoading || mysqlSaving || mysqlTesting}>
                {mysqlTesting ? 'Probando...' : 'Probar MySQL'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => void loadMysqlConfig()} disabled={mysqlLoading || mysqlSaving || mysqlTesting}>
                {mysqlLoading ? 'Cargando...' : 'Recargar MySQL'}
              </button>
              {mysqlMessage && (
                <span style={{ color: mysqlMessage.ok ? 'var(--color-primary)' : 'var(--color-error)', fontWeight: 500 }}>
                  {mysqlMessage.text}
                </span>
              )}
            </div>
          </div>
        </>
        )}

        {configSection === 'usuarios' && (
        <div>
          <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Usuarios y Roles</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', marginTop: 0 }}>
            Crear usuarios, asignar rol y activar/desactivar acceso.
          </p>

          <div className="config-grid-3" style={{ marginTop: '0.75rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Username</span>
              <input
                className="input"
                value={newUsername}
                placeholder="ej: operador1"
                onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                disabled={usersBusy}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Contrasena</span>
              <input
                className="input"
                type="password"
                value={newPassword}
                placeholder="min. 6 caracteres"
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={usersBusy}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Rol</span>
              <select className="input" value={newRole} onChange={(e) => setNewRole((e.target.value as RoleType) || 'viewer')} disabled={usersBusy}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ marginTop: '0.55rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <input type="checkbox" checked={newIsActive} onChange={(e) => setNewIsActive(e.target.checked)} disabled={usersBusy} />
              <span>Activo</span>
            </label>
            <button type="button" className="btn btn-primary" onClick={() => void handleCreateUser()} disabled={usersBusy}>
              {usersSaving ? 'Guardando...' : 'Crear usuario'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => void loadUsers()} disabled={usersBusy}>
              {usersLoading ? 'Cargando...' : 'Recargar usuarios'}
            </button>
            {usersMessage && (
              <span style={{ color: usersMessage.ok ? 'var(--color-primary)' : 'var(--color-error)', fontWeight: 500 }}>
                {usersMessage.text}
              </span>
            )}
          </div>

          <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.45rem' }}>
            {users.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', margin: 0 }}>
                Sin usuarios en base de datos.
              </p>
            ) : (
              users.map((u) => (
                <div key={u.username} className="config-grid-3" style={{ alignItems: 'center' }}>
                  <input className="input" value={u.username} readOnly />

                  <select
                    className="input"
                    value={u.role}
                    onChange={(e) => {
                      const role = (e.target.value as RoleType) || 'viewer'
                      setUsers((prev) => prev.map((x) => (x.username === u.username ? { ...x, role } : x)))
                    }}
                    disabled={usersBusy}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>

                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(u.is_active)}
                        onChange={(e) => {
                          const is_active = e.target.checked
                          setUsers((prev) => prev.map((x) => (x.username === u.username ? { ...x, is_active } : x)))
                        }}
                        disabled={usersBusy}
                      />
                      <span>Activo</span>
                    </label>
                    <input
                      className="input"
                      type="password"
                      placeholder="Nueva contrasena (opcional)"
                      value={rowPasswordDraft[u.username] || ''}
                      onChange={(e) => setRowPasswordDraft((prev) => ({ ...prev, [u.username]: e.target.value }))}
                      disabled={usersBusy}
                    />
                    <button type="button" className="btn btn-secondary" onClick={() => void handleUpdateUser(u)} disabled={usersBusy}>
                      Guardar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        )}

        {configSection === 'negocio' && (
        <div>
          <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Reglas de Tramo por Unidad de Negocio</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', marginTop: 0 }}>
            Elige varios tramos + Unidad de Negocio + Categoria, luego agrega la regla.
          </p>

          <div className="config-grid-3" style={{ marginTop: '0.75rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Unidad de Negocio</span>
              <input
                className="input"
                list="un-options"
                placeholder="Ej: MEDICINA ESTETICA"
                value={ruleUn}
                onChange={(e) => setRuleUn(e.target.value.toUpperCase())}
                disabled={configBusy}
              />
              <datalist id="un-options">
                {availableUns.map((un) => (
                  <option key={un} value={un} />
                ))}
              </datalist>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Categoria</span>
              <select className="input" value={ruleCategory} onChange={(e) => setRuleCategory(e.target.value === 'MOROSO' ? 'MOROSO' : 'VIGENTE')}>
                <option value="VIGENTE">VIGENTE</option>
                <option value="MOROSO">MOROSO</option>
              </select>
            </label>

            <button type="button" className="btn btn-secondary config-full-mobile" onClick={upsertRule} disabled={configBusy}>
              Agregar/Actualizar
            </button>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Tramos (multiple)</span>
            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
              {TRAMO_OPTIONS.map((t) => (
                <label key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <input
                    type="checkbox"
                    checked={ruleTramos.includes(t)}
                    onChange={(e) => toggleRuleTramo(t, e.target.checked)}
                    disabled={configBusy}
                  />
                  <span>{t}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="btn btn-primary" onClick={saveTramoRules} disabled={configBusy}>
              {tramoConfigSaving ? 'Guardando...' : 'Guardar reglas'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => void loadTramoConfig()} disabled={configBusy}>
              {tramoConfigLoading ? 'Cargando...' : 'Recargar reglas'}
            </button>
            {tramoConfigMessage && (
              <span style={{ color: tramoConfigMessage.ok ? 'var(--color-primary)' : 'var(--color-error)', fontWeight: 500 }}>
                {tramoConfigMessage.text}
              </span>
            )}
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            {tramoRules.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', margin: 0 }}>
                Sin reglas por UN.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: '0.4rem' }}>
                {tramoRules
                  .slice()
                  .sort((a, b) => (a.un + a.category).localeCompare(b.un + b.category))
                  .map((r) => (
                    <div key={`${r.un}-${r.category}`} className="config-grid-3">
                      <input className="input" value={r.un} readOnly />
                      <input className="input" value={`${r.category}: ${r.tramos.join(', ') || '-'}`} readOnly />
                      <button type="button" className="btn btn-secondary config-full-mobile" onClick={() => removeRule(r.un, r.category)} disabled={configBusy}>
                        Quitar
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
        )}

        {configSection === 'importaciones' && (
        <div>
          <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Carga dual SQL</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Dominios SQL (multiple)</span>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {SYNC_DOMAINS.map((d) => (
                <label key={d.value} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <input
                    type="checkbox"
                    checked={selectedDomains.includes(d.value)}
                    onChange={(e) => toggleDomain(d.value, e.target.checked)}
                    disabled={busy}
                  />
                  <span>{d.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', maxWidth: '960px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Ano (opcional)</span>
              <input
                className="input"
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="Ej: 2024"
                value={yearFrom}
                onChange={(e) => setYearFrom(e.target.value.replace(/[^0-9]/g, ''))}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Mes cierre desde (cartera)</span>
              <input
                className="input"
                type="text"
                inputMode="numeric"
                maxLength={2}
                placeholder="MM"
                value={closeMonthFromPart}
                onChange={(e) => setCloseMonthFromPart(e.target.value.replace(/[^0-9]/g, ''))}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Ano cierre desde (cartera)</span>
              <input
                className="input"
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="YYYY"
                value={closeYearFromPart}
                onChange={(e) => setCloseYearFromPart(e.target.value.replace(/[^0-9]/g, ''))}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Mes cierre hasta (cartera)</span>
              <input
                className="input"
                type="text"
                inputMode="numeric"
                maxLength={2}
                placeholder="MM"
                value={closeMonthToPart}
                onChange={(e) => setCloseMonthToPart(e.target.value.replace(/[^0-9]/g, ''))}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Ano cierre hasta (cartera)</span>
              <input
                className="input"
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="YYYY"
                value={closeYearToPart}
                onChange={(e) => setCloseYearToPart(e.target.value.replace(/[^0-9]/g, ''))}
              />
            </label>
          </div>

          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', marginTop: '0.5rem' }}>
            Modo de carga: <strong>{modeLabel}</strong>
          </p>
          {allDomainsSelected && (
            <p style={{ color: '#f59e0b', fontSize: '0.82rem', marginTop: '0.35rem', marginBottom: '0.2rem' }}>
              Modo masivo: se ejecutara en cola estricta (1 dominio por vez) para proteger RAM/CPU.
            </p>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="btn btn-primary" onClick={handleSync} disabled={busy}>
              {syncLoading ? 'Sincronizando...' : 'Ejecutar carga'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleReload} disabled={busy}>
              {reloadLoading ? 'Recargando...' : 'Recargar vista'}
            </button>
              {showSyncResult && syncResult && (
              <span style={{ color: syncResult.error ? 'var(--color-error)' : 'var(--color-primary)', fontWeight: 500 }}>
                {syncResult.error
                  ? `ERROR ${syncResult.error}`
                  : Number(syncResult.rows || 0) > 0
                    ? `OK ${syncResult.rows ?? 0} filas cargadas`
                    : 'OK sincronizacion completada (sin cambios)'}
              </span>
              )}
          </div>

          {massiveConfirmOpen && (
            <div className="sync-safe-modal-backdrop" role="presentation">
              <div className="sync-safe-modal" role="dialog" aria-modal="true" aria-label="Confirmar carga masiva">
                <h4>Carga masiva detectada</h4>
                <p>
                  Se seleccionaron todos los dominios. Para proteger el servidor, la ejecucion sera secuencial y puede tardar varios minutos.
                </p>
                <div className="sync-safe-modal-summary">
                  <span>Total estimado: <strong>{massivePreviewSummary.totalEstimatedRows}</strong> filas</span>
                  <span>Duracion estimada: <strong>{formatDurationSeconds(massivePreviewSummary.totalEstimatedDurationSec)}</strong></span>
                  <span>Riesgo: <strong className={`sync-risk sync-risk--${massivePreviewSummary.highestRisk}`}>{massivePreviewSummary.highestRisk.toUpperCase()}</strong></span>
                </div>
                <div className="sync-safe-modal-table">
                  {massivePreviewRows.map((row) => (
                    <div key={row.domain} className="sync-safe-modal-row">
                      <span>{row.domain}</span>
                      <span>{row.estimatedRows} filas</span>
                      <span>Confianza: {row.estimateConfidence}</span>
                      <span className={`sync-risk sync-risk--${row.riskLevel}`}>{row.riskLevel.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
                <div className="sync-safe-modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setMassiveConfirmOpen(false)} disabled={syncLoading}>
                    Cancelar
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleConfirmMassiveSync} disabled={syncLoading}>
                    Confirmar y continuar
                  </button>
                </div>
              </div>
            </div>
          )}

          {syncLive && (
            <div className="sync-progress-shell">
              <div className="sync-progress-hero">
                <div
                  className="sync-ring"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={syncPercent}
                  aria-label="Progreso de sincronizacion"
                >
                  <svg className={`sync-ring-svg ${syncLive.running ? 'is-running' : ''}`} viewBox="0 0 120 120" aria-hidden>
                    <circle className="sync-ring-track" cx="60" cy="60" r="48" />
                    <circle
                      className="sync-ring-value"
                      cx="60"
                      cy="60"
                      r="48"
                      style={{
                        strokeDasharray: `${2 * Math.PI * 48} ${2 * Math.PI * 48}`,
                        strokeDashoffset: `${2 * Math.PI * 48 * (1 - syncPercent / 100)}`,
                      }}
                    />
                  </svg>
                  <div className="sync-ring-label">
                    <strong>{syncPercent}%</strong>
                    <span>{syncLive.running ? 'En curso' : 'Finalizado'}</span>
                  </div>
                </div>

                <div className="sync-progress-details">
                  <div className="sync-progress-title">{syncLive.message || 'Sincronizando...'}</div>
                  <div className="sync-progress-tags">
                    <span className={toneClass(liveTone)}>
                      Estado: <strong>{isLiveFresh ? 'En vivo' : 'Desfasado'}</strong>
                    </span>
                    <span className={toneClass('info')}>Ult. actualizacion: <strong>{lastUpdatedLabel}</strong></span>
                    <span className={toneClass('info')}>Dominio: <strong>{syncDomainLabel}</strong></span>
                    <span className={toneClass('info')}>Query: <code>{syncQueryFile}</code></span>
                    <span className={toneClass('info')}>Etapa: <strong>{syncLive.jobStep || syncLive.stage || '-'}</strong></span>
                    <span className={toneClass((syncLive.etaSeconds && syncLive.etaSeconds > 0) ? 'warn' : 'ok')}>ETA: <strong>{syncLive.etaSeconds && syncLive.etaSeconds > 0 ? `${syncLive.etaSeconds}s` : '-'}</strong></span>
                    <span className={toneClass(throughputTone)}>Throughput: <strong>{syncLive.throughputRowsPerSec ? `${syncLive.throughputRowsPerSec.toFixed(1)} filas/s` : '-'}</strong></span>
                    <span className={toneClass(queueTone)}>Cola: <strong>{typeof syncLive.queuePosition === 'number' ? syncLive.queuePosition : '-'}</strong></span>
                    <span className={toneClass(chunkTone)}>Chunk: <strong>{syncLive.chunkStatus || '-'}</strong></span>
                    <span className={toneClass(chunkTone)}>Chunk key: <code>{syncLive.chunkKey || '-'}</code></span>
                    <span className={toneClass(watermarkTone)}>Watermark: <code>{syncLive.watermark?.partitionKey || '-'}</code></span>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.82rem', marginBottom: '0.4rem', color: 'var(--color-text-muted)' }}>
                Avance general
              </div>
              <div
                style={{
                  width: '100%',
                  height: '10px',
                  background: 'rgba(255,255,255,0.12)',
                  borderRadius: '999px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${syncPercent}%`,
                    height: '100%',
                    background: 'var(--color-primary)',
                    transition: 'width 300ms ease',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                <span>Tabla destino: {syncLive.targetTable || '-'}</span>
                <span>Leidas: {syncLive.rowsRead ?? 0}</span>
                <span>Insertadas: {syncLive.rowsInserted ?? 0}</span>
                <span>Actualizadas: {syncLive.rowsUpdated ?? 0}</span>
                <span>Omitidas: {syncLive.rowsSkipped ?? 0}</span>
                <span>Upsert destino: {syncLive.rowsUpserted ?? 0}</span>
                <span>Sin cambios: {syncLive.rowsUnchanged ?? 0}</span>
                <span>Chunks omitidos: {syncLive.skippedUnchangedChunks ?? 0}</span>
                <span>Duplicados detectados: {syncLive.duplicatesDetected ?? 0}</span>
                <span>WM updated_at: {formatSyncTimestamp(syncLive.watermark?.lastUpdatedAt)}</span>
                <span>WM source_id: {syncLive.watermark?.lastSourceId || '-'}</span>
                <span>WM registrado: {formatSyncTimestamp(syncLive.watermark?.updatedAt)}</span>
              </div>

              {syncLive.log && syncLive.log.length > 0 && (
                <pre
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {syncLive.log.join('\n')}
                </pre>
              )}
            </div>
          )}
        </div>
        )}
      </div>
    </section>
  )
}
