import React, { useMemo } from 'react'
import { Button } from '@heroui/react'
import { AnalyticsPageHeader } from '../../components/analytics/AnalyticsPageHeader'
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
        <AnalyticsPageHeader
          title="Rendimiento de cartera (legacy)"
          subtitle={`Informe heredado embebido desde ${legacyUrl}.`}
        />
        <Button
          variant="outline"
          className="legacy-report-open-btn"
          onPress={() => window.open(legacyUrl, '_blank', 'noopener,noreferrer')}
        >
          Abrir en nueva pestaña
        </Button>
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

