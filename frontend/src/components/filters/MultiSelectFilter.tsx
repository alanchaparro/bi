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
      <label>{label}</label>
      <input
        aria-label={`${label} buscar`}
        placeholder="Buscar..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div style={{ maxHeight: 120, overflow: 'auto', border: '1px solid #334155', padding: 8 }}>
        {filtered.map((v) => (
          <label key={v} style={{ display: 'block' }}>
            <input
              type="checkbox"
              checked={selected.includes(v)}
              onChange={() => toggle(v)}
            />
            {v}
          </label>
        ))}
      </div>
    </div>
  )
}
