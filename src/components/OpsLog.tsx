import type { OpsLogEntry, OpsLogKind, SectorState } from '@shared/sim'

function kindLabel(kind: OpsLogKind): string {
  switch (kind) {
    case 'assault':
      return 'Assault'
    case 'outcome':
      return 'Outcome'
    case 'reinforcements':
      return 'Reinforce'
    case 'repair':
      return 'Repair'
    case 'fallen':
      return 'Fallen'
    case 'command':
      return 'Command'
    case 'status':
      return 'Status'
    case 'rank':
      return 'Promotion'
    default:
      return kind
  }
}

function formatAge(at: number, simNow: number): string {
  const mins = Math.max(0, Math.floor((simNow - at) / 60_000))
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h${m}m`
}

export function OpsLog({
  sector,
  simNow,
}: {
  sector: SectorState
  simNow: number
}) {
  const entries = sector.opsLog ?? []

  return (
    <section className="ops-log" aria-label="Operations log">
      <header className="ops-log-head">
        <h2>Ops log</h2>
      </header>
      {entries.length === 0 ? (
        <p className="ops-log-empty">Vox quiet.</p>
      ) : (
        <ol className="ops-log-list">
          {entries.map((entry) => (
            <LogRow
              key={entry.id}
              entry={entry}
              age={formatAge(entry.at, simNow)}
            />
          ))}
        </ol>
      )}
    </section>
  )
}

function LogRow({ entry, age }: { entry: OpsLogEntry; age: string }) {
  return (
    <li className={`ops-log-item kind-${entry.kind}`}>
      <div className="ops-log-meta">
        <span className="ops-log-kind">{kindLabel(entry.kind)}</span>
        <span className="ops-log-time">{age}</span>
      </div>
      <p className="ops-log-message">{entry.message}</p>
    </li>
  )
}
