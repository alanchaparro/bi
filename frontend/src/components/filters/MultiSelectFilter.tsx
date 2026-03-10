import React, { useMemo, useState, useRef, useEffect } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => filterOptions(options, q), [options, q]);
  const listboxId = `${label.replace(/\s+/g, "-").toLowerCase()}-listbox`;
  const optionIdBase = `${listboxId}-option`;

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    const firstSelected = filtered.findIndex((v) => selected.includes(v));
    setActiveIndex(firstSelected >= 0 ? firstSelected : 0);
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, filtered, selected]);

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
      setOpen(false);
      return;
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
      <button
        type="button"
        className="input multi-select-trigger"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        disabled={options.length === 0}
      >
        <span className="multi-select-value">
          {displayText}
        </span>
        <span className="multi-select-caret" aria-hidden>
          {open ? "^" : "v"}
        </span>
      </button>
      {open && options.length > 0 && (
        <div
          id={listboxId}
          role="listbox"
          aria-multiselectable="true"
          aria-activedescendant={activeOptionId}
          className="multi-select-listbox"
          onKeyDown={onListboxKeyDown}
          tabIndex={-1}
        >
          <input
            ref={searchRef}
            className="input multi-select-search"
            placeholder="Buscar..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onListboxKeyDown}
          />
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
              <span className="multi-select-option-action">
                <input
                  type="checkbox"
                  checked={selected.includes(v)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => undefined}
                  aria-label={`Seleccionar ${v}`}
                />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
