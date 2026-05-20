import { describe, it, expect, vi } from 'vitest'

vi.mock('./dymo-letratag-mesh', () => ({ MESH_B64: '' }))

import { info, HEIGHT_UNITS_MIN, HEIGHT_UNITS_MAX } from './dymo-letratag'
import { HEIGHT_UNIT, STACKING_LIP_H } from './gridfinity-bin'

const CELLS_X = 3
const CELLS_Y = 6
const W = CELLS_X * 42 - 2 * 0.25  // 125.5
const D = CELLS_Y * 42 - 2 * 0.25  // 251.5

describe('info', () => {
  it('reports correct dimensions at max height with stacking lip', () => {
    const h = HEIGHT_UNITS_MAX * HEIGHT_UNIT + STACKING_LIP_H
    expect(info({ height_units: HEIGHT_UNITS_MAX, stacking_lip: true })).toBe(`${W} × ${D} × ${h} mm`)
  })

  it('reports height without stacking lip when disabled', () => {
    const h = HEIGHT_UNITS_MAX * HEIGHT_UNIT
    expect(info({ height_units: HEIGHT_UNITS_MAX, stacking_lip: false })).toBe(`${W} × ${D} × ${h} mm`)
  })

  it('reports reduced height at minimum height_units', () => {
    const h = HEIGHT_UNITS_MIN * HEIGHT_UNIT
    expect(info({ height_units: HEIGHT_UNITS_MIN, stacking_lip: false })).toBe(`${W} × ${D} × ${h} mm`)
  })
})

describe('HEIGHT_UNITS constants', () => {
  it('MIN is 3', () => expect(HEIGHT_UNITS_MIN).toBe(3))
  it('MAX is 6', () => expect(HEIGHT_UNITS_MAX).toBe(6))
})
