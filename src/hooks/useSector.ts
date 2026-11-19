import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchSector,
  postAckReport,
  postAllocations,
  postAssign,
  postRepair,
  postRestart,
  postSpeed,
} from '../api/sectorApi'
import type { FrontId, GameSpeed, SectorState } from '@shared/sim'

export function useSector() {
  const [sector, setSector] = useState<SectorState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const allocTimer = useRef<number | null>(null)

  const refresh = useCallback(async () => {
    try {
      const next = await fetchSector()
      setSector(next)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reach command post')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onFocus = () => {
      void refresh()
    }
    window.addEventListener('focus', onFocus)
    const onVis = () => {
      if (document.visibilityState === 'visible') onFocus()
    }
    document.addEventListener('visibilitychange', onVis)
    const speed = sector?.gameSpeed ?? 1
    const pollMs = speed >= 100 ? 1_000 : speed > 1 ? 2_000 : 10_000
    const poll = window.setInterval(() => {
      void refresh()
    }, pollMs)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
      window.clearInterval(poll)
      if (allocTimer.current != null) window.clearTimeout(allocTimer.current)
    }
  }, [refresh, sector?.gameSpeed])

  const run = useCallback(
    async (fn: () => Promise<SectorState>) => {
      setBusy(true)
      try {
        const next = await fn()
        setSector(next)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Command rejected')
        await refresh()
      } finally {
        setBusy(false)
      }
    },
    [refresh],
  )

  const updateAllocations = useCallback(
    (allocations: Partial<Record<FrontId, number>>) => {
      setSector((s) =>
        s
          ? {
              ...s,
              fronts: s.fronts.map((f) => ({
                ...f,
                allocation: allocations[f.id] ?? f.allocation,
              })),
            }
          : s,
      )
      if (allocTimer.current != null) window.clearTimeout(allocTimer.current)
      allocTimer.current = window.setTimeout(() => {
        void run(() => postAllocations(allocations))
      }, 200)
    },
    [run],
  )

  const repair = useCallback(
    (frontId: FrontId) => {
      void run(() => postRepair(frontId))
    },
    [run],
  )

  const dismissReport = useCallback(() => {
    void run(() => postAckReport())
  }, [run])

  const restart = useCallback(() => {
    void run(() => postRestart())
  }, [run])

  const setSpeed = useCallback(
    (speed: GameSpeed) => {
      void run(() => postSpeed(speed))
    },
    [run],
  )

  const assignCommander = useCallback(
    (frontId: FrontId | null) => {
      void run(() => postAssign(frontId))
    },
    [run],
  )

  return {
    sector,
    error,
    busy,
    updateAllocations,
    repair,
    dismissReport,
    restart,
    setSpeed,
    assignCommander,
    refresh,
  }
}
