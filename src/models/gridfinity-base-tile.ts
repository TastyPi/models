import { getManifold } from '../manifold'
import { resolveBed, splitSizes } from '../printBed'

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

const EP_TAB_W = 10
const EP_TAB_D = 2.5
const EP_NECK_W = 3
const EP_NECK_D = 1.2
const EP_GAP = 0.15
const EP_H_MALE = 2.0
const EP_H_FEMALE = 2.25

const MAG_D = 6.0
const MAG_H = 2.4
const MAG_CORNER = CELL / 2 - 8.0

const PIECE_GAP = 5

export const flatModel = true

export interface Params {
  cells_x: number
  cells_y: number
  base_style: string
  magnets: boolean
  restrict_bed: boolean
  bed_type: string
  bed_x: number
  bed_y: number
}

export function generate({ cells_x, cells_y, base_style, magnets, restrict_bed, bed_type, bed_x, bed_y }: Params) {
    const { Manifold, CrossSection } = getManifold()

    const roundBarX = (w: number, h: number) => {
      const r = h / 2
      return CrossSection.hull([
        CrossSection.circle(r).translate([r, r]),
        CrossSection.circle(r).translate([w - r, r]),
      ])
    }

    const roundBarXNeg = (w: number, h: number) => {
      const r = h / 2
      return CrossSection.square([w + 2 * r, h])
        .translate([-r, 0])
        .subtract(
          CrossSection.circle(r).translate([-r, r])
            .add(CrossSection.circle(r).translate([w + r, r]))
        )
    }

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

    const maleEast = malePiece.rotate(-90)
    const femaleWest = femalePiece.rotate(-90)

    const buildPiece = (startX: number, nX: number, startY: number, nY: number) => {
      const cellXCenters = Array.from({ length: nX }, (_, i) =>
        (startX + i - (cells_x - 1) / 2) * CELL
      )
      const cellYCenters = Array.from({ length: nY }, (_, j) =>
        (startY + j - (cells_y - 1) / 2) * CELL
      )

      const pieceLeft   = cellXCenters[0] - CELL / 2
      const pieceRight  = cellXCenters[nX - 1] + CELL / 2
      const pieceBottom = cellYCenters[0] - CELL / 2
      const pieceTop    = cellYCenters[nY - 1] + CELL / 2

      const tileSolid = CrossSection.square([pieceRight - pieceLeft, pieceTop - pieceBottom])
        .translate([pieceLeft, pieceBottom])
        .extrude(BASE_H)

      const allVoids = Manifold.union(
        cellXCenters.flatMap(cx => cellYCenters.map(cy => cellVoid(cx, cy)))
      )
      let tile = tileSolid.subtract(allVoids)

      if (base_style === 'floor') {
        const floorCuts = cellXCenters.flatMap(cx =>
          cellYCenters.map(cy => voidCS(R1).extrude(H1 + 0.01).translate([cx, cy, 0]))
        )
        tile = tile.subtract(Manifold.union(floorCuts))
      } else if (base_style === 'open') {
        const openCuts = cellXCenters.flatMap(cx =>
          cellYCenters.map(cy => voidCS(OUTER_R).extrude(BASE_H + 0.01).translate([cx, cy, 0]))
        )
        tile = tile.subtract(Manifold.union(openCuts))
      }

      const southConnectors = cellXCenters.map(cx =>
        malePiece.mirror([0, 1]).translate([cx, pieceBottom]).extrude(EP_H_MALE)
          .intersect(adjCellSolid(cx, pieceBottom - CELL / 2))
      )
      const eastConnectors = cellYCenters.map(cy =>
        maleEast.translate([pieceRight, cy]).extrude(EP_H_MALE)
          .intersect(adjCellSolid(pieceRight + CELL / 2, cy))
      )
      const northCuts = cellXCenters.map(cx =>
        femalePiece.mirror([0, 1]).translate([cx, pieceTop]).extrude(EP_H_FEMALE)
      )
      const westCuts = cellYCenters.map(cy =>
        femaleWest.translate([pieceLeft, cy]).extrude(EP_H_FEMALE)
      )

      tile = tile
        .add(Manifold.union([...southConnectors, ...eastConnectors]))
        .subtract(Manifold.union([...northCuts, ...westCuts]))

      if (base_style === 'solid' && magnets) {
        const magnetHoles = cellXCenters.flatMap(cx =>
          cellYCenters.flatMap(cy => [
            [cx + MAG_CORNER, cy + MAG_CORNER],
            [cx - MAG_CORNER, cy + MAG_CORNER],
            [cx - MAG_CORNER, cy - MAG_CORNER],
            [cx + MAG_CORNER, cy - MAG_CORNER],
          ].map(([mx, my]) =>
            Manifold.cylinder(MAG_H, MAG_D / 2, MAG_D / 2, 32).translate([mx, my, 0])
          ))
        )
        tile = tile.subtract(Manifold.union(magnetHoles))
      }

      return tile
    }

    if (!restrict_bed) {
      return buildPiece(0, cells_x, 0, cells_y).rotate([-90, 0, 0])
    }

    const bed = resolveBed(bed_type, bed_x, bed_y)
    const sizesX = splitSizes(cells_x, Math.max(1, Math.floor(bed.x / CELL)))
    const sizesY = splitSizes(cells_y, Math.max(1, Math.floor(bed.y / CELL)))

    const pieces: ReturnType<typeof buildPiece>[] = []
    let startX = 0
    for (let pi = 0; pi < sizesX.length; pi++) {
      let startY = 0
      for (let pj = 0; pj < sizesY.length; pj++) {
        pieces.push(
          buildPiece(startX, sizesX[pi], startY, sizesY[pj])
            .translate([pi * PIECE_GAP + cells_x * CELL / 2, pj * PIECE_GAP + cells_y * CELL / 2, 0])
        )
        startY += sizesY[pj]
      }
      startX += sizesX[pi]
    }

    return Manifold.union(pieces).rotate([-90, 0, 0])
}
