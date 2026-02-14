import { api } from '../shared/api'

export type BrokersPreferences = {
  supervisors: string[]
}

export async function loadBrokersPreferences(): Promise<BrokersPreferences> {
  const r = await api.get('/brokers/supervisors-scope')
  return { supervisors: r.data?.supervisors || [] }
}

export async function saveBrokersPreferences(prefs: BrokersPreferences): Promise<void> {
  await api.post('/brokers/supervisors-scope', { supervisors: prefs.supervisors || [] })
}
