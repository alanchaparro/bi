"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { useAuth } from "@/app/providers";
import { NAV_ITEMS, type NavItem } from "@/config/routes";

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

function groupNavItems() {
  const map = new Map<string, NavItem[]>();
  for (const item of NAV_ITEMS) {
    const g = item.group ?? "";
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(item);
  }
  return map;
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const SIDEBAR_ICON_SIZE = 20;
function SidebarIcon({ id }: { id: string }) {
  const common = {
    width: SIDEBAR_ICON_SIZE,
    height: SIDEBAR_ICON_SIZE,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (id === "analisisCartera") {
    return (
      <svg {...common} aria-hidden>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    );
  }
  if (id === "analisisCarteraAnuales") {
    return (
      <svg {...common} aria-hidden>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    );
  }
  if (id === "analisisCarteraRendimientoLegacy") {
    return (
      <svg {...common} aria-hidden>
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    );
  }
  if (id === "analisisCobranzaCohorte") {
    return (
      <svg {...common} aria-hidden>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (id === "config") {
    return (
      <svg {...common} aria-hidden>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function ThemeIcon({ isDark }: { isDark: boolean }) {
  const size = 20;
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (isDark) {
    return (
      <svg {...common} aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
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

function CloseIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { auth, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 1024px)").matches;
  });
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
      const saved = localStorage.getItem("ui-theme");
      setTheme(saved === "light" ? "light" : "dark");
    } catch {
      setTheme("dark");
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(theme);
    try {
      localStorage.setItem("ui-theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const syncSidebarByViewport = () => setSidebarOpen(mq.matches);
    syncSidebarByViewport();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", syncSidebarByViewport);
      return () => mq.removeEventListener("change", syncSidebarByViewport);
    }
    mq.addListener(syncSidebarByViewport);
    return () => mq.removeListener(syncSidebarByViewport);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  const syncContextValue: SyncLiveContextValue = {
    syncLive,
    scheduleLive,
    setSyncLive,
    setScheduleLive,
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-color)]">
        <p className="text-[var(--text-secondary)]">Cargando...</p>
      </div>
    );
  }

  if (!auth) {
    return null;
  }

  const groups = groupNavItems();
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
        className={`dashboard-sidebar-overlay fixed inset-0 z-[100] bg-black/50 lg:hidden transition-opacity duration-200 ${
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        role="presentation"
        aria-hidden
        onClick={() => setSidebarOpen(false)}
      />
      <aside
        className={`dashboard-sidebar fixed inset-y-0 left-0 z-[150] flex h-[100dvh] min-h-[100dvh] w-[85vw] max-w-72 flex-col transition-transform duration-300 ease-out lg:w-[var(--sidebar-width)] ${
          sidebarOpen ? "translate-x-0 lg:translate-x-0" : "-translate-x-full lg:-translate-x-full"
        }`}
      >
        <div className="dashboard-sidebar-mobile-header flex items-center justify-between px-4 py-2 lg:hidden">
          <strong className="text-sm font-semibold text-[var(--color-text)]">Menu</strong>
          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            aria-label="Cerrar menu"
            onPress={() => setSidebarOpen(false)}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            <CloseIcon />
          </Button>
        </div>
        <div className="dashboard-sidebar-brand hidden lg:block">
          <div className="dashboard-sidebar-brand-kicker">Navegacion</div>
          <div className="dashboard-sidebar-brand-title">EPEM</div>
          <div className="dashboard-sidebar-brand-note">Accesos principales del frente analitico.</div>
        </div>
        <nav className="dashboard-sidebar-nav flex flex-1 flex-col overflow-y-auto overflow-x-hidden pb-6" aria-label="Menu principal">
          {Array.from(groups.entries()).map(([groupName, items]) => (
            <div key={groupName || "default"} className="dashboard-sidebar-group">
              {groupName ? <div className="dashboard-sidebar-group-label">{groupName}</div> : null}
              <div className="dashboard-sidebar-links">
                {items.map((item) => {
                  const isActive = isActivePath(pathname, item.href);
                  const showChildren = Boolean(item.children?.length);
                  const isRendimiento = item.id === "analisisCarteraRendimientoLegacy";
                  return (
                    <div key={item.id} className="dashboard-sidebar-item-block">
                      <Link
                        href={item.href}
                        onClick={() => (typeof window !== "undefined" && window.matchMedia("(max-width: 1024px)").matches ? setSidebarOpen(false) : undefined)}
                        className={`dashboard-sidebar-link ${isActive ? "is-active" : ""} ${isRendimiento ? "sidebar-item-rendimiento" : ""}`}
                        aria-current={isActive ? "page" : undefined}
                        aria-label={item.label}
                        data-testid={isRendimiento ? "nav-rendimiento-cartera" : undefined}
                      >
                        <span className="dashboard-sidebar-link-icon" aria-hidden>
                          <SidebarIcon id={item.id} />
                        </span>
                        <span className="dashboard-sidebar-link-text">{item.label}</span>
                      </Link>
                      {showChildren ? (
                        <div className="dashboard-sidebar-submenu is-open">
                          {item.children?.map((child) => {
                            const isChildActive = pathname === child.href;
                            return (
                              <Link
                                key={child.id}
                                href={child.href}
                                onClick={() => (typeof window !== "undefined" && window.matchMedia("(max-width: 1024px)").matches ? setSidebarOpen(false) : undefined)}
                                className={`dashboard-sidebar-sublink ${isChildActive ? "is-active" : ""}`}
                                aria-current={isChildActive ? "page" : undefined}
                                aria-label={child.label}
                              >
                                <span className="dashboard-sidebar-sublink-dot" aria-hidden />
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
      </aside>
      <div
        className={`dashboard-shell min-h-screen overflow-x-hidden transition-[padding-left] duration-300 ease-out ${sidebarOpen ? "dashboard-shell--with-sidebar" : "dashboard-shell--without-sidebar"}`}
      >
        <div className="dashboard-header dashboard-header--full sticky top-0 z-[140] border-b border-[var(--glass-border)] bg-[var(--card-bg)]/95 px-3 py-3 backdrop-blur-xl lg:px-6">
          <div className="dashboard-header-shell">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                isIconOnly
                variant="ghost"
                size="md"
                className="dashboard-toggle-button min-h-[var(--touch-min)] min-w-[var(--touch-min)] shrink-0"
                aria-label={sidebarOpen ? "Cerrar menu lateral" : "Abrir menu lateral"}
                aria-expanded={sidebarOpen}
                data-testid="sidebar-toggle"
                onPress={() => setSidebarOpen((open) => !open)}
              >
                {sidebarOpen ? <ChevronLeftIcon /> : <HamburgerIcon />}
              </Button>
              <div className="dashboard-brand-block">
                <span className="dashboard-brand-kicker">Panel operativo</span>
                <h1 className="dashboard-brand-title">EPEM - Cartera de Cobranzas</h1>
              </div>
            </div>
            <div className="dashboard-header-actions text-sm text-[var(--text-secondary)]">
              <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Estado de sincronizacion">
                {showSchedule && (
                  <Link
                    href="/config"
                    className="header-pill header-pill--warn"
                    title={`Actualizacion en progreso ${schedulePct > 0 ? `(${schedulePct}%)` : ""}`}
                  >
                    <span>P</span>
                    <span>{schedulePct}%</span>
                  </Link>
                )}
                {showSync && (
                  <Link
                    href="/config"
                    className={`header-pill ${
                      syncTone === "error" ? "header-pill--error" : syncTone === "ok" ? "header-pill--ok" : syncTone === "warn" ? "header-pill--warn" : "header-pill--info"
                    }`}
                    title={`${syncLive?.message ?? "Sincronizando..."} | ${syncPct}% | ${headerLiveLabel}`}
                  >
                    <span>{syncPct}%</span>
                    <span className="max-w-20 truncate">{String(syncLive?.currentDomain ?? "-")}</span>
                    <span className="text-xs opacity-90">{headerLiveLabel}</span>
                  </Link>
                )}
              </div>
              {(showSchedule || showSync) ? <span className="hidden h-4 w-px bg-[var(--glass-border)] md:block" aria-hidden /> : null}
              <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Usuario y acciones">
                <span>
                  Rol: <strong className="text-[var(--text-primary)]">{auth.role ?? "-"}</strong>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                  onPress={toggleTheme}
                  className="min-h-[var(--touch-min)] min-w-[var(--touch-min)]"
                >
                  <ThemeIcon isDark={theme === "dark"} />
                </Button>
                <Button type="button" variant="outline" size="sm" onPress={logout} className="min-h-[var(--touch-min)]">
                  Cerrar sesion
                </Button>
              </div>
            </div>
          </div>
        </div>
        <main className="dashboard-main-content px-4 pb-8 pt-6 lg:px-8 lg:pt-8 xl:px-10 xl:pt-10">
          <div className="container-main dashboard-page-enter">{children}</div>
        </main>
      </div>
    </SyncLiveContext.Provider>
  );
}
