"use client";

/**
 * Check de ítem para menús HeroUI Dropdown/ListBox cuando el contexto de RAC no inyecta isSelected en el indicador del theme.
 */
export function AnalyticsDropdownMenuCheck({ selected }: { selected: boolean }) {
  return (
    <span aria-hidden className="multi-select-item-check-cell" data-selected={selected || undefined}>
      <svg
        aria-hidden
        className="multi-select-item-check-svg"
        fill="none"
        role="presentation"
        stroke="currentColor"
        strokeDasharray={22}
        strokeDashoffset={selected ? 44 : 66}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        viewBox="0 0 17 18"
      >
        <polyline points="1 9 7 14 15 4" />
      </svg>
    </span>
  );
}
