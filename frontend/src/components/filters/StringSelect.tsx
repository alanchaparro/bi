"use client";

import React, { useMemo, useState } from "react";
import type { Key, Selection } from "@react-types/shared";
import { Button, Dropdown, Label, ListBox, Select } from "@heroui/react";
import { AnalyticsDropdownMenuCheck } from "./AnalyticsDropdownMenuCheck";

export type StringSelectItem = { id: string; label: string };

/** Mismo trigger que MultiSelectFilter en analytics v2 (HeroUI Dropdown + Button secondary). */
export const STRING_SELECT_TRIGGER_ANALYTICS = "multi-select-trigger w-full justify-between gap-2";

type Props = {
  items: StringSelectItem[];
  selectedKey: string;
  onSelectionChange: (id: string) => void;
  isDisabled?: boolean;
  triggerClassName: string;
  popoverClassName?: string;
  /**
   * `dropdown`: mismo patrón que filtros analytics (Dropdown + Menu + tilde explícita).
   * `select`: HeroUI Select + ListBox (config / formularios con `input-heroui-tokens`).
   */
  ui?: "dropdown" | "select";
} & (
  | { labelId: string; "aria-label"?: undefined }
  | { "aria-label": string; labelId?: undefined }
);

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

function selectionToSingleId(keys: Selection): string | null {
  if (keys === "all") return null;
  const arr = Array.from(keys as Set<Key>);
  const k = arr[0];
  return k != null ? String(k) : null;
}

/**
 * Select de una opción con lista estática.
 * - `ui="select"`: Select + ListBox (HeroUI).
 * - `ui="dropdown"`: Dropdown + Menu alineado a MultiSelectFilter (analytics).
 */
export function StringSelect({
  items,
  selectedKey,
  onSelectionChange,
  isDisabled,
  triggerClassName,
  popoverClassName = "",
  ui = "select",
  ...aria
}: Props) {
  const a11y =
    "labelId" in aria && aria.labelId
      ? { "aria-labelledby": aria.labelId }
      : { "aria-label": aria["aria-label"] ?? "Seleccionar" };

  if (ui === "dropdown") {
    return (
      <StringSelectDropdown
        items={items}
        selectedKey={selectedKey}
        onSelectionChange={onSelectionChange}
        isDisabled={isDisabled}
        triggerClassName={triggerClassName}
        popoverClassName={popoverClassName}
        a11y={a11y}
      />
    );
  }

  const popoverLegacy = `z-[100] min-w-0 ${popoverClassName}`.trim();

  return (
    <Select
      className="string-select-root w-full min-w-0"
      selectedKey={selectedKey}
      onSelectionChange={(key) => {
        if (key != null) onSelectionChange(String(key));
      }}
      isDisabled={isDisabled}
      {...a11y}
    >
      <Select.Trigger className={triggerClassName}>
        <Select.Value className="string-select-value" />
        <Select.Indicator className="string-select-chevron shrink-0" />
      </Select.Trigger>
      <Select.Popover className={`string-select-popover ${popoverLegacy}`.trim()}>
        <ListBox className="string-select-listbox max-h-60 overflow-y-auto outline-none">
          {items.map((it) => (
            <ListBox.Item key={it.id} id={it.id} textValue={it.label} className="string-select-item">
              <span className="string-select-item-label min-w-0 flex-1 truncate text-left">{it.label}</span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function StringSelectDropdown({
  items,
  selectedKey,
  onSelectionChange,
  isDisabled,
  triggerClassName,
  popoverClassName,
  a11y,
}: {
  items: StringSelectItem[];
  selectedKey: string;
  onSelectionChange: (id: string) => void;
  isDisabled?: boolean;
  triggerClassName: string;
  popoverClassName: string;
  a11y: { "aria-labelledby"?: string; "aria-label"?: string };
}) {
  const [open, setOpen] = useState(false);
  const menuSelectedKeys = useMemo(
    () => new Set<string>(selectedKey ? [selectedKey] : []),
    [selectedKey],
  );
  const displayLabel =
    items.find((it) => it.id === selectedKey)?.label ?? (items.length ? selectedKey : "—");

  const onMenuChange = (keys: Selection) => {
    const id = selectionToSingleId(keys);
    if (id != null) onSelectionChange(id);
  };

  return (
    <div
      className={`string-select-dropdown-root w-full min-w-0 ${open ? "is-open" : ""}`.trim()}
    >
      <div className="multi-select-dropdown-root">
        <Dropdown onOpenChange={setOpen}>
          <Dropdown.Trigger>
            <Button
              variant="secondary"
              className={`multi-select-trigger w-full justify-between gap-2 ${triggerClassName}`.trim()}
              {...a11y}
              isDisabled={isDisabled || items.length === 0}
            >
              <span className="multi-select-value min-w-0 truncate text-left">{displayLabel}</span>
              <span className="multi-select-caret shrink-0" aria-hidden>
                <ChevronIcon open={open} />
              </span>
            </Button>
          </Dropdown.Trigger>
          <Dropdown.Popover
            placement="bottom start"
            className={`multi-select-dropdown-popover string-select-dropdown-popover ${popoverClassName}`.trim()}
          >
            {items.length === 0 ? (
              <p className="multi-select-dropdown-empty px-3 py-3 text-sm text-[var(--color-text-muted)]">
                Sin opciones
              </p>
            ) : (
              <div className="string-select-dropdown-menu-scroll">
                <Dropdown.Menu
                  selectionMode="single"
                  selectedKeys={menuSelectedKeys}
                  onSelectionChange={onMenuChange}
                  aria-label={
                    typeof a11y["aria-label"] === "string" ? a11y["aria-label"] : "Opciones"
                  }
                >
                  {items.map((it) => (
                    <Dropdown.Item key={it.id} id={it.id} textValue={it.label}>
                      <AnalyticsDropdownMenuCheck selected={it.id === selectedKey} />
                      <Label className="multi-select-dropdown-item-text">{it.label}</Label>
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </div>
            )}
          </Dropdown.Popover>
        </Dropdown>
      </div>
    </div>
  );
}
