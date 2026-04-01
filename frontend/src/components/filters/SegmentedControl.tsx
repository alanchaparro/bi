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
  /** Modo inline (p. ej. toggles compactos): grid por contenido. Modo full: solo CSS flex-wrap, sin scroll. */
  const inlineTrackStyle = !fullWidth
    ? ({
        display: "inline-grid",
        gridTemplateColumns: `repeat(${Math.max(1, options.length)}, minmax(min-content, max-content))`,
      } as React.CSSProperties)
    : undefined;

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
        style={inlineTrackStyle}
      >
        {options.map((opt) => {
          const isSelected =
            opt.value === "" ? value === "" : opt.value.toUpperCase() === (value || "").toUpperCase();
          return (
            <button
              key={opt.value === "" ? "__all__" : opt.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={opt.label}
              title={opt.label}
              disabled={isDisabled}
              className={`analytics-segmented__option${isSelected ? " analytics-segmented__option--active" : ""}`}
              onClick={() => onChange(opt.value)}
            >
              <span className="analytics-segmented__option-label">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
