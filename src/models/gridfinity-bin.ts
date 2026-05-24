import { getManifold, manifoldToBufferGeometry } from '../manifold'
import { SOLID_INFILL } from '../types'
import type { Attribution, GeomResult } from '../types'
import { MAGNET_HOLE_DEPTH } from '../magnets'

// Gridfinity spec constants (from https://gridfinity.xyz/specification/)
// Profile coordinates sourced from gridfinity-rebuilt-openscad by Kenneth Hodson
const CELL = 42
const OUTER_R = 4
export const BASE_H = 5
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
export const FLOOR_THICK = 1.2

// Stacking lip (from gridfinity-rebuilt-openscad standard.scad STACKING_LIP_LINE)
export const STACKING_LIP_H = 4.4
export const STACKING_LIP_D = 2.6
export const LIP_R_TIP = BOX_OUTER_R - STACKING_LIP_D   // 1.15
export const LIP_R_MID = LIP_R_TIP + 0.7                 // 1.85
export const STACKING_LIP_FILLET_R = 0.6
export const LIP_SUPPORT_INNER_H = 1.2
export const LIP_SUPPORT_OUTER_H = LIP_SUPPORT_INNER_H + STACKING_LIP_D  // 3.8 — 45° chamfer

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

// Label tab constants (from gridfinity-rebuilt-openscad standard.scad)
const TAB_W_NOMINAL = CELL             // TAB_WIDTH_NOMINAL = 42mm
export const TAB_D = 15.85             // _tab_depth: how far tab protrudes into bin
const TAB_SUPPORT_ANGLE_DEG = 36
export const TAB_SUPPORT_H = 1.2       // _tab_support_height
export const TAB_H = Math.tan(TAB_SUPPORT_ANGLE_DEG * Math.PI / 180) * TAB_D + TAB_SUPPORT_H

export const attribution: Attribution[] = [
  { name: 'Gridfinity', author: 'Zachary Freedman / Voidstar Lab', url: 'https://www.youtube.com/watch?v=ra_9zU-mnl8', license: 'MIT' },
  { name: 'gridfinity-rebuilt-openscad', author: 'Kenneth Hodson', url: 'https://github.com/kennetek/gridfinity-rebuilt-openscad', license: 'MIT' },
]

export function holePositions(cells_x: number, cells_y: number, corner_magnets: boolean): [number, number][] {
  const cellXC = Array.from({ length: cells_x }, (_, i) => (i - (cells_x - 1) / 2) * CELL)
  const cellYC = Array.from({ length: cells_y }, (_, j) => (j - (cells_y - 1) / 2) * CELL)
  return corner_magnets
    ? [
        [cellXC[0] - MAG_OFFSET,                 cellYC[0] - MAG_OFFSET],
        [cellXC[cellXC.length - 1] + MAG_OFFSET, cellYC[0] - MAG_OFFSET],
        [cellXC[0] - MAG_OFFSET,                 cellYC[cellYC.length - 1] + MAG_OFFSET],
        [cellXC[cellXC.length - 1] + MAG_OFFSET, cellYC[cellYC.length - 1] + MAG_OFFSET],
      ]
    : cellXC.flatMap(cx => cellYC.flatMap(cy => [
        [cx + MAG_OFFSET, cy + MAG_OFFSET],
        [cx - MAG_OFFSET, cy + MAG_OFFSET],
        [cx - MAG_OFFSET, cy - MAG_OFFSET],
        [cx + MAG_OFFSET, cy - MAG_OFFSET],
      ] as [number, number][]))
}

export function info(cells_x: number, cells_y: number, height_units: number, stacking_lip: boolean): string {
  const w = cells_x * CELL - 2 * BIN_GAP
  const d = cells_y * CELL - 2 * BIN_GAP
  const h = height_units * HEIGHT_UNIT + (stacking_lip ? STACKING_LIP_H : 0)
  return `${w} × ${d} × ${h} mm`
}

export type BinHoleSettings = {
  magnet_size: number | null
  screw_holes: boolean
  supportless: boolean
  corner_magnets: boolean
}

