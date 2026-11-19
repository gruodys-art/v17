import { useMemo, useState } from 'react'
import {
  commanderPower,
  visibleTerritoryHexes,
  type Front,
  type FrontId,
  type SectorState,
} from '@shared/sim'
import {
  axialToPixel,
  hexBounds,
  hexPolygonPoints,
  type HexCell,
  type HexKind,
} from '../map/hexLayout'

const SIZE = 38

type Focus =
  | { kind: 'hub' }
  | { kind: 'approach'; cell: HexCell }
  | { kind: 'front'; front: Front; cell: HexCell }

function frontFor(kind: HexKind, sector: SectorState): Front | null {
  if (kind === 'hub' || kind === 'approach') return null
  return sector.fronts.find((f) => f.id === kind) ?? null
}

function fillFor(kind: HexKind, sector: SectorState): string {
  if (kind === 'hub') {
    const m = sector.stockpile.morale / 100
    return `rgba(176, 137, 77, ${0.45 + m * 0.4})`
  }
  if (kind === 'approach') return 'rgba(55, 44, 38, 0.85)'
  const front = frontFor(kind, sector)
  if (!front) return 'rgba(40, 32, 28, 0.9)'
  const integrity = front.integrity / 100
  const pressure = Math.min(front.pressure / 6, 1)
  const r = Math.round(160 + (70 - 160) * integrity)
  const g = Math.round(48 + (120 - 48) * integrity)
  const b = Math.round(36 + (70 - 36) * integrity)
  const a = 0.72 + pressure * 0.18
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

function strokeFor(kind: HexKind, active: boolean): string {
  if (active) return 'rgba(232, 223, 212, 0.95)'
  if (kind === 'hub') return 'rgba(210, 170, 90, 0.9)'
  if (kind === 'approach') return 'rgba(140, 120, 100, 0.55)'
  return 'rgba(200, 70, 55, 0.7)'
}

function cellKey(cell: HexCell) {
  return `${cell.q},${cell.r}`
}

export function HexMap({
  sector,
  selectedFrontId,
  onSelectFront,
}: {
  sector: SectorState
  selectedFrontId: FrontId | null
  onSelectFront: (id: FrontId | null) => void
}) {
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const hexes = useMemo(() => visibleTerritoryHexes(sector), [sector])
  const bounds = useMemo(() => hexBounds(hexes, SIZE, 32), [hexes])

  const focus = useMemo((): Focus | null => {
    if (!focusKey) return null
    const cell = hexes.find((c) => cellKey(c) === focusKey)
    if (!cell) return null
    if (cell.kind === 'hub') return { kind: 'hub' }
    if (cell.kind === 'approach') return { kind: 'approach', cell }
    const front = frontFor(cell.kind, sector)
    if (!front) return null
    return { kind: 'front', front, cell }
  }, [focusKey, hexes, sector])

  return (
    <div className="hex-map">
      <div className="hex-map-stage">
        <svg
          className="hex-svg"
          viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
          role="group"
          aria-label="Sector hex map"
          preserveAspectRatio="xMidYMid meet"
          onMouseLeave={() => setFocusKey(null)}
        >
          <defs>
            <radialGradient id="hex-glow" cx="50%" cy="40%" r="65%">
              <stop offset="0%" stopColor="rgba(196, 92, 42, 0.28)" />
              <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
            </radialGradient>
          </defs>
          <ellipse
            cx={0}
            cy={0}
            rx={bounds.width * 0.42}
            ry={bounds.height * 0.38}
            fill="url(#hex-glow)"
            pointerEvents="none"
          />

          {hexes.map((cell) => {
            const { x, y } = axialToPixel(cell.q, cell.r, SIZE)
            const front = frontFor(cell.kind, sector)
            const key = cellKey(cell)
            const isSelected = front != null && selectedFrontId === front.id
            const isFocused = focusKey === key
            const isCommanded =
              front != null && sector.commander?.assignedFrontId === front.id

            return (
              <g
                key={key}
                className={`hex-cell hex-${cell.kind} ${isSelected ? 'selected' : ''} ${isFocused ? 'focused' : ''} ${isCommanded ? 'commanded' : ''}`}
                transform={`translate(${x} ${y})`}
                onMouseEnter={() => setFocusKey(key)}
                onFocus={() => setFocusKey(key)}
                onClick={() => {
                  if (front) onSelectFront(front.id)
                  else onSelectFront(null)
                  setFocusKey(key)
                }}
                tabIndex={0}
                role="button"
                aria-label={
                  front
                    ? `${front.name}, integrity ${Math.round(front.integrity)} percent${isCommanded ? ', commander posted' : ''}`
                    : cell.kind === 'hub'
                      ? 'Command hub'
                      : 'Contested approach'
                }
              >
                <polygon
                  points={hexPolygonPoints(0, 0, SIZE - 2)}
                  fill={fillFor(cell.kind, sector)}
                  stroke={
                    isCommanded && !(isSelected || isFocused)
                      ? 'rgba(210, 170, 90, 0.95)'
                      : strokeFor(cell.kind, isSelected || isFocused)
                  }
                  strokeWidth={isSelected || isFocused || isCommanded ? 2.4 : 1.4}
                />
                {isCommanded && (
                  <polygon
                    className="hex-cmd-ring"
                    points={hexPolygonPoints(0, 0, SIZE - 7)}
                    fill="none"
                    stroke="rgba(210, 170, 90, 0.55)"
                    strokeWidth={1.2}
                    pointerEvents="none"
                  />
                )}
                <text
                  className="hex-tag"
                  textAnchor="middle"
                  dominantBaseline="central"
                  y={front ? (isCommanded ? -10 : -6) : 0}
                  pointerEvents="none"
                >
                  {cell.tag}
                </text>
                {front && (
                  <text
                    className="hex-mini"
                    textAnchor="middle"
                    dominantBaseline="central"
                    y={isCommanded ? 4 : 10}
                    pointerEvents="none"
                  >
                    {Math.round(front.integrity)}
                  </text>
                )}
                {isCommanded && (
                  <g className="hex-cmd-mark" pointerEvents="none" aria-hidden>
                    <rect
                      x={-16}
                      y={12}
                      width={32}
                      height={11}
                      rx={1.5}
                      className="hex-cmd-badge"
                    />
                    <text
                      className="hex-cmd-label"
                      textAnchor="middle"
                      dominantBaseline="central"
                      y={17.5}
                    >
                      {`POST · ${commanderPower(sector)}`}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>

        <aside className={`hex-readout ${focus ? 'visible' : ''}`} aria-live="polite">
          {!focus && (
            <>
              <p className="readout-kicker">Tactical overlay</p>
              <p className="readout-idle">Hover or tap a hex to inspect the line.</p>
            </>
          )}
          {focus?.kind === 'hub' && (
            <>
              <p className="readout-kicker">Command hub</p>
              <h3>{sector.designation}</h3>
              <dl className="readout-stats">
                <div>
                  <dt>Status</dt>
                  <dd>{sector.status === 'fallen' ? 'Fallen' : 'Holding'}</dd>
                </div>
                <div>
                  <dt>Conscripts</dt>
                  <dd>{Math.round(sector.stockpile.conscripts)}</dd>
                </div>
                <div>
                  <dt>Morale</dt>
                  <dd>{Math.round(sector.stockpile.morale)}%</dd>
                </div>
              </dl>
            </>
          )}
          {focus?.kind === 'approach' && (
            <>
              <p className="readout-kicker">Contested approach</p>
              <h3>
                Hex{' '}
                {focus.cell.tag === '·'
                  ? `${focus.cell.q},${focus.cell.r}`
                  : focus.cell.tag}
              </h3>
              <p className="readout-copy">
                No fixed battery. Pressure bleeds through from neighboring fronts —
                reinforce the ridge, breach, or dock rather than this dirt.
              </p>
            </>
          )}
          {focus?.kind === 'front' && (
            <>
              <p className="readout-kicker">
                Front · {focus.cell.tag}
                {sector.commander?.assignedFrontId === focus.front.id
                  ? ' · Commander'
                  : ''}
              </p>
              <h3>{focus.front.name}</h3>
              <dl className="readout-stats">
                <div>
                  <dt>Integrity</dt>
                  <dd className={focus.front.integrity < 40 ? 'neg' : ''}>
                    {Math.round(focus.front.integrity)}%
                  </dd>
                </div>
                <div>
                  <dt>Pressure</dt>
                  <dd>{focus.front.pressure.toFixed(1)}</dd>
                </div>
                <div>
                  <dt>Commitment</dt>
                  <dd>{Math.round(focus.front.allocation * 100)}%</dd>
                </div>
                {sector.commander?.assignedFrontId === focus.front.id && (
                  <div>
                    <dt>Commander</dt>
                    <dd>Power {commanderPower(sector)}</dd>
                  </div>
                )}
              </dl>
              <div className="readout-bar" aria-hidden>
                <span
                  style={{
                    width: `${Math.max(0, Math.min(100, focus.front.integrity))}%`,
                  }}
                />
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
