import { createSignal, createEffect, onCleanup } from 'solid-js'
import type { PreviewMesh } from '../types'
import type { ModelSlug } from '../models/registry'

class GeometryCache {
  private entries = new Map<string, { objects: PreviewMesh[]; bytes: number }>()
  private used = 0
  private readonly limit: number
  constructor(limit: number) { this.limit = limit }

  get(key: string) {
    const e = this.entries.get(key)
    if (!e) return undefined
    this.entries.delete(key)
    this.entries.set(key, e)
    return e
  }

  set(key: string, objects: PreviewMesh[]) {
    const bytes = objects.reduce((s, o) => s + o.meshes.reduce((t, { mesh: m }) => t + m.vertProperties.byteLength + m.triVerts.byteLength, 0), 0)
    if (this.entries.has(key)) { this.used -= this.entries.get(key)!.bytes; this.entries.delete(key) }
    this.entries.set(key, { objects, bytes })
    this.used += bytes
    for (const [k, e] of this.entries) {
      if (this.used <= this.limit || this.entries.size <= 1) break
      this.used -= e.bytes
      this.entries.delete(k)
    }
  }
}

const geometryCache = new GeometryCache(256 * 1024 * 1024)

type PreviewWorkerOutMsg =
  | { type: 'result'; key: string; objects: PreviewMesh[] }
  | { type: 'error'; key: string }

type ExportWorkerOutMsg =
  | { type: 'result'; key: string; data: ArrayBuffer; ext: 'stl' | '3mf' }
  | { type: 'error'; key: string }

export function useGeometry(slug: ModelSlug, params: () => Record<string, unknown>) {
  const previewWorker = new Worker(new URL('../previewWorker.ts', import.meta.url), { type: 'module' })
  const exportWorker  = new Worker(new URL('../exportWorker.ts',  import.meta.url), { type: 'module' })
  onCleanup(() => { previewWorker.terminate(); exportWorker.terminate() })

  const [objects, setObjects]               = createSignal<PreviewMesh[] | null>(null)
  const [rendering, setRendering]           = createSignal(true)
  const [selectedObject, setSelectedObject] = createSignal<ReadonlySet<number>>(new Set<number>())
  let currentKey: string | null = null
  const pendingExports = new Map<string, (data: ArrayBuffer, ext: string) => void>()

  previewWorker.onmessage = (e: MessageEvent<PreviewWorkerOutMsg>) => {
    const msg = e.data
    if (msg.type === 'result') {
      geometryCache.set(msg.key, msg.objects)
      if (msg.key === currentKey) {
        setObjects(msg.objects)
        setRendering(false)
        currentKey = null
      }
    } else {
      if (msg.key === currentKey) { setObjects(null); setRendering(false); currentKey = null }
    }
  }

  exportWorker.onmessage = (e: MessageEvent<ExportWorkerOutMsg>) => {
    const msg = e.data
    if (msg.type === 'result') {
      const cb = pendingExports.get(msg.key)
      if (cb) { pendingExports.delete(msg.key); cb(msg.data, msg.ext) }
    } else {
      pendingExports.delete(msg.key)
    }
  }

  createEffect(() => {
    const p = params()
    setSelectedObject(new Set<number>())

    const key = `${slug}::${JSON.stringify(p)}`
    const cached = geometryCache.get(key)
    if (cached) {
      currentKey = null
      setObjects(cached.objects)
      setRendering(false)
      return
    }

    setRendering(true)
    currentKey = key

    const timer = setTimeout(() => {
      if (currentKey !== key) return
      previewWorker.postMessage({ type: 'generate', key, slug, params: p })
    }, 150)

    onCleanup(() => clearTimeout(timer))
  })

  const download = (format: 'stl' | '3mf' = 'stl', objectIndices?: number[]) => {
    const p = params()
    const selLabel = objectIndices?.length === 1 ? objects()?.[objectIndices[0]]?.label : undefined
    const filename = (selLabel ?? slug).toLowerCase().replace(/\s+/g, '-')
    const keyPart = objectIndices ? objectIndices.slice().sort((a, b) => a - b).join(',') : 'all'
    const key = `export::${slug}::${keyPart}::${format}::${JSON.stringify(p)}`
    pendingExports.set(key, (data: ArrayBuffer, ext: string) => {
      const mime = ext === '3mf' ? 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml' : 'application/octet-stream'
      const url = URL.createObjectURL(new Blob([data], { type: mime }))
      Object.assign(document.createElement('a'), { href: url, download: `${filename}.${ext}` }).click()
      URL.revokeObjectURL(url)
    })
    exportWorker.postMessage({ type: 'export', key, slug, params: p, format, objectIndices })
  }

  const toggleObject = (idx: number) => {
    if (idx < 0) { setSelectedObject(new Set<number>()); return }
    setSelectedObject(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }

  return { objects, rendering, selectedObject, toggleObject, download }
}
