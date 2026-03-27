import React, { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { formatCount } from "../../shared/formatters";
import { buildCountYAxis } from "./RendimientoStyleCountBarChart";

export type RendimientoStackedPoint = { label: string; a: number; b: number };

type Props = {
  data: RendimientoStackedPoint[];
  aLabel: string;
  bLabel: string;
  aColor?: string;
  bColor?: string;
  isLight?: boolean;
  labelZoomStorageKey?: string;
};

export function RendimientoStyleStackedColumnChart({
  data,
  aLabel,
  bLabel,
  aColor = "var(--color-chart-1)",
  bColor = "var(--color-chart-5)",
  isLight = false,
  labelZoomStorageKey,
}: Props) {
  const [hidden, setHidden] = useState<{ a: boolean; b: boolean }>({ a: false, b: false });
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [showBarPercent, setShowBarPercent] = useState<boolean>(() => {
    if (!labelZoomStorageKey) return true;
    const raw = window.localStorage.getItem(`${labelZoomStorageKey}_show_pct`);
    if (raw == null) return true;
    return raw === "1";
  });
  const [showBarNumbers, setShowBarNumbers] = useState<boolean>(() => {
    if (!labelZoomStorageKey) return true;
    const raw = window.localStorage.getItem(`${labelZoomStorageKey}_show_num`);
    if (raw == null) return true;
    return raw === "1";
  });
  const [labelZoom, setLabelZoom] = useState<number>(() => {
    if (!labelZoomStorageKey) return 100;
    const raw = window.localStorage.getItem(labelZoomStorageKey);
    const parsed = Number(raw || 100);
    if (!Number.isFinite(parsed)) return 100;
    return Math.min(200, Math.max(70, parsed));
  });

  useEffect(() => {
    if (!labelZoomStorageKey) return;
    window.localStorage.setItem(labelZoomStorageKey, String(labelZoom));
  }, [labelZoom, labelZoomStorageKey]);
  useEffect(() => {
    if (!labelZoomStorageKey) return;
    window.localStorage.setItem(`${labelZoomStorageKey}_show_pct`, showBarPercent ? "1" : "0");
  }, [showBarPercent, labelZoomStorageKey]);
  useEffect(() => {
    if (!labelZoomStorageKey) return;
    window.localStorage.setItem(`${labelZoomStorageKey}_show_num`, showBarNumbers ? "1" : "0");
  }, [showBarNumbers, labelZoomStorageKey]);

  const rowTotals = data.map((d) => (hidden.a ? 0 : Number(d.a || 0)) + (hidden.b ? 0 : Number(d.b || 0)));
  const { axisMax, yTicks } = buildCountYAxis(rowTotals);
  const leftGutter = Math.max(
    46,
    10 + Math.max(...yTicks.map((t) => formatCount(t).length), 1) * 6.4,
  );
  const n = data.length;
  const verticalXLabels = n > 10 || data.some((p) => (p.label || "").length > 10);
  const maxLabLen = Math.max(...data.map((p) => [...(p.label || "")].length), 1);
  const bottomPad = verticalXLabels ? Math.min(120, 20 + Math.min(maxLabLen, 14) * 5) : 52;
  const labelZoomScale = Math.max(0.7, Math.min(2, labelZoom / 100));
  const fontLabel = Math.max(8, Math.min(14, 10 * labelZoomScale));
  const lineHeightLabel = Math.max(12, fontLabel * 1.18);
  /** Espacio superior para líneas de métrica encima de la barra (sin recortar). */
  const topPad =
    20 + (showBarPercent || showBarNumbers ? Math.ceil(6 + 2 * lineHeightLabel) : 0);
  const padding = { top: topPad, right: 18, bottom: bottomPad, left: leftGutter };
  const plotH = Math.max(1, 310 - padding.top - padding.bottom);
  let gap = n <= 1 ? 0 : 10;
  /** Ancho del área de barras: crece con la cantidad de meses (scroll horizontal en el card). */
  let plotInnerW = Math.max(400, n * 48 + Math.max(0, n - 1) * gap);
  let barWidth = (plotInnerW - Math.max(0, n - 1) * gap) / Math.max(1, n);
  if (barWidth < 6 && n > 1) {
    gap = Math.max(3, Math.floor((plotInnerW - n * 6) / Math.max(1, n - 1)));
    barWidth = Math.max(4, (plotInnerW - (n - 1) * gap) / n);
  }
  const svgWidth = padding.left + plotInnerW + padding.right;
  const svgHeight = 310;
  const baselineY = svgHeight - padding.bottom;

  const legendBtnClass = `analysis-legend-btn min-w-0 w-auto p-0 ${isLight ? "analysis-legend-btn--light" : ""}`.trim();
  const zoomOutDisabled = labelZoom <= 70;
  const zoomInDisabled = labelZoom >= 200;
  const showAnyBarDetail = showBarPercent || showBarNumbers;
  const stackWrapStyle = { "--analysis-stack-label-zoom": String(labelZoomScale) } as React.CSSProperties;
  const chartMinWidth = Math.max(320, Math.round(svgWidth));

  const cornerR = (bw: number, h: number) =>
    Math.min(10, bw * 0.38, h > 1 ? Math.max(h * 0.12, 2) : 0);

  return (
    <div className="analysis-stack-wrap" style={stackWrapStyle}>
      <div className="analysis-stack-legend">
        <Button
          size="sm"
          variant="ghost"
          className={legendBtnClass}
          data-hidden={hidden.a ? "true" : undefined}
          aria-label={hidden.a ? "Mostrar serie" : "Ocultar serie"}
          onPress={() => setHidden((s) => ({ ...s, a: !s.a }))}
        >
          <span className="analysis-legend-swatch-sm" style={{ background: aColor }} />
          {aLabel}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={legendBtnClass}
          data-hidden={hidden.b ? "true" : undefined}
          aria-label={hidden.b ? "Mostrar serie" : "Ocultar serie"}
          onPress={() => setHidden((s) => ({ ...s, b: !s.b }))}
        >
          <span className="analysis-legend-swatch-sm" style={{ background: bColor }} />
          {bLabel}
        </Button>
        <div className="analysis-stack-detail-controls">
          <span className="analysis-stack-detail-label">Etiquetas:</span>
          <Button
            size="sm"
            variant="ghost"
            className={`${legendBtnClass} analysis-stack-detail-btn`.trim()}
            data-hidden={!showBarPercent ? "true" : undefined}
            aria-label="Mostrar u ocultar porcentajes en barras"
            onPress={() => setShowBarPercent((prev) => !prev)}
          >
            Ver %
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={`${legendBtnClass} analysis-stack-detail-btn`.trim()}
            data-hidden={!showBarNumbers ? "true" : undefined}
            aria-label="Mostrar u ocultar números en barras"
            onPress={() => setShowBarNumbers((prev) => !prev)}
          >
            Ver #
          </Button>
        </div>
        <div className="analysis-stack-zoom">
          <span className="analysis-stack-zoom-label">Zoom etiquetas</span>
          <Button
            size="sm"
            variant="ghost"
            className={legendBtnClass}
            isDisabled={zoomOutDisabled}
            onPress={() => setLabelZoom((prev) => Math.max(70, prev - 10))}
            aria-label="Reducir zoom de etiquetas"
          >
            -
          </Button>
          <span className="analysis-stack-zoom-value">{labelZoom}%</span>
          <Button
            size="sm"
            variant="ghost"
            className={legendBtnClass}
            isDisabled={zoomInDisabled}
            onPress={() => setLabelZoom((prev) => Math.min(200, prev + 10))}
            aria-label="Aumentar zoom de etiquetas"
          >
            +
          </Button>
        </div>
      </div>
      <div className="analysis-stack-hoverline">
        {(() => {
          if (!hoveredLabel) {
            return <span className="analysis-hover-hint">Pasá el mouse sobre una barra para ver porcentajes</span>;
          }
          const row = data.find((d) => d.label === hoveredLabel);
          const a = hidden.a ? 0 : Number(row?.a || 0);
          const b = hidden.b ? 0 : Number(row?.b || 0);
          const total = Math.max(1, a + b);
          const aPct = ((a / total) * 100).toFixed(1);
          const bPct = ((b / total) * 100).toFixed(1);
          return (
            <>
              <span className="analysis-stack-hover-label">{hoveredLabel}</span>
              <span className="analysis-stack-hover-badge">
                <span className="analysis-legend-swatch-xs" style={{ background: aColor }} />
                {aLabel}: {formatCount(a)} ({aPct}%)
              </span>
              <span className="analysis-stack-hover-badge">
                <span className="analysis-legend-swatch-xs" style={{ background: bColor }} />
                {bLabel}: {formatCount(b)} ({bPct}%)
              </span>
            </>
          );
        })()}
      </div>
      <div className="analysis-chart-scroll">
        <div className="rend-count-bar-chart" style={{ minWidth: chartMinWidth }}>
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="rend-chart-svg rend-stack-svg"
            role="img"
            aria-label={`${aLabel} y ${bLabel} por período`}
            width="100%"
            preserveAspectRatio="xMidYMid meet"
          >
            {yTicks.map((tick) => {
              const y = padding.top + (1 - tick / axisMax) * plotH;
              return (
                <g key={tick}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={svgWidth - padding.right}
                    y2={y}
                    className="rend-grid-line"
                  />
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
              y2={baselineY}
              className="rend-axis-line"
            />
            <line
              x1={padding.left}
              y1={baselineY}
              x2={svgWidth - padding.right}
              y2={baselineY}
              className="rend-axis-line"
            />
            {data.map((d, index) => {
              const a = hidden.a ? 0 : Number(d.a || 0);
              const b = hidden.b ? 0 : Number(d.b || 0);
              const rowTotal = Math.max(1, a + b);
              const aShare = ((a / rowTotal) * 100).toFixed(1);
              const bShare = ((b / rowTotal) * 100).toFixed(1);
              const ha = (a / axisMax) * plotH;
              const hb = (b / axisMax) * plotH;
              const x0 = padding.left + index * (barWidth + gap);
              const cx = x0 + barWidth / 2;
              const yA0 = baselineY - ha;
              const yB0 = baselineY - ha - hb;
              const rA = cornerR(barWidth, ha);
              const rB = cornerR(barWidth, hb);
              const aDetail =
                showBarPercent && showBarNumbers
                  ? `V ${aShare}% ${formatCount(a)}`
                  : showBarPercent
                    ? `V ${aShare}%`
                    : `V ${formatCount(a)}`;
              const bDetail =
                showBarPercent && showBarNumbers
                  ? `M ${bShare}% ${formatCount(b)}`
                  : showBarPercent
                    ? `M ${bShare}%`
                    : `M ${formatCount(b)}`;
              const lx = cx;
              const ly = baselineY + (verticalXLabels ? 8 : 16);
              const isHovered = hoveredLabel === d.label;
              const stackTopY = baselineY - ha - hb;
              const gapAboveBar = 5;
              const baseLineAboveBar = stackTopY - gapAboveBar;
              const labelLines: string[] = [];
              if (!hidden.b && b > 0) labelLines.push(bDetail);
              if (!hidden.a && a > 0) labelLines.push(aDetail);
              const showStackLabels = showAnyBarDetail && labelLines.length > 0;
              const labelStartY = baseLineAboveBar - (labelLines.length - 1) * lineHeightLabel;

              return (
                <g key={d.label}>
                  <g
                    className="rend-vbar-hover-target rend-stack-col"
                    style={{
                      opacity: isHovered ? 1 : 0.97,
                      transition: "opacity 0.16s ease",
                    }}
                    onMouseEnter={() => setHoveredLabel(d.label)}
                    onMouseLeave={() => setHoveredLabel((prev) => (prev === d.label ? null : prev))}
                  >
                    {ha > 0.5 ? (
                      <rect
                        x={x0}
                        y={yA0}
                        width={barWidth}
                        height={ha}
                        rx={rA}
                        ry={rA}
                        fill={aColor}
                        className="rend-vbar-fill"
                      />
                    ) : null}
                    {hb > 0.5 ? (
                      <rect
                        x={x0}
                        y={yB0}
                        width={barWidth}
                        height={hb}
                        rx={rB}
                        ry={rB}
                        fill={bColor}
                        className="rend-vbar-fill"
                      />
                    ) : null}
                    {showStackLabels ? (
                      <text
                        textAnchor="middle"
                        className="rend-vbar-pct-label rend-vbar-outlabel rend-stack-bar-label"
                        style={{ fontSize: fontLabel, fontWeight: 600 }}
                      >
                        {labelLines.map((line, li) => (
                          <tspan key={`${d.label}-lbl-${li}`} x={cx} y={labelStartY + li * lineHeightLabel}>
                            {line}
                          </tspan>
                        ))}
                      </text>
                    ) : null}
                  </g>
                  <text
                    x={lx}
                    y={ly}
                    textAnchor={verticalXLabels ? "end" : "middle"}
                    dominantBaseline={verticalXLabels ? "middle" : "auto"}
                    className="rend-axis-text"
                    fontSize={verticalXLabels ? 9 : 10}
                    transform={verticalXLabels ? `rotate(-90 ${lx} ${ly})` : undefined}
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
