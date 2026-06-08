/** Producción nueva (etapa 1): solo Cartera + Configuración */
export const NAV_SECTIONS = [
  { id: 'analisisCartera', label: 'Análisis de Cartera', group: 'Análisis de Cartera', tooltip: 'Cartera por UN, vía y tramo de mora' },
  { id: 'analisisCarteraAnuales', label: 'Análisis Anuales', group: 'Análisis de Cartera', tooltip: 'Evolución anual de cartera y cobertura' },
  { id: 'analisisCarteraRendimiento', label: 'Rendimiento de Cartera', group: 'Análisis de Cartera', tooltip: 'Métricas de rendimiento por gestión' },
  { id: 'analisisCobranzaCohorte', label: 'Análisis Cobranzas Corte', group: 'Análisis de Cartera', tooltip: 'Acumulado de cobros por mes de corte' },
  { id: 'brokers', label: 'Brokers', group: 'Operaciones', tooltip: 'Comisiones, premios, supervisores y mora de brokers' },
  { id: 'eerr', label: 'EERR', group: 'Finanzas', tooltip: 'Estado de Resultados: ventas, costos y gastos' },
  { id: 'config', label: 'Configuración', group: 'Sistema', tooltip: 'Usuarios, roles, layouts y sincronización' },
] as const

export type NavSectionId = (typeof NAV_SECTIONS)[number]['id']
