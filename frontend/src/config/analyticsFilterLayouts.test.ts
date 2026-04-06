import { describe, expect, it } from "vitest";
import {
  buildEffectiveFilterLayout,
  resolveDashboardFilterRowGridClass,
  resolveDashboardFiltersLayout,
  snapshotFloatingFilterValues,
  type AnalyticsFilterId,
  type DashboardFilterLayoutsDocument,
} from "./analyticsFilterLayouts";

describe("resolveDashboardFilterRowGridClass", () => {
  it("cohorte macro usa clase canónica si el doc no define macro", () => {
    expect(
      resolveDashboardFilterRowGridClass("analisisCobranzaCohorte", "macro", {}),
    ).toBe("cohorte-filters-grid-3");
  });

  it("doc persistido gana sobre el default canónico de cohorte", () => {
    expect(
      resolveDashboardFilterRowGridClass("analisisCobranzaCohorte", "macro", {
        gridClassMacroFromDoc: "analysis-filters-grid",
      }),
    ).toBe("analysis-filters-grid");
  });

  it("prioriza gridClassByTier explícito de la vista", () => {
    expect(
      resolveDashboardFilterRowGridClass("cartera", "macro", {
        gridClassByTierFromView: { macro: "custom-grid" },
      }),
    ).toBe("custom-grid");
  });

  it("usa doc persistido en cartera", () => {
    expect(
      resolveDashboardFilterRowGridClass("cartera", "macro", {
        gridClassMacroFromDoc: "mi-rejilla",
      }),
    ).toBe("mi-rejilla");
  });
});

describe("resolveDashboardFiltersLayout", () => {
  it("excluye ids indicados en omit", () => {
    const r = resolveDashboardFiltersLayout("cartera", ["supervisor", "tramo"]);
    expect(r.macro).toEqual(["un", "via_cobro", "categoria"]);
    expect(r.micro).toEqual(["gestion_month", "contract_year"]);
    expect(r.floating).toEqual(["gestion_month", "un"]);
  });

  it("mantiene orden canónico de la sección", () => {
    const r = resolveDashboardFiltersLayout("analisisCarteraRendimiento", []);
    expect(r.macro[0]).toBe("un");
    expect(r.macro).toContain("via_pago");
    expect(r.micro).toEqual(["gestion_month", "supervisor"]);
    expect(r.floating?.length).toBeGreaterThan(0);
  });
});

describe("buildEffectiveFilterLayout", () => {
  it("usa override del servidor cuando hay macro/micro", () => {
    const doc: DashboardFilterLayoutsDocument = {
      version: 1,
      sections: {
        cartera: {
          macro: ["tramo", "un"] as AnalyticsFilterId[],
          micro: ["supervisor"] as AnalyticsFilterId[],
          slot_styles: { un: { column_span: 2 } },
        },
      },
    };
    const e = buildEffectiveFilterLayout("cartera", [], doc);
    expect(e.macro).toEqual(["tramo", "un"]);
    expect(e.micro).toEqual(["supervisor"]);
    expect(e.slotStyles.un?.column_span).toBe(2);
  });

  it("sin override usa solo código", () => {
    const e = buildEffectiveFilterLayout("cartera", [], null);
    expect(e.macro[0]).toBe("un");
    expect(e.micro).toContain("gestion_month");
    expect(e.floating).toEqual(["gestion_month", "un"]);
  });

  it("override con floating lateral", () => {
    const doc: DashboardFilterLayoutsDocument = {
      version: 1,
      sections: {
        cartera: {
          macro: ["un", "via_cobro", "categoria", "tramo"] as AnalyticsFilterId[],
          micro: ["gestion_month", "contract_year", "supervisor"] as AnalyticsFilterId[],
          floating: ["un", "gestion_month"] as AnalyticsFilterId[],
        },
      },
    };
    const e = buildEffectiveFilterLayout("cartera", [], doc);
    expect(e.floating).toEqual(["un", "gestion_month"]);
  });

  it("respeta low_cardinality_control y un_control", () => {
    const doc: DashboardFilterLayoutsDocument = {
      version: 1,
      sections: {
        cartera: {
          macro: ["via_cobro", "un"] as AnalyticsFilterId[],
          micro: [] as AnalyticsFilterId[],
          slot_styles: {
            via_cobro: { low_cardinality_control: "multi_dropdown" },
            un: { un_control: "tags_split_row" },
          },
        },
      },
    };
    const e = buildEffectiveFilterLayout("cartera", [], doc);
    expect(e.slotStyles.via_cobro?.low_cardinality_control).toBe("multi_dropdown");
    expect(e.slotStyles.un?.un_control).toBe("tags_split_row");
  });

  it("respeta min_width_px y control_scale en slot_styles", () => {
    const doc: DashboardFilterLayoutsDocument = {
      version: 1,
      sections: {
        analisisCarteraRendimiento: {
          macro: ["via_cobro"] as AnalyticsFilterId[],
          micro: [] as AnalyticsFilterId[],
          slot_styles: {
            via_cobro: {
              min_width_px: 200,
              control_scale: "comfortable",
            },
          },
        },
      },
    };
    const e = buildEffectiveFilterLayout("analisisCarteraRendimiento", [], doc);
    expect(e.slotStyles.via_cobro?.min_width_px).toBe(200);
    expect(e.slotStyles.via_cobro?.control_scale).toBe("comfortable");
  });
});

describe("snapshotFloatingFilterValues", () => {
  it("ordena ids y valores de forma estable", () => {
    const s = snapshotFloatingFilterValues(["un", "via_cobro"], (id) =>
      id === "un" ? ["b", "a"] : ["z"],
    );
    expect(s).toBe("un:a\u0001b|via_cobro:z");
  });
});
