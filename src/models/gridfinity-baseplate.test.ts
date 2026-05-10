import { describe, it, expect } from 'vitest'
import baseplate from './gridfinity-baseplate'

const CELL = 42

// Helper: build a full param set for the info/visible functions.
const params = (overrides: Record<string, number | boolean | string> = {}) => ({
  cells_x: 1, cells_y: 1,
  wall_n: 0, wall_s: 0, wall_e: 0, wall_w: 0,
  separate_walls: false,
  wall_connector: 'wall_male',
  corner_style: 'corner_l',
  corner_radius: 0,
  base_style: 'solid',
  magnets: false,
  restrict_bed: false,
  bed_type: 'prusa_core_one', bed_x: 250, bed_y: 220,
  ...overrides,
})

describe('info', () => {
  it('reports assembled footprint for a grid with no walls', () => {
    expect(baseplate.info!(params({ cells_x: 1, cells_y: 1 }))).toBe(`${CELL} × ${CELL} mm assembled`)
    expect(baseplate.info!(params({ cells_x: 2, cells_y: 3 }))).toBe(`${2 * CELL} × ${3 * CELL} mm assembled`)
  })

  it('adds wall widths to the assembled dimensions', () => {
    const p = params({ cells_x: 13, cells_y: 9, wall_n: 11.5, wall_s: 11.5, wall_e: 9, wall_w: 9 })
    expect(baseplate.info!(p)).toBe(`${13 * CELL + 9 + 9} × ${9 * CELL + 11.5 + 11.5} mm assembled`)
  })

  it('handles asymmetric walls', () => {
    const p = params({ cells_x: 4, cells_y: 4, wall_n: 10, wall_s: 5, wall_e: 8, wall_w: 3 })
    expect(baseplate.info!(p)).toBe(`${4 * CELL + 3 + 8} × ${4 * CELL + 5 + 10} mm assembled`)
  })

  it('handles null walls (optional params disabled) by treating as 0', () => {
    // wall_n/s/e/w default to 0 (disabled optional) — info sums them
    const p = params({ cells_x: 3, cells_y: 2, wall_n: 0, wall_s: 0, wall_e: 0, wall_w: 0 })
    expect(baseplate.info!(p)).toBe(`${3 * CELL} × ${2 * CELL} mm assembled`)
  })
})

describe('parameter visibility', () => {
  describe('separate_walls', () => {
    const vis = baseplate.parameters.separate_walls.visible!

    it('is hidden when all walls are 0', () => {
      expect(vis(params())).toBe(false)
    })

    it('is visible when any wall is > 0', () => {
      expect(vis(params({ wall_n: 5 }))).toBe(true)
      expect(vis(params({ wall_s: 5 }))).toBe(true)
      expect(vis(params({ wall_e: 5 }))).toBe(true)
      expect(vis(params({ wall_w: 5 }))).toBe(true)
    })
  })

  describe('wall_connector', () => {
    const vis = baseplate.parameters.wall_connector.visible!

    it('is hidden when separate_walls is false', () => {
      expect(vis(params({ separate_walls: false, wall_n: 10 }))).toBe(false)
    })

    it('is hidden when separate_walls is true but no walls', () => {
      expect(vis(params({ separate_walls: true }))).toBe(false)
    })

    it('is visible when separate_walls is true and at least one wall exists', () => {
      expect(vis(params({ separate_walls: true, wall_n: 10 }))).toBe(true)
    })
  })

  describe('corner_style', () => {
    const vis = baseplate.parameters.corner_style.visible!

    it('is hidden when separate_walls is false', () => {
      expect(vis(params({ separate_walls: false, wall_n: 10, wall_e: 10 }))).toBe(false)
    })

    it('is hidden when walls do not form a corner', () => {
      // Only N wall — no corner
      expect(vis(params({ separate_walls: true, wall_n: 10 }))).toBe(false)
      // Only N+S walls — no corner (no E/W)
      expect(vis(params({ separate_walls: true, wall_n: 10, wall_s: 10 }))).toBe(false)
    })

    it('is visible when N + E walls form a corner', () => {
      expect(vis(params({ separate_walls: true, wall_n: 10, wall_e: 10 }))).toBe(true)
    })

    it('is visible when S + W walls form a corner', () => {
      expect(vis(params({ separate_walls: true, wall_s: 10, wall_w: 10 }))).toBe(true)
    })
  })

  describe('magnets', () => {
    const vis = baseplate.parameters.magnets.visible!

    it('is visible for solid base style', () => {
      expect(vis(params({ base_style: 'solid' }))).toBe(true)
    })

    it('is hidden for open base style', () => {
      expect(vis(params({ base_style: 'open' }))).toBe(false)
    })
  })

  describe('wall_n min (dynamic, respects wall_connector)', () => {
    const minFn = baseplate.parameters.wall_n.min!

    it('returns 0 when separate_walls is false', () => {
      const p = params({ separate_walls: false, wall_connector: 'wall_female' })
      expect(typeof minFn === 'function' ? minFn(p) : minFn).toBe(0)
    })

    it('returns EP_WALL_MIN when separate_walls and wall_connector is female', () => {
      const p = params({ separate_walls: true, wall_connector: 'wall_female' })
      const min = typeof minFn === 'function' ? minFn(p) : minFn
      expect(min).toBeGreaterThan(0)
    })

    it('returns 0 when separate_walls and wall_connector is male', () => {
      const p = params({ separate_walls: true, wall_connector: 'wall_male' })
      expect(typeof minFn === 'function' ? minFn(p) : minFn).toBe(0)
    })
  })
})
