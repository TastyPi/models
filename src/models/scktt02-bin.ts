import { getManifold, manifoldToBufferGeometry } from '../manifold'
import type { Attribution, GeomResult } from '../types'
import {
  BASE_H, HEIGHT_UNIT, CELL,
  GRIDFINITY_BIN_SETTINGS,
  attribution as gridfinityAttribution,
  type BinHoleSettings,
  buildBinManifold, buildBinFillManifold,
} from './gridfinity-bin'

export const attribution: Attribution[] = gridfinityAttribution

// LAP SCKTT02 socket tester: a 68–69 mm disc
export const TESTER_D = 69
export const CLEARANCE = 0.5
export const POCKET_R = TESTER_D / 2 + CLEARANCE

export const CELLS = 2
export const HEIGHT_UNITS_DEFAULT = 3
export const HEIGHT_UNITS_MIN = 1
export const HEIGHT_UNITS_MAX = 8
// The feet are separate below BASE_H, and screw holes reach it, so only a thin skin spans them
export const LAYER_HEIGHT = 0.2
export const POCKET_FLOOR_Z = BASE_H + 2 * LAYER_HEIGHT

const WALL_THICK = 1.2
// Inner face of the bin wall
export const INNER_HALF = CELLS * CELL / 2 - 0.25 - WALL_THICK
export const FILLET_R = 3

export type Params = {
  height_units: number
  holes: BinHoleSettings
}

// Radius/height profile of a cylinder whose bottom edge is rounded by radius f
export function filletedProfile(r: number, h: number, f: number, segments = 16): [number, number][] {
  const arc: [number, number][] = Array.from({ length: segments + 1 }, (_, i) => {
    const a = -Math.PI / 2 + (Math.PI / 2) * (i / segments)
    return [r - f + f * Math.cos(a), f + f * Math.sin(a)]
  })
  return [[0, 0], ...arc, [r, h], [0, h]]
}

// Shallow bins are shallower than the fillet, so the rounding is capped at the pocket depth
export function filletR(heightUnits: number): number {
  return Math.min(FILLET_R, heightUnits * HEIGHT_UNIT - POCKET_FLOOR_Z)
}

export function info(heightUnits: number): string {
  const w = CELLS * CELL - 0.5
  return `${CELLS}×${CELLS}, ${heightUnits}u — ${w} × ${w} × ${heightUnits * HEIGHT_UNIT} mm`
}

export function generate(p: Params): GeomResult {
  const { CrossSection } = getManifold()
  const { height_units, holes } = p
  const binTop = height_units * HEIGHT_UNIT
  const h = binTop + 1 - POCKET_FLOOR_Z

  const bin = buildBinManifold({
    cells_x: CELLS, cells_y: CELLS, height_units, stacking_lip: false, holes,
    base_style: 'flat', dividers_x: 0, dividers_y: 0, label_style: 'none',
  })
  const fill = buildBinFillManifold({ cells_x: CELLS, cells_y: CELLS, height_units, stacking_lip: false, holes })

  const pocket = new CrossSection([filletedProfile(POCKET_R, h, filletR(height_units))]).revolve(128)
    .translate([0, 0, POCKET_FLOOR_Z])

  const result = (fill ? bin.add(fill) : bin).subtract(pocket)

  const label = 'SCKTT02 Socket Tester Bin'
  return {
    objects: [{
      label,
      parts: [{ label, geom: manifoldToBufferGeometry(result) }],
      settings: GRIDFINITY_BIN_SETTINGS,
    }],
  }
}
