"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, ROUTE_TO_SECTION_ID, type NavItem } from "@/config/routes";

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

export function PageBreadcrumbs() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  const label = findLabel(pathname);
  if (!label) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-0 py-2 sm:py-3">
      <h1 className="text-xl font-bold text-[var(--color-text)] sm:text-2xl">
        {label}
      </h1>
    </div>
  );
}
