import { describe, expect, it } from 'vitest'
import { filterOptions } from './filterOptions'

describe('filterOptions', () => {
  it('returns all options for empty query', () => {
    const out = filterOptions(['UNO', 'DOS'], '')
    expect(out).toEqual(['UNO', 'DOS'])
  })

  it('filters options by case-insensitive query', () => {
    const out = filterOptions(['ODONTOLOGIA', 'MEDICINA ESTETICA'], 'odonto')
    expect(out).toEqual(['ODONTOLOGIA'])
  })
})
