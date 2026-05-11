import { getManifold } from '../manifold'
import { SEGS, segBox, DW, DH } from './corner-radius-gauge'
import { MAGNET_HOLE_R, MAGNET_HOLE_DEPTH, crushRibCrossSection } from '../magnets'

const CHAR_GAP = 0.4
const DOT = 0.5

const PLATE_H = 7        // one gridfinity base unit
const PUSHOUT_R = 1.5   // 2.5mm allen key (M3, Core One) + 0.5mm = 3mm dia
const DEBOSS = 0.6
const CORNER_R = 3.2   // matches 6.4mm hole radius

// Holes: crush-rib first, then plain sizes left to right
const PLAIN_SIZES = [6.0, 6.1, 6.2, 6.3, 6.4]
const LABELS = ['Cr', ...PLAIN_SIZES.map(s => s.toFixed(1))]
const N = LABELS.length  // 6

// 5mm gap between 6.5mm (crush-rib outer) hole edges
const HOLE_SPACING = 6.5 + 5   // 11.5mm centre-to-centre
const MARGIN = 2
const HOLE_Y = 2.25   // PLATE_D/2 - MARGIN - MAGNET_HOLE_R → equal top/end margins
const LABEL_Y = -4    // gives 2mm bottom margin with PLATE_D=15

// Derive plate size from hole layout + margins
const HALF_SPAN = ((N - 1) / 2) * HOLE_SPACING
const PLATE_W = Math.ceil(2 * (HALF_SPAN + MAGNET_HOLE_R + MARGIN))
const PLATE_D = 15


// Extended segment table — adds letters not in the digit-only gauge font
const EXT_SEGS: Record<string, string[]> = {
  ...SEGS,
  'C': ['a', 'f', 'e', 'd'],
  'r': ['f', 'g', 'e'],
}

function extSegBox(seg: string) { return segBox(seg) }

function labelWidth(label: string): number {
  let w = 0
  for (let i = 0; i < label.length; i++) {
    if (i > 0) w += CHAR_GAP
    w += label[i] === '.' ? DOT : DW
  }
  return w
}

export const flatModel = true

export function generate(_p: Record<string, unknown>) {
  const { Manifold, CrossSection } = getManifold()

  const holeXs = Array.from({ length: N }, (_, i) => (i - (N - 1) / 2) * HOLE_SPACING)

  // ── Plate ──────────────────────────────────────────────────────────────────
  let plate = CrossSection.square([PLATE_W - 2 * CORNER_R, PLATE_D - 2 * CORNER_R], true)
    .offset(CORNER_R).extrude(PLATE_H) as any

  const toRemove: any[] = []

  holeXs.forEach((hx, i) => {
    const label = LABELS[i]
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

    // ── Push-out hole (centered, full depth) ───────────────────────────────
    toRemove.push(
      Manifold.cylinder(PLATE_H + 0.01, PUSHOUT_R, PUSHOUT_R, 32)
        .translate([hx, HOLE_Y, -0.005])
    )

    // ── Debossed label ─────────────────────────────────────────────────────
    const lw = labelWidth(label)
    const zBase = PLATE_H - DEBOSS - 0.005
    const h = DEBOSS + 0.01
    let cx = hx - lw / 2
    const yOff = LABEL_Y - DH / 2

    for (let j = 0; j < label.length; j++) {
      if (j > 0) cx += CHAR_GAP
      const ch = label[j]
      if (ch === '.') {
        toRemove.push(Manifold.cube([DOT, DOT, h]).translate([cx, yOff, zBase]))
        cx += DOT
      } else {
        for (const seg of (EXT_SEGS[ch] ?? [])) {
          const b = extSegBox(seg)
          if (!b) continue
          const [bx1, by1, bx2, by2] = b
          toRemove.push(
            Manifold.cube([bx2 - bx1, by2 - by1, h])
              .translate([cx + bx1, yOff + by1, zBase])
          )
        }
        cx += DW
      }
    }
  })

  plate = plate.subtract(Manifold.union(toRemove))
  return plate
}
