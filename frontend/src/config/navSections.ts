/** Produccion nueva (etapa 1): solo Cartera + Configuracion */
export const NAV_SECTIONS = [
  { id: 'analisisCartera', label: 'Analisis Cartera', group: 'Analisis Cartera' },
  { id: 'config', label: 'Configuracion', group: 'Sistema' },
] as const

export type NavSectionId = (typeof NAV_SECTIONS)[number]['id']
