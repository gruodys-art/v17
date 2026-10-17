import { describe, expect, it } from 'vitest'
import { createSector } from './createSector'
import { catchUp, repairFront, setAllocations, tickMinute } from './tick'
import { SIM } from './types'

const T0 = 1_700_000_000_000

describe('sector tick', () => {
  it('does not produce negative stockpiles after long catch-up', () => {
    let state = createSector(T0)
    state = setAllocations(state, { north: 0.1, breach: 0.1, dock: 0.8 })
    state = catchUp(state, T0 + 8 * 60 * 60 * 1000)
    expect(state.stockpile.manpower).toBeGreaterThanOrEqual(0)
    expect(state.stockpile.munitions).toBeGreaterThanOrEqual(0)
    expect(state.stockpile.morale).toBeGreaterThanOrEqual(0)
    for (const f of state.fronts) {
      expect(f.integrity).toBeGreaterThanOrEqual(0)
      expect(f.integrity).toBeLessThanOrEqual(100)
    }
  })

  it('starved front loses integrity faster than oversupplied front', () => {
    const starved = createSector(T0)
    starved.fronts = starved.fronts.map((f) =>
      f.id === 'breach'
        ? { ...f, allocation: 0.05, integrity: 60, pressure: 4 }
        : { ...f, allocation: 0.475, integrity: 60, pressure: 4 },
    )
    const fed = structuredClone(starved)
    fed.fronts = fed.fronts.map((f) =>
      f.id === 'breach'
        ? { ...f, allocation: 0.7 }
        : { ...f, allocation: 0.15 },
    )

    for (let i = 1; i <= 30; i++) {
      tickMinute(starved, T0 + i * 60_000)
      tickMinute(fed, T0 + i * 60_000)
    }

    const starvedBreach = starved.fronts.find((f) => f.id === 'breach')!.integrity
    const fedBreach = fed.fronts.find((f) => f.id === 'breach')!.integrity
    expect(starvedBreach).toBeLessThan(fedBreach)
  })

  it('applies a scheduled assault exactly once during catch-up', () => {
    let state = createSector(T0)
    state.nextAssaultAt = T0 + 10 * 60_000
    state = catchUp(state, T0 + 40 * 60_000)
    expect(state.pendingReport?.assaults).toHaveLength(1)
    expect(state.assaultIndex).toBe(1)
    expect(state.nextAssaultAt).toBe(T0 + 10 * 60_000 + SIM.assaultIntervalMs)
  })

  it('repair spends stockpile and raises integrity', () => {
    const state = createSector(T0)
    const before = state.fronts.find((f) => f.id === 'breach')!.integrity
    const next = repairFront(state, 'breach')
    expect(next.stockpile.manpower).toBe(
      state.stockpile.manpower - SIM.repairIntegrityCostManpower,
    )
    expect(next.fronts.find((f) => f.id === 'breach')!.integrity).toBe(
      Math.min(100, before + SIM.repairIntegrityAmount),
    )
  })

  it('golden: 60 minutes balanced hold matches fixture deltas', () => {
    let state = createSector(T0)
    state.nextAssaultAt = T0 + 999 * 60 * 60 * 1000 // no assault
    state = catchUp(state, T0 + 60 * 60_000)
    const r = state.pendingReport!
    expect(r.minutes).toBe(60)
    expect(r.assaults).toHaveLength(0)
    expect(state.stockpile.manpower).toBeCloseTo(205.8, 0)
    expect(state.stockpile.munitions).toBeCloseTo(348.5, 0)
    expect(state.fronts.find((f) => f.id === 'breach')!.integrity).toBeCloseTo(
      55.7,
      0,
    )
  })
})
