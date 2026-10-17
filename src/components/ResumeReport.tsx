import type { SectorState, TickReport } from '@shared/sim'

function frontName(state: SectorState, id: string) {
  return state.fronts.find((f) => f.id === id)?.name ?? id
}

function fmt(n: number) {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}`
}

export function ResumeReport({
  state,
  report,
  onDismiss,
}: {
  state: SectorState
  report: TickReport
  onDismiss: () => void
}) {
  if (report.minutes <= 0 && report.assaults.length === 0) return null

  const hours = Math.floor(report.minutes / 60)
  const mins = report.minutes % 60
  const duration =
    hours > 0 ? `${hours}h ${mins}m` : `${mins} minute${mins === 1 ? '' : 's'}`

  return (
    <div className="report-layer" role="dialog" aria-labelledby="report-title">
      <div className="report-panel">
        <p className="report-kicker">After-action</p>
        <h2 id="report-title">While you were gone</h2>
        <p className="report-sub">
          {duration} of war on {state.designation}.
        </p>

        <dl className="report-stats">
          <div>
            <dt>Manpower</dt>
            <dd className={report.manpowerDelta < 0 ? 'neg' : 'pos'}>
              {fmt(report.manpowerDelta)}
            </dd>
          </div>
          <div>
            <dt>Munitions</dt>
            <dd className={report.munitionsDelta < 0 ? 'neg' : 'pos'}>
              {fmt(report.munitionsDelta)}
            </dd>
          </div>
          <div>
            <dt>Morale</dt>
            <dd className={report.moraleDelta < 0 ? 'neg' : 'pos'}>
              {fmt(report.moraleDelta)}
            </dd>
          </div>
        </dl>

        <ul className="report-fronts">
          {state.fronts.map((f) => (
            <li key={f.id}>
              <span>{f.name}</span>
              <span className={report.integrityDeltas[f.id] < 0 ? 'neg' : 'pos'}>
                integrity {fmt(report.integrityDeltas[f.id])}
              </span>
            </li>
          ))}
        </ul>

        {report.assaults.length > 0 && (
          <div className="report-assaults">
            <h3>Assaults</h3>
            {report.assaults.map((a, i) => (
              <p key={`${a.at}-${i}`}>
                Wave on {frontName(state, a.frontId)} —{' '}
                {a.survived ? 'held' : 'broken'}. Line −{a.integrityLoss}, bodies −
                {a.manpowerLoss}, shells −{a.munitionsLoss}.
              </p>
            ))}
          </div>
        )}

        <button type="button" className="btn primary" onClick={onDismiss}>
          Return to the line
        </button>
      </div>
    </div>
  )
}
