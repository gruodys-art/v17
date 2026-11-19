import { SIM, type SectorState, type TickReport } from '@shared/sim'

function frontName(state: SectorState, id: string) {
  return state.fronts.find((f) => f.id === id)?.name ?? id
}

function fmt(n: number) {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}`
}

function formatOfflineDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  if (hours <= 0) {
    return `${mins} minute${mins === 1 ? '' : 's'}`
  }
  if (mins === 0) {
    return `${hours} hour${hours === 1 ? '' : 's'}`
  }
  return `${hours}h ${mins}m`
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
  if (report.minutes < SIM.reportMinMinutes) return null

  const offline = formatOfflineDuration(report.minutes)

  return (
    <div className="report-layer" role="dialog" aria-labelledby="report-title">
      <div className="report-panel">
        <p className="report-kicker">After-action</p>
        <h2 id="report-title">While you were gone</h2>
        <p className="report-offline">You were offline for {offline}.</p>
        <p className="report-sub">
          War continued on {state.designation} for the full absence.
        </p>

        <dl className="report-stats report-stats-two">
          <div>
            <dt>Conscripts</dt>
            <dd className={report.soldiersDelta < 0 ? 'neg' : 'pos'}>
              {fmt(report.soldiersDelta)}
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
              <p key={`${a.at}-${i}`} className={a.devastating ? 'devastating' : undefined}>
                {a.devastating ? 'Devastating wave' : 'Wave'} on{' '}
                {frontName(state, a.frontId)} — {a.survived ? 'held' : 'broken'}.
                Line −{a.integrityLoss}, conscripts −{a.soldiersLost}.
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
