import { getManifold, manifoldToBufferGeometry } from '../manifold'
import type { Attribution, GeomResult } from '../types'
import { buildBinManifold, BASE_H, HEIGHT_UNIT, STACKING_LIP_H, type BinHoleSettings } from './gridfinity-bin'
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

const SPLIT_GAP = 5  // display separation between the two halves (no material removed)

export function info(p: { stacking_lip: boolean; height_units: number }): string {
  const w = CELLS_X * 42 - 2 * 0.25
  const d = CELLS_Y * 42 - 2 * 0.25
  const h = p.height_units * HEIGHT_UNIT + (p.stacking_lip ? STACKING_LIP_H : 0)
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

function buildModel(p: { holes: BinHoleSettings; height_units: number; stacking_lip: boolean }): any {
  const { Manifold } = getManifold()
  const targetH = p.height_units * HEIGHT_UNIT
  const sz = 1000

  const ourBin = buildBinManifold({
    cells_x: CELLS_X, cells_y: CELLS_Y, height_units: p.height_units,
    stacking_lip: p.stacking_lip,
    holes: p.holes,
    base_style: 'flat', dividers_x: 0, dividers_y: 0, label_style: 'none',
  })
  const baseClip = Manifold.cube([sz, sz, BASE_H]).translate([-sz / 2, -sz / 2, 0])
  const ourPosts = ourBin.intersect(baseClip)

  const mesh3mf = load3mfManifold()

  // Bottom section: BASE_H–7mm (cavity floor lead-in), fixed
  const bottomClip = Manifold.cube([sz, sz, SPLIT_BOTTOM_Z - BASE_H])
    .translate([-sz / 2, -sz / 2, BASE_H])
  const meshBottom = mesh3mf.intersect(bottomClip)

  // Middle section: 14–35mm in the nominal mesh, scaled vertically for target height
  const middleTargetH = (p.height_units - 3) * HEIGHT_UNIT  // 2 bottom units + 1 top unit = 3 fixed
  const middleClip = Manifold.cube([sz, sz, MIDDLE_NOMINAL_H])
    .translate([-sz / 2, -sz / 2, SPLIT_BOTTOM_Z])
  const meshMiddle = middleTargetH > 0
    ? mesh3mf.intersect(middleClip)
        .translate([0, 0, -SPLIT_BOTTOM_Z])
        .scale([1, 1, middleTargetH / MIDDLE_NOMINAL_H])
        .translate([0, 0, SPLIT_BOTTOM_Z])
    : null

  // Top section: 35–42mm in the nominal mesh, shifted up by the height increase
  const heightIncrease = targetH - MESH_NOMINAL_H
  const topClip = Manifold.cube([sz, sz, HEIGHT_UNIT])
    .translate([-sz / 2, -sz / 2, SPLIT_TOP_Z])
  const meshTop = mesh3mf.intersect(topClip).translate([0, 0, heightIncrease])

  const parts: any[] = [ourPosts, meshBottom, ...(meshMiddle ? [meshMiddle] : []), meshTop]
  if (p.stacking_lip) {
    const lipClip = Manifold.cube([sz, sz, sz]).translate([-sz / 2, -sz / 2, targetH])
    parts.push(ourBin.intersect(lipClip))
  }
  return Manifold.union(parts)
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

const PART_SETTINGS = { fill_density: '10%', fill_pattern: 'rectilinear' }

export function generate(p: { holes: BinHoleSettings; height_units: number; stacking_lip: boolean; split: boolean }): GeomResult {
  const model = buildModel(p)

  if (!p.split) {
    return {
      objects: [{
        label: 'Dymo LetraTag Bin',
        parts: [{ label: 'Dymo LetraTag Bin', geom: manifoldToBufferGeometry(model), settings: PART_SETTINGS }],
      }],
    }
  }

  const { front, back } = splitModel(model)
  return {
    objects: [
      {
        label: 'Front half (−Y)',
        parts: [{ label: 'Front half (−Y)', geom: manifoldToBufferGeometry(front), settings: PART_SETTINGS }],
      },
      {
        label: 'Back half (+Y)',
        parts: [{ label: 'Back half (+Y)', geom: manifoldToBufferGeometry(back), settings: PART_SETTINGS }],
      },
    ],
  }
}
