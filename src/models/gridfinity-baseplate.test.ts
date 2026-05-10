import { describe, it, expect } from 'vitest'
import { EP_WALL_MIN, wallStripExtent } from './gridfinity-baseplate'

describe('EP_WALL_MIN', () => {
  it('is a positive number', () => {
    expect(EP_WALL_MIN).toBeGreaterThan(0)
  })

  it('is a multiple of 0.5 (slider step)', () => {
    expect(EP_WALL_MIN % 0.5).toBe(0)
  })
})

describe('wallStripExtent', () => {
  const tile = { L: -63, R: 63, B: -63, T: 63 }  // 3×3 cells
  const walls = { N: 12, S: 12, E: 9, W: 9 }

  describe('corner_cw', () => {
    it('N strip: only extends right on the outermost (right) segment', () => {
      const left   = wallStripExtent('N', tile, walls, 'corner_cw', { L: 0, R: 0 }, { L: true,  R: false })
      const middle = wallStripExtent('N', tile, walls, 'corner_cw', { L: 0, R: 0 }, { L: false, R: false })
      const right  = wallStripExtent('N', tile, walls, 'corner_cw', { L: 0, R: 0 }, { L: false, R: true  })
      expect(left?.max).toBe(tile.R)
      expect(middle?.max).toBe(tile.R)
      expect(right?.max).toBe(tile.R + walls.E)
    })

    it('S strip: only extends left on the outermost (left) segment', () => {
      const left   = wallStripExtent('S', tile, walls, 'corner_cw', { L: 0, R: 0 }, { L: true,  R: false })
      const middle = wallStripExtent('S', tile, walls, 'corner_cw', { L: 0, R: 0 }, { L: false, R: false })
      const right  = wallStripExtent('S', tile, walls, 'corner_cw', { L: 0, R: 0 }, { L: false, R: true  })
      expect(left?.min).toBe(tile.L - walls.W)
      expect(middle?.min).toBe(tile.L)
      expect(right?.min).toBe(tile.L)
    })

    it('E strip: only extends down on the outermost (bottom) segment', () => {
      const bottom = wallStripExtent('E', tile, walls, 'corner_cw', { L: 0, R: 0 }, { L: true,  R: false })
      const middle = wallStripExtent('E', tile, walls, 'corner_cw', { L: 0, R: 0 }, { L: false, R: false })
      const top    = wallStripExtent('E', tile, walls, 'corner_cw', { L: 0, R: 0 }, { L: false, R: true  })
      expect(bottom?.min).toBe(tile.B - walls.S)
      expect(middle?.min).toBe(tile.B)
      expect(top?.min).toBe(tile.B)
    })

    it('W strip: only extends up on the outermost (top) segment', () => {
      const bottom = wallStripExtent('W', tile, walls, 'corner_cw', { L: 0, R: 0 }, { L: true,  R: false })
      const middle = wallStripExtent('W', tile, walls, 'corner_cw', { L: 0, R: 0 }, { L: false, R: false })
      const top    = wallStripExtent('W', tile, walls, 'corner_cw', { L: 0, R: 0 }, { L: false, R: true  })
      expect(top?.max).toBe(tile.T + walls.N)
      expect(middle?.max).toBe(tile.T)
      expect(bottom?.max).toBe(tile.T)
    })
  })
})
