/** Producción nueva (etapa 1): solo Cartera + Configuración */
export const NAV_SECTIONS = [
  { id: 'analisisCartera', label: 'Análisis de Cartera', group: 'Análisis de Cartera' },
  { id: 'analisisCarteraAnuales', label: 'Análisis Anuales', group: 'Análisis de Cartera' },
  { id: 'analisisCarteraRendimiento', label: 'Rendimiento de Cartera', group: 'Análisis de Cartera' },
  { id: 'analisisCobranzaCohorte', label: 'Análisis Cobranzas Corte', group: 'Análisis de Cartera' },
  { id: 'config', label: 'Configuración', group: 'Sistema' },
] as const

export type NavSectionId = (typeof NAV_SECTIONS)[number]['id']
