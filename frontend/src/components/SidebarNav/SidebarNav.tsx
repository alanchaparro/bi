import React from "react"
import { Button } from "@heroui/react"
import type { NavSection } from "../AppNav/AppNav"

type Props = {
  sections: NavSection[]
  activeId: string | null
  onSelect: (id: string) => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onCloseSidebar: () => void
}

const SUB_IDS = new Set([
  "acaMovimiento",
  "acaAnuales",
  "brokersCommissions",
  "brokersPrizes",
  "brokersSupervisors",
  "brokersMora",
])

function groupSections(sections: NavSection[]) {
  const map = new Map<string, NavSection[]>()
  for (const s of sections) {
    const g = s.group ?? ""
    if (!map.has(g)) map.set(g, [])
    map.get(g)!.push(s)
  }
  return map
}

function SidebarIcon({ id }: { id: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  }

  if (id === "config") {
    return (
      <svg {...common} aria-hidden>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c0 .67.39 1.28 1 1.51H21a2 2 0 0 1 0 4h-.09c-.67 0-1.28.39-1.51 1z" />
      </svg>
    )
  }

  if (id.includes("brokers")) {
    return (
      <svg {...common} aria-hidden>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    )
  }

  if (id.includes("analisis") || id === "rendimiento" || id === "ltv" || id === "ltvAge") {
    return (
      <svg {...common} aria-hidden>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    )
  }

  return (
    <svg {...common} aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="7" y1="9" x2="17" y2="9" />
      <line x1="7" y1="13" x2="17" y2="13" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

export function SidebarNav({
  sections,
  activeId,
  onSelect,
  sidebarOpen,
  onToggleSidebar,
  onCloseSidebar,
}: Props) {
  const groups = groupSections(sections)

  const handleClick = (id: string) => {
    onSelect(id)
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1024px)").matches) {
      onCloseSidebar()
    }
  }

  return (
    <>
      <Button
        isIconOnly
        variant="ghost"
        className="menu-toggle"
        aria-label={sidebarOpen ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={sidebarOpen}
        onPress={onToggleSidebar}
      >
        <MenuIcon />
      </Button>
      <div
        className="sidebar-overlay"
        onClick={onCloseSidebar}
        role="presentation"
        aria-hidden="true"
      />
      <nav className="tabs-nav" aria-label="Menú principal">
        {Array.from(groups.entries()).map(([groupName, items]) => (
          <div key={groupName || "default"}>
            {groupName ? (
              <div className="tabs-section-title">{groupName}</div>
            ) : null}
            {items.map((s) => {
              const isSub = SUB_IDS.has(s.id)
              return (
                <Button
                  key={s.id}
                  variant="ghost"
                  className={`tab-btn ${isSub ? "tab-sub-btn" : ""} ${activeId === s.id ? "active" : ""}`}
                  onPress={() => handleClick(s.id)}
                  aria-current={activeId === s.id ? "page" : undefined}
                >
                  <span className="tab-icon" aria-hidden><SidebarIcon id={s.id} /></span>
                  <span className="tab-label">{s.label}</span>
                </Button>
              )
            })}
          </div>
        ))}
      </nav>
    </>
  )
}
