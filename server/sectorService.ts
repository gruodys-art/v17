import {
  acknowledgeReport,
  advanceMinutes,
  catchUp,
  repairFront,
  restartSector,
  setAllocations,
  type FrontId,
  type SectorState,
} from '../shared/sim/index.ts'
import { loadSector, saveSector } from './store.ts'

function mutate(fn: (state: SectorState, now: number) => SectorState): SectorState {
  const now = Date.now()
  const current = catchUp(loadSector(), now)
  const next = fn(current, now)
  saveSector(next)
  return next
}

export function getSector(): SectorState {
  return mutate((state) => state)
}

export function commandSetAllocations(
  allocations: Partial<Record<FrontId, number>>,
): SectorState {
  return mutate((state) => setAllocations(state, allocations))
}

export function commandRepair(frontId: FrontId): SectorState {
  return mutate((state) => repairFront(state, frontId))
}

export function commandAcknowledgeReport(): SectorState {
  return mutate((state) => acknowledgeReport(state))
}

export function commandRestart(): SectorState {
  const next = restartSector(Date.now())
  saveSector(next)
  return next
}

export function commandAdvance(minutes: number): SectorState {
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 24 * 60) {
    throw new Error('minutes must be between 1 and 1440')
  }
  return mutate((state, now) => advanceMinutes(state, minutes, now))
}
