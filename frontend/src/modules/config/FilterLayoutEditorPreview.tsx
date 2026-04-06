"use client";

import React, { useMemo, useState } from "react";
import {
  ConfigurableCategoriaFilter,
  ConfigurableUnFilter,
  ConfigurableViaFilter,
} from "@/components/filters/ConfigurableAnalyticsFilters";
import { wrapDashboardFilterSlot } from "@/components/filters/DashboardFiltersLayout";
import {
  FilterLayoutDocOverrideProvider,
  useFilterLayoutConfig,
} from "@/components/filters/FilterLayoutConfigContext";
import { VIA_DEBITO_COBRADOR_ABBREV_OPTIONS } from "@/components/filters/analyticsAbbrev";
import {
  buildEffectiveFilterLayout,
  mergeDashboardLayoutsDocSection,
  resolveDashboardFilterRowGridClass,
  type AnalyticsDashboardSectionId,
  type AnalyticsFilterId,
  type FilterSlotStyle,
  type SectionLayoutOverride,
} from "@/config/analyticsFilterLayouts";

const DEMO_VIA_OPTIONS = ["Cobrador", "Débito", "Efectivo", "Transferencia"];
const DEMO_UNS = ["MEDICINA ESTETICA", "MEDICINA PREPAGA", "ODONTOLOGIA", "ODONTOLOGIA TTO"];
const DEMO_COHORTE_VIAS = ["DEBITO", "COBRADOR"];
const DEMO_CATEGORIAS = ["VIGENTE", "MOROSO"];

const FILTER_LABELS: Record<AnalyticsFilterId, string> = {
  un: "UN",
  via_cobro: "Vía de cobro",
  via_pago: "Vía de pago",
  categoria: "Categoría",
  tramo: "Tramo",
  supervisor: "Supervisor",
  gestion_month: "Mes de gestión",
  close_month: "Mes de cierre",
  contract_year: "Año de contrato",
  contract_month_combo: "Mes/Año de contrato",
  cobro_cutoff_month: "Mes de cobro (corte)",
};

export type SectionDraftForPreview = {
  macro: AnalyticsFilterId[];
  micro: AnalyticsFilterId[];
  floating: AnalyticsFilterId[];
  grid_class_macro: string;
  grid_class_micro: string;
  slot_styles: Partial<Record<AnalyticsFilterId, FilterSlotStyle>>;
};

type Props = {
  sectionId: AnalyticsDashboardSectionId;
  tier: "macro" | "micro" | "floating";
  filterId: AnalyticsFilterId;
  sectionDraft: SectionDraftForPreview;
};

function draftToSectionOverride(d: SectionDraftForPreview): SectionLayoutOverride {
  return {
    macro: d.macro,
    micro: d.micro,
    floating: d.floating,
    grid_class_macro: d.grid_class_macro.trim() || undefined,
    grid_class_micro: d.grid_class_micro.trim() || undefined,
    slot_styles:
      Object.keys(d.slot_styles).length > 0 ? d.slot_styles : undefined,
  };
}

/** Contenido interactivo: mismos componentes que el tablero; estado local solo para demo. */
function EditorPreviewLiveControl({
  filterId,
  sectionId,
}: {
  filterId: AnalyticsFilterId;
  sectionId: AnalyticsDashboardSectionId;
}) {
  const [viaSel, setViaSel] = useState<string[]>([]);
  const [cat, setCat] = useState<string[]>([]);
  const [unSel, setUnSel] = useState<string[]>([]);

  const cohorteFixedVia =
    sectionId === "analisisCobranzaCohorte" && filterId === "via_cobro";

  switch (filterId) {
    case "un":
      return (
        <ConfigurableUnFilter
          sectionId={sectionId}
          className="analysis-filter-control"
          label="UN"
          options={DEMO_UNS}
          selected={unSel}
          onChange={setUnSel}
        />
      );
    case "via_cobro":
      return (
        <ConfigurableViaFilter
          sectionId={sectionId}
          viaId="via_cobro"
          className="analysis-filter-control"
          label="Vía de cobro"
          options={cohorteFixedVia ? DEMO_COHORTE_VIAS : DEMO_VIA_OPTIONS}
          selected={viaSel}
          onChange={setViaSel}
          fixedAbbrevOptions={
            cohorteFixedVia ? VIA_DEBITO_COBRADOR_ABBREV_OPTIONS : undefined
          }
        />
      );
    case "via_pago":
      return (
        <ConfigurableViaFilter
          sectionId={sectionId}
          viaId="via_pago"
          className="analysis-filter-control"
          label="Vía de pago"
          options={DEMO_VIA_OPTIONS}
          selected={viaSel}
          onChange={setViaSel}
        />
      );
    case "categoria":
      return (
        <ConfigurableCategoriaFilter
          sectionId={sectionId}
          className="analysis-filter-control"
          categoryOptions={DEMO_CATEGORIAS}
          selected={cat}
          onChange={setCat}
        />
      );
    default:
      return (
        <p className="config-dashboard-preview-placeholder config-no-margin">
          Vista previa WYSIWYG de fila y rejilla. Los estilos de slot (ancho, escala, tipo de control)
          coinciden con el tablero al guardar.
        </p>
      );
  }
}

