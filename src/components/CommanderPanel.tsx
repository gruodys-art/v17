import { xpProgress, type FrontId, type SectorState } from '@shared/sim'

export function CommanderPanel({
  sector,
  onAssign,
}: {
  sector: SectorState
  onAssign: (frontId: FrontId) => void
}) {
  const progress = xpProgress(sector)
  const xp = sector.commander?.xp ?? 0
  const assigned = sector.commander?.assignedFrontId ?? null
  const assignedName =
    sector.fronts.find((f) => f.id === assigned)?.name ?? 'Unassigned'

  return (
    <section className="commander" aria-label="Commander progression">
      <div className="commander-head">
        <div>
          <p className="commander-kicker">Commander</p>
          <h2>{progress.rank.title}</h2>
        </div>
        <div className="commander-xp">
          <span className="commander-power">Power {progress.power}</span>
          <span className="commander-capacity">
            {progress.controlCapacity} hexes
          </span>
          <span className="commander-xp-value">{Math.floor(xp)} XP</span>
        </div>
      </div>

      <div
        className="commander-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress.ratio * 100)}
        aria-label="Rank progress"
      >
        <span style={{ width: `${progress.ratio * 100}%` }} />
      </div>
      <p className="commander-next">
        {progress.next
          ? `${Math.floor(progress.xpIntoRank)}/${progress.xpForNext} → ${progress.next.title} (${progress.next.controlCapacity} hexes)`
          : 'Max field rank'}
      </p>
      <p className="commander-posting">
        Posted: <strong>{assignedName}</strong>
      </p>

      <div className="commander-assign" role="group" aria-label="Assign commander">
        {sector.fronts.map((front) => (
          <button
            key={front.id}
            type="button"
            className={`btn speed-btn ${assigned === front.id ? 'active' : ''}`}
            aria-pressed={assigned === front.id}
            disabled={sector.status === 'fallen'}
            onClick={() => onAssign(front.id)}
          >
            {shortFront(front.name)}
          </button>
        ))}
      </div>
    </section>
  )
}

function shortFront(name: string) {
  if (name.includes('Northern')) return 'Ridge'
  if (name.includes('Breach')) return 'Breach'
  if (name.includes('Dock')) return 'Dock'
  return name
}
