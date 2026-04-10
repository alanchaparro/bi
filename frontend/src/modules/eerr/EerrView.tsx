import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Chip,
  Label,
  ListBox,
  Select,
  Slider,
  Switch,
  Tabs,
} from "@heroui/react";
import { AnalyticsPageHeader } from "@/components/analytics/AnalyticsPageHeader";
import { AnalyticsMetaBadges } from "@/components/analytics/AnalyticsMetaBadges";
import { MetricExplainer } from "@/components/analytics/MetricExplainer";
import {
  aggregateEerrRowsByGestionMonth,
  type EerrMonthAgg,
  EerrGroupedBlockChart,
  EerrMargenEbitdaLineChart,
} from "@/components/analytics/EerrDashboardCharts";
import { MultiSelectFilter } from "@/components/filters/MultiSelectFilter";
import { AnalysisFiltersSkeleton } from "@/components/feedback/AnalysisFiltersSkeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { getApiErrorMessage } from "@/shared/apiErrors";
import {
  formatCount,
  formatGsFull,
  formatPercent,
  formatAnalyticsTimestampForDisplay,
} from "@/shared/formatters";
import { useIsLightTheme } from "@/shared/useIsLightTheme";
import {
  getEerrV2Options,
  getEerrV2Summary,
  markPerfReady,
  type EerrV2SummaryResponse,
  type EerrV2SummaryRow,
} from "@/shared/api";
import {
  boundsFromMonthOptions,
  distinctYearsFromMonthOptions,
  gestionMonthsForApi,
  monthShortEs,
} from "@/modules/eerr/eerrGestionRange";
import { sortMesGestionDesc } from "@/shared/sortMesGestionOptions";
import {
  aggregateCuentaNetByMayorBlock,
  aggregateCuentaNetByMayorVentas,
  aggregateMayorNetByBlock,
  buildEerrDetalleTree,
  type EerrDetalleEmpresaNode,
  type MayorNetLine,
} from "@/modules/eerr/eerrMayorBreakdown";
import { EerrGlosarioInfo } from "@/modules/eerr/eerrGlosario";

const BLOCK_LABELS: Record<string, string> = {
  ventas: "Ventas (ingresos)",
  costos: "Costos",
  gastos: "Gastos",
};

type Filters = {
  /** Años de gestión elegidos (subconjunto de los que existen en opciones API). */
  selectedYears: number[];
  monthRange: [number, number];
  blocks: string[];
  socialReasonIds: string[];
  /** Cuando es true, excluye asientos de tratamientos TAPO del EERR. */
  excludeTapo: boolean;
};

function defaultFiltersForMonths(months: string[]): Filters {
  return {
    selectedYears: distinctYearsFromMonthOptions(months),
    monthRange: [1, 12],
    blocks: [],
    socialReasonIds: [],
    excludeTapo: false,
  };
}

type EerrTab = "resumen" | "resumen_mayor" | "graficos" | "detalle";
type CompareSide = "L" | "R";

function KpiHeroCard({
  title,
  value,
  chip,
}: {
  title: string;
  value: string;
  chip?: string;
}) {
  return (
    <Card className="eerr-kpi-card-heroui" variant="secondary">
      <Card.Header className="eerr-kpi-card-head flex flex-row items-start justify-between gap-2">
        <Card.Title className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {title}
        </Card.Title>
        {chip ? (
          <Chip size="sm" variant="soft" color="accent">
            {chip}
          </Chip>
        ) : null}
      </Card.Header>
      <Card.Content className="pt-0">
        <div className="eerr-kpi-value">{value}</div>
      </Card.Content>
    </Card>
  );
}

/** % del total de ventas (operativo); magnitud con abs para costos/gastos. */
function formatPctDeVentas(amount: number, totalVentas: number): string {
  const v = Number(totalVentas);
  if (!Number.isFinite(v) || v === 0) return "—";
  const a = Number(amount);
  if (!Number.isFinite(a)) return "—";
  return formatPercent((100 * Math.abs(a)) / v);
}

function CostoGastoMayorBreakdownList({
  lines,
  rows,
  totalVentas,
}: {
  lines: MayorNetLine[];
  rows: EerrV2SummaryRow[];
  totalVentas: number;
}) {
  if (!lines.length) {
    return (
      <p className="text-xs text-[var(--color-text-muted)] leading-snug">
        Sin líneas en el detalle para este bloque con los filtros actuales.
      </p>
    );
  }
  return (
    <ul className="space-y-1 text-xs max-h-64 overflow-y-auto pr-0.5">
      {lines.map((l) => (
        <CostoGastoMayorRow
          key={`${l.eerr_block}-${l.mayor}`}
          line={l}
          rows={rows}
          totalVentas={totalVentas}
        />
      ))}
    </ul>
  );
}

