/** Rutas del App Router y mapeo desde ids de sección legacy */
export const ROUTES = {
  analisisCartera: "/analisis-cartera",
  analisisAnuales: "/analisis-anuales",
  rendimiento: "/rendimiento",
  cobranzasCohorte: "/cobranzas-cohorte",
  config: "/config",
} as const;

export const ROUTE_TO_SECTION_ID: Record<string, string> = {
  "/analisis-cartera": "analisisCartera",
  "/analisis-anuales": "analisisCarteraAnuales",
  "/rendimiento": "analisisCarteraRendimientoLegacy",
  "/cobranzas-cohorte": "analisisCobranzaCohorte",
  "/config": "config",
};

export const NAV_ITEMS = [
  { id: "analisisCartera", label: "Análisis de Cartera", href: ROUTES.analisisCartera, group: "Análisis de Cartera" },
  { id: "analisisCarteraAnuales", label: "Análisis Anuales", href: ROUTES.analisisAnuales, group: "Análisis de Cartera" },
  { id: "analisisCarteraRendimientoLegacy", label: "Rendimiento de Cartera", href: ROUTES.rendimiento, group: "Análisis de Cartera" },
  { id: "analisisCobranzaCohorte", label: "Análisis Cobranzas Corte", href: ROUTES.cobranzasCohorte, group: "Análisis de Cartera" },
  { id: "config", label: "Configuración", href: ROUTES.config, group: "Sistema" },
] as const;
