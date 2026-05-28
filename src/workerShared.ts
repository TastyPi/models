import { initManifold } from './manifold'
import { BufferGeometry, BufferAttribute } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import * as wallHook from './models/wall-hook'
import * as gridfinityBaseplate from './models/gridfinity-baseplate'
import * as cornerRadiusGauge from './models/corner-radius-gauge'
import * as gridfinityBin from './models/gridfinity-bin'
import * as magnetTest from './models/magnet-test'
import * as dymoLetraTag from './models/dymo-letratag'
import * as lttScrewdriverBin from './models/ltt-screwdriver-bin'
import * as poleSocket from './models/pole-socket'
import * as aaBatteryBin from './models/aa-battery-bin'
import * as elmersGlueBin from './models/elmers-glue-bin'
import type { RawMesh, GeomResult, ObjGeom, PreviewMesh } from './types'
import type { ModelSlug } from './models/registry'

export const MODELS: Record<ModelSlug, {
  generate: (p: any) => GeomResult | Promise<GeomResult>
}> = {
  'wall-hook':            { generate: wallHook.generate },
  'gridfinity-baseplate': { generate: gridfinityBaseplate.generate },
  'corner-radius-gauge':  { generate: cornerRadiusGauge.generate },
  'gridfinity-bin':       { generate: gridfinityBin.generate },
  'magnet-test':          { generate: magnetTest.generate },
  'dymo-letratag':        { generate: dymoLetraTag.generate },
  'ltt-screwdriver-bin':  { generate: lttScrewdriverBin.generate },
  'pole-socket':          { generate: poleSocket.generate },
  'aa-battery-bin':       { generate: aaBatteryBin.generate },
  'elmers-glue-bin':      { generate: elmersGlueBin.generate },
}

export function buildPreviewMeshes(obj: ObjGeom): PreviewMesh['meshes'] {
  const groups = new Map<number, BufferGeometry[]>()
  for (const p of obj.parts) {
    const ext = p.extruder ?? 0
    const arr = groups.get(ext) ?? []; arr.push(p.geom); groups.set(ext, arr)
  }
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([extruder, geoms]) => ({
    mesh: extractMesh(mergeGeometries(geoms) ?? new BufferGeometry()),
    extruder,
  }))
}

export function composeObj(obj: ObjGeom): BufferGeometry {
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
