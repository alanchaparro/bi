"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Label, TextField, Input } from "@heroui/react";
import {
  STRING_SELECT_TRIGGER_ANALYTICS,
  StringSelect,
} from "@/components/filters/StringSelect";
import {
  ANALYTICS_FILTER_LAYOUTS,
  type AnalyticsDashboardSectionId,
  type AnalyticsFilterId,
  type DashboardFilterLayoutsDocument,
  type FilterControlScale,
  type FilterSlotStyle,
  type LowCardinalityControlVariant,
  type UnControlVariant,
} from "@/config/analyticsFilterLayouts";
import { putDashboardFilterLayouts } from "@/shared/api";
import { useFilterLayoutConfig } from "@/components/filters/FilterLayoutConfigContext";
import { getApiErrorMessage } from "@/shared/apiErrors";
import { FilterLayoutEditorPreview } from "@/modules/config/FilterLayoutEditorPreview";

const SECTION_LABELS: Record<AnalyticsDashboardSectionId, string> = {
  cartera: "Resumen de Cartera",
  analisisCartera: "Análisis de Cartera",
  roloCartera: "Rolo de Cartera",
  analisisCarteraAnuales: "Análisis Anuales",
  analisisCarteraRendimiento: "Rendimiento de Cartera",
  analisisCobranzaCohorte: "Cobranzas por corte",
};

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

const SECTION_ORDER = Object.keys(ANALYTICS_FILTER_LAYOUTS) as AnalyticsDashboardSectionId[];

function supportsLowCardinalityControl(id: AnalyticsFilterId): boolean {
  return id === "via_cobro" || id === "via_pago" || id === "categoria";
}

const GRID_PRESETS = [
  { id: "", label: "Predeterminado (vista)" },
  {
    id: "analysis-filters-grid",
    label: "Fila flexible + rejilla responsive (1→4 cols según pantalla)",
  },
  {
    id: "cohorte-filters-grid-3",
    label: "Cohorte: clase cohorte-filters-grid-3 (flex en panel como Cartera)",
  },
];

function defaultSectionLayout(section: AnalyticsDashboardSectionId) {
  const d = ANALYTICS_FILTER_LAYOUTS[section];
  return {
    macro: [...d.macro] as AnalyticsFilterId[],
    micro: [...d.micro] as AnalyticsFilterId[],
    floating: [...(d.floating ?? [])] as AnalyticsFilterId[],
    grid_class_macro: "" as string,
    grid_class_micro: "" as string,
    slot_styles: {} as Partial<Record<AnalyticsFilterId, FilterSlotStyle>>,
  };
}

function readSectionDraft(
  draft: DashboardFilterLayoutsDocument,
  section: AnalyticsDashboardSectionId,
) {
  const raw = draft.sections[section];
  const def = defaultSectionLayout(section);
  if (!raw) return def;
  return {
    // Arrays vacíos son válidos (p. ej. todo en FAB); no volver al canon al vaciar macro/micro.
    macro: Array.isArray(raw.macro) ? [...raw.macro] : def.macro,
    micro: Array.isArray(raw.micro) ? [...raw.micro] : def.micro,
    floating:
      raw.floating !== undefined && Array.isArray(raw.floating)
        ? [...raw.floating]
        : [...def.floating],
    grid_class_macro: raw.grid_class_macro?.trim() ?? "",
    grid_class_micro: raw.grid_class_micro?.trim() ?? "",
    slot_styles: { ...(raw.slot_styles ?? {}) },
  };
}

type LayoutTier = "macro" | "micro" | "floating";

const LAYOUT_TIER_LABELS: Record<LayoutTier, string> = {
  macro: "macro",
  micro: "micro",
  floating: "lateral",
};

const ALL_LAYOUT_TIERS: LayoutTier[] = ["macro", "micro", "floating"];

