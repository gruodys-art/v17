import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSector, type SectorState } from '../shared/sim/index.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = join(root, 'data')
const savePath = join(dataDir, 'sector.json')

export function loadSector(): SectorState {
  if (!existsSync(savePath)) {
    const fresh = createSector(Date.now())
    saveSector(fresh)
    return fresh
  }
  try {
    const parsed = JSON.parse(readFileSync(savePath, 'utf8')) as SectorState
    if (parsed?.version !== 1) throw new Error('bad version')
    return parsed
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
