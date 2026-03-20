import React from "react";
import { Button } from "@heroui/react";

export type FilterChip = {
  key: string;
  label: string;
  value: string;
};

type Props = {
  chips: FilterChip[];
  onRemove: (chip: FilterChip) => void;
};

export function ActiveFilterChips({ chips, onRemove }: Props) {
  if (chips.length === 0) return null;

  return (
    <div className="filter-chips" aria-label="Filtros activos">
      {chips.map((chip) => (
        <Button
          key={`${chip.key}:${chip.value}`}
          variant="outline"
          size="sm"
          aria-label={`Quitar ${chip.label}: ${chip.value}`}
          onPress={() => onRemove(chip)}
          className="filter-chip"
        >
          <span className="filter-chip-label">{chip.label}:</span>
          <span>{chip.value}</span>
          <span className="filter-chip-x" aria-hidden>x</span>
        </Button>
      ))}
    </div>
  );
}
