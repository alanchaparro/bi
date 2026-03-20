import React from 'react'
import { Button } from '@heroui/react'
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
  analisisCarteraAnuales: 'AA',
  analisisCarteraRendimientoLegacy: 'RL',
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
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1024px)').matches) {
      onCloseSidebar()
    }
  }

  return (
    <>
      <Button
        isIconOnly
        variant="ghost"
        className="menu-toggle"
        aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={sidebarOpen}
        onPress={onToggleSidebar}
      >
        ☰
      </Button>
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
                <Button
                  key={s.id}
                  variant="ghost"
                  className={`tab-btn ${isSub ? 'tab-sub-btn' : ''} ${activeId === s.id ? 'active' : ''}`}
                  onPress={() => handleClick(s.id)}
                  aria-current={activeId === s.id ? 'page' : undefined}
                >
                  <span className="tab-icon" aria-hidden>{icon}</span>
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
