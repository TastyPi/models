import { getManifold } from '../manifold'

export const BIT_GAP_SHAFT = 0.2
export const BIT_GAP_WALL  = 0

export const EXTENSION_R        = 5.0
export const EXTENSION_NARROW_R = 3.75
export const EXTENSION_LENGTH   = 110.5
export const EXTENSION_NARROW_L = 10.0

export const PEN_R              = 4.1
export const PEN_TAPER_R        = 2.15
export const PEN_BARREL_L       = 125.3
export const PEN_TAPER_L        = 12.0
export const PEN_NOTCH_L        = 43.7
export const PEN_NOTCH_W        = 3.0
export const PEN_NOTCH_DEPTH    = 2.4
export const PEN_NOTCH_FROM_END = 3.1

export type BitHoleGeom = {
  fillHalfX: number
  outerHalfX: number
  fillHalfY: number
  shaftTipX: number
  shaftBaseX: number
  shaftHalfY: number
  phaseShift?: 0 | 1
  sideExtend?: number
  endXOffset?: number
}

export type BitZoneSettings = {
  left: 'none' | 'extension' | 'pen'
  right: 'none' | 'extension' | 'pen'
}

function makeSemiCyl(CrossSection: any, r: number, len: number): any {
  const nSeg = 32
  const pts: [number, number][] = Array.from({ length: nSeg + 1 }, (_, i) => {
    const a = -Math.PI / 2 + i * (Math.PI / nSeg)
    return [r * Math.cos(a), r * Math.sin(a)]
  })
  return new CrossSection([pts], 'NonZero').extrude(len).rotate([0, 90, 0])
}

export const BIT_WALL         = 2.4
export const BIT_AF           = 6.76
export const BIT_DEPTH        = 8.1
export const BIT_R            = BIT_AF / Math.sqrt(3)
export const BIT_APOTHEM      = BIT_AF / 2
export const BIT_PITCH_LONG   = BIT_AF + BIT_WALL          // Y pitch in staggered grid (flat-to-flat + wall)
export const BIT_PITCH_SHORT  = BIT_PITCH_LONG * Math.sqrt(3) / 2
export const BIT_PITCH_DENSE  = 2 * BIT_R + BIT_WALL       // X pitch for a straight row (tip-to-tip + wall)

export function buildPenBinBitHoles(zones: BitZoneSettings, binTopZ: number, geom: BitHoleGeom, wallExtra = 0): any {
  const { Manifold, CrossSection } = getManifold()

  const hexFlat = new CrossSection([
    Array.from({ length: 6 }, (_, k): [number, number] => {
      const a = k * (Math.PI / 3)
      return [BIT_R * Math.cos(a), BIT_R * Math.sin(a)]
    }),
  ], 'NonZero').extrude(BIT_DEPTH)

  const holeZ = binTopZ - BIT_DEPTH
  const xMin = -geom.fillHalfX + BIT_R
  const xMax =  geom.fillHalfX - BIT_R

  const yCenter = (geom.shaftHalfY + BIT_GAP_SHAFT + geom.fillHalfY - BIT_GAP_WALL) / 2
  const fullBound = geom.fillHalfY - BIT_GAP_WALL - wallExtra
  const rLeft  = zones.left  === 'pen' ? PEN_R : zones.left  === 'extension' ? EXTENSION_R : null
  const rRight = zones.right === 'pen' ? PEN_R : zones.right === 'extension' ? EXTENSION_R : null

  // X where each groove begins (handle end); Infinity if no groove on that side
  function grooveStartX(zone: 'none' | 'extension' | 'pen'): number {
    const wallGap = (r: number) => geom.fillHalfY - r - yCenter
    if (zone === 'pen')       return geom.fillHalfX - wallGap(PEN_R)       - PEN_TAPER_L - PEN_BARREL_L
    if (zone === 'extension') return geom.fillHalfX - wallGap(EXTENSION_R) - EXTENSION_LENGTH
    return Infinity
  }
  // One-column margin before each groove becomes active for bit holes
  const xLeftActive  = grooveStartX(zones.left)  - BIT_PITCH_SHORT
  const xRightActive = grooveStartX(zones.right) - BIT_PITCH_SHORT

  // Y bounds when both grooves are active (middle strip)
  const yHi_mid = (rLeft  != null ? yCenter - rLeft!  - BIT_GAP_WALL : fullBound) - BIT_APOTHEM
  const yLo_mid = (rRight != null ? -(yCenter - rRight!) + BIT_GAP_WALL : -fullBound) + BIT_APOTHEM

  const all: any[] = []

  // Staggered grid: end zone (full Y) and intermediate zone (one groove active at a time)
  const kLo = Math.ceil(xMin / BIT_PITCH_SHORT)
  const kHi = Math.floor(xMax / BIT_PITCH_SHORT)
  for (let k = kLo; k <= kHi; k++) {
    const cx  = k * BIT_PITCH_SHORT
    const leftActive  = cx >= xLeftActive  && rLeft  != null
    const rightActive = cx >= xRightActive && rRight != null
    if (leftActive && rightActive) continue  // handled by dense middle loop below
    const yOff = k % 2 === 0 ? BIT_PITCH_LONG / 2 : 0
    const yHi = (leftActive  ? yCenter - rLeft!  - BIT_GAP_WALL : fullBound) - BIT_APOTHEM
    const yLo = (rightActive ? -(yCenter - rRight!) + BIT_GAP_WALL : -fullBound) + BIT_APOTHEM
    if (yLo >= yHi) continue
    const nLo = Math.ceil((yLo - yOff) / BIT_PITCH_LONG)
    const nHi = Math.floor((yHi - yOff) / BIT_PITCH_LONG)
    for (let n = nLo; n <= nHi; n++) {
      all.push(hexFlat.translate([cx, yOff + n * BIT_PITCH_LONG, holeZ]))
    }
  }

  // Dense single-row middle strip: both grooves active, use BIT_PITCH_DENSE (tip-to-tip + 1.2mm wall).
  // Anchor at the last staggered column; first dense hole is one BIT_PITCH_DENSE step away.
  const xBothActive = Math.max(xLeftActive, xRightActive)
  if (yLo_mid < yHi_mid && xBothActive < xMax) {
    const yCenterMid = (yLo_mid + yHi_mid) / 2
    const kLast  = Math.ceil(xBothActive / BIT_PITCH_SHORT) - 1
    const cxLast = kLast * BIT_PITCH_SHORT
    const nHi_mid = Math.floor((xMax - cxLast) / BIT_PITCH_DENSE)
    for (let n = 1; n <= nHi_mid; n++) {
      all.push(hexFlat.translate([cxLast + n * BIT_PITCH_DENSE, yCenterMid, holeZ]))
    }
  }

  return all.length > 0 ? Manifold.union(all) : null
}

