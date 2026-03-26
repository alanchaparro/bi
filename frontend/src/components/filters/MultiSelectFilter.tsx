import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@heroui/react";
import { filterOptions } from "./filterOptions";

type Props = {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`multi-select-chevron ${open ? "is-open" : ""}`.trim()}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  placeholder = "Seleccionar...",
  emptyText = "Sin opciones (no hay datos cargados)",
  className = "",
}: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => filterOptions(options, q), [options, q]);
  const listboxId = `${label.replace(/\s+/g, "-").toLowerCase()}-listbox`;
  const optionIdBase = `${listboxId}-option`;

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        listboxRef.current &&
        !listboxRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  useEffect(() => {
    if (!open) {
      setIsClosing(false);
      return;
    }
    const firstSelected = filtered.findIndex((v) => selected.includes(v));
    setActiveIndex(firstSelected >= 0 ? firstSelected : 0);
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [filtered, open, selected]);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportPadding = 12;
      const availableHeight = Math.max(220, window.innerHeight - rect.bottom - viewportPadding - 8);
      setPortalStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(320, availableHeight),
        zIndex: 4000,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const handleClose = () => {
    setIsClosing(true);
    const t = window.setTimeout(() => {
      setOpen(false);
      setIsClosing(false);
    }, 180);
    return () => window.clearTimeout(t);
  };

  const toggle = (value: string) => {
    const has = selected.includes(value);
    if (has) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  };

  const moveActive = (delta: number) => {
    if (filtered.length === 0) return;
    const next = (activeIndex + delta + filtered.length) % filtered.length;
    setActiveIndex(next);
  };

  const activeOptionId = filtered[activeIndex] ? `${optionIdBase}-${activeIndex}` : undefined;

  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  const onListboxKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    const fromSearchInput = e.target instanceof HTMLInputElement;
    if (fromSearchInput && e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Escape") {
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (filtered[activeIndex]) toggle(filtered[activeIndex]);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      handleClose();
    }
  };

  const displayText =
    options.length === 0
      ? emptyText
      : selected.length === 0
        ? placeholder
        : selected.length === 1
          ? selected[0]
          : `${selected.length} seleccionados`;

  return (
    <div
      ref={containerRef}
      aria-label={label}
      className={`multi-select-filter ${open ? "is-open" : ""} ${className}`.trim()}
    >
      <label className="input-label">{label}</label>
      <Button
        ref={triggerRef}
        variant="outline"
        className="multi-select-trigger w-full justify-between"
        onPress={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        isDisabled={options.length === 0}
      >
        <span className="multi-select-value truncate">{displayText}</span>
        <span className="multi-select-caret" aria-hidden><ChevronIcon open={open} /></span>
      </Button>
      {open && options.length > 0 && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            aria-multiselectable="true"
            aria-activedescendant={activeOptionId}
            className={`multi-select-listbox ${isClosing ? "multi-select-listbox-closing" : "multi-select-listbox-open"}`}
            onKeyDown={onListboxKeyDown}
            onMouseDown={(e) => e.stopPropagation()}
            tabIndex={-1}
            style={portalStyle}
          >
            <input
              ref={searchRef}
              type="search"
              placeholder="Buscar..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={onListboxKeyDown}
              aria-label={`Buscar en ${label}`}
              className="multi-select-search input-heroui-tokens"
            />
            <div className="multi-select-options">
              {filtered.map((v, idx) => (
                <button
                  key={v}
                  id={`${optionIdBase}-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={selected.includes(v)}
                  className={`multi-select-option ${idx === activeIndex ? "is-active" : ""}`.trim()}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(v);
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onFocus={() => setActiveIndex(idx)}
                  onKeyDown={onListboxKeyDown}
                  tabIndex={idx === activeIndex ? 0 : -1}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <span aria-hidden className={`multi-select-check ${selected.includes(v) ? "is-selected" : ""}`.trim()} />
                  <span className="multi-select-option-text">{v}</span>
                </button>
              ))}
            </div>
          </div>
          ,
          document.body,
        )}
    </div>
  );
}
