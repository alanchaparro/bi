import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, ROUTE_TO_SECTION_ID, type NavItem, ROUTES } from "@/config/routes";

/**
 * Resuelve el segmento padre y su etiqueta para el breadcrumb.
 */
function resolveParent(pathname: string): { label: string; href: string } | null {
  if (pathname === "/login" || pathname === "/") return null;
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length <= 1) return null;
  // Próximo páth hacia arriba
  const parentPath = "/" + parts.slice(0, -1).join("/");
  const sid = ROUTE_TO_SECTION_ID[parentPath];
  if (sid) {
    for (const raw of NAV_ITEMS) {
      const item = raw as NavItem;
      if (item.id === sid) return { label: item.label, href: item.href };
      if (item.subItems) {
        const sub = item.subItems.find((c) => c.id === sid);
        if (sub) return { label: sub.label, href: sub.href };
      }
    }
  }
  const last = parentPath.split("/").filter(Boolean).pop() || "";
  return { label: last.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()), href: parentPath };
}

function findLabel(pathname: string): string {
  const sectionId = ROUTE_TO_SECTION_ID[pathname];
  if (sectionId) {
    for (const raw of NAV_ITEMS) {
      const item = raw as NavItem;
      if (item.id === sectionId) return item.label;
      if (item.subItems) {
        const sub = item.subItems.find((c) => c.id === sectionId);
        if (sub) return sub.label;
      }
    }
  }
  const last = pathname.split("/").filter(Boolean).pop() || "";
  return last.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function HomeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}

function Separator() {
  return (
    <span className="text-[var(--color-text-muted)] opacity-50" aria-hidden="true">/</span>
  );
}

/**
 * Mejora UX #6: Breadcrumbs en TODAS las vistas analytics.
 * Muestra Home > Parent (si aplica) > Página actual.
 */
export function PageBreadcrumbs() {
  const pathname = usePathname();
  if (!pathname || pathname === "/login") return null;
  const label = findLabel(pathname);
  if (!label) return null;
  const parent = resolveParent(pathname);

  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center justify-between gap-2 px-0 py-2 sm:py-3">
      <ul className="flex flex-wrap items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
        <li className="flex items-center gap-1.5">
          <Link href={ROUTES.cartera} className="flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-sm" aria-label="Inicio">
            <HomeIcon />
            <span className="hidden sm:inline">Inicio</span>
          </Link>
        </li>
        {parent ? (
          <>
            <Separator />
            <li>
              <Link href={parent.href} className="hover:text-[var(--color-primary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-sm">
                {parent.label}
              </Link>
            </li>
          </>
        ) : null}
        <Separator />
        <li aria-current="page" className="font-medium text-[var(--color-text)]">
          {label}
        </li>
      </ul>
      <h1 className="text-xl font-bold text-[var(--color-text)] sm:text-2xl">{label}</h1>
    </nav>
  );
}
