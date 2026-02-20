import React from 'react'

export type NavSection = { id: string; label: string; group?: string }

type Props = {
  sections: NavSection[]
  activeId?: string | null
}

function groupSections(sections: NavSection[]) {
  const map = new Map<string, NavSection[]>()
  for (const s of sections) {
    const g = s.group ?? ''
    if (!map.has(g)) map.set(g, [])
    map.get(g)!.push(s)
  }
  return map
}

export function AppNav({ sections, activeId = null }: Props) {
  const groups = groupSections(sections)
  return (
    <nav className="app-nav" aria-label="Menu principal">
      {Array.from(groups.entries()).map(([groupName, items]) => (
        <div key={groupName || 'default'} className="app-nav-group">
          {groupName ? <span className="app-nav-group-label">{groupName}</span> : null}
          {items.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={activeId === s.id ? 'active' : undefined}
              aria-current={activeId === s.id ? 'true' : undefined}
            >
              {s.label}
            </a>
          ))}
        </div>
      ))}
    </nav>
  )
}
