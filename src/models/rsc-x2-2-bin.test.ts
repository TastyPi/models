import { describe, expect, it } from 'vitest'
import {
  layout, pocketCornerR, pocketEdgeR, CHARGER_CORNER_R, CHARGER_EDGE_R, INNER_HALF, POCKET_FLOOR_Z, HEIGHT_UNITS,
  CHARGER_L, CHARGER_W, CHARGER_T, SPRING_RELIEF_MIN_D, SPRING_RELIEF_W, CELL_COUNT,
} from './rsc-x2-2-bin'
import { SLOT_R, SLOT_T, STAGGER, slotCentreZ, cellTopZ } from './coin-cell'

const BIN_TOP = HEIGHT_UNITS * 7

describe('layout', () => {
  const { body, relief, slots, grip } = layout()

  it('leaves at least 0.5 mm clearance each side of the charger end', () => {
    expect(body.x1 - body.x0).toBeGreaterThanOrEqual(CHARGER_W + 1)
    expect(body.y1 - body.y0).toBeGreaterThanOrEqual(CHARGER_T + 1)
  })

  it('keeps the pocket, relief, slots and grip inside the 1×1 cavity', () => {
    const slotRects = slots.map(s => ({ x0: s.x - SLOT_R, x1: s.x + SLOT_R, y0: s.y - SLOT_T / 2, y1: s.y + SLOT_T / 2 }))
    for (const r of [body, relief, grip, ...slotRects]) {
      expect(r.x0).toBeGreaterThanOrEqual(-INNER_HALF)
      expect(r.x1).toBeLessThanOrEqual(INNER_HALF)
      expect(r.y0).toBeGreaterThanOrEqual(-INNER_HALF)
      expect(r.y1).toBeLessThanOrEqual(INNER_HALF)
    }
  })

  it('cuts a centred spring relief into the slotted face', () => {
    expect(relief.y0).toBeLessThanOrEqual(body.y1)
    expect(relief.y1 - body.y1).toBeGreaterThanOrEqual(SPRING_RELIEF_MIN_D)
    expect(relief.x1 - relief.x0).toBeCloseTo(SPRING_RELIEF_W)
    expect((relief.x0 + relief.x1) / 2).toBeCloseTo((body.x0 + body.x1) / 2)
  })

  it('keeps the relief clear of the rounded side edges', () => {
    expect(relief.x0).toBeGreaterThanOrEqual(body.x0 + pocketEdgeR())
    expect(relief.x1).toBeLessThanOrEqual(body.x1 - pocketEdgeR())
  })

  it('holds at least half the charger below the rim', () => {
    expect(BIN_TOP - POCKET_FLOOR_Z).toBeGreaterThanOrEqual(CHARGER_L / 2)
  })

  it('rounds the pocket floor corners to clear the charger corners', () => {
    expect(pocketCornerR()).toBeGreaterThan(CHARGER_CORNER_R)
    expect(2 * pocketCornerR()).toBeLessThanOrEqual(body.x1 - body.x0)
  })

  it('rounds the pocket side edges to clear the charger edges', () => {
    expect(pocketEdgeR()).toBeGreaterThan(CHARGER_EDGE_R)
    expect(2 * pocketEdgeR()).toBeLessThanOrEqual(body.y1 - body.y0)
  })

  it('fits 4 coin cells in the space beside the charger', () => {
    expect(slots).toHaveLength(CELL_COUNT)
    expect(CELL_COUNT).toBe(4)
  })

  it('deepens the spring relief into the spare space up to the wall before the cells', () => {
    expect(relief.y1 - body.y1).toBeGreaterThan(SPRING_RELIEF_MIN_D)
    expect(grip.y0 - relief.y1).toBeCloseTo(1.2)
  })

  it('makes the spring relief 14 mm wide', () => {
    expect(SPRING_RELIEF_W).toBe(14)
  })

  it('leaves a wall between the spring relief and the coin cells', () => {
    expect(grip.y0 - relief.y1).toBeGreaterThanOrEqual(1.2 - 1e-9)
    for (const s of slots) expect(s.y - SLOT_T / 2).toBeGreaterThanOrEqual(grip.y0 - 1e-9)
  })

  it('alternates cell heights by the stagger', () => {
    slots.forEach((s, i) => expect(s.z - slotCentreZ(BIN_TOP)).toBeCloseTo(i % 2 === 1 ? STAGGER : 0))
  })

  it('keeps the raised cell tops below the top of the charger', () => {
    expect(cellTopZ(BIN_TOP)).toBeLessThan(POCKET_FLOOR_Z + CHARGER_L)
  })
})
