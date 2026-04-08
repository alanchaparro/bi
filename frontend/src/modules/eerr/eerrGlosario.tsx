import React, { useMemo } from "react";
import { Button, Popover } from "@heroui/react";
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

  return (
    <Popover.Root>
      <Popover.Trigger>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          isIconOnly
          aria-label={`Glosario: ${label}`}
          aria-haspopup="dialog"
          className={`h-6 w-6 min-w-6 shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] ${className ?? ""}`}
        >
          <span className="material-symbols-outlined text-[16px] leading-none" aria-hidden>
            info
          </span>
        </Button>
      </Popover.Trigger>
      <Popover.Content placement="top start" offset={8} className="eerr-glosario-popover-content">
        <Popover.Dialog className="eerr-glosario-popover-dialog">
          <p className="eerr-glosario-popover-title">{title}</p>
          {kind === "cuenta" && matches.length === 1 ? (
            <p className="eerr-glosario-popover-body">
              {matches[0].descripcion ?? "Sin descripción en el glosario."}
            </p>
          ) : (
            <ul className="eerr-glosario-popover-list">
              {matches.map((e, idx) => (
                <li key={`${e.grupo_epem}-${e.rubro}-${e.cuenta_concepto}-${idx}`}>
                  <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                    <span className="font-medium text-[0.78rem] text-[var(--color-text)]">{e.cuenta_concepto}</span>
                    <span className="text-[0.65rem] text-[var(--color-text-muted)]">{e.grupo_epem}</span>
                  </div>
                  {e.descripcion ? (
                    <p className="eerr-glosario-popover-body mt-1.5 text-[var(--color-text-muted)]">{e.descripcion}</p>
                  ) : (
                    <p className="eerr-glosario-popover-body mt-1.5 italic text-[var(--color-text-muted)]">
                      Sin descripción.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  );
}
