export type BrokerRow = {
  supervisor?: string
  count?: number
  mora3m?: number
}

export function summarizeRows(rows: BrokerRow[]) {
  const supervisors = new Set<string>()
  let contracts = 0
  let mora3m = 0
  for (const r of rows || []) {
    const s = String(r.supervisor || '').trim()
    if (s) supervisors.add(s)
    contracts += Number(r.count || 0)
    mora3m += Number(r.mora3m || 0)
  }
  return {
    totalSupervisors: supervisors.size,
    totalContracts: contracts,
    totalMora3m: mora3m,
  }
}
