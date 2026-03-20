import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AnalisisRendimientoView } from './AnalisisRendimientoView'

vi.mock('@heroui/react', () => ({
  Button: ({ children, onPress, isDisabled, ...props }: any) => (
    <button type="button" onClick={onPress} disabled={isDisabled} {...props}>
      {children}
    </button>
  ),
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Skeleton: ({ animationType, ...props }: any) => <div {...props} />,
}))

const apiMocks = vi.hoisted(() => ({
  getRendimientoOptions: vi.fn(),
  getRendimientoFirstPaint: vi.fn(),
  getRendimientoSummary: vi.fn(),
  markPerfReady: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/api')>()
  return {
    ...actual,
    getRendimientoOptions: apiMocks.getRendimientoOptions,
    getRendimientoFirstPaint: apiMocks.getRendimientoFirstPaint,
    getRendimientoSummary: apiMocks.getRendimientoSummary,
    markPerfReady: apiMocks.markPerfReady,
  }
})

describe('AnalisisRendimientoView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.getRendimientoOptions.mockResolvedValue({
      options: {
        gestion_months: ['02/2026', '03/2026'],
        uns: ['ODONTOLOGIA', 'ODONTOLOGIA TTO'],
        tramos: ['0', '4'],
        vias_cobro: ['DEBITO', 'COBRADOR'],
        vias_pago: ['DEBITO', 'EFECTIVO'],
        categorias: ['VIGENTE', 'MOROSO'],
        supervisors: ['SUP1'],
      },
      default_gestion_month: '03/2026',
    })
    apiMocks.getRendimientoFirstPaint.mockResolvedValue({
      totals: {
        totalDebt: 1000,
        totalPaid: 500,
        totalContracts: 20,
        totalContractsPaid: 10,
      },
      mini_trend: {
        '03/2026': { d: 1000, p: 500, c: 20, cp: 10 },
      },
      meta: {
        source_table: 'cartera_fact + cobranzas_fact',
        data_freshness_at: '2026-03-19T12:00:00Z',
        cache_hit: true,
        pipeline_version: 'v2.1.0',
      },
    })
    apiMocks.getRendimientoSummary.mockResolvedValue({
      totalDebt: 1000,
      totalPaid: 500,
      totalContracts: 20,
      totalContractsPaid: 10,
      tramoStats: {
        '0': { d: 400, p: 300 },
        '4': { d: 600, p: 200 },
      },
      unStats: {
        ODONTOLOGIA: { d: 700, p: 350 },
        'ODONTOLOGIA TTO': { d: 300, p: 150 },
      },
      viaCStats: {
        DEBITO: { d: 500, p: 300 },
      },
      gestorStats: {},
      matrixStats: {},
      trendStats: {
        '03/2026': { d: 1000, p: 500, c: 20, cp: 10 },
      },
      meta: {
        source_table: 'cartera_fact + cobranzas_fact',
        data_freshness_at: '2026-03-19T12:00:00Z',
        cache_hit: true,
        pipeline_version: 'v2.1.0',
      },
    })
  })

  it('renders negocio copy, metadata and required rendimiento KPIs', async () => {
    render(<AnalisisRendimientoView />)

    expect(await screen.findByText('Rendimiento de cartera')).toBeTruthy()
    expect(screen.getByText('Mes de gestión')).toBeTruthy()
    expect(screen.getAllByText('Rendimiento por monto').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Rendimiento por cantidad').length).toBeGreaterThan(0)
    expect(screen.getByText('Monto a cobrar = monto vencido + monto cuota.')).toBeTruthy()
    expect(screen.getByText('VIGENTE = 0..3 | MOROSO = >3')).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByText('Fuente: cartera_fact + cobranzas_fact')).toBeTruthy()
      expect(screen.getByText('Cache hit')).toBeTruthy()
      expect(screen.getByText('Pipeline: v2.1.0')).toBeTruthy()
    })
  })
})
