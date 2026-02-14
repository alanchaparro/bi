import { describe, expect, it } from 'vitest'
import { summarizeRows } from './rowUtils'

describe('summarizeRows', () => {
  it('summarizes contracts/mora and unique supervisors', () => {
    const out = summarizeRows([
      { supervisor: 'A', count: 10, mora3m: 2 },
      { supervisor: 'A', count: 5, mora3m: 1 },
      { supervisor: 'B', count: 8, mora3m: 3 },
    ])
    expect(out).toEqual({ totalSupervisors: 2, totalContracts: 23, totalMora3m: 6 })
  })
})
