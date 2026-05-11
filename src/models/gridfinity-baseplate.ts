import { getManifold } from '../manifold'
import type { Attribution } from '../types'
import { resolveBed, splitSizes, splitMaxInterior } from '../printBed'

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
const EP_WALL_MIN = Math.ceil((EP_NECK_D + EP_TAB_D + EP_GAP) / 0.5) * 0.5  // min wall depth to contain female socket pocket

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
  cStyle: string,
  arm: { L: number; R: number },
  outer: { L: boolean; R: boolean },
): { min: number; max: number } | null {
  if (side === 'N' || side === 'S') {
    let x0 = tile.L, x1 = tile.R
    if (cStyle === 'corner_l') { x0 += arm.L; x1 -= arm.R }
    else if (side === 'N') {
      if (cStyle === 'corner_ns')  { if (walls.W > 0 && outer.L) x0 -= walls.W; if (walls.E > 0 && outer.R) x1 += walls.E }
      else if (cStyle === 'corner_cw')  { if (walls.E > 0 && outer.R) x1 += walls.E }
      else if (cStyle === 'corner_ccw') { if (walls.W > 0 && outer.L) x0 -= walls.W }
    } else {
      if (cStyle === 'corner_ns')  { if (walls.W > 0 && outer.L) x0 -= walls.W; if (walls.E > 0 && outer.R) x1 += walls.E }
      else if (cStyle === 'corner_cw')  { if (walls.W > 0 && outer.L) x0 -= walls.W }
      else if (cStyle === 'corner_ccw') { if (walls.E > 0 && outer.R) x1 += walls.E }
    }
    return x1 <= x0 ? null : { min: x0, max: x1 }
  } else {
    let y0 = tile.B, y1 = tile.T
    if (cStyle === 'corner_l') { y0 += arm.L; y1 -= arm.R }
    else if (side === 'E') {
      if (cStyle === 'corner_ew')  { if (walls.S > 0 && outer.L) y0 -= walls.S; if (walls.N > 0 && outer.R) y1 += walls.N }
      else if (cStyle === 'corner_cw')  { if (walls.S > 0 && outer.L) y0 -= walls.S }
      else if (cStyle === 'corner_ccw') { if (walls.N > 0 && outer.R) y1 += walls.N }
    } else {
      if (cStyle === 'corner_ew')  { if (walls.S > 0 && outer.L) y0 -= walls.S; if (walls.N > 0 && outer.R) y1 += walls.N }
      else if (cStyle === 'corner_cw')  { if (walls.N > 0 && outer.R) y1 += walls.N }
      else if (cStyle === 'corner_ccw') { if (walls.S > 0 && outer.L) y0 -= walls.S }
    }
    return y1 <= y0 ? null : { min: y0, max: y1 }
  }
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
  corner_style: string
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

export function generate(params: Params) {
  const { cells_x, cells_y, separate_walls, wall_connector, corner_style, corner_radius_sw, corner_radius_se, corner_radius_ne, corner_radius_nw, base_style, magnets, restrict_bed, bed_type, bed_x, bed_y, edge_n, edge_s, edge_e, edge_w } = params
  const wall_n = params.wall_n ?? 0
  const wall_s = params.wall_s ?? 0
  const wall_e = params.wall_e ?? 0
  const wall_w = params.wall_w ?? 0
    const { Manifold, CrossSection } = getManifold()
    const wallFemale = wall_connector === 'wall_female'
    const cStyle = corner_style
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
      roundBarXNeg(EP_NECK_W + 2 * EP_GAP, EP_NECK_D)
        .translate([-(EP_NECK_W / 2 + EP_GAP), 0])
        .add(
          roundBarX(EP_TAB_W + 2 * EP_GAP, EP_TAB_D + EP_GAP)
            .translate([-(EP_TAB_W / 2 + EP_GAP), EP_NECK_D])
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

      // Inner split connectors (N/E faces get male, S/W get female)
      if (hasNConn) for (const cx of cellXC) toAdd.push(maleN(cx))
      if (hasSConn) for (const cx of cellXC) toSub.push(femaleSouth.translate([cx, tileB]).extrude(EP_H_FEMALE))
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
    // Strip extents adjust based on cStyle:
    //   corner_l:  shortened where L-corner arms overlap
    //   corner_ns: N/S strips widen to include corner area
    //   corner_ew: E/W strips extend to include corner area
    // Returns null if adjusted length ≤ 0 (L arms cover the entire face).
    const buildWallStrip = (
      side: 'N' | 'S' | 'E' | 'W',
      cellXC: number[], cellYC: number[],
      wallN: number, wallS: number, wallE: number, wallW: number,
      armL = 0, armR = 0,  // corner_l only: left/bottom arm mm; right/top arm mm
      outerL = true, outerR = true, // whether each end faces the outer plate boundary
    ): any | null => {
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
      const ext = wallStripExtent(side, tile, walls, cStyle, { L: armL, R: armR }, { L: outerL, R: outerR })
      if (ext === null) return null

      if (side === 'N') {
        const { min: x0, max: x1 } = ext
        const nNW = outerL && (cStyle === 'corner_ns' || cStyle === 'corner_ccw' || (cStyle === 'corner_l' ? armL === 0 : !(wallW > 0)))
        const nNE = outerR && (cStyle === 'corner_ns' || cStyle === 'corner_cw'  || (cStyle === 'corner_l' ? armR === 0 : !(wallE > 0)))
        strip = selRRect(x0, tileT, x1, tileT + wallN, 0, 0, nNE ? rNE : 0, nNW ? rNW : 0).extrude(BASE_H)
        for (const cx of cellXC) {
          if (cx < x0 + CELL / 2 || cx > x1 - CELL / 2) continue
          if (wallFemale) toSub.push(femaleSouth.translate([cx, tileT]).extrude(EP_H_FEMALE))
          else            toAdd.push(maleSouth.translate([cx, tileT]).extrude(EP_H_MALE).intersect(adjCellSolid(cx, tileT - CELL / 2)))
        }
      } else if (side === 'S') {
        const { min: x0, max: x1 } = ext
        const sSW = outerL && (cStyle === 'corner_ns' || cStyle === 'corner_cw'  || (cStyle === 'corner_l' ? armL === 0 : !(wallW > 0)))
        const sSE = outerR && (cStyle === 'corner_ns' || cStyle === 'corner_ccw' || (cStyle === 'corner_l' ? armR === 0 : !(wallE > 0)))
        strip = selRRect(x0, tileB - wallS, x1, tileB, sSW ? rSW : 0, sSE ? rSE : 0, 0, 0).extrude(BASE_H)
        for (const cx of cellXC) {
          if (cx < x0 + CELL / 2 || cx > x1 - CELL / 2) continue
          if (wallFemale) toSub.push(femaleNorth.translate([cx, tileB]).extrude(EP_H_FEMALE))
          else            toAdd.push(maleNorth.translate([cx, tileB]).extrude(EP_H_MALE).intersect(adjCellSolid(cx, tileB + CELL / 2)))
        }
      } else if (side === 'E') {
        const { min: y0, max: y1 } = ext
        const eSE = outerL && (cStyle === 'corner_ew' || cStyle === 'corner_cw'  || (cStyle === 'corner_l' ? armL === 0 : !(wallS > 0)))
        const eNE = outerR && (cStyle === 'corner_ew' || cStyle === 'corner_ccw' || (cStyle === 'corner_l' ? armR === 0 : !(wallN > 0)))
        strip = selRRect(tileR, y0, tileR + wallE, y1, 0, eSE ? rSE : 0, eNE ? rNE : 0, 0).extrude(BASE_H)
        for (const cy of cellYC) {
          if (cy < y0 + CELL / 2 || cy > y1 - CELL / 2) continue
          if (wallFemale) toSub.push(femaleWest.translate([tileR, cy]).extrude(EP_H_FEMALE))
          else            toAdd.push(maleWest.translate([tileR, cy]).extrude(EP_H_MALE).intersect(adjCellSolid(tileR - CELL / 2, cy)))
        }
      } else {
        const { min: y0, max: y1 } = ext
        const wSW = outerL && (cStyle === 'corner_ew' || cStyle === 'corner_ccw' || (cStyle === 'corner_l' ? armL === 0 : !(wallS > 0)))
        const wNW = outerR && (cStyle === 'corner_ew' || cStyle === 'corner_cw'  || (cStyle === 'corner_l' ? armR === 0 : !(wallN > 0)))
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

    // ── Build a separate L-shaped corner piece ───────────────────────────────
    // Each corner piece is wallW (or wallE) wide and spans from armH below tileT/above tileB
    // to wallN/wallS above tileT/below tileB — bridging the E/W strip gap and the N/S wall cap.
    const buildCornerPiece = (
      corner: 'NW' | 'NE' | 'SW' | 'SE',
      wallN: number, wallS: number, wallE: number, wallW: number,
      cellXC: number[], cellYC: number[],
      armW: number, armH: number,  // mm; armW along N/S face, armH along E/W face
    ): any => {
      const nX = cellXC.length, nY = cellYC.length
      const tileL = cellXC[0]     - CELL / 2
      const tileR = cellXC[nX-1]  + CELL / 2
      const tileB = cellYC[0]     - CELL / 2
      const tileT = cellYC[nY-1]  + CELL / 2
      const toAdd: any[] = [], toSub: any[] = []
      const connNS = (female: any, male: any, cx: number, y: number, adjCy: number) => {
        if (wallFemale) toSub.push(female.translate([cx, y]).extrude(EP_H_FEMALE))
        else            toAdd.push(male.translate([cx, y]).extrude(EP_H_MALE).intersect(adjCellSolid(cx, adjCy)))
      }
      const connEW = (female: any, male: any, x: number, cy: number, adjCx: number) => {
        if (wallFemale) toSub.push(female.translate([x, cy]).extrude(EP_H_FEMALE))
        else            toAdd.push(male.translate([x, cy]).extrude(EP_H_MALE).intersect(adjCellSolid(adjCx, cy)))
      }
      let piece: any
      // Each corner is an L: hBar spans armW along the N/S wall face; vArm spans armH down/up the E/W wall face.
      if (corner === 'NW') {
        const hBar = selRRect(tileL - wallW, tileT, tileL + armW, tileT + wallN, 0, 0, 0, rNW)
        const vArm = CrossSection.square([wallW, armH]).translate([tileL - wallW, tileT - armH])
        piece = hBar.add(vArm).extrude(BASE_H)
        for (const cx of cellXC.filter(cx => cx < tileL + armW)) connNS(femaleSouth, maleSouth, cx, tileT, tileT - CELL / 2)
        for (const cy of cellYC.filter(cy => cy >= tileT - armH))  connEW(femaleEast, maleEast, tileL, cy, tileL + CELL / 2)
      } else if (corner === 'NE') {
        const hBar = selRRect(tileR - armW, tileT, tileR + wallE, tileT + wallN, 0, 0, rNE, 0)
        const vArm = CrossSection.square([wallE, armH]).translate([tileR, tileT - armH])
        piece = hBar.add(vArm).extrude(BASE_H)
        for (const cx of cellXC.filter(cx => cx >= tileR - armW)) connNS(femaleSouth, maleSouth, cx, tileT, tileT - CELL / 2)
        for (const cy of cellYC.filter(cy => cy >= tileT - armH))  connEW(femaleWest, maleWest, tileR, cy, tileR - CELL / 2)
      } else if (corner === 'SW') {
        const hBar = selRRect(tileL - wallW, tileB - wallS, tileL + armW, tileB, rSW, 0, 0, 0)
        const vArm = CrossSection.square([wallW, armH]).translate([tileL - wallW, tileB])
        piece = hBar.add(vArm).extrude(BASE_H)
        for (const cx of cellXC.filter(cx => cx < tileL + armW)) connNS(femaleNorth, maleNorth, cx, tileB, tileB + CELL / 2)
        for (const cy of cellYC.filter(cy => cy < tileB + armH))   connEW(femaleEast, maleEast, tileL, cy, tileL + CELL / 2)
      } else {
        const hBar = selRRect(tileR - armW, tileB - wallS, tileR + wallE, tileB, 0, rSE, 0, 0)
        const vArm = CrossSection.square([wallE, armH]).translate([tileR, tileB])
        piece = hBar.add(vArm).extrude(BASE_H)
        for (const cx of cellXC.filter(cx => cx >= tileR - armW)) connNS(femaleNorth, maleNorth, cx, tileB, tileB + CELL / 2)
        for (const cy of cellYC.filter(cy => cy < tileB + armH))   connEW(femaleWest, maleWest, tileR, cy, tileR - CELL / 2)
      }
      if (toAdd.length > 0) piece = piece.add(Manifold.union(toAdd))
      if (toSub.length > 0) piece = piece.subtract(Manifold.union(toSub))
      return piece
    }

    // ── Build a U-shaped wall piece ─────────────────────────────────────────
    // Generated when both corners on a dimension-1 side exist: the two L-arms merge into one
    // U-shaped piece — a spine (the full side wall) plus two arms extending into the plate.
    const buildUPiece = (
      side: 'W' | 'E' | 'N' | 'S',
      wallN: number, wallS: number, wallE: number, wallW: number,
      cellXC: number[], cellYC: number[],
      armCells: number,
    ): any => {
      const nX = cellXC.length, nY = cellYC.length
      const tileL = cellXC[0] - CELL / 2, tileR = cellXC[nX-1] + CELL / 2
      const tileB = cellYC[0] - CELL / 2, tileT = cellYC[nY-1] + CELL / 2
      const armH = armCells * CELL
      const armW = armCells * CELL
      const toAdd: any[] = [], toSub: any[] = []
      const conn = (female: any, male: any, x: number, y: number, adjCx: number, adjCy: number) => {
        if (wallFemale) toSub.push(female.translate([x, y]).extrude(EP_H_FEMALE))
        else            toAdd.push(male.translate([x, y]).extrude(EP_H_MALE).intersect(adjCellSolid(adjCx, adjCy)))
      }
      let piece: any
      if (side === 'W') {
        const spine = CrossSection.square([wallW, tileT - tileB]).translate([tileL - wallW, tileB])
        const hBarN = selRRect(tileL - wallW, tileT, tileL + armW, tileT + wallN, 0, 0, 0, rNW)
        const hBarS = selRRect(tileL - wallW, tileB - wallS, tileL + armW, tileB, rSW, 0, 0, 0)
        piece = spine.add(hBarN).add(hBarS).extrude(BASE_H)
        for (const cy of cellYC) conn(femaleEast, maleEast, tileL, cy, tileL + CELL / 2, cy)
        for (const cx of cellXC.filter(cx => cx < tileL + armW)) conn(femaleSouth, maleSouth, cx, tileT, cx, tileT - CELL / 2)
        for (const cx of cellXC.filter(cx => cx < tileL + armW)) conn(femaleNorth, maleNorth, cx, tileB, cx, tileB + CELL / 2)
      } else if (side === 'E') {
        const spine = CrossSection.square([wallE, tileT - tileB]).translate([tileR, tileB])
        const hBarN = selRRect(tileR - armW, tileT, tileR + wallE, tileT + wallN, 0, 0, rNE, 0)
        const hBarS = selRRect(tileR - armW, tileB - wallS, tileR + wallE, tileB, 0, rSE, 0, 0)
        piece = spine.add(hBarN).add(hBarS).extrude(BASE_H)
        for (const cy of cellYC) conn(femaleWest, maleWest, tileR, cy, tileR - CELL / 2, cy)
        for (const cx of cellXC.filter(cx => cx > tileR - armW)) conn(femaleSouth, maleSouth, cx, tileT, cx, tileT - CELL / 2)
        for (const cx of cellXC.filter(cx => cx > tileR - armW)) conn(femaleNorth, maleNorth, cx, tileB, cx, tileB + CELL / 2)
      } else if (side === 'N') {
        const spine = CrossSection.square([tileR - tileL, wallN]).translate([tileL, tileT])
        const vArmW = selRRect(tileL - wallW, tileT - armH, tileL, tileT + wallN, 0, 0, 0, rNW)
        const vArmE = selRRect(tileR, tileT - armH, tileR + wallE, tileT + wallN, 0, 0, rNE, 0)
        piece = spine.add(vArmW).add(vArmE).extrude(BASE_H)
        for (const cx of cellXC) conn(femaleSouth, maleSouth, cx, tileT, cx, tileT - CELL / 2)
        for (const cy of cellYC.filter(cy => cy > tileT - armH)) conn(femaleEast, maleEast, tileL, cy, tileL + CELL / 2, cy)
        for (const cy of cellYC.filter(cy => cy > tileT - armH)) conn(femaleWest, maleWest, tileR, cy, tileR - CELL / 2, cy)
      } else {
        const spine = CrossSection.square([tileR - tileL, wallS]).translate([tileL, tileB - wallS])
        const vArmW = selRRect(tileL - wallW, tileB - wallS, tileL, tileB + armH, rSW, 0, 0, 0)
        const vArmE = selRRect(tileR, tileB - wallS, tileR + wallE, tileB + armH, 0, rSE, 0, 0)
        piece = spine.add(vArmW).add(vArmE).extrude(BASE_H)
        for (const cx of cellXC) conn(femaleNorth, maleNorth, cx, tileB, cx, tileB + CELL / 2)
        for (const cy of cellYC.filter(cy => cy < tileB + armH)) conn(femaleEast, maleEast, tileL, cy, tileL + CELL / 2, cy)
        for (const cy of cellYC.filter(cy => cy < tileB + armH)) conn(femaleWest, maleWest, tileR, cy, tileR - CELL / 2, cy)
      }
      if (toAdd.length > 0) piece = piece.add(Manifold.union(toAdd))
      if (toSub.length > 0) piece = piece.subtract(Manifold.union(toSub))
      return piece
    }

    const buildBoxPiece = (
      wallN: number, wallS: number, wallE: number, wallW: number,
      cellXC: number[], cellYC: number[],
    ): any => {
      const nX = cellXC.length, nY = cellYC.length
      const tileL = cellXC[0] - CELL / 2, tileR = cellXC[nX - 1] + CELL / 2
      const tileB = cellYC[0] - CELL / 2, tileT = cellYC[nY - 1] + CELL / 2
      const outer = selRRect(tileL - wallW, tileB - wallS, tileR + wallE, tileT + wallN, rSW, rSE, rNE, rNW)
      const inner = CrossSection.square([tileR - tileL, tileT - tileB]).translate([tileL, tileB])
      let piece = outer.subtract(inner).extrude(BASE_H)
      const toAdd: any[] = [], toSub: any[] = []
      const conn = (female: any, male: any, x: number, y: number, adjCx: number, adjCy: number) => {
        if (wallFemale) toSub.push(female.translate([x, y]).extrude(EP_H_FEMALE))
        else            toAdd.push(male.translate([x, y]).extrude(EP_H_MALE).intersect(adjCellSolid(adjCx, adjCy)))
      }
      for (const cx of cellXC) {
        conn(femaleSouth, maleSouth, cx, tileT, cx, tileT - CELL / 2)
        conn(femaleNorth, maleNorth, cx, tileB, cx, tileB + CELL / 2)
      }
      for (const cy of cellYC) {
        conn(femaleWest, maleWest, tileR, cy, tileR - CELL / 2, cy)
        conn(femaleEast, maleEast, tileL, cy, tileL + CELL / 2, cy)
      }
      if (toAdd.length > 0) piece = piece.add(Manifold.union(toAdd))
      if (toSub.length > 0) piece = piece.subtract(Manifold.union(toSub))
      return piece
    }

    // ── Assemble ─────────────────────────────────────────────────────────────
    const labeled: { label: string; geom: any }[] = []

    const pushStrip = (label: string, strip: any | null, dx: number, dy: number) => {
      if (strip) labeled.push({ label, geom: strip.translate([dx, dy, 0]) })
    }

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

      labeled.push({ label: 'Tile', geom: tile })
    } else {
      const bed = resolveBed(bed_type, bed_x, bed_y)
      const maxCellsX = Math.max(1, Math.floor(bed.x / CELL))
      const maxCellsY = Math.max(1, Math.floor(bed.y / CELL))
      let sizesX: number[], sizesY: number[]
      if (separate_walls) {
        sizesX = splitSizes(cells_x, maxCellsX)
        sizesY = splitSizes(cells_y, maxCellsY)
      } else {
        sizesX = splitMaxInterior(cells_x, Math.floor(bed.x / CELL),
          Math.max(1, Math.floor((bed.x - wall_w) / CELL)),
          Math.max(1, Math.floor((bed.x - wall_e) / CELL)),
          Math.max(1, Math.floor((bed.x - wall_w - wall_e) / CELL)),
        )
        sizesY = splitMaxInterior(cells_y, Math.floor(bed.y / CELL),
          Math.max(1, Math.floor((bed.y - wall_s) / CELL)),
          Math.max(1, Math.floor((bed.y - wall_n) / CELL)),
          Math.max(1, Math.floor((bed.y - wall_s - wall_n) / CELL)),
        )
      }
      const cols = sizesX.length, rows = sizesY.length
      const baseX = cells_x * CELL / 2 + wall_w
      const baseY = cells_y * CELL / 2 + wall_s
      const tileLabel = (pi: number, pj: number) =>
        cols === 1 && rows === 1 ? 'Tile' : `Tile C${pi + 1}-R${pj + 1}`
      const wallLabel = (dir: string, count: number, idx: number) =>
        count === 1 ? `${dir} wall` : `${dir} wall ${idx + 1}`

      // Tiles
      let startX = 0
      for (let pi = 0; pi < cols; pi++) {
        let startY = 0
        for (let pj = 0; pj < rows; pj++) {
          const isN = pj === rows - 1, isS = pj === 0
          const isE = pi === cols - 1, isW = pi === 0
          const wallN = isN ? wall_n : 0, wallS = isS ? wall_s : 0
          const wallE = isE ? wall_e : 0, wallW = isW ? wall_w : 0
          labeled.push({
            label: tileLabel(pi, pj),
            geom: buildPiece(startX, sizesX[pi], startY, sizesY[pj], wallN, wallS, wallE, wallW, !isN, !isS, !isE, !isW, separate_walls)
              .translate([pi * PIECE_GAP + baseX, pj * PIECE_GAP + baseY, 0]),
          })
          startY += sizesY[pj]
        }
        startX += sizesX[pi]
      }

      if (separate_walls) {
        const fullCellXC = Array.from({ length: cells_x }, (_, i) => (i - (cells_x - 1) / 2) * CELL)
        const fullCellYC = Array.from({ length: cells_y }, (_, j) => (j - (cells_y - 1) / 2) * CELL)

        // edgeSplit: given n cells, maxArm per side, and whether each side has a bounding piece,
        // returns arm sizes and middle strip segments (in cells).
        const edgeSplit = (n: number, maxArm: number, hasL: boolean, hasR: boolean): { L: number; R: number; mid: number[] } => {
          const l = hasL ? (hasR ? (2 * maxArm >= n ? Math.ceil(n / 2) : maxArm) : 1) : 0
          const r = hasR ? (hasL ? (2 * maxArm >= n ? Math.floor(n / 2) : maxArm) : 1) : 0
          const midN = n - l - r
          if (midN <= 0) return { L: l, R: r, mid: [] }
          if (hasL && hasR) {
            const k = Math.ceil(midN / maxArm)
            const armTotal = n - k * maxArm
            const newL = Math.ceil(armTotal / 2)
            return { L: newL, R: armTotal - newL, mid: Array.from({ length: k }, () => maxArm) }
          }
          const numFull = Math.floor(midN / maxArm)
          const rem = midN % maxArm
          return { L: l, R: r, mid: [...Array.from({ length: numFull }, () => maxArm), ...(rem > 0 ? [rem] : [])] }
        }

        if (cStyle === 'corner_l') {
          // For corner_l: arms fill from each end; middle strips only where arms can't reach.
          const needBox = cells_x === 1 && cells_y === 1 && wall_n > 0 && wall_s > 0 && wall_e > 0 && wall_w > 0
          const needWU = !needBox && cells_y === 1 && cells_x >= 2 && wall_w > 0 && wall_n > 0 && wall_s > 0
          const needEU = !needBox && cells_y === 1 && cells_x >= 2 && wall_e > 0 && wall_n > 0 && wall_s > 0
          const needNU = !needBox && cells_x === 1 && cells_y >= 2 && wall_n > 0 && wall_w > 0 && wall_e > 0
          const needSU = !needBox && cells_x === 1 && cells_y >= 2 && wall_s > 0 && wall_w > 0 && wall_e > 0

          // Arm sizes for N/S edges and E/W edges
          const hasWpiece = needWU || (!needBox && wall_w > 0)
          const hasEpiece = needEU || (!needBox && wall_e > 0)
          const hasNpiece = needNU || (!needBox && wall_n > 0)
          const hasSpiece = needSU || (!needBox && wall_s > 0)
          const splitX = edgeSplit(cells_x, maxCellsX, hasWpiece && (wall_n > 0 || wall_s > 0), hasEpiece && (wall_n > 0 || wall_s > 0))
          const splitY = edgeSplit(cells_y, maxCellsY, hasSpiece && (wall_w > 0 || wall_e > 0), hasNpiece && (wall_w > 0 || wall_e > 0))
          const armXL = splitX.L, armXR = splitX.R, armYS = splitY.L, armYN = splitY.R

          // Middle N/S strips — tx matches the tile column containing each strip's cells
          let midXStart = armXL
          for (let k = 0; !needBox && k < splitX.mid.length; k++) {
            const segCellXC = Array.from({ length: splitX.mid[k] }, (_, i) => (midXStart + i - (cells_x - 1) / 2) * CELL)
            let cumXp = 0, piK = 0
            for (let pi = 0; pi < sizesX.length; pi++) { if (midXStart < cumXp + sizesX[pi]) { piK = pi; break } cumXp += sizesX[pi] }
            const tx = piK * PIECE_GAP + baseX
            if (wall_n > 0) pushStrip(wallLabel('North', splitX.mid.length, k), buildWallStrip('N', segCellXC, fullCellYC, wall_n, wall_s, wall_e, wall_w, 0, 0, false, false), tx, rows * PIECE_GAP + baseY)
            if (wall_s > 0) pushStrip(wallLabel('South', splitX.mid.length, k), buildWallStrip('S', segCellXC, fullCellYC, wall_n, wall_s, wall_e, wall_w, 0, 0, false, false), tx, -PIECE_GAP + baseY)
            midXStart += splitX.mid[k]
          }

          // Middle E/W strips — ty matches the tile row containing each strip's cells
          let midYStart = armYS
          for (let k = 0; !needBox && k < splitY.mid.length; k++) {
            const segCellYC = Array.from({ length: splitY.mid[k] }, (_, j) => (midYStart + j - (cells_y - 1) / 2) * CELL)
            let cumYp = 0, pjK = 0
            for (let pj = 0; pj < sizesY.length; pj++) { if (midYStart < cumYp + sizesY[pj]) { pjK = pj; break } cumYp += sizesY[pj] }
            const ty = pjK * PIECE_GAP + baseY
            if (wall_e > 0) pushStrip(wallLabel('East', splitY.mid.length, k), buildWallStrip('E', fullCellXC, segCellYC, wall_n, wall_s, wall_e, wall_w, 0, 0, false, false), cols * PIECE_GAP + baseX, ty)
            if (wall_w > 0) pushStrip(wallLabel('West', splitY.mid.length, k), buildWallStrip('W', fullCellXC, segCellYC, wall_n, wall_s, wall_e, wall_w, 0, 0, false, false), -PIECE_GAP + baseX, ty)
            midYStart += splitY.mid[k]
          }

          // U/box/corner pieces
          if (needBox) labeled.push({ label: 'Wall frame', geom: buildBoxPiece(wall_n, wall_s, wall_e, wall_w, fullCellXC, fullCellYC).translate([baseX, baseY - CELL - wall_n - PIECE_GAP, 0]) })
          const wUExtra = splitX.mid.length > 0 && wall_n > 0 ? wall_n + PIECE_GAP : 0
          const eUExtra = splitX.mid.length > 0 && wall_s > 0 ? wall_s + PIECE_GAP : 0
          const nUExtra = splitY.mid.length > 0 && wall_e > 0 ? wall_e + PIECE_GAP : 0
          const sUExtra = splitY.mid.length > 0 && wall_w > 0 ? wall_w + PIECE_GAP : 0
          if (needWU) labeled.push({ label: 'West wall',  geom: buildUPiece('W', wall_n, wall_s, wall_e, wall_w, fullCellXC, fullCellYC, armXL).translate([baseX, baseY + cells_y * CELL + wall_s + PIECE_GAP + wUExtra, 0]) })
          if (needEU) labeled.push({ label: 'East wall',  geom: buildUPiece('E', wall_n, wall_s, wall_e, wall_w, fullCellXC, fullCellYC, armXR).translate([(cols - 1) * PIECE_GAP + baseX, baseY - cells_y * CELL - wall_n - PIECE_GAP - eUExtra, 0]) })
          if (needNU) labeled.push({ label: 'North wall', geom: buildUPiece('N', wall_n, wall_s, wall_e, wall_w, fullCellXC, fullCellYC, armYN).translate([baseX + cells_x * CELL + wall_w + PIECE_GAP + nUExtra, (rows - 1) * PIECE_GAP + baseY, 0]) })
          if (needSU) labeled.push({ label: 'South wall', geom: buildUPiece('S', wall_n, wall_s, wall_e, wall_w, fullCellXC, fullCellYC, armYS).translate([baseX - cells_x * CELL - wall_e - PIECE_GAP - sUExtra, baseY, 0]) })
          if (!needBox && !needWU && !needNU && wall_n > 0 && wall_w > 0) labeled.push({ label: 'NW corner', geom: buildCornerPiece('NW', wall_n, wall_s, wall_e, wall_w, fullCellXC, fullCellYC, armXL * CELL, armYN * CELL).translate([-PIECE_GAP + baseX, rows * PIECE_GAP + baseY, 0]) })
          if (!needBox && !needEU && !needNU && wall_n > 0 && wall_e > 0) labeled.push({ label: 'NE corner', geom: buildCornerPiece('NE', wall_n, wall_s, wall_e, wall_w, fullCellXC, fullCellYC, armXR * CELL, armYN * CELL).translate([cols * PIECE_GAP + baseX, rows * PIECE_GAP + baseY, 0]) })
          if (!needBox && !needWU && !needSU && wall_s > 0 && wall_w > 0) labeled.push({ label: 'SW corner', geom: buildCornerPiece('SW', wall_n, wall_s, wall_e, wall_w, fullCellXC, fullCellYC, armXL * CELL, armYS * CELL).translate([-PIECE_GAP + baseX, -PIECE_GAP + baseY, 0]) })
          if (!needBox && !needEU && !needSU && wall_s > 0 && wall_e > 0) labeled.push({ label: 'SE corner', geom: buildCornerPiece('SE', wall_n, wall_s, wall_e, wall_w, fullCellXC, fullCellYC, armXR * CELL, armYS * CELL).translate([cols * PIECE_GAP + baseX, -PIECE_GAP + baseY, 0]) })
        } else {
          // Non-corner_l: strips fill the full edge, split by bed size
          const wallSizesX = splitSizes(cells_x, maxCellsX)
          const wallCols = wallSizesX.length
          let wallStartX = 0
          for (let pi = 0; pi < wallCols; pi++) {
            const segCellXC = Array.from({ length: wallSizesX[pi] }, (_, i) => (wallStartX + i - (cells_x - 1) / 2) * CELL)
            const tx = pi * PIECE_GAP + baseX
            if (wall_n > 0) pushStrip(wallLabel('North', wallCols, pi), buildWallStrip('N', segCellXC, fullCellYC, wall_n, wall_s, wall_e, wall_w, 0, 0, pi === 0, pi === wallCols - 1), tx, rows * PIECE_GAP + baseY)
            if (wall_s > 0) pushStrip(wallLabel('South', wallCols, pi), buildWallStrip('S', segCellXC, fullCellYC, wall_n, wall_s, wall_e, wall_w, 0, 0, pi === 0, pi === wallCols - 1), tx, -PIECE_GAP + baseY)
            wallStartX += wallSizesX[pi]
          }
          const wallSizesY = splitSizes(cells_y, maxCellsY)
          const wallRows = wallSizesY.length
          let wallStartY = 0
          for (let pj = 0; pj < wallRows; pj++) {
            const segCellYC = Array.from({ length: wallSizesY[pj] }, (_, j) => (wallStartY + j - (cells_y - 1) / 2) * CELL)
            const ty = pj * PIECE_GAP + baseY
            if (wall_e > 0) pushStrip(wallLabel('East', wallRows, pj), buildWallStrip('E', fullCellXC, segCellYC, wall_n, wall_s, wall_e, wall_w, 0, 0, pj === 0, pj === wallRows - 1), cols * PIECE_GAP + baseX, ty)
            if (wall_w > 0) pushStrip(wallLabel('West', wallRows, pj), buildWallStrip('W', fullCellXC, segCellYC, wall_n, wall_s, wall_e, wall_w, 0, 0, pj === 0, pj === wallRows - 1), -PIECE_GAP + baseX, ty)
            wallStartY += wallSizesY[pj]
          }
        }
      }
    }

    const merged = Manifold.union(labeled.map(p => p.geom))
    if (labeled.length <= 1) return merged
    return {
      merged,
      pieces: labeled.map(p => ({ label: p.label, geom: p.geom })),
    }
}