function CostoGastoMayorRow({
  line,
  rows,
  totalVentas,
}: {
  line: MayorNetLine;
  rows: EerrV2SummaryRow[];
  totalVentas: number;
}) {
  const [cuentasOpen, setCuentasOpen] = useState(false);
  const block = line.eerr_block === "gastos" ? "gastos" : "costos";
  const cuentas = useMemo(
    () => aggregateCuentaNetByMayorBlock(rows, block, line.mayor),
    [rows, block, line.mayor],
  );
  return (
    <li className="border-b border-[var(--color-border-subtle)] border-opacity-60 pb-1.5 last:border-0 last:pb-0">
      <div className="flex items-baseline gap-1.5 min-w-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          isIconOnly
          className="shrink-0 h-7 w-7 min-w-7"
          aria-expanded={cuentasOpen}
          aria-label={
            cuentasOpen ? "Ocultar cuentas del mayor" : "Ver cuentas del mayor"
          }
          onPress={() => setCuentasOpen((v) => !v)}
        >
          <span className="text-sm font-semibold leading-none">
            {cuentasOpen ? "−" : "+"}
          </span>
        </Button>
        <span
          className="truncate min-w-0 flex-1 text-[var(--color-text-muted)]"
          title={line.mayor}
        >
          {line.mayor}
        </span>
        <EerrGlosarioInfo
          kind="mayor"
          label={line.mayor}
          eerrBlock={line.eerr_block}
        />
        <span className="flex flex-col items-end gap-0.5 shrink-0 text-right sm:flex-row sm:items-baseline sm:gap-2">
          <span className="font-mono tabular-nums">
            {formatGsFull(line.net)}
          </span>
          <span className="font-mono tabular-nums text-[11px] text-[var(--color-text-muted)] whitespace-nowrap">
            {formatPctDeVentas(line.net, totalVentas)} ventas
          </span>
        </span>
      </div>
      {cuentasOpen ? (
        <ul className="mt-2 ml-8 space-y-1 border-l border-[var(--color-border-subtle)] pl-2 max-h-40 overflow-y-auto">
          {cuentas.length ? (
            cuentas.map((c) => (
              <li
                key={`${line.mayor}||${c.cuenta}`}
                className="flex justify-between gap-2 text-[11px] items-baseline"
              >
                <span className="flex items-baseline gap-1 min-w-0 flex-1">
                  <span
                    className="truncate text-[var(--color-text-muted)] min-w-0"
                    title={c.cuenta}
                  >
                    {c.cuenta}
                  </span>
                  <EerrGlosarioInfo
                    kind="cuenta"
                    label={c.cuenta}
                    eerrBlock={block}
                    mayorHint={line.mayor}
                  />
                </span>
                <span className="flex flex-col items-end gap-0.5 shrink-0 sm:flex-row sm:items-baseline sm:gap-2">
                  <span className="font-mono tabular-nums">
                    {formatGsFull(c.net)}
                  </span>
                  <span className="font-mono tabular-nums text-[var(--color-text-muted)] whitespace-nowrap">
                    {formatPctDeVentas(c.net, totalVentas)}
                  </span>
                </span>
              </li>
            ))
          ) : (
            <li className="text-[11px] text-[var(--color-text-muted)]">
              Sin cuentas en el detalle.
            </li>
          )}
        </ul>
      ) : null}
    </li>
  );
}

function VentaMayorRow({
  rows,
  mayor,
  net,
}: {
  rows: EerrV2SummaryRow[];
  mayor: string;
  net: number;
}) {
  const [cuentasOpen, setCuentasOpen] = useState(false);
  const cuentas = useMemo(
    () => aggregateCuentaNetByMayorVentas(rows, mayor),
    [rows, mayor],
  );
  return (
    <li className="border-b border-[var(--color-border-subtle)] border-opacity-60 pb-1.5 last:border-0 last:pb-0">
      <div className="flex items-baseline gap-1.5 min-w-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          isIconOnly
          className="shrink-0 h-7 w-7 min-w-7"
          aria-expanded={cuentasOpen}
          aria-label={
            cuentasOpen ? "Ocultar cuentas del mayor" : "Ver cuentas del mayor"
          }
          onPress={() => setCuentasOpen((v) => !v)}
        >
          <span className="text-sm font-semibold leading-none">
            {cuentasOpen ? "−" : "+"}
          </span>
        </Button>
        <span
          className="truncate min-w-0 flex-1 text-[var(--color-text-muted)]"
          title={mayor}
        >
          {mayor}
        </span>
        <span className="font-mono tabular-nums shrink-0 text-right">
          {formatGsFull(net)}
        </span>
      </div>
      {cuentasOpen ? (
        <ul className="mt-2 ml-8 space-y-1 border-l border-[var(--color-border-subtle)] pl-2 max-h-36 overflow-y-auto">
          {cuentas.length ? (
            cuentas.map((c) => (
              <li
                key={`${mayor}||${c.cuenta}`}
                className="flex justify-between gap-2 text-[11px]"
              >
                <span
                  className="truncate text-[var(--color-text-muted)]"
                  title={c.cuenta}
                >
                  {c.cuenta}
                </span>
                <span className="font-mono tabular-nums shrink-0">
                  {formatGsFull(c.net)}
                </span>
              </li>
            ))
          ) : (
            <li className="text-[11px] text-[var(--color-text-muted)]">
              Sin cuentas en el detalle.
            </li>
          )}
        </ul>
      ) : null}
    </li>
  );
}

function mayorRowKey(empresa: string, mayor: string) {
  return `${empresa}\0${mayor}`;
}

