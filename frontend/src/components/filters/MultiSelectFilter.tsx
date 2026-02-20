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
  const containerRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => filterOptions(options, q), [options, q]);
  const listboxId = `${label.replace(/\s+/g, "-").toLowerCase()}-listbox`;

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const toggle = (value: string) => {
    const has = selected.includes(value);
    if (has) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
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
    <div ref={containerRef} aria-label={label} className={className} style={{ position: "relative" }}>
      <label className="input-label">{label}</label>
      <button
        type="button"
        className="input"
        onClick={() => setOpen((o) => !o)}
        style={{
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        disabled={options.length === 0}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {displayText}
        </span>
        <span style={{ marginLeft: "0.5rem", flexShrink: 0 }} aria-hidden>
          {open ? "^" : "v"}
        </span>
      </button>
      {open && options.length > 0 && (
        <div
          id={listboxId}
          role="listbox"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "0.25rem",
            maxHeight: 220,
            overflow: "auto",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            padding: "0.5rem",
            background: "var(--dropdown-bg)",
            color: "var(--color-text)",
            zIndex: 50,
            boxShadow: "var(--shadow-md)",
            backdropFilter: "blur(8px)",
          }}
        >
          <input
            className="input"
            placeholder="Buscar..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            style={{ marginBottom: "0.5rem", background: "var(--input-bg-strong)" }}
          />
          {filtered.map((v) => (
            <label
              key={v}
              role="option"
              aria-selected={selected.includes(v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.35rem 0",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <input type="checkbox" checked={selected.includes(v)} onChange={() => toggle(v)} />
              {v}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
