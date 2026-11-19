import { useEffect, useMemo, useState } from 'react'
import type { FrontId, GameSpeed, SectorState } from '@shared/sim'
import { estimateSimNow, GAME_SPEEDS, SIM } from '@shared/sim'
import { CommanderPanel } from './CommanderPanel'
import { HexMap } from './HexMap'
import { OpsLog } from './OpsLog'

function pct(n: number) {
  return `${Math.round(n)}%`
}

export function Theater({
  sector,
  onAllocate,
  onRepair,
  onSetSpeed,
  onAssign,
  onRestart,
}: {
  sector: SectorState
  onAllocate: (id: FrontId, value: number) => void
  onRepair: (id: FrontId) => void
  onSetSpeed: (speed: GameSpeed) => void
  onAssign: (id: FrontId) => void
  onRestart: () => void
}) {
  const [selectedFrontId, setSelectedFrontId] = useState<FrontId | null>('breach')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const simNow = estimateSimNow(sector, now)
  const assaultIn = Math.max(0, sector.nextAssaultAt - simNow)
  const cycleStart =
    sector.assaultCycleStartedAt ??
    sector.nextAssaultAt - SIM.assaultIntervalMaxMinutes * 60_000
  const cycleLen = Math.max(1, sector.nextAssaultAt - cycleStart)
  const assaultProgress =
    sector.status === 'fallen'
      ? 1
      : clamp((simNow - cycleStart) / cycleLen, 0, 1)
  const assaultLabel =
    sector.status === 'fallen'
      ? 'Sector lost'
      : assaultIn < 60_000
        ? 'Assault imminent'
        : `Next assault ~${Math.ceil(assaultIn / 60_000)}m`

  const selected = useMemo(
    () => sector.fronts.find((f) => f.id === selectedFrontId) ?? sector.fronts[0]!,
    [sector.fronts, selectedFrontId],
  )

  const canRepair =
    sector.stockpile.conscripts >= SIM.repairIntegrityCostConscripts &&
    selected.integrity < 100

  return (
    <div className={`theater ${sector.status === 'fallen' ? 'fallen' : ''}`}>
      <div className="theater-atmosphere" aria-hidden />

      <header className="top-bar">
        <div className="top-brand">
          <p className="brand-mark">Endless War</p>
          <h1>{sector.designation}</h1>
        </div>

        <section className="stockpile" aria-label="Stockpiles">
          <Metric label="Conscripts" value={sector.stockpile.conscripts} />
          <Metric
            label="Morale"
            value={sector.stockpile.morale}
            suffix="%"
            tip={MORALE_TIP}
          />
          <div className="metric assault-meter">
            <span className="metric-label">Threat</span>
            <span className="metric-value pulse">{assaultLabel}</span>
            <div
              className={`assault-track ${assaultProgress > 0.85 ? 'critical' : ''}`}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(assaultProgress * 100)}
              aria-label="Assault countdown"
            >
              <span style={{ width: `${assaultProgress * 100}%` }} />
            </div>
          </div>
        </section>
      </header>

      <div className="theater-body">
        <div className="theater-main">
          <HexMap
            sector={sector}
            selectedFrontId={selected.id}
            onSelectFront={(id) => setSelectedFrontId(id ?? selected.id)}
          />
        </div>

        <aside className="theater-rail">
          <CommanderPanel sector={sector} onAssign={onAssign} />

          <section className="front-command" aria-label="Selected front command">
            <div className="front-tabs" role="tablist" aria-label="Fronts">
              {sector.fronts.map((front) => {
                const led = sector.commander?.assignedFrontId === front.id
                return (
                  <button
                    key={front.id}
                    type="button"
                    role="tab"
                    aria-selected={front.id === selected.id}
                    className={`front-tab ${front.id === selected.id ? 'active' : ''} ${led ? 'led' : ''}`}
                    onClick={() => setSelectedFrontId(front.id)}
                  >
                    <span>
                      {shortFront(front.name)}
                      {led ? ' ★' : ''}
                    </span>
                    <span className="front-tab-meta">{pct(front.integrity)}</span>
                  </button>
                )
              })}
            </div>

            <div className="front-panel">
              <div className="front-head">
                <h2>{selected.name}</h2>
                <span className="pressure">P {selected.pressure.toFixed(1)}</span>
              </div>

              <div
                className="integrity-track"
                aria-label={`Integrity ${pct(selected.integrity)}`}
              >
                <div
                  className="integrity-fill"
                  style={{ width: `${clamp(selected.integrity, 0, 100)}%` }}
                />
              </div>

              <label className="alloc">
                <span>Commitment {Math.round(selected.allocation * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(selected.allocation * 100)}
                  disabled={sector.status === 'fallen'}
                  onChange={(e) =>
                    onAllocate(selected.id, Number(e.target.value) / 100)
                  }
                />
              </label>

              <button
                type="button"
                className="btn ghost"
                disabled={sector.status === 'fallen' || !canRepair}
                onClick={() => onRepair(selected.id)}
              >
                Repair (+{SIM.repairIntegrityAmount} ·{' '}
                {SIM.repairIntegrityCostConscripts} conscripts)
              </button>
            </div>
          </section>

          <OpsLog sector={sector} simNow={simNow} />

          <footer className="theater-actions">
            <div className="speed-controls" role="group" aria-label="Game speed">
              <span className="speed-label">Speed</span>
              {GAME_SPEEDS.map((speed) => (
                <button
                  key={speed}
                  type="button"
                  className={`btn speed-btn ${sector.gameSpeed === speed ? 'active' : ''}`}
                  aria-pressed={sector.gameSpeed === speed}
                  onClick={() => onSetSpeed(speed)}
                >
                  {speed}×
                </button>
              ))}
            </div>
            {sector.status === 'fallen' && (
              <button type="button" className="btn primary" onClick={onRestart}>
                Reassign
              </button>
            )}
          </footer>
        </aside>
      </div>
    </div>
  )
}

function shortFront(name: string) {
  if (name.includes('Northern')) return 'Ridge'
  if (name.includes('Breach')) return 'Breach'
  if (name.includes('Dock')) return 'Dock'
  return name
}

const MORALE_TIP =
  'Faith of the line (0–100). Recovers ~0.15%/min (half that under 40%). Crumbling fronts cut recovery (avg integrity under 40% / 25%). Assaults smash it harder when conscripts are thin; devastating waves hit worse.'

function Metric({
  label,
  value,
  suffix = '',
  tip,
}: {
  label: string
  value: number
  suffix?: string
  tip?: string
}) {
  return (
    <div className="metric">
      <span className="metric-label">
        {label}
        {tip && (
          <span className="tip">
            <button
              type="button"
              className="tip-trigger"
              aria-label={`${label} info`}
              aria-describedby={`tip-${label}`}
            >
              ?
            </button>
            <span className="tip-bubble" id={`tip-${label}`} role="tooltip">
              {tip}
            </span>
          </span>
        )}
      </span>
      <span className="metric-value">
        {Math.round(value)}
        {suffix}
      </span>
    </div>
  )
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}
