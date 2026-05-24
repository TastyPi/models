import { MODELS, extractMesh, composeObj, readyPromise } from './workerShared'
import { buildStl, build3mf } from './meshExport'
import type { BufferGeometry } from 'three'
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
    const result = await entry.generate(params)

    const applyTransforms = (g: BufferGeometry): BufferGeometry =>
      result.exportTransform ? result.exportTransform(g) : g

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
          parts: (obj.parts.length > 1 || obj.parts.some(p => p.extruder != null || p.settings))
            ? obj.parts.map(p => {
                const settings: Record<string, string> = {}
                if (p.extruder != null) settings.extruder = String(p.extruder)
                Object.assign(settings, p.settings)
                return { label: p.label, mesh: extractMesh(applyTransforms(p.geom)), settings: Object.keys(settings).length > 0 ? settings : undefined }
              })
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
