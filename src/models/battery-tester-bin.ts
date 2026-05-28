import { getManifold, manifoldToBufferGeometry } from '../manifold'
import type { Attribution, GeomResult } from '../types'
import {
  HEIGHT_UNIT,
  GRIDFINITY_BIN_SETTINGS,
  attribution as gridfinityAttribution, type BinHoleSettings,
  buildBinManifold, buildBinFillManifold,
} from './gridfinity-bin'

export const attribution: Attribution[] = [
  ...gridfinityAttribution,
  {
    name: 'Custom Gridfinity box for BT-168 battery tester',
    author: 'metasyntactic',
    url: 'https://www.printables.com/model/1237025-custom-gridfinity-box-for-bt-168-battery-tester',
    license: 'CC BY-SA 4.0',
  },
]

const CELLS_X = 3
const CELLS_Y = 1
const HEIGHT_UNITS = 6

export function info(): string {
  const w = CELLS_X * 42 - 2 * 0.25
  const d = CELLS_Y * 42 - 2 * 0.25
  const h = HEIGHT_UNITS * HEIGHT_UNIT
  return `${CELLS_X}×${CELLS_Y}, ${HEIGHT_UNITS}u — ${w} × ${d} × ${h} mm`
}

// Cavity dimensions measured from the original STL (bin coordinate system,
// centred at x=0, y=0, z=0 at base bottom).
//
// The cavity has three stepped sections plus a side notch:
//
//  deep left  │ middle step │         right main
//  X=-55.5    │  X=-30.5   │  X=-7.5              X=52.5
//  to -30.5   │  to -7.5   │  to  52.5 (→56.5 above Z=31)
//  floor≈6.95 │  floor=16  │  floor=27
//
// Step transitions use 4 mm quarter-circle fillets (measured from STL).
// Deep section bottom uses r≈8.94 mm arcs (centers at X=±39.67 from midpoint).
// Side notch: X=-58.5 to -55.5, Y=±4, Z=18 to top (recessed in left wall)
function buildCavity(binTop: number): any {
  const { Manifold } = getManifold()
  const TOP = binTop + 1

  const thinSlab = (x1: number, x2: number, y1: number, y2: number, z: number): any =>
    Manifold.cube([x2 - x1, y2 - y1, 0.01]).translate([x1, y1, z - 0.005])

  const box = (x1: number, x2: number, y1: number, y2: number, z1: number, z2: number): any =>
    Manifold.cube([x2 - x1, y2 - y1, z2 - z1]).translate([x1, y1, z1])

  const Y1 = -13.5, Y2 = 13.5

  // Quarter-circle fillet for a step's right edge.
  // Arc sweeps from the floor at (cx, cz-r) up to the wall at (cx+r, cz).
  // xLeft is the constant left boundary of the cavity.
  const arcFillet = (cx: number, cz: number, r: number, xLeft: number, steps = 20): any => {
    const slabs = []
    for (let i = 0; i <= steps; i++) {
      const θ = -Math.PI / 2 + (i / steps) * (Math.PI / 2)
      slabs.push(thinSlab(xLeft, cx + r * Math.cos(θ), Y1, Y2, cz + r * Math.sin(θ)))
    }
    return Manifold.hull(slabs)
  }

  // Full-width upper section (Z=27 to top).
  // 4 mm fillet: floor at X=52.5, Z=27 curves to wall X=56.5 at Z=31.
  const upperSection = Manifold.union([
    box(-55.5, 56.5, Y1, Y2, 31, TOP),
    arcFillet(52.5, 31, 4, -55.5),
  ])

  // Left+middle section (Z=16 to Z=27).
  // 4 mm fillet: floor at X=-11.5, Z=16 curves to wall X=-7.5 at Z=20.
  const midSection = Manifold.union([
    box(-55.5, -7.5, Y1, Y2, 20, 27),
    arcFillet(-11.5, 20, 4, -55.5),
  ])

  // Deep left section (Z=6.95 to Z=16).
  // Both walls curve outward from the narrow floor (X≈-51.38 to -34.62 at Z=6.95)
  // to full width (X=-55.5 to -30.5) at Z=14.82.
  // r=9.584 mm circular arcs, each tangent to its respective wall (flush fit).
  // Centers: right (-40.084, 14.82), left (-45.916, 14.82).
  const deepSection = (() => {
    const cxR = -40.084, cxL = -45.916, czArc = 14.82, rArc = 9.584
    const zArcEnd = czArc  // arcs are tangent to walls at this Z
    const steps = 24
    const slabs = []
    for (let i = 0; i <= steps; i++) {
      const Z = 6.95 + (i / steps) * (zArcEnd - 6.95)
      const dx = Math.sqrt(rArc * rArc - (Z - czArc) ** 2)
      slabs.push(thinSlab(cxL - dx, cxR + dx, Y1, Y2, Z))
    }
    return Manifold.union([
      box(-55.5, -30.5, Y1, Y2, zArcEnd, 16),
      Manifold.hull(slabs),
    ])
  })()

  // Side notch for protruding element on the left wall of the tester.
  const sideNotch = box(-58.5, -55.5, -4, 4, 18, TOP)

  return Manifold.union([upperSection, midSection, deepSection, sideNotch])
}

export function generate(p: {
  holes: BinHoleSettings
  stacking_lip: boolean
}): GeomResult {
  const binTop = HEIGHT_UNITS * HEIGHT_UNIT

  const binShell = buildBinManifold({
    cells_x: CELLS_X, cells_y: CELLS_Y, height_units: HEIGHT_UNITS,
    stacking_lip: p.stacking_lip, holes: p.holes,
    base_style: 'flat', dividers_x: 0, dividers_y: 0, label_style: 'none',
  })
  const fill = buildBinFillManifold({
    cells_x: CELLS_X, cells_y: CELLS_Y, height_units: HEIGHT_UNITS,
    stacking_lip: p.stacking_lip, holes: p.holes,
  })

  const cavity = buildCavity(binTop)
  const filledWithCuts = fill ? fill.subtract(cavity) : null
  const bin = filledWithCuts ? binShell.add(filledWithCuts) : binShell

  const label = 'BT-168 Battery Tester Bin'
  return {
    objects: [{
      label,
      parts: [{ label, geom: manifoldToBufferGeometry(bin) }],
      settings: GRIDFINITY_BIN_SETTINGS,
    }],
  }
}
