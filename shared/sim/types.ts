export type FrontId = 'north' | 'breach' | 'dock'

export interface Front {
  id: FrontId
  name: string
  /** Enemy pressure per minute at baseline */
  pressure: number
  /** 0–100 wall / line integrity */
  integrity: number
  /** Share of manpower+munitions commitment, 0–1; fronts should sum ~1 */
  allocation: number
}

export interface Stockpile {
  manpower: number
  munitions: number
  morale: number
}

export type SectorStatus = 'holding' | 'fallen'

export interface AssaultEvent {
  at: number
  frontId: FrontId
  survived: boolean
  integrityLoss: number
  manpowerLoss: number
  munitionsLoss: number
}

export interface TickReport {
  minutes: number
  manpowerDelta: number
  munitionsDelta: number
  moraleDelta: number
  integrityDeltas: Record<FrontId, number>
  assaults: AssaultEvent[]
}

export interface SectorState {
  version: 1
  designation: string
  status: SectorStatus
  stockpile: Stockpile
  fronts: Front[]
  /** Last authoritative sim timestamp (ms) */
  lastSimAt: number
  /** Next scheduled assault timestamp (ms) */
  nextAssaultAt: number
  assaultIndex: number
  /** Accumulated since last player-seen report */
  pendingReport: TickReport | null
}

export const FRONT_IDS: FrontId[] = ['north', 'breach', 'dock']

export const SIM = {
  tickMinutes: 1,
  maxCatchUpHours: 12,
  manpowerIncomePerMin: 1.2,
  munitionsIncomePerMin: 2.4,
  moraleIncomePerMin: 0.15,
  /** Munitions burned per pressure-point per minute when fully allocated */
  munitionsPerPressure: 0.55,
  manpowerPerPressure: 0.22,
  /** Integrity loss/min when a front is starved (allocation near 0) */
  integrityStarvePerMin: 0.35,
  /** Integrity loss multiplier when stockpiles empty */
  emptyStockpileIntegrityMult: 2.2,
  repairIntegrityCostManpower: 4,
  repairIntegrityCostMunitions: 8,
  repairIntegrityAmount: 8,
  assaultIntervalMs: 45 * 60 * 1000,
  assaultIntegrityHit: 12,
  assaultManpowerHit: 25,
  assaultMunitionsHit: 40,
  fallIntegrityThreshold: 0,
  /** If average integrity below this after assault and stockpiles dry → fall */
  criticalIntegrity: 15,
  /** After-action modal only once catch-up reaches this many minutes */
  reportMinMinutes: 30,
} as const
