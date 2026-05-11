export const MAGNET_HOLE_R = 3.25
export const MAGNET_HOLE_DEPTH = 2.4  // 2mm magnet + 2 layer heights (gridfinity standard)
export const CRUSH_RIB_INNER_R = 2.95
export const CRUSH_RIB_COUNT = 8

export function crushRibCrossSection(CrossSection: any): any {
  const n = 128
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI
    const t = Math.pow(Math.abs(Math.cos(CRUSH_RIB_COUNT * a / 2)), 8)
    const r = MAGNET_HOLE_R - (MAGNET_HOLE_R - CRUSH_RIB_INNER_R) * t
    pts.push([r * Math.cos(a), r * Math.sin(a)])
  }
  return new CrossSection([pts] as any, 'NonZero')
}
