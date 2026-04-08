"use client";

import { useEffect, useRef } from "react";

const DEFAULT_IDLE_MS = 4000;

export type UseFilterAutoApplyAfterIdleParams = {
  /** Serialización estable del borrador (p. ej. `snapshotFloatingFilterValues`). */
  draftKey: string | undefined;
  /** Serialización de lo ya aplicado. */
  appliedKey: string | undefined;
  onApply: () => void | Promise<void>;
  /** Si false, no se programa temporizador (p. ej. sidebar flotante abierto duplica la lógica allí). */
  enabled: boolean;
  applyDisabled?: boolean;
  applying?: boolean;
  idleMs?: number;
};

/**
 * Tras `idleMs` sin cambios en `draftKey`, si difiere de `appliedKey` y no está bloqueado,
 * ejecuta `onApply`. Cada cambio de `draftKey` reinicia la cuenta (misma semántica que el panel lateral).
 */
export function useFilterAutoApplyAfterIdle({
  draftKey,
  appliedKey,
  onApply,
  enabled,
  applyDisabled = false,
  applying = false,
  idleMs = DEFAULT_IDLE_MS,
}: UseFilterAutoApplyAfterIdleParams): void {
  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;
  const flagsRef = useRef({ applyDisabled, applying });
  flagsRef.current = { applyDisabled, applying };

  const keysReady = draftKey !== undefined && appliedKey !== undefined;

  useEffect(() => {
    if (!enabled || !keysReady || idleMs <= 0) return;
    if (draftKey === appliedKey) return;
    const id = window.setTimeout(() => {
      const { applyDisabled: d, applying: a } = flagsRef.current;
      if (d || a) return;
      void onApplyRef.current();
    }, idleMs);
    return () => window.clearTimeout(id);
  }, [enabled, keysReady, idleMs, draftKey, appliedKey]);
}
