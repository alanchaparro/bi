import React, { useEffect, useMemo, useState } from "react";
import { formatCount } from "../../shared/formatters";

export type RendimientoStyleCountBarPoint = { label: string; value: number };

function formatSharePct(value: number, total: number): string {
  return `${((Number(value || 0) / Math.max(1, Number(total || 0))) * 100).toFixed(1)}%`;
}

export type BuildCountYAxisOptions = {
  /** Cabeza sobre el máximo real (por defecto 1.12). */
  headroom?: number;
  /**
   * Si el tope “redondeado” deja mucho aire (p. ej. 300k con datos ~194k),
   * reduce el paso del eje hasta acercar el máximo al rango real.
   */
  axisTight?: boolean;
  /** Con `axisTight`: seguir afinando mientras `axisMax / max(datos)` supere este ratio (por defecto 1.22; ~1.06 = casi sin aire). */
  maxAxisToDataRatio?: number;
  /**
   * Tope de marcas en el eje Y (evita pasos de 1 con `axisTight` y valores ~200k → miles de números apilados).
   * Por defecto 10.
   */
  maxYTicks?: number;
};

/** Paso “legible” ≥ minStep (1 / 2 / 5 × 10ⁿ). */
function niceStepAtLeast(minStep: number): number {
  const ms = Math.max(minStep, 1e-9);
  const pow10 = 10 ** Math.floor(Math.log10(ms));
  const norm = ms / pow10;
  let f = 1;
  if (norm > 5) f = 10;
  else if (norm > 2) f = 5;
  else if (norm > 1) f = 2;
  else f = 1;
  return f * pow10;
}

