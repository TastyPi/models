import { getManifold } from '../manifold'
import type { Manifold } from 'manifold-3d'
import type { Attribution, ObjGeom, GeomResult } from '../types'
import { resolveBed, splitSizes, splitWallSizes, splitMaxInterior } from '../printBed'

// Gridfinity spec constants (from https://gridfinity.xyz/specification/)
// Profile coordinates sourced from gridfinity-rebuilt-openscad by Kenneth Hodson
const CELL = 42
const OUTER_R = 4
const BASE_H = 5
const CLEARANCE = BASE_H - 4.65
const CORE_HALF = CELL / 2 - OUTER_R
const R1 = OUTER_R - 2.85
const H1 = CLEARANCE
const R2 = R1 + 0.7
const H2 = H1 + 0.7
const H3 = H2 + 1.8

// Edge puzzle connector geometry (from GridFlock by Jonas Konrad)
const EP_TAB_W = 10
const EP_TAB_D = 2.5
const EP_NECK_W = 3
const EP_NECK_D = 1.2
const EP_GAP = 0.15
const EP_H_MALE = 2.0
const EP_H_FEMALE = 2.25
const EP_WALL_MIN = Math.ceil((EP_NECK_D + EP_TAB_D) / 0.5) * 0.5  // min wall depth to contain female socket pocket

const MAG_D = 6.0
const MAG_H = 2.4
const MAG_CORNER = CELL / 2 - 8.0

const PIECE_GAP = 5

export const attribution: Attribution[] = [
  { name: 'Gridfinity', author: 'Zachary Freedman / Voidstar Lab', url: 'https://www.youtube.com/watch?v=ra_9zU-mnl8', license: 'MIT' },
  { name: 'gridfinity-rebuilt-openscad', author: 'Kenneth Hodson', url: 'https://github.com/kennetek/gridfinity-rebuilt-openscad', license: 'MIT' },
  { name: 'GridFlock', author: 'Jonas Konrad', url: 'https://github.com/yawkat/GridFlock', license: 'MIT, CC BY 4.0' },
]

export const flatModel = true

export { OUTER_R, EP_WALL_MIN }

export function wallStripExtent(
  side: 'N' | 'S' | 'E' | 'W',
  tile: { L: number; R: number; B: number; T: number },
  walls: { N: number; S: number; E: number; W: number },
  outer: { L: boolean; R: boolean },
): { min: number; max: number } {
  if (side === 'N' || side === 'S') {
    let x0 = tile.L, x1 = tile.R
    if (side === 'N') { if (walls.E > 0 && outer.R) x1 += walls.E }
    else              { if (walls.W > 0 && outer.L) x0 -= walls.W }
    return { min: x0, max: x1 }
  } else {
    let y0 = tile.B, y1 = tile.T
    if (side === 'E') { if (walls.S > 0 && outer.L) y0 -= walls.S }
    else              { if (walls.N > 0 && outer.R) y1 += walls.N }
    return { min: y0, max: y1 }
  }
}

export interface TilePlan {
  label: string
  col: number
  row: number
  startX: number
  nX: number
  startY: number
  nY: number
  wallN: number
  wallS: number
  wallE: number
  wallW: number
  hasNConn: boolean
  hasSConn: boolean
  hasEConn: boolean
  hasWConn: boolean
}

function computeSplits(
  cells_x: number, cells_y: number,
  wall_n: number, wall_s: number, wall_e: number, wall_w: number,
  separate_walls: boolean,
  bedX: number, bedY: number,
): { sizesX: number[]; sizesY: number[] } {
  if (separate_walls) {
    return {
      sizesX: splitSizes(cells_x, Math.max(1, Math.floor(bedX / CELL))),
      sizesY: splitSizes(cells_y, Math.max(1, Math.floor(bedY / CELL))),
    }
  }
  return {
    sizesX: splitMaxInterior(cells_x, Math.floor(bedX / CELL),
      Math.max(1, Math.floor((bedX - wall_w) / CELL)),
      Math.max(1, Math.floor((bedX - wall_e) / CELL)),
      Math.max(1, Math.floor((bedX - wall_w - wall_e) / CELL))),
    sizesY: splitMaxInterior(cells_y, Math.floor(bedY / CELL),
      Math.max(1, Math.floor((bedY - wall_s) / CELL)),
      Math.max(1, Math.floor((bedY - wall_n) / CELL)),
      Math.max(1, Math.floor((bedY - wall_s - wall_n) / CELL))),
  }
}

