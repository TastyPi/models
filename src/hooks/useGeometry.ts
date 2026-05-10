import { createSignal, createEffect, onCleanup } from 'solid-js'
import type { RawMesh, PieceMesh } from '../types'

class GeometryCache {
  private entries = new Map<string, { mesh: RawMesh; pieces?: PieceMesh[]; bytes: number }>()
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

  set(key: string, mesh: RawMesh, pieces?: PieceMesh[]) {
    const bytes = mesh.vertProperties.byteLength + mesh.triVerts.byteLength +
      (pieces?.reduce((s, p) => s + p.mesh.vertProperties.byteLength + p.mesh.triVerts.byteLength +
        (p.secondaryMesh?.vertProperties.byteLength ?? 0) + (p.secondaryMesh?.triVerts.byteLength ?? 0), 0) ?? 0)
    if (this.entries.has(key)) { this.used -= this.entries.get(key)!.bytes; this.entries.delete(key) }
    this.entries.set(key, { mesh, pieces, bytes })
    this.used += bytes
    for (const [k, e] of this.entries) {
      if (this.used <= this.limit || this.entries.size <= 1) break
      this.used -= e.bytes
      this.entries.delete(k)
    }
  }
}

const geometryCache = new GeometryCache(256 * 1024 * 1024)

type WorkerOutMsg =
  | { type: 'result'; key: string; mesh: RawMesh; pieces?: PieceMesh[] }
  | { type: 'error'; key: string }

function buildStl(m: RawMesh): ArrayBuffer {
  const { vertProperties: v, triVerts: t, numProp: s } = m
  const n = t.length / 3
  const buf = new ArrayBuffer(84 + n * 50)
  const dv = new DataView(buf)
  dv.setUint32(80, n, true)
  let o = 84
  const px = (base: number) =>  v[base]
  const py = (base: number) => -v[base + 2]
  const pz = (base: number) =>  v[base + 1]
  for (let i = 0; i < n; i++) {
    const a = t[i * 3] * s, b = t[i * 3 + 1] * s, c = t[i * 3 + 2] * s
    const ux = px(b)-px(a), uy = py(b)-py(a), uz = pz(b)-pz(a)
    const wx = px(c)-px(a), wy = py(c)-py(a), wz = pz(c)-pz(a)
    const nx = uy*wz-uz*wy, ny = uz*wx-ux*wz, nz = ux*wy-uy*wx
    const len = Math.hypot(nx, ny, nz) || 1
    dv.setFloat32(o, nx/len, true); dv.setFloat32(o+4, ny/len, true); dv.setFloat32(o+8, nz/len, true); o += 12
    for (const idx of [a, b, c]) {
      dv.setFloat32(o, px(idx), true); dv.setFloat32(o+4, py(idx), true); dv.setFloat32(o+8, pz(idx), true); o += 12
    }
    o += 2
  }
  return buf
}

export function useGeometry(slug: string, params: () => Record<string, unknown>) {
  const worker = new Worker(new URL('../renderWorker.ts', import.meta.url), { type: 'module' })
  onCleanup(() => worker.terminate())

  const [geometry, setGeometry] = createSignal<RawMesh | null>(null)
  const [pieces, setPieces] = createSignal<PieceMesh[] | null>(null)
  const [rendering, setRendering] = createSignal(true)
  const [selectedPiece, setSelectedPiece] = createSignal(-1)
  let currentKey: string | null = null
  const pendingCallbacks = new Map<string, (mesh: RawMesh) => void>()

  worker.onmessage = (e: MessageEvent<WorkerOutMsg>) => {
    const msg = e.data
    if (msg.type === 'result') {
      geometryCache.set(msg.key, msg.mesh, msg.pieces)
      if (msg.key === currentKey) {
        setGeometry(msg.mesh)
        setPieces(msg.pieces ?? null)
        setRendering(false)
        currentKey = null
      }
      const cb = pendingCallbacks.get(msg.key)
      if (cb) { pendingCallbacks.delete(msg.key); cb(msg.mesh) }
    } else {
      if (msg.key === currentKey) { setGeometry(null); setPieces(null); setRendering(false); currentKey = null }
      pendingCallbacks.delete(msg.key)
    }
  }

  createEffect(() => {
    const p = params()
    setSelectedPiece(-1)

    const key = `${slug}::${JSON.stringify(p)}`
    const cached = geometryCache.get(key)
    if (cached) {
      currentKey = null
      setGeometry(cached.mesh)
      setPieces(cached.pieces ?? null)
      setRendering(false)
      return
    }

    setRendering(true)
    currentKey = key

    const timer = setTimeout(() => {
      if (currentKey !== key) return
      worker.postMessage({ type: 'generate', key, slug, params: p })
    }, 150)

    onCleanup(() => clearTimeout(timer))
  })

  const download = (pieceIndex?: number) => {
    const p = params()
    const pieceLabel = pieceIndex !== undefined ? pieces()?.[pieceIndex]?.label : undefined
    const filename = (pieceLabel ?? slug).toLowerCase().replace(/\s+/g, '-')
    const key = `export::${slug}::${pieceIndex ?? 'all'}::${JSON.stringify(p)}`
    pendingCallbacks.set(key, (mesh) => {
      const buf = buildStl(mesh)
      const url = URL.createObjectURL(new Blob([buf], { type: 'application/octet-stream' }))
      Object.assign(document.createElement('a'), { href: url, download: filename + '.stl' }).click()
      URL.revokeObjectURL(url)
    })
    worker.postMessage({ type: 'export', key, slug, params: p, pieceIndex })
  }

  return { geometry, pieces, rendering, selectedPiece, setSelectedPiece, download }
}
