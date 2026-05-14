import { getManifold } from '../manifold'
import type { Attribution } from '../types'
import { MAGNET_HOLE_R, MAGNET_HOLE_DEPTH, crushRibCrossSection } from '../magnets'

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
const CHAMFER_R = 0.8

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
  magnets: boolean; magnet_style: 'ribs' | 'smooth'; magnet_size: number
  chamfer: boolean; supportless: boolean; corner_magnets: boolean
  dividers_x: number; dividers_y: number
}) {
  const { cells_x, cells_y, height_units, stacking_lip, magnets, magnet_style, magnet_size, chamfer, supportless, corner_magnets, dividers_x, dividers_y } = p
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

  if (magnets) {
    const holeShapes: any[] = []
    cellXC.forEach(cx => cellYC.forEach(cy => {
      if (corner_magnets && !(
        (cx === cellXC[0] || cx === cellXC[cellXC.length - 1]) &&
        (cy === cellYC[0] || cy === cellYC[cellYC.length - 1])
      )) return
      const corners: [number, number][] = [
        [cx + MAG_OFFSET, cy + MAG_OFFSET], [cx - MAG_OFFSET, cy + MAG_OFFSET],
        [cx - MAG_OFFSET, cy - MAG_OFFSET], [cx + MAG_OFFSET, cy - MAG_OFFSET],
      ]
      for (const [mx, my] of corners) {
        const useRibs = magnet_style === 'ribs'
        const holeR = useRibs ? MAGNET_HOLE_R : magnet_size / 2
        const magCS: any = useRibs ? crushRibCrossSection(CrossSection) : null

        if (supportless) {
          const nSteps = 4
          const stepH = MAGNET_HOLE_DEPTH / nSteps
          for (let i = 0; i < nSteps; i++) {
            const stepCyl = magCS
              ? magCS.extrude(stepH + 0.01).translate([mx, my, i * stepH - 0.005])
              : Manifold.cylinder(stepH + 0.01, holeR, holeR, 32)
                  .translate([mx, my, i * stepH - 0.005])
            const bridge = Manifold.cube([holeR * 2 + 0.02, holeR + 0.01, stepH + 0.02])
              .translate([-holeR - 0.01, -0.005, -0.01])
              .rotate([0, 0, i * 90])
              .translate([mx, my, i * stepH])
            holeShapes.push(stepCyl.subtract(bridge))
          }
        } else {
          holeShapes.push(
            magCS
              ? magCS.extrude(MAGNET_HOLE_DEPTH + 0.01).translate([mx, my, -0.005])
              : Manifold.cylinder(MAGNET_HOLE_DEPTH + 0.01, holeR, holeR, 32)
                  .translate([mx, my, -0.005])
          )
        }

        if (chamfer) {
          holeShapes.push(
            Manifold.cylinder(CHAMFER_R + 0.01, holeR + CHAMFER_R, holeR, 32)
              .translate([mx, my, -0.01])
          )
        }
      }
    }))
    bin = bin.subtract(Manifold.union(holeShapes))
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

  return bin.rotate([-90, 0, 0])
}
