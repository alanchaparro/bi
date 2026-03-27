import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { Button, Input, Modal, Tabs, useOverlayState } from '@heroui/react'
import { useAuth } from '../../app/providers'
import { AnalyticsPageHeader } from '../../components/analytics/AnalyticsPageHeader'
import { ErrorState } from '../../components/feedback/ErrorState'
import { LoadingState } from '../../components/feedback/LoadingState'
import {
  api,
  createUser,
  createSyncSchedule,
  deleteSyncSchedule,
  emergencyResumeSchedules,
  emergencyStopSchedules,
  getMysqlConnectionConfig,
  getRoleNavMatrix,
  getSyncStatus,
  listSyncSchedules,
  listUsers,
  putRoleNavMatrix,
  restoreSession,
  pauseSyncSchedule,
  previewSync,
  resumeSyncSchedule,
  runSync,
  runSyncScheduleNow,
  saveMysqlConnectionConfig,
  testMysqlConnectionConfig,
  updateSyncSchedule,
  updateUser,
  type MysqlConnectionConfig,
  type SyncDomain,
  type SyncScheduleOut,
  type SyncStatusResponse,
  type UserItem,
} from '../../shared/api'
import { getApiErrorMessage } from '../../shared/apiErrors'
import { THEME_PRESETS, applyThemePreset, getStoredThemePresetId } from '../../shared/themePresets'

type Props = {
  onReloadBrokers?: () => Promise<void>
  onSyncLiveChange?: (state: SyncLive | null) => void
  onScheduleLiveChange?: (state: { runningCount: number; domains: string[]; progressPct?: number | null; lastUpdatedAt?: string | null } | null) => void
}

