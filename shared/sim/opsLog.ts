import type { OpsLogEntry, OpsLogKind, SectorState } from './types'
import { SIM } from './types'

let seq = 0

export function pushOpsLog(
  state: SectorState,
  at: number,
  kind: OpsLogKind,
  message: string,
  meta?: OpsLogEntry['meta'],
): void {
  seq += 1
  const entry: OpsLogEntry = {
    id: `${at}-${seq}`,
    at,
    kind,
    message,
    ...(meta ? { meta } : {}),
  }
  const next = [entry, ...(state.opsLog ?? [])]
  state.opsLog = next.slice(0, SIM.opsLogMax)
}

export function frontLabel(state: SectorState, frontId: string): string {
  return state.fronts.find((f) => f.id === frontId)?.name ?? frontId
}
