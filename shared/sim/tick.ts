import { createSector } from './createSector'
import type {
  AssaultEvent,
  Front,
  FrontId,
  SectorState,
  TickReport,
} from './types'
import { SIM } from './types'

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function emptyReport(): TickReport {
  return {
    minutes: 0,
    manpowerDelta: 0,
    munitionsDelta: 0,
    moraleDelta: 0,
    integrityDeltas: { north: 0, breach: 0, dock: 0 },
    assaults: [],
  }
}

function mergeReports(a: TickReport | null, b: TickReport): TickReport {
  if (!a) {
    return {
      ...b,
      integrityDeltas: { ...b.integrityDeltas },
      assaults: [...b.assaults],
    }
  }
  return {
    minutes: a.minutes + b.minutes,
    manpowerDelta: a.manpowerDelta + b.manpowerDelta,
    munitionsDelta: a.munitionsDelta + b.munitionsDelta,
    moraleDelta: a.moraleDelta + b.moraleDelta,
    integrityDeltas: {
      north: a.integrityDeltas.north + b.integrityDeltas.north,
      breach: a.integrityDeltas.breach + b.integrityDeltas.breach,
      dock: a.integrityDeltas.dock + b.integrityDeltas.dock,
    },
    assaults: [...a.assaults, ...b.assaults],
  }
}

function normalizeAllocations(fronts: Front[]): Front[] {
  const sum = fronts.reduce((s, f) => s + f.allocation, 0)
  if (sum <= 0) {
    const even = 1 / fronts.length
    return fronts.map((f) => ({ ...f, allocation: even }))
  }
  return fronts.map((f) => ({ ...f, allocation: f.allocation / sum }))
}

function pickAssaultFront(fronts: Front[]): FrontId {
  let best = fronts[0]!
  for (const f of fronts) {
    const score = f.pressure * (1.2 - f.allocation) + (100 - f.integrity) * 0.02
    const bestScore =
      best.pressure * (1.2 - best.allocation) + (100 - best.integrity) * 0.02
    if (score > bestScore) best = f
  }
  return best.id
}

function applyAssault(state: SectorState, at: number): AssaultEvent {
  const frontId = pickAssaultFront(state.fronts)
  const front = state.fronts.find((f) => f.id === frontId)!
  const supplyFactor = clamp(
    (state.stockpile.manpower / 80 + state.stockpile.munitions / 120) / 2,
    0.15,
    1.4,
  )
  const integrityLoss =
    (SIM.assaultIntegrityHit * (1.15 - front.allocation * 0.5)) / supplyFactor
  const manpowerLoss = SIM.assaultManpowerHit * (1.1 - front.allocation * 0.4)
  const munitionsLoss = SIM.assaultMunitionsHit * (1.1 - front.allocation * 0.4)

  front.integrity = clamp(front.integrity - integrityLoss, 0, 100)
  state.stockpile.manpower = Math.max(0, state.stockpile.manpower - manpowerLoss)
  state.stockpile.munitions = Math.max(0, state.stockpile.munitions - munitionsLoss)
  state.stockpile.morale = clamp(state.stockpile.morale - 6 / supplyFactor, 0, 100)

  const survived = state.fronts.every((f) => f.integrity > SIM.fallIntegrityThreshold)

  state.assaultIndex += 1
  state.nextAssaultAt = at + SIM.assaultIntervalMs

  return {
    at,
    frontId,
    survived,
    integrityLoss: round1(integrityLoss),
    manpowerLoss: round1(manpowerLoss),
    munitionsLoss: round1(munitionsLoss),
  }
}

