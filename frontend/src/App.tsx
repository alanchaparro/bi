import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  clearAnalyticsApiCache,
  login,
  markPerfRoute,
  logout,
  restoreSession,
  setAuthToken,
  setOnUnauthorized,
  USE_UI_IOS_REFINEMENT,
  UI_IOS_REFINEMENT_MODULES,
} from './shared/api'
import type {
  LoginRequest,
  LoginResponse,
} from './shared/contracts'
import { setStoredRefreshToken } from './shared/sessionStorage'
import { getApiErrorMessage } from './shared/apiErrors'
import { LoginView } from './modules/auth/LoginView'
import { NAV_SECTIONS } from './config/navSections'
import { SidebarNav } from './components/SidebarNav'
import { ErrorState } from './components/feedback/ErrorState'
import { ConfigView } from './modules/config/ConfigView'
import { AnalisisCarteraView } from './modules/analisisCartera/AnalisisCarteraView'
import { AnalisisCobranzasCohorteView } from './modules/analisisCobranzasCohorte/AnalisisCobranzasCohorteView'
import { AnalisisRendimientoView } from './modules/analisisRendimiento/AnalisisRendimientoView'
import { AnalisisAnualesView } from './modules/analisisAnuales/AnalisisAnualesView'
import {
  applyThemePreset,
  cycleDarkThemePresetId,
  DARK_THEME_QUICK_BADGE,
  getStoredThemePresetId,
  getThemePresetById,
} from './shared/themePresets'
import { DomButton } from '@/components/ui/DomButton'
import { Tooltip } from '@heroui/react'

type GlobalSyncLive = {
  running?: boolean
  currentDomain?: string | null
  progressPct?: number
  message?: string
  currentQueryFile?: string | null
  etaSeconds?: number | null
  jobStep?: string | null
  queuePosition?: number | null
  chunkKey?: string | null
  chunkStatus?: string | null
  skippedUnchangedChunks?: number
  error?: string | null
  lastUpdatedAt?: string | null
}

type GlobalScheduleLive = {
  runningCount: number
  domains: string[]
  progressPct?: number | null
  lastUpdatedAt?: string | null
}

