import { MODELS, buildPreviewMeshes, readyPromise } from './workerShared'
import type { PreviewMesh } from './types'
import type { ModelSlug } from './models/registry'

type InMsg  = { type: 'generate'; key: string; slug: ModelSlug; params: Record<string, unknown> }
type OutMsg = { type: 'result'; key: string; objects: PreviewMesh[] }
            | { type: 'error'; key: string }

self.onmessage = async (e: MessageEvent<InMsg>) => {
  await readyPromise
  const { key, slug, params } = e.data
  const entry = MODELS[slug]
  if (!entry) { self.postMessage({ type: 'error', key } satisfies OutMsg); return }
  try {
    const result = await entry.generate(params)

    const objects: PreviewMesh[] = result.objects.map(obj => {
      const meshes = buildPreviewMeshes(obj)
      return { label: obj.label, meshes }
    })

    const transferables: Transferable[] = []
    for (const o of objects)
      for (const { mesh: m } of o.meshes)
        transferables.push(m.vertProperties.buffer as ArrayBuffer, m.triVerts.buffer as ArrayBuffer)
    self.postMessage({ type: 'result', key, objects } satisfies OutMsg, { transfer: transferables })
  } catch (err) {
    console.error('Preview error:', err)
    self.postMessage({ type: 'error', key } satisfies OutMsg)
  }
}
