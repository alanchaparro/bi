import React, { useMemo } from 'react'
import { LEGACY_DASHBOARD_URL as ENV_LEGACY_URL } from '../../shared/env'

const DEFAULT_LEGACY_URL = 'http://localhost:5000/?tab=rendimiento'

export function AnalisisCarteraLegacyView() {
  const legacyUrl = useMemo(() => {
    const envUrl = String(ENV_LEGACY_URL || '').trim()
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
        <a href={legacyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-transparent px-4 py-2 text-sm font-medium hover:bg-[var(--sidebar-active-bg)]">
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

