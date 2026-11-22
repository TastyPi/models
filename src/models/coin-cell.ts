import { getManifold } from '../manifold'
import { BASE_H, FLOOR_THICK, HEIGHT_UNIT } from './gridfinity-bin'

// LIR2032 coin cells stored on edge in disc-shaped slots
export const CELL_DIAMETER = 20
export const CELL_THICKNESS = 3.2
const CLEARANCE = 0.25
export const SLOT_R = CELL_DIAMETER / 2 + CLEARANCE
export const SLOT_T = CELL_THICKNESS + 2 * CLEARANCE
export const SLOT_WALL = 1.3
export const SLOT_PITCH = SLOT_T + SLOT_WALL
// Every other cell is raised so its top edge stands clear of its neighbours
export const STAGGER = 3
// Slot wall kept either side of a column centre; the rims beyond it are exposed for pinching
export const GRIP_INNER_HALF = 7

// Cell centre sits this far below the bin top, so its widest point is just above the grip floor
export const SLOT_CENTRE_DROP = 3 * HEIGHT_UNIT - (BASE_H + FLOOR_THICK + 1 + SLOT_R)

export type Slot = { x: number; y: number; z: number }

export function slotCentreZ(binTop: number): number {
  return binTop - SLOT_CENTRE_DROP
}

export function gripFloorZ(binTop: number): number {
  return slotCentreZ(binTop) - 1
}

// A column of n slots stacked along Y from y0, alternating low and raised
export function slotColumn(x: number, y0: number, n: number, binTop: number): Slot[] {
  const cz = slotCentreZ(binTop)
  return Array.from({ length: n }, (_, i) => ({
    x,
    y: y0 + SLOT_T / 2 + i * SLOT_PITCH,
    z: cz + (i % 2 === 1 ? STAGGER : 0),
  }))
}

export function slotRunLength(n: number): number {
  return n * SLOT_PITCH - SLOT_WALL
}

export function cellTopZ(binTop: number): number {
  return slotCentreZ(binTop) - SLOT_R + CELL_DIAMETER + STAGGER
}

// Disc slots, with straight sides above each disc's centre so cells drop straight in
export function buildSlots(slots: Slot[], cutTop: number): any {
  const { Manifold } = getManifold()
  const disc = Manifold.cylinder(SLOT_T, SLOT_R, SLOT_R, 96, true).rotate([90, 0, 0])
  const parts: any[] = []
  for (const s of slots) {
    parts.push(disc.translate([s.x, s.y, s.z]))
    if (cutTop > s.z) {
      parts.push(Manifold.cube([2 * SLOT_R, SLOT_T, cutTop - s.z], false).translate([s.x - SLOT_R, s.y - SLOT_T / 2, s.z]))
    }
  }
  return Manifold.union(parts)
}
