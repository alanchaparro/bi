/** Secciones del menú, alineadas con el legacy (dashboard.html) */
export const NAV_SECTIONS = [
  { id: 'cartera', label: 'Cartera', group: 'Operación' },
  { id: 'cobranzas', label: 'Cobranzas', group: 'Operación' },
  { id: 'analisisCartera', label: 'Análisis Cartera', group: 'Análisis Cartera' },
  { id: 'acaMovimiento', label: 'Movimiento Cartera', group: 'Análisis Cartera' },
  { id: 'acaAnuales', label: 'Análisis Anuales', group: 'Análisis Cartera' },
  { id: 'rendimiento', label: 'Rendimiento', group: 'Performance' },
  { id: 'cosecha', label: 'Cosecha', group: 'Performance' },
  { id: 'ltv', label: 'LTV', group: 'Performance' },
  { id: 'ltvAge', label: 'LTV-Antigüedad', group: 'Performance' },
  { id: 'analisisCobranza', label: 'Análisis Cobranzas', group: 'Gestión' },
  { id: 'culminados', label: 'Culminados', group: 'Gestión' },
  { id: 'gestores', label: 'Gestores', group: 'Gestión' },
  { id: 'brokers', label: 'Brokers', group: 'Gestión' },
  { id: 'brokersCommissions', label: 'Config. Comisiones', group: 'Gestión' },
  { id: 'brokersPrizes', label: 'Config. Premios', group: 'Gestión' },
  { id: 'brokersSupervisors', label: 'Supervisores Brokers', group: 'Gestión' },
  { id: 'brokersMora', label: 'Mora Brokers', group: 'Gestión' },
  { id: 'config', label: 'Configuración', group: 'Sistema' },
] as const

export type NavSectionId = (typeof NAV_SECTIONS)[number]['id']
