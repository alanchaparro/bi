"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { formatCount } from "../../shared/formatters";
import { buildCountYAxis } from "./RendimientoStyleCountBarChart";

const OTHERS_KEY = "Otros";
const MAX_UN = 7;

export type UnByPeriodNested = Record<string, Record<string, number>>;

type Props = {
  periods: string[];
  nested: UnByPeriodNested;
  colors: readonly string[];
  /** Texto corto para el pie (ej. mes de cierre vs gestión). */
  periodAxisHint: string;
  /** Leyenda del desglose al hover (ej. "UN", "vía de cobro"). */
  breakdownEntityLabel?: string;
  isLight?: boolean;
  ariaLabel: string;
};

function formatSharePct(value: number, total: number): string {
  return `${((Number(value || 0) / Math.max(1, Number(total || 0))) * 100).toFixed(1)}%`;
}

export function UnByPeriodStackedColumnChart({
  periods,
  nested,
  colors,
  periodAxisHint,
  breakdownEntityLabel = "UN",
  isLight = false,
  ariaLabel,
}: Props) {
  const model = useMemo(() => {
    const totals = new Map<string, number>();
    for (const p of periods) {
      const slice = nested[p] || {};
      for (const [u, n] of Object.entries(slice)) {
        totals.set(u, (totals.get(u) || 0) + Number(n || 0));
      }
    }
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const top = ranked.slice(0, MAX_UN).map(([u]) => u);
    const rest = ranked.slice(MAX_UN).map(([u]) => u);
    const series = rest.length > 0 ? [...top, OTHERS_KEY] : top;
    const otrosSet = new Set(rest);
    return { series, otrosSet };
  }, [periods, nested]);

  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const labels = new Set(model.series);
    setHidden((prev) => {
      const next: Record<string, boolean> = {};
      for (const k of labels) {
        if (k in prev) next[k] = prev[k]!;
      }
      return next;
    });
  }, [model.series]);

  const sliceValue = useCallback(
    (period: string, series: string) => {
      const slice = nested[period] || {};
      if (series === OTHERS_KEY) {
        let s = 0;
        for (const [u, n] of Object.entries(slice)) {
          if (model.otrosSet.has(u)) s += Number(n || 0);
        }
        return s;
      }
      return Number(slice[series] || 0);
    },
    [nested, model.otrosSet],
  );

  const rowTotals = useMemo(() => {
    return periods.map((p) => {
      let t = 0;
      for (const s of model.series) {
        if (hidden[s]) continue;
        t += sliceValue(p, s);
      }
      return t;
    });
  }, [periods, model.series, hidden, sliceValue]);

  const seriesGrandTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of model.series) {
      let t = 0;
      for (const p of periods) {
        t += sliceValue(p, s);
      }
      m.set(s, t);
    }
    return m;
  }, [periods, model.series, sliceValue]);

  const grandTotal = useMemo(() => {
    let g = 0;
    for (const v of seriesGrandTotals.values()) g += v;
    return Math.max(1, g);
  }, [seriesGrandTotals]);

  const [hoveredPeriod, setHoveredPeriod] = useState<string | null>(null);

  const { axisMax, yTicks } = buildCountYAxis(rowTotals, { axisTight: true, headroom: 1.12 });
  const leftGutter = Math.max(
    46,
    10 + Math.max(...yTicks.map((t) => formatCount(t).length), 1) * 6.4,
  );
  const n = periods.length;
  const verticalXLabels = n > 10 || periods.some((p) => (p || "").length > 10);
  const maxLabLen = Math.max(...periods.map((p) => [...(p || "")].length), 1);
  const bottomPad = verticalXLabels ? Math.min(120, 20 + Math.min(maxLabLen, 14) * 5) : 52;
  const padding = { top: 22, right: 18, bottom: bottomPad, left: leftGutter };
  const plotH = Math.max(1, 300 - padding.top - padding.bottom);
  let gap = n <= 1 ? 0 : 10;
  let plotInnerW = Math.max(400, n * 44 + Math.max(0, n - 1) * gap);
  let barWidth = (plotInnerW - Math.max(0, n - 1) * gap) / Math.max(1, n);
  if (barWidth < 8 && n > 1) {
    gap = Math.max(3, Math.floor((plotInnerW - n * 6) / Math.max(1, n - 1)));
    barWidth = Math.max(5, (plotInnerW - (n - 1) * gap) / n);
  }
  const svgWidth = padding.left + plotInnerW + padding.right;
  const svgHeight = 300;
  const baselineY = svgHeight - padding.bottom;
  const chartMinWidth = Math.max(320, Math.round(svgWidth));

  const legendBtnClass = `analysis-legend-btn min-w-0 w-auto p-0 ${isLight ? "analysis-legend-btn--light" : ""}`.trim();

  const cornerR = (bw: number, h: number) =>
    Math.min(10, bw * 0.38, h > 1 ? Math.max(h * 0.12, 2) : 0);

  if (!periods.length || !model.series.length) {
    return (
      <p className="text-muted-sm" style={{ color: "var(--color-text-muted)" }}>
        No hay datos por {periodAxisHint} para graficar.
      </p>
    );
  }

  return (
    <div className="analysis-stack-wrap">
      <div className="analysis-stack-legend" style={{ flexWrap: "wrap", gap: "0.35rem" }}>
        {model.series.map((s, idx) => {
          const v = seriesGrandTotals.get(s) || 0;
          const isHidden = !!hidden[s];
          return (
            <Button
              key={s}
              size="sm"
              variant="ghost"
              className={legendBtnClass}
              data-hidden={isHidden ? "true" : undefined}
              aria-label={isHidden ? "Mostrar serie" : "Ocultar serie"}
              onPress={() => setHidden((prev) => ({ ...prev, [s]: !prev[s] }))}
            >
              <span className="analysis-legend-swatch-sm" style={{ background: colors[idx % colors.length] }} />
              {s}: {formatCount(v)} ({formatSharePct(v, grandTotal)})
            </Button>
          );
        })}
      </div>
      <p className="text-muted-sm" style={{ marginTop: "0.35rem", color: "var(--color-text-muted)", fontSize: "0.86rem" }}>
        Eje X: mes de {periodAxisHint}. Cada columna es el corte de ese período (no suma entre meses).
      </p>
      <div className="analysis-stack-hoverline" style={{ minHeight: "1.5rem" }}>
        {hoveredPeriod ? (
          (() => {
            const parts = model.series
              .filter((s) => !hidden[s])
              .map((s) => {
                const val = sliceValue(hoveredPeriod, s);
                const idx = model.series.indexOf(s);
                return (
                  <span key={s} className="analysis-stack-hover-badge">
                    <span className="analysis-legend-swatch-xs" style={{ background: colors[idx % colors.length] }} />
                    {s}: {formatCount(val)}
                  </span>
                );
              });
            return (
              <>
                <span className="analysis-stack-hover-label">{hoveredPeriod}</span>
                {parts}
              </>
            );
          })()
        ) : (
          <span className="analysis-hover-hint">
            Pasá el mouse sobre una columna para ver contratos por {breakdownEntityLabel}
          </span>
        )}
      </div>
      <div className="analysis-chart-scroll">
        <div className="rend-count-bar-chart" style={{ minWidth: chartMinWidth }}>
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="rend-chart-svg rend-stack-svg"
            role="img"
            aria-label={ariaLabel}
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
            <line x1={padding.left} y1={padding.top} x2={padding.left} y2={baselineY} className="rend-axis-line" />
            <line
              x1={padding.left}
              y1={baselineY}
              x2={svgWidth - padding.right}
              y2={baselineY}
              className="rend-axis-line"
            />
            {periods.map((period, index) => {
              const x0 = padding.left + index * (barWidth + gap);
              const isHovered = hoveredPeriod === period;
              const visibleSeries = model.series.filter((s) => !hidden[s]);
              const segments: { series: string; h: number; yTop: number; colorIdx: number }[] = [];
              let yBottom = baselineY;
              for (const s of visibleSeries) {
                const raw = sliceValue(period, s);
                const h = raw > 0 ? (Math.min(raw, axisMax) / axisMax) * plotH : 0;
                if (h < 0.5) continue;
                const yTop = yBottom - h;
                const colorIdx = model.series.indexOf(s);
                segments.push({ series: s, h, yTop, colorIdx });
                yBottom = yTop;
              }
              const lx = x0 + barWidth / 2;
              const ly = baselineY + (verticalXLabels ? 8 : 16);
              return (
                <g key={period}>
                  <g
                    className="rend-vbar-hover-target rend-stack-col"
                    style={{
                      opacity: isHovered ? 1 : 0.97,
                      transition: "opacity 0.16s ease",
                    }}
                    onMouseEnter={() => setHoveredPeriod(period)}
                    onMouseLeave={() => setHoveredPeriod((prev) => (prev === period ? null : prev))}
                  >
                    {segments.map((seg) => {
                      const r = cornerR(barWidth, seg.h);
                      return (
                        <rect
                          key={`${period}-${seg.series}`}
                          x={x0}
                          y={seg.yTop}
                          width={barWidth}
                          height={seg.h}
                          rx={r}
                          ry={r}
                          fill={colors[seg.colorIdx % colors.length]}
                          className="rend-vbar-fill"
                        />
                      );
                    })}
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
                    {period}
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
