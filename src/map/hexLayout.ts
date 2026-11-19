import type { TerritoryHex } from '@shared/sim'

/** Re-export territory cell shape for map rendering. */
export type HexCell = TerritoryHex
export type HexKind = TerritoryHex['kind']

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
