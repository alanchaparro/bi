"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, Popover } from "@heroui/react";
import { useAuth } from "@/app/providers";
import type { LoginResponse } from "@/shared/contracts";
import { CONFIG_SECTION_NAV_IDS, hasConfigNavPermission } from "@/config/roleNav";
import { NAV_ITEMS, type NavItem } from "@/config/routes";
import { LoadingState } from "@/components/feedback/LoadingState";
import {
  applyThemePreset,
  cycleDarkThemePresetId,
  getStoredThemePresetId,
  getThemePresetById,
} from "@/shared/themePresets";

type SyncLive = {
  running?: boolean;
  currentDomain?: string | null;
  progressPct?: number;
  message?: string;
  currentQueryFile?: string | null;
  etaSeconds?: number | null;
  jobStep?: string | null;
  queuePosition?: number | null;
  chunkKey?: string | null;
  chunkStatus?: string | null;
  skippedUnchangedChunks?: number;
  error?: string | null;
  lastUpdatedAt?: string | null;
};

type ScheduleLive = {
  runningCount: number;
  domains: string[];
  progressPct?: number | null;
  lastUpdatedAt?: string | null;
};

type SyncLiveContextValue = {
  syncLive: SyncLive | null;
  scheduleLive: ScheduleLive | null;
  setSyncLive: (v: SyncLive | null) => void;
  setScheduleLive: (v: ScheduleLive | null) => void;
};

const SyncLiveContext = React.createContext<SyncLiveContextValue | null>(null);

export function useSyncLive() {
  const ctx = React.useContext(SyncLiveContext);
  return ctx ?? { syncLive: null, scheduleLive: null, setSyncLive: () => {}, setScheduleLive: () => {} };
}

function groupNavItems(items: readonly NavItem[]) {
  const map = new Map<string, NavItem[]>();
  for (const item of items) {
    const g = item.group ?? "";
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(item);
  }
  return map;
}

