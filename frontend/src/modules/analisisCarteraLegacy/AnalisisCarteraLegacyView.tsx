import React, { useMemo } from 'react'

const DEFAULT_LEGACY_URL = 'http://localhost:5000/?tab=rendimiento'

export function AnalisisCarteraLegacyView() {
  const legacyUrl = useMemo(() => {
    const envUrl = String(import.meta.env.VITE_LEGACY_DASHBOARD_URL || '').trim()
    return envUrl || DEFAULT_LEGACY_URL
  }, [])

  return (
    <div className="legacy-report-view">
      <div className="card legacy-report-header">
        <div>
          <h2 style={{ marginBottom: 6 }}>Rendimiento de Cartera (Legacy)</h2>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
            Informe heredado embebido desde <code>{legacyUrl}</code>.
          </p>
        </div>
        <a className="btn btn-secondary" href={legacyUrl} target="_blank" rel="noreferrer">
          Abrir en nueva pestaña
        </a>
      </div>

      <div className="card legacy-report-frame-wrap">
        <iframe
          title="Rendimiento de Cartera Legacy"
          src={legacyUrl}
          className="legacy-report-frame"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  )
}

