/**
 * Opciones compactas para filtros analytics (abreviatura visible + leyenda debajo).
 */

export type AbbrevFilterOption = {
  value: string;
  /** Texto enviado al estado (p. ej. clave API en mayúsculas). */
  label: string;
  /** Iniciales o sigla corta (1–3 caracteres). */
  abbrev: string;
  /** Leyenda bajo la abreviatura; por defecto `label`. */
  caption?: string;
};

/** Categoría de cartera (VIGENTE / MOROSO), misma semántica que antes. */
export const CATEGORIA_ABBREV_OPTIONS: AbbrevFilterOption[] = [
  { value: "", label: "Todas", abbrev: "Td", caption: "Todas" },
  { value: "VIGENTE", label: "Vigente", abbrev: "V", caption: "Vigente" },
  { value: "MOROSO", label: "Moroso", abbrev: "M", caption: "Moroso" },
];

/** Vía fija Débito / Cobrador (cohorte y vistas que listan solo estas). */
export const VIA_DEBITO_COBRADOR_ABBREV_OPTIONS: AbbrevFilterOption[] = [
  { value: "", label: "Todos", abbrev: "To", caption: "Todas las vías" },
  { value: "DEBITO", label: "Débito", abbrev: "D", caption: "Débito" },
  { value: "COBRADOR", label: "Cobrador", abbrev: "C", caption: "Cobrador" },
];

export function viaEmptyAbbrev(placeholder: string): string {
  const p = placeholder.trim().toLowerCase();
  if (p === "todos") return "To";
  if (p === "todas") return "Td";
  const t = placeholder.trim();
  return t.length <= 3 ? t.toUpperCase() : t.slice(0, 2).toUpperCase();
}

const VIA_ABBREV: Record<string, string> = {
  COBRADOR: "C",
  DEBITO: "D",
  EFECTIVO: "E",
  TRANSFERENCIA: "Tr",
  TARJETA: "Ta",
  CHEQUE: "Ch",
};

export function abbrevForViaLabel(raw: string): string {
  const u = raw
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (VIA_ABBREV[u]) return VIA_ABBREV[u];
  const compact = u.replace(/[^A-Z0-9]/g, "");
  if (compact.length <= 2) return compact || "?";
  return compact.slice(0, 2);
}

export function captionForVia(raw: string): string {
  const u = raw.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (u === "COBRADOR") return "Cobrador";
  if (u === "DEBITO") return "Débito";
  if (u === "EFECTIVO") return "Efectivo";
  return raw.trim() || raw;
}
