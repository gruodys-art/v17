import {
  acknowledgeReport,
  assignCommander,
  FRONT_IDS,
  repairFront,
  restartSector,
  setAllocations,
  setGameSpeed,
  syncFromWall,
  type FrontId,
  type GameSpeed,
  type SectorState,
} from '../shared/sim/index.ts'
import { loadSector, saveSector } from './store.ts'

function mutate(fn: (state: SectorState, wallNow: number) => SectorState): SectorState {
  const wallNow = Date.now()
  const current = syncFromWall(loadSector(), wallNow)
  const next = fn(current, wallNow)
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
  const previous = loadSector()
  const next = restartSector(Date.now(), previous)
  saveSector(next)
  return next
}

export function commandSetSpeed(speed: GameSpeed): SectorState {
  return mutate((state, wallNow) => setGameSpeed(state, speed, wallNow))
}

export function commandAssignCommander(frontId: FrontId | null): SectorState {
  if (frontId != null && !FRONT_IDS.includes(frontId)) {
    throw new Error('invalid frontId')
  }
  return mutate((state) => assignCommander(state, frontId))
}
