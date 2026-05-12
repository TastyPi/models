import { describe, it, expect } from 'vitest'
import { EP_WALL_MIN, wallStripExtent, planTiles } from './gridfinity-baseplate'

const HALFORDS = {
  cells_x: 13, cells_y: 9,
  wall_n: 12.5, wall_s: 12.5, wall_e: 11, wall_w: 11,
  separate_walls: false,
}

describe('planTiles (halfords preset, Prusa Core One)', () => {
  const runWithBed = (bx: number, by: number) =>
    planTiles({ ...HALFORDS, bed: { x: bx, y: by } })

  it('returns 6 tiles for 250×220 bed', () => {
    expect(runWithBed(250, 220).tiles).toHaveLength(6)
  })

  it('returns the same 6 tiles for 220×250 bed', () => {
    const a = runWithBed(250, 220).tiles
    const b = runWithBed(220, 250).tiles
    expect(b).toHaveLength(6)
    expect(b.map(t => ({ label: t.label, nX: t.nX, nY: t.nY }))).toEqual(
      a.map(t => ({ label: t.label, nX: t.nX, nY: t.nY }))
    )
  })

  it('NW tile: 4 cols × 4 rows with N and W walls', () => {
    const { tiles } = runWithBed(250, 220)
    const nw = tiles.find(t => t.label === 'Tile C1-R2')!
    expect(nw).toBeDefined()
    expect(nw.nX).toBe(4)
    expect(nw.nY).toBe(4)
    expect(nw.wallN).toBe(12.5)
    expect(nw.wallS).toBe(0)
    expect(nw.wallE).toBe(0)
    expect(nw.wallW).toBe(11)
  })

  it('N tile: 5 cols × 4 rows with N wall only', () => {
    const { tiles } = runWithBed(250, 220)
    const n = tiles.find(t => t.label === 'Tile C2-R2')!
    expect(n.nX).toBe(5)
    expect(n.nY).toBe(4)
    expect(n.wallN).toBe(12.5)
    expect(n.wallS).toBe(0)
    expect(n.wallE).toBe(0)
    expect(n.wallW).toBe(0)
  })

  it('NE tile: 4 cols × 4 rows with N and E walls', () => {
    const { tiles } = runWithBed(250, 220)
    const ne = tiles.find(t => t.label === 'Tile C3-R2')!
    expect(ne.nX).toBe(4)
    expect(ne.nY).toBe(4)
    expect(ne.wallN).toBe(12.5)
    expect(ne.wallS).toBe(0)
    expect(ne.wallE).toBe(11)
    expect(ne.wallW).toBe(0)
  })

  it('SW tile: 4 cols × 5 rows with S and W walls', () => {
    const { tiles } = runWithBed(250, 220)
    const sw = tiles.find(t => t.label === 'Tile C1-R1')!
    expect(sw.nX).toBe(4)
    expect(sw.nY).toBe(5)
    expect(sw.wallN).toBe(0)
    expect(sw.wallS).toBe(12.5)
    expect(sw.wallE).toBe(0)
    expect(sw.wallW).toBe(11)
  })

  it('S tile: 5 cols × 5 rows with S wall only', () => {
    const { tiles } = runWithBed(250, 220)
    const s = tiles.find(t => t.label === 'Tile C2-R1')!
    expect(s.nX).toBe(5)
    expect(s.nY).toBe(5)
    expect(s.wallN).toBe(0)
    expect(s.wallS).toBe(12.5)
    expect(s.wallE).toBe(0)
    expect(s.wallW).toBe(0)
  })

  it('SE tile: 4 cols × 5 rows with S and E walls', () => {
    const { tiles } = runWithBed(250, 220)
    const se = tiles.find(t => t.label === 'Tile C3-R1')!
    expect(se.nX).toBe(4)
    expect(se.nY).toBe(5)
    expect(se.wallN).toBe(0)
    expect(se.wallS).toBe(12.5)
    expect(se.wallE).toBe(11)
    expect(se.wallW).toBe(0)
  })
})

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
