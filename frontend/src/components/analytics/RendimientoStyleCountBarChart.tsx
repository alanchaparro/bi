import React, { useEffect, useMemo, useState } from "react";
import { formatCount } from "../../shared/formatters";

export type RendimientoStyleCountBarPoint = { label: string; value: number };

function formatSharePct(value: number, total: number): string {
  return `${((Number(value || 0) / Math.max(1, Number(total || 0))) * 100).toFixed(1)}%`;
}

/** Eje Y en unidades de conteo, con cabeza sobre el máximo para separar barras cercanas al tope. */
export function buildCountYAxis(values: Iterable<number>): { axisMax: number; yTicks: number[] } {
  let m = 0;
  for (const v of values) {
    if (Number.isFinite(v)) m = Math.max(m, v);
  }
  m = Math.max(0, m);
  if (m <= 0) {
    return { axisMax: 5, yTicks: [0, 1, 2, 3, 4, 5] };
  }
  const target = m * 1.12;
  const rawStep = target / 4;
  const pow10 = 10 ** Math.floor(Math.log10(Math.max(rawStep, 1e-9)));
  const norm = rawStep / pow10;
  let f = 1;
  if (norm > 5) f = 10;
  else if (norm > 2) f = 5;
  else if (norm > 1) f = 2;
  else f = 1;
  const step = f * pow10;
  const axisMax = Math.max(step, Math.ceil(target / step) * step);
  const yTicks: number[] = [];
  for (let t = 0; t <= axisMax + 1e-9; t += step) {
    yTicks.push(Math.round(t));
  }
  return { axisMax, yTicks };
}

type Props = {
  data: RendimientoStyleCountBarPoint[];
  colors?: string[];
  color?: string;
  showLabels?: boolean;
  ariaLabel: string;
  /** `grid`: varias columnas (ancho completo). `vertical`: lista en una columna (p. ej. junto a la dona). */
  legendLayout?: "grid" | "vertical";
};

