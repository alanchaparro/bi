export function filterOptions(options: string[], query: string): string[] {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return [...options]
  return options.filter((o) => String(o).toLowerCase().includes(q))
}
