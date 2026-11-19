import { pushOpsLog } from './opsLog'
import type { Commander, FrontId, RankDef, SectorState } from './types'
import { FRONT_IDS } from './types'

/** Imperial officer ladder — power / control span rise with rank. */
export const RANKS: RankDef[] = [
  { id: 'provisional', title: 'Provisional Officer', xpRequired: 0, power: 1, controlCapacity: 3 },
  { id: 'lieutenant', title: 'Lieutenant', xpRequired: 80, power: 2, controlCapacity: 4 },
  { id: 'captain', title: 'Captain', xpRequired: 220, power: 3, controlCapacity: 6 },
  { id: 'major', title: 'Major', xpRequired: 500, power: 4, controlCapacity: 8 },
  { id: 'colonel', title: 'Colonel', xpRequired: 1000, power: 5, controlCapacity: 10 },
  { id: 'marshal', title: 'Marshal Designate', xpRequired: 1800, power: 7, controlCapacity: 12 },
]

export function createCommander(assignedFrontId: FrontId | null = 'breach'): Commander {
  return {
    callsign: 'Sector Commander',
    xp: 0,
    rankIndex: 0,
    assignedFrontId,
  }
}

export function rankForXp(xp: number): number {
  let idx = 0
  for (let i = 0; i < RANKS.length; i++) {
    if (xp >= RANKS[i]!.xpRequired) idx = i
  }
  return idx
}

export function currentRank(state: SectorState): RankDef {
  const idx = state.commander?.rankIndex ?? 0
  return RANKS[Math.min(idx, RANKS.length - 1)]!
}

/** Combat power of the commander (from current rank). */
export function commanderPower(state: SectorState): number {
  return currentRank(state).power
}

/** Damage taken multiplier on a front when the commander is posted there (<1 = stronger). */
export function commandHoldMult(state: SectorState, frontId: FrontId): number {
  if (state.commander?.assignedFrontId !== frontId) return 1
  const power = commanderPower(state)
  return 1 / (1 + power * 0.12)
}

export function isCommanderOnFront(state: SectorState, frontId: FrontId): boolean {
  return state.commander?.assignedFrontId === frontId
}

export function commanderControlCapacity(state: SectorState): number {
  return currentRank(state).controlCapacity
}

export function xpProgress(state: SectorState): {
  rank: RankDef
  next: RankDef | null
  xpIntoRank: number
  xpForNext: number
  ratio: number
  power: number
  controlCapacity: number
} {
  const commander = state.commander ?? createCommander()
  const rankIndex = commander.rankIndex
  const rank = RANKS[rankIndex]!
  const next = RANKS[rankIndex + 1] ?? null
  if (!next) {
    return {
      rank,
      next: null,
      xpIntoRank: 0,
      xpForNext: 0,
      ratio: 1,
      power: rank.power,
      controlCapacity: rank.controlCapacity,
    }
  }
  const xpIntoRank = Math.max(0, commander.xp - rank.xpRequired)
  const xpForNext = next.xpRequired - rank.xpRequired
  return {
    rank,
    next,
    xpIntoRank,
    xpForNext,
    ratio: xpForNext <= 0 ? 1 : Math.min(1, xpIntoRank / xpForNext),
    power: rank.power,
    controlCapacity: rank.controlCapacity,
  }
}

/** Grant XP and promote if thresholds crossed. */
export function grantXp(state: SectorState, at: number, amount: number, reason: string): void {
  if (amount <= 0 || state.status === 'fallen') return
  if (!state.commander) state.commander = createCommander()

  state.commander.xp += amount
  const before = state.commander.rankIndex
  const after = rankForXp(state.commander.xp)
  state.commander.rankIndex = after

  if (after > before) {
    for (let i = before + 1; i <= after; i++) {
      const rank = RANKS[i]!
      pushOpsLog(
        state,
        at,
        'rank',
        `Field promotion: ${rank.title} (Power ${rank.power}, ${rank.controlCapacity} hexes). ${reason}`,
        {
          rankTitle: rank.title,
          xp: state.commander.xp,
          power: rank.power,
          controlCapacity: rank.controlCapacity,
        },
      )
    }
  }
}

export function assignCommander(
  state: SectorState,
  frontId: FrontId | null,
): SectorState {
  if (frontId != null && !FRONT_IDS.includes(frontId)) return state
  const next = structuredClone(state)
  if (!next.commander) next.commander = createCommander(frontId)
  const prev = next.commander.assignedFrontId
  if (prev === frontId) return next
  next.commander.assignedFrontId = frontId
  const power = commanderPower(next)
  if (frontId == null) {
    pushOpsLog(
      next,
      next.lastSimAt,
      'command',
      `Commander withdrawn from the line (Power ${power}).`,
      { power },
    )
  } else {
    const name = next.fronts.find((f) => f.id === frontId)?.name ?? frontId
    pushOpsLog(
      next,
      next.lastSimAt,
      'command',
      `Commander deployed to ${name} (Power ${power}). The line stiffens.`,
      { frontId, power },
    )
  }
  return next
}