function formatRoleLabel(role: string | null | undefined): string {
  const r = (role ?? "").trim();
  if (!r) return "Usuario";
  const key = r.toLowerCase().replace(/\s+/g, "_");
  const map: Record<string, string> = {
    admin: "Administrador",
    administrator: "Administrador",
    supervisor: "Supervisor",
    analyst: "Analista",
    viewer: "Consulta",
    read_only: "Solo lectura",
  };
  if (map[key]) return map[key];
  return r
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function roleInitials(role: string | null | undefined): string {
  const label = formatRoleLabel(role);
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return "U";
}

function configNavAllowed(allowed: Set<string>): boolean {
  if (allowed.has("config")) return true;
  return CONFIG_SECTION_NAV_IDS.some((id) => allowed.has(id));
}

/** Permisos `nav:<id>` vienen del backend; si no hay ninguno (tokens viejos), se muestra todo el menú. */
function filterNavByPermissions(permissions: string[] | undefined): NavItem[] {
  const list = permissions ?? [];
  const navPerms = list.filter((p) => p.startsWith("nav:"));
  if (navPerms.length === 0) return [...NAV_ITEMS];
  const allowed = new Set(navPerms.map((p) => p.slice(4)));

  const out: NavItem[] = [];
  for (const item of NAV_ITEMS as readonly NavItem[]) {
    const selfOk = item.id === "config" ? configNavAllowed(allowed) : allowed.has(item.id);
    const rawChildren = item.children;
    if (rawChildren?.length) {
      const kids = rawChildren.filter((c) => allowed.has(c.id));
      if (!selfOk && kids.length === 0) continue;
      out.push({
        ...item,
        children: kids.length ? kids : undefined,
      });
      continue;
    }
    if (selfOk) out.push(item);
  }
  return out;
}

/** Activo en sidebar: path coincide; si `href` trae query (p. ej. `/config?tab=usuarios`), exige mismos params. */
function navHrefMatchesLocation(pathname: string, searchRaw: string, href: string): boolean {
  const [pathPart, queryPart] = href.split("?");
  const base = pathPart || href;
  if (pathname !== base && !pathname.startsWith(`${base}/`)) return false;
  if (!queryPart) return true;
  const want = new URLSearchParams(queryPart);
  const got = new URLSearchParams(searchRaw);
  for (const [k, v] of want.entries()) {
    if (got.get(k) !== v) return false;
  }
  return true;
}

function computeSubmenuDefaultOpen(pathname: string, searchRaw: string, items: readonly NavItem[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const item of items) {
    const kids = item.children;
    if (!kids?.length) continue;
    const parentMatch = navHrefMatchesLocation(pathname, searchRaw, item.href);
    const childMatch = kids.some((c) => navHrefMatchesLocation(pathname, searchRaw, c.href));
    out[item.id] = parentMatch || childMatch;
  }
  return out;
}

/** Glifos Material Symbols por id de nav (color hereda del tema vía currentColor). */
const SIDEBAR_MATERIAL_ICON: Record<string, string> = {
  cartera: "dashboard",
  analisisCartera: "monitoring",
  roloCartera: "swap_horiz",
  analisisCarteraAnuales: "calendar_month",
  analisisCarteraRendimiento: "trending_up",
  analisisCobranzaCohorte: "account_balance_wallet",
  eerr: "assessment",
  config: "settings",
};

function SidebarMaterialIcon({ id, active, size = "md" }: { id: string; active?: boolean; size?: "md" | "sm" }) {
  const glyph = SIDEBAR_MATERIAL_ICON[id] ?? "dashboard";
  return (
    <span
      className={`material-symbols-outlined dashboard-sidebar-ms-icon ${size === "sm" ? "dashboard-sidebar-ms-icon--sm" : ""} ${active ? "dashboard-sidebar-ms-icon--active" : ""}`}
      aria-hidden
    >
      {glyph}
    </span>
  );
}

/** Oscuro: paleta (ciclo de variantes); claro: luna (volver a oscuro). */
function SidebarThemeToggleIcon({ isDark }: { isDark: boolean }) {
  return (
    <span className="material-symbols-outlined dashboard-sidebar-action-ms" aria-hidden>
      {isDark ? "palette" : "dark_mode"}
    </span>
  );
}

function SidebarLogoutMaterialIcon() {
  return (
    <span className="material-symbols-outlined dashboard-sidebar-action-ms" aria-hidden>
      logout
    </span>
  );
}

function SidebarAccountMaterialIcon() {
  return (
    <span
      className="material-symbols-outlined dashboard-sidebar-action-ms dashboard-sidebar-action-ms--filled"
      aria-hidden
    >
      account_circle
    </span>
  );
}

const ICON_SIZE = 20;
function HamburgerIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

/** Chevron lateral: sin expandir apunta a la derecha; expandido rota 90° (abajo). */
function SubmenuChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`dashboard-sidebar-submenu-chevron ${expanded ? "dashboard-sidebar-submenu-chevron--open" : ""}`}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SidebarBrandMark() {
  return (
    <div className="dashboard-sidebar-brand-mark" aria-hidden>
      <span className="material-symbols-outlined dashboard-sidebar-brand-ms-icon">insights</span>
    </div>
  );
}

type SidebarToolbarProps = {
  auth: { role?: string | null };
  themePresetId: string;
  onToggleTheme: () => void;
  onLogout: () => void;
  className?: string;
};

