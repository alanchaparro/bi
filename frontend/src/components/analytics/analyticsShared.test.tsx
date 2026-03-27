import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnalyticsMetaBadges } from './AnalyticsMetaBadges'
import { MetricExplainer } from './MetricExplainer'
import { ChartSection } from './ChartSection'

vi.mock('@heroui/react', () => ({
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}))

describe('analytics shared components', () => {
  it('renders analytics metadata badges when meta is available', () => {
    render(
      <AnalyticsMetaBadges
        meta={{
          source_table: 'cartera_fact + cobranzas_fact',
          data_freshness_at: '2026-03-19T12:00:00Z',
          cache_hit: true,
          pipeline_version: 'v2.1.0',
        }}
      />,
    )

    expect(screen.getByText('Fuente: cartera_fact + cobranzas_fact')).toBeTruthy()
    expect(screen.getByText(/Actualizado:/)).toBeTruthy()
    expect(screen.getByLabelText('Metadata de analytics').textContent).toMatch(/Actualizado:.*\/3\//)
    expect(screen.getByText('Cache hit')).toBeTruthy()
    expect(screen.getByText('Pipeline: v2.1.0')).toBeTruthy()
  })

  it('renders metric explainer formulas and notes', () => {
    render(
      <MetricExplainer
        items={[
          {
            label: 'LTV',
            formula: 'cobrado / deberia_cobrar',
            note: 'Mide lo cobrado frente a lo esperado.',
          },
        ]}
      />,
    )

    expect(screen.getByText('Definiciones operativas')).toBeTruthy()
    expect(screen.getByText('LTV')).toBeTruthy()
    expect(screen.getByText('cobrado / deberia_cobrar')).toBeTruthy()
    expect(screen.getByText('Mide lo cobrado frente a lo esperado.')).toBeTruthy()
  })

  it('shows empty-state copy in chart section when there is no data', () => {
    render(
      <ChartSection
        title="Rendimiento por tramo"
        subtitle="Lectura rapida por tramo."
        hasData={false}
        emptyMessage="Sin resultados para los filtros seleccionados."
        emptySuggestion="Prueba con otro tramo."
      >
        <div>chart</div>
      </ChartSection>,
    )

    expect(screen.getByText('Rendimiento por tramo')).toBeTruthy()
    expect(screen.getByText('Lectura rapida por tramo.')).toBeTruthy()
    expect(screen.getByText('Sin resultados para los filtros seleccionados.')).toBeTruthy()
    expect(screen.getByText('Prueba con otro tramo.')).toBeTruthy()
  })
})