function EditorPreviewPlaceholderControl({ filterId }: { filterId: AnalyticsFilterId }) {
  return (
    <div
      className="config-editor-preview-slot-ph analysis-filter-control"
      title="Otro filtro de la misma fila (placeholder)"
    >
      <span className="config-editor-preview-slot-ph__label">
        {FILTER_LABELS[filterId] ?? filterId}
      </span>
    </div>
  );
}

/**
 * Fila de vista previa alineada a producción: misma clase de rejilla, mismos wrappers de slot,
 * documento de layout = API + borrador de sección (tipos de control y estilos WYSIWYG).
 */
function FilterLayoutEditorPreviewInner({
  sectionId,
  tier,
  focusFilterId,
}: {
  sectionId: AnalyticsDashboardSectionId;
  tier: "macro" | "micro" | "floating";
  focusFilterId: AnalyticsFilterId;
}) {
  const { doc } = useFilterLayoutConfig();
  const effective = buildEffectiveFilterLayout(sectionId, [], doc);
  const rowIds =
    tier === "macro"
      ? effective.macro
      : tier === "micro"
        ? effective.micro
        : effective.floating;

  if (tier === "floating") {
    return (
      <div
        className="dashboard-filters-row dashboard-filters-row--floating"
        data-dashboard-filter-tier="floating"
        data-preview-focus={focusFilterId}
      >
        <div className="analytics-floating-filter-grid max-w-md">
          {rowIds.map((id) => {
            const slotSt = effective.slotStyles[id];
            const node =
              id === focusFilterId ? (
                <EditorPreviewLiveControl filterId={id} sectionId={sectionId} />
              ) : (
                <EditorPreviewPlaceholderControl filterId={id} />
              );
            return wrapDashboardFilterSlot(id, node, slotSt);
          })}
        </div>
      </div>
    );
  }

  const gridClass = resolveDashboardFilterRowGridClass(sectionId, tier, {
    gridClassMacroFromDoc: effective.gridClassByTierFromServer.macro,
    gridClassMicroFromDoc: effective.gridClassByTierFromServer.micro,
  });

  return (
    <div
      className={`dashboard-filters-row dashboard-filters-row--${tier}`}
      data-dashboard-filter-tier={tier}
      data-preview-focus={focusFilterId}
    >
      <div className={gridClass}>
        {rowIds.map((id) => {
          const slotSt = effective.slotStyles[id];
          const node =
            id === focusFilterId ? (
              <EditorPreviewLiveControl filterId={id} sectionId={sectionId} />
            ) : (
              <EditorPreviewPlaceholderControl filterId={id} />
            );
          return wrapDashboardFilterSlot(id, node, slotSt);
        })}
      </div>
    </div>
  );
}

/**
 * Vista previa WYSIWYG: rejilla y fila como en el tablero; layout efectivo = servidor + borrador de sección.
 */
export function FilterLayoutEditorPreview({
  sectionId,
  tier,
  filterId,
  sectionDraft,
}: Props) {
  const { doc: parentDoc } = useFilterLayoutConfig();
  const previewDoc = useMemo(
    () =>
      mergeDashboardLayoutsDocSection(
        parentDoc,
        sectionId,
        draftToSectionOverride(sectionDraft),
      ),
    [parentDoc, sectionId, sectionDraft],
  );

  return (
    <div className="config-dashboard-filter-preview rendimiento-filters-panel">
      <p className="config-dashboard-preview-caption">
        Vista previa WYSIWYG: misma fila y rejilla que el tablero (incl. cohorte / rendimiento)
      </p>
      <FilterLayoutDocOverrideProvider doc={previewDoc}>
        <FilterLayoutEditorPreviewInner
          sectionId={sectionId}
          tier={tier}
          focusFilterId={filterId}
        />
      </FilterLayoutDocOverrideProvider>
    </div>
  );
}
