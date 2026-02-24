import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AppNav } from './AppNav'
import { NAV_SECTIONS } from '../../config/navSections'

afterEach(() => {
  cleanup()
})

describe('AppNav', () => {
  it('renders one link per section with correct href and label', () => {
    render(<AppNav sections={[...NAV_SECTIONS]} />)
    for (const s of NAV_SECTIONS) {
      const link = screen.getByRole('link', { name: s.label })
      expect(link).toBeTruthy()
      expect(link.getAttribute('href')).toBe(`#${s.id}`)
    }
  })

  it('marks the active section with aria-current="true" and class active', () => {
    render(<AppNav sections={[...NAV_SECTIONS]} activeId="config" />)
    const activeLink = screen.getByRole('link', { name: 'Configuracion' })
    expect(activeLink.getAttribute('aria-current')).toBe('true')
    expect(activeLink.classList.contains('active')).toBe(true)

    const otherLink = screen.getByRole('link', { name: 'Analisis de Cartera' })
    expect(otherLink.getAttribute('aria-current')).toBeNull()
    expect(otherLink.classList.contains('active')).toBe(false)
  })

  it('does not set aria-current or active when activeId is null', () => {
    render(<AppNav sections={[...NAV_SECTIONS]} />)
    const links = screen.getAllByRole('link')
    for (const link of links) {
      expect(link.getAttribute('aria-current')).toBeNull()
      expect(link.classList.contains('active')).toBe(false)
    }
  })
})
