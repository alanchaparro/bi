/** Rutas del App Router y mapeo de ids de navegación */
export const ROUTES = {
  cartera: "/cartera",
  analisisCartera: "/analisis-cartera",
  roloCartera: "/analisis-cartera/rolo-cartera",
  analisisAnuales: "/analisis-anuales",
  rendimiento: "/rendimiento",
  cobranzasCohorte: "/cobranzas-cohorte",
  brokers: "/brokers",
  brokersCommissions: "/brokers/comisiones",
  brokersPrizes: "/brokers/premios",
  brokersSupervisors: "/brokers/supervisores",
  brokersMora: "/brokers/mora",
  eerr: "/eerr",
  config: "/config",
} as const;

export const ROUTE_TO_SECTION_ID: Record<string, string> = {
  "/cartera": "cartera",
  "/analisis-cartera": "analisisCartera",
  "/analisis-cartera/rolo-cartera": "roloCartera",
  "/analisis-anuales": "analisisCarteraAnuales",
  "/rendimiento": "analisisCarteraRendimiento",
  "/cobranzas-cohorte": "analisisCobranzaCohorte",
  "/brokers": "brokers",
  "/brokers/comisiones": "brokersCommissions",
  "/brokers/premios": "brokersPrizes",
  "/brokers/supervisores": "brokersSupervisors",
  "/brokers/mora": "brokersMora",
  "/eerr": "eerr",
  "/config": "config",
};

export type NavChildItem = {
  id: string;
  label: string;
  href: string;
  // Mejora UX #4: tooltip descriptivo en sidebar
  tooltip?: string;
};

export type NavItem = {
  id: string;
  label: string;
  href: string;
  group: string;
  tooltip?: string;
  subItems?: readonly NavChildItem[];
};

export const NAV_ITEMS = [
  {
    id: "cartera",
    label: "Resumen de Cartera",
    href: ROUTES.cartera,
    group: "Análisis de Cartera",
    tooltip: "Vista general de cartera y saldos",
  },
  {
    id: "analisisCartera",
    label: "Análisis de Cartera",
    href: ROUTES.analisisCartera,
    group: "Análisis de Cartera",
    tooltip: "Cartera por UN, vía y tramo de mora",
    subItems: [
      { id: "roloCartera", label: "Rolo de Cartera", href: ROUTES.roloCartera, tooltip: "Rolo detallado de contratos" },
    ],
  },
  { id: "analisisCarteraAnuales", label: "Análisis Anuales", href: ROUTES.analisisAnuales, group: "Análisis de Cartera", tooltip: "Evolución anual de cartera y cobertura" },
  { id: "analisisCarteraRendimiento", label: "Rendimiento de Cartera", href: ROUTES.rendimiento, group: "Análisis de Cartera", tooltip: "Métricas de rendimiento por gestión" },
  { id: "analisisCobranzaCohorte", label: "Análisis Cobranzas Corte", href: ROUTES.cobranzasCohorte, group: "Análisis de Cartera", tooltip: "Acumulado de cobros por mes de corte" },
  {
    id: "brokers",
    label: "Brokers",
    href: ROUTES.brokers,
    group: "Operaciones",
    tooltip: "Gestión de brokers: comisiones, premios, supervisores y mora",
    subItems: [
      { id: "brokersCommissions", label: "Comisiones", href: ROUTES.brokersCommissions, tooltip: "Reglas de comisión por supervisor" },
      { id: "brokersPrizes", label: "Premios", href: ROUTES.brokersPrizes, tooltip: "Escalas de premios por rendimiento" },
      { id: "brokersSupervisors", label: "Supervisores", href: ROUTES.brokersSupervisors, tooltip: "Supervisores habilitados en el sistema" },
      { id: "brokersMora", label: "Mora", href: ROUTES.brokersMora, tooltip: "Contratos con mora a 3 meses" },
    ],
  },
  { id: "eerr", label: "EERR", href: ROUTES.eerr, group: "Finanzas", tooltip: "Estado de Resultados: ventas, costos y gastos" },
  {
    id: "config",
    label: "Configuración",
    href: ROUTES.config,
    group: "Sistema",
    tooltip: "Usuarios, roles, layouts y sincronización",
    subItems: [
      { id: "config_usuarios", label: "Usuarios", href: `${ROUTES.config}?tab=usuarios`, tooltip: "Gestión de usuarios del sistema" },
      { id: "config_roles_menus", label: "Roles y menús", href: `${ROUTES.config}?tab=roles-menus`, tooltip: "Asignación de roles y menús" },
      { id: "config_layouts_filtros", label: "Layouts filtros", href: `${ROUTES.config}?tab=layouts-filtros`, tooltip: "Configuración de layouts de filtros" },
      { id: "config_negocio", label: "Negocio", href: `${ROUTES.config}?tab=negocio`, tooltip: "Parámetros de negocio" },
      { id: "config_importaciones", label: "Importaciones", href: `${ROUTES.config}?tab=importaciones`, tooltip: "Importación de datos" },
      { id: "config_programacion", label: "Programación", href: `${ROUTES.config}?tab=programacion`, tooltip: "Programación de sincronizaciones" },
    ],
  },
] as const satisfies readonly NavItem[];
