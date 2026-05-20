import { getManifold, manifoldToBufferGeometry } from '../manifold'
import type { Attribution, GeomResult } from '../types'
import { buildBinManifold, BASE_H, HEIGHT_UNIT, STACKING_LIP_H } from './gridfinity-bin'
import { MESH_B64 } from './dymo-letratag-mesh'

export const attribution: Attribution[] = [
  {
    name: 'Gridfinity Dymo LetraTag bin',
    author: 'nerdmanpap',
    url: 'https://makerworld.com/en/models/796435-gridfinity-dymo-letratag-bin',
    license: 'CC BY',
  },
]

// 3×6 cells, 6 height units — minimum Gridfinity size for the Dymo LetraTag
const CELLS_X = 3
const CELLS_Y = 6
const HEIGHT_UNITS = 6

const SPLIT_GAP = 5  // display separation between the two halves (no material removed)

export function info(stacking_lip: boolean): string {
  const w = CELLS_X * 42 - 2 * 0.25
  const d = CELLS_Y * 42 - 2 * 0.25
  const h = HEIGHT_UNITS * HEIGHT_UNIT + (stacking_lip ? STACKING_LIP_H : 0)
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

function buildModel(p: {
  magnet_size: number | null
  screw_holes: boolean
  supportless: boolean
  corner_magnets: boolean
  stacking_lip: boolean
}): any {
  const { Manifold } = getManifold()
  const nominalH = HEIGHT_UNITS * HEIGHT_UNIT  // 42 mm
  const sz = 1000

  // Base posts + optional stacking lip using our gridfinity-rebuilt-openscad profile
  const ourBin = buildBinManifold({
    cells_x: CELLS_X, cells_y: CELLS_Y, height_units: HEIGHT_UNITS,
    stacking_lip: p.stacking_lip,
    magnet_size: p.magnet_size, screw_holes: p.screw_holes,
    supportless: p.supportless, corner_magnets: p.corner_magnets,
    base_style: 'flat', dividers_x: 0, dividers_y: 0, label_style: 'none',
  })
  const baseClip = Manifold.cube([sz, sz, BASE_H]).translate([-sz / 2, -sz / 2, 0])
  const ourPosts = ourBin.intersect(baseClip)

  // 3mf mesh body (Z = BASE_H to nominalH): exact Dymo cavity and walls
  const mesh3mf = load3mfManifold()
  const bodyClip = Manifold.cube([sz, sz, nominalH - BASE_H]).translate([-sz / 2, -sz / 2, BASE_H])
  const meshBody = mesh3mf.intersect(bodyClip)

  const parts: any[] = [ourPosts, meshBody]
  if (p.stacking_lip) {
    const lipClip = Manifold.cube([sz, sz, sz]).translate([-sz / 2, -sz / 2, nominalH])
    parts.push(ourBin.intersect(lipClip))
  }
  return Manifold.union(parts)
}

// Split the model at Y=0 into two halves with alignment pins/sockets in the floor zone.
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

export function generate(p: {
  magnet_size: number | null
  screw_holes: boolean
  supportless: boolean
  corner_magnets: boolean
  stacking_lip: boolean
  split: boolean
}): GeomResult {
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
