import React, { useCallback, useEffect, useState } from 'react'
import {
  login,
  logout,
  restoreSession,
  setAuthToken,
  setOnUnauthorized,
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
import { ConfigView } from './modules/config/ConfigView'
import { AnalisisCarteraView } from './modules/analisisCartera/AnalisisCarteraView'
import { AnalisisCobranzasCohorteView } from './modules/analisisCobranzasCohorte/AnalisisCobranzasCohorteView'

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

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('ui-theme')
      return saved === 'light' ? 'light' : 'dark'
    } catch {
      return 'dark'
    }
  })
  const [auth, setAuth] = useState<LoginResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [activeSectionId, setActiveSectionId] = useState<string>('analisisCartera')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [globalSyncLive, setGlobalSyncLive] = useState<GlobalSyncLive | null>(null)

  const role = auth?.role ?? ''
  const globalSyncPct = Math.max(0, Math.min(100, Math.round(globalSyncLive?.progressPct || 0)))
  const globalSyncQuery = globalSyncLive?.currentQueryFile || '-'
  const showGlobalSync = Boolean(globalSyncLive?.running)
  const headerLiveFresh = (() => {
    const ts = globalSyncLive?.lastUpdatedAt ? new Date(globalSyncLive.lastUpdatedAt).getTime() : Number.NaN
    if (Number.isNaN(ts)) return false
    return (Date.now() - ts) <= 12000
  })()
  const headerLiveLabel = headerLiveFresh ? 'En vivo' : 'Desfasado'
  const globalSyncTone = globalSyncLive?.error
    ? 'error'
    : globalSyncLive?.chunkStatus === 'changed'
      ? 'ok'
      : globalSyncLive?.chunkStatus === 'unchanged'
        ? 'warn'
        : 'info'

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
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('ui-theme', theme)
    } catch {
      // ignore storage failures
    }
  }, [theme])

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
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <SidebarNav
            sections={[...NAV_SECTIONS]}
            activeId={activeSectionId}
            onSelect={setActiveSectionId}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((o) => !o)}
            onCloseSidebar={() => setSidebarOpen(false)}
          />
          <h1>EPEM - Cartera de Cobranzas</h1>
        </div>
        <div className="user-info">
          {showGlobalSync ? (
            <button
              type="button"
              className={`header-sync-pill header-sync-pill--${globalSyncTone}`}
              onClick={() => setActiveSectionId('config')}
              title={
                `${globalSyncLive?.message || 'Sincronizando...'}`
                + ` | ${globalSyncPct}%`
                + ` | ${globalSyncLive?.jobStep || '-'}`
                + ` | ETA ${globalSyncLive?.etaSeconds ?? '-'}s`
                + ` | Cola ${typeof globalSyncLive?.queuePosition === 'number' ? globalSyncLive.queuePosition : '-'}`
                + ` | Chunk ${globalSyncLive?.chunkStatus || '-'}`
                + ` | Skipped ${globalSyncLive?.skippedUnchangedChunks ?? 0}`
                + ` | ${globalSyncQuery}`
                + ` | Estado ${headerLiveLabel}`
              }
              aria-label={`Sincronizacion en curso ${globalSyncPct} por ciento`}
            >
              <span className={`header-sync-icon header-sync-icon--${globalSyncTone}`} aria-hidden />
              <span className="header-sync-text">{globalSyncPct}%</span>
              <span className="header-sync-domain">{String(globalSyncLive?.currentDomain || '-')}</span>
              <span className={`header-sync-live ${headerLiveFresh ? 'is-live' : 'is-stale'}`}>{headerLiveLabel}</span>
            </button>
          ) : null}
          <span>Rol: <strong>{role || '-'}</strong></span>
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="app-content">
        {error ? <div className="alert-error">{error}</div> : null}

        <section id="analisisCartera" className={`app-section ${activeSectionId === 'analisisCartera' ? '' : 'hidden'}`}>
          <AnalisisCarteraView />
        </section>

        <section id="analisisCobranzaCohorte" className={`app-section ${activeSectionId === 'analisisCobranzaCohorte' ? '' : 'hidden'}`}>
          <AnalisisCobranzasCohorteView />
        </section>

        <section id="config" className={`app-section ${activeSectionId === 'config' ? '' : 'hidden'}`}>
          <ConfigView onSyncLiveChange={setGlobalSyncLive} />
        </section>
      </main>
    </>
  )
}
