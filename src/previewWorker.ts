import { MODELS, extractMesh, composeObj, readyPromise } from './workerShared'
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
    const result = entry.generate(params)

    // Multi-part objects (e.g. multi-colour body + inlay): meshes[0] is the primary
    // (body, shown in the default colour so cavities are visible); meshes[1+] are
    // accent parts shown in a contrasting colour, all as one selectable unit.
    const objects: PreviewMesh[] = result.objects.map(p => {
      if (p.parts.length > 1) {
        const accentObj = { label: p.label, parts: p.parts.slice(1) }
        return { label: p.label, meshes: [extractMesh(p.parts[0].geom), extractMesh(composeObj(accentObj))] }
      }
      return { label: p.label, meshes: [extractMesh(composeObj(p))] }
    })

    const transferables: Transferable[] = []
    for (const o of objects)
      for (const m of o.meshes)
        transferables.push(m.vertProperties.buffer as ArrayBuffer, m.triVerts.buffer as ArrayBuffer)
    self.postMessage({ type: 'result', key, objects } satisfies OutMsg, { transfer: transferables })
  } catch (err) {
    console.error('Preview error:', err)
    self.postMessage({ type: 'error', key } satisfies OutMsg)
  }
}
