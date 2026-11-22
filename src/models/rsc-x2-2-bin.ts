import { getManifold, manifoldToBufferGeometry } from '../manifold'
import type { Attribution, GeomResult } from '../types'
import {
  BASE_H, FLOOR_THICK, HEIGHT_UNIT, CELL,
  GRIDFINITY_BIN_SETTINGS,
  attribution as gridfinityAttribution,
  type BinHoleSettings,
  buildBinManifold, buildBinFillManifold,
} from './gridfinity-bin'
import {
  GRIP_INNER_HALF, gripFloorZ, slotColumn, slotRunLength, buildSlots, type Slot,
} from './coin-cell'

export const attribution: Attribution[] = gridfinityAttribution

// RSC-X2-2 coin cell charger, stored standing on one of its 32 × 13 mm ends
export const CHARGER_L = 48
export const CHARGER_W = 32
export const CHARGER_T = 13
// Corners of the 48 × 32 face; standing on end, they sit at the bottom of the pocket
export const CHARGER_CORNER_R = 4
// Corners of the 32 × 13 end, which run up the sides of the pocket
export const CHARGER_EDGE_R = 2
export const CLEARANCE = 0.5

// With no cell fitted, the spring that holds the cell sticks out of the slotted face
// Measured depth; the relief is cut deeper when the space beside the cells allows
export const SPRING_RELIEF_MIN_D = 3.5
// Centred on the slotted face; the face either side keeps the charger located
export const SPRING_RELIEF_W = 14
export const CELL_COUNT = 4

export const INNER_HALF = (CELL - 2.9) / 2
export const POCKET_FLOOR_Z = BASE_H + FLOOR_THICK
// Deep enough to hold at least half the charger
export const HEIGHT_UNITS = Math.ceil((POCKET_FLOOR_Z + CHARGER_L / 2) / HEIGHT_UNIT)

export type Rect = { x0: number; x1: number; y0: number; y1: number }

const WALL = 1.2
// The bin wall backs anything placed against it, so cuts can almost touch it
const WALL_MARGIN = 0.2
const SLOT_END_MARGIN = 0.15
const BIN_TOP = HEIGHT_UNITS * HEIGHT_UNIT

export function pocketCornerR(): number {
  return CHARGER_CORNER_R + CLEARANCE
}

export function pocketEdgeR(): number {
  return CHARGER_EDGE_R + CLEARANCE
}

export type Layout = {
  body: Rect
  relief: Rect
  slots: Slot[]
  // Area cut down to just below the cell centres, minus a strip along each column, for pinching cells
  grip: Rect
}

export function layout(): Layout {
  const w = CHARGER_W + 2 * CLEARANCE
  const t = CHARGER_T + 2 * CLEARANCE

  // Charger against the -Y wall, slotted face and spring relief towards the cells
  const y0 = -INNER_HALF + WALL_MARGIN
  const body = { x0: -w / 2, x1: w / 2, y0, y1: y0 + t }

  // Coin cells packed against the +Y wall; the relief takes whatever depth is left before them
  const cellsTo = INNER_HALF - SLOT_END_MARGIN
  const slotsY0 = cellsTo - slotRunLength(CELL_COUNT)
  const slots = slotColumn(0, slotsY0, CELL_COUNT, BIN_TOP)
  const reliefD = Math.max(SPRING_RELIEF_MIN_D, slotsY0 - WALL - body.y1)
  const relief = { x0: -SPRING_RELIEF_W / 2, x1: SPRING_RELIEF_W / 2, y0: body.y1 - 0.01, y1: body.y1 + reliefD }
  const grip = { x0: -INNER_HALF, x1: INNER_HALF, y0: slotsY0, y1: cellsTo }

  return { body, relief, slots, grip }
}

export function info(): string {
  const w = CELL - 0.5
  return `1×1, ${HEIGHT_UNITS}u, charger + ${layout().slots.length} LIR2032 — ${w} × ${w} × ${HEIGHT_UNITS * HEIGHT_UNIT} mm`
}

export function generate(p: { holes: BinHoleSettings }): GeomResult {
  const { Manifold, CrossSection } = getManifold()
  const { holes } = p
  const top = BIN_TOP + 1

  const bin = buildBinManifold({
    cells_x: 1, cells_y: 1, height_units: HEIGHT_UNITS, stacking_lip: false, holes,
    base_style: 'flat', dividers_x: 0, dividers_y: 0, label_style: 'none',
  })
  const fill = buildBinFillManifold({ cells_x: 1, cells_y: 1, height_units: HEIGHT_UNITS, stacking_lip: false, holes })

  const { body, relief, slots, grip } = layout()
  const box = (r: Rect) => Manifold.cube([r.x1 - r.x0, r.y1 - r.y0, top - POCKET_FLOOR_Z], false)
    .translate([r.x0, r.y0, POCKET_FLOOR_Z])

  // Round the bottom corners so the charger rests on its own curves
  const cr = pocketCornerR()
  const t = body.y1 - body.y0
  const corner = (x: number) => Manifold.cylinder(t, cr, cr, 64).rotate([-90, 0, 0]).translate([x, body.y0, POCKET_FLOOR_Z + cr])
  const rounded = Manifold.hull([
    corner(body.x0 + cr),
    corner(body.x1 - cr),
    Manifold.cube([body.x1 - body.x0, t, 0.01], false).translate([body.x0, body.y0, top - 0.01]),
  ])
  // Round the vertical edges to match the charger's end
  const er = pocketEdgeR()
  const footprint = CrossSection.square([body.x1 - body.x0 - 2 * er, t - 2 * er], true)
    .offset(er, 'Round', 2, 64)
    .translate([(body.x0 + body.x1) / 2, (body.y0 + body.y1) / 2])
    .extrude(top - POCKET_FLOOR_Z)
    .translate([0, 0, POCKET_FLOOR_Z])
  // Extend the grip cut past the side walls so no sliver of fill is left against them
  const gz = gripFloorZ(BIN_TOP)
  const gripCut = Manifold.cube([grip.x1 - grip.x0 + 2, grip.y1 - grip.y0, top - gz], false)
    .translate([grip.x0 - 1, grip.y0, gz])
    .subtract(Manifold.cube([2 * GRIP_INNER_HALF, grip.y1 - grip.y0 + 2, top - gz + 2], false)
      .translate([-GRIP_INNER_HALF, grip.y0 - 1, gz - 1]))

  const cavity = Manifold.union([rounded.intersect(footprint), box(relief), buildSlots(slots, top), gripCut])

  const result = fill ? bin.add(fill.subtract(cavity)) : bin

  const label = 'RSC-X2-2 Charger Bin'
  return {
    objects: [{
      label,
      parts: [{ label, geom: manifoldToBufferGeometry(result) }],
      settings: GRIDFINITY_BIN_SETTINGS,
    }],
  }
}