export function binHoleSettingsFromUrl(sp: URLSearchParams, defaultMagnetSize: number | null): BinHoleSettings {
  const ms = sp.get('magnet_size')
  return {
    magnet_size: ms !== null ? (parseFloat(ms) || null) : defaultMagnetSize,
    screw_holes: sp.get('screw_holes') === 'true',
    supportless: sp.has('supportless') ? sp.get('supportless') === 'true' : true,
    corner_magnets: sp.get('corner_magnets') === 'true',
  }
}

export function binHoleSettingsToUrl(url: URLSearchParams, holes: BinHoleSettings): void {
  if (holes.magnet_size !== null) {
    if (holes.magnet_size !== 6.2) url.set('magnet_size', String(holes.magnet_size))
    if (holes.supportless) url.set('supportless', 'true')
  } else {
    url.set('magnet_size', '0')
  }
  if (holes.screw_holes) url.set('screw_holes', 'true')
  if ((holes.magnet_size !== null || holes.screw_holes) && holes.corner_magnets) url.set('corner_magnets', 'true')
}

type BinParams = {
  cells_x: number; cells_y: number; height_units: number
  stacking_lip: boolean
  holes: BinHoleSettings
  base_style: 'flat' | 'hollow' | 'scoop'
  dividers_x: number; dividers_y: number
  label_style: 'none' | 'full' | 'left' | 'center' | 'right'
}

