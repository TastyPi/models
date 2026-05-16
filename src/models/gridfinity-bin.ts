import { getManifold, manifoldToBufferGeometry } from '../manifold'
import type { Attribution, GeomResult } from '../types'
import { MAGNET_HOLE_DEPTH } from '../magnets'

// Gridfinity spec constants (from https://gridfinity.xyz/specification/)
// Profile coordinates sourced from gridfinity-rebuilt-openscad by Kenneth Hodson
const CELL = 42
const OUTER_R = 4
const BASE_H = 5
const CORE_HALF = CELL / 2 - OUTER_R  // 17
const R1 = OUTER_R - 2.85             // 1.15
const H1 = BASE_H - 4.65              // 0.35
const R2 = R1 + 0.7                   // 1.85
const H2 = H1 + 0.7                   // 1.05
const H3 = H2 + 1.8                   // 2.85

const BIN_GAP = 0.25
const BOX_OUTER_R = OUTER_R - BIN_GAP  // 3.75
export const HEIGHT_UNIT = 7
const WALL_THICK = 1.2
const FLOOR_THICK = 1.2

// Stacking lip (from gridfinity-rebuilt-openscad standard.scad STACKING_LIP_LINE)
export const STACKING_LIP_H = 4.4
const STACKING_LIP_D = 2.6
const LIP_R_TIP = BOX_OUTER_R - STACKING_LIP_D   // 1.15
const LIP_R_MID = LIP_R_TIP + 0.7                 // 1.85

// Base hole constants (from gridfinity-rebuilt-openscad standard.scad)
const MAG_OFFSET = 13
const SCREW_HOLE_R = 1.5
const LAYER_HEIGHT = 0.2
const BRIDGE_LAYERS = 3

export function magnetHoleDepth(supportless: boolean): { clearDepth: number; totalDepth: number } {
  return supportless
    ? { clearDepth: MAGNET_HOLE_DEPTH, totalDepth: MAGNET_HOLE_DEPTH + BRIDGE_LAYERS * LAYER_HEIGHT }
    : { clearDepth: MAGNET_HOLE_DEPTH, totalDepth: MAGNET_HOLE_DEPTH }
}

// Hollow (lite) base constants (from gridfinity-rebuilt-openscad)
const WALL_THICK_BASE = 0.95  // d_wall — shell wall thickness for hollow base
const LITE_FLOOR_THICK = 1.0  // bottom skin thickness for hollow base

export const attribution: Attribution[] = [
  { name: 'Gridfinity', author: 'Zachary Freedman / Voidstar Lab', url: 'https://www.youtube.com/watch?v=ra_9zU-mnl8', license: 'MIT' },
  { name: 'gridfinity-rebuilt-openscad', author: 'Kenneth Hodson', url: 'https://github.com/kennetek/gridfinity-rebuilt-openscad', license: 'MIT' },
]

export function info(cells_x: number, cells_y: number, height_units: number, stacking_lip: boolean): string {
  const w = cells_x * CELL - 2 * BIN_GAP
  const d = cells_y * CELL - 2 * BIN_GAP
  const h = height_units * HEIGHT_UNIT + (stacking_lip ? STACKING_LIP_H : 0)
  return `${w} × ${d} × ${h} mm`
}

