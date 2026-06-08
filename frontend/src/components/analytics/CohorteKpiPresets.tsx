import React from "react";
import { Button } from "@heroui/react";

type Props = {
  cutoffOptions: string[];
  onApplyPreset: (months: string[]) => void;
};

const PRESETS = [
  { id: "ultimo_anio" as const, label: "Último año", months: 12 },
  { id: "ultimos_2" as const, label: "Últimos 2 años", months: 24 },
  { id: "todo" as const, label: "Todo", months: 999 },
];

/**
 * Mejora UX #3: Presets KPI rápidos en Cobranzas Cohorte.
 * Selecciona N meses de cobro más recientes.
 */
export function CohorteKpiPresets({ cutoffOptions, onApplyPreset }: Props) {
  if (!cutoffOptions.length) return null;
  const sorted = [...cutoffOptions].sort((a, b) => {
    const [ma, ya] = a.split("/").map(Number);
    const [mb, yb] = b.split("/").map(Number);
    return (yb - ya) || (mb - ma);
  });

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      {PRESETS.map((p) => {
        const take = Math.min(p.months, sorted.length);
        const months = sorted.slice(0, take);
        return (
          <Button
            key={p.id}
            type="button"
            variant="outline"
            size="sm"
            onPress={() => onApplyPreset(months)}
            className="text-xs"
            aria-label={`Preset: ${p.label}`}
          >
            {p.label}
          </Button>
        );
      })}
    </div>
  );
}
