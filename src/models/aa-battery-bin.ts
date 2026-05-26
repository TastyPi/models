import { getManifold, manifoldToBufferGeometry } from '../manifold'
import type { Attribution, GeomResult } from '../types'
import {
  BASE_H, FLOOR_THICK, HEIGHT_UNIT, CELL,
  GRIDFINITY_BIN_SETTINGS,
  attribution as gridfinityAttribution,
  type BinHoleSettings,
  buildBinManifold, buildBinFillManifold,
} from './gridfinity-bin'

export const AA_DIAMETER = 14.5
export const AA_LENGTH = 50.5

// 5 units gives 28.8mm cavity depth — over the 25.25mm half-battery threshold
const HEIGHT_UNITS = 5

// Inner cavity half-width for 1×1 bin: (CELL - 2*4)/2 + (3.75 - 1.2) = 17 + 2.55
const INNER_HALF = 19.55

// 5-battery (quincunx): equalise outer-wall gap and centre-to-corner gap
// p = (INNER_HALF + r) / (1 + √2) → each gap ≈ 1.05mm
const R = 7.35  // 14.7mm hole (0.1mm clearance per side)
const P = (INNER_HALF + R) / (1 + Math.SQRT2)

export const attribution: Attribution[] = gridfinityAttribution

const HOLE_CENTRES: [number, number][] = [[0, 0], [-P, -P], [P, -P], [-P, P], [P, P]]

export function info(): string {
  const w = CELL - 0.5
  const h = HEIGHT_UNITS * HEIGHT_UNIT
  return `1×1, ${HEIGHT_UNITS}u, 5 batteries — ${w} × ${w} × ${h} mm`
}

export type AaBatteryBinParams = {
  holes: BinHoleSettings
}

export function generate(p: AaBatteryBinParams): GeomResult {
  const { holes } = p
  const { Manifold } = getManifold()

  const nominalH = HEIGHT_UNITS * HEIGHT_UNIT
  const holeZ = BASE_H + FLOOR_THICK
  const holeDepth = nominalH - holeZ

  const bin = buildBinManifold({
    cells_x: 1, cells_y: 1, height_units: HEIGHT_UNITS, stacking_lip: false, holes,
    base_style: 'flat', dividers_x: 0, dividers_y: 0, label_style: 'none',
  })
  const fill = buildBinFillManifold({
    cells_x: 1, cells_y: 1, height_units: HEIGHT_UNITS, stacking_lip: false, holes,
  })

  const holeSolid = Manifold.union(HOLE_CENTRES.map(([cx, cy]) =>
    Manifold.cylinder(holeDepth + 0.01, R, R, 48).translate([cx, cy, holeZ - 0.005])
  ))

  const result = fill ? bin.add(fill.subtract(holeSolid)) : bin

  return {
    objects: [{
      label: 'AA Battery Bin',
      parts: [{ label: 'AA Battery Bin', geom: manifoldToBufferGeometry(result) }],
      settings: GRIDFINITY_BIN_SETTINGS,
    }],
  }
}
