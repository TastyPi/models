import { getManifold } from '../manifold'
import { defineModel } from '../types'

const CELL = 42
const BASE_H = 5

const EP_TAB_W = 10
const EP_TAB_D = 2.5
const EP_NECK_W = 3
const EP_NECK_D = 1.2
const EP_GAP = 0.15
const EP_H_MALE = 2.0
const EP_H_FEMALE = 2.25

export default defineModel({
  name: 'Gridfinity Baseplate Wall',
  description: 'Border piece for a modular Gridfinity baseplate. Enable any combination of sides to make straight walls, corners, U-shapes, or full frames.',
  attribution: [
    { name: 'GridFlock', author: 'Jonas Konrad', url: 'https://github.com/yawkat/GridFlock', license: 'MIT, CC BY 4.0' },
  ],
  parameters: {
    n: { type: 'boolean', label: 'North wall' },
    s: { type: 'boolean', label: 'South wall' },
    e: { type: 'boolean', label: 'East wall' },
    w: { type: 'boolean', label: 'West wall' },
    cells_x: { type: 'number', label: 'Width (cells)', min: 1, max: 20, step: 1 },
    cells_y: { type: 'number', label: 'Height (cells)', min: 1, max: 20, step: 1 },
    depth: { type: 'number', label: 'Wall depth (mm)', min: 4, max: 40, step: 1 },
    end_connectors: { type: 'boolean', label: 'End connectors' },
  },
  groups: [
    { label: 'Sides', keys: ['n', 's', 'e', 'w'], defaultOpen: true },
    { label: 'Size', keys: ['cells_x', 'cells_y', 'depth'], defaultOpen: true },
    { label: 'Options', keys: ['end_connectors'], defaultOpen: true },
  ],
  presets: [
    { label: 'Halfords MC — N/S wall (9mm)', values: { n: true, s: false, e: false, w: false, cells_x: 13, cells_y: 9, depth: 9, end_connectors: true } },
    { label: 'Halfords MC — E/W wall (11mm)', values: { n: false, s: false, e: true, w: false, cells_x: 13, cells_y: 9, depth: 11, end_connectors: true } },
  ],

  generate({ cells_x, cells_y, depth, n, s, e, w, end_connectors }) {
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

    // Build connector profiles at a given scale (1 = full GridFlock size).
    // End connectors scale down to fit within the wall depth; inner-face connectors always use scale 1.
    const buildMale = (s: number) => {
      const tw = EP_TAB_W * s, td = EP_TAB_D * s, nw = EP_NECK_W * s, nd = EP_NECK_D * s
      return roundBarXNeg(nw, nd).translate([-nw / 2, 0])
        .add(roundBarX(tw, td).translate([-tw / 2, nd]))
    }
    const buildFemale = (s: number) => {
      const tw = EP_TAB_W * s, td = EP_TAB_D * s, nw = EP_NECK_W * s, nd = EP_NECK_D * s
      return roundBarXNeg(nw + 2 * EP_GAP, nd)
        .translate([-(nw / 2 + EP_GAP), 0])
        .add(roundBarX(tw + 2 * EP_GAP, td + EP_GAP).translate([-(tw / 2 + EP_GAP), nd]))
    }

    const malePiece = buildMale(1)
    const femalePiece = buildFemale(1)

    const ihx = (cells_x as number) * CELL / 2  // inner half-width
    const ihy = (cells_y as number) * CELL / 2  // inner half-height
    const d = depth as number

    // End connectors must be strictly smaller than the wall depth face (1mm margin each side)
    const endScale = Math.min(1, (d - 2) / EP_TAB_W)
    const endMale = buildMale(endScale)
    const endFemale = buildFemale(endScale)

    // ── Cross-section ────────────────────────────────────────────────────────
    // Each enabled side strip extends into adjacent corners when both sides meet.
    const strips: ReturnType<typeof CrossSection.square>[] = []

    if (n) strips.push(
      CrossSection.square([(cells_x as number) * CELL + (w ? d : 0) + (e ? d : 0), d])
        .translate([-(ihx + (w ? d : 0)), ihy])
    )
    if (s) strips.push(
      CrossSection.square([(cells_x as number) * CELL + (w ? d : 0) + (e ? d : 0), d])
        .translate([-(ihx + (w ? d : 0)), -(ihy + d)])
    )
    if (e) strips.push(
      CrossSection.square([d, (cells_y as number) * CELL + (n ? d : 0) + (s ? d : 0)])
        .translate([ihx, -(ihy + (s ? d : 0))])
    )
    if (w) strips.push(
      CrossSection.square([d, (cells_y as number) * CELL + (n ? d : 0) + (s ? d : 0)])
        .translate([-(ihx + d), -(ihy + (s ? d : 0))])
    )

    if (strips.length === 0) return Manifold.cube([1, 1, 0.01], true)

    const wallSolid = strips.reduce((a, b) => a.add(b)).extrude(BASE_H)

    // ── Connector accumulators ───────────────────────────────────────────────
    const toAdd: ReturnType<typeof Manifold.cube>[] = []
    const toSub: ReturnType<typeof Manifold.cube>[] = []

    const cellXC = Array.from({ length: cells_x as number }, (_, i) => (i - ((cells_x as number) - 1) / 2) * CELL)
    const cellYC = Array.from({ length: cells_y as number }, (_, j) => (j - ((cells_y as number) - 1) / 2) * CELL)

    // ── Inner-face connectors (connect to tile edges) ────────────────────────
    // Convention mirrors tiles: tile N/E edges are male → wall N/E inner faces are female.
    //                           tile S/W edges are female → wall S/W inner faces are male.
    if (n) {
      for (const cx of cellXC)
        toSub.push(femalePiece.translate([cx, ihy]).extrude(EP_H_FEMALE))
    }
    if (s) {
      // malePiece opens at Y=0 in +Y — protrudes from Y=-ihy toward tiles above
      for (const cx of cellXC)
        toAdd.push(malePiece.translate([cx, -ihy]).extrude(EP_H_MALE))
    }
    if (e) {
      const fE = femalePiece.rotate(-90)  // opens at X=0, socket in +X
      for (const cy of cellYC)
        toSub.push(fE.translate([ihx, cy]).extrude(EP_H_FEMALE))
    }
    if (w) {
      const mW = malePiece.rotate(-90)  // protrudes in +X from X=0
      for (const cy of cellYC)
        toAdd.push(mW.translate([-ihx, cy]).extrude(EP_H_MALE))
    }

    // ── End connectors (connect wall pieces to each other) ───────────────────
    // Convention: east/north-facing ends → male tab; west/south-facing → female socket.
    // Profile is scaled to fit within the wall depth face.
    if (end_connectors) {
      // North strip ends (only where no adjacent side fills the corner)
      if (n && !w) toSub.push(endFemale.rotate(-90).translate([-ihx, ihy + d / 2]).extrude(EP_H_FEMALE))
      if (n && !e) toAdd.push(endMale.rotate(-90).translate([ihx, ihy + d / 2]).extrude(EP_H_MALE))

      // South strip ends
      if (s && !w) toSub.push(endFemale.rotate(-90).translate([-ihx, -(ihy + d / 2)]).extrude(EP_H_FEMALE))
      if (s && !e) toAdd.push(endMale.rotate(-90).translate([ihx, -(ihy + d / 2)]).extrude(EP_H_MALE))

      // East strip ends
      if (e && !n) toAdd.push(endMale.translate([ihx + d / 2, ihy]).extrude(EP_H_MALE))
      if (e && !s) toSub.push(endFemale.translate([ihx + d / 2, -ihy]).extrude(EP_H_FEMALE))

      // West strip ends
      if (w && !n) toAdd.push(endMale.translate([-(ihx + d / 2), ihy]).extrude(EP_H_MALE))
      if (w && !s) toSub.push(endFemale.translate([-(ihx + d / 2), -ihy]).extrude(EP_H_FEMALE))
    }

    let wall: ReturnType<typeof wallSolid.subtract> = wallSolid
    if (toAdd.length > 0) wall = wall.add(Manifold.union(toAdd))
    if (toSub.length > 0) wall = wall.subtract(Manifold.union(toSub))

    return wall.rotate([-90, 0, 0])
  },
})
