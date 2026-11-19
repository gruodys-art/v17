import type { FrontId, GameSpeed, SectorState } from '@shared/sim'

async function request(path: string, init?: RequestInit): Promise<SectorState> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Request failed: ${res.status}`)
  }
  return (await res.json()) as SectorState
}

export function fetchSector(): Promise<SectorState> {
  return request('/api/sector')
}

export function postAllocations(
  allocations: Partial<Record<FrontId, number>>,
): Promise<SectorState> {
  return request('/api/sector/allocations', {
    method: 'POST',
    body: JSON.stringify({ allocations }),
  })
}

export function postRepair(frontId: FrontId): Promise<SectorState> {
  return request('/api/sector/repair', {
    method: 'POST',
    body: JSON.stringify({ frontId }),
  })
}

export function postAckReport(): Promise<SectorState> {
  return request('/api/sector/ack-report', { method: 'POST' })
}

export function postRestart(): Promise<SectorState> {
  return request('/api/sector/restart', { method: 'POST' })
}

export function postSpeed(speed: GameSpeed): Promise<SectorState> {
  return request('/api/sector/speed', {
    method: 'POST',
    body: JSON.stringify({ speed }),
  })
}

export function postAssign(frontId: FrontId | null): Promise<SectorState> {
  return request('/api/sector/assign', {
    method: 'POST',
    body: JSON.stringify({ frontId }),
  })
}