export function generate(p: {
  cells_x: number; cells_y: number; height_units: number
  stacking_lip: boolean
  magnet_size: number | null; screw_holes: boolean
  supportless: boolean; corner_magnets: boolean
  hollow_base: boolean
  dividers_x: number; dividers_y: number
}): GeomResult {
  const { cells_x, cells_y, height_units, stacking_lip, magnet_size, screw_holes, supportless, corner_magnets, hollow_base, dividers_x, dividers_y } = p
  const { Manifold, CrossSection } = getManifold()

  const nominalH = height_units * HEIGHT_UNIT

  const cellXC = Array.from({ length: cells_x }, (_, i) => (i - (cells_x - 1) / 2) * CELL)
  const cellYC = Array.from({ length: cells_y }, (_, j) => (j - (cells_y - 1) / 2) * CELL)

  const postCS = (r: number) =>
    CrossSection.square([2 * CORE_HALF, 2 * CORE_HALF], true).offset(r - BIN_GAP)

  const postSlab = (r: number, cx: number, cy: number, z: number): any =>
    postCS(r).extrude(0.01).translate([cx, cy, z])

  const cellPost = (cx: number, cy: number): any => Manifold.union([
    Manifold.hull([postSlab(R1 - 0.5, cx, cy, 0),    postSlab(R1,      cx, cy, H1)]),
    Manifold.hull([postSlab(R1,       cx, cy, H1),    postSlab(R2,      cx, cy, H2)]),
    postCS(R2).extrude(H3 - H2).translate([cx, cy, H2]),
    Manifold.hull([postSlab(R2,       cx, cy, H3),    postSlab(OUTER_R, cx, cy, BASE_H)]),
  ])

  const sqW = cells_x * CELL - 2 * OUTER_R
  const sqD = cells_y * CELL - 2 * OUTER_R
  const outerCS = CrossSection.square([sqW, sqD], true).offset(BOX_OUTER_R)
  const innerCS = CrossSection.square([sqW, sqD], true)
    .offset(Math.max(0.01, BOX_OUTER_R - WALL_THICK))

  const posts = Manifold.union(cellXC.flatMap(cx => cellYC.map(cy => cellPost(cx, cy))))
  const floor = outerCS.extrude(FLOOR_THICK).translate([0, 0, BASE_H])
  const walls = outerCS.subtract(innerCS)
    .extrude(nominalH - BASE_H - FLOOR_THICK)
    .translate([0, 0, BASE_H + FLOOR_THICK])

  let bin: any = Manifold.union([posts, floor, walls])

  // Hollow (lite) base: void out each cell's interior leaving ~0.95mm shell walls + bottom skin.
  // Uses the same absolute profile heights as the outer post but with radii reduced by WALL_THICK_BASE,
  // then intersects with a zone that starts at LITE_FLOOR_THICK to preserve the bottom skin.
  // Floor slab above BASE_H stays solid, sealing the hollow space from the bin interior.
  if (hollow_base) {
    const iR = (r: number) => Math.max(BIN_GAP + 0.01, r - WALL_THICK_BASE)
    const iCS = (r: number) =>
      CrossSection.square([2 * CORE_HALF, 2 * CORE_HALF], true).offset(iR(r) - BIN_GAP)
    const iSlab = (r: number, cx: number, cy: number, z: number): any =>
      iCS(r).extrude(0.01).translate([cx, cy, z])

    const sz = (cells_x + cells_y) * CELL + 100
    const clipZone = Manifold.cube([sz * 2, sz * 2, BASE_H - LITE_FLOOR_THICK])
      .translate([-sz, -sz, LITE_FLOOR_THICK])

    const cellVoids = cellXC.flatMap(cx => cellYC.map(cy => {
      const innerFull = Manifold.union([
        Manifold.hull([iSlab(R1 - 0.5, cx, cy, 0),    iSlab(R1,      cx, cy, H1)]),
        Manifold.hull([iSlab(R1,       cx, cy, H1),    iSlab(R2,      cx, cy, H2)]),
        iCS(R2).extrude(H3 - H2).translate([cx, cy, H2]),
        Manifold.hull([iSlab(R2,       cx, cy, H3),    iSlab(OUTER_R, cx, cy, BASE_H)]),
      ])
      return innerFull.intersect(clipZone)
    }))

    // Open floor per-cell so hollow is visible from bin interior
    const perCellInnerCS = CrossSection.square([2 * CORE_HALF, 2 * CORE_HALF], true)
      .offset(Math.max(0.01, BOX_OUTER_R - WALL_THICK))
    const floorVoids = cellXC.flatMap(cx => cellYC.map(cy =>
      perCellInnerCS.extrude(FLOOR_THICK + 0.02).translate([cx, cy, BASE_H - 0.01])
    ))
    bin = bin.subtract(Manifold.union([...cellVoids, ...floorVoids]))

    // Cover: add solid plugs around each hole so the hollow shell doesn't break through
    if (magnet_size !== null || screw_holes) {
      const w = WALL_THICK_BASE
      const coverShapes: any[] = []
      cellXC.forEach(cx => cellYC.forEach(cy => {
        if (corner_magnets && !(
          (cx === cellXC[0] || cx === cellXC[cellXC.length - 1]) &&
          (cy === cellYC[0] || cy === cellYC[cellYC.length - 1])
        )) return
        const corners: [number, number][] = [
          [cx + MAG_OFFSET, cy + MAG_OFFSET],
          [cx - MAG_OFFSET, cy + MAG_OFFSET],
          [cx - MAG_OFFSET, cy - MAG_OFFSET],
          [cx + MAG_OFFSET, cy - MAG_OFFSET],
        ]
        for (const [mx, my] of corners) {
          if (magnet_size !== null)
            coverShapes.push(
              Manifold.cylinder(magnetHoleDepth(supportless).totalDepth + 2 * w, magnet_size / 2 + w, magnet_size / 2 + w, 32)
                .translate([mx, my, -0.005])
            )
          if (screw_holes)
            coverShapes.push(
              Manifold.cylinder(BASE_H + 2 * w, SCREW_HOLE_R + w, SCREW_HOLE_R + w, 32)
                .translate([mx, my, -0.005])
            )
        }
      }))
      if (coverShapes.length > 0) bin = bin.add(Manifold.union(coverShapes))
    }
  }

  if (magnet_size !== null || screw_holes) {
    const holeShapes: any[] = []

    cellXC.forEach(cx => cellYC.forEach(cy => {
      if (corner_magnets && !(
        (cx === cellXC[0] || cx === cellXC[cellXC.length - 1]) &&
        (cy === cellYC[0] || cy === cellYC[cellYC.length - 1])
      )) return

      const corners: [number, number][] = [
        [cx + MAG_OFFSET, cy + MAG_OFFSET],
        [cx - MAG_OFFSET, cy + MAG_OFFSET],
        [cx - MAG_OFFSET, cy - MAG_OFFSET],
        [cx + MAG_OFFSET, cy - MAG_OFFSET],
      ]

      for (const [mx, my] of corners) {
        if (magnet_size !== null) {
          const holeR = magnet_size / 2
          if (supportless) {
            // Full circle for the entrance, up to MAGNET_HOLE_DEPTH (2.4mm)
            holeShapes.push(
              Manifold.cylinder(MAGNET_HOLE_DEPTH + 0.01, holeR, holeR, 32)
                .translate([mx, my, -0.005])
            )
            // Top layers: D-shaped openings with alternating bridge orientation
            for (let i = 0; i < BRIDGE_LAYERS; i++) {
              const z = MAGNET_HOLE_DEPTH + i * LAYER_HEIGHT
              const layerCyl = Manifold.cylinder(LAYER_HEIGHT + 0.02, holeR, holeR, 32)
                .translate([0, 0, -0.01])
              const bridgeBlock = Manifold.cube([holeR * 2 + 0.02, holeR + 0.01, LAYER_HEIGHT + 0.04])
                .translate([-holeR - 0.01, 0, -0.02])
                .rotate([0, 0, i * 90])
              holeShapes.push(layerCyl.subtract(bridgeBlock).translate([mx, my, z]))
            }
          } else {
            holeShapes.push(
              Manifold.cylinder(MAGNET_HOLE_DEPTH + 0.01, holeR, holeR, 32)
                .translate([mx, my, -0.005])
            )
          }
        }

        if (screw_holes) {
          holeShapes.push(
            Manifold.cylinder(BASE_H + 0.01, SCREW_HOLE_R, SCREW_HOLE_R, 32)
              .translate([mx, my, -0.005])
          )
        }
      }
    }))

    if (holeShapes.length > 0) {
      bin = bin.subtract(Manifold.union(holeShapes))
    }
  }

  if (stacking_lip) {
    const voidCS = (r: number) => CrossSection.square([sqW, sqD], true).offset(r)
    const vs = (r: number, z: number): any => voidCS(r).extrude(0.01).translate([0, 0, z])
    const innerVoid = Manifold.union([
      Manifold.hull([vs(LIP_R_TIP, nominalH),  vs(LIP_R_MID, nominalH + 0.7)]),
      voidCS(LIP_R_MID).extrude(1.8).translate([0, 0, nominalH + 0.7]),
      Manifold.hull([vs(LIP_R_MID, nominalH + 2.5), vs(BOX_OUTER_R - 0.01, nominalH + STACKING_LIP_H)]),
    ])
    const lip = outerCS.extrude(STACKING_LIP_H).translate([0, 0, nominalH]).subtract(innerVoid)
    bin = bin.add(lip)
  }

  const dividerFloorZ = BASE_H + FLOOR_THICK
  const dividerH = nominalH - dividerFloorZ
  const cavityHalfX = cells_x * CELL / 2 - BIN_GAP - WALL_THICK
  const cavityHalfY = cells_y * CELL / 2 - BIN_GAP - WALL_THICK

  if (dividers_x > 0) {
    const spacing = (cavityHalfY * 2) / (dividers_x + 1)
    const divParts: any[] = []
    for (let i = 1; i <= dividers_x; i++) {
      divParts.push(
        CrossSection.square([cavityHalfX * 2, WALL_THICK], true)
          .extrude(dividerH)
          .translate([0, -cavityHalfY + i * spacing, dividerFloorZ])
      )
    }
    bin = bin.add(Manifold.union(divParts))
  }

  if (dividers_y > 0) {
    const spacing = (cavityHalfX * 2) / (dividers_y + 1)
    const divParts: any[] = []
    for (let i = 1; i <= dividers_y; i++) {
      divParts.push(
        CrossSection.square([WALL_THICK, cavityHalfY * 2], true)
          .extrude(dividerH)
          .translate([-cavityHalfX + i * spacing, 0, dividerFloorZ])
      )
    }
    bin = bin.add(Manifold.union(divParts))
  }

  const partSettings: Record<string, string> | undefined = hollow_base ? { fill_density: '0%' } : undefined
  return { objects: [{ label: 'Gridfinity Bin', parts: [{ label: 'Gridfinity Bin', geom: manifoldToBufferGeometry(bin), settings: partSettings }] }] }
}