function EerrDetalleArbolTable({ tree }: { tree: EerrDetalleEmpresaNode[] }) {
  const [empOpen, setEmpOpen] = useState<Set<string>>(() => new Set());
  const [mayorOpen, setMayorOpen] = useState<Set<string>>(() => new Set());

  const toggleEmp = useCallback((empresa: string) => {
    setEmpOpen((prev) => {
      const next = new Set(prev);
      if (next.has(empresa)) next.delete(empresa);
      else next.add(empresa);
      return next;
    });
  }, []);

  const toggleMayor = useCallback((key: string) => {
    setMayorOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  if (!tree.length) {
    return (
      <p className="text-xs text-[var(--color-text-muted)] leading-snug">
        Sin filas agregadas para los filtros actuales.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--color-border-subtle)] max-h-[min(70vh,520px)] overflow-y-auto">
      <table className="w-full text-sm rendimiento-detail-table eerr-detalle-tree-table">
        <thead className="sticky top-0 bg-[var(--table-head-bg,#1a1d24)] z-[1]">
          <tr>
            <th className="text-left p-2 w-[28%]">Empresa</th>
            <th className="text-left p-2 w-[28%]">Mayor</th>
            <th className="text-left p-2 min-w-[12rem]">Cuenta</th>
            <th className="text-right p-2 whitespace-nowrap">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {tree.map((e) => {
            const empExpanded = empOpen.has(e.empresa);
            const hasMayores = e.mayores.length > 0;
            return (
              <React.Fragment key={e.empresa}>
                <tr className="eerr-detalle-row-empresa">
                  <td className="p-2 align-middle">
                    <div className="flex items-center gap-1 min-w-0">
                      {hasMayores ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          isIconOnly
                          className="shrink-0 h-7 w-7 min-w-7"
                          aria-expanded={empExpanded}
                          aria-label={
                            empExpanded ? "Ocultar mayores" : "Ver mayores"
                          }
                          onPress={() => toggleEmp(e.empresa)}
                        >
                          <span className="text-sm font-semibold leading-none">
                            {empExpanded ? "−" : "+"}
                          </span>
                        </Button>
                      ) : (
                        <span
                          className="inline-block w-7 shrink-0"
                          aria-hidden
                        />
                      )}
                      <span className="truncate font-medium" title={e.empresa}>
                        {e.empresa}
                      </span>
                    </div>
                  </td>
                  <td className="p-2 text-[var(--color-text-muted)]">—</td>
                  <td className="p-2 text-[var(--color-text-muted)]">—</td>
                  <td className="p-2 text-right font-mono tabular-nums align-middle">
                    {formatGsFull(e.saldo)}
                  </td>
                </tr>
                {empExpanded
                  ? e.mayores.map((m) => {
                      const mk = mayorRowKey(e.empresa, m.mayor);
                      const mExp = mayorOpen.has(mk);
                      const hasCuentas = m.cuentas.length > 0;
                      return (
                        <React.Fragment key={mk}>
                          <tr className="eerr-detalle-row-mayor bg-[var(--color-surface-subtle,transparent)]">
                            <td className="p-2" />
                            <td className="p-2 align-middle">
                              <div className="flex items-center gap-1 min-w-0 pl-3 border-l border-[var(--color-border-subtle)]">
                                {hasCuentas ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    isIconOnly
                                    className="shrink-0 h-7 w-7 min-w-7"
                                    aria-expanded={mExp}
                                    aria-label={
                                      mExp ? "Ocultar cuentas" : "Ver cuentas"
                                    }
                                    onPress={() => toggleMayor(mk)}
                                  >
                                    <span className="text-sm font-semibold leading-none">
                                      {mExp ? "−" : "+"}
                                    </span>
                                  </Button>
                                ) : (
                                  <span
                                    className="inline-block w-7 shrink-0"
                                    aria-hidden
                                  />
                                )}
                                <span className="flex items-center gap-1 min-w-0">
                                  <span className="truncate" title={m.mayor}>
                                    {m.mayor}
                                  </span>
                                  <EerrGlosarioInfo
                                    kind="mayor"
                                    label={m.mayor}
                                    eerrBlock={null}
                                  />
                                </span>
                              </div>
                            </td>
                            <td className="p-2 text-[var(--color-text-muted)]">
                              —
                            </td>
                            <td className="p-2 text-right font-mono tabular-nums align-middle">
                              {formatGsFull(m.saldo)}
                            </td>
                          </tr>
                          {mExp
                            ? m.cuentas.map((c) => (
                                <tr
                                  key={`${mk}||${c.cuenta}`}
                                  className="eerr-detalle-row-cuenta"
                                >
                                  <td className="p-2" />
                                  <td className="p-2" />
                                  <td className="p-2 align-middle">
                                    <div className="pl-6 ml-3 border-l border-[var(--color-border-subtle)] flex items-center gap-1 min-w-0">
                                      <span
                                        className="text-xs truncate block min-w-0 flex-1"
                                        title={c.cuenta}
                                      >
                                        {c.cuenta}
                                      </span>
                                      <EerrGlosarioInfo
                                        kind="cuenta"
                                        label={c.cuenta}
                                        eerrBlock={null}
                                        mayorHint={m.mayor}
                                      />
                                    </div>
                                  </td>
                                  <td className="p-2 text-right font-mono tabular-nums text-xs align-middle">
                                    {formatGsFull(c.saldo)}
                                  </td>
                                </tr>
                              ))
                            : null}
                        </React.Fragment>
                      );
                    })
                  : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Solo ventas: cada mayor lleva + para desplegar cuentas (saldo débito − haber). */
function VentasMayorBreakdownList({ rows }: { rows: EerrV2SummaryRow[] }) {
  const lines = useMemo(() => aggregateMayorNetByBlock(rows, "ventas"), [rows]);
  if (!lines.length) {
    return (
      <p className="text-xs text-[var(--color-text-muted)] leading-snug">
        Sin líneas en el detalle para este bloque con los filtros actuales.
      </p>
    );
  }
  return (
    <ul className="space-y-1 text-xs max-h-64 overflow-y-auto pr-0.5">
      {lines.map((l) => (
        <VentaMayorRow
          key={`ventas-${l.mayor}`}
          rows={rows}
          mayor={l.mayor}
          net={l.net}
        />
      ))}
    </ul>
  );
}

function KpiMayorExpandCard({
  title,
  value,
  chip,
  expandSummary,
  pctDelTotalVentas,
}: {
  title: string;
  value: string;
  chip?: string;
  expandSummary: React.ReactNode;
  /** Texto bajo el monto (p. ej. "% del total de ventas operativas"). */
  pctDelTotalVentas?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="eerr-kpi-card-heroui" variant="secondary">
      <Card.Header className="eerr-kpi-card-head flex flex-row items-start justify-between gap-2">
        <Card.Title className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {title}
        </Card.Title>
        {chip ? (
          <Chip size="sm" variant="soft" color="accent">
            {chip}
          </Chip>
        ) : null}
      </Card.Header>
      <Card.Content className="pt-0">
        <div className="flex flex-row items-center gap-2 min-w-0">
          <div className="eerr-kpi-value flex-1 min-w-0">
            {value}
            {pctDelTotalVentas ? (
              <div className="text-sm font-semibold tabular-nums text-[var(--color-text-muted)] mt-1 leading-snug">
                {pctDelTotalVentas}
              </div>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            isIconOnly
            aria-expanded={open}
            aria-label={
              open ? "Ocultar mayorización" : "Ver desglose por mayor"
            }
            className="shrink-0"
            onPress={() => setOpen((v) => !v)}
          >
            <span className="text-base font-semibold leading-none w-4 text-center">
              {open ? "−" : "+"}
            </span>
          </Button>
        </div>
        {open ? (
          <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)]">
            {expandSummary}
          </div>
        ) : null}
      </Card.Content>
    </Card>
  );
}

function usePctDerived(kpis: EerrV2SummaryResponse["kpis"] | undefined) {
  return useMemo(() => {
    if (!kpis) return { pctMargen: 0, pctEbitda: 0 };
    const pctMargen =
      kpis.margen_pct != null && Number.isFinite(kpis.margen_pct)
        ? kpis.margen_pct
        : (() => {
            const ing = Number(kpis.ingresos_operativo) || 0;
            return ing ? (100 * Number(kpis.margen)) / ing : 0;
          })();
    const pctEbitda =
      kpis.ebitda_pct != null && Number.isFinite(kpis.ebitda_pct)
        ? kpis.ebitda_pct
        : (() => {
            const ing = Number(kpis.ingresos_operativo) || 0;
            return ing ? (100 * Number(kpis.ebitda)) / ing : 0;
          })();
    return { pctMargen, pctEbitda };
  }, [kpis]);
}

function monthlySeriesFromSummary(
  summary: EerrV2SummaryResponse | null,
): EerrMonthAgg[] {
  const cs = summary?.chart_series;
  if (cs?.length) {
    return cs.map((p) => ({
      label: p.gestion_month,
      ventasNet: p.ventas_net,
      costosNet: p.costos_net,
      gastosNet: p.gastos_net,
      margen: p.margen,
      ebitda: p.ebitda,
    }));
  }
  return aggregateEerrRowsByGestionMonth(summary?.rows || []);
}

type CompareColumnProps = {
  sideLabel: string;
  gestionDataBounds: { minY: number; maxY: number };
  gestionYears: number[];
  blocks: string[];
  socialOptions: string[];
  socialRows: Array<{ id: string; label: string }>;
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  onApply: () => void;
  onClear: () => void;
  applying: boolean;
  loading: boolean;
  error: string | null;
  summary: EerrV2SummaryResponse | null;
  eerrTab: EerrTab;
  trendMode: "margen" | "ebitda";
  setTrendMode: (m: "margen" | "ebitda") => void;
  isLight: boolean;
};

function EerrCompareColumn({
  sideLabel,
  gestionDataBounds,
  gestionYears,
  blocks,
  socialOptions,
  socialRows,
  filters,
  setFilters,
  onApply,
  onClear,
  applying,
  loading,
  error,
  summary,
  eerrTab,
  trendMode,
  setTrendMode,
  isLight,
}: CompareColumnProps) {
  const selectedSocialDisplay = useMemo(() => {
    const byId = new Map(socialRows.map((r) => [r.id, r]));
    return filters.socialReasonIds.map((id) => {
      const row = byId.get(id);
      return row ? `${row.id} — ${row.label || row.id}` : id;
    });
  }, [filters.socialReasonIds, socialRows]);

  const onSocialDisplayChange = useCallback(
    (values: string[]) => {
      const ids = values
        .map((v) => String(v).split(" — ")[0]?.trim() || "")
        .filter(Boolean);
      setFilters((prev) => ({ ...prev, socialReasonIds: ids }));
    },
    [setFilters],
  );

  const { pctMargen, pctEbitda } = usePctDerived(summary?.kpis);
  const kpis = summary?.kpis;
  const totalVentasOperativo = Number(kpis?.ingresos_operativo) || 0;
  const costosPctDelVentas =
    totalVentasOperativo > 0 && kpis
      ? `${formatPctDeVentas(Number(kpis.costos_operativo), totalVentasOperativo)} del total de ventas`
      : undefined;
  const gastosPctDelVentas =
    totalVentasOperativo > 0 && kpis
      ? `${formatPctDeVentas(Number(kpis.gastos_operativo), totalVentasOperativo)} del total de ventas`
      : undefined;
  const monthlySeries = useMemo(
    () => monthlySeriesFromSummary(summary),
    [summary],
  );

  const yearTriggerSummary = useMemo(() => {
    const sorted = [...filters.selectedYears].sort((a, b) => a - b);
    const isAll =
      gestionYears.length > 0 &&
      sorted.length === gestionYears.length &&
      gestionYears.every((y) => sorted.includes(y));
    return { sorted, isAll };
  }, [filters.selectedYears, gestionYears]);

  const costosMayor = useMemo(
    () => aggregateMayorNetByBlock(summary?.rows ?? [], "costos"),
    [summary?.rows],
  );
  const gastosMayor = useMemo(
    () => aggregateMayorNetByBlock(summary?.rows ?? [], "gastos"),
    [summary?.rows],
  );
  const detalleTree = useMemo(
    () => buildEerrDetalleTree(summary?.rows ?? []),
    [summary?.rows],
  );
  const eerrTruncated = Boolean(summary?.meta?.eerr_detail_truncated);

  return (
    <div className="eerr-compare-col">
      <p className="eerr-compare-col-title">{sideLabel}</p>

      <div className="eerr-compare-col-inner-filters flex flex-col gap-3 mb-3">
        <div className="eerr-gestion-range-wrap eerr-gestion-range-wrap--in-compare">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
            Mes de gestión (rango)
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] mb-3 leading-snug opacity-90">
            Elegí uno o más años de la lista y un rango de mes calendario; solo
            cuentan combinaciones presentes en datos ({gestionDataBounds.minY}–
            {gestionDataBounds.maxY} según extracto).
          </p>
          <div className="flex flex-col gap-5 w-full min-w-0">
            <Select
              className="eerr-year-multi-select w-full min-w-0"
              selectionMode="multiple"
              variant="secondary"
              fullWidth
              placeholder={
                gestionYears.length
                  ? "Seleccionar años"
                  : "Sin años en opciones"
              }
              isDisabled={gestionYears.length === 0}
              value={filters.selectedYears.map(String)}
              onChange={(keys) => {
                const raw = keys == null ? [] : [...keys];
                const nums = raw
                  .map((k) => parseInt(String(k), 10))
                  .filter(
                    (n) => Number.isFinite(n) && gestionYears.includes(n),
                  );
                const next =
                  nums.length > 0
                    ? [...new Set(nums)].sort((a, b) => a - b)
                    : [...gestionYears];
                setFilters((p) => ({ ...p, selectedYears: next }));
              }}
              aria-label="Años de gestión (multiselección)"
            >
              <Label className="text-sm font-medium">Año (uno o varios)</Label>
              <Select.Trigger>
                <Select.Value>
                  {({ isPlaceholder }) => {
                    if (isPlaceholder) return null;
                    const { sorted, isAll } = yearTriggerSummary;
                    if (sorted.length === 0) return null;
                    if (isAll) {
                      const lo = gestionYears[0];
                      const hi = gestionYears[gestionYears.length - 1];
                      return (
                        <span className="text-sm font-medium leading-snug">
                          {lo === hi ? String(lo) : `Todos (${lo}–${hi})`}
                        </span>
                      );
                    }
                    if (sorted.length <= 4) {
                      return sorted.map((y) => (
                        <Chip
                          key={y}
                          size="sm"
                          variant="soft"
                          color="accent"
                          className="text-xs font-medium"
                        >
                          {y}
                        </Chip>
                      ));
                    }
                    return (
                      <span className="text-sm leading-snug">
                        {sorted.slice(0, 3).join(", ")}
                        <span className="text-field-placeholder">
                          {" "}
                          · +{sorted.length - 3}
                        </span>
                      </span>
                    );
                  }}
                </Select.Value>
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover
                placement="bottom start"
                className="eerr-year-select-popover z-[200]"
              >
                <ListBox className="eerr-year-listbox">
                  {gestionYears.map((y) => (
                    <ListBox.Item key={y} id={String(y)} textValue={String(y)}>
                      <Label className="flex-1 text-sm font-normal tabular-nums">
                        {y}
                      </Label>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <Slider
              className="w-full min-w-0"
              minValue={1}
              maxValue={12}
              step={1}
              value={filters.monthRange}
              onChange={(v) => {
                const raw = Array.isArray(v) ? v : [v, v];
                const a = Math.round(Number(raw[0]));
                const b = Math.round(Number(raw[1]));
                const lo = Math.min(a, b);
                const hi = Math.max(a, b);
                setFilters((p) => ({
                  ...p,
                  monthRange: [lo, hi] as [number, number],
                }));
              }}
            >
              <Label className="text-sm font-medium text-[var(--color-text)]">
                Mes (desde – hasta)
              </Label>
              <Slider.Output className="text-sm text-[var(--color-text-muted)] mb-1">
                {({ state }) =>
                  `${monthShortEs(Math.min(state.values[0], state.values[1]))} – ${monthShortEs(Math.max(state.values[0], state.values[1]))}`
                }
              </Slider.Output>
              <Slider.Track>
                {({ state }) => (
                  <>
                    <Slider.Fill />
                    {state.values.map((_, i) => (
                      <Slider.Thumb key={i} index={i} />
                    ))}
                  </>
                )}
              </Slider.Track>
            </Slider>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full min-w-0">
          <MultiSelectFilter
            className="analysis-filter-control min-w-0"
            label="Bloque"
            options={blocks.map((b) => BLOCK_LABELS[b] || b)}
            selected={filters.blocks.map((b) => BLOCK_LABELS[b] || b)}
            onChange={(values) => {
              const rev = Object.fromEntries(
                Object.entries(BLOCK_LABELS).map(([k, v]) => [v, k]),
              );
              const keys = values.map((v) => rev[v] || v.toLowerCase());
              setFilters((p) => ({ ...p, blocks: keys }));
            }}
            placeholder="Todos los bloques"
          />
          <MultiSelectFilter
            className="analysis-filter-control min-w-0"
            label="Razón social"
            options={socialOptions}
            selected={selectedSocialDisplay}
            onChange={onSocialDisplayChange}
            placeholder="Todas"
          />
          <div className="flex items-center gap-2 mt-1">
            <Switch
              size="sm"
              isSelected={filters.excludeTapo}
              onChange={() =>
                setFilters((prev) => ({
                  ...prev,
                  excludeTapo: !prev.excludeTapo,
                }))
              }
            >
              <span className="text-xs text-[var(--color-text-muted)]">
                Sin TAPO
              </span>
            </Switch>
            <MetricExplainer
              title="Sin TAPO"
              intro="Al activar, se omiten del EERR los movimientos contables originados por contratos de tratamiento financiados (TAPO). La línea de Tratamientos Odontológicos sigue visible con sus ingresos/costos no-TAPO."
              items={[
                {
                  label: "Sin TAPO",
                  formula:
                    "Excluye asientos de tratamientos odontológicos financiados por TAPO (is_tapo = 0)",
                },
              ]}
            />
          </div>
        </div>
        <div className="analysis-actions-row analysis-actions flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            onPress={() => void onApply()}
            isDisabled={applying}
          >
            {applying ? "Aplicando…" : "Aplicar"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onPress={onClear}
            isDisabled={applying}
          >
            Limpiar
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mb-3">
          <ErrorState
            message={error}
            onRetry={onApply}
            retryLabel="Reintentar"
          />
        </div>
      ) : null}

      {loading ? <LoadingState message="Cargando…" /> : null}

      {!loading && summary && !error ? (
        <>
          {eerrTab === "resumen" && kpis ? (
            <div className="eerr-kpi-stack">
              <KpiHeroCard
                title="Ventas (operativo)"
                value={formatGsFull(kpis.ingresos_operativo)}
                chip="Ingresos"
              />
              <KpiHeroCard
                title="Costos (operativo)"
                value={formatGsFull(kpis.costos_operativo)}
                chip="Costos"
              />
              <KpiHeroCard
                title="Margen"
                value={formatGsFull(kpis.margen)}
                chip="M = I−C"
              />
              <KpiHeroCard
                title="% Margen"
                value={formatPercent(pctMargen)}
                chip="M / Ventas"
              />
              <KpiHeroCard
                title="Gastos (operativo)"
                value={formatGsFull(kpis.gastos_operativo)}
                chip="Gastos"
              />
              <KpiHeroCard
                title="EBITDA"
                value={formatGsFull(kpis.ebitda)}
                chip="M−G"
              />
              <KpiHeroCard
                title="% EBITDA"
                value={formatPercent(pctEbitda)}
                chip="EBITDA / Ventas"
              />
            </div>
          ) : null}

          {eerrTab === "resumen_mayor" && kpis ? (
            <div className="eerr-kpi-stack">
              {eerrTruncated ? (
                <p className="text-xs rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-2 text-[var(--color-text)] leading-snug">
                  El detalle mostrado está{" "}
                  <strong>capado a 50.000 filas</strong>
                  {summary?.meta?.eerr_rows_total != null
                    ? ` (${formatCount(summary.meta.eerr_rows_total)} filas en hechos con este filtro).`
                    : "."}{" "}
                  Los subtotales por mayor suman solo esas filas y pueden
                  diferir del total del KPI.
                </p>
              ) : null}
              <KpiMayorExpandCard
                title="Ventas (operativo)"
                value={formatGsFull(kpis.ingresos_operativo)}
                chip="Ingresos"
                expandSummary={
                  <>
                    <p className="text-[11px] text-[var(--color-text-muted)] mb-2 leading-snug">
                      Saldo por <strong>mayor</strong> (débito − haber). Cada
                      mayor tiene <strong>+</strong> para ver cuentas.
                    </p>
                    <VentasMayorBreakdownList rows={summary?.rows ?? []} />
                  </>
                }
              />
              <KpiMayorExpandCard
                title="Costos (operativo)"
                value={formatGsFull(kpis.costos_operativo)}
                chip="Costos"
                pctDelTotalVentas={costosPctDelVentas}
                expandSummary={
                  <>
                    <p className="text-[11px] text-[var(--color-text-muted)] mb-2 leading-snug">
                      Neto por mayor (débito − crédito). Cada ítem muestra{" "}
                      <strong>% del total de ventas</strong> (operativo);{" "}
                      <strong>+</strong> despliega subcuentas.
                    </p>
                    <CostoGastoMayorBreakdownList
                      lines={costosMayor}
                      rows={summary?.rows ?? []}
                      totalVentas={totalVentasOperativo}
                    />
                  </>
                }
              />
              <KpiMayorExpandCard
                title="Margen"
                value={formatGsFull(kpis.margen)}
                chip="M = I−C"
                expandSummary={
                  <>
                    <p className="text-[11px] text-[var(--color-text-muted)] mb-2 leading-snug">
                      Composición desde bloques operativos: ventas netas y
                      costos netos por mayor.
                    </p>
                    <p className="text-xs font-semibold mb-1">Ventas</p>
                    <VentasMayorBreakdownList rows={summary?.rows ?? []} />
                    <p className="text-xs font-semibold mt-3 mb-1">Costos</p>
                    <CostoGastoMayorBreakdownList
                      lines={costosMayor}
                      rows={summary?.rows ?? []}
                      totalVentas={totalVentasOperativo}
                    />
                  </>
                }
              />
              <KpiMayorExpandCard
                title="% Margen"
                value={formatPercent(pctMargen)}
                chip="M / Ventas"
                expandSummary={
                  <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                    Porcentaje derivado del{" "}
                    <strong className="text-[var(--color-text)]">margen</strong>{" "}
                    sobre{" "}
                    <strong className="text-[var(--color-text)]">
                      ventas operativas
                    </strong>
                    . El desglose contable por mayor está en las tarjetas Ventas
                    y Costos de esta misma vista.
                  </p>
                }
              />
              <KpiMayorExpandCard
                title="Gastos (operativo)"
                value={formatGsFull(kpis.gastos_operativo)}
                chip="Gastos"
                pctDelTotalVentas={gastosPctDelVentas}
                expandSummary={
                  <>
                    <p className="text-[11px] text-[var(--color-text-muted)] mb-2 leading-snug">
                      Neto por mayor (débito − crédito). % respecto a{" "}
                      <strong>ventas operativas</strong>; <strong>+</strong>{" "}
                      subcuentas.
                    </p>
                    <CostoGastoMayorBreakdownList
                      lines={gastosMayor}
                      rows={summary?.rows ?? []}
                      totalVentas={totalVentasOperativo}
                    />
                  </>
                }
              />
              <KpiMayorExpandCard
                title="EBITDA"
                value={formatGsFull(kpis.ebitda)}
                chip="M−G"
                expandSummary={
                  <>
                    <p className="text-[11px] text-[var(--color-text-muted)] mb-2 leading-snug">
                      El total coincide con el resumen; el desglose muestra{" "}
                      <strong>gastos</strong> por mayor (componente restado al
                      margen).
                    </p>
                    <CostoGastoMayorBreakdownList
                      lines={gastosMayor}
                      rows={summary?.rows ?? []}
                      totalVentas={totalVentasOperativo}
                    />
                  </>
                }
              />
              <KpiMayorExpandCard
                title="% EBITDA"
                value={formatPercent(pctEbitda)}
                chip="EBITDA / Ventas"
                expandSummary={
                  <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                    Porcentaje derivado del{" "}
                    <strong className="text-[var(--color-text)]">EBITDA</strong>{" "}
                    sobre ventas operativas. Para ver cómo se arma el resultado
                    por cuentas mayores usá Ventas, Costos y Gastos arriba.
                  </p>
                }
              />
            </div>
          ) : null}

          {eerrTab === "graficos" ? (
            <div className="eerr-charts-grid eerr-charts-grid--compare">
              <Card className="eerr-chart-card" variant="secondary">
                <Card.Header>
                  <Card.Title className="text-sm font-semibold">
                    Bloques por mes de gestión
                  </Card.Title>
                  <Card.Description className="text-xs text-[var(--color-text-muted)]">
                    Serie agregada en servidor para este criterio.
                  </Card.Description>
                </Card.Header>
                <Card.Content className="eerr-chart-card-body">
                  <EerrGroupedBlockChart
                    data={monthlySeries}
                    isLight={isLight}
                  />
                </Card.Content>
              </Card>
              <Card className="eerr-chart-card" variant="secondary">
                <Card.Header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Card.Title className="text-sm font-semibold">
                      Tendencia
                    </Card.Title>
                    <Card.Description className="text-xs text-[var(--color-text-muted)]">
                      Margen o EBITDA por mes.
                    </Card.Description>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant={trendMode === "margen" ? "primary" : "outline"}
                      onPress={() => setTrendMode("margen")}
                    >
                      Margen
                    </Button>
                    <Button
                      size="sm"
                      variant={trendMode === "ebitda" ? "primary" : "outline"}
                      onPress={() => setTrendMode("ebitda")}
                    >
                      EBITDA
                    </Button>
                  </div>
                </Card.Header>
                <Card.Content className="eerr-chart-card-body">
                  <EerrMargenEbitdaLineChart
                    data={monthlySeries}
                    mode={trendMode}
                    isLight={isLight}
                  />
                </Card.Content>
              </Card>
            </div>
          ) : null}

          {eerrTab === "detalle" ? (
            summary.rows?.length ? (
              <div className="space-y-2">
                {eerrTruncated ? (
                  <p className="text-xs rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-2 text-[var(--color-text)] leading-snug">
                    El detalle de la API está{" "}
                    <strong>capado a 50.000 filas</strong>
                    {summary?.meta?.eerr_rows_total != null
                      ? ` (${formatCount(summary.meta.eerr_rows_total)} filas en hechos con este filtro).`
                      : "."}{" "}
                    Esta vista resume solo esas filas; el saldo puede diferir de
                    los KPIs si faltan movimientos.
                  </p>
                ) : null}
                <p className="text-[11px] text-[var(--color-text-muted)] leading-snug">
                  Resumen por <strong>empresa</strong>, <strong>mayor</strong> y{" "}
                  <strong>cuenta</strong> (suma del rango y bloques filtrados).{" "}
                  <strong>Saldo</strong>: ventas débito−haber; costos y gastos
                  débito−crédito. Usá <strong>+</strong> para desplegar.
                </p>
                <EerrDetalleArbolTable tree={detalleTree} />
                <p className="text-xs text-[var(--color-text-muted)]">
                  Filas en detalle API: {formatCount(summary.rows?.length || 0)}
                  {detalleTree.length
                    ? ` · Empresas en vista: ${formatCount(detalleTree.length)}`
                    : null}
                </p>
              </div>
            ) : (
              <EmptyState message="No hay filas para los filtros elegidos." />
            )
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function EerrView() {
  const isLight = useIsLightTheme();
  const [eerrTab, setEerrTab] = useState<EerrTab>("resumen");
  const [trendMode, setTrendMode] = useState<"margen" | "ebitda">("margen");
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [months, setMonths] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<string[]>([]);
  const [socialRows, setSocialRows] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [bootstrapped, setBootstrapped] = useState(false);

  const [filtersL, setFiltersL] = useState<Filters>(() =>
    defaultFiltersForMonths([]),
  );
  const [filtersR, setFiltersR] = useState<Filters>(() =>
    defaultFiltersForMonths([]),
  );
  const [appliedL, setAppliedL] = useState<Filters>(() =>
    defaultFiltersForMonths([]),
  );
  const [appliedR, setAppliedR] = useState<Filters>(() =>
    defaultFiltersForMonths([]),
  );
  const [summaryL, setSummaryL] = useState<EerrV2SummaryResponse | null>(null);
  const [summaryR, setSummaryR] = useState<EerrV2SummaryResponse | null>(null);
  const [loadingL, setLoadingL] = useState(false);
  const [loadingR, setLoadingR] = useState(false);
  const [applyingL, setApplyingL] = useState(false);
  const [applyingR, setApplyingR] = useState(false);
  const [errorL, setErrorL] = useState<string | null>(null);
  const [errorR, setErrorR] = useState<string | null>(null);

  const socialOptions = useMemo(
    () => socialRows.map((r) => `${r.id} — ${r.label || r.id}`),
    [socialRows],
  );

  const loadSummaryOne = useCallback(
    async (side: CompareSide, f: Filters) => {
      const setLoading = side === "L" ? setLoadingL : setLoadingR;
      const setSummary = side === "L" ? setSummaryL : setSummaryR;
      const setApplied = side === "L" ? setAppliedL : setAppliedR;
      const setErr = side === "L" ? setErrorL : setErrorR;

      setLoading(true);
      setErr(null);
      try {
        const gm = gestionMonthsForApi(f.selectedYears, f.monthRange, months);
        const data = await getEerrV2Summary({
          gestion_month: gm,
          eerr_block: f.blocks.length ? f.blocks : undefined,
          social_reason_id: f.socialReasonIds.length
            ? f.socialReasonIds
            : undefined,
          exclude_tapo: f.excludeTapo || undefined,
        });
        setSummary(data);
        setApplied(f);
      } catch (e: unknown) {
        setErr(getApiErrorMessage(e));
        setSummary(null);
      } finally {
        setLoading(false);
      }
    },
    [months],
  );

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    setOptionsError(null);
    try {
      const data = await getEerrV2Options();
      const opt = data.options || {};
      setMonths(sortMesGestionDesc(opt.gestion_month || []));
      setBlocks(opt.eerr_block || ["ventas", "costos", "gastos"]);
      setSocialRows(opt.social_reason || []);
    } catch (e: unknown) {
      setOptionsError(getApiErrorMessage(e));
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    if (loadingOptions || bootstrapped) return;
    setBootstrapped(true);
    const initial = defaultFiltersForMonths(months);
    setFiltersL(initial);
    setFiltersR(initial);
    void Promise.all([
      loadSummaryOne("L", initial),
      loadSummaryOne("R", initial),
    ]);
  }, [loadingOptions, bootstrapped, loadSummaryOne]);

  useEffect(() => {
    const busy =
      applyingL || applyingR || loadingL || loadingR || loadingOptions;
    if (!summaryL || !summaryR || busy) return;
    void markPerfReady("eerr");
  }, [
    applyingL,
    applyingR,
    loadingL,
    loadingR,
    loadingOptions,
    summaryL,
    summaryR,
  ]);

  const gestionDataBounds = useMemo(
    () => boundsFromMonthOptions(months),
    [months],
  );
  const gestionYears = useMemo(
    () => distinctYearsFromMonthOptions(months),
    [months],
  );

  const onApplyL = useCallback(async () => {
    setApplyingL(true);
    await loadSummaryOne("L", filtersL);
    setApplyingL(false);
  }, [filtersL, loadSummaryOne]);

  const onApplyR = useCallback(async () => {
    setApplyingR(true);
    await loadSummaryOne("R", filtersR);
    setApplyingR(false);
  }, [filtersR, loadSummaryOne]);

  const clearL = useCallback(() => {
    setFiltersL(defaultFiltersForMonths(months));
  }, [months]);

  const clearR = useCallback(() => {
    setFiltersR(defaultFiltersForMonths(months));
  }, [months]);

  const onRefreshBoth = useCallback(async () => {
    await Promise.all([
      loadSummaryOne("L", appliedL),
      loadSummaryOne("R", appliedR),
    ]);
  }, [appliedL, appliedR, loadSummaryOne]);

  const headerMeta = summaryL?.meta || summaryR?.meta;

  return (
    <section className="card analysis-card analysis-panel-card rendimiento-panel">
      <AnalyticsPageHeader
        kicker="EERR"
        pill="Analytics v2"
        title="Estado de Resultado"
        subtitle="Comparativo en dos columnas: filtros y KPIs independientes (izquierda vs derecha)."
        meta={
          <div className="analysis-meta-row--with-info">
            <div className="analysis-meta-chips-cluster">
              <AnalyticsMetaBadges meta={headerMeta} embed />
            </div>
            <MetricExplainer
              className="metric-explainer--meta-trailing"
              title="Estado de resultado (EERR)"
              intro="Resumen alineado a AGENTS.md regla 10: margen = ingresos − costos; EBITDA = margen − gastos."
              items={[
                {
                  label: "Margen",
                  formula: "ingresos − costos",
                  note: "Heurística operativa: saldo (débito−haber) en ventas menos (débito−crédito) en costos.",
                },
                {
                  label: "EBITDA",
                  formula: "margen − gastos",
                  note: "Gastos como (débito−crédito) del bloque gastos.",
                },
                {
                  label: "% Margen · % EBITDA",
                  formula: "margen ÷ ingresos · EBITDA ÷ ingresos",
                  note: "Ingresos = bloque ventas (operativo). Si ingresos = 0, el porcentaje se muestra como 0 %.",
                },
                {
                  label: "Filtro año · mes",
                  formula:
                    "mm/yyyy incluido si el año está entre los elegidos (multiselect) y el mes ∈ rango",
                  note: "Cada columna tiene su propia selección de años/meses y sus KPIs al pulsar Aplicar.",
                },
                {
                  label: "Resumen mayor",
                  formula: "mismos KPIs que Resumen + desglose por mayor (+)",
                  note: "Los montos por mayor usan el detalle `rows` de la API (crédito/débito por bloque). Si el detalle viene truncado, el aviso amarillo explica la diferencia con el total agregado.",
                },
              ]}
            />
          </div>
        }
      />

      {summaryL?.meta?.data_freshness_at ||
      summaryR?.meta?.data_freshness_at ? (
        <p className="analysis-subtitle text-sm opacity-80 px-1 mb-2">
          {summaryL?.meta?.data_freshness_at ? (
            <>
              Izq. actualizado:{" "}
              {formatAnalyticsTimestampForDisplay(
                summaryL.meta.data_freshness_at,
              )}
            </>
          ) : null}
          {summaryL?.meta?.data_freshness_at &&
          summaryR?.meta?.data_freshness_at
            ? " · "
            : null}
          {summaryR?.meta?.data_freshness_at ? (
            <>
              Der. actualizado:{" "}
              {formatAnalyticsTimestampForDisplay(
                summaryR.meta.data_freshness_at,
              )}
            </>
          ) : null}
        </p>
      ) : null}

      <div className="eerr-dash-toolbar">
        <Tabs
          selectedKey={eerrTab}
          onSelectionChange={(key) =>
            key != null && setEerrTab(String(key) as EerrTab)
          }
          className="eerr-tabs"
          aria-label="Vistas EERR"
        >
          <Tabs.ListContainer>
            <Tabs.List>
              <Tabs.Tab id="resumen">Resumen</Tabs.Tab>
              <Tabs.Tab id="resumen_mayor">Resumen mayor</Tabs.Tab>
              <Tabs.Tab id="graficos">Gráficos</Tabs.Tab>
              <Tabs.Tab id="detalle">Detalle</Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        <div className="eerr-dash-toolbar-actions">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onPress={() => void onRefreshBoth()}
            isDisabled={loadingL || loadingR || applyingL || applyingR}
          >
            {loadingL || loadingR ? "Actualizando…" : "Actualizar ambas"}
          </Button>
        </div>
      </div>

      {loadingOptions ? (
        <AnalysisFiltersSkeleton filterCount={3} kpiCount={7} showTable />
      ) : optionsError ? (
        <ErrorState
          message={optionsError}
          onRetry={() => {
            void loadOptions();
          }}
          retryLabel="Reintentar"
        />
      ) : (
        <div className="eerr-compare-columns mb-2">
          <EerrCompareColumn
            sideLabel="Comparativo A (izquierda)"
            gestionDataBounds={gestionDataBounds}
            gestionYears={gestionYears}
            blocks={blocks}
            socialOptions={socialOptions}
            socialRows={socialRows}
            filters={filtersL}
            setFilters={setFiltersL}
            onApply={onApplyL}
            onClear={clearL}
            applying={applyingL}
            loading={loadingL}
            error={errorL}
            summary={summaryL}
            eerrTab={eerrTab}
            trendMode={trendMode}
            setTrendMode={setTrendMode}
            isLight={isLight}
          />
          <EerrCompareColumn
            sideLabel="Comparativo B (derecha)"
            gestionDataBounds={gestionDataBounds}
            gestionYears={gestionYears}
            blocks={blocks}
            socialOptions={socialOptions}
            socialRows={socialRows}
            filters={filtersR}
            setFilters={setFiltersR}
            onApply={onApplyR}
            onClear={clearR}
            applying={applyingR}
            loading={loadingR}
            error={errorR}
            summary={summaryR}
            eerrTab={eerrTab}
            trendMode={trendMode}
            setTrendMode={setTrendMode}
            isLight={isLight}
          />
        </div>
      )}
    </section>
  );
}
