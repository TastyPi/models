import { getManifold, manifoldToBufferGeometry } from '../manifold'
import type { Attribution, GeomResult } from '../types'
import { buildBinManifold, BASE_H, HEIGHT_UNIT, GRIDFINITY_BIN_SETTINGS, type BinHoleSettings } from './gridfinity-bin'
import { MESH_B64 } from './dymo-letratag-mesh'

export const attribution: Attribution[] = [
  {
    name: 'Gridfinity Dymo LetraTag bin',
    author: 'nerdmanpap',
    url: 'https://makerworld.com/en/models/796435-gridfinity-dymo-letratag-bin',
    license: 'CC BY',
  },
]

// 3×6 cells — minimum Gridfinity footprint for the Dymo LetraTag
const CELLS_X = 3
const CELLS_Y = 6

export const HEIGHT_UNITS_MIN = 3   // bottom (2 units) + top (1 unit), no middle
export const HEIGHT_UNITS_MAX = 6   // original mesh height — middle at natural size

// The 3MF mesh spans Z=0–42mm. The bottom 2 units (14mm) capture the cavity floor curve;
// the top 1 unit (7mm) captures the rim. The 3-unit middle (14–35mm) is uniform walls
// that can be scaled to change the bin height.
const MESH_NOMINAL_H = HEIGHT_UNITS_MAX * HEIGHT_UNIT  // 42mm
const SPLIT_BOTTOM_Z = 2 * HEIGHT_UNIT                // 14mm — end of bottom section (2 units)
const SPLIT_TOP_Z    = MESH_NOMINAL_H - HEIGHT_UNIT   // 35mm — start of top section (1 unit)
const MIDDLE_NOMINAL_H = SPLIT_TOP_Z - SPLIT_BOTTOM_Z // 21mm — 3 gridfinity units

// The mesh cavity floor sits at z=8mm. Shift the mesh down to leave 0.6mm (3 layers at 0.2mm)
// of floor above the posts — enough to connect them without adding significant height.
const CAVITY_FLOOR_Z = 8
const MESH_SHIFT = CAVITY_FLOOR_Z - BASE_H - 0.6  // 2.4mm

const SPLIT_GAP = 5  // display separation between the two halves (no material removed)

export function info(height_units: number): string {
  const w = CELLS_X * 42 - 2 * 0.25
  const d = CELLS_Y * 42 - 2 * 0.25
  const h = height_units * HEIGHT_UNIT
  return `${w} × ${d} × ${h} mm`
}

let _mesh3mf: any = null

function load3mfManifold(): any {
  if (_mesh3mf) return _mesh3mf
  const { Manifold, Mesh } = getManifold()
  const binary = atob(MESH_B64)
  const buf = new ArrayBuffer(binary.length)
  const u8 = new Uint8Array(buf)
  for (let i = 0; i < binary.length; i++) u8[i] = binary.charCodeAt(i)
  const dv = new DataView(buf)
  const nVerts = dv.getUint32(0, true)
  const nTris  = dv.getUint32(4, true)
  const vertProperties = new Float32Array(buf, 8, nVerts * 3)
  const triVerts = new Uint32Array(buf, 8 + nVerts * 3 * 4, nTris * 3)
  _mesh3mf = new Manifold(new Mesh({ numProp: 3, vertProperties, triVerts }))
  return _mesh3mf
}

function buildModel(p: { holes: BinHoleSettings; height_units: number }): any {
  const { Manifold } = getManifold()
  const targetH = p.height_units * HEIGHT_UNIT
  const sz = 1000

  const ourBin = buildBinManifold({
    cells_x: CELLS_X, cells_y: CELLS_Y, height_units: p.height_units,
    stacking_lip: false,
    holes: p.holes,
    base_style: 'flat', dividers_x: 0, dividers_y: 0, label_style: 'none',
  })
  const baseClip = Manifold.cube([sz, sz, BASE_H]).translate([-sz / 2, -sz / 2, 0])
  const ourPosts = ourBin.intersect(baseClip)

  // Shift mesh down so cavity floor (at mesh z=8) lands at BASE_H (z=5) in world space.
  const mesh3mf = load3mfManifold().translate([0, 0, -MESH_SHIFT])
  const SBZ = SPLIT_BOTTOM_Z - MESH_SHIFT  // world-space bottom/middle split: 11mm
  const STZ = SPLIT_TOP_Z - MESH_SHIFT      // world-space middle/top split: 32mm

  // Bottom section: BASE_H to SBZ (cavity floor up to split), fixed
  const bottomClip = Manifold.cube([sz, sz, SBZ - BASE_H])
    .translate([-sz / 2, -sz / 2, BASE_H])
  const meshBottom = mesh3mf.intersect(bottomClip)

  // Middle section: SBZ–STZ in world space (MIDDLE_NOMINAL_H mm of uniform walls), scaled
  const middleTargetH = (p.height_units - 3) * HEIGHT_UNIT + MESH_SHIFT
  const middleClip = Manifold.cube([sz, sz, MIDDLE_NOMINAL_H])
    .translate([-sz / 2, -sz / 2, SBZ])
  const meshMiddle = mesh3mf.intersect(middleClip)
    .translate([0, 0, -SBZ])
    .scale([1, 1, middleTargetH / MIDDLE_NOMINAL_H])
    .translate([0, 0, SBZ])

  // Top section: STZ to STZ+HEIGHT_UNIT in world space, shifted to meet middle section top
  const heightIncrease = targetH - (MESH_NOMINAL_H - MESH_SHIFT)
  const topClip = Manifold.cube([sz, sz, HEIGHT_UNIT])
    .translate([-sz / 2, -sz / 2, STZ])
  const meshTop = mesh3mf.intersect(topClip).translate([0, 0, heightIncrease])

  return Manifold.union([ourPosts, meshBottom, meshMiddle, meshTop])
}

// Split the model at Y=0 into two halves for small print beds.
// Each half is 125.5 × 125.75 mm — fits on a Core One bed (250 × 220 mm).
function splitModel(model: any): { front: any; back: any } {
  const { Manifold } = getManifold()
  const sz = 1000

  const front = model.intersect(Manifold.cube([sz, sz / 2, sz]).translate([-sz / 2, -sz / 2, 0]))
  const back  = model.intersect(Manifold.cube([sz, sz / 2, sz]).translate([-sz / 2, 0, 0]))
                     .translate([0, SPLIT_GAP, 0])

  return { front, back }
}

export function generate(p: { holes: BinHoleSettings; height_units: number; split: boolean }): GeomResult {
  const model = buildModel(p)

  if (!p.split) {
    return {
      objects: [{
        label: 'Dymo LetraTag Bin',
        parts: [{ label: 'Dymo LetraTag Bin', geom: manifoldToBufferGeometry(model) }],
        settings: GRIDFINITY_BIN_SETTINGS,
      }],
    }
  }

  const { front, back } = splitModel(model)
  return {
    objects: [
      {
        label: 'Front half',
        parts: [{ label: 'Front half', geom: manifoldToBufferGeometry(front) }],
        settings: GRIDFINITY_BIN_SETTINGS,
      },
      {
        label: 'Back half',
        parts: [{ label: 'Back half', geom: manifoldToBufferGeometry(back) }],
        settings: GRIDFINITY_BIN_SETTINGS,
      },
    ],
  }
}
