import type { EerrV2SummaryRow } from "@/shared/api";

/** Orden A–Z por etiqueta de cuenta (subcuentas al desplegar un mayor). */
function sortByCuentaLabelAsc<T extends { cuenta: string }>(lines: T[]): T[] {
  return [...lines].sort((a, b) =>
    a.cuenta.localeCompare(b.cuenta, "es", { sensitivity: "base", numeric: true }),
  );
}

export type MayorNetLine = {
  mayor: string;
  net: number;
  eerr_block: "ventas" | "costos" | "gastos";
};

/** Neto por fila alineado al backend (ventas: saldo débito−haber; costos/gastos: débito−crédito). */
export function rowNetForBlock(row: EerrV2SummaryRow): number {
  const b = String(row.eerr_block || "").toLowerCase();
  if (b === "ventas") return Number(row.debit_total) - Number(row.credit_total);
  if (b === "costos" || b === "gastos") return Number(row.debit_total) - Number(row.credit_total);
  return 0;
}

export function aggregateMayorNetByBlock(
  rows: EerrV2SummaryRow[],
  block: "ventas" | "costos" | "gastos",
): MayorNetLine[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (String(r.eerr_block || "").toLowerCase() !== block) continue;
    const key = String(r.mayor || "").trim() || "(sin mayor)";
    const net = rowNetForBlock(r);
    map.set(key, (map.get(key) ?? 0) + net);
  }
  return [...map.entries()]
    .map(([mayor, net]) => ({ mayor, net, eerr_block: block }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

export type CuentaNetLine = { cuenta: string; net: number };

/** Costos / gastos: saldo por cuenta dentro de un mayor (débito − crédito). */
export function aggregateCuentaNetByMayorBlock(
  rows: EerrV2SummaryRow[],
  block: "costos" | "gastos",
  mayorKey: string,
): CuentaNetLine[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (String(r.eerr_block || "").toLowerCase() !== block) continue;
    const m = String(r.mayor || "").trim() || "(sin mayor)";
    if (m !== mayorKey) continue;
    const c = String(r.cuenta || "").trim() || "(sin cuenta)";
    const net = rowNetForBlock(r);
    map.set(c, (map.get(c) ?? 0) + net);
  }
  return sortByCuentaLabelAsc(
    [...map.entries()].map(([cuenta, net]) => ({ cuenta, net })),
  );
}

/** Ventas: saldo por cuenta dentro de un mayor (débito − haber). */
export function aggregateCuentaNetByMayorVentas(
  rows: EerrV2SummaryRow[],
  mayorKey: string,
): CuentaNetLine[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (String(r.eerr_block || "").toLowerCase() !== "ventas") continue;
    const m = String(r.mayor || "").trim() || "(sin mayor)";
    if (m !== mayorKey) continue;
    const c = String(r.cuenta || "").trim() || "(sin cuenta)";
    const net = Number(r.debit_total) - Number(r.credit_total);
    map.set(c, (map.get(c) ?? 0) + net);
  }
  return sortByCuentaLabelAsc(
    [...map.entries()].map(([cuenta, net]) => ({ cuenta, net })),
  );
}

export type EerrDetalleCuentaNode = { cuenta: string; saldo: number };

export type EerrDetalleMayorNode = { mayor: string; saldo: number; cuentas: EerrDetalleCuentaNode[] };

export type EerrDetalleEmpresaNode = { empresa: string; saldo: number; mayores: EerrDetalleMayorNode[] };

/** Agrupa filas API en empresa → mayor → cuenta con saldos (misma convención que `rowNetForBlock`). */
export function buildEerrDetalleTree(rows: EerrV2SummaryRow[]): EerrDetalleEmpresaNode[] {
  const empMap = new Map<string, Map<string, Map<string, number>>>();
  for (const r of rows) {
    const empresa = String(r.empresa || "").trim() || "(sin empresa)";
    const mayor = String(r.mayor || "").trim() || "(sin mayor)";
    const cuenta = String(r.cuenta || "").trim() || "(sin cuenta)";
    const saldo = rowNetForBlock(r);
    if (!empMap.has(empresa)) empMap.set(empresa, new Map());
    const mMap = empMap.get(empresa)!;
    if (!mMap.has(mayor)) mMap.set(mayor, new Map());
    const cMap = mMap.get(mayor)!;
    cMap.set(cuenta, (cMap.get(cuenta) ?? 0) + saldo);
  }

  const empresas: EerrDetalleEmpresaNode[] = [];
  for (const [empresa, mMap] of empMap) {
    const mayores: EerrDetalleMayorNode[] = [];
    let empSaldo = 0;
    for (const [mayor, cMap] of mMap) {
      const cuentas: EerrDetalleCuentaNode[] = [];
      let mayorSaldo = 0;
      for (const [cuenta, saldo] of cMap) {
        cuentas.push({ cuenta, saldo });
        mayorSaldo += saldo;
      }
      mayores.push({ mayor, saldo: mayorSaldo, cuentas: sortByCuentaLabelAsc(cuentas) });
      empSaldo += mayorSaldo;
    }
    mayores.sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo));
    empresas.push({ empresa, saldo: empSaldo, mayores });
  }
  empresas.sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo));
  return empresas;
}
