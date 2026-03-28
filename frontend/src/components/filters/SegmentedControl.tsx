"use client";

import React from "react";

export type SegmentedOption = {
  value: string;
  label: string;
};

export type SegmentedControlProps = {
  label: string;
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  id?: string;
  isDisabled?: boolean;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  "aria-label"?: string;
  className?: string;
};

/**
 * Selección única estilo píldora (canon analytics: categoría, vía corta, etc.).
 * Botones nativos + tokens en CSS (gradiente activo, carril neutro).
 */
export function SegmentedControl({
  label,
  options,
  value,
  onChange,
  id,
  isDisabled = false,
  size = "sm",
  fullWidth = true,
  "aria-label": ariaLabel,
  className,
}: SegmentedControlProps) {
  const groupId = id ?? `segmented-${label.replace(/\s+/g, "-").toLowerCase()}`;
  /** Siempre N columnas; sin esto el grid implícito es 1 columna y las opciones se apilan (p. ej. KPI con fullWidth=false). */
  const gridStyle = {
    gridTemplateColumns: `repeat(${Math.max(1, options.length)}, minmax(0, 1fr))`,
  } as React.CSSProperties;

  const sizeClass = size === "lg" ? "analytics-segmented--lg" : size === "md" ? "analytics-segmented--md" : "analytics-segmented--sm";

  return (
    <div
      className={`analytics-segmented ${sizeClass} ${fullWidth ? "analytics-segmented--full" : "analytics-segmented--inline"} ${className ?? ""}`.trim()}
      role="group"
      aria-labelledby={`${groupId}-label`}
    >
      <label id={`${groupId}-label`} className="analytics-segmented__label" htmlFor={groupId}>
        {label}
      </label>
      <div
        id={groupId}
        role="radiogroup"
        aria-label={ariaLabel ?? label}
        aria-labelledby={`${groupId}-label`}
        className="analytics-segmented__track"
        style={gridStyle}
      >
        {options.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.value === "" ? "__all__" : opt.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={opt.label}
              disabled={isDisabled}
              className={`analytics-segmented__option${isSelected ? " analytics-segmented__option--active" : ""}`}
              onClick={() => onChange(opt.value)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