export function buildBinManifold(p: BinParams): any {
  const { cells_x, cells_y, height_units, stacking_lip, holes, base_style, dividers_x, dividers_y, label_style } = p
  const { magnet_size, screw_holes, supportless, corner_magnets } = holes
  const hollow_base = base_style === 'hollow'
  const scoop = base_style === 'scoop' ? 1 : 0
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
  const positions = holePositions(cells_x, cells_y, corner_magnets)

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
      for (const [mx, my] of positions) {
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
      if (coverShapes.length > 0) bin = bin.add(Manifold.union(coverShapes))
    }
  }

  if (magnet_size !== null || screw_holes) {
    const holeShapes: any[] = []

    for (const [mx, my] of positions) {
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
    // Chamfer the outer top corner from outside (not inner void) so the notch stays open for stacking.
    // cornerToRemove = outer ring at top, tapering to zero FILLET_R below the top.
    const cornerOuter = outerCS.extrude(STACKING_LIP_FILLET_R).translate([0, 0, nominalH + STACKING_LIP_H - STACKING_LIP_FILLET_R])
    const cornerInner = Manifold.hull([
      vs(BOX_OUTER_R - STACKING_LIP_FILLET_R, nominalH + STACKING_LIP_H),
      vs(BOX_OUTER_R,                          nominalH + STACKING_LIP_H - STACKING_LIP_FILLET_R),
    ])
    const lip = outerCS.extrude(STACKING_LIP_H).translate([0, 0, nominalH])
      .subtract(innerVoid)
      .subtract(cornerOuter.subtract(cornerInner))
    // Support: outer solid block minus a hollow frustum carved out of the interior.
    // Hull of solid rounded squares fills the whole bin if sizes differ, so we must subtract.
    const supportOuter = outerCS.extrude(LIP_SUPPORT_OUTER_H).translate([0, 0, nominalH - LIP_SUPPORT_OUTER_H])
    const supportHollow = Manifold.union([
      voidCS(LIP_R_TIP).extrude(LIP_SUPPORT_INNER_H).translate([0, 0, nominalH - LIP_SUPPORT_INNER_H]),
      Manifold.hull([
        vs(LIP_R_TIP,          nominalH - LIP_SUPPORT_INNER_H),
        vs(BOX_OUTER_R - 0.02, nominalH - LIP_SUPPORT_OUTER_H),
      ]),
    ])
    bin = bin.add(lip).add(supportOuter.subtract(supportHollow))
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

  if (scoop > 0) {
    const cavityH = nominalH - dividerFloorZ
    const r = scoop * cavityH / 2
    const nYComps = dividers_x + 1
    const nXComps = dividers_y + 1
    const ySpacing = (cavityHalfY * 2) / nYComps
    const xSpacing = (cavityHalfX * 2) / nXComps
    const scoopParts: any[] = []

    for (let ky = 0; ky < nYComps; ky++) {
      const yBack = -cavityHalfY + ky * ySpacing + (ky > 0 ? WALL_THICK / 2 : 0)

      for (let kx = 0; kx < nXComps; kx++) {
        const xLeft = -cavityHalfX + kx * xSpacing + (kx > 0 ? WALL_THICK / 2 : 0)
        const xRight = -cavityHalfX + (kx + 1) * xSpacing - (kx < nXComps - 1 ? WALL_THICK / 2 : 0)
        const xW = xRight - xLeft

        // Quarter-cylinder wedge: solid block at back-floor corner with concave arc face.
        // Block occupies y=[yBack, yBack+r], z=[dividerFloorZ, dividerFloorZ+r].
        // Cylinder (along X, center at y=yBack+r, z=dividerFloorZ) carves the concave surface.
        const block = Manifold.cube([xW, r, r])
          .translate([xLeft, yBack, dividerFloorZ])
        const cyl = Manifold.cylinder(xW + 0.02, r, r, 32)
          .rotate([0, 90, 0])
          .translate([xLeft - 0.01, yBack + r, dividerFloorZ + r])
        scoopParts.push(block.subtract(cyl))
      }
    }

    bin = bin.add(Manifold.union(scoopParts))
  }

  const tabTopZ = nominalH - LIP_SUPPORT_INNER_H
  if (label_style !== 'none' && tabTopZ - TAB_SUPPORT_H > dividerFloorZ) {
    const nXComps = dividers_y + 1
    const compSpacing = (cavityHalfX * 2) / nXComps
    const frontY = cavityHalfY
    const thinH = 0.01
    const tabParts: any[] = []

    for (let i = 0; i < nXComps; i++) {
      const compCenterX = -cavityHalfX + (i + 0.5) * compSpacing
      const compW = compSpacing - (nXComps > 1 ? WALL_THICK : 0)
      const tw = label_style === 'full' ? compW : Math.min(TAB_W_NOMINAL, compW)

      const tabXCenter = label_style === 'left'
        ? compCenterX - compW / 2 + tw / 2
        : label_style === 'right'
          ? compCenterX + compW / 2 - tw / 2
          : compCenterX

      const tabBottomZ = Math.max(tabTopZ - TAB_H, dividerFloorZ)
      const slabBottom = CrossSection.square([tw, thinH], true)
        .extrude(thinH)
        .translate([tabXCenter, frontY - thinH / 2, tabBottomZ])

      const slabFull = (z: number) => CrossSection.square([tw, TAB_D], true)
        .extrude(thinH)
        .translate([tabXCenter, frontY - TAB_D / 2, z])

      tabParts.push(Manifold.hull([
        slabBottom,
        slabFull(tabTopZ - TAB_SUPPORT_H),
        slabFull(tabTopZ),
      ]))
    }

    bin = bin.add(Manifold.union(tabParts))
  }

  return bin
}

export type FilledBinParams = {
  cells_x: number; cells_y: number; height_units: number
  stacking_lip: boolean
  holes: BinHoleSettings
}

export function buildBinFillManifold(p: FilledBinParams, fillTopZ?: number): any {
  const { cells_x, cells_y, height_units } = p
  const { CrossSection } = getManifold()
  const nominalH = height_units * HEIGHT_UNIT
  const fillH = Math.min(fillTopZ ?? nominalH, nominalH) - BASE_H - FLOOR_THICK
  if (fillH <= 0) return null
  const sqW = cells_x * CELL - 2 * OUTER_R
  const sqD = cells_y * CELL - 2 * OUTER_R
  const innerCS = CrossSection.square([sqW, sqD], true)
    .offset(Math.max(0.01, BOX_OUTER_R - WALL_THICK))
  return innerCS.extrude(fillH).translate([0, 0, BASE_H + FLOOR_THICK])
}

export function buildFilledBinManifold(p: FilledBinParams, fillTopZ?: number): any {
  const bin = buildBinManifold({
    ...p, base_style: 'flat', dividers_x: 0, dividers_y: 0, label_style: 'none',
  })
  const fill = buildBinFillManifold(p, fillTopZ)
  return fill ? bin.add(fill) : bin
}

export function generate(p: BinParams): GeomResult {
  const bin = buildBinManifold(p)
  const partSettings: Record<string, string> = p.base_style === 'hollow'
    ? { fill_density: '0%' }
    : SOLID_INFILL
  return { objects: [{ label: 'Gridfinity Bin', parts: [{ label: 'Gridfinity Bin', geom: manifoldToBufferGeometry(bin), settings: partSettings }] }] }
}
