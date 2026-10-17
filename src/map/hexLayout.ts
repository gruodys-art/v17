import type { FrontId } from '@shared/sim'

/** Flat-top axial hex cell on the sector map. */
export type HexKind = 'hub' | FrontId | 'approach'

export interface HexCell {
  q: number
  r: number
  kind: HexKind
  /** Short map label */
  tag: string
}

/**
 * Compact sector board — center is command, rim hexes belong to fronts.
 * Axial coords (q, r), flat-top.
 */
export const SECTOR_HEXES: HexCell[] = [
  { q: 0, r: 0, kind: 'hub', tag: 'CMD' },

  // Northern Ridge
  { q: 0, r: -2, kind: 'north', tag: 'N1' },
  { q: 1, r: -2, kind: 'north', tag: 'N2' },
  { q: -1, r: -1, kind: 'north', tag: 'N3' },
  { q: 0, r: -1, kind: 'north', tag: 'N4' },

  // Hab Breach-7 (southwest)
  { q: -2, r: 1, kind: 'breach', tag: 'B1' },
  { q: -1, r: 1, kind: 'breach', tag: 'B2' },
  { q: -2, r: 2, kind: 'breach', tag: 'B3' },
  { q: -1, r: 2, kind: 'breach', tag: 'B4' },

  // Void Dock Spur (southeast)
  { q: 2, r: -1, kind: 'dock', tag: 'D1' },
  { q: 1, r: 0, kind: 'dock', tag: 'D2' },
  { q: 2, r: 0, kind: 'dock', tag: 'D3' },
  { q: 1, r: 1, kind: 'dock', tag: 'D4' },

  // Contested approaches (visibility only)
  { q: 1, r: -1, kind: 'approach', tag: '·' },
  { q: -1, r: 0, kind: 'approach', tag: '·' },
  { q: 0, r: 1, kind: 'approach', tag: '·' },
]

export function axialToPixel(q: number, r: number, size: number) {
  const x = size * ((3 / 2) * q)
  const y = size * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r)
  return { x, y }
}

export function hexPolygonPoints(cx: number, cy: number, size: number) {
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i)
    const x = cx + size * Math.cos(angle)
    const y = cy + size * Math.sin(angle)
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return pts.join(' ')
}

export function hexBounds(cells: HexCell[], size: number, pad: number) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const cell of cells) {
    const { x, y } = axialToPixel(cell.q, cell.r, size)
    minX = Math.min(minX, x - size)
    minY = Math.min(minY, y - size)
    maxX = Math.max(maxX, x + size)
    maxY = Math.max(maxY, y + size)
  }
  return {
    minX: minX - pad,
    minY: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  }
}
