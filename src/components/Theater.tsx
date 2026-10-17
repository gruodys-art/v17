import { useMemo, useState } from 'react'
import type { FrontId, SectorState } from '@shared/sim'
import { SIM } from '@shared/sim'
import { HexMap } from './HexMap'

function pct(n: number) {
  return `${Math.round(n)}%`
}

export function Theater({
  sector,
  onAllocate,
  onRepair,
  onAdvance,
  onRestart,
}: {
  sector: SectorState
  onAllocate: (id: FrontId, value: number) => void
  onRepair: (id: FrontId) => void
  onAdvance: (minutes: number) => void
  onRestart: () => void
}) {
  const [selectedFrontId, setSelectedFrontId] = useState<FrontId | null>('breach')

  const assaultIn = Math.max(0, sector.nextAssaultAt - Date.now())
  const assaultLabel =
    sector.status === 'fallen'
      ? 'Sector lost'
      : assaultIn < 60_000
        ? 'Assault imminent'
        : `Next assault ~${Math.ceil(assaultIn / 60_000)}m`

  const canRepair =
    sector.stockpile.manpower >= SIM.repairIntegrityCostManpower &&
    sector.stockpile.munitions >= SIM.repairIntegrityCostMunitions

  const selected = useMemo(
    () => sector.fronts.find((f) => f.id === selectedFrontId) ?? sector.fronts[0]!,
    [sector.fronts, selectedFrontId],
  )

  return (
    <div className={`theater ${sector.status === 'fallen' ? 'fallen' : ''}`}>
      <div className="theater-atmosphere" aria-hidden />

      <header className="theater-brand">
        <p className="brand-mark">Endless War</p>
        <h1>{sector.designation}</h1>
        <p className="brief">
          Sector board below. Hover hexes to read the line — commit bodies where
          the greenskins press hardest.
        </p>
      </header>

      <section className="stockpile" aria-label="Stockpiles">
        <Metric label="Manpower" value={sector.stockpile.manpower} />
        <Metric label="Munitions" value={sector.stockpile.munitions} />
        <Metric label="Morale" value={sector.stockpile.morale} suffix="%" />
        <div className="metric assault-meter">
          <span className="metric-label">Threat</span>
          <span className="metric-value pulse">{assaultLabel}</span>
        </div>
      </section>

      <HexMap
        sector={sector}
        selectedFrontId={selected.id}
        onSelectFront={(id) => setSelectedFrontId(id ?? selected.id)}
      />

      <section className="front-command" aria-label="Selected front command">
        <div className="front-tabs" role="tablist" aria-label="Fronts">
          {sector.fronts.map((front) => (
            <button
              key={front.id}
              type="button"
              role="tab"
              aria-selected={front.id === selected.id}
              className={`front-tab ${front.id === selected.id ? 'active' : ''}`}
              onClick={() => setSelectedFrontId(front.id)}
            >
              <span>{front.name}</span>
              <span className="front-tab-meta">{pct(front.integrity)}</span>
            </button>
          ))}
        </div>

        <div className="front-panel">
          <div className="front-head">
            <h2>{selected.name}</h2>
            <span className="pressure">Pressure {selected.pressure.toFixed(1)}</span>
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
          <p className="integrity-readout">Line integrity {pct(selected.integrity)}</p>

          <label className="alloc">
            <span>Commitment {Math.round(selected.allocation * 100)}%</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(selected.allocation * 100)}
              disabled={sector.status === 'fallen'}
              onChange={(e) => onAllocate(selected.id, Number(e.target.value) / 100)}
            />
          </label>

          <button
            type="button"
            className="btn ghost"
            disabled={sector.status === 'fallen' || !canRepair}
            onClick={() => onRepair(selected.id)}
          >
            Repair (+{SIM.repairIntegrityAmount} · {SIM.repairIntegrityCostManpower} men /{' '}
            {SIM.repairIntegrityCostMunitions} shells)
          </button>
        </div>
      </section>

      <footer className="theater-actions">
        <button type="button" className="btn" onClick={() => onAdvance(15)}>
          Advance 15m
        </button>
        <button type="button" className="btn" onClick={() => onAdvance(60)}>
          Advance 1h
        </button>
        <button type="button" className="btn" onClick={() => onAdvance(480)}>
          Advance 8h
        </button>
        {sector.status === 'fallen' && (
          <button type="button" className="btn primary" onClick={onRestart}>
            Request reassignment
          </button>
        )}
      </footer>
    </div>
  )
}

function Metric({
  label,
  value,
  suffix = '',
}: {
  label: string
  value: number
  suffix?: string
}) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
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
