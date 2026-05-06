import ManifoldModule from 'manifold-3d'

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
