import { getManifold } from '../manifold'

const CELL = 42
const BASE_H = 5

const EP_TAB_W = 10
const EP_TAB_D = 2.5
const EP_NECK_W = 3
const EP_NECK_D = 1.2
const EP_GAP = 0.15
const EP_H_MALE = 2.0
const EP_H_FEMALE = 2.25



export interface Params {
  cells_x: number
  cells_y: number
  depth: number
  n: boolean
  s: boolean
  e: boolean
  w: boolean
  end_connectors: boolean
}

export function generate({ cells_x, cells_y, depth, n, s, e, w, end_connectors }: Params) {
    const { Manifold, CrossSection } = getManifold()

    const roundBarX = (bw: number, bh: number) => {
      const r = bh / 2
      return CrossSection.hull([
        CrossSection.circle(r).translate([r, r]),
        CrossSection.circle(r).translate([bw - r, r]),
      ])
    }

    const roundBarXNeg = (bw: number, bh: number) => {
      const r = bh / 2
      return CrossSection.square([bw + 2 * r, bh])
        .translate([-r, 0])
        .subtract(
          CrossSection.circle(r).translate([-r, r])
            .add(CrossSection.circle(r).translate([bw + r, r]))
        )
    }

    const buildMale = (sc: number) => {
      const tw = EP_TAB_W * sc, td = EP_TAB_D * sc, nw = EP_NECK_W * sc, nd = EP_NECK_D * sc
      return roundBarXNeg(nw, nd).translate([-nw / 2, 0])
        .add(roundBarX(tw, td).translate([-tw / 2, nd]))
    }
    const buildFemale = (sc: number) => {
      const tw = EP_TAB_W * sc, td = EP_TAB_D * sc, nw = EP_NECK_W * sc, nd = EP_NECK_D * sc
      return roundBarXNeg(nw + 2 * EP_GAP, nd)
        .translate([-(nw / 2 + EP_GAP), 0])
        .add(roundBarX(tw + 2 * EP_GAP, td + EP_GAP).translate([-(tw / 2 + EP_GAP), nd]))
    }

    const malePiece = buildMale(1)
    const femalePiece = buildFemale(1)

    const ihx = cells_x * CELL / 2
    const ihy = cells_y * CELL / 2
    const d = depth

    const endScale = Math.min(1, (d - 2) / EP_TAB_W)
    const endMale = buildMale(endScale)
    const endFemale = buildFemale(endScale)

    const strips: ReturnType<typeof CrossSection.square>[] = []

    if (n) strips.push(
      CrossSection.square([cells_x * CELL + (w ? d : 0) + (e ? d : 0), d])
        .translate([-(ihx + (w ? d : 0)), ihy])
    )
    if (s) strips.push(
      CrossSection.square([cells_x * CELL + (w ? d : 0) + (e ? d : 0), d])
        .translate([-(ihx + (w ? d : 0)), -(ihy + d)])
    )
    if (e) strips.push(
      CrossSection.square([d, cells_y * CELL + (n ? d : 0) + (s ? d : 0)])
        .translate([ihx, -(ihy + (s ? d : 0))])
    )
    if (w) strips.push(
      CrossSection.square([d, cells_y * CELL + (n ? d : 0) + (s ? d : 0)])
        .translate([-(ihx + d), -(ihy + (s ? d : 0))])
    )

    if (strips.length === 0) return Manifold.cube([1, 1, 0.01], true)

    const wallSolid = strips.reduce((a, b) => a.add(b)).extrude(BASE_H)

    const toAdd: ReturnType<typeof Manifold.cube>[] = []
    const toSub: ReturnType<typeof Manifold.cube>[] = []

    const cellXC = Array.from({ length: cells_x }, (_, i) => (i - (cells_x - 1) / 2) * CELL)
    const cellYC = Array.from({ length: cells_y }, (_, j) => (j - (cells_y - 1) / 2) * CELL)

    if (n) {
      for (const cx of cellXC)
        toSub.push(femalePiece.translate([cx, ihy]).extrude(EP_H_FEMALE))
    }
    if (s) {
      for (const cx of cellXC)
        toAdd.push(malePiece.translate([cx, -ihy]).extrude(EP_H_MALE))
    }
    if (e) {
      const fE = femalePiece.rotate(-90)
      for (const cy of cellYC)
        toSub.push(fE.translate([ihx, cy]).extrude(EP_H_FEMALE))
    }
    if (w) {
      const mW = malePiece.rotate(-90)
      for (const cy of cellYC)
        toAdd.push(mW.translate([-ihx, cy]).extrude(EP_H_MALE))
    }

    if (end_connectors) {
      if (n && !w) toSub.push(endFemale.rotate(-90).translate([-ihx, ihy + d / 2]).extrude(EP_H_FEMALE))
      if (n && !e) toAdd.push(endMale.rotate(-90).translate([ihx, ihy + d / 2]).extrude(EP_H_MALE))

      if (s && !w) toSub.push(endFemale.rotate(-90).translate([-ihx, -(ihy + d / 2)]).extrude(EP_H_FEMALE))
      if (s && !e) toAdd.push(endMale.rotate(-90).translate([ihx, -(ihy + d / 2)]).extrude(EP_H_MALE))

      if (e && !n) toAdd.push(endMale.translate([ihx + d / 2, ihy]).extrude(EP_H_MALE))
      if (e && !s) toSub.push(endFemale.translate([ihx + d / 2, -ihy]).extrude(EP_H_FEMALE))

      if (w && !n) toAdd.push(endMale.translate([-(ihx + d / 2), ihy]).extrude(EP_H_MALE))
      if (w && !s) toSub.push(endFemale.translate([-(ihx + d / 2), -ihy]).extrude(EP_H_FEMALE))
    }

    let wall: ReturnType<typeof wallSolid.subtract> = wallSolid
    if (toAdd.length > 0) wall = wall.add(Manifold.union(toAdd))
    if (toSub.length > 0) wall = wall.subtract(Manifold.union(toSub))

    return wall.rotate([-90, 0, 0])
}
