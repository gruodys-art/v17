import type { SectorState } from './types'
import { SIM } from './types'

export function createSector(now = Date.now()): SectorState {
  return {
    version: 1,
    designation: 'Kallis-IV · Outer Hab Rim',
    status: 'holding',
    stockpile: {
      manpower: 180,
      munitions: 320,
      morale: 72,
    },
    fronts: [
      {
        id: 'north',
        name: 'Northern Ridge',
        pressure: 3.2,
        integrity: 78,
        allocation: 0.4,
      },
      {
        id: 'breach',
        name: 'Hab Breach-7',
        pressure: 4.5,
        integrity: 55,
        allocation: 0.4,
      },
      {
        id: 'dock',
        name: 'Void Dock Spur',
        pressure: 2.1,
        integrity: 86,
        allocation: 0.2,
      },
    ],
    lastSimAt: now,
    nextAssaultAt: now + SIM.assaultIntervalMs,
    assaultIndex: 0,
    pendingReport: null,
  }
}
