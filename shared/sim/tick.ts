import { commandHoldMult, commanderPower, grantXp, isCommanderOnFront } from './commander'
import { createSector } from './createSector'
import { frontLabel, pushOpsLog } from './opsLog'
import type {
  AssaultEvent,
  Front,
  FrontId,
  GameSpeed,
  SectorState,
  TickReport,
} from './types'
import {
  GAME_SPEEDS,
  rollAssaultDelayMs,
  rollDevastatingGap,
  SIM,
} from './types'

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function emptyReport(): TickReport {
  return {
    minutes: 0,
    soldiersDelta: 0,
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
    soldiersDelta: a.soldiersDelta + b.soldiersDelta,
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
  const devastating = state.assaultIndex + 1 >= state.nextDevastatingAtIndex
  const supplyFactor = clamp(state.stockpile.conscripts / 100, 0.15, 1.4)
  const holdMult = commandHoldMult(state, frontId)

  let integrityLoss =
    (SIM.assaultIntegrityHit * (1.15 - front.allocation * 0.5)) / supplyFactor
  let soldiersLost = SIM.assaultSoldiersHit * (1.1 - front.allocation * 0.4)
  let moraleHit = 6 / supplyFactor

  if (devastating) {
    integrityLoss *= SIM.devastatingIntegrityMult
    soldiersLost *= SIM.devastatingSoldiersMult
    moraleHit = SIM.devastatingMoraleHit / supplyFactor
  }

  // Commander power only hardens the front they are assigned to
  integrityLoss *= holdMult
  soldiersLost *= holdMult
  moraleHit *= holdMult

  front.integrity = clamp(front.integrity - integrityLoss, 0, 100)
  state.stockpile.conscripts = Math.max(0, state.stockpile.conscripts - soldiersLost)
  state.stockpile.morale = clamp(state.stockpile.morale - moraleHit, 0, 100)

  const survived = state.fronts.every((f) => f.integrity > SIM.fallIntegrityThreshold)

  state.assaultIndex += 1
  state.assaultCycleStartedAt = at
  state.nextAssaultAt = at + rollAssaultDelayMs()
  if (devastating) {
    state.nextDevastatingAtIndex = state.assaultIndex + rollDevastatingGap()
  }

  const lossI = round1(integrityLoss)
  const lossS = round1(soldiersLost)
  const name = frontLabel(state, frontId)
  const wave = devastating ? 'Devastating assault' : 'Assault'
  pushOpsLog(
    state,
    at,
    'assault',
    `${wave} hits ${name}. Enemy presses the line.`,
    { frontId, devastating },
  )
  pushOpsLog(
    state,
    at,
    'outcome',
    survived
      ? `Battle outcome: ${name} held. Line −${lossI}, conscripts −${lossS}.`
      : `Battle outcome: ${name} broken. Line −${lossI}, conscripts −${lossS}. Sector collapsing.`,
    {
      frontId,
      devastating,
      survived,
      integrityLoss: lossI,
      soldiersLost: lossS,
    },
  )

  if (survived) {
    grantXp(
      state,
      at,
      devastating ? SIM.xpSurviveDevastating : SIM.xpSurviveAssault,
      devastating ? 'A devastating wave broken.' : 'Another wave broken.',
    )
  }

  return {
    at,
    frontId,
    survived,
    devastating,
    integrityLoss: lossI,
    soldiersLost: lossS,
  }
}

/** Advance simulation by exactly one minute of game time ending at `endAt`. */
export function tickMinute(state: SectorState, endAt: number): TickReport {
  if (state.status === 'fallen') return emptyReport()

  const report = emptyReport()
  report.minutes = 1

  const fronts = normalizeAllocations(state.fronts)
  state.fronts = fronts

  const soldierGain = SIM.conscriptsIncomePerMin
  let morGain = SIM.moraleIncomePerMin * (state.stockpile.morale < 40 ? 0.5 : 1)

  let soldierSpend = 0

  for (const front of fronts) {
    const committed = Math.max(front.allocation, 0.05)
    const needed = front.pressure * SIM.conscriptsPerPressure
    const fed = clamp(
      Math.min(
        state.stockpile.conscripts / Math.max(needed, 0.01),
        committed / 0.35,
      ),
      0,
      1.5,
    )

    soldierSpend += needed * committed

    const starve = 1 - clamp(fed, 0, 1)
    let integrityLoss =
      SIM.integrityStarvePerMin * starve * (0.6 + front.pressure * 0.15)
    if (state.stockpile.conscripts <= 0) {
      integrityLoss *= SIM.emptyStockpileIntegrityMult
    }
    integrityLoss *= commandHoldMult(state, front.id)
    let repair = fed > 1 ? 0.08 * (fed - 1) : 0
    if (isCommanderOnFront(state, front.id)) {
      repair += commanderPower(state) * 0.04
    }
    const delta = repair - integrityLoss
    front.integrity = clamp(front.integrity + delta, 0, 100)
    report.integrityDeltas[front.id] += round1(delta)
  }

  const soldiersBefore = state.stockpile.conscripts
  const morBefore = state.stockpile.morale

  state.stockpile.conscripts = Math.max(0, soldiersBefore + soldierGain - soldierSpend)

  const avgIntegrity =
    fronts.reduce((s, f) => s + f.integrity, 0) / Math.max(fronts.length, 1)
  if (avgIntegrity < 40) morGain -= 0.25
  if (avgIntegrity < 25) morGain -= 0.35
  state.stockpile.morale = clamp(morBefore + morGain, 0, 100)

  report.soldiersDelta = round1(state.stockpile.conscripts - soldiersBefore)
  report.moraleDelta = round1(state.stockpile.morale - morBefore)

  grantXp(state, endAt, SIM.xpPerMinuteHeld, 'Hours on the line.')

  state.reinforcementAccrued = (state.reinforcementAccrued ?? 0) + soldierGain
  state.reinforcementMinutes = (state.reinforcementMinutes ?? 0) + 1
  if (state.reinforcementMinutes >= SIM.reinforcementLogEveryMinutes) {
    const arrived = round1(state.reinforcementAccrued)
    if (arrived > 0) {
      pushOpsLog(
        state,
        endAt,
        'reinforcements',
        `Reinforcements arriving: +${arrived} conscripts from the rear echelons.`,
        { conscripts: arrived },
      )
    }
    state.reinforcementAccrued = 0
    state.reinforcementMinutes = 0
  }

  if (endAt >= state.nextAssaultAt) {
    const assault = applyAssault(state, state.nextAssaultAt)
    report.assaults.push(assault)
    if (!assault.survived) {
      state.status = 'fallen'
      pushOpsLog(
        state,
        endAt,
        'fallen',
        'Sector fallen. The Administratum will assign another corpse to this desk.',
      )
    }
  }

  const anyZero = state.fronts.some((f) => f.integrity <= SIM.fallIntegrityThreshold)
  if (
    state.status !== 'fallen' &&
    anyZero &&
    state.fronts.every((f) => f.integrity <= 5)
  ) {
    state.status = 'fallen'
    pushOpsLog(
      state,
      endAt,
      'fallen',
      'Sector fallen. All fronts reduced to ruin.',
    )
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
  if (front.integrity >= 100) return state
  if (next.stockpile.conscripts < SIM.repairIntegrityCostConscripts) {
    return state
  }
  const repairAmount =
    SIM.repairIntegrityAmount +
    (isCommanderOnFront(next, frontId) ? commanderPower(next) : 0)
  next.stockpile.conscripts -= SIM.repairIntegrityCostConscripts
  front.integrity = clamp(front.integrity + repairAmount, 0, 100)
  pushOpsLog(
    next,
    next.lastSimAt,
    'repair',
    `Work gangs shore up ${front.name}: +${repairAmount} integrity (−${SIM.repairIntegrityCostConscripts} conscripts).`,
    { frontId, conscripts: SIM.repairIntegrityCostConscripts },
  )
  grantXp(next, next.lastSimAt, SIM.xpRepair, 'Fortifications renewed.')
  return next
}

export function acknowledgeReport(state: SectorState): SectorState {
  return { ...state, pendingReport: null }
}

export function restartSector(now = Date.now(), previous?: SectorState): SectorState {
  // Commander XP and rank persist — only the dirt changes.
  return createSector(now, previous?.commander)
}

/** Current game-clock time given wall clock and speed. */
export function estimateSimNow(state: SectorState, wallNow = Date.now()): number {
  const speed = state.gameSpeed || 1
  const lastWall = state.lastWallAt ?? state.lastSimAt
  return state.lastSimAt + Math.max(0, wallNow - lastWall) * speed
}

/** Apply wall-time elapsed × gameSpeed onto the sim clock, then catch up ticks. */
export function syncFromWall(state: SectorState, wallNow = Date.now()): SectorState {
  const simTarget = estimateSimNow(state, wallNow)
  const next = catchUp(state, simTarget)
  return {
    ...next,
    lastWallAt: wallNow,
    gameSpeed: (GAME_SPEEDS as readonly number[]).includes(next.gameSpeed)
      ? next.gameSpeed
      : 1,
  }
}

export function setGameSpeed(
  state: SectorState,
  speed: GameSpeed,
  wallNow = Date.now(),
): SectorState {
  if (!(GAME_SPEEDS as readonly number[]).includes(speed)) {
    throw new Error(`speed must be one of ${GAME_SPEEDS.join(', ')}`)
  }
  const synced = syncFromWall(state, wallNow)
  if (synced.gameSpeed === speed) {
    return { ...synced, lastWallAt: wallNow }
  }
  pushOpsLog(
    synced,
    synced.lastSimAt,
    'command',
    `Chronometers reset — war tempo now ${speed}×.`,
    { speed },
  )
  return { ...synced, gameSpeed: speed, lastWallAt: wallNow }
}
