/** Alineado con `backend/app/core/role_nav.py` CONFIG_SUBNAV_IDS + permisos `nav:<id>`. */

export const CONFIG_SECTION_NAV_IDS = [
  "config_usuarios",
  "config_roles_menus",
  "config_layouts_filtros",
  "config_negocio",
  "config_importaciones",
  "config_programacion",
] as const;

export function hasConfigNavPermission(permissions: string[] | undefined): boolean {
  const list = permissions ?? [];
  if (list.includes("nav:config")) return true;
  return CONFIG_SECTION_NAV_IDS.some((id) => list.includes(`nav:${id}`));
}

export type ConfigSectionKey =
  | "usuarios"
  | "rolesMenus"
  | "layoutsFiltros"
  | "negocio"
  | "importaciones"
  | "programacion";

/** Permiso `nav:*` por pestaña de /config (salvo roles/layouts que además requieren brokers:write_config en la vista). */
export const CONFIG_SECTION_NAV_PERM: Record<ConfigSectionKey, string> = {
  usuarios: "nav:config_usuarios",
  rolesMenus: "nav:config_roles_menus",
  layoutsFiltros: "nav:config_layouts_filtros",
  negocio: "nav:config_negocio",
  importaciones: "nav:config_importaciones",
  programacion: "nav:config_programacion",
};

const TAB_SLUG: Record<ConfigSectionKey, string> = {
  usuarios: "usuarios",
  rolesMenus: "roles-menus",
  layoutsFiltros: "layouts-filtros",
  negocio: "negocio",
  importaciones: "importaciones",
  programacion: "programacion",
};

const SLUG_TO_SECTION: Record<string, ConfigSectionKey> = Object.fromEntries(
  (Object.keys(TAB_SLUG) as ConfigSectionKey[]).map((k) => [TAB_SLUG[k], k]),
);

export function configSectionToTabSlug(section: ConfigSectionKey): string {
  return TAB_SLUG[section];
}

export function tabSlugToConfigSection(slug: string | null | undefined): ConfigSectionKey | null {
  if (!slug) return null;
  return SLUG_TO_SECTION[slug] ?? null;
}
