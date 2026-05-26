import { getManifold, manifoldToBufferGeometry } from '../manifold'
import type { GeomResult } from '../types'

export interface Params {
  thread_diameter: number       // outer diameter of male thread at peaks (mm)
  thread_root_diameter: number  // diameter across the thread valleys (mm)
  thread_pitch: number          // distance between thread crests (mm)
  thread_ridge_root: number     // axial width of male ridge at the thread root (mm)
  thread_ridge_peak: number     // axial width of male ridge at the thread peak (mm)
  thread_length: number         // axial engagement length (mm)
  tolerance: number             // clearance added for fit (mm)
  wall_thickness: number        // wall beyond thread root (mm)
  floor_thickness: number       // floor at closed end, 0 = open through-hole (mm)
}

export function generate({
  thread_diameter,
  thread_root_diameter,
  thread_pitch,
  thread_ridge_root,
  thread_ridge_peak,
  thread_length,
  tolerance,
  wall_thickness,
  floor_thickness,
}: Params): GeomResult {
  const { Manifold, CrossSection } = getManifold()

  const thread_depth = (thread_diameter - thread_root_diameter) / 2
  // Female bore fits male root diameter, plus clearance
  const bore_R = thread_root_diameter / 2 + tolerance
  // Outer wall: bore + groove depth + wall
  const outer_R = thread_diameter / 2 + tolerance + wall_thickness
  const total_height = thread_length + floor_thickness

  const body = Manifold.cylinder(total_height, outer_R, outer_R, 128)

  // Bore from the floor to the open end (overshoot by 1mm to clear the top face)
  const bore = Manifold.cylinder(thread_length + 1, bore_R, bore_R, 128)
    .translate([0, 0, floor_thickness])

  // Helical thread groove.
  //
  // The female groove cross-section is a trapezoidal annular sector:
  //   - At bore_R (bore surface, matches male thread root):
  //       groove spans halfAngle_root, derived from (pitch - ridge_root)
  //   - At bore_R + depth (groove bottom, matches male thread peak):
  //       groove spans halfAngle_peak, derived from (pitch - ridge_peak)
  //
  // For standard trapezoidal threads (wider ridge at root, narrower at peak):
  //   ridge_root > ridge_peak  →  halfAngle_root < halfAngle_peak
  //   The groove is narrower at the bore surface and widens toward the groove bottom.
  //
  // For square threads: ridge_root = ridge_peak → both halfAngles equal.
  //
  // The polygon traversal is: outer arc (bore_R+depth) CCW from -peak to +peak,
  // then inner arc (bore_R) CW from +root to -root. A shoelace check ensures
  // CCW winding regardless of parameter values.
  const ridgeRoot = Math.min(thread_ridge_root, thread_pitch * 0.99)
  const ridgePeak = Math.min(thread_ridge_peak, thread_pitch * 0.99)
  const halfRoot = Math.PI * (thread_pitch - ridgeRoot) / thread_pitch
  const halfPeak = Math.PI * (thread_pitch - ridgePeak) / thread_pitch

  const nArc = 16
  const groovePts: [number, number][] = []

  // Outer arc at groove bottom: CCW from -halfPeak to +halfPeak
  for (let i = 0; i <= nArc; i++) {
    const theta = -halfPeak + (2 * halfPeak / nArc) * i
    groovePts.push([(bore_R + thread_depth) * Math.cos(theta), (bore_R + thread_depth) * Math.sin(theta)])
  }
  // Inner arc at bore surface: CW from +halfRoot to -halfRoot
  for (let i = 0; i <= nArc; i++) {
    const theta = halfRoot - (2 * halfRoot / nArc) * i
    groovePts.push([bore_R * Math.cos(theta), bore_R * Math.sin(theta)])
  }

  // Ensure CCW winding for correct boolean subtraction
  let area2 = 0
  for (let i = 0; i < groovePts.length; i++) {
    const [x1, y1] = groovePts[i]
    const [x2, y2] = groovePts[(i + 1) % groovePts.length]
    area2 += x1 * y2 - x2 * y1
  }
  if (area2 < 0) groovePts.reverse()

  const nRevolutions = thread_length / thread_pitch
  const nDiv = Math.max(48, Math.round(nRevolutions * 48))
  const twistDegrees = nRevolutions * 360

  const groove = new CrossSection([groovePts], 'NonZero')
    .extrude(thread_length, nDiv, twistDegrees)
    .translate([0, 0, floor_thickness])

  // Lead-in chamfer at the open entry to guide thread engagement
  const chamfer_h = Math.min(thread_pitch * 0.4, bore_R * 0.2, 4)
  const chamfer = Manifold.cylinder(chamfer_h, bore_R, bore_R + chamfer_h, 64)
    .translate([0, 0, total_height - chamfer_h])

  const geom = body.subtract(bore).subtract(groove).subtract(chamfer)

  return {
    objects: [{
      label: 'Pole Socket',
      parts: [{ label: 'Pole Socket', geom: manifoldToBufferGeometry(geom) }],
    }],
  }
}
