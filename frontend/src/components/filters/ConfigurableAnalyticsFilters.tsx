"use client";

import React from "react";
import { AbbrevSegmentedFilter } from "@/components/filters/AbbrevSegmentedFilter";
import type { AbbrevFilterOption } from "@/components/filters/analyticsAbbrev";
import { CATEGORIA_ABBREV_OPTIONS } from "@/components/filters/analyticsAbbrev";
import { MultiSelectFilter } from "@/components/filters/MultiSelectFilter";
import { UnidadNegocioTagFilter } from "@/components/filters/UnidadNegocioTagFilter";
import { ViaSegmentedOrMulti } from "@/components/filters/ViaSegmentedOrMulti";
import { useEffectiveSlotStyle } from "@/components/filters/useEffectiveSlotStyle";
import type { AnalyticsDashboardSectionId, AnalyticsFilterId } from "@/config/analyticsFilterLayouts";

type OmitIds = readonly AnalyticsFilterId[];

export type ConfigurableUnFilterProps = {
  sectionId: AnalyticsDashboardSectionId;
  label?: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  className?: string;
  emptyText?: string;
  omit?: OmitIds;
};

export function ConfigurableUnFilter({
  sectionId,
  label = "UN",
  options,
  selected,
  onChange,
  className = "",
  emptyText,
  omit,
}: ConfigurableUnFilterProps) {
  const st = useEffectiveSlotStyle(sectionId, "un", omit);
  const mode = st?.un_control ?? "tags_inline";

  if (mode === "multi_dropdown") {
    return (
      <MultiSelectFilter
        className={className}
        label={label}
        options={options}
        selected={selected}
        onChange={onChange}
        placeholder="Todas"
      />
    );
  }

  if (mode === "tags_split_row") {
    return (
      <UnidadNegocioTagFilter
        className={className}
        label={label}
        options={options}
        selected={selected}
        onChange={onChange}
        emptyText={emptyText}
        splitButtonRow
      />
    );
  }

  return (
    <UnidadNegocioTagFilter
      className={className}
      label={label}
      options={options}
      selected={selected}
      onChange={onChange}
      emptyText={emptyText}
    />
  );
}

export type ConfigurableViaFilterProps = {
  sectionId: AnalyticsDashboardSectionId;
  viaId: "via_cobro" | "via_pago";
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  className?: string;
  placeholder?: string;
  /** Corte fijo tipo cohorte (segmentado por abreviaturas en lugar de ViaSegmentedOrMulti). */
  fixedAbbrevOptions?: AbbrevFilterOption[];
  omit?: OmitIds;
};

export function ConfigurableViaFilter({
  sectionId,
  viaId,
  label,
  options,
  selected,
  onChange,
  className = "",
  placeholder,
  fixedAbbrevOptions,
  omit,
}: ConfigurableViaFilterProps) {
  const st = useEffectiveSlotStyle(sectionId, viaId, omit);
  const mode = st?.low_cardinality_control ?? "segmented";

  if (mode === "multi_dropdown") {
    return (
      <MultiSelectFilter
        className={className}
        label={label}
        options={options}
        selected={selected}
        onChange={onChange}
        placeholder={placeholder ?? "Todas"}
      />
    );
  }

  if (fixedAbbrevOptions?.length) {
    const value = selected[0] ?? "";
    /** Misma semántica compacta que vía segmentada en otras vistas: sin esto, AbbrevSegmentedFilter usa w-full y el grupo ocupa todo el ancho (p. ej. cohorte). */
    const abbrevClass = `${className} rendimiento-via-cobro-segmented`.trim();
    return (
      <AbbrevSegmentedFilter
        className={abbrevClass}
        label={label}
        options={fixedAbbrevOptions}
        value={value}
        onChange={(v) => onChange(v ? [v] : [])}
      />
    );
  }

  return (
    <ViaSegmentedOrMulti
      className={className}
      label={label}
      options={options}
      selected={selected}
      onChange={onChange}
      placeholder={placeholder ?? "Todas"}
    />
  );
}

export type ConfigurableCategoriaFilterProps = {
  sectionId: AnalyticsDashboardSectionId;
  /** Valores de categoría desde la API; si vacío se usan VIGENTE/MOROSO canónicos. */
  categoryOptions: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  className?: string;
  omit?: OmitIds;
};

function defaultCategoryOptionList(categoryOptions: string[]): string[] {
  if (categoryOptions.length > 0) return categoryOptions;
  return CATEGORIA_ABBREV_OPTIONS.map((o) => o.value).filter(Boolean);
}

export function ConfigurableCategoriaFilter({
  sectionId,
  categoryOptions,
  selected,
  onChange,
  className = "",
  omit,
}: ConfigurableCategoriaFilterProps) {
  const st = useEffectiveSlotStyle(sectionId, "categoria", omit);
  const mode = st?.low_cardinality_control ?? "segmented";
  const multiOpts = defaultCategoryOptionList(categoryOptions);

  if (mode === "multi_dropdown") {
    return (
      <MultiSelectFilter
        className={className}
        label="Categoría"
        options={multiOpts}
        selected={selected}
        onChange={onChange}
        placeholder="Todas"
      />
    );
  }

  return (
    <AbbrevSegmentedFilter
      className={`${className} rendimiento-categoria-segmented`.trim()}
      label="Categoría"
      options={CATEGORIA_ABBREV_OPTIONS}
      value={(selected[0] || "").toUpperCase()}
      onChange={(categoria) => onChange(categoria ? [categoria] : [])}
    />
  );
}
