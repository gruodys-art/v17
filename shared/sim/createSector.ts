import { createCommander, RANKS } from './commander'
import { pushOpsLog } from './opsLog'
import type { Commander, SectorState } from './types'
import { rollAssaultDelayMs, rollDevastatingGap } from './types'

export function createSector(now = Date.now(), commander?: Commander): SectorState {
  const state: SectorState = {
    version: 3,
    designation: 'Kallis-IV · Outer Hab Rim',
    status: 'holding',
    stockpile: {
      conscripts: 420,
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
    lastWallAt: now,
    gameSpeed: 1,
    assaultCycleStartedAt: now,
    nextAssaultAt: now + rollAssaultDelayMs(),
    assaultIndex: 0,
    nextDevastatingAtIndex: rollDevastatingGap(),
    pendingReport: null,
    opsLog: [],
    reinforcementAccrued: 0,
    reinforcementMinutes: 0,
    commander: commander ? { ...commander } : createCommander(),
  }

  const rank = RANKS[state.commander.rankIndex]
  const rankTitle = rank && state.commander.rankIndex > 0 ? ` (${rank.title})` : ''
  pushOpsLog(
    state,
    now,
    'status',
    `Command assumed${rankTitle}. Sector under greenskin pressure — hold the rim.`,
  )
  return state
}