export function planTiles(p: {
  cells_x: number; cells_y: number
  wall_n: number; wall_s: number; wall_e: number; wall_w: number
  separate_walls: boolean
  bed: { x: number; y: number }
}): { tiles: TilePlan[]; sizesX: number[]; sizesY: number[]; bed: { x: number; y: number }; swapped: boolean } {
  const { cells_x, cells_y, wall_n, wall_s, wall_e, wall_w, separate_walls, bed: rawBed } = p

  const standard = computeSplits(cells_x, cells_y, wall_n, wall_s, wall_e, wall_w, separate_walls, rawBed.x, rawBed.y)
  const swapped  = computeSplits(cells_x, cells_y, wall_n, wall_s, wall_e, wall_w, separate_walls, rawBed.y, rawBed.x)
  const useSwap = swapped.sizesX.length * swapped.sizesY.length < standard.sizesX.length * standard.sizesY.length
  const { sizesX, sizesY } = useSwap ? swapped : standard
  const bed = useSwap ? { x: rawBed.y, y: rawBed.x } : rawBed

  const cols = sizesX.length, rows = sizesY.length
  const tileLabel = (pi: number, pj: number) =>
    cols === 1 && rows === 1 ? 'Tile' : `Tile C${pi + 1}-R${pj + 1}`

  const tiles: TilePlan[] = []
  let startX = 0
  for (let pi = 0; pi < cols; pi++) {
    let startY = 0
    for (let pj = 0; pj < rows; pj++) {
      const isN = pj === rows - 1, isS = pj === 0
      const isE = pi === cols - 1, isW = pi === 0
      tiles.push({
        label: tileLabel(pi, pj),
        col: pi, row: pj,
        startX, nX: sizesX[pi],
        startY, nY: sizesY[pj],
        wallN: isN ? wall_n : 0, wallS: isS ? wall_s : 0,
        wallE: isE ? wall_e : 0, wallW: isW ? wall_w : 0,
        hasNConn: !isN, hasSConn: !isS, hasEConn: !isE, hasWConn: !isW,
      })
      startY += sizesY[pj]
    }
    startX += sizesX[pi]
  }
  return { tiles, sizesX, sizesY, bed, swapped: useSwap }
}

export interface Params {
  cells_x: number
  cells_y: number
  wall_n: number | null
  wall_s: number | null
  wall_e: number | null
  wall_w: number | null
  separate_walls: boolean
  wall_connector: string
  corner_radius_sw: number
  corner_radius_se: number
  corner_radius_ne: number
  corner_radius_nw: number
  base_style: string
  magnets: boolean
  restrict_bed: boolean
  bed_type: string
  bed_x: number
  bed_y: number
  edge_n?: string
  edge_s?: string
  edge_e?: string
  edge_w?: string
}