function SidebarUserToolbar({ auth, themePresetId, onToggleTheme, onLogout, className = "" }: SidebarToolbarProps) {
  const isDark = getThemePresetById(themePresetId).mode === "dark";
  return (
    <div className={`dashboard-sidebar-toolbar flex flex-wrap items-center justify-end gap-1.5 ${className}`.trim()}>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        isIconOnly
        aria-label={
          isDark
            ? `Siguiente tema oscuro (${getThemePresetById(themePresetId).label})`
            : "Activar tema oscuro Obsidiana"
        }
        onPress={onToggleTheme}
        className="min-h-9 min-w-9 shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      >
        <SidebarThemeToggleIcon isDark={isDark} />
      </Button>
      <Popover.Root>
        <Popover.Trigger>
          <Button
            type="button"
            size="sm"
            variant="outline"
            isIconOnly
            aria-label="Menú de usuario: rol y cerrar sesión"
            aria-haspopup="dialog"
            className="min-h-9 min-w-9 shrink-0 border-[var(--sidebar-border)] text-[var(--color-primary)]"
          >
            <SidebarAccountMaterialIcon />
          </Button>
        </Popover.Trigger>
        <Popover.Content placement="bottom end" offset={6} className="dashboard-user-popover-content">
          <Popover.Dialog className="dashboard-user-popover-dialog">
            <p className="dashboard-user-popover-role text-xs text-[var(--color-text-muted)]">
              Rol: <strong className="text-[var(--color-text)]">{auth.role ?? "—"}</strong>
            </p>
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="mt-2 w-full min-h-9 gap-1.5"
              onPress={onLogout}
            >
              <span className="material-symbols-outlined dashboard-sidebar-action-ms text-[1.125rem] text-inherit" aria-hidden>
                logout
              </span>
              Cerrar sesión
            </Button>
          </Popover.Dialog>
        </Popover.Content>
      </Popover.Root>
    </div>
  );
}

type SidebarUserCardProps = {
  auth: LoginResponse;
  themePresetId: string;
  onToggleTheme: () => void;
  onLogout: () => void;
};

function SidebarUserCard({ auth, themePresetId, onToggleTheme, onLogout }: SidebarUserCardProps) {
  const isDark = getThemePresetById(themePresetId).mode === "dark";
  const rawRole = auth.role?.trim() ?? "";
  const displayName = formatRoleLabel(auth.role);
  const initials = roleInitials(auth.role);
  return (
    <div className="dashboard-sidebar-user-card" data-testid="sidebar-user-card">
      <div className="dashboard-sidebar-user-avatar-wrap">
        <div className="dashboard-sidebar-user-avatar" aria-hidden>
          {initials}
        </div>
        <span className="dashboard-sidebar-user-status" title="Sesión activa" aria-hidden />
      </div>
      <div className="dashboard-sidebar-user-meta">
        <div className="dashboard-sidebar-user-name" title={displayName}>
          {displayName}
        </div>
        <div className="dashboard-sidebar-user-role" title={rawRole || undefined}>
          {rawRole || "Sin rol asignado"}
        </div>
      </div>
      <div className="dashboard-sidebar-user-actions">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          isIconOnly
          aria-label={
            isDark
              ? `Siguiente tema oscuro (${getThemePresetById(themePresetId).label})`
              : "Activar tema oscuro Obsidiana"
          }
          onPress={onToggleTheme}
          className="min-h-9 min-w-9 shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <SidebarThemeToggleIcon isDark={isDark} />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          isIconOnly
          aria-label="Cerrar sesión"
          data-testid="sidebar-logout"
          onPress={onLogout}
          className="min-h-9 min-w-9 shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-error)]"
        >
          <SidebarLogoutMaterialIcon />
        </Button>
      </div>
    </div>
  );
}

type LivePillsProps = {
  showSchedule: boolean;
  showSync: boolean;
  schedulePct: number;
  syncPct: number;
  syncTone: string;
  syncLive: SyncLive | null;
  headerLiveLabel: string;
  canOpenConfigNav: boolean;
};

