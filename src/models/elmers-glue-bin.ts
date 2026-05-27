import { getManifold, manifoldToBufferGeometry } from '../manifold'
import type { Attribution, GeomResult } from '../types'
import {
  BASE_H, FLOOR_THICK, HEIGHT_UNIT, CELL,
  GRIDFINITY_BIN_SETTINGS,
  attribution as gridfinityAttribution, type BinHoleSettings,
  buildBinManifold, buildBinFillManifold,
} from './gridfinity-bin'

export const attribution: Attribution[] = [...gridfinityAttribution]

// Elmer's school glue 118ml bottle — measured dimensions
const BODY_MAJOR = 63    // cross-section major diameter (Y, wide axis)
const BODY_MINOR = 29    // cross-section minor diameter (Z, depth axis)
const BODY_LENGTH = 100  // body length (includes shoulder taper)
const NECK_D = 28        // neck + lid diameter
const NECK_LENGTH = 18   // neck + lid length
const NOZZLE_D = 15      // nozzle diameter
const NOZZLE_LENGTH = 28 // nozzle total length (cylinder + dome)
// Total: 100 + 18 + 28 = 146mm

const CELLS_X = 4   // 165mm interior — bottle (146mm) + end walls
const CELLS_Y = 2   // 81mm interior — bottle major (63mm) + side walls

// Height: groove depth = BODY_MINOR/2 + clearance; must clear BASE_H + FLOOR_THICK
const HEIGHT_UNITS = 3  // nominalH = 21mm — groove bottom ~5.5mm, cuts into floor

export type Params = {
  clearance: number
  holes: BinHoleSettings
}

export function info(): string {
  const w = CELLS_X * CELL - 0.5
  const d = CELLS_Y * CELL - 0.5
  const h = HEIGHT_UNITS * HEIGHT_UNIT
  return `${CELLS_X}×${CELLS_Y}, ${HEIGHT_UNITS}u — ${w} × ${d} × ${h} mm`
}

export function generate(p: Params): GeomResult {
  const { Manifold, CrossSection } = getManifold()
  const { clearance, holes } = p

  const nominalH = HEIGHT_UNITS * HEIGHT_UNIT  // 28mm — groove axis height

  // Bottle is centred at X=0; base at X = -73, nozzle tip at X = +73
  const halfLen = (BODY_LENGTH + NECK_LENGTH + NOZZLE_LENGTH) / 2  // 73mm

  // --- Body: elliptical prism ---
  // After rotate([0,90,0]): CrossSection X → model Z, CrossSection Y → model Y
  const bz = BODY_MINOR / 2 + clearance   // semi-axis in Z (depth)
  const by = BODY_MAJOR / 2 + clearance   // semi-axis in Y (width)
  const bodyPts: [number, number][] = Array.from({ length: 64 }, (_, i) => {
    const θ = (2 * Math.PI * i) / 64
    return [bz * Math.cos(θ), by * Math.sin(θ)]
  })
  const body = new CrossSection([bodyPts])
    .extrude(BODY_LENGTH + 0.02)
    .rotate([0, 90, 0])
    .translate([-halfLen - 0.01, 0, nominalH])

  // --- Neck + lid: cylinder ---
  const neckR = NECK_D / 2 + clearance
  const neck = Manifold.cylinder(NECK_LENGTH + 0.02, neckR, neckR, 32)
    .rotate([0, 90, 0])
    .translate([-halfLen + BODY_LENGTH - 0.01, 0, nominalH])

  // --- Nozzle: cylinder + hemisphere dome ---
  const nozzleR = NOZZLE_D / 2 + clearance
  const nozzleCylLen = NOZZLE_LENGTH - NOZZLE_D / 2  // cylinder portion (20.5mm)
  const nozzleCyl = Manifold.cylinder(nozzleCylLen + 0.02, nozzleR, nozzleR, 32)
    .rotate([0, 90, 0])
    .translate([-halfLen + BODY_LENGTH + NECK_LENGTH - 0.01, 0, nominalH])
  // Dome: sphere centred at the junction between cylinder and dome
  const domeCenterX = halfLen - NOZZLE_D / 2   // = 73 - 7.5 = 65.5mm
  const dome = Manifold.sphere(nozzleR, 32)
    .translate([domeCenterX, 0, nominalH])

  const cavity = Manifold.union([body, neck, nozzleCyl, dome])

  const binShell = buildBinManifold({
    cells_x: CELLS_X, cells_y: CELLS_Y, height_units: HEIGHT_UNITS,
    stacking_lip: false, holes,
    base_style: 'flat', dividers_x: 0, dividers_y: 0, label_style: 'none',
  })
  const fill = buildBinFillManifold({
    cells_x: CELLS_X, cells_y: CELLS_Y, height_units: HEIGHT_UNITS,
    stacking_lip: false, holes,
  })

  const filled = fill ? binShell.add(fill) : binShell
  const bin = filled.subtract(cavity)

  const label = "Elmer's Glue Bin"
  return {
    objects: [{
      label,
      parts: [{ label, geom: manifoldToBufferGeometry(bin) }],
      settings: GRIDFINITY_BIN_SETTINGS,
    }],
  }
}
