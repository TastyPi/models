import { getManifold, manifoldToBufferGeometry } from '../manifold'
import type { Attribution, GeomResult } from '../types'
import {
  HEIGHT_UNIT, CELL, STACKING_LIP_H,
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

// grooveZ = 21mm; bottle top at 35.5mm
const GROOVE_HEIGHT_UNITS = 3    // open cradle — groove cuts into floor
const STACKING_HEIGHT_UNITS = 6  // enclosed — walls clear bottle top (35.5mm) with stacking lip

export type Params = {
  stackable: boolean
  holes: BinHoleSettings
}

export function info(p: Params): string {
  const heightUnits = p.stackable ? STACKING_HEIGHT_UNITS : GROOVE_HEIGHT_UNITS
  const w = CELLS_X * CELL - 0.5
  const d = CELLS_Y * CELL - 0.5
  const h = heightUnits * HEIGHT_UNIT + (p.stackable ? STACKING_LIP_H : 0)
  return `${CELLS_X}×${CELLS_Y}, ${heightUnits}u — ${w} × ${d} × ${h} mm`
}

export function generate(p: Params): GeomResult {
  const { Manifold, CrossSection } = getManifold()
  const { stackable, holes } = p

  const heightUnits = stackable ? STACKING_HEIGHT_UNITS : GROOVE_HEIGHT_UNITS
  const grooveZ = GROOVE_HEIGHT_UNITS * HEIGHT_UNIT  // 21mm — always fixed

  // Bottle is centred at X=0; base at X = -73, nozzle tip at X = +73
  const halfLen = (BODY_LENGTH + NECK_LENGTH + NOZZLE_LENGTH) / 2  // 73mm

  // --- Body: elliptical prism ---
  // After rotate([0,90,0]): CrossSection X → model Z, CrossSection Y → model Y
  const bz = BODY_MINOR / 2   // semi-axis in Z (depth)
  const by = BODY_MAJOR / 2   // semi-axis in Y (width)
  const bodyPts: [number, number][] = Array.from({ length: 64 }, (_, i) => {
    const θ = (2 * Math.PI * i) / 64
    return [bz * Math.cos(θ), by * Math.sin(θ)]
  })
  const body = new CrossSection([bodyPts])
    .extrude(BODY_LENGTH + 0.02)
    .rotate([0, 90, 0])
    .translate([-halfLen - 0.01, 0, grooveZ])

  // --- Neck + lid: cylinder ---
  const neckR = NECK_D / 2
  const neck = Manifold.cylinder(NECK_LENGTH + 0.02, neckR, neckR, 32)
    .rotate([0, 90, 0])
    .translate([-halfLen + BODY_LENGTH - 0.01, 0, grooveZ])

  // --- Nozzle: cylinder + hemisphere dome ---
  const nozzleR = NOZZLE_D / 2
  const nozzleCylLen = NOZZLE_LENGTH - NOZZLE_D / 2  // cylinder portion (20.5mm)
  const nozzleCyl = Manifold.cylinder(nozzleCylLen + 0.02, nozzleR, nozzleR, 32)
    .rotate([0, 90, 0])
    .translate([-halfLen + BODY_LENGTH + NECK_LENGTH - 0.01, 0, grooveZ])
  // Dome: sphere centred at the junction between cylinder and dome
  const domeCenterX = halfLen - NOZZLE_D / 2   // = 73 - 7.5 = 65.5mm
  const dome = Manifold.sphere(nozzleR, 32)
    .translate([domeCenterX, 0, grooveZ])

  // In stackable mode, extend the body oval into the neck X range so the lid
  // is accessible at full body width from the top of the bin.
  const lidAccess = stackable
    ? new CrossSection([bodyPts])
        .extrude(NECK_LENGTH + 0.02)
        .rotate([0, 90, 0])
        .translate([-halfLen + BODY_LENGTH - 0.01, 0, grooveZ])
    : null

  const cavity = Manifold.union([body, neck, nozzleCyl, dome, ...(lidAccess ? [lidAccess] : [])])

  // Finger scoops: capsule trough spanning the full bin interior width.
  // Sphere centres sit at the inner wall face so the ends are flush with the walls.
  // Inner wall face in Y = (CELLS_Y·CELL - 2·OUTER_R)/2 + (BOX_OUTER_R - WALL_THICK)
  //                      = (84 - 8)/2 + (3.75 - 1.2) = 40.55mm
  const SCOOP_R = bz  // radius = groove depth, so sphere bottom aligns with bottle body bottom
  const bodyCenterX = -halfLen + BODY_LENGTH / 2
  const innerWallY = (CELLS_Y * CELL - 8) / 2 + 2.55
  const scoopY = innerWallY - SCOOP_R  // outer edge of sphere tangent to inner wall
  const scoops = Manifold.union([
    Manifold.sphere(SCOOP_R, 32).translate([bodyCenterX,  scoopY, grooveZ]),
    Manifold.sphere(SCOOP_R, 32).translate([bodyCenterX, -scoopY, grooveZ]),
    Manifold.cylinder(2 * scoopY + 0.02, SCOOP_R, SCOOP_R, 32)
      .rotate([90, 0, 0])
      .translate([bodyCenterX, scoopY + 0.01, grooveZ]),
  ])

  const binShell = buildBinManifold({
    cells_x: CELLS_X, cells_y: CELLS_Y, height_units: heightUnits,
    stacking_lip: stackable, holes,
    base_style: 'flat', dividers_x: 0, dividers_y: 0, label_style: 'none',
  })
  const fill = buildBinFillManifold(
    { cells_x: CELLS_X, cells_y: CELLS_Y, height_units: heightUnits, stacking_lip: stackable, holes },
    grooveZ,  // cap fill at groove level so walls above are hollow
  )

  const filled = fill ? binShell.add(fill) : binShell
  const bin = filled.subtract(Manifold.union([cavity, scoops]))

  const label = "Elmer's Glue Bin"
  return {
    objects: [{
      label,
      parts: [{ label, geom: manifoldToBufferGeometry(bin) }],
      settings: GRIDFINITY_BIN_SETTINGS,
    }],
  }
}
