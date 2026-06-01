/**
 * Verdad única del orden y presencia de filtros por sección del dashboard analytics.
 * Alineado a `power.md` § C y **C.1** (fila macro → UN / vía / categoría / tramo; fila micro → tiempo / supervisor / periodo).
 *
 * **Nueva sección de tablero:** añadir aquí un `sectionId` con `macro`, `micro` y `floating`
 * como el resto; en la vista usar `DashboardFiltersLayout`, `FloatingQuickFilters` +
 * `DashboardFloatingFiltersLayout`, y `buildEffectiveFilterLayout`. Para el auto-aplicar
 * del panel principal tras inactividad (~4 s), usar siempre `useDashboardMainFilterAutoApply`
 * (`frontend/src/hooks/useDashboardMainFilterAutoApply.ts`) con el mismo `effective` que el
 * layout. Espejo backend en `dashboard_filter_layouts.py` si la API normaliza layouts.
 *
 * Para quitar un filtro en una vista concreta sin editar este archivo, usá `omit` en
 * `DashboardFiltersLayout`. Para cambiar el canon de una sección, editá solo este módulo.
 */

export type AnalyticsFilterId =
  | "un"
  | "via_cobro"
  | "via_pago"
  | "categoria"
  | "tramo"
  | "supervisor"
  | "gestion_month"
  | "close_month"
  | "contract_year"
  /** Análisis anuales: mes/año de contrato */
  | "contract_month_combo"
  /** Cobranzas cohorte: mes de cobro (corte) */
  | "cobro_cutoff_month";

export type DashboardFiltersLayout = {
  readonly macro: readonly AnalyticsFilterId[];
  readonly micro: readonly AnalyticsFilterId[];
  /** Filtro lateral (FAB); orden y presencia configurables en admin. */
  readonly floating?: readonly AnalyticsFilterId[];
};

export const ANALYTICS_FILTER_LAYOUTS = {
  cartera: {
    macro: ["un", "via_cobro", "categoria", "tramo"],
    micro: ["gestion_month", "contract_year", "supervisor"],
    floating: ["gestion_month", "un"],
  },
  analisisCartera: {
    macro: ["un", "via_cobro", "categoria", "tramo"],
    micro: ["gestion_month", "close_month", "contract_year", "supervisor"],
    floating: ["gestion_month", "close_month", "un"],
  },
  roloCartera: {
    macro: ["un", "via_cobro"],
    micro: ["close_month", "contract_year", "supervisor"],
    floating: ["close_month", "un"],
  },
  analisisCarteraAnuales: {
    macro: ["un"],
    micro: ["contract_year", "contract_month_combo"],
    floating: ["un", "contract_year", "contract_month_combo"],
  },
  analisisCarteraRendimiento: {
    macro: ["un", "via_cobro", "via_pago", "categoria", "tramo"],
    micro: ["gestion_month", "supervisor"],
    floating: ["gestion_month", "un", "via_cobro", "categoria"],
  },
  analisisCobranzaCohorte: {
    macro: [
      "cobro_cutoff_month",
      "via_cobro",
      "supervisor",
      "categoria",
      "un",
    ],
    micro: [],
  },
} as const satisfies Record<string, DashboardFiltersLayout>;

export type AnalyticsDashboardSectionId = keyof typeof ANALYTICS_FILTER_LAYOUTS;

export function resolveDashboardFiltersLayout(
  sectionId: AnalyticsDashboardSectionId,
  omit: readonly AnalyticsFilterId[] = [],
): DashboardFiltersLayout {
  const base = ANALYTICS_FILTER_LAYOUTS[sectionId];
  const omitSet = new Set(omit);
  const fl = base.floating ?? [];
  return {
    macro: base.macro.filter((id) => !omitSet.has(id)),
    micro: base.micro.filter((id) => !omitSet.has(id)),
    floating: fl.filter((id) => !omitSet.has(id)),
  };
}

/** Estilo visual por control de filtro (persistido vía API). */
export type FilterControlScale = "compact" | "default" | "comfortable";

/**
 * Controles con pocas opciones típicas (≤5): segmentado compacto vs lista multi-selección.
 * Aplica a vía de cobro, vía de pago y categoría.
 */
export type LowCardinalityControlVariant = "segmented" | "multi_dropdown";

/**
 * Presentación del filtro UN (selección múltiple).
 */
