import React, { useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { formatCount } from "../../shared/formatters";

export type RoloMonthlyTrendPoint = {
  mes: string;
  vigente_inicial: number;
  ventas_nuevas: number;
  recuperados_a_vigente: number;
  culminados_vigentes: number;
  caidos_a_moroso: number;
  neto_rolo: number;
  vigente_final: number;
};

type Props = {
  data: RoloMonthlyTrendPoint[];
  isLight: boolean;
};

const SERIES_CONFIG: {
  key: keyof Omit<RoloMonthlyTrendPoint, "mes">;
  label: string;
  color: string;
}[] = [
  { key: "ventas_nuevas", label: "Ventas nuevas", color: "var(--color-chart-1)" },
  { key: "recuperados_a_vigente", label: "Recuperados", color: "var(--color-chart-4)" },
  { key: "culminados_vigentes", label: "Culminados", color: "var(--color-chart-2)" },
  { key: "caidos_a_moroso", label: "Caídos a moroso", color: "var(--color-state-error)" },
  { key: "neto_rolo", label: "Neto rolo", color: "var(--color-chart-3)" },
];

export function RoloMonthlyTrendChart({ data, isLight }: Props) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  const visibleSeries = useMemo(
    () => SERIES_CONFIG.filter((s) => !hidden[s.key]),
    [hidden],
  );

  const { minY, maxY, yTicks } = useMemo(() => {
    const vals: number[] = [];
    for (const d of data) {
      for (const s of visibleSeries) {
        vals.push(Number(d[s.key] || 0));
      }
    }
    const rawMin = vals.length ? Math.min(...vals) : 0;
    const rawMax = vals.length ? Math.max(...vals) : 0;
    const span = Math.max(rawMax - rawMin, 1);
    const pad = span * 0.12;
    const minY = Math.min(0, rawMin - pad);
    const maxY = rawMax + pad;
    const fullSpan = maxY - minY;

    const tickCount = 5;
    const step = fullSpan / tickCount;
    const pow10 = 10 ** Math.floor(Math.log10(Math.max(step, 1e-9)));
    const norm = step / pow10;
    let f = 1;
    if (norm > 5) f = 10;
    else if (norm > 2) f = 5;
    else if (norm > 1) f = 2;
    else f = 1;
    const niceStep = f * pow10;
    const start = Math.floor(minY / niceStep) * niceStep;
    const ticks: number[] = [];
    for (let t = start; t <= maxY + niceStep / 2; t += niceStep) {
      ticks.push(Math.round(t));
    }
    return { minY, maxY, yTicks: ticks };
  }, [data, visibleSeries]);

  const n = data.length;
  if (n === 0) {
    return <p className="eerr-chart-empty">Sin datos para la tendencia mensual.</p>;
  }

  const padding = { top: 16, right: 16, bottom: 64, left: 56 };
  const plotH = 220;
  const pointSpacing = 72;
  const plotW = Math.max(320, n * pointSpacing);
  const svgW = padding.left + plotW + padding.right;
  const svgH = plotH + padding.top + padding.bottom;
  const baseline = padding.top + plotH;
  const spanY = Math.max(maxY - minY, 1);

  const xAt = (i: number) => padding.left + (plotW * (i + 0.5)) / Math.max(1, n);
  const yAt = (v: number) => baseline - ((v - minY) / spanY) * plotH;

  const legendBtn = `analysis-legend-btn min-w-0 w-auto p-0 ${isLight ? "analysis-legend-btn--light" : ""}`.trim();

  return (
    <div className="eerr-chart-wrap">
      <div className="analysis-stack-legend eerr-chart-legend">
        {SERIES_CONFIG.map((s) => (
          <Button
            key={s.key}
            size="sm"
            variant="ghost"
            className={legendBtn}
            data-hidden={hidden[s.key] ? "true" : undefined}
            onPress={() => setHidden((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
          >
            <span className="analysis-legend-swatch-sm" style={{ background: s.color }} />
            {s.label}
          </Button>
        ))}
      </div>
      <div className="analysis-stack-svg-scroll">
        <svg
          width={svgW}
          height={svgH}
          className="eerr-chart-svg"
          overflow="visible"
          role="img"
          aria-label="Tendencia mensual del rolo de cartera"
        >
          {/* Grid horizontal + labels eje Y */}
          {yTicks.map((t) => {
            const y = yAt(t);
            return (
              <g key={`grid-${t}`}>
                <line
                  x1={padding.left}
                  x2={svgW - padding.right}
                  y1={y}
                  y2={y}
                  className="eerr-chart-gridline"
                />
                <text
                  x={padding.left - 6}
                  y={y + 4}
                  textAnchor="end"
                  className="eerr-chart-axis"
                >
                  {formatCount(t)}
                </text>
              </g>
            );
          })}

          {/* Líneas de series */}
          {visibleSeries.map((s) => {
            const points = data.map((d, i) => `${xAt(i)},${yAt(Number(d[s.key] || 0))}`).join(" ");
            return (
              <g key={s.key}>
                <polyline
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={points}
                />
                {data.map((d, i) => {
                  const v = Number(d[s.key] || 0);
                  return (
                    <circle
                      key={`${s.key}-${i}`}
                      cx={xAt(i)}
                      cy={yAt(v)}
                      r={4}
                      fill={s.color}
                      className="eerr-line-dot"
                    >
                      <title>{`${s.label} — ${d.mes}: ${formatCount(v)}`}</title>
                    </circle>
                  );
                })}
              </g>
            );
          })}

          {/* Eje X labels */}
          {data.map((d, i) => (
            <text
              key={`xlabel-${i}`}
              x={xAt(i)}
              y={baseline + 18}
              textAnchor="middle"
              className="eerr-chart-xlabel"
              transform={`rotate(-45 ${xAt(i)} ${baseline + 18})`}
            >
              {d.mes}
            </text>
          ))}

          {/* Línea base */}
          {minY <= 0 && maxY >= 0 && (
            <line
              x1={padding.left}
              x2={svgW - padding.right}
              y1={yAt(0)}
              y2={yAt(0)}
              className="eerr-chart-baseline"
            />
          )}
        </svg>
      </div>
    </div>
  );
}
