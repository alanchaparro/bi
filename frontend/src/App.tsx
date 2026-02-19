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

export default function App() {
  const [auth, setAuth] = useState<LoginResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [activeSectionId, setActiveSectionId] = useState<string>('analisisCartera')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const role = auth?.role ?? ''

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
      setError('Sesion expirada. Volve a iniciar sesion.')
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
    return <div className="loading-page">Cargando...</div>
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
          <span>Rol: <strong>{role || '-'}</strong></span>
          <button type="button" className="btn btn-secondary" onClick={handleLogout}>
            Cerrar sesion
          </button>
        </div>
      </header>

      <main className="app-content">
        {error ? <div className="alert-error">{error}</div> : null}

        <section id="analisisCartera" className={`app-section ${activeSectionId === 'analisisCartera' ? '' : 'hidden'}`}>
          <AnalisisCarteraView />
        </section>

        <section id="config" className={`app-section ${activeSectionId === 'config' ? '' : 'hidden'}`}>
          <ConfigView />
        </section>
      </main>
    </>
  )
}
