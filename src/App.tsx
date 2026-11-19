import { useMemo } from 'react'
import { ResumeReport } from './components/ResumeReport'
import { Theater } from './components/Theater'
import { useSector } from './hooks/useSector'
import { SIM, type FrontId } from '@shared/sim'

export default function App() {
  const {
    sector,
    error,
    busy,
    updateAllocations,
    repair,
    dismissReport,
    restart,
    setSpeed,
    assignCommander,
  } = useSector()

  const showReport = useMemo(() => {
    const r = sector?.pendingReport
    if (!r) return false
    return r.minutes >= SIM.reportMinMinutes
  }, [sector?.pendingReport])

  if (!sector) {
    return (
      <main className="app boot">
        <p className="brand-mark">Endless War</p>
        <p className="brief">{error ?? 'Establishing link to sector command…'}</p>
      </main>
    )
  }

  const onAllocate = (id: FrontId, value: number) => {
    const current = Object.fromEntries(
      sector.fronts.map((f) => [f.id, f.id === id ? value : f.allocation]),
    ) as Record<FrontId, number>
    updateAllocations(current)
  }

  return (
    <main className={`app ${busy ? 'busy' : ''}`}>
      {error && <p className="banner-error">{error}</p>}
      <Theater
        sector={sector}
        onAllocate={onAllocate}
        onRepair={repair}
        onSetSpeed={setSpeed}
        onAssign={assignCommander}
        onRestart={restart}
      />
      {showReport && sector.pendingReport && (
        <ResumeReport
          state={sector}
          report={sector.pendingReport}
          onDismiss={dismissReport}
        />
      )}
    </main>
  )
}