export type UnControlVariant = "tags_inline" | "tags_split_row" | "multi_dropdown";

export type FilterSlotStyle = {
  column_span?: number;
  /** Ancho mínimo del bloque (segmentado / multi); afecta vía cobro/pago y similares. */
  min_width_px?: number;
  /** Tamaño táctil de botones del segmentado. */
  control_scale?: FilterControlScale;
  /** Solo vía_cobro / via_pago / categoria. */
  low_cardinality_control?: LowCardinalityControlVariant;
  /** Solo un. */
  un_control?: UnControlVariant;
};

/** Respuesta API GET/PUT `/brokers/config/dashboard-filter-layouts` */
export type SectionLayoutOverride = {
  macro: AnalyticsFilterId[];
  micro: AnalyticsFilterId[];
  floating?: AnalyticsFilterId[];
  grid_class_macro?: string | null;
  grid_class_micro?: string | null;
  slot_styles?: Partial<Record<AnalyticsFilterId, FilterSlotStyle>>;
};

export type DashboardFilterLayoutsDocument = {
  version: 1;
  sections: Partial<Record<AnalyticsDashboardSectionId, SectionLayoutOverride>>;
};

/**
 * Rejillas que las vistas fijan en código (misma prioridad que `gridClassByTier` en el componente).
 * Mantener alineado con cada `DashboardFiltersLayout` que pase `gridClassByTier`.
 */
export const DASHBOARD_FILTER_VIEW_GRID_OVERRIDES: Partial<
  Record<AnalyticsDashboardSectionId, Partial<Record<"macro" | "micro", string>>>
> = {
  analisisCobranzaCohorte: { macro: "cohorte-filters-grid-3" },
};

/**
 * Misma regla que `DashboardFiltersLayout`: vista explícita → doc persistido (admin) → default por sección → `analysis-filters-grid`.
 * El doc va antes del canónico para que en Configuración se pueda p. ej. `analysis-filters-grid` en cohorte y afecte el tablero.
 */
export function resolveDashboardFilterRowGridClass(
  sectionId: AnalyticsDashboardSectionId,
  tier: "macro" | "micro",
  opts: {
    gridClassByTierFromView?: Partial<Record<"macro" | "micro", string>>;
    gridClassMacroFromDoc?: string | null;
    gridClassMicroFromDoc?: string | null;
  },
): string {
  const fromExplicitView = opts.gridClassByTierFromView?.[tier]?.trim();
  if (fromExplicitView) return fromExplicitView;
  const fromDoc =
    tier === "macro"
      ? opts.gridClassMacroFromDoc?.trim()
      : opts.gridClassMicroFromDoc?.trim();
  if (fromDoc) return fromDoc;
  const fromCanonView =
    DASHBOARD_FILTER_VIEW_GRID_OVERRIDES[sectionId]?.[tier]?.trim();
  if (fromCanonView) return fromCanonView;
  return "analysis-filters-grid";
}

/** Documento de layouts con una sección sustituida (p. ej. borrador del editor). */
export function mergeDashboardLayoutsDocSection(
  base: DashboardFilterLayoutsDocument | null | undefined,
  sectionId: AnalyticsDashboardSectionId,
  section: SectionLayoutOverride,
): DashboardFilterLayoutsDocument {
  return {
    version: 1,
    sections: {
      ...(base?.sections ?? {}),
      [sectionId]: {
        macro: section.macro,
        micro: section.micro,
        ...(section.floating !== undefined
          ? { floating: section.floating }
          : {}),
        grid_class_macro: section.grid_class_macro?.trim() || undefined,
        grid_class_micro: section.grid_class_micro?.trim() || undefined,
        slot_styles:
          section.slot_styles && Object.keys(section.slot_styles).length > 0
            ? section.slot_styles
            : undefined,
      },
    },
  };
}

function defaultPoolForSection(
  sectionId: AnalyticsDashboardSectionId,
): Set<AnalyticsFilterId> {
  const d = ANALYTICS_FILTER_LAYOUTS[sectionId];
  const fl = d.floating ?? [];
  return new Set([...d.macro, ...d.micro, ...fl] as AnalyticsFilterId[]);
}

/**
 * Aplica overrides guardados por el admin sobre el layout en código.
 * Si la sección no tiene override o queda vacía, se usa solo el canon de repo.
 */