function SidebarLivePills({
  showSchedule,
  showSync,
  schedulePct,
  syncPct,
  syncTone,
  syncLive,
  headerLiveLabel,
  canOpenConfigNav,
}: LivePillsProps) {
  if (!showSchedule && !showSync) return null;
  return (
    <div className="dashboard-sidebar-live-pills" role="group" aria-label="Estado de sincronización">
      {showSchedule &&
        (canOpenConfigNav ? (
          <Link
            href="/config"
            className="header-pill header-pill--warn max-w-full justify-center text-[0.65rem] leading-tight"
            title={`Actualizacion en progreso ${schedulePct > 0 ? `(${schedulePct}%)` : ""}`}
          >
            <span>Prog.</span>
            <span>{schedulePct}%</span>
          </Link>
        ) : (
          <span
            className="header-pill header-pill--warn max-w-full cursor-default justify-center text-[0.65rem] leading-tight"
            title={`Programación en curso (${schedulePct}%). Sin acceso a Configuración en el menú.`}
          >
            <span>Prog.</span>
            <span>{schedulePct}%</span>
          </span>
        ))}
      {showSync &&
        (canOpenConfigNav ? (
          <Link
            href="/config"
            className={`header-pill max-w-full justify-center text-[0.65rem] leading-tight ${
              syncTone === "error"
                ? "header-pill--error"
                : syncTone === "ok"
                  ? "header-pill--ok"
                  : syncTone === "warn"
                    ? "header-pill--warn"
                    : "header-pill--info"
            }`}
            title={`${syncLive?.message ?? "Sincronizando..."} | ${syncPct}% | ${headerLiveLabel}`}
          >
            <span>{syncPct}%</span>
            <span className="max-w-[4.5rem] truncate">{String(syncLive?.currentDomain ?? "-")}</span>
            <span className="opacity-90">{headerLiveLabel}</span>
          </Link>
        ) : (
          <span
            className={`header-pill max-w-full cursor-default justify-center text-[0.65rem] leading-tight ${
              syncTone === "error"
                ? "header-pill--error"
                : syncTone === "ok"
                  ? "header-pill--ok"
                  : syncTone === "warn"
                    ? "header-pill--warn"
                    : "header-pill--info"
            }`}
            title={`${syncLive?.message ?? "Sincronizando..."} | ${syncPct}% | Sin acceso a Configuración en el menú.`}
          >
            <span>{syncPct}%</span>
            <span className="max-w-[4.5rem] truncate">{String(syncLive?.currentDomain ?? "-")}</span>
            <span className="opacity-90">{headerLiveLabel}</span>
          </span>
        ))}
    </div>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { auth, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navSearchRaw = searchParams.toString();
  const [themePresetId, setThemePresetId] = useState<string>("epem_obsidiana");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarCloseTimerRef = React.useRef<number | null>(null);
  const [syncLive, setSyncLive] = useState<SyncLive | null>(null);
  const [scheduleLive, setScheduleLive] = useState<ScheduleLive | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!auth) {
      router.replace("/login");
      return;
    }
  }, [auth, loading, router]);

  useEffect(() => {
    try {
      setThemePresetId(getStoredThemePresetId());
    } catch {
      setThemePresetId("epem_obsidiana");
    }
  }, []);

  useEffect(() => {
    applyThemePreset(themePresetId);
  }, [themePresetId]);

  const clearScheduledSidebarClose = useCallback(() => {
    if (sidebarCloseTimerRef.current != null) {
      window.clearTimeout(sidebarCloseTimerRef.current);
      sidebarCloseTimerRef.current = null;
    }
  }, []);

  const scheduleSidebarCloseDesktop = useCallback(() => {
    clearScheduledSidebarClose();
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    sidebarCloseTimerRef.current = window.setTimeout(() => {
      setSidebarOpen(false);
      sidebarCloseTimerRef.current = null;
    }, 280);
  }, [clearScheduledSidebarClose]);

  const openSidebarFromEdge = useCallback(() => {
    clearScheduledSidebarClose();
    if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches) return;
    setSidebarOpen(true);
  }, [clearScheduledSidebarClose]);

  useEffect(() => {
    return () => {
      if (sidebarCloseTimerRef.current != null) {
        window.clearTimeout(sidebarCloseTimerRef.current);
      }
    };
  }, []);

  /** Al pasar a móvil, cerrar drawer; en escritorio no forzar apertura (hover en el borde). */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (!mq.matches) {
        clearScheduledSidebarClose();
        setSidebarOpen(false);
      }
    };
    onChange();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, [clearScheduledSidebarClose]);

  const toggleTheme = useCallback(() => {
    setThemePresetId((current) => cycleDarkThemePresetId(current));
  }, []);

  const syncContextValue = useMemo<SyncLiveContextValue>(
    () => ({
      syncLive,
      scheduleLive,
      setSyncLive,
      setScheduleLive,
    }),
    [scheduleLive, syncLive]
  );

  // Debe ir antes de cualquier return condicional (reglas de hooks).
  const visibleNavItems = useMemo(
    () => filterNavByPermissions(auth?.permissions),
    [auth?.permissions]
  );
  const groups = useMemo(() => groupNavItems(visibleNavItems), [visibleNavItems]);
  const canOpenConfigNav = useMemo(
    () => hasConfigNavPermission(auth?.permissions),
    [auth?.permissions],
  );

  const submenuDefaultOpen = useMemo(
    () => computeSubmenuDefaultOpen(pathname, navSearchRaw, visibleNavItems),
    [pathname, navSearchRaw, visibleNavItems]
  );
  const [submenuOverrides, setSubmenuOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSubmenuOverrides({});
  }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) setSubmenuOverrides({});
  }, [sidebarOpen]);

  const isSubmenuExpanded = useCallback(
    (id: string) => (id in submenuOverrides ? submenuOverrides[id] : (submenuDefaultOpen[id] ?? false)),
    [submenuDefaultOpen, submenuOverrides]
  );

  const toggleSubmenu = useCallback(
    (id: string) => {
      setSubmenuOverrides((prev) => {
        const def = submenuDefaultOpen[id] ?? false;
        const cur = id in prev ? prev[id] : def;
        return { ...prev, [id]: !cur };
      });
    },
    [submenuDefaultOpen]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-color)]">
        <LoadingState message="Cargando navegación..." className="w-full max-w-md" />
      </div>
    );
  }

  if (!auth) {
    return null;
  }
  const showSync = Boolean(syncLive?.running);
  const showSchedule = Boolean((scheduleLive?.runningCount ?? 0) > 0);
  const syncPct = Math.max(0, Math.min(100, Math.round(syncLive?.progressPct ?? 0)));
  const schedulePct = Math.max(0, Math.min(100, Math.round(scheduleLive?.progressPct ?? 0)));
  const syncTone =
    syncLive?.error
      ? "error"
      : syncLive?.chunkStatus === "changed"
        ? "ok"
        : syncLive?.chunkStatus === "unchanged"
          ? "warn"
          : "info";
  const headerLiveFresh = showSync || (scheduleLive?.runningCount ?? 0) > 0
    ? true
    : syncLive?.lastUpdatedAt
      ? Date.now() - new Date(syncLive.lastUpdatedAt).getTime() <= 90000
      : false;
  const headerLiveLabel = headerLiveFresh ? "En vivo" : "Desfasado";

  return (
    <SyncLiveContext.Provider value={syncContextValue}>
      <div
        className={`dashboard-sidebar-overlay fixed inset-0 z-[100] bg-black/50 lg:hidden transition-opacity duration-[calc(200ms*var(--motion-scale))] ${
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        role="presentation"
        aria-hidden
        onClick={() => setSidebarOpen(false)}
      />
      {/* Escritorio (lg+): franja invisible en el borde izquierdo abre el menú al pasar el mouse. */}
      <div
        data-testid="sidebar-hover-zone"
        role="button"
        tabIndex={sidebarOpen ? -1 : 0}
        aria-label="Abrir menú lateral"
        aria-expanded={sidebarOpen}
        onKeyDown={(e) => {
          if (sidebarOpen) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openSidebarFromEdge();
          }
        }}
        className={`fixed top-0 left-0 z-[155] hidden h-[100dvh] select-none lg:block ${
          sidebarOpen
            ? "pointer-events-none w-0 min-w-0 overflow-hidden opacity-0"
            : "w-4 min-w-[16px] cursor-e-resize focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-color)]"
        }`}
        onMouseEnter={openSidebarFromEdge}
      />
      <aside
        className={`dashboard-sidebar fixed inset-y-0 left-0 z-[150] flex h-[100dvh] min-h-[100dvh] w-[85vw] max-w-72 flex-col transition-transform duration-[calc(300ms*var(--motion-scale))] ease-out lg:w-[var(--sidebar-width)] ${
          sidebarOpen ? "translate-x-0 pointer-events-auto lg:translate-x-0" : "-translate-x-full pointer-events-none lg:-translate-x-full"
        }`}
        onMouseEnter={clearScheduledSidebarClose}
        onMouseLeave={scheduleSidebarCloseDesktop}
      >
        <div className="dashboard-sidebar-brand">
          <div className="dashboard-sidebar-brand-head">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <SidebarBrandMark />
              <div className="dashboard-sidebar-brand-text">
                <h1 className="dashboard-sidebar-brand-h1">Sistema BI - EPEM</h1>
                <div className="dashboard-sidebar-brand-premium">Motor analítico</div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 lg:hidden">
              <SidebarUserToolbar
                auth={auth}
                themePresetId={themePresetId}
                onToggleTheme={toggleTheme}
                onLogout={logout}
              />
              <Button
                isIconOnly
                variant="ghost"
                size="sm"
                aria-label="Cerrar menú"
                onPress={() => setSidebarOpen(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                <CloseIcon />
              </Button>
            </div>
          </div>
          <div className="dashboard-sidebar-brand-note">Indicadores y cortes alineados a gestión.</div>
          <SidebarLivePills
            showSchedule={showSchedule}
            showSync={showSync}
            schedulePct={schedulePct}
            syncPct={syncPct}
            syncTone={syncTone}
            syncLive={syncLive}
            headerLiveLabel={headerLiveLabel}
            canOpenConfigNav={canOpenConfigNav}
          />
        </div>
        <nav className="dashboard-sidebar-nav flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-2" aria-label="Menú principal">
          {Array.from(groups.entries()).map(([groupName, items]) => (
            <div key={groupName || "default"} className="dashboard-sidebar-group">
              {groupName ? <div className="dashboard-sidebar-group-label">{groupName}</div> : null}
              <div className="dashboard-sidebar-links">
                {items.map((item) => {
                  const isActive = navHrefMatchesLocation(pathname, navSearchRaw, item.href);
                  const showChildren = Boolean(item.children?.length);
                  const submenuOpen = showChildren ? isSubmenuExpanded(item.id) : false;
                  const isRendimiento = item.id === "analisisCarteraRendimiento";
                  return (
                    <div key={item.id} className="dashboard-sidebar-item-block">
                      {showChildren ? (
                        <div className="dashboard-sidebar-link-row">
                          <Link
                            href={item.href}
                            onClick={() => (typeof window !== "undefined" && window.matchMedia("(max-width: 1024px)").matches ? setSidebarOpen(false) : undefined)}
                            className={`dashboard-sidebar-link dashboard-sidebar-link--with-toggle ${isActive ? "is-active" : ""} ${isRendimiento ? "sidebar-item-rendimiento" : ""}`}
                            aria-current={isActive ? "page" : undefined}
                            aria-label={item.label}
                            title={item.label}
                            data-testid={item.id === "config" ? "nav-config" : isRendimiento ? "nav-rendimiento-cartera" : undefined}
                          >
                            <span className="dashboard-sidebar-link-icon" aria-hidden>
                              <SidebarMaterialIcon id={item.id} active={isActive} />
                            </span>
                            <span className="dashboard-sidebar-link-text">{item.label}</span>
                          </Link>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            isIconOnly
                            className={`dashboard-sidebar-submenu-toggle ${isActive ? "dashboard-sidebar-submenu-toggle--active-parent" : ""}`}
                            aria-expanded={submenuOpen}
                            aria-controls={`nav-submenu-${item.id}`}
                            aria-label={submenuOpen ? `Contraer submenú: ${item.label}` : `Expandir submenú: ${item.label}`}
                            onPress={() => toggleSubmenu(item.id)}
                          >
                            <SubmenuChevronIcon expanded={submenuOpen} />
                          </Button>
                        </div>
                      ) : (
                        <Link
                          href={item.href}
                          onClick={() => (typeof window !== "undefined" && window.matchMedia("(max-width: 1024px)").matches ? setSidebarOpen(false) : undefined)}
                          className={`dashboard-sidebar-link ${isActive ? "is-active" : ""} ${isRendimiento ? "sidebar-item-rendimiento" : ""}`}
                          aria-current={isActive ? "page" : undefined}
                          aria-label={item.label}
                          title={item.label}
                          data-testid={item.id === "config" ? "nav-config" : isRendimiento ? "nav-rendimiento-cartera" : undefined}
                        >
                          <span className="dashboard-sidebar-link-icon" aria-hidden>
                            <SidebarMaterialIcon id={item.id} active={isActive} />
                          </span>
                          <span className="dashboard-sidebar-link-text">{item.label}</span>
                        </Link>
                      )}
                      {showChildren && submenuOpen ? (
                        <div id={`nav-submenu-${item.id}`} className="dashboard-sidebar-submenu">
                          {item.children?.map((child) => {
                            const isChildActive = navHrefMatchesLocation(pathname, navSearchRaw, child.href);
                            return (
                              <Link
                                key={child.id}
                                href={child.href}
                                onClick={() => (typeof window !== "undefined" && window.matchMedia("(max-width: 1024px)").matches ? setSidebarOpen(false) : undefined)}
                                className={`dashboard-sidebar-sublink ${isChildActive ? "is-active" : ""}`}
                                aria-current={isChildActive ? "page" : undefined}
                                aria-label={child.label}
                                title={child.label}
                              >
                                <span className="dashboard-sidebar-sublink-icon-wrap" aria-hidden>
                                  <SidebarMaterialIcon id={child.id} active={isChildActive} size="sm" />
                                </span>
                                <span className="dashboard-sidebar-sublink-text">{child.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="dashboard-sidebar-bottom mt-auto hidden shrink-0 flex-col lg:flex">
          <div className="dashboard-sidebar-user-wrap">
            <SidebarUserCard auth={auth} themePresetId={themePresetId} onToggleTheme={toggleTheme} onLogout={logout} />
          </div>
          <div className="dashboard-sidebar-footer">
            <Button
              variant="ghost"
              size="sm"
              className="dashboard-sidebar-collapse-btn"
              aria-label="Colapsar menú lateral"
              data-testid="sidebar-collapse-in-panel"
              onPress={() => setSidebarOpen(false)}
            >
              <span className="inline-flex w-full items-center justify-start gap-2">
                <ChevronLeftIcon />
                <span>Colapsar menú</span>
              </span>
            </Button>
          </div>
        </div>
      </aside>
      <div
        className={`dashboard-shell min-h-screen overflow-x-visible transition-[padding-left] duration-[calc(300ms*var(--motion-scale))] ease-out ${sidebarOpen ? "dashboard-shell--with-sidebar" : "dashboard-shell--without-sidebar"}`}
      >
        <Button
          isIconOnly
          variant="secondary"
          size="md"
          className={`dashboard-fab-sidebar-toggle fixed top-3 left-3 z-[160] min-h-[var(--touch-min)] min-w-[var(--touch-min)] shrink-0 rounded-full border border-[var(--glass-border)] !bg-[var(--color-surface-elevated)] !text-[var(--color-text-muted)] !shadow-none backdrop-blur-none transition-[color,background-color,transform] duration-[calc(150ms*var(--motion-scale))] hover:!bg-[color-mix(in_srgb,var(--color-text)_7%,var(--color-surface-elevated))] hover:!text-[var(--color-text)] active:scale-[0.96] data-[pressed=true]:scale-[0.96] lg:hidden ${
            sidebarOpen ? "max-lg:hidden max-lg:pointer-events-none" : ""
          }`}
          aria-label={sidebarOpen ? "Cerrar menú lateral" : "Abrir menú lateral"}
          aria-expanded={sidebarOpen}
          data-testid="sidebar-toggle"
          onPress={() => setSidebarOpen((open) => !open)}
        >
          {sidebarOpen ? <ChevronLeftIcon /> : <HamburgerIcon />}
        </Button>
        <main className="dashboard-main-content overflow-x-auto px-2.5 pb-6 pt-14 lg:px-3 lg:pt-5 xl:px-4 xl:pt-6">
          <div className="container-main dashboard-page-enter">{children}</div>
        </main>
      </div>
    </SyncLiveContext.Provider>
  );
}
