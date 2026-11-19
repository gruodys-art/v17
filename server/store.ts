import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createCommander,
  createSector,
  GAME_SPEEDS,
  type GameSpeed,
  type SectorState,
} from '../shared/sim/index.ts'

function normalizeSpeed(speed: unknown): GameSpeed {
  return (GAME_SPEEDS as readonly number[]).includes(speed as number)
    ? (speed as GameSpeed)
    : 1
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = join(root, 'data')
const savePath = join(dataDir, 'sector.json')

function migrate(raw: unknown): SectorState | null {
  if (!raw || typeof raw !== 'object') return null
  const parsed = raw as SectorState & { version?: number }

  if (parsed.version === 3 && parsed.stockpile && 'conscripts' in parsed.stockpile) {
    const maxGap = 10 * 60_000
    return {
      ...parsed,
      lastWallAt: parsed.lastWallAt ?? parsed.lastSimAt,
      gameSpeed: normalizeSpeed(parsed.gameSpeed),
      assaultCycleStartedAt:
        parsed.assaultCycleStartedAt ??
        Math.max(parsed.lastSimAt - maxGap, parsed.nextAssaultAt - maxGap),
      opsLog: parsed.opsLog ?? [],
      reinforcementAccrued: parsed.reinforcementAccrued ?? 0,
      reinforcementMinutes: parsed.reinforcementMinutes ?? 0,
      commander: parsed.commander
        ? {
            ...createCommander(),
            ...parsed.commander,
            assignedFrontId: parsed.commander.assignedFrontId ?? 'breach',
          }
        : createCommander(),
    }
  }

  // v2 conscript economy without speed clock
  if (parsed.version === 2 && parsed.stockpile && 'conscripts' in parsed.stockpile) {
    const maxGap = 10 * 60_000
    return {
      ...parsed,
      version: 3,
      lastWallAt: parsed.lastSimAt,
      gameSpeed: 1,
      assaultCycleStartedAt: Math.max(
        parsed.lastSimAt - maxGap,
        parsed.nextAssaultAt - maxGap,
      ),
      opsLog: [],
      reinforcementAccrued: 0,
      reinforcementMinutes: 0,
      commander: createCommander(),
    }
  }

  return null
}

export function loadSector(): SectorState {
  if (!existsSync(savePath)) {
    const fresh = createSector(Date.now())
    saveSector(fresh)
    return fresh
  }
  try {
    const parsed = JSON.parse(readFileSync(savePath, 'utf8')) as unknown
    const migrated = migrate(parsed)
    if (!migrated) {
      const fresh = createSector(Date.now())
      saveSector(fresh)
      return fresh
    }
    if ((parsed as { version?: number }).version !== 3) {
      saveSector(migrated)
    }
    return migrated
  } catch {
    const fresh = createSector(Date.now())
    saveSector(fresh)
    return fresh
  }
}

export function saveSector(state: SectorState): void {
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(savePath, JSON.stringify(state, null, 2), 'utf8')
}
