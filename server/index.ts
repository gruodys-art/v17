import cors from 'cors'
import express from 'express'
import {
  commandAcknowledgeReport,
  commandAssignCommander,
  commandRepair,
  commandRestart,
  commandSetAllocations,
  commandSetSpeed,
  getSector,
} from './sectorService.ts'
import { FRONT_IDS, GAME_SPEEDS, type FrontId, type GameSpeed } from '../shared/sim/index.ts'

const PORT = Number(process.env.PORT ?? 8787)
const app = express()

app.use(cors({ origin: true }))
app.use(express.json({ limit: '32kb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'endless-war-api' })
})

/** Query: authoritative sector snapshot (catch-up applied). */
app.get('/api/sector', (_req, res) => {
  res.json(getSector())
})

/** Commands — all mutate after server-side catch-up. */
app.post('/api/sector/allocations', (req, res) => {
  const allocations = req.body?.allocations as Partial<Record<FrontId, number>> | undefined
  if (!allocations || typeof allocations !== 'object') {
    res.status(400).json({ error: 'allocations object required' })
    return
  }
  res.json(commandSetAllocations(allocations))
})

app.post('/api/sector/repair', (req, res) => {
  const frontId = req.body?.frontId as FrontId | undefined
  if (!frontId) {
    res.status(400).json({ error: 'frontId required' })
    return
  }
  res.json(commandRepair(frontId))
})

app.post('/api/sector/ack-report', (_req, res) => {
  res.json(commandAcknowledgeReport())
})

app.post('/api/sector/restart', (_req, res) => {
  res.json(commandRestart())
})

app.post('/api/sector/speed', (req, res) => {
  const speed = Number(req.body?.speed) as GameSpeed
  if (!(GAME_SPEEDS as readonly number[]).includes(speed)) {
    res.status(400).json({ error: `speed must be one of ${GAME_SPEEDS.join(', ')}` })
    return
  }
  try {
    res.json(commandSetSpeed(speed))
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'bad request' })
  }
})

app.post('/api/sector/assign', (req, res) => {
  const frontId = req.body?.frontId as FrontId | null | undefined
  if (frontId != null && !FRONT_IDS.includes(frontId)) {
    res.status(400).json({ error: `frontId must be one of ${FRONT_IDS.join(', ')}` })
    return
  }
  try {
    res.json(commandAssignCommander(frontId ?? null))
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'bad request' })
  }
})

app.listen(PORT, () => {
  console.log(`Endless War API on http://127.0.0.1:${PORT}`)
})
