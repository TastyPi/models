import ManifoldModule from 'manifold-3d'
import type { Manifold } from 'manifold-3d'
import { BufferGeometry, BufferAttribute } from 'three'

type ManifoldToplevel = Awaited<ReturnType<typeof ManifoldModule>>

let _instance: ManifoldToplevel | null = null

export async function initManifold(): Promise<ManifoldToplevel> {
  if (!_instance) {
    _instance = await ManifoldModule()
    _instance.setup()
    _instance.setMinCircularAngle(3)
    _instance.setMinCircularEdgeLength(0.5)
  }
  return _instance
}

export function getManifold(): ManifoldToplevel {
  if (!_instance) throw new Error('Manifold not initialized')
  return _instance
}

export function manifoldToBufferGeometry(geom: Manifold): BufferGeometry {
  const m = geom.getMesh()
  const bg = new BufferGeometry()
  bg.setAttribute('position', new BufferAttribute(new Float32Array(m.vertProperties), m.numProp))
  bg.setIndex(new BufferAttribute(new Uint32Array(m.triVerts), 1))
  return bg
}
