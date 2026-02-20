import React from 'react'
import type { NavSection } from '../AppNav/AppNav'

type Props = {
  sections: NavSection[]
  activeId: string | null
  onSelect: (id: string) => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onCloseSidebar: () => void
}

const SECTION_ICON: Record<string, string> = {
  cartera: '[]',
  cobranzas: '$',
  analisisCartera: 'AC',
  acaMovimiento: '->',
  acaAnuales: '->',
  rendimiento: 'R',
  cosecha: 'C',
  ltv: 'LTV',
  ltvAge: 'LA',
  analisisCobranza: 'AN',
  analisisCobranzaCohorte: 'CO',
  culminados: 'OK',
  gestores: 'GS',
  brokers: 'BR',
  brokersCommissions: '->',
  brokersPrizes: '->',
  brokersSupervisors: '->',
  brokersMora: '->',
  config: 'CF',
}

const SUB_IDS = new Set([
  'acaMovimiento',
  'acaAnuales',
  'brokersCommissions',
  'brokersPrizes',
  'brokersSupervisors',
  'brokersMora',
])

function groupSections(sections: NavSection[]) {
  const map = new Map<string, NavSection[]>()
  for (const s of sections) {
    const g = s.group ?? ''
    if (!map.has(g)) map.set(g, [])
    map.get(g)!.push(s)
  }
  return map
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
    onCloseSidebar()
  }

  return (
    <>
      <button
        type="button"
        className="menu-toggle"
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={sidebarOpen}
        title={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
      >
        ☰
      </button>
      <div
        className="sidebar-overlay"
        onClick={onCloseSidebar}
        role="presentation"
        aria-hidden="true"
      />
      <nav className="tabs-nav" aria-label="Menú principal">
        {Array.from(groups.entries()).map(([groupName, items]) => (
          <div key={groupName || 'default'}>
            {groupName ? (
              <div className="tabs-section-title">{groupName}</div>
            ) : null}
            {items.map((s) => {
              const isSub = SUB_IDS.has(s.id)
              const icon = SECTION_ICON[s.id] ?? ''
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`tab-btn ${isSub ? 'tab-sub-btn' : ''} ${activeId === s.id ? 'active' : ''}`}
                  onClick={() => handleClick(s.id)}
                  aria-current={activeId === s.id ? 'true' : undefined}
                  title={s.label}
                >
                  <span className="tab-icon" aria-hidden>{icon}</span>
                  <span className="tab-label">{s.label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </nav>
    </>
  )
}
