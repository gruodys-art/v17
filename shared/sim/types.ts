export type FrontId = 'north' | 'breach' | 'dock'

export interface Front {
  id: FrontId
  name: string
  /** Enemy pressure per minute at baseline */
  pressure: number
  /** 0–100 wall / line integrity */
  integrity: number
  /** Share of conscript commitment, 0–1; fronts should sum ~1 */
  allocation: number
}

/** Lowest soldier tier for now; higher grades come later. */
export interface Stockpile {
  conscripts: number
  morale: number
}

export type SectorStatus = 'holding' | 'fallen'

export interface AssaultEvent {
  at: number
  frontId: FrontId
  survived: boolean
  devastating: boolean
  integrityLoss: number
  soldiersLost: number
}

export interface TickReport {
  minutes: number
  soldiersDelta: number
  moraleDelta: number
  integrityDeltas: Record<FrontId, number>
  assaults: AssaultEvent[]
}

export type GameSpeed = 1 | 10 | 50 | 100 | 500

export type OpsLogKind =
  | 'assault'
  | 'outcome'
  | 'reinforcements'
  | 'repair'
  | 'fallen'
  | 'command'
  | 'status'
  | 'rank'

export interface OpsLogEntry {
  id: string
  /** Sim-clock timestamp (ms) */
  at: number
  kind: OpsLogKind
  message: string
  meta?: {
    frontId?: FrontId
    devastating?: boolean
    survived?: boolean
    integrityLoss?: number
    soldiersLost?: number
    conscripts?: number
    speed?: GameSpeed
    rankTitle?: string
    xp?: number
    power?: number
    controlCapacity?: number
  }
}

export interface RankDef {
  id: string
  title: string
  xpRequired: number
  /** Combat power — strengthens only the front the commander is assigned to */
  power: number
  /** Max front hexes this rank can hold under control */
  controlCapacity: number
}

/** Player-as-officer progression (persists across sector reassignment). */
export interface Commander {
  callsign: string
  xp: number
  rankIndex: number
  /** Front currently led in person; null = not on the line */
  assignedFrontId: FrontId | null
}

export interface SectorState {
  version: 3
  designation: string
  status: SectorStatus
  stockpile: Stockpile
  fronts: Front[]
  /** Last authoritative sim timestamp (ms, game clock) */
  lastSimAt: number
  /** Wall clock when lastSimAt was last synced */
  lastWallAt: number
  /** Sim minutes advance this many times faster than wall time */
  gameSpeed: GameSpeed
  /** Next scheduled assault timestamp (ms, game clock) */
  nextAssaultAt: number
  /** When the current assault countdown started (ms, game clock) */
  assaultCycleStartedAt: number
  assaultIndex: number
  /** When assaultIndex reaches this, the next assault is devastating */
  nextDevastatingAtIndex: number
  /** Accumulated since last player-seen report */
  pendingReport: TickReport | null
  /** Newest-first operations log */
  opsLog: OpsLogEntry[]
  /** Conscript income accrued toward next reinforcements log line */
  reinforcementAccrued: number
  /** Sim minutes since last reinforcements log flush */
  reinforcementMinutes: number
  /** Hero / officer progression */
  commander: Commander
}

export const GAME_SPEEDS: GameSpeed[] = [1, 10, 50, 100, 500]

export const FRONT_IDS: FrontId[] = ['north', 'breach', 'dock']

export const SIM = {
  tickMinutes: 1,
  maxCatchUpHours: 12,
  conscriptsIncomePerMin: 2.0,
  moraleIncomePerMin: 0.15,
  /** Conscripts burned per pressure-point per minute when fully allocated */
  conscriptsPerPressure: 0.55,
  /** Integrity loss/min when a front is starved (allocation near 0) */
  integrityStarvePerMin: 0.35,
  /** Integrity loss multiplier when stockpiles empty */
  emptyStockpileIntegrityMult: 2.2,
  repairIntegrityCostConscripts: 10,
  repairIntegrityAmount: 8,
  /** Normal assault cadence: 5–10 minutes */
  assaultIntervalMinMinutes: 5,
  assaultIntervalMaxMinutes: 10,
  assaultIntegrityHit: 12,
  assaultSoldiersHit: 35,
  /** Every Nth assault (rolled 5–10) is devastating */
  devastatingEveryMin: 5,
  devastatingEveryMax: 10,
  devastatingIntegrityMult: 2.4,
  devastatingSoldiersMult: 2.2,
  devastatingMoraleHit: 14,
  fallIntegrityThreshold: 0,
  criticalIntegrity: 15,
  /** After-action modal only once catch-up reaches this many minutes */
  reportMinMinutes: 30,
  gameSpeeds: [1, 10, 50, 100, 500] as const,
  /** Cap stored operations log entries */
  opsLogMax: 80,
  /** Flush reinforcement arrivals to the log this often (sim minutes) */
  reinforcementLogEveryMinutes: 10,
  /** XP while holding the sector each sim minute */
  xpPerMinuteHeld: 1,
  /** XP for surviving a normal / devastating assault */
  xpSurviveAssault: 28,
  xpSurviveDevastating: 70,
  /** XP for successful repair order */
  xpRepair: 4,
} as const

export function rollAssaultDelayMs(rng: () => number = Math.random): number {
  const min = SIM.assaultIntervalMinMinutes
  const max = SIM.assaultIntervalMaxMinutes
  const minutes = min + Math.floor(rng() * (max - min + 1))
  return minutes * 60_000
}

export function rollDevastatingGap(rng: () => number = Math.random): number {
  const min = SIM.devastatingEveryMin
  const max = SIM.devastatingEveryMax
  return min + Math.floor(rng() * (max - min + 1))
}
