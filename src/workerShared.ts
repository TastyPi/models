import { initManifold, getManifold } from './manifold'
import type { Manifold } from 'manifold-3d'
import * as wallHook from './models/wall-hook'
import * as gridfinityBaseplate from './models/gridfinity-baseplate'
import * as cornerRadiusGauge from './models/corner-radius-gauge'
import * as gridfinityBin from './models/gridfinity-bin'
import * as magnetTest from './models/magnet-test'
import type { RawMesh, GeomResult, ObjGeom } from './types'
import type { ModelSlug } from './models/registry'

export const MODELS: Record<ModelSlug, {
  generate: (p: any) => GeomResult
  flatModel?: boolean
}> = {
  'wall-hook':             { generate: wallHook.generate },
  'gridfinity-baseplate':  { generate: gridfinityBaseplate.generate, flatModel: gridfinityBaseplate.flatModel },
  'corner-radius-gauge':   { generate: cornerRadiusGauge.generate,   flatModel: cornerRadiusGauge.flatModel },
  'gridfinity-bin':        { generate: gridfinityBin.generate },
  'magnet-test':           { generate: magnetTest.generate,           flatModel: magnetTest.flatModel },
}

export function composeObj(obj: ObjGeom): Manifold {
  const { Manifold } = getManifold()
  return obj.parts.length === 1
    ? obj.parts[0].geom
    : Manifold.compose(obj.parts.map(p => p.geom))
}

export function extractMesh(geom: Manifold): RawMesh {
  const m = geom.getMesh()
  return {
    vertProperties: new Float32Array(m.vertProperties),
    triVerts: new Uint32Array(m.triVerts),
    numProp: m.numProp,
  }
}

export const readyPromise = initManifold()
