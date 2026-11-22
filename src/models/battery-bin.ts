import { getManifold, manifoldToBufferGeometry } from '../manifold'
import type { Attribution, GeomResult } from '../types'
import {
  BASE_H, FLOOR_THICK, HEIGHT_UNIT, CELL, BOX_OUTER_R,
  GRIDFINITY_BIN_SETTINGS,
  attribution as gridfinityAttribution,
  type BinHoleSettings,
  buildBinManifold, buildBinFillManifold,
} from './gridfinity-bin'

export const attribution: Attribution[] = gridfinityAttribution

export type BatteryBinType = 'aa' | 'mixed'

export type BatteryBinParams = {
  type: BatteryBinType
  holes: BinHoleSettings
}

export const INNER_HALF = (CELL - 2.9) / 2
// Corner radius of the bin's inner cavity (outer radius less the 1.2 mm wall)
export const CAVITY_R = BOX_OUTER_R - 1.2
export const HOLE_FLOOR_Z = BASE_H + FLOOR_THICK

export function heightUnitsFor(length: number): number {
  return Math.ceil((HOLE_FLOOR_Z + length / 2) / HEIGHT_UNIT)
}

// ── AA quincunx ──────────────────────────────────────────────────────────────

export const AA_LENGTH = 50.5
const AA_HEIGHT_UNITS = heightUnitsFor(AA_LENGTH)
const AA_R = 7.35  // 14.7mm hole (0.1mm clearance per side)
// Equalise outer-wall gap and centre-to-corner gap: p = (inner half + r) / (1 + √2)
const AA_P = (INNER_HALF + AA_R) / (1 + Math.SQRT2)
const AA_CENTRES: [number, number][] = [[0, 0], [-AA_P, -AA_P], [AA_P, -AA_P], [-AA_P, AA_P], [AA_P, AA_P]]

// ── 2 × MN1604, 3 × AAA or MN21 ──────────────────────────────────────────────

export const MN1604_LENGTH = 48.5
// Largest 9V allowed by IEC 60086-2 for 6LR61, plus 0.25 mm clearance each side
export const MN1604_MAX: [number, number] = [26.5, 17.5]
export const MN1604_POCKET: [number, number] = [27, 18]

// The small holes take either an AAA (up to 10.5 mm across) or an MN21
export const AAA_LENGTH = 44.5
export const AAA_MAX_D = 10.5
export const MN21_LENGTH = 28.5
export const SMALL_HOLE_D = 10.7

export const WALL = 1.2
// Thinner walls either side of the 9Vs let their square corners sit inside the cavity's corner curve
export const NINE_V_WALL = 0.9

// Shorter than the usual half-length rule so an MN21 sticks out far enough to pinch;
// everything is still held over 40% of its length
export const MIXED_HEIGHT_UNITS = 4
export const MIXED_TOP = MIXED_HEIGHT_UNITS * HEIGHT_UNIT
export const NINE_V_TOP_Z = HOLE_FLOOR_Z + MN1604_LENGTH
// Raised a little to lift MN21s higher; an AAA's top still sits below the 9Vs
export const SMALL_FLOOR_Z = HOLE_FLOOR_Z + 2

export type Rect = { x0: number; x1: number; y0: number; y1: number }
export type Pocket = Rect & { round: boolean; floorZ: number }

export function mixedLayout(): Pocket[] {
  const pitch = SMALL_HOLE_D + WALL
  const small = (x: number, y: number): Pocket => ({
    x0: x - SMALL_HOLE_D / 2, x1: x + SMALL_HOLE_D / 2,
    y0: y - SMALL_HOLE_D / 2, y1: y + SMALL_HOLE_D / 2,
    round: true, floorZ: SMALL_FLOOR_Z,
  })

  // A row of three small holes against the +X wall, freeing room for the 9Vs to clear the far corners
  const stripX = INNER_HALF - SMALL_HOLE_D / 2
  const strip = [-1, 0, 1].map(i => small(stripX, i * pitch))

  const leftHi = stripX - SMALL_HOLE_D / 2 - NINE_V_WALL

  // Two square 9V pockets side by side, against the small-hole strip
  const [w, d] = MN1604_POCKET
  const nineV = (y: number): Pocket => ({
    x0: leftHi - w, x1: leftHi,
    y0: y - d / 2, y1: y + d / 2,
    round: false, floorZ: HOLE_FLOOR_Z,
  })
  const nineVs = [-0.5, 0.5].map(i => nineV(i * (d + NINE_V_WALL)))

  return [...nineVs, ...strip]
}

export const MN1604_COUNT = mixedLayout().filter(p => !p.round).length
export const SMALL_COUNT = mixedLayout().filter(p => p.round).length

export function info(type: BatteryBinType): string {
  const dims = (u: number) => `${CELL - 0.5} × ${CELL - 0.5} × ${u * HEIGHT_UNIT} mm`
  if (type === 'aa') return `1×1, ${AA_HEIGHT_UNITS}u, 5 AA — ${dims(AA_HEIGHT_UNITS)}`
  return `1×1, ${MIXED_HEIGHT_UNITS}u, ${MN1604_COUNT} MN1604 + ${SMALL_COUNT} AAA or MN21 — ${dims(MIXED_HEIGHT_UNITS)}`
}

function aaCutter(): any {
  const { Manifold } = getManifold()
  const nominalH = AA_HEIGHT_UNITS * HEIGHT_UNIT
  return Manifold.union(AA_CENTRES.map(([cx, cy]) =>
    Manifold.cylinder(nominalH - HOLE_FLOOR_Z + 0.01, AA_R, AA_R, 48).translate([cx, cy, HOLE_FLOOR_Z - 0.005])
  ))
}

function mixedCutter(): any {
  const { Manifold } = getManifold()
  const pockets = mixedLayout()
  const top = MIXED_TOP + 1
  const parts: any[] = []

  for (const p of pockets) {
    const depth = top - p.floorZ
    const w = p.x1 - p.x0
    const solid = p.round
      ? Manifold.cylinder(depth, w / 2, w / 2, 48).translate([(p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, 0])
      : Manifold.cube([w, p.y1 - p.y0, depth], false).translate([p.x0, p.y0, 0])
    parts.push(solid.translate([0, 0, p.floorZ]))
  }

  return Manifold.union(parts)
}

export function generate(p: BatteryBinParams): GeomResult {
  const { holes } = p
  const height_units = p.type === 'aa' ? AA_HEIGHT_UNITS : MIXED_HEIGHT_UNITS

  const bin = buildBinManifold({
    cells_x: 1, cells_y: 1, height_units, stacking_lip: false, holes,
    base_style: 'flat', dividers_x: 0, dividers_y: 0, label_style: 'none',
  })
  const fill = buildBinFillManifold({ cells_x: 1, cells_y: 1, height_units, stacking_lip: false, holes })

  const cutter = p.type === 'aa' ? aaCutter() : mixedCutter()
  const result = fill ? bin.add(fill.subtract(cutter)) : bin

  return {
    objects: [{
      label: 'Battery Bin',
      parts: [{ label: 'Battery Bin', geom: manifoldToBufferGeometry(result) }],
      settings: GRIDFINITY_BIN_SETTINGS,
    }],
  }
}