/** Advance simulation by exactly one minute of game time ending at `endAt`. */
export function tickMinute(state: SectorState, endAt: number): TickReport {
  if (state.status === 'fallen') return emptyReport()

  const report = emptyReport()
  report.minutes = 1

  const fronts = normalizeAllocations(state.fronts)
  state.fronts = fronts

  const manGain = SIM.manpowerIncomePerMin
  const munGain = SIM.munitionsIncomePerMin
  let morGain = SIM.moraleIncomePerMin * (state.stockpile.morale < 40 ? 0.5 : 1)

  let manSpend = 0
  let munSpend = 0

  for (const front of fronts) {
    const committed = Math.max(front.allocation, 0.05)
    const neededMun = front.pressure * SIM.munitionsPerPressure
    const neededMan = front.pressure * SIM.manpowerPerPressure
    const fed = clamp(
      Math.min(
        state.stockpile.munitions / Math.max(neededMun, 0.01),
        state.stockpile.manpower / Math.max(neededMan, 0.01),
        committed / 0.35,
      ),
      0,
      1.5,
    )

    munSpend += neededMun * committed
    manSpend += neededMan * committed

    const starve = 1 - clamp(fed, 0, 1)
    let integrityLoss =
      SIM.integrityStarvePerMin * starve * (0.6 + front.pressure * 0.15)
    if (state.stockpile.munitions <= 0 || state.stockpile.manpower <= 0) {
      integrityLoss *= SIM.emptyStockpileIntegrityMult
    }
    const repair = fed > 1 ? 0.08 * (fed - 1) : 0
    const delta = repair - integrityLoss
    front.integrity = clamp(front.integrity + delta, 0, 100)
    report.integrityDeltas[front.id] += round1(delta)
  }

  const manBefore = state.stockpile.manpower
  const munBefore = state.stockpile.munitions
  const morBefore = state.stockpile.morale

  state.stockpile.manpower = Math.max(0, manBefore + manGain - manSpend)
  state.stockpile.munitions = Math.max(0, munBefore + munGain - munSpend)

  const avgIntegrity =
    fronts.reduce((s, f) => s + f.integrity, 0) / Math.max(fronts.length, 1)
  if (avgIntegrity < 40) morGain -= 0.25
  if (avgIntegrity < 25) morGain -= 0.35
  state.stockpile.morale = clamp(morBefore + morGain, 0, 100)

  report.manpowerDelta = round1(state.stockpile.manpower - manBefore)
  report.munitionsDelta = round1(state.stockpile.munitions - munBefore)
  report.moraleDelta = round1(state.stockpile.morale - morBefore)

  if (endAt >= state.nextAssaultAt) {
    const assault = applyAssault(state, state.nextAssaultAt)
    report.assaults.push(assault)
    if (!assault.survived) state.status = 'fallen'
  }

  const anyZero = state.fronts.some((f) => f.integrity <= SIM.fallIntegrityThreshold)
  if (anyZero && state.fronts.every((f) => f.integrity <= 5)) {
    state.status = 'fallen'
  }

  state.lastSimAt = endAt
  return report
}

export function catchUp(state: SectorState, now: number): SectorState {
  if (state.status === 'fallen') {
    return { ...state, lastSimAt: Math.max(state.lastSimAt, now) }
  }

  const maxMs = SIM.maxCatchUpHours * 60 * 60 * 1000
  const from = state.lastSimAt
  const target = Math.min(now, from + maxMs)
  if (target <= from) return state

  const next: SectorState = structuredClone(state)
  let report = emptyReport()
  const stepMs = SIM.tickMinutes * 60 * 1000
  let t = from

  while (t + stepMs <= target) {
    t += stepMs
    const slice = tickMinute(next, t)
    report = mergeReports(report, slice)
    if (next.status === 'fallen') break
  }

  next.pendingReport = mergeReports(next.pendingReport, report)
  return next
}

export function setAllocations(
  state: SectorState,
  allocations: Partial<Record<FrontId, number>>,
): SectorState {
  const next = structuredClone(state)
  next.fronts = next.fronts.map((f) => ({
    ...f,
    allocation: allocations[f.id] ?? f.allocation,
  }))
  next.fronts = normalizeAllocations(next.fronts)
  return next
}

export function repairFront(state: SectorState, frontId: FrontId): SectorState {
  if (state.status === 'fallen') return state
  const next = structuredClone(state)
  const front = next.fronts.find((f) => f.id === frontId)
  if (!front) return state
  if (
    next.stockpile.manpower < SIM.repairIntegrityCostManpower ||
    next.stockpile.munitions < SIM.repairIntegrityCostMunitions
  ) {
    return state
  }
  next.stockpile.manpower -= SIM.repairIntegrityCostManpower
  next.stockpile.munitions -= SIM.repairIntegrityCostMunitions
  front.integrity = clamp(front.integrity + SIM.repairIntegrityAmount, 0, 100)
  return next
}

export function acknowledgeReport(state: SectorState): SectorState {
  return { ...state, pendingReport: null }
}

export function restartSector(now = Date.now()): SectorState {
  return createSector(now)
}

/** Resolve N minutes of war, then re-anchor clocks to wall time `now`. */
export function advanceMinutes(
  state: SectorState,
  minutes: number,
  now = Date.now(),
): SectorState {
  const synced = catchUp(state, now)
  const end = synced.lastSimAt + minutes * 60_000
  const advanced = catchUp(synced, end)
  const assaultRemaining = Math.max(0, advanced.nextAssaultAt - end)
  return {
    ...advanced,
    lastSimAt: now,
    nextAssaultAt: now + assaultRemaining,
  }
}
