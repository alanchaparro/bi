"use client";

import React, { useMemo } from "react";
import { Button, ButtonGroup, Label } from "@heroui/react";
import type { AbbrevFilterOption } from "./analyticsAbbrev";

function optionMatches(opt: AbbrevFilterOption, current: string): boolean {
  if (opt.value === "") return !current || current === "";
  return opt.value.toUpperCase() === (current || "").toUpperCase();
}

export type AbbrevSegmentedFilterProps = {
  label: string;
  options: AbbrevFilterOption[];
  value: string;
  onChange: (value: string) => void;
  isDisabled?: boolean;
  className?: string;
  /** aria-label del radiogroup si difiere del label visible */
  "aria-label"?: string;
};

/**
 * Filtro de selección única compacto: abreviatura destacada y leyenda pequeña debajo.
 * Estilo tipo toolbar HeroUI (`ButtonGroup` + `Button`); la beta actual no expone ToggleButton.
 */
export function AbbrevSegmentedFilter({
  label,
  options,
  value,
  onChange,
  isDisabled = false,
  className = "",
  "aria-label": ariaLabel,
}: AbbrevSegmentedFilterProps) {
  const groupLabel = ariaLabel ?? label;

  const stableKey = useMemo(
    () => options.map((o) => (o.value === "" ? "__all__" : o.value)).join("|"),
    [options],
  );

  return (
    <div className={`analytics-abbrev-filter w-full min-w-0 ${className}`.trim()}>
      <Label className="input-label">{label}</Label>
      <div className="analytics-abbrev-filter__track">
        <ButtonGroup
          key={stableKey}
          fullWidth
          size="sm"
          variant="outline"
          isDisabled={isDisabled}
          role="group"
          aria-label={groupLabel}
          className="analytics-abbrev-filter__group min-w-0"
        >
          {options.map((opt) => {
            const selected = optionMatches(opt, value);
            const caption = opt.caption ?? opt.label;
            return (
              <Button
                key={opt.value === "" ? "__all__" : opt.value}
                type="button"
                aria-pressed={selected}
                aria-label={opt.label}
                variant={selected ? "primary" : "outline"}
                onPress={() => onChange(opt.value)}
                className={`analytics-abbrev-filter__btn${selected ? " analytics-abbrev-filter__btn--selected" : ""}`}
              >
                <span className="analytics-abbrev-filter__stack" title={caption}>
                  <span className="analytics-abbrev-filter__abbrev" aria-hidden>
                    {opt.abbrev}
                  </span>
                  <span className="analytics-abbrev-filter__caption">{caption}</span>
                </span>
              </Button>
            );
          })}
        </ButtonGroup>
      </div>
    </div>
  );
}
