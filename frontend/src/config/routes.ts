/** Rutas del App Router y mapeo de ids de navegación */
export const ROUTES = {
  cartera: "/cartera",
  analisisCartera: "/analisis-cartera",
  roloCartera: "/analisis-cartera/rolo-cartera",
  analisisAnuales: "/analisis-anuales",
  rendimiento: "/rendimiento",
  cobranzasCohorte: "/cobranzas-cohorte",
  config: "/config",
} as const;

export const ROUTE_TO_SECTION_ID: Record<string, string> = {
  "/cartera": "cartera",
  "/analisis-cartera": "analisisCartera",
  "/analisis-cartera/rolo-cartera": "roloCartera",
  "/analisis-anuales": "analisisCarteraAnuales",
  "/rendimiento": "analisisCarteraRendimiento",
  "/cobranzas-cohorte": "analisisCobranzaCohorte",
  "/config": "config",
};

export type NavChildItem = {
  id: string;
  label: string;
  href: string;
};

export type NavItem = {
  id: string;
  label: string;
  href: string;
  group: string;
  children?: readonly NavChildItem[];
};

export const NAV_ITEMS = [
  {
    id: "cartera",
    label: "Resumen de Cartera",
    href: ROUTES.cartera,
    group: "Análisis de Cartera",
  },
  {
    id: "analisisCartera",
    label: "Análisis de Cartera",
    href: ROUTES.analisisCartera,
    group: "Análisis de Cartera",
    children: [{ id: "roloCartera", label: "Rolo de Cartera", href: ROUTES.roloCartera }],
  },
  { id: "analisisCarteraAnuales", label: "Análisis Anuales", href: ROUTES.analisisAnuales, group: "Análisis de Cartera" },
  { id: "analisisCarteraRendimiento", label: "Rendimiento de Cartera", href: ROUTES.rendimiento, group: "Análisis de Cartera" },
  { id: "analisisCobranzaCohorte", label: "Análisis Cobranzas Corte", href: ROUTES.cobranzasCohorte, group: "Análisis de Cartera" },
  { id: "config", label: "Configuración", href: ROUTES.config, group: "Sistema" },
] as const satisfies readonly NavItem[];