export function buildEffectiveFilterLayout(
  sectionId: AnalyticsDashboardSectionId,
  omit: readonly AnalyticsFilterId[],
  doc: DashboardFilterLayoutsDocument | null | undefined,
): {
  macro: AnalyticsFilterId[];
  micro: AnalyticsFilterId[];
  floating: AnalyticsFilterId[];
  slotStyles: Partial<Record<AnalyticsFilterId, FilterSlotStyle>>;
  gridClassByTierFromServer: Partial<Record<"macro" | "micro", string>>;
} {
  const base = resolveDashboardFiltersLayout(sectionId, omit);
  const omitSet = new Set(omit);
  const pool = defaultPoolForSection(sectionId);
  const raw = doc?.sections?.[sectionId];
  const nz = (a: readonly unknown[] | undefined) =>
    Array.isArray(a) ? a.length : 0;
  if (
    !raw ||
    (nz(raw.macro) === 0 &&
      nz(raw.micro) === 0 &&
      nz(raw.floating) === 0)
  ) {
    return {
      macro: [...base.macro],
      micro: [...base.micro],
      floating: [...(base.floating ?? [])],
      slotStyles: {},
      gridClassByTierFromServer: {},
    };
  }

  const filterRow = (row: readonly string[]): AnalyticsFilterId[] => {
    const out: AnalyticsFilterId[] = [];
    for (const x of row) {
      const id = x as AnalyticsFilterId;
      if (!pool.has(id) || omitSet.has(id)) continue;
      out.push(id);
    }
    return out;
  };

  const macro = filterRow(raw.macro ?? []);
  const micro = filterRow(raw.micro ?? []);
  const floating =
    raw.floating === undefined
      ? filterRow([...(base.floating ?? [])])
      : filterRow(raw.floating);
  const used = new Set([...macro, ...micro, ...floating]);
  const slot_styles = raw.slot_styles ?? {};
  const slotStyles: Partial<Record<AnalyticsFilterId, FilterSlotStyle>> = {};
  const scales: FilterControlScale[] = ["compact", "default", "comfortable"];
  const lowCardIds: AnalyticsFilterId[] = ["via_cobro", "via_pago", "categoria"];
  for (const id of used) {
    const st = slot_styles[id];
    if (!st) continue;
    const out: FilterSlotStyle = {};
    const sp = st.column_span;
    if (typeof sp === "number" && sp >= 2 && sp <= 4) {
      out.column_span = sp;
    }
    const mw = st.min_width_px;
    if (typeof mw === "number" && mw >= 72 && mw <= 420) {
      out.min_width_px = Math.round(mw);
    }
    const sc = st.control_scale;
    if (typeof sc === "string" && scales.includes(sc as FilterControlScale)) {
      const cs = sc as FilterControlScale;
      if (cs !== "default") {
        out.control_scale = cs;
      }
    }
    const lc = st.low_cardinality_control;
    if (
      lc === "multi_dropdown" &&
      lowCardIds.includes(id)
    ) {
      out.low_cardinality_control = lc;
    }
    const uc = st.un_control;
    if (id === "un" && (uc === "tags_split_row" || uc === "multi_dropdown")) {
      out.un_control = uc;
    }
    if (Object.keys(out).length > 0) {
      slotStyles[id] = out;
    }
  }

  const gridClassByTierFromServer: Partial<Record<"macro" | "micro", string>> =
    {};
  if (raw.grid_class_macro?.trim()) {
    gridClassByTierFromServer.macro = raw.grid_class_macro.trim();
  }
  if (raw.grid_class_micro?.trim()) {
    gridClassByTierFromServer.micro = raw.grid_class_micro.trim();
  }

  return { macro, micro, floating, slotStyles, gridClassByTierFromServer };
}

/**
 * Firma estable del estado de filtros que están en el panel lateral (FAB),
 * para comparar borrador vs aplicado y autodisparar "Aplicar" tras inactividad.
 */
export function snapshotFloatingFilterValues(
  floatingIds: readonly string[],
  pick: (id: string) => readonly string[],
): string {
  const sortedIds = [...floatingIds].sort();
  return sortedIds
    .map((id) => {
      const vals = [...pick(id)]
        .map((s) => String(s).trim())
        .filter(Boolean)
        .sort();
      return `${id}:${vals.join("\u0001")}`;
    })
    .join("|");
}
