# Endless War

Browser/mobile hybrid: semi-idle sector defense in a Warhammer 40,000–inspired grimdark setting. You hold one sector under constant attack — allocate commitment across fronts, survive assaults, and return to an after-action report when you’ve been away.

The **API owns all simulation** (ticks, catch-up, persistence). The frontend only displays snapshots and posts commands.

## Requirements

- [Node.js](https://nodejs.org/) 20+ (LTS recommended)
- npm (comes with Node)

## Launch

```bash
npm install
npm run dev
```

That starts:

| Service | URL |
|---------|-----|
| Game UI (Vite) | http://127.0.0.1:5173 |
| API | http://127.0.0.1:8787 |

Open the UI URL in your browser. Vite proxies `/api` to the server, so you only need the client address for play.

### Run pieces separately

```bash
npm run dev:server   # API only → :8787
npm run dev:client   # UI only  → :5173 (needs API running)
```

### Production-style build

```bash
npm run build
npm run start:server   # API must be running for the client to load sector state
npm run preview        # serves the built UI (still proxies/needs API for data)
```

## Useful commands

| Command | What it does |
|---------|----------------|
| `npm run dev` | API + UI together (usual play loop) |
| `npm test` | Sim unit tests |
| `npm run build` | Typecheck + production UI bundle |

## Project layout

```
shared/sim/   Authoritative war math (ticks, catch-up, commands)
server/       Express API + data/sector.json persistence
src/          React client (theater, hex map, commands)
```

## Notes

- Sector save file: `data/sector.json` (created on first API start).
- After-action (“While you were gone”) appears after **≥ 30 minutes** of simulated absence.
- Assaults every **5–10 minutes**; every **5th–10th** wave is devastating.
- Soldier economy starts at **conscripts** only (higher grades later).
- **Commander** progression: XP → ranks → **Power** + **hex control**. Start with a 3-hex foothold; higher ranks hold more ground. Deploy the commander to one front to harden that line (extra hexes prefer the posted front).
- Game speed: **1× / 10× / 50× / 100× / 500×** (server sim clock; war runs faster than wall time).
- Older saves migrate when possible; incompatible schemas reset `data/sector.json`.

Unofficial fan project; Warhammer 40,000 is owned by Games Workshop.
