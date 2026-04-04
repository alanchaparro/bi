/**
 * Orden de períodos MM/YYYY para filtros (más reciente primero en listas).
 */

export function mesGestionRank(value: string): number {
  const parts = String(value || "").split("/");
  if (parts.length !== 2) return 0;
  const month = Number(parts[0] || 0);
  const year = Number(parts[1] || 0);
  if (!Number.isFinite(month) || !Number.isFinite(year) || month < 1 || month > 12) return 0;
  return year * 100 + month;
}

/** Copia ordenada: más reciente arriba. Entradas no parseables quedan al final, orden estable. */
export function sortMesGestionDesc(months: readonly string[] | undefined | null): string[] {
  if (!months?.length) return [];
  const withIdx = months.map((m, i) => ({ m, i, r: mesGestionRank(m) }));
  return [...withIdx]
    .sort((a, b) => {
      if (b.r !== a.r) return b.r - a.r;
      return a.i - b.i;
    })
    .map((x) => x.m);
}
