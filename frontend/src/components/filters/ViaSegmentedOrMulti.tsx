"use client";

import React from "react";
import { MultiSelectFilter } from "./MultiSelectFilter";
import { SegmentedControl } from "./SegmentedControl";

/** Máximo de vías para usar control segmentado (selección única: Todas + cada vía). */
export const MAX_VIA_OPTIONS_FOR_SEGMENTED = 6;

export type ViaSegmentedOrMultiProps = {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  className?: string;
  placeholder?: string;
};

/**
 * Vía de cobro/pago: si hay pocas opciones y como máximo una vía aplicada, usa el segmented canónico.
 * Si hay muchas opciones o varias vías seleccionadas, mantiene MultiSelectFilter.
 */
export function ViaSegmentedOrMulti({
  label,
  options,
  selected,
  onChange,
  className,
  placeholder = "Todas",
}: ViaSegmentedOrMultiProps) {
  const n = options.length;
  const canSegment = n > 0 && n <= MAX_VIA_OPTIONS_FOR_SEGMENTED && selected.length <= 1;

  if (canSegment) {
    const value = selected[0] ?? "";
    return (
      <SegmentedControl
        className={className}
        label={label}
        options={[{ value: "", label: "Todas" }, ...options.map((v) => ({ value: v, label: v }))]}
        value={value}
        onChange={(v) => onChange(v ? [v] : [])}
      />
    );
  }

  return (
    <MultiSelectFilter
      className={className}
      label={label}
      options={options}
      selected={selected}
      onChange={onChange}
      placeholder={placeholder}
    />
  );
}
