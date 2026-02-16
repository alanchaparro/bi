import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppNav } from './AppNav'
import { NAV_SECTIONS } from '../../config/navSections'

describe('AppNav', () => {
  it('renders one link per section with correct href and label', () => {
    render(<AppNav sections={[...NAV_SECTIONS]} />)
    for (const s of NAV_SECTIONS) {
      const link = screen.getByRole('link', { name: s.label })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', `#${s.id}`)
    }
  })

  it('marks the active section with aria-current="true" and class active', () => {
    render(<AppNav sections={[...NAV_SECTIONS]} activeId="brokersCommissions" />)
    const activeLink = screen.getByRole('link', { name: 'Config. Comisiones' })
    expect(activeLink).toHaveAttribute('aria-current', 'true')
    expect(activeLink).toHaveClass('active')

    const otherLink = screen.getByRole('link', { name: 'Brokers' })
    expect(otherLink).not.toHaveAttribute('aria-current')
    expect(otherLink).not.toHaveClass('active')
  })

  it('does not set aria-current or active when activeId is null', () => {
    render(<AppNav sections={[...NAV_SECTIONS]} />)
    const links = screen.getAllByRole('link')
    for (const link of links) {
      expect(link).not.toHaveAttribute('aria-current')
      expect(link).not.toHaveClass('active')
    }
  })
})
