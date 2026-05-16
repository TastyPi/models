import { describe, it, expect } from 'vitest'
import { info, magnetHoleDepth, holePositions, HEIGHT_UNIT, STACKING_LIP_H } from './gridfinity-bin'

const CELL = 42
const BIN_GAP = 0.25
const MAG_OFFSET = 13

describe('info', () => {
  it('reports outer dimensions for a 1×1×3 bin with stacking lip', () => {
    const w = CELL - 2 * BIN_GAP
    const h = 3 * HEIGHT_UNIT + STACKING_LIP_H
    expect(info(1, 1, 3, true)).toBe(`${w} × ${w} × ${h} mm`)
  })

  it('reports height without extra when stacking lip is off', () => {
    const w = CELL - 2 * BIN_GAP
    const h = 3 * HEIGHT_UNIT
    expect(info(1, 1, 3, false)).toBe(`${w} × ${w} × ${h} mm`)
  })

  it('scales width and depth with cell count', () => {
    const w = 2 * CELL - 2 * BIN_GAP
    const d = 3 * CELL - 2 * BIN_GAP
    const h = 4 * HEIGHT_UNIT + STACKING_LIP_H
    expect(info(2, 3, 4, true)).toBe(`${w} × ${d} × ${h} mm`)
  })

  it('scales height with height_units (no lip)', () => {
    expect(info(1, 1, 1, false)).toContain(`× ${HEIGHT_UNIT} mm`)
    expect(info(1, 1, 6, false)).toContain(`× ${6 * HEIGHT_UNIT} mm`)
  })

  it('adds STACKING_LIP_H to height when stacking lip is on', () => {
    expect(info(1, 1, 2, true)).toContain(`× ${2 * HEIGHT_UNIT + STACKING_LIP_H} mm`)
  })
})

describe('holePositions', () => {
  describe('corner_magnets = false', () => {
    it('1×1: produces 4 holes at ±MAG_OFFSET from center', () => {
      const pos = holePositions(1, 1, false)
      expect(pos).toHaveLength(4)
      expect(pos).toContainEqual([MAG_OFFSET, MAG_OFFSET])
      expect(pos).toContainEqual([-MAG_OFFSET, MAG_OFFSET])
      expect(pos).toContainEqual([MAG_OFFSET, -MAG_OFFSET])
      expect(pos).toContainEqual([-MAG_OFFSET, -MAG_OFFSET])
    })

    it('2×2: produces 16 holes (4 per cell)', () => {
      expect(holePositions(2, 2, false)).toHaveLength(16)
    })

    it('3×3: produces 36 holes (4 per cell)', () => {
      expect(holePositions(3, 3, false)).toHaveLength(36)
    })
  })

  describe('corner_magnets = true', () => {
    it('always produces exactly 4 holes regardless of bin size', () => {
      expect(holePositions(1, 1, true)).toHaveLength(4)
      expect(holePositions(2, 2, true)).toHaveLength(4)
      expect(holePositions(3, 3, true)).toHaveLength(4)
      expect(holePositions(4, 2, true)).toHaveLength(4)
    })

    it('1×1: positions match the all-holes case', () => {
      expect(holePositions(1, 1, true)).toEqual(expect.arrayContaining(holePositions(1, 1, false)))
    })

    it('3×3: holes are at the true outer corners of the bin, not inner cell corners', () => {
      const pos = holePositions(3, 3, true)
      // Outer cell centers for 3×3 are at ±CELL from origin
      // Corner holes sit MAG_OFFSET further out: ±(CELL + MAG_OFFSET)
      const expected = CELL + MAG_OFFSET
      expect(pos).toContainEqual([-expected, -expected])
      expect(pos).toContainEqual([ expected, -expected])
      expect(pos).toContainEqual([-expected,  expected])
      expect(pos).toContainEqual([ expected,  expected])
    })

    it('3×1: corners are at the correct X extents and Y stays at ±MAG_OFFSET', () => {
      const pos = holePositions(3, 1, true)
      const expectedX = CELL + MAG_OFFSET
      expect(pos).toContainEqual([-expectedX, -MAG_OFFSET])
      expect(pos).toContainEqual([ expectedX, -MAG_OFFSET])
      expect(pos).toContainEqual([-expectedX,  MAG_OFFSET])
      expect(pos).toContainEqual([ expectedX,  MAG_OFFSET])
    })
  })
})

describe('magnetHoleDepth', () => {
  it('without supportless: clear depth equals total depth equals MAGNET_HOLE_DEPTH', () => {
    const { clearDepth, totalDepth } = magnetHoleDepth(false)
    expect(clearDepth).toBeCloseTo(2.4)
    expect(totalDepth).toBeCloseTo(2.4)
  })

  it('with supportless: clear depth still equals MAGNET_HOLE_DEPTH', () => {
    expect(magnetHoleDepth(true).clearDepth).toBeCloseTo(2.4)
  })

  it('with supportless: total depth adds 3 bridge layers of 0.2mm each', () => {
    expect(magnetHoleDepth(true).totalDepth).toBeCloseTo(3.0)
  })

  it('with supportless: total depth is greater than clear depth', () => {
    const { clearDepth, totalDepth } = magnetHoleDepth(true)
    expect(totalDepth).toBeGreaterThan(clearDepth)
    expect(totalDepth - clearDepth).toBeCloseTo(0.6)
  })
})