export function RendimientoStyleCountBarChart({
  data,
  colors,
  color,
  showLabels = true,
  ariaLabel,
  legendLayout = "grid",
}: Props) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const labels = new Set(data.map((d) => d.label));
    setHidden((prev) => {
      const next: Record<string, boolean> = {};
      Object.entries(prev).forEach(([k, v]) => {
        if (labels.has(k)) next[k] = v;
      });
      return next;
    });
  }, [data]);

  const toggle = (label: string) => setHidden((prev) => ({ ...prev, [label]: !prev[label] }));

  const visibleRows = useMemo(() => data.filter((d) => !hidden[d.label]), [data, hidden]);
  const totalAll = useMemo(
    () => Math.max(1, data.reduce((acc, d) => acc + Number(d.value || 0), 0)),
    [data],
  );

  const barFill = (indexInFull: number) => {
    if (colors?.length) return colors[indexInFull % colors.length];
    return color || "var(--color-chart-1)";
  };

  if (!data.length) {
    return null;
  }

  const width = 980;
  /** Mayor altura útil dentro del card (las barras ganan proporción respecto al bloque leyenda). */
  const height = 320;
  /** Muchas categorías o etiquetas largas: eje X con texto vertical (-90°), más legible que diagonal. */
  const verticalXLabels =
    visibleRows.length > 5 || visibleRows.some((p) => (p.label || "").length > 12);
  const { axisMax, yTicks } =
    visibleRows.length > 0
      ? buildCountYAxis(visibleRows.map((p) => p.value))
      : { axisMax: 1, yTicks: [0, 1] };
  const leftGutter = Math.max(
    42,
    10 + Math.max(...yTicks.map((t) => formatCount(t).length), 1) * 6.4,
  );
  const maxCategoryLabelChars = Math.max(
    ...visibleRows.map((p) => [...(p.label || "")].length),
    1,
  );
  /** Espacio bajo el eje: con etiquetas verticales el ancho del texto pasa a ocupar altura. */
  const bottomPad = verticalXLabels
    ? Math.min(132, 22 + Math.min(maxCategoryLabelChars, 28) * 5.5)
    : 56;
  const padding = { top: 28, right: 16, bottom: bottomPad, left: leftGutter };
  const plotW = Math.max(1, width - padding.left - padding.right);
  const plotH = Math.max(1, height - padding.top - padding.bottom);
  const nBars = Math.max(1, visibleRows.length);
  /** Reparte todo el ancho útil del plot (sin tope tipo 36px que dejaba el gráfico en un rincón con pocas categorías). */
  let gap = nBars <= 1 ? 0 : 10;
  let barWidth = (plotW - Math.max(0, nBars - 1) * gap) / nBars;
  if (barWidth < 6 && nBars > 1) {
    gap = Math.max(3, Math.floor((plotW - nBars * 6) / Math.max(1, nBars - 1)));
    barWidth = (plotW - (nBars - 1) * gap) / nBars;
  }
  barWidth = Math.max(4, barWidth);
  const labelStep = visibleRows.length > 18 ? Math.ceil(visibleRows.length / 18) : 1;

  const legendTextColor = "var(--color-text)";
  const legendMutedColor = "var(--color-text-muted)";

  return (
    <div className="rend-count-bar-chart">
      {!visibleRows.length ? (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="rend-chart-svg"
          role="img"
          aria-label={ariaLabel}
          width="100%"
          preserveAspectRatio="xMidYMid meet"
        >
          <text
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            className="rend-axis-text"
            fontSize="13"
          >
            Activá al menos una categoría en la leyenda inferior.
          </text>
        </svg>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="rend-chart-svg"
          role="img"
          aria-label={ariaLabel}
          width="100%"
          preserveAspectRatio="xMidYMid meet"
        >
          {yTicks.map((tick) => {
            const y = padding.top + (1 - tick / axisMax) * plotH;
            return (
              <g key={tick}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="rend-grid-line" />
                <text x={padding.left - 8} y={y + 4} textAnchor="end" className="rend-axis-text">
                  {formatCount(tick)}
                </text>
              </g>
            );
          })}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={height - padding.bottom}
            className="rend-axis-line"
          />
          <line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            className="rend-axis-line"
          />
          {visibleRows.map((point, index) => {
            const fullIdx = data.findIndex((d) => d.label === point.label);
            const idx = fullIdx < 0 ? index : fullIdx;
            const x = padding.left + index * (barWidth + gap);
            const value = Math.max(0, point.value);
            const barHeight = (Math.min(value, axisMax) / axisMax) * plotH;
            const y = height - padding.bottom - barHeight;
            const cornerR = Math.min(10, barWidth * 0.42, barHeight > 1 ? Math.max(barHeight * 0.18, 3) : 0);
            const showX = index % labelStep === 0 || index === visibleRows.length - 1;
            const cx = x + barWidth / 2;
            const labelAboveY = y - 6;
            const putInside = showLabels && labelAboveY < padding.top + 2 && barHeight > 16;
            const lx = cx;
            const categoryLabelY = height - padding.bottom + (verticalXLabels ? 10 : 18);
            return (
              <g key={`${point.label}-${index}`}>
                <g className="rend-vbar-hover-target">
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(barHeight, 0)}
                    rx={cornerR}
                    ry={cornerR}
                    fill={barFill(idx)}
                    opacity={0.96}
                    className="rend-vbar-fill"
                  />
                  {showLabels && barHeight > 12 ? (
                    <text
                      x={cx}
                      y={putInside ? y + 15 : labelAboveY}
                      textAnchor="middle"
                      className={`rend-vbar-pct-label ${putInside ? "rend-vbar-inlabel" : "rend-vbar-outlabel"}`}
                      fontSize="11"
                      fontWeight={600}
                    >
                      {formatCount(value)}
                    </text>
                  ) : null}
                </g>
                {showX ? (
                  <text
                    x={lx}
                    y={categoryLabelY}
                    textAnchor={verticalXLabels ? "end" : "middle"}
                    dominantBaseline={verticalXLabels ? "middle" : "auto"}
                    className="rend-axis-text"
                    fontSize={verticalXLabels ? 10 : 11}
                    transform={verticalXLabels ? `rotate(-90 ${lx} ${categoryLabelY})` : undefined}
                  >
                    {point.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      )}
      <div
        className={`analysis-donut-legend ${legendLayout === "vertical" ? "rend-count-bar-legend-vertical" : "rend-count-bar-legend-grid"}`.trim()}
        style={{ marginTop: "0.5rem" }}
      >
        {data.map((d, idx) => {
          const isHidden = !!hidden[d.label];
          return (
            <button
              key={d.label}
              type="button"
              onClick={() => toggle(d.label)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                marginBottom: "0.25rem",
                background: "transparent",
                border: "none",
                color: isHidden ? legendMutedColor : legendTextColor,
                cursor: "pointer",
                textDecoration: isHidden ? "line-through" : "none",
                padding: 0,
              }}
              title={isHidden ? "Mostrar serie" : "Ocultar serie"}
            >
              <span className="analysis-legend-swatch" style={{ background: barFill(idx) }} />
              <span>
                {d.label}: {formatCount(d.value)} ({formatSharePct(d.value, totalAll)})
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
