import React, { useMemo, useState } from 'react'
import { filterOptions } from './filterOptions'

type Props = {
  label: string
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
}

export function MultiSelectFilter({ label, options, selected, onChange }: Props) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => filterOptions(options, q), [options, q])

  const toggle = (value: string) => {
    const has = selected.includes(value)
    if (has) onChange(selected.filter((v) => v !== value))
    else onChange([...selected, value])
  }

  return (
    <div aria-label={label}>
      <label className="input-label">{label}</label>
      <input
        className="input"
        aria-label={`${label} buscar`}
        placeholder="Buscar…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: '0.5rem' }}
      />
      <div style={{ maxHeight: 140, overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '0.5rem', background: 'var(--color-surface)' }}>
        {options.length === 0 ? (
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            Sin opciones (no hay datos cargados)
          </span>
        ) : (
          filtered.map((v) => (
            <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', cursor: 'pointer', fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                checked={selected.includes(v)}
                onChange={() => toggle(v)}
              />
              {v}
            </label>
          ))
        )}
      </div>
    </div>
  )
}
