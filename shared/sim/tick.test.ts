import { describe, expect, it } from 'vitest'
import { createSector } from './createSector'
import { assignCommander, commandHoldMult, RANKS } from './commander'
import {
  controlledCountsByFront,
  controlledHexCount,
  visibleTerritoryHexes,
} from './territory'
import {
  catchUp,
  repairFront,
  setAllocations,
  setGameSpeed,
  syncFromWall,
  tickMinute,
} from './tick'
import { SIM } from './types'

const T0 = 1_700_000_000_000

describe('sector tick', () => {
  it('does not produce negative stockpiles after long catch-up', () => {
    let state = createSector(T0)
    state = setAllocations(state, { north: 0.1, breach: 0.1, dock: 0.8 })
    state = catchUp(state, T0 + 8 * 60 * 60 * 1000)
    expect(state.stockpile.conscripts).toBeGreaterThanOrEqual(0)
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
    state.nextDevastatingAtIndex = 999
    // Window shorter than min assault gap so only one wave can fire
    state = catchUp(state, T0 + 12 * 60_000)
    expect(state.pendingReport?.assaults).toHaveLength(1)
    expect(state.assaultIndex).toBe(1)
    const delay = state.nextAssaultAt - (T0 + 10 * 60_000)
    expect(delay).toBeGreaterThanOrEqual(SIM.assaultIntervalMinMinutes * 60_000)
    expect(delay).toBeLessThanOrEqual(SIM.assaultIntervalMaxMinutes * 60_000)
  })

  it('marks every Nth assault as devastating', () => {
    let state = createSector(T0)
    state.nextAssaultAt = T0 + 60_000
    state.nextDevastatingAtIndex = 3
    state.assaultIndex = 0

    const assaults = []
    for (let i = 1; i <= 5; i++) {
      // Force assaults one minute apart
      state.nextAssaultAt = T0 + i * 60_000
      const report = tickMinute(state, T0 + i * 60_000)
      if (report.assaults[0]) assaults.push(report.assaults[0])
    }

    expect(assaults).toHaveLength(5)
    expect(assaults.filter((a) => a.devastating)).toHaveLength(1)
    expect(assaults[2]!.devastating).toBe(true)
    expect(state.nextDevastatingAtIndex).toBeGreaterThan(3)
  })

  it('repair spends conscripts and raises integrity', () => {
    const state = createSector(T0)
    const before = state.fronts.find((f) => f.id === 'breach')!.integrity
    const next = repairFront(state, 'breach')
    expect(next.stockpile.conscripts).toBe(
      state.stockpile.conscripts - SIM.repairIntegrityCostConscripts,
    )
    // Default posting is Breach — Power 1 adds +1 repair integrity
    expect(next.fronts.find((f) => f.id === 'breach')!.integrity).toBe(
      Math.min(100, before + SIM.repairIntegrityAmount + 1),
    )
  })

  it('refuses repair when front integrity is already 100', () => {
    const state = createSector(T0)
    state.fronts = state.fronts.map((f) =>
      f.id === 'dock' ? { ...f, integrity: 100 } : f,
    )
    const next = repairFront(state, 'dock')
    expect(next).toBe(state)
    expect(next.stockpile.conscripts).toBe(state.stockpile.conscripts)
  })

  it('golden: 60 minutes balanced hold matches fixture deltas', () => {
    let state = createSector(T0)
    state.nextAssaultAt = T0 + 999 * 60 * 60 * 1000 // no assault
    state = catchUp(state, T0 + 60 * 60_000)
    const r = state.pendingReport!
    expect(r.minutes).toBe(60)
    expect(r.assaults).toHaveLength(0)
    // Snapshot — update deliberately if formulas change
    expect(state.stockpile.conscripts).toBeCloseTo(424.5, 0)
    // Breach is default commander posting — holds better than unled fronts
    expect(state.fronts.find((f) => f.id === 'breach')!.integrity).toBeCloseTo(
      58.1,
      0,
    )
  })

  it('commander power only mitigates the assigned front', () => {
    const state = createSector(T0)
    state.commander.rankIndex = 3
    state.commander.xp = RANKS[3]!.xpRequired
    const posted = assignCommander(state, 'breach')
    expect(commandHoldMult(posted, 'breach')).toBeLessThan(1)
    expect(commandHoldMult(posted, 'north')).toBe(1)
  })

  it('starts with a small foothold and expands control with rank', () => {
    const state = createSector(T0)
    expect(controlledHexCount(state)).toBe(3)
    expect(controlledCountsByFront(state)).toEqual({
      north: 1,
      breach: 1,
      dock: 1,
    })
    expect(visibleTerritoryHexes(state).filter((h) => h.kind !== 'approach')).toHaveLength(
      4,
    )

    state.commander.rankIndex = 1
    state.commander.xp = RANKS[1]!.xpRequired
    // Extra hex prefers the assigned front (breach by default)
    expect(controlledCountsByFront(state)).toEqual({
      north: 1,
      breach: 2,
      dock: 1,
    })

    state.commander.rankIndex = RANKS.length - 1
    state.commander.xp = RANKS[RANKS.length - 1]!.xpRequired
    expect(controlledHexCount(state)).toBe(12)
  })

  it('grants XP and promotes the commander', () => {
    let state = createSector(T0)
    state.nextAssaultAt = T0 + 999 * 60 * 60 * 1000
    expect(state.commander.rankIndex).toBe(0)
    state = catchUp(state, T0 + RANKS[1]!.xpRequired * 60_000)
    expect(state.commander.xp).toBeGreaterThanOrEqual(RANKS[1]!.xpRequired)
    expect(state.commander.rankIndex).toBeGreaterThanOrEqual(1)
    expect(state.opsLog.some((e) => e.kind === 'rank')).toBe(true)
  })

  it('records assault and outcome in the operations log', () => {
    let state = createSector(T0)
    expect(state.opsLog.some((e) => e.kind === 'status')).toBe(true)
    state.nextAssaultAt = T0 + 60_000
    state.nextDevastatingAtIndex = 999
    state = catchUp(state, T0 + 2 * 60_000)
    const kinds = state.opsLog.map((e) => e.kind)
    expect(kinds).toContain('assault')
    expect(kinds).toContain('outcome')
  })

  it('game speed multiplies wall elapsed into sim time', () => {
    let state = createSector(T0)
    state.nextAssaultAt = T0 + 999 * 60 * 60 * 1000
    state = setGameSpeed(state, 50, T0)
    // 72 wall seconds at 50× → 60 sim minutes
    state = syncFromWall(state, T0 + 72_000)
    expect(state.pendingReport?.minutes).toBe(60)
    expect(state.gameSpeed).toBe(50)
  })
})
