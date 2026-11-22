import { describe, expect, it } from 'vitest'
import {
  mixedLayout, heightUnitsFor, type Rect,
  INNER_HALF, CAVITY_R, WALL, NINE_V_WALL, MIXED_HEIGHT_UNITS, MIXED_TOP,
  MN1604_POCKET, MN1604_MAX, MN1604_LENGTH, MN1604_COUNT, NINE_V_TOP_Z,
  AAA_LENGTH, AAA_MAX_D, MN21_LENGTH, SMALL_HOLE_D, SMALL_COUNT, SMALL_FLOOR_Z,
  AA_LENGTH,
} from './battery-bin'

// Gap between two rects, or a negative number if they overlap
function gap(a: Rect, b: Rect): number {
  const dx = Math.max(a.x0 - b.x1, b.x0 - a.x1)
  const dy = Math.max(a.y0 - b.y1, b.y0 - a.y1)
  return Math.max(dx, dy)
}

// Distance from a point to the cavity's rounded-square edge; negative means outside
function cavityClearance([x, y]: [number, number]): number {
  const qx = Math.abs(x) - (INNER_HALF - CAVITY_R)
  const qy = Math.abs(y) - (INNER_HALF - CAVITY_R)
  if (qx > 0 && qy > 0) return CAVITY_R - Math.hypot(qx, qy)
  return INNER_HALF - Math.max(Math.abs(x), Math.abs(y))
}

describe('mixedLayout', () => {
  const pockets = mixedLayout()
  const nineVs = pockets.filter(p => !p.round)
  const small = pockets.filter(p => p.round)

  it('holds two 9V and 3 AAA or MN21', () => {
    expect(nineVs).toHaveLength(2)
    expect(small).toHaveLength(3)
    expect(MN1604_COUNT).toBe(2)
    expect(SMALL_COUNT).toBe(3)
  })

  it('keeps the square 9V pocket corners inside the cavity, so the bin wall stays full thickness', () => {
    for (const p of nineVs) for (const x of [p.x0, p.x1]) for (const y of [p.y0, p.y1]) {
      expect(cavityClearance([x, y])).toBeGreaterThanOrEqual(0)
    }
  })

  it('keeps the small holes inside the cavity', () => {
    for (const h of small) {
      const cx = (h.x0 + h.x1) / 2, cy = (h.y0 + h.y1) / 2
      for (let a = 0; a < 360; a += 5) {
        const r = SMALL_HOLE_D / 2
        const pt: [number, number] = [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)]
        expect(cavityClearance(pt)).toBeGreaterThanOrEqual(-1e-9)
      }
    }
  })

  it('leaves at least 0.9 mm beside the 9Vs and 1.2 mm between small holes', () => {
    for (let i = 0; i < pockets.length; i++) for (let j = i + 1; j < pockets.length; j++) {
      const bothSmall = pockets[i].round && pockets[j].round
      expect(gap(pockets[i], pockets[j])).toBeGreaterThanOrEqual((bothSmall ? WALL : NINE_V_WALL) - 1e-9)
    }
  })

  it('fits a full-size 9V in each pocket', () => {
    const [bw, bd] = MN1604_MAX
    for (const p of nineVs) {
      expect(p.x1 - p.x0).toBeCloseTo(MN1604_POCKET[0])
      expect(p.y1 - p.y0).toBeCloseTo(MN1604_POCKET[1])
      expect(p.x1 - p.x0).toBeGreaterThanOrEqual(bw + 0.5)
      expect(p.y1 - p.y0).toBeGreaterThanOrEqual(bd + 0.5)
    }
  })

  it('holds the 9Vs at least 40% of their length deep', () => {
    for (const p of nineVs) expect(MIXED_TOP - p.floorZ).toBeGreaterThanOrEqual(0.4 * MN1604_LENGTH)
  })

  it('sizes the small holes for a full-size AAA', () => {
    expect(SMALL_HOLE_D).toBeGreaterThanOrEqual(AAA_MAX_D + 0.2)
    for (const h of small) expect(h.x1 - h.x0).toBeCloseTo(SMALL_HOLE_D)
  })

  it('keeps the AAA tops no higher than the 9V tops, so the drawer height is set by the 9V', () => {
    for (const h of small) expect(h.floorZ + AAA_LENGTH).toBeLessThanOrEqual(NINE_V_TOP_Z)
    expect(NINE_V_TOP_Z).toBeLessThanOrEqual(56)
  })

  it('holds an AAA at least 40% of its length deep', () => {
    expect(MIXED_TOP - SMALL_FLOOR_Z).toBeGreaterThanOrEqual(0.4 * AAA_LENGTH)
  })

  it('leaves an MN21 sticking out at least 8 mm above the rim', () => {
    expect(SMALL_FLOOR_Z + MN21_LENGTH - MIXED_TOP).toBeGreaterThanOrEqual(8)
  })
})

describe('heights', () => {
  it('keeps the AA bin at 5 units', () => {
    expect(heightUnitsFor(AA_LENGTH)).toBe(5)
  })

  it('makes the mixed bin 4 units', () => {
    expect(MIXED_HEIGHT_UNITS).toBe(4)
    expect(MIXED_TOP).toBe(28)
  })
})
