import { getManifold } from '../manifold'
import { MAGNET_HOLE_R, MAGNET_HOLE_DEPTH, crushRibCrossSection } from '../magnets'

const PLATE_H = 7        // one gridfinity base unit
const PUSHOUT_R = 1.5   // 2.5mm allen key (M3, Core One) + 0.5mm = 3mm dia
const CORNER_R = 3.2   // matches 6.4mm hole radius

// Holes left to right: crush ribs, then plain bores 6.0–6.4 mm
const PLAIN_SIZES = [6.0, 6.1, 6.2, 6.3, 6.4]
const N = 1 + PLAIN_SIZES.length  // 6

const HOLE_SPACING = 6.5 + 5   // 11.5mm centre-to-centre (5mm gap between hole edges)
const MARGIN = 2
const PLATE_D = Math.ceil(2 * (MARGIN + MAGNET_HOLE_R))  // 11mm — equal margins, no labels
const HOLE_Y = 0

const HALF_SPAN = ((N - 1) / 2) * HOLE_SPACING
const PLATE_W = Math.ceil(2 * (HALF_SPAN + MAGNET_HOLE_R + MARGIN))

export const flatModel = true

export function generate(_p: Record<string, unknown>) {
  const { Manifold, CrossSection } = getManifold()

  const holeXs = Array.from({ length: N }, (_, i) => (i - (N - 1) / 2) * HOLE_SPACING)

  let plate = CrossSection.square([PLATE_W - 2 * CORNER_R, PLATE_D - 2 * CORNER_R], true)
    .offset(CORNER_R).extrude(PLATE_H) as any

  const toRemove: any[] = []

  holeXs.forEach((hx, i) => {
    const isCrush = i === 0

    // ── Magnet hole ────────────────────────────────────────────────────────
    const holeH = MAGNET_HOLE_DEPTH + 0.01
    let holeShape: any
    if (isCrush) {
      holeShape = crushRibCrossSection(CrossSection)
        .extrude(holeH)
        .translate([hx, HOLE_Y, PLATE_H - MAGNET_HOLE_DEPTH - 0.005])
    } else {
      const r = PLAIN_SIZES[i - 1] / 2
      holeShape = Manifold.cylinder(holeH, r, r, 64)
        .translate([hx, HOLE_Y, PLATE_H - MAGNET_HOLE_DEPTH - 0.005])
    }
    toRemove.push(holeShape)

    // ── Push-out hole ──────────────────────────────────────────────────────
    toRemove.push(
      Manifold.cylinder(PLATE_H + 0.01, PUSHOUT_R, PUSHOUT_R, 32)
        .translate([hx, HOLE_Y, -0.005])
    )
  })

  plate = plate.subtract(Manifold.union(toRemove))
  return plate
}
