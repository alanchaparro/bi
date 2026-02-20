import React from "react";

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
        <button
          key={`${chip.key}:${chip.value}`}
          type="button"
          className="filter-chip"
          onClick={() => onRemove(chip)}
          title={`Quitar ${chip.label}: ${chip.value}`}
        >
          <span className="filter-chip-label">{chip.label}:</span>
          <span>{chip.value}</span>
          <span className="filter-chip-x" aria-hidden>
            x
          </span>
        </button>
      ))}
    </div>
  );
}