export function generate(params: Params): GeomResult {
  const { cells_x, cells_y, separate_walls, wall_connector, corner_radius_sw, corner_radius_se, corner_radius_ne, corner_radius_nw, base_style, magnets, restrict_bed, bed_type, bed_x, bed_y, edge_n, edge_s, edge_e, edge_w } = params
  const wall_n = params.wall_n ?? 0
  const wall_s = params.wall_s ?? 0
  const wall_e = params.wall_e ?? 0
  const wall_w = params.wall_w ?? 0
    const { Manifold, CrossSection } = getManifold()
    const wallFemale = wall_connector === 'wall_female'
    const rSW = corner_radius_sw, rSE = corner_radius_se, rNE = corner_radius_ne, rNW = corner_radius_nw

    // Selective corner rounding: per-corner radii (0 = sharp).
    // Builds an explicit polygon so sharp corners are exact and only one CrossSection is created.
    const selRRect = (x0: number, y0: number, x1: number, y1: number, sw: number, se: number, ne: number, nw: number): any => {
      const w = x1 - x0, h = y1 - y0
      const clamp = (r: number) => r > 0 ? Math.min(r, w / 2 - 0.01, h / 2 - 0.01) : 0
      const cSW = clamp(sw), cSE = clamp(se), cNE = clamp(ne), cNW = clamp(nw)
      if (cSW <= 0 && cSE <= 0 && cNE <= 0 && cNW <= 0) {
        return CrossSection.square([w, h]).translate([x0, y0])
      }
      const arc = (cx: number, cy: number, r: number, a0: number, a1: number): [number, number][] => {
        const pts: [number, number][] = []
        for (let i = 0; i <= 8; i++) {
          const a = a0 + (a1 - a0) * i / 8
          pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
        }
        return pts
      }
      const pts: [number, number][] = [
        ...(cSW > 0 ? arc(x0 + cSW, y0 + cSW, cSW, Math.PI, Math.PI * 1.5)      : [[x0, y0] satisfies [number, number]]),
        ...(cSE > 0 ? arc(x1 - cSE, y0 + cSE, cSE, Math.PI * 1.5, Math.PI * 2)  : [[x1, y0] satisfies [number, number]]),
        ...(cNE > 0 ? arc(x1 - cNE, y1 - cNE, cNE, 0, Math.PI * 0.5)            : [[x1, y1] satisfies [number, number]]),
        ...(cNW > 0 ? arc(x0 + cNW, y1 - cNW, cNW, Math.PI * 0.5, Math.PI)      : [[x0, y1] satisfies [number, number]]),
      ]
      return new CrossSection(pts, 'NonZero')
    }
    // ── 2D helpers ──────────────────────────────────────────────────────────

    const roundBarX = (w: number, h: number) => {
      const r = h / 2
      return CrossSection.hull([
        CrossSection.circle(r).translate([r, r]),
        CrossSection.circle(r).translate([w - r, r]),
      ])
    }

    const roundBarXNeg = (w: number, h: number) => {
      const r = h / 2
      return CrossSection.square([w + 2 * r, h]).translate([-r, 0])
        .subtract(
          CrossSection.circle(r).translate([-r, r])
            .add(CrossSection.circle(r).translate([w + r, r]))
        )
    }

    // ── Gridfinity cell void ─────────────────────────────────────────────────
    const voidCS = (r: number) =>
      CrossSection.square([2 * CORE_HALF, 2 * CORE_HALF], true).offset(r)

    const voidSlab = (r: number, cx: number, cy: number, z: number) =>
      voidCS(r).extrude(0.01).translate([cx, cy, z])

    const cellVoid = (cx: number, cy: number) => Manifold.union([
      Manifold.hull([voidSlab(R1, cx, cy, H1), voidSlab(R2, cx, cy, H2)]),
      voidCS(R2).extrude(H3 - H2).translate([cx, cy, H2]),
      Manifold.hull([voidSlab(R2, cx, cy, H3), voidSlab(OUTER_R, cx, cy, BASE_H)]),
    ])

    const adjCellSolid = (cx: number, cy: number) =>
      CrossSection.square([CELL, CELL]).translate([cx - CELL / 2, cy - CELL / 2]).extrude(BASE_H)
        .subtract(cellVoid(cx, cy))

    // ── Connector profiles ───────────────────────────────────────────────────
    const malePiece =
      roundBarXNeg(EP_NECK_W, EP_NECK_D).translate([-EP_NECK_W / 2, 0])
        .add(roundBarX(EP_TAB_W, EP_TAB_D).translate([-EP_TAB_W / 2, EP_NECK_D]))

    const femalePiece =
      roundBarXNeg(EP_NECK_W + 2 * EP_GAP, EP_NECK_D - EP_GAP)
        .translate([-(EP_NECK_W / 2 + EP_GAP), 0])
        .add(
          roundBarX(EP_TAB_W + EP_GAP, EP_TAB_D + EP_GAP)
            .translate([-(EP_TAB_W / 2 + EP_GAP), EP_NECK_D - EP_GAP])
        )

    // Directional variants — all protrude outward in their named direction
    const maleNorth  = malePiece                    // +Y
    const maleSouth  = malePiece.mirror([0, 1])     // -Y
    const maleEast   = malePiece.rotate(-90)        // +X
    const maleWest   = malePiece.rotate(90)         // -X

    const femaleNorth = femalePiece.mirror([0, 1])  // socket opens +Y
    const femaleSouth = femalePiece                 // socket opens -Y
    const femaleEast  = femalePiece.rotate(90)      // socket opens +X
    const femaleWest  = femalePiece.rotate(-90)     // socket opens -X

    // ── Build one tile piece ─────────────────────────────────────────────────
    const buildPiece = (
      startX: number, nX: number,
      startY: number, nY: number,
      wallN: number, wallS: number, wallE: number, wallW: number,
      hasNConn: boolean, hasSConn: boolean, hasEConn: boolean, hasWConn: boolean,
      wallsSep: boolean,
    ) => {
      const cellXC = Array.from({ length: nX }, (_, i) => (startX + i - (cells_x - 1) / 2) * CELL)
      const cellYC = Array.from({ length: nY }, (_, j) => (startY + j - (cells_y - 1) / 2) * CELL)

      const tileL = cellXC[0]     - CELL / 2
      const tileR = cellXC[nX-1]  + CELL / 2
      const tileB = cellYC[0]     - CELL / 2
      const tileT = cellYC[nY-1]  + CELL / 2

      // ── Footprint ───────────────────────────────────────────────────────────
      // Fused walls form a simple bounding rectangle; separate-walls tile is just the cell area.
      const fpX0 = wallsSep ? tileL : tileL - wallW
      const fpX1 = wallsSep ? tileR : tileR + wallE
      const fpY0 = wallsSep ? tileB : tileB - wallS
      const fpY1 = wallsSep ? tileT : tileT + wallN
      // Tile piece never has outer corners (all edges connect to wall strips or splits).
      // Fused piece: round only corners where this piece reaches the outer plate boundary.
      const fpCS = wallsSep
        ? selRRect(fpX0, fpY0, fpX1, fpY1,
            !hasSConn && !hasWConn && !(wallS > 0) && !(wallW > 0) ? rSW : 0,
            !hasSConn && !hasEConn && !(wallS > 0) && !(wallE > 0) ? rSE : 0,
            !hasNConn && !hasEConn && !(wallN > 0) && !(wallE > 0) ? rNE : 0,
            !hasNConn && !hasWConn && !(wallN > 0) && !(wallW > 0) ? rNW : 0,
          )
        : selRRect(fpX0, fpY0, fpX1, fpY1,
            !hasSConn && !hasWConn ? rSW : 0,
            !hasSConn && !hasEConn ? rSE : 0,
            !hasNConn && !hasEConn ? rNE : 0,
            !hasNConn && !hasWConn ? rNW : 0,
          )
      let piece = fpCS.extrude(BASE_H)

      // ── Cell voids ──────────────────────────────────────────────────────────
      piece = piece.subtract(Manifold.union(cellXC.flatMap(cx => cellYC.map(cy => cellVoid(cx, cy)))))

      // ── Open base ───────────────────────────────────────────────────────────
      if (base_style === 'open') {
        piece = piece.subtract(Manifold.union(
          cellXC.flatMap(cx => cellYC.map(cy => voidCS(R1).extrude(H1 + 0.01).translate([cx, cy, 0])))
        ))
      }

      // ── Connectors ──────────────────────────────────────────────────────────
      const toAdd: any[] = []
      const toSub: any[] = []

      const maleN = (cx: number) => maleNorth.translate([cx, tileT]).extrude(EP_H_MALE).intersect(adjCellSolid(cx, tileT + CELL / 2))
      const maleS = (cx: number) => maleSouth.translate([cx, tileB]).extrude(EP_H_MALE).intersect(adjCellSolid(cx, tileB - CELL / 2))
      const maleE = (cy: number) => maleEast.translate([tileR, cy]).extrude(EP_H_MALE).intersect(adjCellSolid(tileR + CELL / 2, cy))
      const maleW = (cy: number) => maleWest.translate([tileL, cy]).extrude(EP_H_MALE).intersect(adjCellSolid(tileL - CELL / 2, cy))

      // Inner split connectors (E/S faces get male, N/W get female)
      if (hasNConn) for (const cx of cellXC) toSub.push(femaleNorth.translate([cx, tileT]).extrude(EP_H_FEMALE))
      if (hasSConn) for (const cx of cellXC) toAdd.push(maleS(cx))
      if (hasEConn) for (const cy of cellYC) toAdd.push(maleE(cy))
      if (hasWConn) for (const cy of cellYC) toSub.push(femaleWest.translate([tileL, cy]).extrude(EP_H_FEMALE))

      // Separate-wall connectors on outer walled faces
      if (wallsSep) {
        if (wallN > 0) for (const cx of cellXC) {
          if (wallFemale) toAdd.push(maleN(cx))
          else            toSub.push(femaleNorth.translate([cx, tileT]).extrude(EP_H_FEMALE))
        }
        if (wallS > 0) for (const cx of cellXC) {
          if (wallFemale) toAdd.push(maleS(cx))
          else            toSub.push(femaleSouth.translate([cx, tileB]).extrude(EP_H_FEMALE))
        }
        if (wallE > 0) for (const cy of cellYC) {
          if (wallFemale) toAdd.push(maleE(cy))
          else            toSub.push(femaleEast.translate([tileR, cy]).extrude(EP_H_FEMALE))
        }
        if (wallW > 0) for (const cy of cellYC) {
          if (wallFemale) toAdd.push(maleW(cy))
          else            toSub.push(femaleWest.translate([tileL, cy]).extrude(EP_H_FEMALE))
        }
      }

      if (toAdd.length > 0) piece = piece.add(Manifold.union(toAdd))
      if (toSub.length > 0) piece = piece.subtract(Manifold.union(toSub))

      // ── Magnet pockets ──────────────────────────────────────────────────────
      if (base_style === 'solid' && magnets) {
        piece = piece.subtract(Manifold.union(
          cellXC.flatMap(cx => cellYC.flatMap(cy =>
            [[cx + MAG_CORNER, cy + MAG_CORNER], [cx - MAG_CORNER, cy + MAG_CORNER],
             [cx - MAG_CORNER, cy - MAG_CORNER], [cx + MAG_CORNER, cy - MAG_CORNER]]
              .map(([mx, my]) => Manifold.cylinder(MAG_H, MAG_D / 2, MAG_D / 2, 32).translate([mx, my, 0]))
          ))
        ))
      }

      return piece
    }

    // ── Build a separate wall strip ──────────────────────────────────────────
    // Corner ownership (clockwise): N takes NE, S takes SW, E takes SE, W takes NW.
    const buildWallStrip = (
      side: 'N' | 'S' | 'E' | 'W',
      cellXC: number[], cellYC: number[],
      wallN: number, wallS: number, wallE: number, wallW: number,
      outerL = true, outerR = true, // whether each end faces the outer plate boundary
    ): any => {
      const nX = cellXC.length, nY = cellYC.length
      const tileL = cellXC[0]     - CELL / 2
      const tileR = cellXC[nX-1]  + CELL / 2
      const tileB = cellYC[0]     - CELL / 2
      const tileT = cellYC[nY-1]  + CELL / 2
      const toAdd: any[] = []
      const toSub: any[] = []
      let strip: any

      const tile = { L: tileL, R: tileR, B: tileB, T: tileT }
      const walls = { N: wallN, S: wallS, E: wallE, W: wallW }
      const ext = wallStripExtent(side, tile, walls, { L: outerL, R: outerR })

      if (side === 'N') {
        const { min: x0, max: x1 } = ext
        const nNW = outerL && !(wallW > 0)
        const nNE = outerR
        strip = selRRect(x0, tileT, x1, tileT + wallN, 0, 0, nNE ? rNE : 0, nNW ? rNW : 0).extrude(BASE_H)
        for (const cx of cellXC) {
          if (cx < x0 + CELL / 2 || cx > x1 - CELL / 2) continue
          if (wallFemale) toSub.push(femaleSouth.translate([cx, tileT]).extrude(EP_H_FEMALE))
          else            toAdd.push(maleSouth.translate([cx, tileT]).extrude(EP_H_MALE).intersect(adjCellSolid(cx, tileT - CELL / 2)))
        }
      } else if (side === 'S') {
        const { min: x0, max: x1 } = ext
        const sSW = outerL
        const sSE = outerR && !(wallE > 0)
        strip = selRRect(x0, tileB - wallS, x1, tileB, sSW ? rSW : 0, sSE ? rSE : 0, 0, 0).extrude(BASE_H)
        for (const cx of cellXC) {
          if (cx < x0 + CELL / 2 || cx > x1 - CELL / 2) continue
          if (wallFemale) toSub.push(femaleNorth.translate([cx, tileB]).extrude(EP_H_FEMALE))
          else            toAdd.push(maleNorth.translate([cx, tileB]).extrude(EP_H_MALE).intersect(adjCellSolid(cx, tileB + CELL / 2)))
        }
      } else if (side === 'E') {
        const { min: y0, max: y1 } = ext
        const eSE = outerL
        const eNE = outerR && !(wallN > 0)
        strip = selRRect(tileR, y0, tileR + wallE, y1, 0, eSE ? rSE : 0, eNE ? rNE : 0, 0).extrude(BASE_H)
        for (const cy of cellYC) {
          if (cy < y0 + CELL / 2 || cy > y1 - CELL / 2) continue
          if (wallFemale) toSub.push(femaleWest.translate([tileR, cy]).extrude(EP_H_FEMALE))
          else            toAdd.push(maleWest.translate([tileR, cy]).extrude(EP_H_MALE).intersect(adjCellSolid(tileR - CELL / 2, cy)))
        }
      } else {
        const { min: y0, max: y1 } = ext
        const wSW = outerL && !(wallS > 0)
        const wNW = outerR
        strip = selRRect(tileL - wallW, y0, tileL, y1, wSW ? rSW : 0, 0, 0, wNW ? rNW : 0).extrude(BASE_H)
        for (const cy of cellYC) {
          if (cy < y0 + CELL / 2 || cy > y1 - CELL / 2) continue
          if (wallFemale) toSub.push(femaleEast.translate([tileL, cy]).extrude(EP_H_FEMALE))
          else            toAdd.push(maleEast.translate([tileL, cy]).extrude(EP_H_MALE).intersect(adjCellSolid(tileL + CELL / 2, cy)))
        }
      }

      if (toAdd.length > 0) strip = strip.add(Manifold.union(toAdd))
      if (toSub.length > 0) strip = strip.subtract(Manifold.union(toSub))
      return strip
    }

    // ── Assemble ─────────────────────────────────────────────────────────────
    const labeled: ObjGeom[] = []

    const WALL_SETTINGS: Record<string, string> = { fill_density: '5%', fill_pattern: 'zigzag' }
    const GRID_SETTINGS: Record<string, string> = { fill_density: '0%' }

    const pushStrip = (label: string, strip: any | null, dx: number, dy: number) => {
      if (strip) labeled.push({ label, parts: [{ label, geom: strip.translate([dx, dy, 0]), settings: WALL_SETTINGS }] })
    }

    let exportTransform: ((g: Manifold) => Manifold) | undefined

    if (!restrict_bed) {
      const cellXC = Array.from({ length: cells_x }, (_, i) => (i - (cells_x - 1) / 2) * CELL)
      const cellYC = Array.from({ length: cells_y }, (_, j) => (j - (cells_y - 1) / 2) * CELL)
      const tileL = -(cells_x / 2) * CELL
      const tileR =  (cells_x / 2) * CELL
      const tileB = -(cells_y / 2) * CELL
      const tileT =  (cells_y / 2) * CELL

      const eN = edge_n ?? 'wall'
      const eS = edge_s ?? 'wall'
      const eE = edge_e ?? 'wall'
      const eW = edge_w ?? 'wall'
      const wN = eN === 'wall' ? wall_n : 0
      const wS = eS === 'wall' ? wall_s : 0
      const wE = eE === 'wall' ? wall_e : 0
      const wW = eW === 'wall' ? wall_w : 0

      let tile = buildPiece(0, cells_x, 0, cells_y, wN, wS, wE, wW, false, false, false, false, false)

      const toAdd: any[] = [], toSub: any[] = []

      if (eN === 'male')   for (const cx of cellXC) toAdd.push(maleNorth.translate([cx, tileT]).extrude(EP_H_MALE).intersect(adjCellSolid(cx, tileT + CELL / 2)))
      if (eN === 'female') for (const cx of cellXC) toSub.push(femaleNorth.translate([cx, tileT]).extrude(EP_H_FEMALE))
      if (eS === 'male')   for (const cx of cellXC) toAdd.push(maleSouth.translate([cx, tileB]).extrude(EP_H_MALE).intersect(adjCellSolid(cx, tileB - CELL / 2)))
      if (eS === 'female') for (const cx of cellXC) toSub.push(femaleSouth.translate([cx, tileB]).extrude(EP_H_FEMALE))
      if (eE === 'male')   for (const cy of cellYC) toAdd.push(maleEast.translate([tileR, cy]).extrude(EP_H_MALE).intersect(adjCellSolid(tileR + CELL / 2, cy)))
      if (eE === 'female') for (const cy of cellYC) toSub.push(femaleEast.translate([tileR, cy]).extrude(EP_H_FEMALE))
      if (eW === 'male')   for (const cy of cellYC) toAdd.push(maleWest.translate([tileL, cy]).extrude(EP_H_MALE).intersect(adjCellSolid(tileL - CELL / 2, cy)))
      if (eW === 'female') for (const cy of cellYC) toSub.push(femaleWest.translate([tileL, cy]).extrude(EP_H_FEMALE))

      if (toAdd.length > 0) tile = tile.add(Manifold.union(toAdd))
      if (toSub.length > 0) tile = tile.subtract(Manifold.union(toSub))

      const hasWall = wN > 0 || wS > 0 || wE > 0 || wW > 0
      if (hasWall) {
        const extN = eN === 'male' ? EP_TAB_D + EP_NECK_D + 1 : 0
        const extS = eS === 'male' ? EP_TAB_D + EP_NECK_D + 1 : 0
        const extE = eE === 'male' ? EP_TAB_D + EP_NECK_D + 1 : 0
        const extW = eW === 'male' ? EP_TAB_D + EP_NECK_D + 1 : 0
        const clipBox = Manifold.cube([tileR - tileL + extE + extW, tileT - tileB + extN + extS, BASE_H + 2])
          .translate([tileL - extW, tileB - extS, -1])
        labeled.push({ label: 'Tile', parts: [
          { label: 'Grid', geom: tile.intersect(clipBox), settings: GRID_SETTINGS },
          { label: 'Wall', geom: tile.subtract(clipBox), settings: WALL_SETTINGS },
        ] })
      } else {
        labeled.push({ label: 'Tile', parts: [{ label: 'Tile', geom: tile, settings: GRID_SETTINGS }] })
      }
    } else {
      const rawBed = resolveBed(bed_type, bed_x, bed_y)
      const { tiles, sizesX, sizesY, bed, swapped } = planTiles({ cells_x, cells_y, wall_n, wall_s, wall_e, wall_w, separate_walls, bed: rawBed })
      if (swapped) exportTransform = (g: Manifold) => g.rotate(0, 0, 90)
      const maxCellsX = Math.max(1, Math.floor(bed.x / CELL))
      const maxCellsY = Math.max(1, Math.floor(bed.y / CELL))
      const cols = sizesX.length, rows = sizesY.length
      const baseX = -(cols - 1) / 2 * PIECE_GAP
      const baseY = -(rows - 1) / 2 * PIECE_GAP
      const wallLabel = (dir: string, count: number, idx: number) =>
        count === 1 ? `${dir} wall` : `${dir} wall ${idx + 1}`

      // Tiles
      for (const tile of tiles) {
        const piece = buildPiece(tile.startX, tile.nX, tile.startY, tile.nY,
          tile.wallN, tile.wallS, tile.wallE, tile.wallW,
          tile.hasNConn, tile.hasSConn, tile.hasEConn, tile.hasWConn,
          separate_walls)
        const tx = tile.col * PIECE_GAP + baseX
        const ty = tile.row * PIECE_GAP + baseY
        const tileHasWall = !separate_walls && (tile.wallN > 0 || tile.wallS > 0 || tile.wallE > 0 || tile.wallW > 0)
        if (tileHasWall) {
          const tL = (tile.startX - (cells_x - 1) / 2) * CELL - CELL / 2
          const tR = (tile.startX + tile.nX - 1 - (cells_x - 1) / 2) * CELL + CELL / 2
          const tB = (tile.startY - (cells_y - 1) / 2) * CELL - CELL / 2
          const tT = (tile.startY + tile.nY - 1 - (cells_y - 1) / 2) * CELL + CELL / 2
          const extS = tile.hasSConn ? EP_TAB_D + EP_NECK_D + 1 : 0
          const extE = tile.hasEConn ? EP_TAB_D + EP_NECK_D + 1 : 0
          const clipBox = Manifold.cube([tR - tL + extE, tT - tB + extS, BASE_H + 2])
            .translate([tL, tB - extS, -1])
          labeled.push({ label: tile.label, parts: [
            { label: 'Grid', geom: piece.intersect(clipBox).translate([tx, ty, 0]), settings: GRID_SETTINGS },
            { label: 'Wall', geom: piece.subtract(clipBox).translate([tx, ty, 0]), settings: WALL_SETTINGS },
          ] })
        } else {
          labeled.push({ label: tile.label, parts: [{ label: tile.label, geom: piece.translate([tx, ty, 0]), settings: GRID_SETTINGS }] })
        }
      }

      if (separate_walls) {
        const fullCellXC = Array.from({ length: cells_x }, (_, i) => (i - (cells_x - 1) / 2) * CELL)
        const fullCellYC = Array.from({ length: cells_y }, (_, j) => (j - (cells_y - 1) / 2) * CELL)

        // N corner is at right end (NE, adds wall_e width); S corner is at left end (SW, adds wall_w width).
        const mcNX = Math.max(1, Math.floor((bed.x - wall_e) / CELL))
        const mcSX = Math.max(1, Math.floor((bed.x - wall_w) / CELL))
        const wallSizesN = splitWallSizes(cells_x, maxCellsX, mcNX, wall_e > 0 ? true : null)
        const wallSizesS = splitWallSizes(cells_x, maxCellsX, mcSX, wall_w > 0 ? false : null)
        let wallNStartX = 0
        if (wall_n > 0) {
          for (let pi = 0; pi < wallSizesN.length; pi++) {
            const segCellXC = Array.from({ length: wallSizesN[pi] }, (_, i) => (wallNStartX + i - (cells_x - 1) / 2) * CELL)
            pushStrip(wallLabel('North', wallSizesN.length, pi), buildWallStrip('N', segCellXC, fullCellYC, wall_n, wall_s, wall_e, wall_w, pi === 0, pi === wallSizesN.length - 1), pi * PIECE_GAP + baseX, rows * PIECE_GAP + baseY)
            wallNStartX += wallSizesN[pi]
          }
        }
        let wallSStartX = 0
        if (wall_s > 0) {
          for (let pi = 0; pi < wallSizesS.length; pi++) {
            const segCellXC = Array.from({ length: wallSizesS[pi] }, (_, i) => (wallSStartX + i - (cells_x - 1) / 2) * CELL)
            pushStrip(wallLabel('South', wallSizesS.length, pi), buildWallStrip('S', segCellXC, fullCellYC, wall_n, wall_s, wall_e, wall_w, pi === 0, pi === wallSizesS.length - 1), pi * PIECE_GAP + baseX, -PIECE_GAP + baseY)
            wallSStartX += wallSizesS[pi]
          }
        }
        // E corner is at bottom end (SE, adds wall_s height); W corner is at top end (NW, adds wall_n height).
        const mcEY = Math.max(1, Math.floor((bed.y - wall_s) / CELL))
        const mcWY = Math.max(1, Math.floor((bed.y - wall_n) / CELL))
        const wallSizesE = splitWallSizes(cells_y, maxCellsY, mcEY, wall_s > 0 ? false : null)
        const wallSizesW = splitWallSizes(cells_y, maxCellsY, mcWY, wall_n > 0 ? true : null)
        let wallEStartY = 0
        if (wall_e > 0) {
          for (let pj = 0; pj < wallSizesE.length; pj++) {
            const segCellYC = Array.from({ length: wallSizesE[pj] }, (_, j) => (wallEStartY + j - (cells_y - 1) / 2) * CELL)
            pushStrip(wallLabel('East', wallSizesE.length, pj), buildWallStrip('E', fullCellXC, segCellYC, wall_n, wall_s, wall_e, wall_w, pj === 0, pj === wallSizesE.length - 1), cols * PIECE_GAP + baseX, pj * PIECE_GAP + baseY)
            wallEStartY += wallSizesE[pj]
          }
        }
        let wallWStartY = 0
        if (wall_w > 0) {
          for (let pj = 0; pj < wallSizesW.length; pj++) {
            const segCellYC = Array.from({ length: wallSizesW[pj] }, (_, j) => (wallWStartY + j - (cells_y - 1) / 2) * CELL)
            pushStrip(wallLabel('West', wallSizesW.length, pj), buildWallStrip('W', fullCellXC, segCellYC, wall_n, wall_s, wall_e, wall_w, pj === 0, pj === wallSizesW.length - 1), -PIECE_GAP + baseX, pj * PIECE_GAP + baseY)
            wallWStartY += wallSizesW[pj]
          }
        }
      }
    }

    return { objects: labeled, exportTransform }
}
