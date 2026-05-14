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

describe('planTiles — col/row symmetry for piece centering', () => {
  // The display layout offsets each piece by (col - (cols-1)/2) * PIECE_GAP in X
  // and (row - (rows-1)/2) * PIECE_GAP in Y. Correct col/row values are what
  // makes that formula symmetric around the origin.

  it('2-column split: cols are 0 and 1', () => {
    // 10 cells wide, bed fits 5 → forced 2-column split
    const { tiles, sizesX } = planTiles({
      cells_x: 10, cells_y: 2, ...{ wall_n: 0, wall_s: 0, wall_e: 0, wall_w: 0 },
      separate_walls: false, bed: { x: 5 * 42, y: 220 },
    })
    expect(sizesX).toHaveLength(2)
    const cols = tiles.map(t => t.col).sort()
    expect(cols).toEqual([0, 1])
  })

  it('2-row split: rows are 0 and 1', () => {
    const { tiles, sizesY } = planTiles({
      cells_x: 2, cells_y: 10, ...{ wall_n: 0, wall_s: 0, wall_e: 0, wall_w: 0 },
      separate_walls: false, bed: { x: 220, y: 5 * 42 },
    })
    expect(sizesY).toHaveLength(2)
    const rows = tiles.map(t => t.row).sort()
    expect(rows).toEqual([0, 1])
  })

  it('2×2 split: all four (col,row) combinations present', () => {
    const { tiles } = planTiles({
      cells_x: 10, cells_y: 10, ...{ wall_n: 0, wall_s: 0, wall_e: 0, wall_w: 0 },
      separate_walls: false, bed: { x: 5 * 42, y: 5 * 42 },
    })
    expect(tiles).toHaveLength(4)
    const coords = new Set(tiles.map(t => `${t.col},${t.row}`))
    expect(coords).toEqual(new Set(['0,0', '1,0', '0,1', '1,1']))
  })

  it('startX is cumulative across columns', () => {
    const { tiles, sizesX } = planTiles({
      cells_x: 10, cells_y: 2, ...{ wall_n: 0, wall_s: 0, wall_e: 0, wall_w: 0 },
      separate_walls: false, bed: { x: 5 * 42, y: 220 },
    })
    const col0 = tiles.find(t => t.col === 0)!
    const col1 = tiles.find(t => t.col === 1)!
    expect(col0.startX).toBe(0)
    expect(col1.startX).toBe(sizesX[0])
  })

  it('startY is cumulative across rows', () => {
    const { tiles, sizesY } = planTiles({
      cells_x: 2, cells_y: 10, ...{ wall_n: 0, wall_s: 0, wall_e: 0, wall_w: 0 },
      separate_walls: false, bed: { x: 220, y: 5 * 42 },
    })
    const row0 = tiles.find(t => t.row === 0)!
    const row1 = tiles.find(t => t.row === 1)!
    expect(row0.startY).toBe(0)
    expect(row1.startY).toBe(sizesY[0])
  })

  it('all nX values sum to cells_x across any row', () => {
    const cells_x = 10
    const { tiles, sizesX } = planTiles({
      cells_x, cells_y: 4, ...{ wall_n: 0, wall_s: 0, wall_e: 0, wall_w: 0 },
      separate_walls: false, bed: { x: 5 * 42, y: 220 },
    })
    const row0tiles = tiles.filter(t => t.row === 0)
    expect(row0tiles.reduce((s, t) => s + t.nX, 0)).toBe(cells_x)
    expect(sizesX.reduce((a, b) => a + b, 0)).toBe(cells_x)
  })

  it('all nY values sum to cells_y across any column', () => {
    const cells_y = 10
    const { tiles, sizesY } = planTiles({
      cells_x: 4, cells_y, ...{ wall_n: 0, wall_s: 0, wall_e: 0, wall_w: 0 },
      separate_walls: false, bed: { x: 220, y: 5 * 42 },
    })
    const col0tiles = tiles.filter(t => t.col === 0)
    expect(col0tiles.reduce((s, t) => s + t.nY, 0)).toBe(cells_y)
    expect(sizesY.reduce((a, b) => a + b, 0)).toBe(cells_y)
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

  it('N strip: only extends right on the outermost (right) segment', () => {
    const left   = wallStripExtent('N', tile, walls, { L: true,  R: false })
    const middle = wallStripExtent('N', tile, walls, { L: false, R: false })
    const right  = wallStripExtent('N', tile, walls, { L: false, R: true  })
    expect(left.max).toBe(tile.R)
    expect(middle.max).toBe(tile.R)
    expect(right.max).toBe(tile.R + walls.E)
  })

  it('S strip: only extends left on the outermost (left) segment', () => {
    const left   = wallStripExtent('S', tile, walls, { L: true,  R: false })
    const middle = wallStripExtent('S', tile, walls, { L: false, R: false })
    const right  = wallStripExtent('S', tile, walls, { L: false, R: true  })
    expect(left.min).toBe(tile.L - walls.W)
    expect(middle.min).toBe(tile.L)
    expect(right.min).toBe(tile.L)
  })

  it('E strip: only extends down on the outermost (bottom) segment', () => {
    const bottom = wallStripExtent('E', tile, walls, { L: true,  R: false })
    const middle = wallStripExtent('E', tile, walls, { L: false, R: false })
    const top    = wallStripExtent('E', tile, walls, { L: false, R: true  })
    expect(bottom.min).toBe(tile.B - walls.S)
    expect(middle.min).toBe(tile.B)
    expect(top.min).toBe(tile.B)
  })

  it('W strip: only extends up on the outermost (top) segment', () => {
    const bottom = wallStripExtent('W', tile, walls, { L: true,  R: false })
    const middle = wallStripExtent('W', tile, walls, { L: false, R: false })
    const top    = wallStripExtent('W', tile, walls, { L: false, R: true  })
    expect(top.max).toBe(tile.T + walls.N)
    expect(middle.max).toBe(tile.T)
    expect(bottom.max).toBe(tile.T)
  })
})
