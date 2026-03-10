import React from "react";

export type SelectionSummaryItem = {
  label: string;
  value: string;
};

type Props = {
  items: SelectionSummaryItem[];
  className?: string;
};

export function AnalysisSelectionSummary({ items, className = "" }: Props) {
  if (items.length === 0) return null;
  const text = items.map(({ label, value }) => `${label}: ${value}`).join(" | ");
  return (
    <div className={`analysis-selection-summary ${className}`.trim()}>
      <strong>Selección actual:</strong>&nbsp;{text}
    </div>
  );
}
