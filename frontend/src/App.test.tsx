import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'
import { NAV_SECTIONS } from './config/navSections'

const mockAuth = {
  role: 'admin',
  permissions: [] as string[],
  access_token: 'mock-token',
}

vi.mock('./shared/api', () => ({
  api: {
    post: vi.fn().mockResolvedValue({ data: { rows: [] } }),
  },
  restoreSession: vi.fn().mockResolvedValue(mockAuth),
  setOnUnauthorized: vi.fn(),
  setAuthToken: vi.fn(),
  getSupervisorsScope: vi.fn().mockResolvedValue({ supervisors: [] }),
  getCommissionsRules: vi.fn().mockResolvedValue({ rules: [] }),
  getPrizesRules: vi.fn().mockResolvedValue({ rules: [] }),
  saveCommissionsRules: vi.fn(),
  savePrizesRules: vi.fn(),
  saveSupervisorsScope: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}))

vi.mock('./store/userPreferences', () => ({
  loadBrokersPreferences: vi.fn().mockResolvedValue({ filters: {} }),
  persistBrokersPreferences: vi.fn().mockResolvedValue(undefined),
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all sections with ids from NAV_SECTIONS when authenticated', async () => {
    render(<App />)
    await screen.findByRole('link', { name: 'Brokers' })
    for (const s of NAV_SECTIONS) {
      const section = document.getElementById(s.id)
      expect(section, `Section with id "${s.id}" should exist`).toBeInTheDocument()
    }
  })
})
