import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'
import { NAV_SECTIONS } from './config/navSections'

const { mockAuth } = vi.hoisted(() => ({
  mockAuth: {
    role: 'admin',
    permissions: [] as string[],
    access_token: 'mock-token',
  },
}))

vi.mock('./shared/api', () => ({
  api: {
    post: vi.fn().mockResolvedValue({ data: { rows: [] } }),
    defaults: {
      baseURL: 'http://localhost:8000/api/v1',
    },
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

vi.mock('./components/SidebarNav', () => ({
  SidebarNav: ({ sections }: { sections: Array<{ id: string; label: string }> }) => (
    <nav aria-label="Menu principal">
      {sections.map((section) => (
        <button key={section.id} type="button">
          {section.label}
        </button>
      ))}
    </nav>
  ),
}))

vi.mock('./modules/analisisCartera/AnalisisCarteraView', () => ({
  AnalisisCarteraView: () => <div>Analisis Cartera Mock</div>,
}))

vi.mock('./modules/analisisCobranzasCohorte/AnalisisCobranzasCohorteView', () => ({
  AnalisisCobranzasCohorteView: () => <div>Analisis Cobranzas Mock</div>,
}))

vi.mock('./modules/config/ConfigView', () => ({
  ConfigView: () => <div>Config Mock</div>,
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all sections with ids from NAV_SECTIONS when authenticated', async () => {
    render(<App />)
    await screen.findByText('Analisis Cartera Mock')
    for (const s of NAV_SECTIONS) {
      const section = document.getElementById(s.id)
      expect(section, `Section with id "${s.id}" should exist`).toBeTruthy()
    }
  })
})
