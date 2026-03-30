"use client";

import React from "react";
import { ListBox, Select } from "@heroui/react";

export type StringSelectItem = { id: string; label: string };

/** Misma apariencia que los `<select>` analytics con `input-heroui-tokens`. */
export const STRING_SELECT_TRIGGER_ANALYTICS =
  "input input-heroui-tokens string-select-trigger-tokens w-full min-h-10 rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--color-text)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]";

type Props = {
  items: StringSelectItem[];
  selectedKey: string;
  onSelectionChange: (id: string) => void;
  isDisabled?: boolean;
  triggerClassName: string;
  popoverClassName?: string;
} & (
  | { labelId: string; "aria-label"?: undefined }
  | { "aria-label": string; labelId?: undefined }
);

/**
 * Select de una opción con lista estática; usa primitivos HeroUI v3 (Select + ListBox).
 */
export function StringSelect({
  items,
  selectedKey,
  onSelectionChange,
  isDisabled,
  triggerClassName,
  popoverClassName = "z-[100] min-w-0",
  ...aria
}: Props) {
  const a11y =
    "labelId" in aria && aria.labelId
      ? { "aria-labelledby": aria.labelId }
      : { "aria-label": aria["aria-label"] ?? "Seleccionar" };

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
      <Select.Popover className={`string-select-popover ${popoverClassName}`.trim()}>
        <ListBox className="string-select-listbox max-h-60 overflow-y-auto outline-none">
          {items.map((it) => (
            <ListBox.Item
              key={it.id}
              id={it.id}
              textValue={it.label}
              className="string-select-item"
            >
              <span className="string-select-item-label min-w-0 flex-1 truncate text-left">{it.label}</span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
