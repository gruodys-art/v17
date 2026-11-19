import { commanderControlCapacity } from './commander'
import type { FrontId, SectorState } from './types'
import { FRONT_IDS } from './types'

/** Flat-top axial hex on the sector board. */
export type HexKind = 'hub' | FrontId | 'approach'

export interface TerritoryHex {
  q: number
  r: number
  kind: HexKind
  tag: string
  /**
   * Unlock order within a front (0 = core foothold).
   * Hub/approach ignore this.
   */
  order: number
}

/**
 * Compact foothold first — one hex per front beside the hub —
 * then outer rings unlock as commander control capacity rises.
 */
export const TERRITORY_HEXES: TerritoryHex[] = [
  { q: 0, r: 0, kind: 'hub', tag: 'CMD', order: 0 },

  // Northern Ridge (north of hub)
  { q: 0, r: -1, kind: 'north', tag: 'N1', order: 0 },
  { q: 0, r: -2, kind: 'north', tag: 'N2', order: 1 },
  { q: -1, r: -1, kind: 'north', tag: 'N3', order: 2 },
  { q: 1, r: -2, kind: 'north', tag: 'N4', order: 3 },

  // Hab Breach-7 (southwest)
  { q: -1, r: 1, kind: 'breach', tag: 'B1', order: 0 },
  { q: -2, r: 1, kind: 'breach', tag: 'B2', order: 1 },
  { q: -1, r: 2, kind: 'breach', tag: 'B3', order: 2 },
  { q: -2, r: 2, kind: 'breach', tag: 'B4', order: 3 },

  // Void Dock Spur (southeast)
  { q: 1, r: 0, kind: 'dock', tag: 'D1', order: 0 },
  { q: 2, r: -1, kind: 'dock', tag: 'D2', order: 1 },
  { q: 2, r: 0, kind: 'dock', tag: 'D3', order: 2 },
  { q: 1, r: 1, kind: 'dock', tag: 'D4', order: 3 },

  // Contested approaches (shown only when neighboring controlled hexes)
  { q: 1, r: -1, kind: 'approach', tag: '·', order: 0 },
  { q: -1, r: 0, kind: 'approach', tag: '·', order: 0 },
  { q: 0, r: 1, kind: 'approach', tag: '·', order: 0 },
]

const FRONT_HEXES: Record<FrontId, TerritoryHex[]> = {
  north: TERRITORY_HEXES.filter((h) => h.kind === 'north').sort((a, b) => a.order - b.order),
  breach: TERRITORY_HEXES.filter((h) => h.kind === 'breach').sort((a, b) => a.order - b.order),
  dock: TERRITORY_HEXES.filter((h) => h.kind === 'dock').sort((a, b) => a.order - b.order),
}

const MAX_HEXES_PER_FRONT = Math.max(
  ...FRONT_IDS.map((id) => FRONT_HEXES[id]!.length),
)

/** How many hexes each front holds under the current commander. */
export function controlledCountsByFront(state: SectorState): Record<FrontId, number> {
  const capacity = commanderControlCapacity(state)
  const assigned = state.commander?.assignedFrontId ?? null
  const counts: Record<FrontId, number> = { north: 0, breach: 0, dock: 0 }

  // Seed one foothold per front while capacity allows
  let remaining = capacity
  for (const id of FRONT_IDS) {
    if (remaining <= 0) break
    counts[id] = 1
    remaining--
  }

  // Extra span: assigned front first, then round-robin
  const priority: FrontId[] = assigned
    ? [assigned, ...FRONT_IDS.filter((id) => id !== assigned)]
    : [...FRONT_IDS]

  while (remaining > 0) {
    let placed = false
    for (const id of priority) {
      if (remaining <= 0) break
      if (counts[id] >= MAX_HEXES_PER_FRONT) continue
      counts[id]++
      remaining--
      placed = true
    }
    if (!placed) break
  }

  return counts
}

export function controlledFrontHexes(state: SectorState): TerritoryHex[] {
  const counts = controlledCountsByFront(state)
  const out: TerritoryHex[] = []
  for (const id of FRONT_IDS) {
    const n = counts[id]!
    out.push(...FRONT_HEXES[id]!.slice(0, n))
  }
  return out
}

function axialKey(q: number, r: number) {
  return `${q},${r}`
}

const AXIAL_NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
]

/** Hub + controlled front hexes + approaches touching controlled ground. */
export function visibleTerritoryHexes(state: SectorState): TerritoryHex[] {
  const controlled = controlledFrontHexes(state)
  const controlledKeys = new Set(controlled.map((h) => axialKey(h.q, h.r)))
  const hub = TERRITORY_HEXES.find((h) => h.kind === 'hub')!
  const approaches = TERRITORY_HEXES.filter((h) => {
    if (h.kind !== 'approach') return false
    return AXIAL_NEIGHBORS.some(([dq, dr]) =>
      controlledKeys.has(axialKey(h.q + dq, h.r + dr)),
    )
  })
  return [hub, ...controlled, ...approaches]
}

export function controlledHexCount(state: SectorState): number {
  return controlledFrontHexes(state).length
}
