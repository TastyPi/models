import { MODELS, extractMesh, composeObj, readyPromise } from './workerShared'
import { buildStl, build3mf } from './meshExport'
import type { Manifold } from 'manifold-3d'
import type { ExportObj } from './meshExport'
import type { ModelSlug } from './models/registry'

type InMsg = {
  type: 'export'
  key: string
  slug: ModelSlug
  params: Record<string, unknown>
  format: 'stl' | '3mf'
  objectIndices?: number[]
}

type OutMsg =
  | { type: 'result'; key: string; data: ArrayBuffer; ext: 'stl' | '3mf' }
  | { type: 'error';  key: string }

self.onmessage = async (e: MessageEvent<InMsg>) => {
  await readyPromise
  const { key, slug, params, format, objectIndices } = e.data
  const entry = MODELS[slug]
  if (!entry) { self.postMessage({ type: 'error', key } satisfies OutMsg); return }
  try {
    const result = entry.generate(params)
    const flatRotate = (g: any): any => entry.flatModel ? g.rotate(-90, 0, 0) : g
    const exportTransform: ((g: Manifold) => Manifold) | undefined = result.exportTransform

    const applyTransforms = (g: any): any => {
      if (exportTransform) g = exportTransform(g)
      return flatRotate(g)
    }

    const selected = objectIndices
      ? result.objects.filter((_, i) => objectIndices.includes(i))
      : result.objects

    let data: ArrayBuffer
    switch (format) {
      case 'stl': {
        const meshes = selected.map(obj => extractMesh(applyTransforms(composeObj(obj))))
        data = buildStl(meshes)
        break
      }
      case '3mf': {
        const exportObjs: ExportObj[] = selected.map(obj => ({
          label: obj.label,
          mesh: extractMesh(applyTransforms(composeObj(obj))),
          settings: obj.settings,
          parts: obj.parts.length > 1
            ? obj.parts.map(p => ({ label: p.label, mesh: extractMesh(applyTransforms(p.geom)), settings: p.settings }))
            : undefined,
        }))
        data = build3mf(exportObjs)
        break
      }
    }

    self.postMessage({ type: 'result', key, data, ext: format } satisfies OutMsg, { transfer: [data] })
  } catch (err) {
    console.error('Export error:', err)
    self.postMessage({ type: 'error', key } satisfies OutMsg)
  }
}
