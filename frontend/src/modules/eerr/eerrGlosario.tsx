import React, { useMemo, useState } from "react";
import { Button, Tooltip } from "@heroui/react";
import raw from "./glosario_cuentas.json";

export type EerrGlosarioEntry = {
  grupo_epem: string;
  rubro: string;
  cuenta_concepto: string;
  descripcion: string | null;
};

const entries: EerrGlosarioEntry[] = raw.entries as EerrGlosarioEntry[];

function normLabel(s: string): string {
  const t = s.replace(/\s*\.{3}\s*$/u, "").trim();
  return t
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function blockToGrupo(block: string | null | undefined): "COSTOS" | "GASTOS" | null {
  const b = (block || "").toLowerCase();
  if (b === "costos") return "COSTOS";
  if (b === "gastos") return "GASTOS";
  return null;
}

/** Entradas del glosario bajo el mismo rubro (mayor contable en UI costos/gastos). */
export function glosarioEntriesForMayor(
  mayor: string,
  block: "costos" | "gastos" | "ventas" | null,
): EerrGlosarioEntry[] {
  if (block === "ventas") return [];
  const g = blockToGrupo(block);
  const nm = normLabel(mayor);
  return entries.filter((e) => {
    if (g && e.grupo_epem !== g) return false;
    return normLabel(e.rubro) === nm;
  });
}

/** Coincidencia por nombre de cuenta (subcuenta). */
export function glosarioEntriesForCuenta(
  cuenta: string,
  block: "costos" | "gastos" | "ventas" | null,
  mayorHint?: string,
): EerrGlosarioEntry[] {
  if (block === "ventas") return [];
  const g = blockToGrupo(block);
  const nc = normLabel(cuenta);
  let cand = entries.filter((e) => {
    if (g && e.grupo_epem !== g) return false;
    return normLabel(e.cuenta_concepto) === nc;
  });
  if (!cand.length && !g) {
    cand = entries.filter((e) => normLabel(e.cuenta_concepto) === nc);
  }
  if (mayorHint && cand.length > 1) {
    const nm = normLabel(mayorHint);
    const narrowed = cand.filter((e) => normLabel(e.rubro) === nm);
    if (narrowed.length) cand = narrowed;
  }
  return cand;
}

type GlosarioKind = "mayor" | "cuenta";

type Props = {
  kind: GlosarioKind;
  label: string;
  eerrBlock: "ventas" | "costos" | "gastos" | null;
  /** Solo para kind=cuenta: mayor padre para desambiguar. */
  mayorHint?: string;
  className?: string;
};

/**
 * Ícono ℹ️ que abre el glosario de cuentas (referencia negocio).
 * No se muestra si no hay datos o el bloque es ventas (el Excel no cubre ingresos).
 */
export function EerrGlosarioInfo({ kind, label, eerrBlock, mayorHint, className }: Props) {
  const matches = useMemo(() => {
    if (kind === "mayor") return glosarioEntriesForMayor(label, eerrBlock);
    return glosarioEntriesForCuenta(label, eerrBlock, mayorHint);
  }, [kind, label, eerrBlock, mayorHint]);

  if (!matches.length) return null;

  const title = kind === "mayor" ? "Cuentas en este mayor (glosario)" : "Qué se registra en esta cuenta";

  // Mejora UX #9: Panel glosario flotante al hover (Tooltip en vez de Popover/click)
  const tooltipContent = (() => {
    if (kind === "cuenta" && matches.length === 1) {
      return matches[0].descripcion ?? "Sin descripción en el glosario.";
    }
    return (
      <div className="max-w-[20rem]">
        <p className="text-xs font-semibold mb-1 text-[var(--color-text)]">{title}</p>
        <ul className="space-y-1">
          {matches.map((e, idx) => (
            <li key={`${e.grupo_epem}-${e.rubro}-${e.cuenta_concepto}-${idx}`}>
              <span className="font-medium text-[0.72rem]">{e.cuenta_concepto}</span>{" "}
              <span className="text-[0.65rem] opacity-70">({e.grupo_epem})</span>
              {e.descripcion ? (
                <p className="text-[0.68rem] text-[var(--color-text-muted)] mt-0.5">{e.descripcion}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    );
  })();

  return (
    <Tooltip delay={200} closeDelay={200}>
      <Tooltip.Trigger>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          isIconOnly
          aria-label={`Glosario: ${label}`}
          className={`h-6 w-6 min-w-6 shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] ${className ?? ""}`}
        >
          <span className="material-symbols-outlined text-[16px] leading-none" aria-hidden>
            info
          </span>
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Content placement="top start" className="max-w-[22rem] text-xs">
        {tooltipContent}
      </Tooltip.Content>
    </Tooltip>
  );
}
