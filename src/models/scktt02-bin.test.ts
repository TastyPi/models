import { describe, expect, it } from 'vitest'
import { BASE_H, magnetHoleDepth } from './gridfinity-bin'
import {
  POCKET_R, TESTER_D, INNER_HALF, info,
  FILLET_R, filletedProfile, filletR, POCKET_FLOOR_Z, LAYER_HEIGHT, HEIGHT_UNITS_MIN, HEIGHT_UNITS_MAX,
} from './scktt02-bin'

describe('SCKTT02 bin', () => {
  it('leaves clearance around a 69 mm tester', () => {
    expect(2 * POCKET_R).toBeGreaterThanOrEqual(TESTER_D + 1)
  })

  it('fits the pocket inside the 2×2 cavity', () => {
    expect(POCKET_R).toBeLessThan(INNER_HALF)
  })

  it('reports the bin size', () => {
    expect(info(3)).toBe('2×2, 3u — 83.5 × 83.5 × 21 mm')
  })

  it('rounds the bottom edge of the pocket with a tangent fillet', () => {
    const pts = filletedProfile(POCKET_R, 20, FILLET_R)
    expect(pts[1]).toEqual([POCKET_R - FILLET_R, 0])
    const arcEnd = pts[pts.length - 3]
    expect(arcEnd[0]).toBeCloseTo(POCKET_R)
    expect(arcEnd[1]).toBeCloseTo(FILLET_R)
    for (const [r, z] of pts.slice(1, -2)) {
      expect(Math.hypot(r - (POCKET_R - FILLET_R), z - FILLET_R)).toBeCloseTo(FILLET_R)
    }
  })

  it('caps the fillet at the pocket depth at every height', () => {
    for (let u = HEIGHT_UNITS_MIN; u <= HEIGHT_UNITS_MAX; u++) {
      expect(filletR(u)).toBeGreaterThan(0)
      expect(filletR(u)).toBeLessThanOrEqual(u * 7 - POCKET_FLOOR_Z)
      expect(filletR(u)).toBeLessThanOrEqual(FILLET_R)
    }
    expect(filletR(1)).toBeCloseTo(7 - POCKET_FLOOR_Z)
    expect(filletR(3)).toBe(FILLET_R)
  })

  it('allows a 1u bin', () => {
    expect(HEIGHT_UNITS_MIN).toBe(1)
  })
  it('leaves exactly 2 layers between the pocket floor and the gaps between the feet', () => {
    expect(POCKET_FLOOR_Z - BASE_H).toBeCloseTo(2 * LAYER_HEIGHT)
  })

  it('keeps at least 2 layers above the magnet holes', () => {
    expect(POCKET_FLOOR_Z - magnetHoleDepth(true).totalDepth).toBeGreaterThanOrEqual(2 * LAYER_HEIGHT)
  })
})
