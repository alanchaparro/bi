import { getBrokersPreferences, saveBrokersPreferences } from '../shared/api'

export type BrokersPreferences = {
  filters: {
    supervisors: string[]
    uns: string[]
    vias: string[]
    years: string[]
    months: string[]
  }
}

const EMPTY: BrokersPreferences = {
  filters: { supervisors: [], uns: [], vias: [], years: [], months: [] },
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
