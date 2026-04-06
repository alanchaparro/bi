"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@heroui/react";

const DEFAULT_AUTO_APPLY_MS = 4000;

export type FloatingQuickFiltersProps = {
  /** Panel lateral abierto. */
  isOpen: boolean;
  /** Al pulsar el disparador: preparar borradores y abrir. */
  onOpen: () => void;
  onCollapse: () => void;
  onApply: () => void | Promise<void>;
  applyDisabled?: boolean;
  applying?: boolean;
  title?: string;
  children: React.ReactNode;
  /**
   * Firma del borrador en el panel (cambia al editar). Si se envían ambas claves
   * con `floatAppliedActivityKey`, tras `autoApplyIdleMs` sin cambios se llama `onApply`
   * si el borrador difiere de lo aplicado.
   */
  floatDraftActivityKey?: string;
  floatAppliedActivityKey?: string;
  /** Inactividad antes de autodisparar (ms). Por defecto 4000 si hay claves de actividad. */
  autoApplyIdleMs?: number;
};

/**
 * Filtros rápidos en un panel lateral derecho (sidebar), con backdrop y cierre por Escape.
 */
export function FloatingQuickFilters({
  isOpen,
  onOpen,
  onCollapse,
  onApply,
  applyDisabled = false,
  applying = false,
  title = "Filtros rápidos",
  children,
  floatDraftActivityKey,
  floatAppliedActivityKey,
  autoApplyIdleMs,
}: FloatingQuickFiltersProps) {
  const [mounted, setMounted] = useState(false);
  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;
  const flagsRef = useRef({ applyDisabled, applying });
  flagsRef.current = { applyDisabled, applying };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCollapse();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onCollapse]);

  const idleMs =
    floatDraftActivityKey !== undefined && floatAppliedActivityKey !== undefined
      ? (autoApplyIdleMs ?? DEFAULT_AUTO_APPLY_MS)
      : 0;

  useEffect(() => {
    if (!isOpen || idleMs <= 0) return;
    if (floatDraftActivityKey === floatAppliedActivityKey) return;
    const id = window.setTimeout(() => {
      const { applyDisabled: d, applying: a } = flagsRef.current;
      if (d || a) return;
      void onApplyRef.current();
    }, idleMs);
    return () => window.clearTimeout(id);
  }, [
    isOpen,
    idleMs,
    floatDraftActivityKey,
    floatAppliedActivityKey,
  ]);

  if (!mounted) return null;

  return createPortal(
    <>
      {isOpen ? (
        <div
          className="analytics-filter-sidebar-backdrop"
          onClick={onCollapse}
          aria-hidden
        />
      ) : null}

      {isOpen ? (
        <aside
          className="analytics-filter-sidebar-panel card"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="analytics-filter-sidebar-header">
            <h2 className="analytics-filter-sidebar-title">{title}</h2>
            <Button
              size="sm"
              variant="ghost"
              className="analytics-filter-sidebar-close"
              onPress={onCollapse}
              aria-label="Cerrar panel de filtros"
            >
              Cerrar
            </Button>
          </div>
          <div className="analytics-filter-sidebar-body analytics-floating-filter-grid">
            {children}
          </div>
          <div className="analytics-filter-sidebar-footer analytics-floating-filter-actions">
            <Button
              size="sm"
              variant="primary"
              onPress={() => void onApply()}
              isDisabled={applyDisabled || applying}
            >
              {applying ? "Aplicando…" : "Aplicar"}
            </Button>
            <Button size="sm" variant="ghost" onPress={onCollapse}>
              Contraer
            </Button>
          </div>
        </aside>
      ) : (
        <Button
          className="analytics-filter-sidebar-trigger analytics-floating-filter-fab analytics-floating-filter-fab-vertical"
          variant="primary"
          onPress={onOpen}
        >
          Filtros
        </Button>
      )}
    </>,
    document.body,
  );
}