export default function App() {
  const [themePresetId, setThemePresetId] = useState<string>(() => getStoredThemePresetId())
  const [auth, setAuth] = useState<LoginResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [activeSectionId, setActiveSectionId] = useState<string>('analisisCartera')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [globalSyncLive, setGlobalSyncLive] = useState<GlobalSyncLive | null>(null)
  const [globalScheduleLive, setGlobalScheduleLive] = useState<GlobalScheduleLive | null>(null)

  const role = auth?.role ?? ''
  const globalSyncPct = Math.max(0, Math.min(100, Math.round(globalSyncLive?.progressPct || 0)))
  const globalSyncQuery = globalSyncLive?.currentQueryFile || '-'
  const showGlobalSync = Boolean(globalSyncLive?.running)
  const headerLiveFresh = (() => {
    // Si hay una sincronización/planificación activa, se considera "en vivo"
    // aunque el timestamp no se haya refrescado todavía.
    if (showGlobalSync || Boolean((globalScheduleLive?.runningCount || 0) > 0)) return true
    const ts = globalSyncLive?.lastUpdatedAt ? new Date(globalSyncLive.lastUpdatedAt).getTime() : Number.NaN
    if (Number.isNaN(ts)) return false
    return (Date.now() - ts) <= 90000
  })()
  const headerLiveLabel = headerLiveFresh ? 'En vivo' : 'Desfasado'
  const globalSyncTone = globalSyncLive?.error
    ? 'error'
    : globalSyncLive?.chunkStatus === 'changed'
      ? 'ok'
      : globalSyncLive?.chunkStatus === 'unchanged'
        ? 'warn'
        : 'info'
  const showScheduleLive = Boolean((globalScheduleLive?.runningCount || 0) > 0)
  const schedulePct = Math.max(0, Math.min(100, Math.round(globalScheduleLive?.progressPct || 0)))
  const scheduleDomainLabel = String(globalScheduleLive?.domains?.[0] || '').trim()
  const scheduleTooltip = scheduleDomainLabel
    ? `Actualización de ${scheduleDomainLabel} en progreso${schedulePct > 0 ? ` (${schedulePct}%)` : ''}`
    : `Actualización en progreso${schedulePct > 0 ? ` (${schedulePct}%)` : ''}`

  const syncPillTooltip =
    `${globalSyncLive?.message || 'Sincronizando...'}`
    + ` | ${globalSyncPct}%`
    + ` | ${globalSyncLive?.jobStep || '-'}`
    + ` | ETA ${globalSyncLive?.etaSeconds ?? '-'}s`
    + ` | Cola ${typeof globalSyncLive?.queuePosition === 'number' ? globalSyncLive.queuePosition : '-'}`
    + ` | Chunk ${globalSyncLive?.chunkStatus || '-'}`
    + ` | Skipped ${globalSyncLive?.skippedUnchangedChunks ?? 0}`
    + ` | ${globalSyncQuery}`
    + ` | Estado ${headerLiveLabel}`

  const handleLogin = useCallback(async (payload: LoginRequest) => {
    setLoginError(null)
    setError('')
    const authRes = await login(payload)
    setAuthToken(authRes.access_token)
    if (authRes.refresh_token) setStoredRefreshToken(authRes.refresh_token)
    setAuth(authRes)
    setActiveSectionId('analisisCartera')
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
    document.body.classList.toggle('sidebar-open', sidebarOpen)
    return () => document.body.classList.remove('sidebar-open')
  }, [sidebarOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    applyThemePreset(themePresetId)
    if (USE_UI_IOS_REFINEMENT) {
      document.documentElement.setAttribute('data-ui-refinement', 'ios')
      document.documentElement.setAttribute('data-ui-refinement-modules', UI_IOS_REFINEMENT_MODULES || 'all')
    } else {
      document.documentElement.removeAttribute('data-ui-refinement')
      document.documentElement.removeAttribute('data-ui-refinement-modules')
    }
  }, [themePresetId])

  const prevSyncRunningRef = useRef<boolean | null>(null)
  useEffect(() => {
    const wasRunning = prevSyncRunningRef.current
    const isRunning = Boolean(globalSyncLive?.running)
    prevSyncRunningRef.current = isRunning
    if (wasRunning === true && !isRunning) {
      clearAnalyticsApiCache()
    }
  }, [globalSyncLive?.running])

  useEffect(() => {
    const boot = async () => {
      try {
        const restored = await restoreSession()
        if (restored) {
          setError('')
          setAuth(restored)
          setActiveSectionId('analisisCartera')
        }
      } catch {
        // restoreSession already clears on failure
      } finally {
        setLoading(false)
      }
    }
    void boot()
  }, [])

  useEffect(() => {
    const routeMap: Record<string, 'cartera' | 'cohorte' | 'rendimiento' | 'anuales' | 'brokers'> = {
      analisisCartera: 'cartera',
      analisisCobranzaCohorte: 'cohorte',
      analisisCarteraRendimiento: 'rendimiento',
      analisisCarteraAnuales: 'anuales',
      config: 'brokers',
    }
    const route = routeMap[activeSectionId]
    if (route) markPerfRoute(route)
  }, [activeSectionId])

  if (loading) {
    return <div className="loading-page">Cargando aplicación...</div>
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
    <>
      <SidebarNav
        sections={[...NAV_SECTIONS]}
        activeId={activeSectionId}
        onSelect={setActiveSectionId}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        onCloseSidebar={() => setSidebarOpen(false)}
      />
      <div className="app-shell">
        <header className="app-header">
          <div className="app-header-title-wrap">
            <h1>EPEM - Cartera de Cobranzas</h1>
          </div>
          <div className="user-info">
            {showScheduleLive ? (
              <Tooltip delay={400} closeDelay={0}>
                <Tooltip.Trigger>
                  <DomButton
                    type="button"
                    variant="ghost"
                    className="header-schedule-pill"
                    onPress={() => setActiveSectionId('config')}
                    aria-label={scheduleTooltip}
                  >
                    <span className="header-schedule-glyph" aria-hidden>Prog.</span>
                    <span className="header-schedule-pct">{`${schedulePct}%`}</span>
                  </DomButton>
                </Tooltip.Trigger>
                <Tooltip.Content placement="bottom" className="max-w-[min(22rem,92vw)] text-xs leading-snug">
                  {scheduleTooltip}
                </Tooltip.Content>
              </Tooltip>
            ) : null}
            {showGlobalSync ? (
              <Tooltip delay={400} closeDelay={0}>
                <Tooltip.Trigger>
                  <DomButton
                    type="button"
                    variant="ghost"
                    className={`header-sync-pill header-sync-pill--${globalSyncTone}`}
                    onPress={() => setActiveSectionId('config')}
                    aria-label={`Sincronizacion en curso ${globalSyncPct} por ciento`}
                  >
                    <span className={`header-sync-icon header-sync-icon--${globalSyncTone}`} aria-hidden />
                    <span className="header-sync-text">{globalSyncPct}%</span>
                    <span className="header-sync-domain">{String(globalSyncLive?.currentDomain || '-')}</span>
                    <span className={`header-sync-live ${headerLiveFresh ? 'is-live' : 'is-stale'}`}>{headerLiveLabel}</span>
                  </DomButton>
                </Tooltip.Trigger>
                <Tooltip.Content placement="bottom" className="max-w-[min(24rem,92vw)] text-xs leading-snug">
                  {syncPillTooltip}
                </Tooltip.Content>
              </Tooltip>
            ) : null}
            <span>Rol: <strong>{role || '-'}</strong></span>
            <Tooltip delay={400} closeDelay={0}>
              <Tooltip.Trigger>
                <DomButton
                  type="button"
                  variant="ghost"
                  className="theme-toggle"
                  onPress={() => setThemePresetId((current) => cycleDarkThemePresetId(current))}
                  aria-label={
                    getThemePresetById(themePresetId).mode === 'dark'
                      ? `Siguiente tema oscuro (ahora: ${getThemePresetById(themePresetId).label})`
                      : 'Activar tema oscuro Obsidiana'
                  }
                >
                  {DARK_THEME_QUICK_BADGE[themePresetId] ?? (getThemePresetById(themePresetId).mode === 'dark' ? 'O' : '·')}
                </DomButton>
              </Tooltip.Trigger>
              <Tooltip.Content placement="bottom" className="max-w-[16rem] text-xs">
                {getThemePresetById(themePresetId).mode === 'dark'
                  ? `Tema oscuro: ${getThemePresetById(themePresetId).label}. Clic: Obsidiana → Pizarra → Lavanda. Temas claros en Configuración.`
                  : 'Activar Obsidiana (oscuro legible con mucha luz). Variantes: botón o Configuración.'}
              </Tooltip.Content>
            </Tooltip>
            <DomButton type="button" variant="outline" className="btn btn-secondary" onPress={handleLogout}>
              Cerrar sesión
            </DomButton>
          </div>
        </header>

        <main className="app-content">
          {error ? <ErrorState message={error} className="mb-3" /> : null}

          <section id="analisisCartera" className={`app-section ${activeSectionId === 'analisisCartera' ? '' : 'hidden'}`}>
            <AnalisisCarteraView />
          </section>

          <section id="analisisCarteraAnuales" className={`app-section ${activeSectionId === 'analisisCarteraAnuales' ? '' : 'hidden'}`}>
            <AnalisisAnualesView />
          </section>

          <section id="analisisCarteraRendimiento" className={`app-section ${activeSectionId === 'analisisCarteraRendimiento' ? '' : 'hidden'}`}>
            <AnalisisRendimientoView />
          </section>

          <section id="analisisCobranzaCohorte" className={`app-section ${activeSectionId === 'analisisCobranzaCohorte' ? '' : 'hidden'}`}>
            <AnalisisCobranzasCohorteView />
          </section>

          <section id="config" className={`app-section ${activeSectionId === 'config' ? '' : 'hidden'}`}>
            <ConfigView onSyncLiveChange={setGlobalSyncLive} onScheduleLiveChange={setGlobalScheduleLive} />
          </section>
        </main>
      </div>
    </>
  )
}
