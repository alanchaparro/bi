import type { PortfolioRoloOtrosAjustesResponse } from "@/shared/api";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeCsvCell(value: string | number | boolean | null | undefined, delimiter: string): string {
  const raw = value === null || value === undefined ? "" : String(value);
  if (raw.includes('"') || raw.includes("\n") || raw.includes("\r") || raw.includes(delimiter)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const CSV_HEADERS = [
  "Contrato",
  "UN",
  "Supervisor",
  "Vía",
  "Delta vigente",
  "Venta nueva",
  "Recuperado",
  "Culminado",
  "Caído",
  "Residual",
  "Mes venta",
  "Mes culminación",
  "En cierre anterior",
  "En cierre actual",
] as const;

function rowToCsvCells(r: NonNullable<PortfolioRoloOtrosAjustesResponse["rows"]>[number]): string[] {
  return [
    r.contract_id,
    r.un,
    r.supervisor,
    r.via_cobro,
    String(r.delta_vigente),
    String(r.venta_nueva),
    String(r.recuperado),
    String(r.culminado),
    String(r.caido),
    String(r.residual),
    r.sale_month ?? "",
    r.culm_month ?? "",
    r.en_cierre_anterior ? "Sí" : "No",
    r.en_cierre_actual ? "Sí" : "No",
  ];
}

/** CSV con BOM UTF-8 y separador `;` (Excel regional típico). */
export function downloadRoloOtrosAjustesCsv(
  rows: NonNullable<PortfolioRoloOtrosAjustesResponse["rows"]>,
  closeMonthLabel: string,
): void {
  const delimiter = ";";
  const headerLine = CSV_HEADERS.map((h) => escapeCsvCell(h, delimiter)).join(delimiter);
  const body = rows.map((r) => rowToCsvCells(r).map((c) => escapeCsvCell(c, delimiter)).join(delimiter));
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + [headerLine, ...body].join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const safe = closeMonthLabel.replace(/\//g, "-").replace(/\s+/g, "_") || "cierre";
  triggerDownload(blob, `rolo-otros-ajustes_${safe}.csv`);
}

/**
 * Tabla HTML simple que Excel abre como .xls (sin dependencias).
 * No es formato BIFF nativo; suficiente para revisión y filtros básicos.
 */
export function downloadRoloOtrosAjustesXls(
  rows: NonNullable<PortfolioRoloOtrosAjustesResponse["rows"]>,
  closeMonthLabel: string,
): void {
  const th = CSV_HEADERS.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const trs = rows
    .map((r) => {
      const cells = rowToCsvCells(r).map((c) => `<td>${escapeHtml(c)}</td>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="UTF-8" /></head><body><table border="1"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const safe = closeMonthLabel.replace(/\//g, "-").replace(/\s+/g, "_") || "cierre";
  triggerDownload(blob, `rolo-otros-ajustes_${safe}.xls`);
}
