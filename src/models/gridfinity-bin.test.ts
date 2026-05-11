import { describe, it, expect } from 'vitest'
import { info, HEIGHT_UNIT, STACKING_LIP_H } from './gridfinity-bin'

const CELL = 42
const BIN_GAP = 0.25

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