/** Eje en unidades de conteo, con cabeza sobre el máximo para separar valores cercanos al tope. */
export function buildCountYAxis(
  values: Iterable<number>,
  options?: BuildCountYAxisOptions,
): { axisMax: number; yTicks: number[] } {
  let m = 0;
  for (const v of values) {
    if (Number.isFinite(v)) m = Math.max(m, v);
  }
  m = Math.max(0, m);
  if (m <= 0) {
    return { axisMax: 5, yTicks: [0, 1, 2, 3, 4, 5] };
  }
  const headroom = options?.headroom ?? 1.12;
  const target = m * headroom;
  const maxYTicks = Math.max(4, Math.min(16, options?.maxYTicks ?? 10));
  const minStepFloor = niceStepAtLeast(target / Math.max(2, maxYTicks - 1));

  const rawStep = target / 4;
  const pow10 = 10 ** Math.floor(Math.log10(Math.max(rawStep, 1e-9)));
  const norm = rawStep / pow10;
  let f = 1;
  if (norm > 5) f = 10;
  else if (norm > 2) f = 5;
  else if (norm > 1) f = 2;
  else f = 1;
  let step = Math.max(f * pow10, minStepFloor);
  let axisMax = Math.max(step, Math.ceil(target / step) * step);

  if (options?.axisTight) {
    const maxRatio = options.maxAxisToDataRatio ?? 1.22;
    let guard = 0;
    while (axisMax > m * maxRatio && step > 1e-9 && guard < 28) {
      guard += 1;
      const newStep = step / 2;
      if (newStep < 1) break;
      if (newStep < minStepFloor) break;
      const newMax = Math.max(m, Math.ceil(target / newStep) * newStep);
      if (newMax < axisMax - 0.5 && newMax >= m * 0.999) {
        step = newStep;
        axisMax = newMax;
      } else {
        break;
      }
    }
  }

  const buildTicks = (s: number, max: number) => {
    const ticks: number[] = [];
    for (let t = 0; t <= max + 1e-9; t += s) {
      ticks.push(Math.round(t));
    }
    return ticks;
  };

  let yTicks = buildTicks(step, axisMax);

  if (yTicks.length > maxYTicks) {
    step = niceStepAtLeast(axisMax / Math.max(2, maxYTicks - 1));
    step = Math.max(step, minStepFloor);
    axisMax = Math.max(step, Math.ceil(target / step) * step);
    yTicks = buildTicks(step, axisMax);
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
  /**
   * `column`: barras que suben (eje Y = valor). `horizontal`: barras hacia la derecha (años al costado, sin rotar texto).
   * Útil para años u otras etiquetas largas junto a la dona.
   */
  barOrientation?: "column" | "horizontal";
  /** Eje de valores más ajustado al máximo real (menos “aire” a la derecha o arriba). */
  tightValueAxis?: boolean;
  /** Alto del viewBox SVG en modo columnas (por defecto 320). */
  viewBoxHeight?: number;
  /** En columnas: años u otras etiquetas cortas en horizontal bajo el eje (sin rotar -90°). */
  horizontalCategoryLabels?: boolean;
};

export function RendimientoStyleCountBarChart({
  data,
  colors,
  color,
  showLabels = true,
  ariaLabel,
  legendLayout = "grid",
  barOrientation = "column",
  tightValueAxis = false,
  viewBoxHeight: viewBoxHeightProp,
  horizontalCategoryLabels = false,
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

  const axisTightOn =
    barOrientation === "horizontal" || tightValueAxis;
  const { axisMax, yTicks } =
    visibleRows.length > 0
      ? buildCountYAxis(visibleRows.map((p) => p.value), {
          axisTight: axisTightOn,
          headroom: axisTightOn ? (tightValueAxis ? 1.04 : 1.08) : undefined,
          maxAxisToDataRatio: tightValueAxis ? 1.055 : barOrientation === "horizontal" ? 1.12 : undefined,
        })
      : { axisMax: 1, yTicks: [0, 1] };

  const legendTextColor = "var(--color-text)";
  const legendMutedColor = "var(--color-text-muted)";

  const legendSection = (
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
  );

  const width = 980;

  /** Barras horizontales: categoría a la izquierda (texto normal), valor en el eje X. */
  if (barOrientation === "horizontal") {
    const paddingH = { top: 18, right: 20, bottom: 42, left: 10 };
    const labelLens =
      visibleRows.length > 0
        ? visibleRows.map((p) => [...String(p.label || "")].length)
        : [4];
    const labelColW = Math.max(44, 10 + Math.max(...labelLens, 1) * 6.6);
    const axisX0 = paddingH.left + labelColW;
    const plotW = Math.max(120, width - axisX0 - paddingH.right);
    const nH = Math.max(1, visibleRows.length);
    const gapH = nH > 14 ? 5 : 7;
    const barThickness = Math.max(13, Math.min(26, Math.floor((268 - (nH - 1) * gapH) / Math.max(1, nH))));
    const plotH = nH * barThickness + Math.max(0, nH - 1) * gapH;
    const svgHeight = paddingH.top + plotH + paddingH.bottom;

    return (
      <div className="rend-count-bar-chart">
        {!visibleRows.length ? (
          <svg
            viewBox={`0 0 ${width} ${svgHeight}`}
            className="rend-chart-svg"
            role="img"
            aria-label={ariaLabel}
            width="100%"
            preserveAspectRatio="xMidYMid meet"
          >
            <text
              x={width / 2}
              y={svgHeight / 2}
              textAnchor="middle"
              className="rend-axis-text"
              fontSize="13"
            >
              Activá al menos una categoría en la leyenda inferior.
            </text>
          </svg>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${svgHeight}`}
            className="rend-chart-svg rend-hbar-svg"
            role="img"
            aria-label={ariaLabel}
            width="100%"
            preserveAspectRatio="xMidYMid meet"
          >
            {yTicks.map((tick) => {
              const gx = axisX0 + (tick / axisMax) * plotW;
              return (
                <g key={`xtick-${tick}`}>
                  <line
                    x1={gx}
                    y1={paddingH.top}
                    x2={gx}
                    y2={paddingH.top + plotH}
                    className="rend-grid-line"
                  />
                  <text
                    x={gx}
                    y={paddingH.top + plotH + 20}
                    textAnchor="middle"
                    className="rend-axis-text"
                  >
                    {formatCount(tick)}
                  </text>
                </g>
              );
            })}
            <line
              x1={axisX0}
              y1={paddingH.top}
              x2={axisX0}
              y2={paddingH.top + plotH}
              className="rend-axis-line"
            />
            <line
              x1={axisX0}
              y1={paddingH.top + plotH}
              x2={axisX0 + plotW}
              y2={paddingH.top + plotH}
              className="rend-axis-line"
            />
            {visibleRows.map((point, index) => {
              const fullIdx = data.findIndex((d) => d.label === point.label);
              const idx = fullIdx < 0 ? index : fullIdx;
              const value = Math.max(0, point.value);
              const barLen = (Math.min(value, axisMax) / axisMax) * plotW;
              const y = paddingH.top + index * (barThickness + gapH);
              const cy = y + barThickness / 2;
              const cornerR = Math.min(
                10,
                barThickness * 0.42,
                barLen > 1 ? Math.max(barLen * 0.1, 3) : 0,
              );
              const labelRight = axisX0 + barLen + 6;
              const fitsOutside = showLabels && labelRight < width - paddingH.right - 4;
              return (
                <g key={`${point.label}-h-${index}`}>
                  <text
                    x={axisX0 - 8}
                    y={cy + 4}
                    textAnchor="end"
                    className="rend-axis-text"
                    fontSize={11}
                  >
                    {point.label}
                  </text>
                  <g className="rend-vbar-hover-target">
                    <rect
                      x={axisX0}
                      y={y}
                      width={Math.max(barLen, 0)}
                      height={barThickness}
                      rx={cornerR}
                      ry={cornerR}
                      fill={barFill(idx)}
                      opacity={0.96}
                      className="rend-vbar-fill"
                    />
                    {showLabels && barLen > 10 && fitsOutside ? (
                      <text
                        x={labelRight}
                        y={cy + 4}
                        textAnchor="start"
                        className="rend-vbar-pct-label rend-vbar-outlabel"
                        fontSize={11}
                        fontWeight={600}
                      >
                        {formatCount(value)}
                      </text>
                    ) : null}
                    {showLabels && barLen > 10 && !fitsOutside ? (
                      <text
                        x={axisX0 + barLen / 2}
                        y={cy + 4}
                        textAnchor="middle"
                        className="rend-vbar-pct-label rend-vbar-inlabel"
                        fontSize={10}
                        fontWeight={600}
                      >
                        {formatCount(value)}
                      </text>
                    ) : null}
                  </g>
                </g>
              );
            })}
          </svg>
        )}
        {legendSection}
      </div>
    );
  }

  /** Mayor altura útil dentro del card (más alto = barras columnas más largas en pantalla). */
  const heightColumn = Math.max(260, Math.min(560, viewBoxHeightProp ?? 320));
  /** Eje X: texto vertical solo si hace falta; `horizontalCategoryLabels` fuerza años legibles sin rotar. */
  const verticalXLabels = horizontalCategoryLabels
    ? false
    : visibleRows.length > 5 || visibleRows.some((p) => (p.label || "").length > 12);
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
  const plotH = Math.max(1, heightColumn - padding.top - padding.bottom);
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

  const columnWrapClass =
    `rend-count-bar-chart${heightColumn >= 400 ? " rend-count-bar-chart--tall" : ""}`.trim();

  return (
    <div className={columnWrapClass}>
      {!visibleRows.length ? (
        <svg
          viewBox={`0 0 ${width} ${heightColumn}`}
          className="rend-chart-svg"
          role="img"
          aria-label={ariaLabel}
          width="100%"
          preserveAspectRatio="xMidYMid meet"
        >
          <text
            x={width / 2}
            y={heightColumn / 2}
            textAnchor="middle"
            className="rend-axis-text"
            fontSize="13"
          >
            Activá al menos una categoría en la leyenda inferior.
          </text>
        </svg>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${heightColumn}`}
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
            y2={heightColumn - padding.bottom}
            className="rend-axis-line"
          />
          <line
            x1={padding.left}
            y1={heightColumn - padding.bottom}
            x2={width - padding.right}
            y2={heightColumn - padding.bottom}
            className="rend-axis-line"
          />
          {visibleRows.map((point, index) => {
            const fullIdx = data.findIndex((d) => d.label === point.label);
            const idx = fullIdx < 0 ? index : fullIdx;
            const x = padding.left + index * (barWidth + gap);
            const value = Math.max(0, point.value);
            const barHeight = (Math.min(value, axisMax) / axisMax) * plotH;
            const y = heightColumn - padding.bottom - barHeight;
            const cornerR = Math.min(10, barWidth * 0.42, barHeight > 1 ? Math.max(barHeight * 0.18, 3) : 0);
            const showX = index % labelStep === 0 || index === visibleRows.length - 1;
            const cx = x + barWidth / 2;
            const labelAboveY = y - 6;
            const putInside = showLabels && labelAboveY < padding.top + 2 && barHeight > 16;
            const lx = cx;
            const categoryLabelY = heightColumn - padding.bottom + (verticalXLabels ? 10 : 18);
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
      {legendSection}
    </div>
  );
}
