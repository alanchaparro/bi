import { getBrokersPreferences, saveBrokersPreferences } from '../shared/api'
import { EMPTY_BROKERS_FILTERS, type BrokersPreferences } from '../shared/contracts'

export type { BrokersPreferences } from '../shared/contracts'

const EMPTY: BrokersPreferences = {
  filters: EMPTY_BROKERS_FILTERS,
}

export async function loadBrokersPreferences(): Promise<BrokersPreferences> {
  const r = await getBrokersPreferences()
  return {
    filters: {
      supervisors: r?.filters?.supervisors || [],
      uns: r?.filters?.uns || [],
      vias: r?.filters?.vias || [],
      years: r?.filters?.years || [],
      months: r?.filters?.months || [],
    },
  }
}

export async function persistBrokersPreferences(prefs: BrokersPreferences): Promise<void> {
  await saveBrokersPreferences(prefs || EMPTY)
}
