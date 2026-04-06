"use client";

import React, { useMemo } from "react";
import { MultiSelectFilter } from "./MultiSelectFilter";
import { AbbrevSegmentedFilter } from "./AbbrevSegmentedFilter";
import { abbrevForViaLabel, captionForVia, viaEmptyAbbrev } from "./analyticsAbbrev";

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

  const abbrevOptions = useMemo(
    () => [
      { value: "", label: placeholder, abbrev: viaEmptyAbbrev(placeholder), caption: placeholder },
      ...options.map((v) => ({
        value: v,
        label: v,
        abbrev: abbrevForViaLabel(v),
        caption: captionForVia(v),
      })),
    ],
    [options, placeholder],
  );

  const useFixedViaSegmentedWidth =
    canSegment && (label === "Vía de cobro" || label === "Vía de pago");
  const segmentedClassName = useFixedViaSegmentedWidth
    ? `${className ?? ""} rendimiento-via-cobro-segmented shrink-0`.trim()
    : (className ?? "");

  if (canSegment) {
    const value = selected[0] ?? "";
    return (
      <AbbrevSegmentedFilter
        className={segmentedClassName}
        label={label}
        options={abbrevOptions}
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
