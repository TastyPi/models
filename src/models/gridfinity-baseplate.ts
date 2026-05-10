import { getManifold } from '../manifold'
import { defineModel } from '../types'
import { printBedParams, resolveBed, splitSizes, splitMaxInterior } from '../printBed'

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

const hasWalls = (v: Record<string, number | boolean | string>) =>
  (v.wall_n as number) > 0 || (v.wall_s as number) > 0 ||
  (v.wall_e as number) > 0 || (v.wall_w as number) > 0

const hasCorner = (v: Record<string, number | boolean | string>) =>
  (((v.wall_n as number) > 0) && ((v.wall_e as number) > 0 || (v.wall_w as number) > 0)) ||
  (((v.wall_s as number) > 0) && ((v.wall_e as number) > 0 || (v.wall_w as number) > 0))

export default defineModel({
  name: 'Gridfinity Baseplate',
  description: 'Gridfinity baseplate with optional border walls on any side. When printed in parts, split edges use puzzle connectors for assembly.',
  attribution: [
    { name: 'Gridfinity', author: 'Zachary Freedman / Voidstar Lab', url: 'https://www.youtube.com/watch?v=ra_9zU-mnl8', license: 'MIT' },
    { name: 'gridfinity-rebuilt-openscad', author: 'Kenneth Hodson', url: 'https://github.com/kennetek/gridfinity-rebuilt-openscad', license: 'MIT' },
    { name: 'GridFlock', author: 'Jonas Konrad', url: 'https://github.com/yawkat/GridFlock', license: 'MIT, CC BY 4.0' },
  ],
  parameters: {
    cells_x: { type: 'number', label: 'Width (cells)', min: 1, max: 20, step: 1 },
    cells_y: { type: 'number', label: 'Depth (cells)', min: 1, max: 20, step: 1 },
    separate_walls: {
      type: 'boolean',
      label: 'Print walls separately',
      description: 'Recommended when designing a plate for a new product — if measurements are off, only the walls need reprinting.',
      visible: hasWalls,
    },
    wall_connector: {
      type: 'select',
      label: 'Wall connector',
      options: [
        { value: 'wall_male',   label: 'Male on wall' },
        { value: 'wall_female', label: 'Female on wall' },
      ],
      visible: (v) => !!v.separate_walls && hasWalls(v),
    },
    corner_style: {
      type: 'select',
      label: 'Corner style',
      options: [
        { value: 'corner_l',   label: 'L-shaped' },
        { value: 'corner_cw',  label: 'Clockwise' },
        { value: 'corner_ccw', label: 'Anti-clockwise' },
        { value: 'corner_ns',  label: 'Included in N/S walls' },
        { value: 'corner_ew',  label: 'Included in E/W walls' },
      ],
      visible: (v) => !!v.separate_walls && hasCorner(v),
    },
    corner_radius: {
      type: 'number',
      label: 'Outer corner radius (mm)',
      min: 0,
      max: OUTER_R,
      step: 0.5,
    },
    wall_n: { type: 'number', optional: true, label: 'North (mm)', min: (v) => v.separate_walls && v.wall_connector === 'wall_female' ? EP_WALL_MIN : 0, max: 40, step: 0.5 },
    wall_s: { type: 'number', optional: true, label: 'South (mm)', min: (v) => v.separate_walls && v.wall_connector === 'wall_female' ? EP_WALL_MIN : 0, max: 40, step: 0.5 },
    wall_e: { type: 'number', optional: true, label: 'East (mm)',  min: (v) => v.separate_walls && v.wall_connector === 'wall_female' ? EP_WALL_MIN : 0, max: 40, step: 0.5 },
    wall_w: { type: 'number', optional: true, label: 'West (mm)',  min: (v) => v.separate_walls && v.wall_connector === 'wall_female' ? EP_WALL_MIN : 0, max: 40, step: 0.5 },
    base_style: {
      type: 'select', label: 'Base style',
      options: [
        { value: 'solid', label: 'Solid' },
        { value: 'open', label: 'Open' },
      ],
    },
    magnets: { type: 'boolean', label: 'Magnet pockets', visible: (v) => v.base_style === 'solid' },
    ...printBedParams,
  },
  groups: [
    { label: 'Print bed', keys: ['restrict_bed', 'bed_type', 'bed_x', 'bed_y'],                                                       defaultOpen: true },
    { label: 'Style',     keys: ['base_style', 'magnets', 'corner_radius'],                                                           defaultOpen: true },
    { label: 'Size',      keys: ['cells_x', 'cells_y'],                                                                               defaultOpen: true },
    { label: 'Walls',     keys: ['separate_walls', 'wall_connector', 'corner_style', 'wall_n', 'wall_s', 'wall_e', 'wall_w'],         defaultOpen: true },
  ],
  flatModel: true,
  presets: [
    {
      label: 'Halfords 3 Drawer Middle Chest (13×9)',
      values: {
        cells_x: 13, cells_y: 9,
        separate_walls: false, wall_connector: 'wall_male', corner_style: 'corner_l',
        wall_n: 11.5, wall_s: 11.5, wall_e: 9, wall_w: 9,
        base_style: 'open', magnets: false, corner_radius: 0,
        restrict_bed: false, bed_type: 'prusa_core_one', bed_x: 250, bed_y: 220,
      },
    },
  ],

  info({ cells_x, cells_y, wall_n, wall_s, wall_e, wall_w }) {
    const w = cells_x * CELL + wall_w + wall_e
    const d = cells_y * CELL + wall_n + wall_s
    return `${w} × ${d} mm assembled`
  },

  generate({ cells_x, cells_y, wall_n, wall_s, wall_e, wall_w, separate_walls, wall_connector, corner_style, corner_radius, base_style, magnets, restrict_bed, bed_type, bed_x, bed_y }) {
    const { Manifold, CrossSection } = getManifold()
    const wallFemale = wall_connector === 'wall_female'
    const cStyle = (corner_style as string) ?? 'corner_l'
    const cornerR = corner_radius as number

    // Selective corner rounding: sw/se/ne/nw flags indicate which corners get radius r.
    // Builds an explicit polygon so sharp corners are exact and only one CrossSection is created.
    const selRRect = (x0: number, y0: number, x1: number, y1: number, sw: boolean, se: boolean, ne: boolean, nw: boolean): any => {
      if (cornerR <= 0 || !(sw || se || ne || nw)) {
        return CrossSection.square([x1 - x0, y1 - y0]).translate([x0, y0])
      }
      const r = Math.min(cornerR, (x1 - x0) / 2 - 0.01, (y1 - y0) / 2 - 0.01)
      const arc = (cx: number, cy: number, a0: number, a1: number): [number, number][] => {
        const pts: [number, number][] = []
        for (let i = 0; i <= 8; i++) {
          const a = a0 + (a1 - a0) * i / 8
          pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
        }
        return pts
      }
      const pts: [number, number][] = [
        ...(sw ? arc(x0 + r, y0 + r, Math.PI, Math.PI * 1.5)      : [[x0, y0] as [number, number]]),
        ...(se ? arc(x1 - r, y0 + r, Math.PI * 1.5, Math.PI * 2)  : [[x1, y0] as [number, number]]),
        ...(ne ? arc(x1 - r, y1 - r, 0, Math.PI * 0.5)            : [[x1, y1] as [number, number]]),
        ...(nw ? arc(x0 + r, y1 - r, Math.PI * 0.5, Math.PI)      : [[x0, y1] as [number, number]]),
      ]
      return new CrossSection(pts as any, 'NonZero')
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
            !hasSConn && !hasWConn && !(wallS > 0) && !(wallW > 0),
            !hasSConn && !hasEConn && !(wallS > 0) && !(wallE > 0),
            !hasNConn && !hasEConn && !(wallN > 0) && !(wallE > 0),
            !hasNConn && !hasWConn && !(wallN > 0) && !(wallW > 0),
          )
        : selRRect(fpX0, fpY0, fpX1, fpY1,
            !hasSConn && !hasWConn,
            !hasSConn && !hasEConn,
            !hasNConn && !hasEConn,
            !hasNConn && !hasWConn,
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

      // Inner split connectors (N/E faces get male, S/W get female)
      if (hasNConn) for (const cx of cellXC) toAdd.push(maleNorth.translate([cx, tileT]).extrude(EP_H_MALE))
      if (hasSConn) for (const cx of cellXC) toSub.push(femaleSouth.translate([cx, tileB]).extrude(EP_H_FEMALE))
      if (hasEConn) for (const cy of cellYC) toAdd.push(maleEast.translate([tileR, cy]).extrude(EP_H_MALE))
      if (hasWConn) for (const cy of cellYC) toSub.push(femaleWest.translate([tileL, cy]).extrude(EP_H_FEMALE))

      // Separate-wall connectors on outer walled faces
      if (wallsSep) {
        if (wallN > 0) for (const cx of cellXC) {
          if (wallFemale) toAdd.push(maleNorth.translate([cx, tileT]).extrude(EP_H_MALE))  // male on tile
          else            toSub.push(femaleNorth.translate([cx, tileT]).extrude(EP_H_FEMALE)) // female on tile
        }
        if (wallS > 0) for (const cx of cellXC) {
          if (wallFemale) toAdd.push(maleSouth.translate([cx, tileB]).extrude(EP_H_MALE))
          else            toSub.push(femaleSouth.translate([cx, tileB]).extrude(EP_H_FEMALE))
        }
        if (wallE > 0) for (const cy of cellYC) {
          if (wallFemale) toAdd.push(maleEast.translate([tileR, cy]).extrude(EP_H_MALE))
          else            toSub.push(femaleEast.translate([tileR, cy]).extrude(EP_H_FEMALE))
        }
        if (wallW > 0) for (const cy of cellYC) {
          if (wallFemale) toAdd.push(maleWest.translate([tileL, cy]).extrude(EP_H_MALE))
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

      if (side === 'N') {
        let x0 = tileL, x1 = tileR
        if      (cStyle === 'corner_l')   { x0 += armL; x1 -= armR }
        else if (cStyle === 'corner_ns')  { if (wallW > 0) x0 -= wallW; if (wallE > 0) x1 += wallE }
        else if (cStyle === 'corner_cw')  { if (wallE > 0) x1 += wallE }
        else if (cStyle === 'corner_ccw') { if (wallW > 0) x0 -= wallW }
        if (x1 <= x0) return null
        const nNW = outerL && (cStyle === 'corner_ns' || cStyle === 'corner_ccw' || (cStyle === 'corner_l' ? armL === 0 : !(wallW > 0)))
        const nNE = outerR && (cStyle === 'corner_ns' || cStyle === 'corner_cw'  || (cStyle === 'corner_l' ? armR === 0 : !(wallE > 0)))
        strip = selRRect(x0, tileT, x1, tileT + wallN, false, false, nNE, nNW).extrude(BASE_H)
        for (const cx of cellXC) {
          if (cx < x0 + CELL / 2 || cx > x1 - CELL / 2) continue
          if (wallFemale) toSub.push(femaleSouth.translate([cx, tileT]).extrude(EP_H_FEMALE))
          else            toAdd.push(maleSouth.translate([cx, tileT]).extrude(EP_H_MALE))
        }
      } else if (side === 'S') {
        let x0 = tileL, x1 = tileR
        if      (cStyle === 'corner_l')   { x0 += armL; x1 -= armR }
        else if (cStyle === 'corner_ns')  { if (wallW > 0) x0 -= wallW; if (wallE > 0) x1 += wallE }
        else if (cStyle === 'corner_cw')  { if (wallW > 0) x0 -= wallW }
        else if (cStyle === 'corner_ccw') { if (wallE > 0) x1 += wallE }
        if (x1 <= x0) return null
        const sSW = outerL && (cStyle === 'corner_ns' || cStyle === 'corner_cw'  || (cStyle === 'corner_l' ? armL === 0 : !(wallW > 0)))
        const sSE = outerR && (cStyle === 'corner_ns' || cStyle === 'corner_ccw' || (cStyle === 'corner_l' ? armR === 0 : !(wallE > 0)))
        strip = selRRect(x0, tileB - wallS, x1, tileB, sSW, sSE, false, false).extrude(BASE_H)
        for (const cx of cellXC) {
          if (cx < x0 + CELL / 2 || cx > x1 - CELL / 2) continue
          if (wallFemale) toSub.push(femaleNorth.translate([cx, tileB]).extrude(EP_H_FEMALE))
          else            toAdd.push(maleNorth.translate([cx, tileB]).extrude(EP_H_MALE))
        }
      } else if (side === 'E') {
        let y0 = tileB, y1 = tileT
        if      (cStyle === 'corner_l')   { y0 += armL; y1 -= armR }
        else if (cStyle === 'corner_ew')  { if (wallS > 0) y0 -= wallS; if (wallN > 0) y1 += wallN }
        else if (cStyle === 'corner_cw')  { if (wallS > 0) y0 -= wallS }
        else if (cStyle === 'corner_ccw') { if (wallN > 0) y1 += wallN }
        if (y1 <= y0) return null
        const eSE = outerL && (cStyle === 'corner_ew' || cStyle === 'corner_cw'  || (cStyle === 'corner_l' ? armL === 0 : !(wallS > 0)))
        const eNE = outerR && (cStyle === 'corner_ew' || cStyle === 'corner_ccw' || (cStyle === 'corner_l' ? armR === 0 : !(wallN > 0)))
        strip = selRRect(tileR, y0, tileR + wallE, y1, false, eSE, eNE, false).extrude(BASE_H)
        for (const cy of cellYC) {
          if (cy < y0 + CELL / 2 || cy > y1 - CELL / 2) continue
          if (wallFemale) toSub.push(femaleWest.translate([tileR, cy]).extrude(EP_H_FEMALE))
          else            toAdd.push(maleWest.translate([tileR, cy]).extrude(EP_H_MALE))
        }
      } else {
        let y0 = tileB, y1 = tileT
        if      (cStyle === 'corner_l')   { y0 += armL; y1 -= armR }
        else if (cStyle === 'corner_ew')  { if (wallS > 0) y0 -= wallS; if (wallN > 0) y1 += wallN }
        else if (cStyle === 'corner_cw')  { if (wallN > 0) y1 += wallN }
        else if (cStyle === 'corner_ccw') { if (wallS > 0) y0 -= wallS }
        if (y1 <= y0) return null
        const wSW = outerL && (cStyle === 'corner_ew' || cStyle === 'corner_ccw' || (cStyle === 'corner_l' ? armL === 0 : !(wallS > 0)))
        const wNW = outerR && (cStyle === 'corner_ew' || cStyle === 'corner_cw'  || (cStyle === 'corner_l' ? armR === 0 : !(wallN > 0)))
        strip = selRRect(tileL - wallW, y0, tileL, y1, wSW, false, false, wNW).extrude(BASE_H)
        for (const cy of cellYC) {
          if (cy < y0 + CELL / 2 || cy > y1 - CELL / 2) continue
          if (wallFemale) toSub.push(femaleEast.translate([tileL, cy]).extrude(EP_H_FEMALE))
          else            toAdd.push(maleEast.translate([tileL, cy]).extrude(EP_H_MALE))
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
      const connNS = (female: any, male: any, cx: number, y: number) => {
        if (wallFemale) toSub.push(female.translate([cx, y]).extrude(EP_H_FEMALE))
        else            toAdd.push(male.translate([cx, y]).extrude(EP_H_MALE))
      }
      const connEW = (female: any, male: any, x: number, cy: number) => {
        if (wallFemale) toSub.push(female.translate([x, cy]).extrude(EP_H_FEMALE))
        else            toAdd.push(male.translate([x, cy]).extrude(EP_H_MALE))
      }
      let piece: any
      // Each corner is an L: hBar spans armW along the N/S wall face; vArm spans armH down/up the E/W wall face.
      if (corner === 'NW') {
        const hBar = selRRect(tileL - wallW, tileT, tileL + armW, tileT + wallN, false, false, false, true)
        const vArm = CrossSection.square([wallW, armH]).translate([tileL - wallW, tileT - armH])
        piece = hBar.add(vArm).extrude(BASE_H)
        for (const cx of cellXC.filter(cx => cx < tileL + armW)) connNS(femaleSouth, maleSouth, cx, tileT)
        for (const cy of cellYC.filter(cy => cy >= tileT - armH))  connEW(femaleEast, maleEast, tileL, cy)
      } else if (corner === 'NE') {
        const hBar = selRRect(tileR - armW, tileT, tileR + wallE, tileT + wallN, false, false, true, false)
        const vArm = CrossSection.square([wallE, armH]).translate([tileR, tileT - armH])
        piece = hBar.add(vArm).extrude(BASE_H)
        for (const cx of cellXC.filter(cx => cx >= tileR - armW)) connNS(femaleSouth, maleSouth, cx, tileT)
        for (const cy of cellYC.filter(cy => cy >= tileT - armH))  connEW(femaleWest, maleWest, tileR, cy)
      } else if (corner === 'SW') {
        const hBar = selRRect(tileL - wallW, tileB - wallS, tileL + armW, tileB, true, false, false, false)
        const vArm = CrossSection.square([wallW, armH]).translate([tileL - wallW, tileB])
        piece = hBar.add(vArm).extrude(BASE_H)
        for (const cx of cellXC.filter(cx => cx < tileL + armW)) connNS(femaleNorth, maleNorth, cx, tileB)
        for (const cy of cellYC.filter(cy => cy < tileB + armH))   connEW(femaleEast, maleEast, tileL, cy)
      } else {
        const hBar = selRRect(tileR - armW, tileB - wallS, tileR + wallE, tileB, false, true, false, false)
        const vArm = CrossSection.square([wallE, armH]).translate([tileR, tileB])
        piece = hBar.add(vArm).extrude(BASE_H)
        for (const cx of cellXC.filter(cx => cx >= tileR - armW)) connNS(femaleNorth, maleNorth, cx, tileB)
        for (const cy of cellYC.filter(cy => cy < tileB + armH))   connEW(femaleWest, maleWest, tileR, cy)
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
      const conn = (female: any, male: any, x: number, y: number) => {
        if (wallFemale) toSub.push(female.translate([x, y]).extrude(EP_H_FEMALE))
        else            toAdd.push(male.translate([x, y]).extrude(EP_H_MALE))
      }
      let piece: any
      if (side === 'W') {
        const spine = CrossSection.square([wallW, tileT - tileB]).translate([tileL - wallW, tileB])
        const hBarN = selRRect(tileL - wallW, tileT, tileL + armW, tileT + wallN, false, false, false, true)
        const hBarS = selRRect(tileL - wallW, tileB - wallS, tileL + armW, tileB, true, false, false, false)
        piece = spine.add(hBarN).add(hBarS).extrude(BASE_H)
        for (const cy of cellYC) conn(femaleEast, maleEast, tileL, cy)
        for (const cx of cellXC.filter(cx => cx < tileL + armW)) conn(femaleSouth, maleSouth, cx, tileT)
        for (const cx of cellXC.filter(cx => cx < tileL + armW)) conn(femaleNorth, maleNorth, cx, tileB)
      } else if (side === 'E') {
        const spine = CrossSection.square([wallE, tileT - tileB]).translate([tileR, tileB])
        const hBarN = selRRect(tileR - armW, tileT, tileR + wallE, tileT + wallN, false, false, true, false)
        const hBarS = selRRect(tileR - armW, tileB - wallS, tileR + wallE, tileB, false, true, false, false)
        piece = spine.add(hBarN).add(hBarS).extrude(BASE_H)
        for (const cy of cellYC) conn(femaleWest, maleWest, tileR, cy)
        for (const cx of cellXC.filter(cx => cx > tileR - armW)) conn(femaleSouth, maleSouth, cx, tileT)
        for (const cx of cellXC.filter(cx => cx > tileR - armW)) conn(femaleNorth, maleNorth, cx, tileB)
      } else if (side === 'N') {
        const spine = CrossSection.square([tileR - tileL, wallN]).translate([tileL, tileT])
        const vArmW = selRRect(tileL - wallW, tileT - armH, tileL, tileT + wallN, false, false, false, true)
        const vArmE = selRRect(tileR, tileT - armH, tileR + wallE, tileT + wallN, false, false, true, false)
        piece = spine.add(vArmW).add(vArmE).extrude(BASE_H)
        for (const cx of cellXC) conn(femaleSouth, maleSouth, cx, tileT)
        for (const cy of cellYC.filter(cy => cy > tileT - armH)) conn(femaleEast, maleEast, tileL, cy)
        for (const cy of cellYC.filter(cy => cy > tileT - armH)) conn(femaleWest, maleWest, tileR, cy)
      } else {
        const spine = CrossSection.square([tileR - tileL, wallS]).translate([tileL, tileB - wallS])
        const vArmW = selRRect(tileL - wallW, tileB - wallS, tileL, tileB + armH, true, false, false, false)
        const vArmE = selRRect(tileR, tileB - wallS, tileR + wallE, tileB + armH, false, true, false, false)
        piece = spine.add(vArmW).add(vArmE).extrude(BASE_H)
        for (const cx of cellXC) conn(femaleNorth, maleNorth, cx, tileB)
        for (const cy of cellYC.filter(cy => cy < tileB + armH)) conn(femaleEast, maleEast, tileL, cy)
        for (const cy of cellYC.filter(cy => cy < tileB + armH)) conn(femaleWest, maleWest, tileR, cy)
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
      const outer = selRRect(tileL - wallW, tileB - wallS, tileR + wallE, tileT + wallN, true, true, true, true)
      const inner = CrossSection.square([tileR - tileL, tileT - tileB]).translate([tileL, tileB])
      let piece = outer.subtract(inner).extrude(BASE_H)
      const toAdd: any[] = [], toSub: any[] = []
      const conn = (female: any, male: any, x: number, y: number) => {
        if (wallFemale) toSub.push(female.translate([x, y]).extrude(EP_H_FEMALE))
        else            toAdd.push(male.translate([x, y]).extrude(EP_H_MALE))
      }
      for (const cx of cellXC) {
        conn(femaleSouth, maleSouth, cx, tileT)
        conn(femaleNorth, maleNorth, cx, tileB)
      }
      for (const cy of cellYC) {
        conn(femaleWest, maleWest, tileR, cy)
        conn(femaleEast, maleEast, tileL, cy)
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
      labeled.push({
        label: 'Tile',
        geom: buildPiece(0, cells_x, 0, cells_y, wall_n, wall_s, wall_e, wall_w, false, false, false, false, separate_walls),
      })
      if (separate_walls) {
        // Arm sizes (cells) for corner_l: per-side, ceil on "left/south", floor on "right/north"
        let armXL = 0, armXR = 0, armYS = 0, armYN = 0
        if (cStyle === 'corner_l') {
          const bothWE = wall_w > 0 && wall_e > 0, bothNS = wall_n > 0 && wall_s > 0
          armXL = !wall_w ? 0 : (bothWE || (cells_y === 1 && bothNS)) ? Math.ceil(cells_x / 2) : 1
          armXR = !wall_e ? 0 : (bothWE || (cells_y === 1 && bothNS)) ? Math.floor(cells_x / 2) : 1
          armYS = !wall_s ? 0 : (bothNS || (cells_x === 1 && bothWE)) ? Math.ceil(cells_y / 2) : 1
          armYN = !wall_n ? 0 : (bothNS || (cells_x === 1 && bothWE)) ? Math.floor(cells_y / 2) : 1
        }
        pushStrip('North wall', buildWallStrip('N', cellXC, cellYC, wall_n, wall_s, wall_e, wall_w, armXL * CELL, armXR * CELL), 0, PIECE_GAP)
        pushStrip('South wall', buildWallStrip('S', cellXC, cellYC, wall_n, wall_s, wall_e, wall_w, armXL * CELL, armXR * CELL), 0, -PIECE_GAP)
        pushStrip('East wall',  buildWallStrip('E', cellXC, cellYC, wall_n, wall_s, wall_e, wall_w, armYS * CELL, armYN * CELL), PIECE_GAP, 0)
        pushStrip('West wall',  buildWallStrip('W', cellXC, cellYC, wall_n, wall_s, wall_e, wall_w, armYS * CELL, armYN * CELL), -PIECE_GAP, 0)
        if (cStyle === 'corner_l') {
          const needBox = cells_x === 1 && cells_y === 1 && wall_n > 0 && wall_s > 0 && wall_e > 0 && wall_w > 0
          const needWU = !needBox && cells_y === 1 && cells_x >= 2 && wall_w > 0 && wall_n > 0 && wall_s > 0
          const needEU = !needBox && cells_y === 1 && cells_x >= 2 && wall_e > 0 && wall_n > 0 && wall_s > 0
          const needNU = !needBox && cells_x === 1 && cells_y >= 2 && wall_n > 0 && wall_w > 0 && wall_e > 0
          const needSU = !needBox && cells_x === 1 && cells_y >= 2 && wall_s > 0 && wall_w > 0 && wall_e > 0
          if (needBox) labeled.push({ label: 'Wall frame', geom: buildBoxPiece(wall_n, wall_s, wall_e, wall_w, cellXC, cellYC).translate([0, -(CELL + wall_n + PIECE_GAP), 0]) })
          if (needWU) labeled.push({ label: 'West wall',  geom: buildUPiece('W', wall_n, wall_s, wall_e, wall_w, cellXC, cellYC, armXL).translate([0, cells_y * CELL + wall_s + PIECE_GAP, 0]) })
          if (needEU) labeled.push({ label: 'East wall',  geom: buildUPiece('E', wall_n, wall_s, wall_e, wall_w, cellXC, cellYC, armXR).translate([0, -(cells_y * CELL + wall_n + PIECE_GAP), 0]) })
          if (needNU) labeled.push({ label: 'North wall', geom: buildUPiece('N', wall_n, wall_s, wall_e, wall_w, cellXC, cellYC, armYN).translate([cells_x * CELL + wall_w + PIECE_GAP, 0, 0]) })
          if (needSU) labeled.push({ label: 'South wall', geom: buildUPiece('S', wall_n, wall_s, wall_e, wall_w, cellXC, cellYC, armYS).translate([-(cells_x * CELL + wall_e + PIECE_GAP), 0, 0]) })
          if (!needBox && !needWU && !needNU && wall_n > 0 && wall_w > 0) labeled.push({ label: 'NW corner', geom: buildCornerPiece('NW', wall_n, wall_s, wall_e, wall_w, cellXC, cellYC, armXL * CELL, armYN * CELL).translate([-PIECE_GAP, PIECE_GAP, 0]) })
          if (!needBox && !needEU && !needNU && wall_n > 0 && wall_e > 0) labeled.push({ label: 'NE corner', geom: buildCornerPiece('NE', wall_n, wall_s, wall_e, wall_w, cellXC, cellYC, armXR * CELL, armYN * CELL).translate([PIECE_GAP, PIECE_GAP, 0]) })
          if (!needBox && !needWU && !needSU && wall_s > 0 && wall_w > 0) labeled.push({ label: 'SW corner', geom: buildCornerPiece('SW', wall_n, wall_s, wall_e, wall_w, cellXC, cellYC, armXL * CELL, armYS * CELL).translate([-PIECE_GAP, -PIECE_GAP, 0]) })
          if (!needBox && !needEU && !needSU && wall_s > 0 && wall_e > 0) labeled.push({ label: 'SE corner', geom: buildCornerPiece('SE', wall_n, wall_s, wall_e, wall_w, cellXC, cellYC, armXR * CELL, armYS * CELL).translate([PIECE_GAP, -PIECE_GAP, 0]) })
        }
      }
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
        const edgeSplit = (n: number, maxArm: number, hasL: boolean, hasR: boolean) => {
          const l = hasL ? (hasR ? (2 * maxArm >= n ? Math.ceil(n / 2) : maxArm) : 1) : 0
          const r = hasR ? (hasL ? (2 * maxArm >= n ? Math.floor(n / 2) : maxArm) : 1) : 0
          const midN = n - l - r
          if (midN <= 0) return { L: l, R: r, mid: [] as number[] }
          if (hasL && hasR) {
            const k = Math.ceil(midN / maxArm)
            const armTotal = n - k * maxArm
            const newL = Math.ceil(armTotal / 2)
            return { L: newL, R: armTotal - newL, mid: Array(k).fill(maxArm) as number[] }
          }
          const numFull = Math.floor(midN / maxArm)
          const rem = midN % maxArm
          return { L: l, R: r, mid: [...Array(numFull).fill(maxArm), ...(rem > 0 ? [rem] : [])] as number[] }
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
  },
})
