"use client";

import React from "react";
import { Button, ButtonGroup } from "@heroui/react";

export type SegmentedOption = {
  value: string;
  label: string;
};

export type SegmentedControlProps = {
  /** Etiqueta visible del control (asociada por id) */
  label: string;
  /** Opciones; value vacío suele representar "Todos" */
  options: SegmentedOption[];
  /** Valor actualmente seleccionado */
  value: string;
  /** Callback al cambiar la selección */
  onChange: (value: string) => void;
  /** id del contenedor para asociar label (accesibilidad) */
  id?: string;
  /** Deshabilita todo el grupo */
  isDisabled?: boolean;
  /** Tamaño de los botones */
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  /** aria-label del radiogroup (por defecto usa label) */
  "aria-label"?: string;
  /** Clase CSS del contenedor exterior */
  className?: string;
};

/**
 * Control segmentado (grupo de botones de selección única) con buenas prácticas:
 * - Afordancia: todos los botones tienen borde (variant outline); el seleccionado se destaca (primary).
 * - Accesibilidad: role="radiogroup", aria-label, aria-pressed en cada opción.
 * - Consistencia visual con HeroUI ButtonGroup.
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
  const buttonGroupStyle = fullWidth
    ? ({ gridTemplateColumns: `repeat(${Math.max(1, options.length)}, minmax(0, 1fr))` } as React.CSSProperties)
    : undefined;

  return (
    <div className={className} role="group" aria-labelledby={groupId ? `${groupId}-label` : undefined}>
      <label
        id={groupId ? `${groupId}-label` : undefined}
        className="input-label block text-sm font-medium text-[var(--color-text)] mb-1.5"
        htmlFor={groupId}
      >
        {label}
      </label>
      <div
        id={groupId}
        role="radiogroup"
        aria-label={ariaLabel ?? label}
        aria-labelledby={groupId ? `${groupId}-label` : undefined}
      >
        <ButtonGroup
          size={size}
          isDisabled={isDisabled}
          hideSeparator
          className={`segmented-control-group ${fullWidth ? "segmented-control-group--full" : ""}`.trim()}
          style={buttonGroupStyle}
        >
          {options.map((opt) => {
            const isSelected = value === opt.value;
            return (
              <Button
                key={opt.value}
                variant={isSelected ? "primary" : "outline"}
                aria-pressed={isSelected}
                aria-label={opt.label}
                onPress={() => onChange(opt.value)}
                className={fullWidth ? "flex-1 min-w-0" : "min-w-0"}
              >
                {opt.label}
              </Button>
            );
          })}
        </ButtonGroup>
      </div>
    </div>
  );
}
