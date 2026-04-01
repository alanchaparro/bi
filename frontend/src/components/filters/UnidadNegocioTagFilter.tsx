"use client";

import React, { useMemo } from "react";
import { Button, Description, Label } from "@heroui/react";

export type UnidadNegocioTagFilterProps = {
  /** Texto del campo (accesible). Por defecto «Unidad de negocio». */
  label?: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  className?: string;
  /** Mensaje si no hay UN en opciones (sync / sin datos). */
  emptyText?: string;
  /** Tamaño de los botones (HeroUI Button). */
  buttonSize?: "sm" | "md" | "lg";
};

/**
 * Filtro UN con botones HeroUI: selección múltiple con aspecto «apretado» (primary) vs reposo (outline).
 * Sin selección en estado = todas las UN (misma semántica que antes).
 *
 * @see https://heroui.com/docs/react/components/button
 */
export function UnidadNegocioTagFilter({
  label = "Unidad de negocio",
  options,
  selected,
  onChange,
  className = "",
  emptyText = "Sin opciones (no hay datos cargados)",
  buttonSize = "sm",
}: UnidadNegocioTagFilterProps) {
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const selectedInOrder = useMemo(() => options.filter((u) => selectedSet.has(u)), [options, selectedSet]);

  const toggle = (un: string) => {
    if (selectedSet.has(un)) {
      onChange(selected.filter((u) => u !== un));
    } else {
      onChange([...selected, un]);
    }
  };

  const outer = `un-filter-tag-group w-full min-w-0 ${className}`.trim();

  if (options.length === 0) {
    return (
      <div className={outer}>
        <span className="input-label block">{label}</span>
        <p className="text-sm text-[var(--color-text-muted)]" role="status">
          {emptyText}
        </p>
      </div>
    );
  }

  return (
    <div className={outer}>
      <Label className="input-label">{label}</Label>
      <div role="group" aria-label={label} className="un-filter-un-buttons">
        {options.map((un) => {
          const isSelected = selectedSet.has(un);
          return (
            <Button
              key={un}
              type="button"
              size={buttonSize}
              variant={isSelected ? "primary" : "outline"}
              aria-pressed={isSelected}
              onPress={() => toggle(un)}
              className="un-filter-un-btn font-medium"
            >
              {un}
            </Button>
          );
        })}
      </div>
      <Description className="un-filter-un-desc text-[var(--color-text-muted)]">
        {selectedInOrder.length > 0
          ? `Incluidas: ${selectedInOrder.join(", ")}`
          : "Todas las UN (ninguna pulsada: sin acotar por unidad)"}
      </Description>
    </div>
  );
}
