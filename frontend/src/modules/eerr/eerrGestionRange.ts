/** Parse mm/yyyy devuelto por API EERR (p. ej. "01/2026"). */
export function parseGestionMonth(s: string): { m: number; y: number } | null {
  const parts = String(s || "")
    .trim()
    .split("/");
  if (parts.length !== 2) return null;
  const m = parseInt(parts[0], 10);
  const y = parseInt(parts[1], 10);
  if (!Number.isFinite(m) || !Number.isFinite(y) || m < 1 || m > 12 || y < 1900 || y > 2100) return null;
  return { m, y };
}

export function monthSerialMmYyyy(s: string): number {
  const p = parseGestionMonth(s);
  if (!p) return 0;
  return p.y * 12 + p.m;
}

export function boundsFromMonthOptions(months: string[]): { minY: number; maxY: number } {
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const raw of months) {
    const p = parseGestionMonth(raw);
    if (!p) continue;
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minY) || !Number.isFinite(maxY) || minY > maxY) {
    const cy = new Date().getFullYear();
    return { minY: cy - 5, maxY: cy };
  }
  return { minY, maxY };
}

/** Años distintos presentes en opciones mm/yyyy (orden ascendente). */
export function distinctYearsFromMonthOptions(months: string[]): number[] {
  const ys = new Set<number>();
  for (const raw of months) {
    const p = parseGestionMonth(raw);
    if (p) ys.add(p.y);
  }
  return [...ys].sort((a, b) => a - b);
}

function yearsSetsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

/** Rango rectangular: año ∈ [yLo,yHi] y mes calendario ∈ [mLo,mHi] (ambos inclusivos). */
export function expandGestionRectangle(yLo: number, yHi: number, mLo: number, mHi: number): string[] {
  const ya = Math.min(yLo, yHi);
  const yb = Math.max(yLo, yHi);
  const ma = Math.min(mLo, mHi);
  const mb = Math.max(mLo, mHi);
  const out: string[] = [];
  for (let y = ya; y <= yb; y++) {
    for (let m = ma; m <= mb; m++) {
      out.push(`${String(m).padStart(2, "0")}/${y}`);
    }
  }
  return out;
}

/** Meses mm/yyyy para cada año en `years` y cada mes calendario ∈ [mLo,mHi] (inclusivo). */
export function expandGestionForYears(years: number[], mLo: number, mHi: number): string[] {
  const ma = Math.min(mLo, mHi);
  const mb = Math.max(mLo, mHi);
  const sy = [...new Set(years)].sort((a, b) => a - b);
  const out: string[] = [];
  for (const y of sy) {
    for (let m = ma; m <= mb; m++) {
      out.push(`${String(m).padStart(2, "0")}/${y}`);
    }
  }
  return out;
}

export function sortGestionMonthList(vals: string[]): string[] {
  return [...vals].sort((a, b) => monthSerialMmYyyy(a) - monthSerialMmYyyy(b));
}

/**
 * Lista para API: `undefined` = sin filtro (todos los meses con datos).
 * Años: multiselección sobre {@link distinctYearsFromMonthOptions}; “todo” = mismo conjunto que las opciones.
 * Si la selección no toca ningún mes cargado, se envía un mes improbable para obtener vacío sin ambigüedad.
 */
export function gestionMonthsForApi(
  selectedYears: number[],
  monthRange: [number, number],
  monthOptions: string[],
): string[] | undefined {
  const allYears = distinctYearsFromMonthOptions(monthOptions);
  const sel = [...new Set(selectedYears)].filter((y) => allYears.includes(y));
  const yFull = allYears.length > 0 && yearsSetsEqual(sel, allYears);
  const mFull = monthRange[0] === 1 && monthRange[1] === 12;
  if (yFull && mFull) return undefined;

  if (sel.length === 0) return ["01/1900"];

  const expanded = expandGestionForYears(sel, monthRange[0], monthRange[1]);
  const opt = new Set(monthOptions);
  const hit = sortGestionMonthList(expanded.filter((x) => opt.has(x)));
  if (hit.length === 0) return ["01/1900"];
  return hit;
}

export function monthShortEs(m: number): string {
  const names = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  if (m < 1 || m > 12) return String(m);
  return names[m] ?? String(m);
}