type SyncLive = {
  jobId?: string | null
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
type ScheduleRuntimeState = {
  running: boolean
  domain: SyncDomain | null
  progressPct: number | null
  stage: string | null
  statusMessage: string | null
}

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
type ConfigSection = 'usuarios' | 'rolesMenus' | 'negocio' | 'importaciones' | 'programacion'
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

function parseSyncDate(value?: string | null): Date | null {
  if (!value) return null
  const raw = String(value).trim()
  const normalized = /[zZ]|[+\-]\d{2}:\d{2}$/.test(raw) ? raw : `${raw}Z`
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatSyncTimestamp(value?: string | null): string {
  const date = parseSyncDate(value)
  if (!date) return value ? String(value) : '-'
  return date.toLocaleString()
}

function formatScheduleStage(stage?: string | null, statusMessage?: string | null): string {
  const raw = String(stage || '').trim().toLowerCase()
  const map: Record<string, string> = {
    queued: 'En cola',
    starting: 'Iniciando',
    connecting_mysql: 'Conectando',
    extracting: 'Leyendo',
    extract: 'Leyendo',
    normalizing: 'Normalizando',
    replacing_window: 'Preparando carga',
    upserting: 'Cargando',
    refresh_aggregates: 'Actualizando resumenes',
    finalize: 'Finalizando',
    completed: 'Completado',
    failed: 'Con error',
    cancelled: 'Cancelado',
  }
  if (raw && map[raw]) return map[raw]
  const msg = String(statusMessage || '').trim()
  if (!msg) return 'Procesando'
  return msg.length > 48 ? `${msg.slice(0, 48)}...` : msg
}

function formatScheduleRuntimeLabel(
  paused: boolean,
  lastRunStatus: string | null | undefined,
  runtime: ScheduleRuntimeState | undefined,
): string {
  if (paused) return 'Pausado'
  if (runtime?.running) {
    const domainPart = runtime.domain ? ` (${runtime.domain})` : ''
    const pctPart = typeof runtime.progressPct === 'number' ? ` ${runtime.progressPct}%` : ''
    const stagePart = ` - ${formatScheduleStage(runtime.stage, runtime.statusMessage)}`
    return `Corriendo${domainPart}${pctPart}${stagePart}`
  }
  if (lastRunStatus === 'failed') return 'Fallo ultima ejecucion'
  if (lastRunStatus === 'ok') return 'Listo'
  return 'Programado'
}

type ScheduleRuntimeTone = 'paused' | 'running' | 'failed' | 'ok' | 'idle'

function scheduleRuntimeTone(
  paused: boolean,
  lastRunStatus: string | null | undefined,
  runtime: ScheduleRuntimeState | undefined,
): ScheduleRuntimeTone {
  if (paused) return 'paused'
  if (runtime?.running) return 'running'
  if (lastRunStatus === 'failed') return 'failed'
  if (lastRunStatus === 'ok') return 'ok'
  return 'idle'
}

function formatScheduleLastRunSummary(summary: SyncScheduleOut['last_run_summary']): string {
  if (!summary || Array.isArray(summary) || typeof summary !== 'object') return 'Sin ejecucion previa'
  const data = summary as Record<string, unknown>
  const changed = Number(data.rows_changed_total ?? (Number(data.rows_inserted || 0) + Number(data.rows_updated || 0) + Number(data.rows_upserted || 0)))
  const unchanged = Number(data.rows_unchanged || 0)
  const read = Number(data.rows_read || 0)
  const skipped = Number(data.rows_skipped || 0)
  if (changed > 0) {
    return `Ultima ejecucion: ${changed.toLocaleString()} cargadas${unchanged > 0 ? `, ${unchanged.toLocaleString()} sin cambios` : ''}`
  }
  if (read > 0 || unchanged > 0 || skipped > 0) {
    return `Ultima ejecucion: sin datos nuevos${unchanged > 0 ? ` (${unchanged.toLocaleString()} sin cambios)` : ''}`
  }
  return 'Ultima ejecucion: sin datos nuevos'
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

export function ConfigView({ onReloadBrokers, onSyncLiveChange, onScheduleLiveChange }: Props) {
  const { auth, login } = useAuth()
  const canManageRoleNav = useMemo(
    () => (auth?.permissions ?? []).includes('brokers:write_config'),
    [auth?.permissions],
  )
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
  const [themePresetId, setThemePresetId] = useState<string>('epem_obsidiana')
  const [mysqlConfig, setMysqlConfig] = useState<MysqlConnectionConfig>({
    host: '',
    port: 3306,
    user: '',
    password: '',
    database: '',
    ssl_disabled: true,
  })

  const [schedules, setSchedules] = useState<SyncScheduleOut[]>([])
  const [scheduleRuntime, setScheduleRuntime] = useState<Record<number, ScheduleRuntimeState>>({})
  const [schedulesLoading, setSchedulesLoading] = useState(false)
  const [scheduleFormName, setScheduleFormName] = useState('')
  const [scheduleFormIntervalValue, setScheduleFormIntervalValue] = useState(10)
  const [scheduleFormIntervalUnit, setScheduleFormIntervalUnit] = useState<'minute' | 'hour' | 'day' | 'month'>('minute')
  const [scheduleFormDomains, setScheduleFormDomains] = useState<SyncDomain[]>(['cobranzas'])
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [scheduleActionLoading, setScheduleActionLoading] = useState<number | 'emergency' | null>(null)
  const emergencyStopConfirm = useOverlayState()
  const deleteScheduleConfirm = useOverlayState()
  const [schedulePendingDeleteId, setSchedulePendingDeleteId] = useState<number | null>(null)

  const [roleNavLoading, setRoleNavLoading] = useState(false)
  const [roleNavSaving, setRoleNavSaving] = useState(false)
  const [roleNavMessage, setRoleNavMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [roleNavDraft, setRoleNavDraft] = useState<Record<string, string[]>>({})
  const [roleNavMeta, setRoleNavMeta] = useState<{
    roles: string[]
    nav_items: { id: string; label: string }[]
  } | null>(null)

  const configTabEntries = useMemo(() => {
    const tabs: Array<[ConfigSection, string]> = [['usuarios', 'Usuarios']]
    if (canManageRoleNav) tabs.push(['rolesMenus', 'Roles y menús'])
    tabs.push(
      ['negocio', 'Configuración de negocio'],
      ['importaciones', 'Importaciones'],
      ['programacion', 'Programación'],
    )
    return tabs
  }, [canManageRoleNav])

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
    const parsed = parseSyncDate(syncLive?.lastUpdatedAt)
    if (!parsed) return false
    const ts = parsed.getTime()
    return (Date.now() - ts) <= 12000
  }, [syncLive?.lastUpdatedAt])
  const liveTone: SyncTagTone = isLiveFresh ? 'ok' : 'warn'

  useEffect(() => {
    setThemePresetId(getStoredThemePresetId())
  }, [])

  useEffect(() => {
    onSyncLiveChange?.(syncLive)
  }, [onSyncLiveChange, syncLive])

  useEffect(() => {
    const active = (schedules || [])
      .filter((schedule) => {
        const runtime = scheduleRuntime[schedule.id]
        return !schedule.paused && Boolean(runtime?.running)
      })
    if (!active.length) {
      onScheduleLiveChange?.(null)
      return
    }
    const domains = Array.from(
      new Set(
        active.map((schedule) => {
          const runtime = scheduleRuntime[schedule.id]
          return String(runtime?.domain || '').trim()
        }).filter((value) => value.length > 0),
      ),
    )
    onScheduleLiveChange?.({
      runningCount: active.length,
      domains,
      progressPct: active.length > 0
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(
                active.reduce((acc, schedule) => {
                  const runtime = scheduleRuntime[schedule.id]
                  return acc + Number(runtime?.progressPct || 0)
                }, 0) / active.length,
              ),
            ),
          )
        : null,
      lastUpdatedAt: new Date().toISOString(),
    })
  }, [onScheduleLiveChange, scheduleRuntime, schedules])

  const toggleDomain = useCallback((domain: SyncDomain, checked: boolean) => {
    setSelectedDomains((prev) => {
      if (checked) {
        if (prev.includes(domain)) return prev
        return [...prev, domain]
      }
      return prev.filter((d) => d !== domain)
    })
  }, [])

  const selectAllSyncDomains = useCallback(() => {
    setSelectedDomains(SYNC_DOMAINS.map((d) => d.value))
  }, [])

  const resetSyncDomainsDefault = useCallback(() => {
    setSelectedDomains(['analytics'])
  }, [])

  const applyThemeChoice = useCallback((presetId: string) => {
    setThemePresetId(presetId)
    applyThemePreset(presetId)
  }, [])

  const themeGroups = [
    {
      id: 'base',
      title: 'Familia base',
      subtitle: 'Variantes suaves para operación general y transición desde el tema actual.',
      presets: THEME_PRESETS.filter((preset) => preset.family === 'base'),
    },
    {
      id: 'premium',
      title: 'Familia premium / ejecutiva',
      subtitle: 'Versiones más sobrias, directivas y corporativas usando la misma paleta como base.',
      presets: THEME_PRESETS.filter((preset) => preset.family === 'premium'),
    },
  ] as const

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

  const loadRoleNav = useCallback(async () => {
    setRoleNavLoading(true)
    setRoleNavMessage(null)
    try {
      const data = await getRoleNavMatrix()
      setRoleNavMeta({ roles: data.roles, nav_items: data.nav_items })
      setRoleNavDraft({ ...data.nav_by_role })
    } catch (e: unknown) {
      setRoleNavMessage({ ok: false, text: getApiErrorMessage(e) })
    } finally {
      setRoleNavLoading(false)
    }
  }, [])

  const toggleRoleNav = useCallback((role: string, navId: string, checked: boolean) => {
    if (role === 'admin' && navId === 'config') return
    setRoleNavDraft((prev) => {
      const cur = [...(prev[role] ?? [])]
      const next = new Set(cur)
      if (checked) next.add(navId)
      else next.delete(navId)
      return { ...prev, [role]: [...next].sort() }
    })
  }, [])

  const handleSaveRoleNav = useCallback(async () => {
    if (!canManageRoleNav) return
    setRoleNavSaving(true)
    setRoleNavMessage(null)
    try {
      const payload: Record<string, string[]> = { ...roleNavDraft }
      const adminNav = [...new Set([...(payload.admin ?? []), 'config'])].sort()
      payload.admin = adminNav
      const data = await putRoleNavMatrix({ nav_by_role: payload })
      setRoleNavDraft({ ...data.nav_by_role })
      setRoleNavMeta({ roles: data.roles, nav_items: data.nav_items })
      const refreshed = await restoreSession()
      if (refreshed) login(refreshed, refreshed.access_token)
      setRoleNavMessage({
        ok: true,
        text: 'Menús por rol guardados. Tu sesión se actualizó; el resto de usuarios al refrescar token o volver a entrar.',
      })
    } catch (e: unknown) {
      setRoleNavMessage({ ok: false, text: getApiErrorMessage(e) })
    } finally {
      setRoleNavSaving(false)
    }
  }, [canManageRoleNav, roleNavDraft, login])

  const refreshScheduleRuntime = useCallback(async (list: SyncScheduleOut[]) => {
    const runtimeEntries = await Promise.all(
      (list || []).map(async (schedule) => {
        const domains = Array.isArray(schedule.domains) ? schedule.domains : []
        const checks = await Promise.all(
          domains.map(async (domain) => {
            try {
              const status = await getSyncStatus({ domain })
              return {
                domain,
                running: Boolean(status.running),
                progressPct: typeof status.progress_pct === 'number' ? Math.max(0, Math.min(100, Math.round(status.progress_pct))) : null,
                stage: status.stage ? String(status.stage) : null,
                statusMessage: status.status_message ? String(status.status_message) : null,
              }
            } catch {
              return { domain, running: false, progressPct: null, stage: null, statusMessage: null }
            }
          }),
        )
        const active = checks.find((item) => item.running)
        return [schedule.id, {
          running: Boolean(active),
          domain: active?.domain || null,
          progressPct: active?.progressPct ?? null,
          stage: active?.stage ?? null,
          statusMessage: active?.statusMessage ?? null,
        }] as const
      }),
    )
    setScheduleRuntime(Object.fromEntries(runtimeEntries))
  }, [])

  const loadSchedules = useCallback(async () => {
    setSchedulesLoading(true)
    try {
      const list = await listSyncSchedules()
      const safeList = list || []
      setSchedules(safeList)
      await refreshScheduleRuntime(safeList)
    } catch (e) {
      console.error(e)
      setScheduleRuntime({})
    } finally {
      setSchedulesLoading(false)
    }
  }, [refreshScheduleRuntime])

  const confirmEmergencyStop = useCallback(async () => {
    setScheduleActionLoading('emergency')
    try {
      await emergencyStopSchedules()
      await loadSchedules()
      emergencyStopConfirm.close()
    } catch (e) {
      console.error(e)
    } finally {
      setScheduleActionLoading(null)
    }
  }, [emergencyStopConfirm, loadSchedules])

  const confirmDeleteSchedule = useCallback(async () => {
    if (schedulePendingDeleteId === null) return
    setScheduleActionLoading(schedulePendingDeleteId)
    try {
      await deleteSyncSchedule(schedulePendingDeleteId)
      await loadSchedules()
      setSchedulePendingDeleteId(null)
      deleteScheduleConfirm.close()
    } catch (e) {
      console.error(e)
    } finally {
      setScheduleActionLoading(null)
    }
  }, [deleteScheduleConfirm, loadSchedules, schedulePendingDeleteId])

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

  const sectionDataLoadedRef = useRef<Partial<Record<ConfigSection, boolean>>>({})

  useEffect(() => {
    if (!canManageRoleNav && configSection === 'rolesMenus') {
      setConfigSection('usuarios')
    }
  }, [canManageRoleNav, configSection])

  useEffect(() => {
    const key = configSection
    const loaded = sectionDataLoadedRef.current
    if (key === 'usuarios' && !loaded.usuarios) {
      loaded.usuarios = true
      void loadUsers()
    }
    if (key === 'rolesMenus' && canManageRoleNav && !loaded.rolesMenus) {
      loaded.rolesMenus = true
      void loadRoleNav()
    }
    if (key === 'negocio' && !loaded.negocio) {
      loaded.negocio = true
      void loadTramoConfig()
    }
    if (key === 'importaciones' && !loaded.importaciones) {
      loaded.importaciones = true
      void loadMysqlConfig()
    }
    if (key === 'programacion' && !loaded.programacion) {
      loaded.programacion = true
      void loadSchedules()
    }
  }, [canManageRoleNav, configSection, loadMysqlConfig, loadRoleNav, loadSchedules, loadTramoConfig, loadUsers])

  useEffect(() => {
    if (configSection !== 'programacion') return
    if (!schedules.length) return
    const timer = window.setInterval(() => {
      void refreshScheduleRuntime(schedules)
    }, 8000)
    return () => window.clearInterval(timer)
  }, [configSection, schedules, refreshScheduleRuntime])

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
      setMysqlMessage({ ok: true, text: 'Configuración MySQL guardada.' })
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
      setUsersMessage({ ok: false, text: 'La contraseña debe tener al menos 6 caracteres.' })
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
            jobId: status.job_id || null,
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
              message: `[${domain}] Sin respuesta del estado de sincronización`,
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
        jobId: status.job_id || null,
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
      log: ['Estado: iniciando sincronización...'],
      progressPct: 1,
      stage: 'starting',
      message: 'Iniciando sincronización...',
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
              : domain === 'cobranzas'
                ? { sampled: true, sample_rows: 10000, timeout_seconds: 25 }
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
              globalLog.push(`[${domain}] preview deshabilitado por configuración; se continúa sin estimación`)
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
          if (/sincronización en curso|ya existe/i.test(msg)) {
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
        message: 'Sincronización finalizada',
      }))
      if (successfulDomains > 0) {
        if (skippedDomains.length > 0) {
          globalLog.push(`Dominios omitidos/error: ${Array.from(new Set(skippedDomains)).join(', ')}`)
        }
        setSyncResult({ rows: totalApplied, log: globalLog })
      } else if (skippedDomains.length > 0) {
        const errLine = globalLog.find((l) => l.includes(' ERROR: '))
        const errDetail = errLine ? (errLine.split(' ERROR: ')[1] || errLine).trim() : ''
        const errMsg = errDetail
          ? `No se pudo ejecutar ningun dominio. Omitidos/error: ${Array.from(new Set(skippedDomains)).join(', ')}. Detalle API: ${errDetail}`
          : `No se pudo ejecutar ningun dominio. Omitidos/error: ${Array.from(new Set(skippedDomains)).join(', ')}`
        setSyncResult({
          error: errMsg,
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

  const displayLog = syncLive?.log ?? syncResult?.log ?? []
  const displayError = syncLive?.error ?? syncResult?.error ?? null
  const displayDomain = syncLive?.currentDomain ?? (syncResult && selectedDomains.length > 0 ? selectedDomains.join(', ') : null)
  const displayJobId = syncLive?.jobId ?? null

  const handleExportLogTxt = useCallback(() => {
    const lines: string[] = [
      '=== Log de importación ===',
      `Generado: ${new Date().toLocaleString()}`,
      displayDomain ? `Dominio(s): ${displayDomain}` : '',
      displayJobId ? `Job ID: ${displayJobId}` : '',
      '',
    ].filter(Boolean)
    if (displayError) {
      lines.push('--- ERROR ---')
      lines.push(displayError)
      lines.push('')
    }
    lines.push('--- Registro ---')
    if (displayLog.length > 0) {
      lines.push(...displayLog)
    } else {
      lines.push('No hay entradas de log.')
    }
    const blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `log-importacion-${(displayDomain || 'sync').replace(/\s*,\s*/g, '-')}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [displayLog, displayError, displayDomain, displayJobId])

  return (
    <section className="card config-card">
      <AnalyticsPageHeader kicker="SISTEMA" title="Configuración" subtitle="Usuarios, roles y menús, negocio, importaciones y programación." />
      <div className="config-segmented-nav" role="tablist" aria-label="Subsecciones de configuración">
        {configTabEntries.map(([value, label]) => {
          const selected = configSection === value
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`config-segmented-nav__button ${selected ? 'is-active' : ''}`}
              onClick={() => setConfigSection(value)}
            >
              {label}
            </button>
          )
        })}
      </div>
      <Tabs
        selectedKey={configSection}
        onSelectionChange={(key) => key != null && setConfigSection(String(key) as ConfigSection)}
        className="config-tabs-heroui"
        aria-label="Subsecciones de configuración"
      >
        <Tabs.ListContainer>
          <Tabs.List>
            <Tabs.Tab id="usuarios">Usuarios</Tabs.Tab>
            {canManageRoleNav ? <Tabs.Tab id="rolesMenus">Roles y menús</Tabs.Tab> : null}
            <Tabs.Tab id="negocio">Configuración de negocio</Tabs.Tab>
            <Tabs.Tab id="importaciones">Importaciones</Tabs.Tab>
            <Tabs.Tab id="programacion">Programación</Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
      <div className="config-form-wrap">
        {configSection === 'negocio' && (
        <>
          <div>
            <h3 className="config-section-title">API</h3>
            <p className="config-muted-text config-no-margin">
              Base URL: <code>{baseUrl}</code>
            </p>
          </div>

          <div>
            <h3 className="config-section-title">Estado de conexión</h3>
            <div className="config-row-wrap-tight">
              <Button type="button" variant="outline" onPress={checkHealth} isDisabled={healthLoading}>
                {healthLoading ? 'Comprobando...' : 'Comprobar conexión'}
              </Button>
              {health && (
                <div className="config-label-col">
                  <span className={health.ok ? 'status-ok' : 'status-error'}>
                    {health.ok ? 'OK Conectado' : 'ERROR Sin conexión'}
                    {health.db_ok !== undefined && ` (DB: ${health.db_ok ? 'OK' : 'Error'})`}
                    {health.mysql_ok !== undefined && health.mysql_ok !== null && ` (MySQL: ${health.mysql_ok ? 'OK' : 'Error'})`}
                    {health.mysql_ok === null && ' (MySQL: no configurado)'}
                  </span>
                  {health.error ? (
                    <ErrorState
                      message={health.error}
                      className="config-alert-compact"
                      onRetry={() => void checkHealth()}
                      disabled={healthLoading}
                    />
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="config-section-title">Conexión MySQL (extracción)</h3>
            <p className="config-section-subtitle">
              Esta configuración se usa para extraer datos en sincronización.
            </p>
            <div className="config-grid-3 config-mt-xs">
              <label className="config-label-col">
                <span className="config-label-caption">Host</span>
                <input
                  className="input-heroui-tokens"
                  value={mysqlConfig.host}
                  onChange={(e) => setMysqlConfig((prev) => ({ ...prev, host: e.target.value }))}
                  placeholder="192.168.0.10"
                  disabled={mysqlLoading || mysqlSaving || mysqlTesting}
                />
              </label>
              <label className="config-label-col">
                <span className="config-label-caption">Puerto</span>
                <input
                  className="input-heroui-tokens"
                  type="number"
                  value={mysqlConfig.port}
                  onChange={(e) => setMysqlConfig((prev) => ({ ...prev, port: Number(e.target.value || 3306) }))}
                  placeholder="3306"
                  disabled={mysqlLoading || mysqlSaving || mysqlTesting}
                />
              </label>
              <label className="config-label-col">
                <span className="config-label-caption">Base</span>
                <input
                  className="input-heroui-tokens"
                  value={mysqlConfig.database}
                  onChange={(e) => setMysqlConfig((prev) => ({ ...prev, database: e.target.value }))}
                  placeholder="epem"
                  disabled={mysqlLoading || mysqlSaving || mysqlTesting}
                />
              </label>
              <label className="config-label-col">
                <span className="config-label-caption">Usuario</span>
                <input
                  className="input-heroui-tokens"
                  value={mysqlConfig.user}
                  onChange={(e) => setMysqlConfig((prev) => ({ ...prev, user: e.target.value }))}
                  placeholder="bi"
                  disabled={mysqlLoading || mysqlSaving || mysqlTesting}
                />
              </label>
              <label className="config-label-col">
                <span className="config-label-caption">Contraseña</span>
                <input
                  className="input-heroui-tokens"
                  type="password"
                  value={mysqlConfig.password}
                  onChange={(e) => setMysqlConfig((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="********"
                  disabled={mysqlLoading || mysqlSaving || mysqlTesting}
                />
              </label>
              <label className="config-check-row config-mt-lg">
                <input
                  type="checkbox"
                  checked={mysqlConfig.ssl_disabled}
                  onChange={(e) => setMysqlConfig((prev) => ({ ...prev, ssl_disabled: e.target.checked }))}
                  disabled={mysqlLoading || mysqlSaving || mysqlTesting}
                />
                <span>Desactivar SSL de MySQL</span>
              </label>
            </div>
            <div className="config-row-wrap-tight config-mt-sm">
              <Button type="button" variant="primary" onPress={() => void handleSaveMysqlConfig()} isDisabled={mysqlLoading || mysqlSaving || mysqlTesting}>
                {mysqlSaving ? 'Guardando...' : 'Guardar MySQL'}
              </Button>
              <Button type="button" variant="outline" onPress={() => void handleTestMysqlConfig()} isDisabled={mysqlLoading || mysqlSaving || mysqlTesting}>
                {mysqlTesting ? 'Probando...' : 'Probar MySQL'}
              </Button>
              <Button type="button" variant="outline" onPress={() => void loadMysqlConfig()} isDisabled={mysqlLoading || mysqlSaving || mysqlTesting}>
                {mysqlLoading ? 'Cargando...' : 'Recargar MySQL'}
              </Button>
              {mysqlMessage && (
                <span className={mysqlMessage.ok ? 'status-ok' : 'status-error'}>
                  {mysqlMessage.text}
                </span>
              )}
            </div>
          </div>
        </>
        )}

        {configSection === 'rolesMenus' && canManageRoleNav && (
        <div>
          <h3 className="config-section-title">Roles y menús laterales</h3>
          <p className="config-section-subtitle">
            Define qué entradas del menú principal ve cada rol. Los permisos de API (exportar datos, guardar importaciones, etc.) siguen definidos por el rol en el servidor.
          </p>
          {roleNavLoading && !roleNavMeta ? (
            <LoadingState message="Cargando matriz de menús..." className="config-mt-md max-w-md" />
          ) : roleNavMeta ? (
            <>
              <div className="overflow-x-auto config-mt-md">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border-b border-[var(--glass-border)] p-2 text-left font-semibold">Menú</th>
                      {roleNavMeta.roles.map((r) => (
                        <th key={r} className="border-b border-[var(--glass-border)] p-2 text-center font-semibold capitalize">
                          {r}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {roleNavMeta.nav_items.map((item) => (
                      <tr key={item.id}>
                        <td className="border-b border-[var(--glass-border)] p-2">{item.label}</td>
                        {roleNavMeta.roles.map((role) => {
                          const locked = role === 'admin' && item.id === 'config'
                          const checked = locked || (roleNavDraft[role]?.includes(item.id) ?? false)
                          return (
                            <td key={`${role}-${item.id}`} className="border-b border-[var(--glass-border)] p-2 text-center">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-[var(--color-primary)]"
                                aria-label={`${role}: ${item.label}`}
                                checked={checked}
                                disabled={locked || roleNavSaving || roleNavLoading}
                                onChange={(e) => toggleRoleNav(role, item.id, e.target.checked)}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="config-row-wrap-tight config-mt-md">
                <Button type="button" variant="primary" onPress={() => void handleSaveRoleNav()} isDisabled={roleNavSaving || roleNavLoading}>
                  {roleNavSaving ? 'Guardando...' : 'Guardar menús por rol'}
                </Button>
                <Button type="button" variant="outline" onPress={() => void loadRoleNav()} isDisabled={roleNavSaving || roleNavLoading}>
                  {roleNavLoading ? 'Cargando...' : 'Recargar'}
                </Button>
                {roleNavMessage ? (
                  <span className={roleNavMessage.ok ? 'status-ok' : 'status-error'}>{roleNavMessage.text}</span>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
        )}

        {configSection === 'usuarios' && (
        <div>
          <h3 className="config-section-title">Usuarios y Roles</h3>
          <p className="config-section-subtitle">
            Crear usuarios, asignar rol y activar/desactivar acceso.
          </p>

          <div className="config-grid-3 config-mt-md">
            <label className="config-label-col">
              <span className="config-label-caption">Username</span>
              <input
                className="input-heroui-tokens"
                value={newUsername}
                placeholder="ej: operador1"
                onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                disabled={usersBusy}
              />
            </label>

            <label className="config-label-col">
              <span className="config-label-caption">Contraseña</span>
              <input
                className="input-heroui-tokens"
                type="password"
                value={newPassword}
                placeholder="min. 6 caracteres"
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={usersBusy}
              />
            </label>

            <label className="config-label-col">
              <span className="config-label-caption">Rol</span>
              <select className="input-heroui-tokens" value={newRole} onChange={(e) => setNewRole((e.target.value as RoleType) || 'viewer')} disabled={usersBusy}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="config-row-wrap config-mt-sm">
            <label className="config-check-row">
              <input type="checkbox" checked={newIsActive} onChange={(e) => setNewIsActive(e.target.checked)} disabled={usersBusy} />
              <span>Activo</span>
            </label>
            <Button type="button" variant="primary" onPress={() => void handleCreateUser()} isDisabled={usersBusy}>
              {usersSaving ? 'Guardando...' : 'Crear usuario'}
            </Button>
            <Button type="button" variant="outline" onPress={() => void loadUsers()} isDisabled={usersBusy}>
              {usersLoading ? 'Cargando...' : 'Recargar usuarios'}
            </Button>
            {usersMessage && (
              <span className={usersMessage.ok ? 'status-ok' : 'status-error'}>
                {usersMessage.text}
              </span>
            )}
          </div>

          <div className="config-list-wrap">
            {users.length === 0 ? (
              <p className="config-section-subtitle config-no-margin">
                Sin usuarios en base de datos.
              </p>
            ) : (
              users.map((u) => (
                <div key={u.username} className="config-grid-3 config-items-center">
                  <input className="input-heroui-tokens" value={u.username} readOnly />

                  <select
                    className="input-heroui-tokens"
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

                  <div className="config-row-wrap-tight">
                    <label className="config-check-row config-check-row-tight">
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
                      className="input-heroui-tokens"
                      type="password"
                      placeholder="Nueva contraseña (opcional)"
                      value={rowPasswordDraft[u.username] || ''}
                      onChange={(e) => setRowPasswordDraft((prev) => ({ ...prev, [u.username]: e.target.value }))}
                      disabled={usersBusy}
                    />
                    <Button type="button" variant="outline" onPress={() => void handleUpdateUser(u)} isDisabled={usersBusy}>
                      Guardar
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        )}

        {configSection === 'negocio' && (
        <div>
          <h3 className="config-section-title">Apariencia del sistema</h3>
          <p className="config-section-subtitle">
            Temas pensados con teoría de color para priorizar legibilidad, jerarquía y fatiga visual baja en operación.
          </p>

          <div className="config-theme-groups config-mt-md config-mb-md">
            {themeGroups.map((group) => (
              <section key={group.id} className="config-theme-group">
                <div className="config-theme-group-header">
                  <h4 className="config-theme-group-title">{group.title}</h4>
                  <p className="config-theme-group-note">{group.subtitle}</p>
                </div>
                <div className="config-theme-grid">
                  {group.presets.map((preset) => {
                    const selected = themePresetId === preset.id
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={`config-theme-card ${selected ? 'is-active' : ''}`}
                        onClick={() => applyThemeChoice(preset.id)}
                        aria-pressed={selected}
                      >
                        <div className="config-theme-card-top">
                          <div>
                            <strong>{preset.label}</strong>
                            <span>{preset.description}</span>
                          </div>
                          <span className="config-theme-mode">{preset.mode === 'dark' ? 'Oscuro' : 'Claro'}</span>
                        </div>
                        <div className="config-theme-swatches" aria-hidden="true">
                          {preset.swatches.map((color) => (
                            <span key={`${preset.id}-${color}`} className="config-theme-swatch" style={{ backgroundColor: color }} />
                          ))}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>

          <h3 className="config-section-title">Reglas de Tramo por Unidad de Negocio</h3>
          <p className="config-section-subtitle">
            Elige varios tramos + Unidad de Negocio + Categoria, luego agrega la regla.
          </p>

          <div className="config-grid-3 config-mt-md">
            <label className="config-label-col">
              <span className="config-label-caption">Unidad de Negocio</span>
              <input
                className="input-heroui-tokens"
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

            <label className="config-label-col">
              <span className="config-label-caption">Categoria</span>
              <select className="input-heroui-tokens" value={ruleCategory} onChange={(e) => setRuleCategory(e.target.value === 'MOROSO' ? 'MOROSO' : 'VIGENTE')}>
                <option value="VIGENTE">VIGENTE</option>
                <option value="MOROSO">MOROSO</option>
              </select>
            </label>

            <Button type="button" variant="outline" className="config-full-mobile" onPress={upsertRule} isDisabled={configBusy}>
              Agregar/Actualizar
            </Button>
          </div>

          <div className="config-mt-md">
            <span className="config-label-caption">Tramos (multiple)</span>
            <div className="config-row-wrap config-mt-2xs">
              {TRAMO_OPTIONS.map((t) => (
                <label key={t} className="config-check-row config-check-row-tight">
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

          <div className="config-row-wrap-tight config-mt-md">
            <Button type="button" variant="primary" onPress={saveTramoRules} isDisabled={configBusy}>
              {tramoConfigSaving ? 'Guardando...' : 'Guardar reglas'}
            </Button>
            <Button type="button" variant="outline" onPress={() => void loadTramoConfig()} isDisabled={configBusy}>
              {tramoConfigLoading ? 'Cargando...' : 'Recargar reglas'}
            </Button>
            {tramoConfigMessage && (
              <span className={tramoConfigMessage.ok ? 'status-ok' : 'status-error'}>
                {tramoConfigMessage.text}
              </span>
            )}
          </div>

          <div className="config-mt-md">
            {tramoRules.length === 0 ? (
              <p className="config-section-subtitle config-no-margin">
                Sin reglas por UN.
              </p>
            ) : (
              <div className="config-grid-gap-sm">
                {tramoRules
                  .slice()
                  .sort((a, b) => (a.un + a.category).localeCompare(b.un + b.category))
                  .map((r) => (
                    <div key={`${r.un}-${r.category}`} className="config-grid-3">
                      <input className="input-heroui-tokens" value={r.un} readOnly />
                      <input className="input-heroui-tokens" value={`${r.category}: ${r.tramos.join(', ') || '-'}`} readOnly />
                      <Button type="button" variant="outline" className="config-full-mobile" onPress={() => removeRule(r.un, r.category)} isDisabled={configBusy}>
                        Quitar
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
        )}

        {configSection === 'importaciones' && (
        <div>
          <h3 className="config-section-title">Carga dual SQL</h3>

          <div className="config-stack-xs config-mb-md">
            <span className="config-label-caption">Dominios SQL (multiple)</span>
            <div className="config-row-wrap">
              {SYNC_DOMAINS.map((d) => (
                <label key={d.value} className="config-check-row">
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
            <div className="config-row-wrap-tight config-mt-2xs">
              <Button type="button" variant="outline" size="sm" onPress={selectAllSyncDomains} isDisabled={busy}>
                Seleccionar todos los dominios
              </Button>
              <Button type="button" variant="outline" size="sm" onPress={resetSyncDomainsDefault} isDisabled={busy}>
                Solo Analytics (por defecto)
              </Button>
            </div>
            <p className="config-section-subtitle config-mt-2xs config-no-margin">
              Para traer todo en una pasada, usá «Seleccionar todos los dominios»; si el volumen es alto, el sistema pedirá confirmación antes de continuar. Cartera exige rango de cierre (mes/año desde–hasta).
            </p>
          </div>

          <div className="config-stack-sm config-stack-sm-max">
            <div className="config-row-wrap">
              <label className="config-label-col config-minw-140">
                <span className="config-label-caption">Mes cierre desde (cartera)</span>
                <input
                  className="input-heroui-tokens"
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="MM"
                  value={closeMonthFromPart}
                  onChange={(e) => setCloseMonthFromPart(e.target.value.replace(/[^0-9]/g, ''))}
                />
              </label>
              <label className="config-label-col config-minw-140">
                <span className="config-label-caption">Mes cierre hasta (cartera)</span>
                <input
                  className="input-heroui-tokens"
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="MM"
                  value={closeMonthToPart}
                  onChange={(e) => setCloseMonthToPart(e.target.value.replace(/[^0-9]/g, ''))}
                />
              </label>
            </div>
            <div className="config-row-wrap">
              <label className="config-label-col config-minw-140">
                <span className="config-label-caption">Año cierre desde (cartera)</span>
                <input
                  className="input-heroui-tokens"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="YYYY"
                  value={closeYearFromPart}
                  onChange={(e) => setCloseYearFromPart(e.target.value.replace(/[^0-9]/g, ''))}
                />
              </label>
              <label className="config-label-col config-minw-140">
                <span className="config-label-caption">Año cierre hasta (cartera)</span>
                <input
                  className="input-heroui-tokens"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="YYYY"
                  value={closeYearToPart}
                  onChange={(e) => setCloseYearToPart(e.target.value.replace(/[^0-9]/g, ''))}
                />
              </label>
            </div>
          </div>

          <p className="config-section-subtitle config-mt-sm">
            Modo de carga: <strong>{modeLabel}</strong>
          </p>
          {allDomainsSelected && (
            <p className="config-warn-text">
              Modo masivo: se ejecutara en cola estricta (1 dominio por vez) para proteger RAM/CPU.
            </p>
          )}

          <div className="config-row-wrap-tight">
            <Button type="button" variant="primary" onPress={handleSync} isDisabled={busy}>
              {syncLoading ? 'Sincronizando...' : 'Ejecutar carga'}
            </Button>
            <Button type="button" variant="outline" onPress={handleReload} isDisabled={busy}>
              {reloadLoading ? 'Recargando...' : 'Recargar vista'}
            </Button>
              {showSyncResult && syncResult && (
              <span className={syncResult.error ? 'status-error' : 'status-ok'}>
                {syncResult.error
                  ? `ERROR ${syncResult.error}`
                  : Number(syncResult.rows || 0) > 0
                    ? `OK ${syncResult.rows ?? 0} filas cargadas`
                    : 'OK sincronización completada (sin cambios)'}
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
                  <Button type="button" variant="outline" onPress={() => setMassiveConfirmOpen(false)} isDisabled={syncLoading}>
                    Cancelar
                  </Button>
                  <Button type="button" variant="primary" onPress={handleConfirmMassiveSync} isDisabled={syncLoading}>
                    Confirmar y continuar
                  </Button>
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
                  aria-label="Progreso de sincronización"
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
                    <span className={toneClass('info')}>Últ. actualización: <strong>{lastUpdatedLabel}</strong></span>
                    <span className={toneClass('info')}>Dominio: <strong>{syncDomainLabel}</strong></span>
                    <span className={toneClass('info')}>Query: <code>{syncQueryFile}</code></span>
                    <span className={toneClass('info')}>Etapa: <strong>{syncLive.jobStep || syncLive.stage || '-'}</strong></span>
                    <span className={toneClass((syncLive.etaSeconds && syncLive.etaSeconds > 0) ? 'warn' : 'ok')}>ETA: <strong>{syncLive.etaSeconds && syncLive.etaSeconds > 0 ? `${syncLive.etaSeconds}s` : '-'}</strong></span>
                    <span className={toneClass(throughputTone)}>Throughput: <strong>{syncLive.throughputRowsPerSec ? `${syncLive.throughputRowsPerSec.toFixed(1)} filas/s` : '-'}</strong></span>
                    <span className={toneClass(queueTone)}>Cola: <strong>{typeof syncLive.queuePosition === 'number' ? syncLive.queuePosition : '-'}</strong></span>
                    <span className={toneClass(chunkTone)}>Chunk: <strong>{syncLive.chunkStatus || '-'}</strong></span>
                    <span className={`${toneClass(chunkTone)} sync-progress-tag--long`} title={syncLive.chunkKey || '-'}>
                      Chunk key: <code>{syncLive.chunkKey || '-'}</code>
                    </span>
                    <span className={toneClass(watermarkTone)}>Watermark: <code>{syncLive.watermark?.partitionKey || '-'}</code></span>
                  </div>
                </div>
              </div>

              {syncLive.running ? (
                <p className="config-section-subtitle config-mt-sm config-no-margin" role="status" aria-live="polite">
                  {syncPercent < 5
                    ? 'Es normal ver varios minutos en 0% al inicio (estimación de volumen o conexión a MySQL). Si «Últ. actualización» no cambia en un tiempo prolongado, puede haber un corte de red o de base; consultá con operaciones o TI.'
                    : 'Importación en curso. El porcentaje refleja el avance reportado por el servidor.'}
                </p>
              ) : null}

              <div className="config-meta">
                Avance general
              </div>
              <div className="config-progress-track">
                <div
                  className="config-progress-bar"
                  style={{ width: `${syncPercent}%` }}
                />
              </div>

              <div className="config-meta-block">
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
            </div>
          )}

          <div className="sync-logs-section config-mt-xl">
            <h3 className="config-section-title">Logs de importación</h3>
            <p className="config-section-subtitle config-mb-sm">
              Registro de la última ejecución. Si hubo errores, aparecen aquí. Puedes exportar todo a un archivo TXT.
            </p>
            {displayError ? (
              <ErrorState
                message={`Error: ${displayError}`}
                className="config-import-log-alert"
              />
            ) : null}
            <pre className="sync-logs-pre">
              {displayLog.length > 0 ? displayLog.join('\n') : 'No hay entradas de log aún. Ejecuta una carga para ver el registro aquí.'}
            </pre>
            <Button
              type="button"
              variant="outline"
              onPress={handleExportLogTxt}
              isDisabled={displayLog.length === 0 && !displayError}
            >
              Exportar a TXT
            </Button>
          </div>
        </div>
        )}

        {configSection === 'programacion' && (
        <div>
          <h3 className="config-section-title">Programación de importaciones</h3>
          <p className="config-section-subtitle">
            Programe ejecuciones automáticas por intervalo (mínimo 10 minutos). Parar todo detiene todos los cron y cancela jobs pendientes.
          </p>

          <div className="config-actions-row">
            <Button
              type="button"
              variant="primary"
              onPress={() => emergencyStopConfirm.open()}
              isDisabled={scheduleActionLoading === 'emergency'}
            >
              {scheduleActionLoading === 'emergency' ? 'Parando...' : 'Parar todo (emergencia)'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onPress={async () => {
                setScheduleActionLoading('emergency')
                try {
                  await emergencyResumeSchedules()
                  await loadSchedules()
                } catch (e) {
                  console.error(e)
                } finally {
                  setScheduleActionLoading(null)
                }
              }}
              isDisabled={scheduleActionLoading === 'emergency'}
            >
              {scheduleActionLoading === 'emergency' ? 'Reanudando...' : 'Reanudar todo'}
            </Button>
            <Button type="button" variant="outline" onPress={loadSchedules} isDisabled={schedulesLoading}>
              {schedulesLoading ? 'Cargando...' : 'Actualizar lista'}
            </Button>
          </div>

          <div className="config-stack-md config-stack-md--schedule-list">
            {schedulesLoading ? (
              <LoadingState message="Cargando programaciones..." className="config-mb-sm" />
            ) : null}
            {schedules.length === 0 && !schedulesLoading ? (
              <p className="config-muted-text">No hay programaciones. Cree una abajo.</p>
            ) : null}
            {schedules.map((s) => (
              <div key={s.id} className="schedule-card">
                {(() => {
                  const runtime = scheduleRuntime[s.id]
                  const runtimeLabel = formatScheduleRuntimeLabel(s.paused, s.last_run_status, runtime)
                  const tone = scheduleRuntimeTone(s.paused, s.last_run_status, runtime)
                  return (
                    <>
                <span
                  className={`schedule-dot schedule-dot--${tone}`}
                  title={runtimeLabel}
                  aria-hidden
                />
                <span className="schedule-name">{s.name}</span>
                <span className="config-inline-meta">
                  cada {s.interval_value} {s.interval_unit === 'minute' ? 'min' : s.interval_unit === 'hour' ? 'h' : s.interval_unit === 'day' ? 'días' : 'meses'}
                </span>
                <span className="config-inline-meta">
                  Dominios: {Array.isArray(s.domains) ? s.domains.join(', ') : '-'}
                </span>
                <span className="config-inline-meta">
                  Última: {s.last_run_at ? formatSyncTimestamp(s.last_run_at) : '-'}
                </span>
                <span className="config-inline-meta">
                  Próxima: {s.next_run_at ? formatSyncTimestamp(s.next_run_at) : '-'}
                </span>
                <span className={`schedule-runtime-label schedule-runtime-label--${tone}`}>
                  {runtimeLabel}
                </span>
                <span className="config-inline-meta">
                  {formatScheduleLastRunSummary(s.last_run_summary)}
                </span>
                <div className="schedule-actions">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    isDisabled={scheduleActionLoading !== null}
                    onPress={async () => {
                      setScheduleActionLoading(s.id)
                      try {
                        await runSyncScheduleNow(s.id)
                        await loadSchedules()
                      } catch (e) {
                        console.error(e)
                      } finally {
                        setScheduleActionLoading(null)
                      }
                    }}
                  >
                    Ejecutar ahora
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    isDisabled={scheduleActionLoading !== null}
                    onPress={async () => {
                      setScheduleActionLoading(s.id)
                      try {
                        if (s.paused) await resumeSyncSchedule(s.id)
                        else await pauseSyncSchedule(s.id)
                        await loadSchedules()
                      } catch (e) {
                        console.error(e)
                      } finally {
                        setScheduleActionLoading(null)
                      }
                    }}
                  >
                    {s.paused ? 'Reanudar' : 'Pausar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    isDisabled={scheduleActionLoading !== null}
                    aria-label="Eliminar esta programación"
                    onPress={() => {
                      setSchedulePendingDeleteId(s.id)
                      deleteScheduleConfirm.open()
                    }}
                  >
                    Eliminar
                  </Button>
                </div>
                    </>
                  )
                })()}
              </div>
            ))}
          </div>

          <h4 className="config-section-title config-subtitle-sm">Nueva programación</h4>
          <div className="config-stack-sm config-stack-sm-max">
            <div className="config-label-col">
              <label htmlFor="config-schedule-name" className="config-label-caption">Nombre</label>
              <Input
                id="config-schedule-name"
                className="border border-[var(--color-border)] bg-[var(--input-bg)]"
                value={scheduleFormName}
                onChange={(e) => setScheduleFormName(e.target.value)}
                placeholder="Ej: Carga horaria"
                disabled={scheduleSaving}
                aria-label="Nombre de la programación"
              />
            </div>
            <div className="config-row-wrap">
              <div className="config-label-col">
                <label htmlFor="config-schedule-interval" className="config-label-caption">Cada</label>
                <Input
                  id="config-schedule-interval"
                  type="number"
                  min={10}
                  className="border border-[var(--color-border)] bg-[var(--input-bg)]"
                  value={String(scheduleFormIntervalValue)}
                  onChange={(e) => setScheduleFormIntervalValue(Math.max(10, Number(e.target.value) || 10))}
                  disabled={scheduleSaving}
                  aria-label="Intervalo numérico"
                />
              </div>
              <label className="config-label-col">
                <span className="config-label-caption">Unidad</span>
                <select
                  className="input-heroui-tokens"
                  value={scheduleFormIntervalUnit}
                  onChange={(e) => setScheduleFormIntervalUnit(e.target.value as 'minute' | 'hour' | 'day' | 'month')}
                  disabled={scheduleSaving}
                  aria-label="Unidad de intervalo"
                >
                  <option value="minute">Minutos (mín. 10)</option>
                  <option value="hour">Horas</option>
                  <option value="day">Días</option>
                  <option value="month">Meses</option>
                </select>
              </label>
            </div>
            <div className="config-stack-sm">
              <span className="config-label-caption">Dominios</span>
              <div className="config-row-wrap-tight">
                {SYNC_DOMAINS.map((d) => (
                  <label key={d.value} className="config-check-row">
                    <input
                      type="checkbox"
                      checked={scheduleFormDomains.includes(d.value)}
                      onChange={(e) => {
                        if (e.target.checked) setScheduleFormDomains((prev) => [...prev, d.value])
                        else setScheduleFormDomains((prev) => prev.filter((x) => x !== d.value))
                      }}
                      disabled={scheduleSaving}
                    />
                    <span>{d.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button
              type="button"
              variant="primary"
              isDisabled={scheduleSaving || !scheduleFormName.trim() || scheduleFormDomains.length === 0 || (scheduleFormIntervalUnit === 'minute' && scheduleFormIntervalValue < 10)}
              onPress={async () => {
                setScheduleSaving(true)
                try {
                  await createSyncSchedule({
                    name: scheduleFormName.trim(),
                    interval_value: scheduleFormIntervalUnit === 'minute' ? Math.max(10, scheduleFormIntervalValue) : scheduleFormIntervalValue,
                    interval_unit: scheduleFormIntervalUnit,
                    domains: scheduleFormDomains,
                  })
                  setScheduleFormName('')
                  setScheduleFormIntervalValue(10)
                  setScheduleFormDomains(['cobranzas'])
                  await loadSchedules()
                } catch (e) {
                  console.error(e)
                } finally {
                  setScheduleSaving(false)
                }
              }}
            >
              {scheduleSaving ? 'Creando...' : 'Crear programación'}
            </Button>
          </div>
        </div>
        )}
      </div>
      <Modal state={emergencyStopConfirm}>
        <Modal.Backdrop />
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Confirmar parada de emergencia</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              Esta acción detiene todas las programaciones y cancela jobs pendientes. ¿Seguro que querés continuar?
            </Modal.Body>
            <Modal.Footer className="config-actions-row">
              <Button
                variant="outline"
                onPress={() => emergencyStopConfirm.close()}
                isDisabled={scheduleActionLoading === 'emergency'}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                onPress={confirmEmergencyStop}
                isDisabled={scheduleActionLoading === 'emergency'}
              >
                {scheduleActionLoading === 'emergency' ? 'Parando...' : 'Parar todo'}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal>
      <Modal state={deleteScheduleConfirm}>
        <Modal.Backdrop />
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Confirmar eliminación</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              Esta acción elimina la programación seleccionada y no se puede deshacer. ¿Deseás continuar?
            </Modal.Body>
            <Modal.Footer className="config-actions-row">
              <Button
                variant="outline"
                onPress={() => {
                  setSchedulePendingDeleteId(null)
                  deleteScheduleConfirm.close()
                }}
                isDisabled={typeof scheduleActionLoading === 'number'}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                onPress={confirmDeleteSchedule}
                isDisabled={schedulePendingDeleteId === null || typeof scheduleActionLoading === 'number'}
              >
                {typeof scheduleActionLoading === 'number' ? 'Eliminando...' : 'Eliminar programación'}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal>
    </section>
  )
}