export function buildShaftExtensionGrooves(zones: BitZoneSettings, binTopZ: number, geom: BitHoleGeom, anchorHandle = false): any {
  const left  = zones.left  === 'extension'
  const right = zones.right === 'extension'
  if (!left && !right) return null

  const { Manifold, CrossSection } = getManifold()

  const yCenter = (geom.shaftHalfY + BIT_GAP_SHAFT + geom.fillHalfY - BIT_GAP_WALL) / 2
  const wallGap = geom.fillHalfY - EXTENSION_R - yCenter
  const x0 = anchorHandle
    ? geom.shaftBaseX + BIT_WALL
    : geom.fillHalfX - EXTENSION_LENGTH - wallGap

  const mainL = EXTENSION_LENGTH - EXTENSION_NARROW_L
  const all: any[] = []
  for (const y of (left && right ? [yCenter, -yCenter] : left ? [yCenter] : [-yCenter])) {
    all.push(Manifold.union([
      makeSemiCyl(CrossSection, EXTENSION_NARROW_R, EXTENSION_NARROW_L).translate([x0,                     y, binTopZ]),
      makeSemiCyl(CrossSection, EXTENSION_R,        mainL             ).translate([x0 + EXTENSION_NARROW_L, y, binTopZ]),
    ]))
  }
  return Manifold.union(all)
}

export function buildPenGroove(zones: BitZoneSettings, binTopZ: number, geom: BitHoleGeom, anchorHandle = false): any {
  const left  = zones.left  === 'pen'
  const right = zones.right === 'pen'
  if (!left && !right) return null

  const { Manifold, CrossSection } = getManifold()

  const yCenter = (geom.shaftHalfY + BIT_GAP_SHAFT + geom.fillHalfY - BIT_GAP_WALL) / 2
  const wallGap = geom.fillHalfY - yCenter - PEN_R
  // anchorHandle: barrel starts 2.4 mm past the handle/shaft junction, pointing toward +X.
  // Default: taper tip flush with far (+X) wall (used for the dedicated pen bin).
  const x0 = anchorHandle
    ? geom.shaftBaseX + BIT_WALL
    : geom.fillHalfX - wallGap - PEN_TAPER_L - PEN_BARREL_L

  function semiConeFrustum(rWide: number, rNarrow: number, len: number): any {
    const nSeg = 32
    const pts: [number, number][] = Array.from({ length: nSeg + 1 }, (_, i) => {
      const a = -Math.PI / 2 + i * (Math.PI / nSeg)
      return [rWide * Math.cos(a), rWide * Math.sin(a)]
    })
    const s = rNarrow / rWide
    return new CrossSection([pts], 'NonZero').extrude(len, 16, 0, [s, s]).rotate([0, 90, 0])
  }

  const yRight = -(yCenter + PEN_NOTCH_W)
  const all: any[] = []
  for (const y of (left && right ? [yCenter, yRight] : left ? [yCenter] : [yRight])) {
    const notchYMin = y + PEN_R
    const notch = Manifold.cube([PEN_NOTCH_L, PEN_NOTCH_W, PEN_NOTCH_DEPTH])
      .translate([x0 + PEN_NOTCH_FROM_END, notchYMin, binTopZ - PEN_NOTCH_DEPTH])
    all.push(Manifold.union([
      makeSemiCyl(CrossSection, PEN_R, PEN_BARREL_L).translate([x0, y, binTopZ]),
      semiConeFrustum(PEN_R, PEN_TAPER_R, PEN_TAPER_L).translate([x0 + PEN_BARREL_L, y, binTopZ]),
      notch,
    ]))
  }
  return Manifold.union(all)
}
