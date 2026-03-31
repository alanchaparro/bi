import React, { useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { formatGsCompact, formatGsFull } from "@/shared/formatters";

export type EerrRowLike = {
  gestion_month: string;
  eerr_block: string;
  debit_total: number;
  credit_total: number;
};

export type EerrMonthAgg = {
  label: string;
  ventasNet: number;
  costosNet: number;
  gastosNet: number;
  margen: number;
  ebitda: number;
};

function monthSerial(mmYyyy: string): number {
  const parts = String(mmYyyy || "").split("/");
  if (parts.length !== 2) return 0;
  const m = Number(parts[0]);
  const y = Number(parts[1]);
  if (!Number.isInteger(m) || !Number.isInteger(y) || m < 1 || m > 12) return 0;
  return y * 12 + m;
}

/** Agrega filas del summary por mes de gestión; netos alineados a KPIs (ventas: débito−haber, etc.). */
export function aggregateEerrRowsByGestionMonth(rows: EerrRowLike[]): EerrMonthAgg[] {
  const map = new Map<string, { v: number; c: number; g: number }>();
  for (const r of rows) {
    const label = String(r.gestion_month || "").trim();
    if (!label) continue;
    if (!map.has(label)) map.set(label, { v: 0, c: 0, g: 0 });
    const o = map.get(label)!;
    const d = Number(r.debit_total || 0);
    const cr = Number(r.credit_total || 0);
    const b = String(r.eerr_block || "").toLowerCase();
    if (b === "ventas") o.v += d - cr;
    else if (b === "costos") o.c += d - cr;
    else if (b === "gastos") o.g += d - cr;
  }
  return [...map.entries()]
    .sort((a, b) => monthSerial(a[0]) - monthSerial(b[0]))
    .map(([label, o]) => ({
      label,
      ventasNet: o.v,
      costosNet: o.c,
      gastosNet: o.g,
      margen: o.v - o.c,
      ebitda: o.v - o.c - o.g,
    }));
}

/** Ventas verde; costos naranja; gastos rojo — mejor contraste entre costo fijo y gasto. */
const COL = {
  ventas: "var(--color-chart-1)",
  costos: "var(--color-state-warn)",
  gastos: "var(--color-state-error)",
  line: "var(--color-primary)",
};

type GroupedProps = {
  data: EerrMonthAgg[];
  isLight: boolean;
};

/** Barras agrupadas por mes: magnitud |neto| por bloque (escala común). */
export function EerrGroupedBlockChart({ data, isLight }: GroupedProps) {
  const [hidden, setHidden] = useState({ ventas: false, costos: false, gastos: false });

  const { maxY, ticks } = useMemo(() => {
    const vals: number[] = [];
    for (const d of data) {
      if (!hidden.ventas) vals.push(Math.abs(d.ventasNet));
      if (!hidden.costos) vals.push(Math.abs(d.costosNet));
      if (!hidden.gastos) vals.push(Math.abs(d.gastosNet));
    }
    const max = Math.max(...vals, 1);
    const step = Math.max(1, 10 ** Math.floor(Math.log10(max)) / 2);
    let hi = Math.ceil(max / step) * step;
    if (!Number.isFinite(hi) || hi <= 0) hi = max;
    const tickCount = 5;
    const t: number[] = [];
    for (let i = 0; i <= tickCount; i += 1) t.push((hi * i) / tickCount);
    return { maxY: hi, ticks: t };
  }, [data, hidden]);

  const n = data.length;
  if (n === 0) {
    return <p className="eerr-chart-empty">No hay series por mes para los filtros actuales.</p>;
  }

  const padding = { top: 16, right: 12, bottom: 72, left: 52 };
  const plotH = 220;
  const groupW = 44;
  const gap = 8;
  const innerW = Math.max(360, n * (groupW + gap));
  const barW = (groupW - 6) / 3;
  const svgW = padding.left + innerW + padding.right;
  const svgH = plotH + padding.top + padding.bottom;
  const baseline = padding.top + plotH;

  const yScale = (v: number) => baseline - (Math.abs(v) / maxY) * plotH;

  const legendBtn = `analysis-legend-btn min-w-0 w-auto p-0 ${isLight ? "analysis-legend-btn--light" : ""}`.trim();

  return (
    <div className="eerr-chart-wrap">
      <div className="analysis-stack-legend eerr-chart-legend">
        <Button
          size="sm"
          variant="ghost"
          className={legendBtn}
          data-hidden={hidden.ventas ? "true" : undefined}
          onPress={() => setHidden((s) => ({ ...s, ventas: !s.ventas }))}
        >
          <span className="analysis-legend-swatch-sm" style={{ background: COL.ventas }} />
          Ventas (neto)
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={legendBtn}
          data-hidden={hidden.costos ? "true" : undefined}
          onPress={() => setHidden((s) => ({ ...s, costos: !s.costos }))}
        >
          <span className="analysis-legend-swatch-sm" style={{ background: COL.costos }} />
          Costos (neto)
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={legendBtn}
          data-hidden={hidden.gastos ? "true" : undefined}
          onPress={() => setHidden((s) => ({ ...s, gastos: !s.gastos }))}
        >
          <span className="analysis-legend-swatch-sm" style={{ background: COL.gastos }} />
          Gastos (neto)
        </Button>
      </div>
      <p className="eerr-chart-hint text-xs opacity-70 mb-2">
        Altura por magnitud del neto por bloque (valores negativos se muestran como barra hacia arriba con |valor|).
      </p>
      <div className="analysis-stack-svg-scroll">
        <svg
          width={svgW}
          height={svgH}
          className="eerr-chart-svg"
          overflow="visible"
          role="img"
          aria-label="Bloques EERR por mes de gestión"
        >
          {ticks.map((t) => {
            const y = yScale(t);
            return (
              <g key={t}>
                <line x1={padding.left} x2={svgW - padding.right} y1={y} y2={y} className="eerr-chart-gridline" />
                <text x={padding.left - 6} y={y + 4} textAnchor="end" className="eerr-chart-axis">
                  {formatGsCompact(t)}
                </text>
              </g>
            );
          })}
          {data.map((d, i) => {
            const gx = padding.left + i * (groupW + gap);
            const segments: Array<{ key: string; val: number; color: string; off: number }> = [];
            let xOff = 0;
            if (!hidden.ventas) {
              segments.push({ key: "v", val: d.ventasNet, color: COL.ventas, off: xOff });
              xOff += barW + 2;
            }
            if (!hidden.costos) {
              segments.push({ key: "c", val: d.costosNet, color: COL.costos, off: xOff });
              xOff += barW + 2;
            }
            if (!hidden.gastos) {
              segments.push({ key: "g", val: d.gastosNet, color: COL.gastos, off: xOff });
            }
            return (
              <g key={d.label}>
                {segments.map((s) => {
                  const h = (Math.abs(s.val) / maxY) * plotH;
                  const y = baseline - h;
                  return (
                    <rect
                      key={s.key}
                      x={gx + s.off}
                      y={y}
                      width={barW}
                      height={Math.max(h, 0)}
                      rx={4}
                      fill={s.color}
                      opacity={0.92}
                    >
                      <title>{`${d.label} · ${formatGsFull(s.val)}`}</title>
                    </rect>
                  );
                })}
                <text
                  x={gx + groupW / 2}
                  y={baseline + 18}
                  textAnchor="middle"
                  className="eerr-chart-xlabel"
                  transform={`rotate(-45 ${gx + groupW / 2} ${baseline + 18})`}
                >
                  {d.label}
                </text>
              </g>
            );
          })}
          <line
            x1={padding.left}
            x2={svgW - padding.right}
            y1={baseline}
            y2={baseline}
            className="eerr-chart-baseline"
          />
        </svg>
      </div>
    </div>
  );
}

type LineProps = {
  data: EerrMonthAgg[];
  mode: "margen" | "ebitda";
  isLight: boolean;
};

export function EerrMargenEbitdaLineChart({ data, mode, isLight }: LineProps) {
  const series = useMemo(
    () => data.map((d) => ({ label: d.label, y: mode === "margen" ? d.margen : d.ebitda })),
    [data, mode],
  );

  if (series.length === 0) {
    return <p className="eerr-chart-empty">Sin puntos para la tendencia.</p>;
  }

  const ys = series.map((s) => s.y);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 0);
  const span = Math.max(maxY - minY, 1);

  const padding = { top: 20, right: 16, bottom: 56, left: 56 };
  const plotW = Math.max(320, series.length * 56);
  const plotH = 200;
  const svgW = padding.left + plotW + padding.right;
  const svgH = padding.top + plotH + padding.bottom;

  const xAt = (i: number) => padding.left + (plotW * (i + 0.5)) / Math.max(1, series.length);
  const yAt = (v: number) => padding.top + plotH - ((v - minY) / span) * plotH;

  const points = series.map((s, i) => `${xAt(i)},${yAt(s.y)}`).join(" ");

  const legendBtn = `analysis-legend-btn min-w-0 w-auto p-0 ${isLight ? "analysis-legend-btn--light" : ""}`.trim();

  return (
    <div className="eerr-chart-wrap">
      <div className="analysis-stack-legend eerr-chart-legend">
        <span className={legendBtn} style={{ cursor: "default" }}>
          <span className="analysis-legend-swatch-sm" style={{ background: COL.line }} />
          {mode === "margen" ? "Margen (ingresos − costos)" : "EBITDA (margen − gastos)"}
        </span>
      </div>
      <div className="analysis-stack-svg-scroll">
        <svg
          width={svgW}
          height={svgH}
          className="eerr-chart-svg"
          overflow="visible"
          role="img"
          aria-label="Tendencia EERR"
        >
          <polyline fill="none" stroke={COL.line} strokeWidth={2.5} strokeLinejoin="round" points={points} />
          {series.map((s, i) => (
            <g key={s.label}>
              <circle cx={xAt(i)} cy={yAt(s.y)} r={5} fill={COL.line} className="eerr-line-dot">
                <title>{`${s.label}: ${formatGsFull(s.y)}`}</title>
              </circle>
              <text
                x={xAt(i)}
                y={svgH - 8}
                textAnchor="middle"
                dominantBaseline="middle"
                className="eerr-chart-xlabel"
              >
                {s.label}
              </text>
            </g>
          ))}
          <text x={8} y={padding.top + 12} className="eerr-chart-axis text-[10px]">
            {formatGsCompact(maxY)}
          </text>
          <text x={8} y={padding.top + plotH} className="eerr-chart-axis text-[10px]">
            {formatGsCompact(minY)}
          </text>
        </svg>
      </div>
    </div>
  );
}