export function DashboardFilterLayoutsEditor() {
  const { doc, reload } = useFilterLayoutConfig();
  const [draft, setDraft] = useState<DashboardFilterLayoutsDocument>({
    version: 1,
    sections: {},
  });
  const [section, setSection] = useState<AnalyticsDashboardSectionId>("cartera");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [dragId, setDragId] = useState<AnalyticsFilterId | null>(null);

  useEffect(() => {
    if (doc) setDraft(doc);
  }, [doc]);

  const pool = useMemo(() => {
    const cur = readSectionDraft(draft, section);
    const used = new Set([...cur.macro, ...cur.micro, ...cur.floating]);
    const canon = ANALYTICS_FILTER_LAYOUTS[section];
    const all = [
      ...canon.macro,
      ...canon.micro,
      ...(canon.floating ?? []),
    ] as AnalyticsFilterId[];
    return all.filter((id) => !used.has(id));
  }, [draft, section]);

  const updateSection = useCallback(
    (
      updater: (prev: ReturnType<typeof readSectionDraft>) => ReturnType<
        typeof readSectionDraft
      >,
    ) => {
      setDraft((d) => {
        const cur = readSectionDraft(d, section);
        const nextLocal = updater(cur);
        return {
          version: 1,
          sections: {
            ...d.sections,
            [section]: {
              macro: nextLocal.macro,
              micro: nextLocal.micro,
              floating: nextLocal.floating,
              grid_class_macro: nextLocal.grid_class_macro || undefined,
              grid_class_micro: nextLocal.grid_class_micro || undefined,
              slot_styles:
                Object.keys(nextLocal.slot_styles).length > 0
                  ? nextLocal.slot_styles
                  : undefined,
            },
          },
        };
      });
    },
    [section],
  );

  const moveInTier = (tier: LayoutTier, index: number, dir: -1 | 1) => {
    updateSection((cur) => {
      const macro = [...cur.macro];
      const micro = [...cur.micro];
      const floating = [...cur.floating];
      const row =
        tier === "macro" ? macro : tier === "micro" ? micro : floating;
      const j = index + dir;
      if (j < 0 || j >= row.length) return cur;
      const t = row[index];
      row[index] = row[j];
      row[j] = t;
      return { ...cur, macro, micro, floating };
    });
  };

  const removeFromTier = (tier: LayoutTier, index: number) => {
    updateSection((cur) => {
      const macro = [...cur.macro];
      const micro = [...cur.micro];
      const floating = [...cur.floating];
      const row =
        tier === "macro" ? macro : tier === "micro" ? micro : floating;
      const [removed] = row.splice(index, 1);
      const slot_styles = { ...cur.slot_styles };
      if (removed) delete slot_styles[removed];
      return { ...cur, macro, micro, floating, slot_styles };
    });
  };

  const addToTier = (tier: LayoutTier, id: AnalyticsFilterId) => {
    updateSection((cur) => {
      const macro = [...cur.macro];
      const micro = [...cur.micro];
      const floating = [...cur.floating];
      const row =
        tier === "macro" ? macro : tier === "micro" ? micro : floating;
      if (row.includes(id)) return cur;
      row.push(id);
      return { ...cur, macro, micro, floating };
    });
  };

  const moveToTier = (from: LayoutTier, index: number, to: LayoutTier) => {
    if (from === to) return;
    updateSection((cur) => {
      const macro = [...cur.macro];
      const micro = [...cur.micro];
      const floating = [...cur.floating];
      const pick = (t: LayoutTier) =>
        t === "macro" ? macro : t === "micro" ? micro : floating;
      const src = pick(from);
      const dst = pick(to);
      const [id] = src.splice(index, 1);
      if (!id || dst.includes(id)) return cur;
      dst.push(id);
      return { ...cur, macro, micro, floating };
    });
  };

  const patchSlotStyle = (id: AnalyticsFilterId, patch: Partial<FilterSlotStyle>) => {
    updateSection((cur) => {
      const slot_styles: Partial<Record<AnalyticsFilterId, FilterSlotStyle>> = {
        ...cur.slot_styles,
      };
      const existing: FilterSlotStyle = { ...(slot_styles[id] ?? {}) };
      if ("column_span" in patch) {
        const sp = patch.column_span;
        if (sp === undefined || sp <= 1) delete existing.column_span;
        else existing.column_span = sp;
      }
      if ("min_width_px" in patch) {
        const mw = patch.min_width_px;
        if (mw === undefined || Number.isNaN(mw)) delete existing.min_width_px;
        else {
          const n = Math.round(Number(mw));
          if (n < 72 || n > 420) delete existing.min_width_px;
          else existing.min_width_px = n;
        }
      }
      if ("control_scale" in patch) {
        const cs = patch.control_scale;
        if (cs === undefined || cs === "default") delete existing.control_scale;
        else existing.control_scale = cs as FilterControlScale;
      }
      if ("low_cardinality_control" in patch) {
        const lc = patch.low_cardinality_control;
        if (lc === undefined || lc === "segmented") {
          delete existing.low_cardinality_control;
        } else {
          existing.low_cardinality_control = lc as LowCardinalityControlVariant;
        }
      }
      if ("un_control" in patch) {
        const uc = patch.un_control;
        if (uc === undefined || uc === "tags_inline") {
          delete existing.un_control;
        } else {
          existing.un_control = uc as UnControlVariant;
        }
      }
      if (Object.keys(existing).length === 0) delete slot_styles[id];
      else slot_styles[id] = existing;
      return { ...cur, slot_styles };
    });
  };

  const cur = readSectionDraft(draft, section);

  const onSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const out = await putDashboardFilterLayouts(draft);
      setDraft(out);
      await reload();
      setMessage({ ok: true, text: "Layout guardado. Se aplicará en las vistas analytics." });
    } catch (e: unknown) {
      setMessage({
        ok: false,
        text: getApiErrorMessage(e) || "No se pudo guardar.",
      });
    } finally {
      setSaving(false);
    }
  };

  const onResetSection = () => {
    setDraft((d) => {
      const next = { version: 1 as const, sections: { ...d.sections } };
      delete next.sections[section];
      return next;
    });
    setMessage({
      ok: true,
      text: "Se eliminó el override de esta sección (vuelve al layout del código). Guardá para persistir.",
    });
  };

  const onResetAll = () => {
    setDraft({ version: 1, sections: {} });
    setMessage({
      ok: true,
      text: "Borrados todos los overrides locales. Guardá para persistir en servidor.",
    });
  };

  const renderTier = (tier: LayoutTier, title: string) => {
    const row =
      tier === "macro" ? cur.macro : tier === "micro" ? cur.micro : cur.floating;
    return (
      <div
        className="config-dashboard-layout-tier"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={(e) => {
          e.preventDefault();
          const id = e.dataTransfer.getData("text/plain") as AnalyticsFilterId;
          if (!id) return;
          if (row.includes(id)) return;
          updateSection((c) => {
            const macro = [...c.macro];
            const micro = [...c.micro];
            const floating = [...c.floating];
            const removeFromAll = (x: AnalyticsFilterId) => {
              const im = macro.indexOf(x);
              if (im >= 0) macro.splice(im, 1);
              const ij = micro.indexOf(x);
              if (ij >= 0) micro.splice(ij, 1);
              const ik = floating.indexOf(x);
              if (ik >= 0) floating.splice(ik, 1);
            };
            removeFromAll(id);
            if (tier === "macro") macro.push(id);
            else if (tier === "micro") micro.push(id);
            else floating.push(id);
            return { ...c, macro, micro, floating };
          });
          setDragId(null);
        }}
      >
        <h4 className="config-section-subtitle">{title}</h4>
        <ul className="config-dashboard-layout-list">
          {row.map((id, index) => (
            <li
              key={`${tier}-${id}`}
              className="config-dashboard-layout-item"
              draggable
              onDragStart={(e) => {
                setDragId(id);
                e.dataTransfer.setData("text/plain", id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => setDragId(null)}
            >
              <div className="config-dashboard-layout-item-main">
              <span className="config-dashboard-layout-drag" title="Arrastrar">
                ⋮⋮
              </span>
              <span className="config-dashboard-layout-label">
                {FILTER_LABELS[id] ?? id}
              </span>
              <span className="config-dashboard-layout-id">{id}</span>
              {id === "un" ? (
                <StringSelect
                  aria-label={`Tipo de control UN ${FILTER_LABELS[id] ?? id}`}
                  items={[
                    { id: "tags_inline", label: "UN: botones en bloque" },
                    { id: "tags_split_row", label: "UN: etiqueta + fila de botones" },
                    { id: "multi_dropdown", label: "UN: lista multi-selección" },
                  ]}
                  selectedKey={cur.slot_styles[id]?.un_control ?? "tags_inline"}
                  onSelectionChange={(k) =>
                    patchSlotStyle(id, {
                      un_control:
                        !k || k === "tags_inline"
                          ? undefined
                          : (k as UnControlVariant),
                    })
                  }
                  triggerClassName={`${STRING_SELECT_TRIGGER_ANALYTICS} config-dashboard-layout-control-kind-select`}
                  ui="select"
                />
              ) : null}
              {supportsLowCardinalityControl(id) ? (
                <StringSelect
                  aria-label={`Tipo de control pocos valores ${FILTER_LABELS[id] ?? id}`}
                  items={[
                    {
                      id: "segmented",
                      label: "Pocos valores: botones segmentados",
                    },
                    {
                      id: "multi_dropdown",
                      label: "Pocos valores: lista multi-selección",
                    },
                  ]}
                  selectedKey={
                    cur.slot_styles[id]?.low_cardinality_control ?? "segmented"
                  }
                  onSelectionChange={(k) =>
                    patchSlotStyle(id, {
                      low_cardinality_control:
                        !k || k === "segmented"
                          ? undefined
                          : (k as LowCardinalityControlVariant),
                    })
                  }
                  triggerClassName={`${STRING_SELECT_TRIGGER_ANALYTICS} config-dashboard-layout-control-kind-select`}
                  ui="select"
                />
              ) : null}
              <StringSelect
                aria-label={`Ancho rejilla ${FILTER_LABELS[id] ?? id}`}
                items={[
                  { id: "1", label: "Ancho rejilla ×1" },
                  { id: "2", label: "Ancho rejilla ×2" },
                  { id: "3", label: "Ancho rejilla ×3" },
                  { id: "4", label: "Ancho rejilla ×4 (fila)" },
                ]}
                selectedKey={String(cur.slot_styles[id]?.column_span ?? 1)}
                onSelectionChange={(k) =>
                  patchSlotStyle(id, { column_span: Number(k) || 1 })
                }
                triggerClassName={`${STRING_SELECT_TRIGGER_ANALYTICS} config-dashboard-layout-span-select`}
                ui="select"
              />
              <TextField className="config-dashboard-minwidth-field">
                <Input
                  type="number"
                  min={72}
                  max={420}
                  step={4}
                  placeholder="Min px (72–420)"
                  aria-label={`Ancho mínimo en píxeles del control ${FILTER_LABELS[id] ?? id}`}
                  value={
                    cur.slot_styles[id]?.min_width_px != null
                      ? String(cur.slot_styles[id]!.min_width_px)
                      : ""
                  }
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    if (v === "") patchSlotStyle(id, { min_width_px: undefined });
                    else patchSlotStyle(id, { min_width_px: Number(v) });
                  }}
                />
              </TextField>
              <StringSelect
                aria-label={`Tamaño botones ${FILTER_LABELS[id] ?? id}`}
                items={[
                  { id: "default", label: "Botones: predeterminado" },
                  { id: "compact", label: "Botones: compacto" },
                  { id: "comfortable", label: "Botones: cómodo" },
                ]}
                selectedKey={cur.slot_styles[id]?.control_scale ?? "default"}
                onSelectionChange={(k) =>
                  patchSlotStyle(id, {
                    control_scale:
                      !k || k === "default"
                        ? undefined
                        : (k as FilterControlScale),
                  })
                }
                triggerClassName={`${STRING_SELECT_TRIGGER_ANALYTICS} config-dashboard-layout-scale-select`}
                ui="select"
              />
              <div className="config-dashboard-layout-actions">
                <Button
                  type="button"
                  size="md"
                  variant="secondary"
                  className="config-dashboard-toolbar-btn"
                  onPress={() => moveInTier(tier, index, -1)}
                  isDisabled={index === 0}
                >
                  Subir
                </Button>
                <Button
                  type="button"
                  size="md"
                  variant="secondary"
                  className="config-dashboard-toolbar-btn"
                  onPress={() => moveInTier(tier, index, 1)}
                  isDisabled={index >= row.length - 1}
                >
                  Bajar
                </Button>
                {ALL_LAYOUT_TIERS.filter((t) => t !== tier).map((dest) => (
                  <Button
                    key={dest}
                    type="button"
                    size="md"
                    variant="secondary"
                    className="config-dashboard-toolbar-btn"
                    onPress={() => moveToTier(tier, index, dest)}
                  >
                    A {LAYOUT_TIER_LABELS[dest]}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="md"
                  variant="outline"
                  className="config-dashboard-toolbar-btn config-dashboard-toolbar-btn--danger"
                  onPress={() => removeFromTier(tier, index)}
                >
                  Quitar
                </Button>
              </div>
              </div>
              <FilterLayoutEditorPreview
                sectionId={section}
                tier={tier}
                filterId={id}
                sectionDraft={cur}
              />
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="config-dashboard-layout-editor">
      <p className="config-muted-text">
        Orden y visibilidad de filtros por sección del tablero. Arrastrá ítems entre{" "}
        <strong>Macro</strong>, <strong>Micro</strong> y el <strong>panel flotante lateral</strong> (FAB).
        Para <strong>UN</strong> y filtros con pocas opciones típicas (vía de cobro/pago, categoría)
        podés elegir el <strong>tipo de control</strong> (segmentado vs lista) y ver la vista previa.
        Los cambios quedan activos tras <strong>Guardar</strong> (todos los usuarios).
      </p>

      <div className="config-grid-2 config-mt-xs">
        <div>
          <Label className="config-label-caption">Sección</Label>
          <StringSelect
            aria-label="Sección del tablero"
            items={SECTION_ORDER.map((sid) => ({
              id: sid,
              label: SECTION_LABELS[sid] ?? sid,
            }))}
            selectedKey={section}
            onSelectionChange={(k) =>
              setSection(k as AnalyticsDashboardSectionId)
            }
            triggerClassName={`${STRING_SELECT_TRIGGER_ANALYTICS} w-full max-w-md`}
            ui="select"
          />
        </div>
      </div>

      <div className="config-dashboard-layout-grid config-mt-sm">
        {renderTier("macro", "Fila macro (UN / vías / categoría / tramo)")}
        {renderTier("micro", "Fila micro (tiempo / supervisor / periodo)")}
        {renderTier(
          "floating",
          "Panel flotante lateral (acceso rápido, mismo control que el tablero)",
        )}
      </div>

      <p className="config-muted-text config-mt-xs">
        <strong>Cobranzas por corte:</strong> vacío usa la clase por defecto de la sección. Para forzar la
        misma fila horizontal que Cartera/Rendimiento dentro del panel, elegí la preset &quot;Fila flexible…&quot;
        o escribí <code>analysis-filters-grid</code>. &quot;Ancho rejilla ×N&quot;
        en cada filtro sigue controlando cuánto espacio ocupa ese bloque al hacer wrap (responsive).
      </p>

      <div className="config-mt-sm config-grid-2">
        <div>
          <Label className="config-label-caption">Clase CSS fila macro (opcional)</Label>
          <TextField className="w-full max-w-md">
            <Input
              value={cur.grid_class_macro}
              onChange={(e) =>
                updateSection((c) => ({
                  ...c,
                  grid_class_macro: e.target.value,
                }))
              }
              placeholder="ej. cohorte-filters-grid-3"
            />
          </TextField>
        </div>
        <div>
          <Label className="config-label-caption">Clase CSS fila micro (opcional)</Label>
          <TextField className="w-full max-w-md">
            <Input
              value={cur.grid_class_micro}
              onChange={(e) =>
                updateSection((c) => ({
                  ...c,
                  grid_class_micro: e.target.value,
                }))
              }
            />
          </TextField>
        </div>
      </div>

      <div className="config-mt-sm">
        <Label className="config-label-caption">Presets de rejilla (rellenar campos)</Label>
        <div className="config-row-wrap-tight">
          {GRID_PRESETS.filter((g) => g.id).map((g) => (
            <Button
              key={g.id}
              type="button"
              size="sm"
              variant="outline"
              onPress={() =>
                updateSection((c) => ({
                  ...c,
                  grid_class_macro: g.id,
                }))
              }
            >
              Macro: {g.label}
            </Button>
          ))}
        </div>
      </div>

      {pool.length > 0 ? (
        <div className="config-mt-sm">
          <h4 className="config-section-subtitle">Filtros disponibles (sin colocar)</h4>
          <p className="config-muted-text config-no-margin">
            Arrastrá a Macro, Micro o Lateral, o usá los botones.
          </p>
          <ul className="config-dashboard-pool">
            {pool.map((id) => (
              <li key={id} className="config-dashboard-pool-item">
                <span
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", id);
                    e.dataTransfer.effectAllowed = "copyMove";
                  }}
                >
                  {FILTER_LABELS[id] ?? id}
                </span>
                <Button type="button" size="sm" variant="outline" onPress={() => addToTier("macro", id)}>
                  + Macro
                </Button>
                <Button type="button" size="sm" variant="outline" onPress={() => addToTier("micro", id)}>
                  + Micro
                </Button>
                <Button type="button" size="sm" variant="outline" onPress={() => addToTier("floating", id)}>
                  + Lateral
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="config-row-wrap-tight config-mt-md">
        <Button type="button" variant="primary" onPress={() => void onSave()} isDisabled={saving}>
          {saving ? "Guardando..." : "Guardar layouts"}
        </Button>
        <Button type="button" variant="outline" onPress={onResetSection}>
          Restablecer esta sección
        </Button>
        <Button type="button" variant="outline" onPress={onResetAll}>
          Borrar todos los overrides (borrador)
        </Button>
      </div>

      {message ? (
        <p className={message.ok ? "status-ok config-mt-xs" : "status-error config-mt-xs"}>
          {message.text}
        </p>
      ) : null}

      {dragId ? (
        <p className="config-muted-text config-mt-xs" role="status">
          Soltá en Macro, Micro o Lateral para mover <code>{dragId}</code>.
        </p>
      ) : null}
    </div>
  );
}
