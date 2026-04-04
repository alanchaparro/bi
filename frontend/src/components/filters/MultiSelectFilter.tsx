"use client";

import React, { useId, useMemo, useState } from "react";
import type { Key, Selection } from "@react-types/shared";
import { Button, Dropdown, Label, SearchField } from "@heroui/react";
import { AnalyticsDropdownMenuCheck } from "./AnalyticsDropdownMenuCheck";
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

function itemId(value: string) {
  return value === "" ? "__empty__" : value;
}

function selectionFromKeys(keys: Selection, filtered: string[], previous: string[]): string[] {
  if (keys === "all") {
    return [...new Set([...previous, ...filtered])];
  }
  const picked = new Set(keys as Set<Key>);
  const fromFiltered = filtered.filter((x) => picked.has(itemId(x)));
  const outsideFilter = previous.filter((x) => !filtered.includes(x));
  return [...new Set([...outsideFilter, ...fromFiltered])];
}

/** Claves controladas para el Menu: todas las seleccionadas (RAC ignora ids que no están en la colección visible). */
function selectedKeysFromValues(selected: string[]): Selection {
  return new Set(selected.map(itemId));
}

/**
 * Multi-select con HeroUI Dropdown (Popover + Menu + ItemIndicator).
 * @see https://heroui.com/docs/react/components/dropdown
 */
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
  const filtered = useMemo(() => filterOptions(options, q), [options, q]);

  const displayText =
    options.length === 0
      ? emptyText
      : selected.length === 0
        ? placeholder
        : selected.length === 1
          ? selected[0]
          : `${selected.length} seleccionados`;

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((v) => selected.includes(v));

  const selectAllVisible = () => {
    if (filtered.length === 0) return;
    onChange([...new Set([...selected, ...filtered])]);
  };

  const deselectAll = () => {
    onChange([]);
  };

  const onSelectionChange = (keys: Selection) => {
    onChange(selectionFromKeys(keys, filtered, selected));
  };

  const menuSelectedKeys = useMemo(() => selectedKeysFromValues(selected), [selected]);
  const fieldLabelId = useId();

  return (
    <div
      className={`multi-select-filter ${open ? "is-open" : ""} ${className}`.trim()}
    >
      <Label id={fieldLabelId} className="input-label">
        {label}
      </Label>
      <div className="multi-select-dropdown-root">
        <Dropdown onOpenChange={setOpen}>
          <Dropdown.Trigger>
            <Button
              variant="secondary"
              className="multi-select-trigger w-full justify-between gap-2"
              aria-labelledby={fieldLabelId}
              isDisabled={options.length === 0}
            >
              <span className="multi-select-value min-w-0 truncate text-left">{displayText}</span>
              <span className="multi-select-caret shrink-0" aria-hidden>
                <ChevronIcon open={open} />
              </span>
            </Button>
          </Dropdown.Trigger>
          <Dropdown.Popover
            placement="bottom start"
            className="multi-select-dropdown-popover"
          >
            {options.length === 0 ? (
              <p className="multi-select-dropdown-empty px-3 py-3 text-sm text-[var(--color-text-muted)]">
                {emptyText}
              </p>
            ) : (
              <div className="multi-select-dropdown-popover-inner">
                <SearchField
                  value={q}
                  onChange={setQ}
                  aria-label={`Buscar en ${label}`}
                  className="multi-select-dropdown-search w-full shrink-0"
                >
                  <SearchField.Group className="w-full">
                    <SearchField.SearchIcon />
                    <SearchField.Input
                      placeholder="Buscar..."
                      className="multi-select-search-input min-h-9 text-sm"
                    />
                    <SearchField.ClearButton aria-label="Limpiar búsqueda" />
                  </SearchField.Group>
                </SearchField>

                <div
                  className="multi-select-dropdown-toolbar"
                  role="toolbar"
                  aria-label={`Selección masiva en ${label}`}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="multi-select-dropdown-toolbar-btn"
                    isDisabled={filtered.length === 0 || allFilteredSelected}
                    onPress={() => selectAllVisible()}
                  >
                    Seleccionar todo
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="multi-select-dropdown-toolbar-btn"
                    isDisabled={selected.length === 0}
                    onPress={() => deselectAll()}
                  >
                    Deseleccionar todo
                  </Button>
                </div>

                <div className="multi-select-dropdown-list-scroll">
                  {filtered.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-[var(--color-text-muted)]">Sin coincidencias</p>
                  ) : (
                    <Dropdown.Menu
                      selectionMode="multiple"
                      selectedKeys={menuSelectedKeys}
                      onSelectionChange={onSelectionChange}
                      aria-label={label}
                    >
                      {filtered.map((opt) => (
                        <Dropdown.Item key={itemId(opt)} id={itemId(opt)} textValue={opt}>
                          <AnalyticsDropdownMenuCheck selected={selected.includes(opt)} />
                          <Label className="multi-select-dropdown-item-text">{opt}</Label>
                        </Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  )}
                </div>
              </div>
            )}
          </Dropdown.Popover>
        </Dropdown>
      </div>
    </div>
  );
}
