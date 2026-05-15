import { initManifold } from './manifold'
import { BufferGeometry, BufferAttribute } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import * as wallHook from './models/wall-hook'
import * as gridfinityBaseplate from './models/gridfinity-baseplate'
import * as cornerRadiusGauge from './models/corner-radius-gauge'
import * as gridfinityBin from './models/gridfinity-bin'
import * as magnetTest from './models/magnet-test'
import type { RawMesh, GeomResult, ObjGeom } from './types'
import type { ModelSlug } from './models/registry'

export const MODELS: Record<ModelSlug, {
  generate: (p: any) => GeomResult
}> = {
  'wall-hook':            { generate: wallHook.generate },
  'gridfinity-baseplate': { generate: gridfinityBaseplate.generate },
  'corner-radius-gauge':  { generate: cornerRadiusGauge.generate },
  'gridfinity-bin':       { generate: gridfinityBin.generate },
  'magnet-test':          { generate: magnetTest.generate },
}

export function composeObj(obj: ObjGeom): BufferGeometry {
  if (obj.parts.length === 1) return obj.parts[0].geom
  return mergeGeometries(obj.parts.map(p => p.geom)) ?? new BufferGeometry()
}

export function extractMesh(geom: BufferGeometry): RawMesh {
  const pos = geom.getAttribute('position') as BufferAttribute
  const idx = geom.getIndex()
  return {
    vertProperties: new Float32Array(pos.array),
    triVerts: idx ? new Uint32Array(idx.array) : Uint32Array.from({ length: pos.count }, (_, i) => i),
    numProp: pos.itemSize,
  }
}

export const readyPromise = initManifold()
