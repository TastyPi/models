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

const CRC32_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    t[i] = c
  }
  return t
})()

function crc32(data: Uint8Array): number {
  let c = 0xFFFFFFFF
  for (let i = 0; i < data.length; i++) c = (c >>> 8) ^ CRC32_TABLE[(c ^ data[i]) & 0xFF]
  return (c ^ 0xFFFFFFFF) >>> 0
}

function buildZip(files: { name: string; data: Uint8Array }[]): ArrayBuffer {
  const enc = new TextEncoder()
  const locals: { nameBytes: Uint8Array; data: Uint8Array; crc: number; offset: number }[] = []
  const parts: Uint8Array[] = []
  let offset = 0
  for (const file of files) {
    const nameBytes = enc.encode(file.name)
    const crc = crc32(file.data)
    locals.push({ nameBytes, data: file.data, crc, offset })
    const lh = new Uint8Array(30 + nameBytes.length)
    const dv = new DataView(lh.buffer)
    dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true)
    dv.setUint32(14, crc, true); dv.setUint32(18, file.data.length, true)
    dv.setUint32(22, file.data.length, true); dv.setUint16(26, nameBytes.length, true)
    lh.set(nameBytes, 30)
    parts.push(lh, file.data)
    offset += lh.length + file.data.length
  }
  const cdStart = offset
  for (const e of locals) {
    const cd = new Uint8Array(46 + e.nameBytes.length)
    const dv = new DataView(cd.buffer)
    dv.setUint32(0, 0x02014b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 20, true)
    dv.setUint32(16, e.crc, true); dv.setUint32(20, e.data.length, true)
    dv.setUint32(24, e.data.length, true); dv.setUint16(28, e.nameBytes.length, true)
    dv.setUint32(42, e.offset, true)
    cd.set(e.nameBytes, 46)
    parts.push(cd)
    offset += cd.length
  }
  const eocd = new Uint8Array(22)
  const dv = new DataView(eocd.buffer)
  dv.setUint32(0, 0x06054b50, true)
  dv.setUint16(8, locals.length, true); dv.setUint16(10, locals.length, true)
  dv.setUint32(12, offset - cdStart, true); dv.setUint32(16, cdStart, true)
  parts.push(eocd)
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0))
  let pos = 0
  for (const p of parts) { out.set(p, pos); pos += p.length }
  return out.buffer
}

function meshXml(m: RawMesh, dx = 0, dy = 0, dz = 0): string {
  const { vertProperties: v, triVerts: t, numProp: s } = m
  const nv = v.length / s, nt = t.length / 3
  const f = (n: number) => +n.toFixed(4)
  const verts: string[] = []
  for (let i = 0; i < nv; i++)
    verts.push(`<vertex x="${f(v[i*s] + dx)}" y="${f(-v[i*s+2] + dy)}" z="${f(v[i*s+1] + dz)}"/>`)
  const tris: string[] = []
  for (let i = 0; i < nt; i++)
    tris.push(`<triangle v1="${t[i*3]}" v2="${t[i*3+1]}" v3="${t[i*3+2]}"/>`)
  return `<vertices>${verts.join('')}</vertices><triangles>${tris.join('')}</triangles>`
}

function meshBounds(m: RawMesh) {
  const { vertProperties: v, numProp: s } = m
  const nv = v.length / s
  const f = (n: number) => +n.toFixed(4)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity
  for (let i = 0; i < nv; i++) {
    const x = f(v[i*s]), y = f(-v[i*s+2]), z = f(v[i*s+1])
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
    if (z < minZ) minZ = z
  }
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, minZ }
}

function mergedMeshXml(
  parts: { mesh: RawMesh; dx: number; dy: number; dz: number }[]
): { xml: string; triCounts: number[] } {
  const verts: string[] = []
  const tris: string[] = []
  const triCounts: number[] = []
  const f = (n: number) => +n.toFixed(4)
  let vertOffset = 0
  for (const { mesh: m, dx, dy, dz } of parts) {
    const { vertProperties: v, triVerts: t, numProp: s } = m
    const nv = v.length / s, nt = t.length / 3
    for (let i = 0; i < nv; i++)
      verts.push(`<vertex x="${f(v[i*s] + dx)}" y="${f(-v[i*s+2] + dy)}" z="${f(v[i*s+1] + dz)}"/>`)
    for (let i = 0; i < nt; i++)
      tris.push(`<triangle v1="${t[i*3] + vertOffset}" v2="${t[i*3+1] + vertOffset}" v3="${t[i*3+2] + vertOffset}"/>`)
    triCounts.push(nt)
    vertOffset += nv
  }
  return { xml: `<vertices>${verts.join('')}</vertices><triangles>${tris.join('')}</triangles>`, triCounts }
}

function build3mf(m: RawMesh, name: string, pieces?: PieceMesh[]): ArrayBuffer {
  const entries = pieces && pieces.length > 0
    ? pieces.map(p => ({ label: p.label, mesh: p.mesh, subParts: p.subParts, settings: p.settings }))
    : [{ label: name, mesh: m, subParts: undefined, settings: undefined }]

  const objects: string[] = []
  const buildItems: { id: number; tx: number; ty: number }[] = []
  type ConfigVol = { label: string; firstid: number; lastid: number; settings?: Record<string, string> }
  type ConfigObj = { id: number; label: string; volumes: ConfigVol[] }
  const configEntries: ConfigObj[] = []
  let nextId = 1

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    const { cx, cy, minZ } = meshBounds(e.mesh)
    const tx = +cx.toFixed(4)
    const ty = +cy.toFixed(4)

    if (e.subParts && e.subParts.length > 0) {
      const parts = e.subParts.map(sp => ({ mesh: sp.mesh, dx: -cx, dy: -cy, dz: -minZ }))
      const { xml, triCounts } = mergedMeshXml(parts)
      objects.push(`<object id="${nextId}" name="${e.label.replace(/"/g, '&quot;')}" type="model"><mesh>${xml}</mesh></object>`)
      buildItems.push({ id: nextId, tx, ty })
      const volumes: ConfigVol[] = []
      let triStart = 0
      for (let j = 0; j < e.subParts.length; j++) {
        volumes.push({ label: e.subParts[j].label, firstid: triStart, lastid: triStart + triCounts[j] - 1, settings: e.subParts[j].settings })
        triStart += triCounts[j]
      }
      configEntries.push({ id: nextId, label: e.label, volumes })
      nextId++
    } else {
      const triCount = e.mesh.triVerts.length / 3
      objects.push(`<object id="${nextId}" name="${e.label.replace(/"/g, '&quot;')}" type="model"><mesh>${meshXml(e.mesh, -cx, -cy, -minZ)}</mesh></object>`)
      buildItems.push({ id: nextId, tx, ty })
      if (e.settings) configEntries.push({ id: nextId, label: e.label, volumes: [{ label: e.label, firstid: 0, lastid: triCount - 1, settings: e.settings }] })
      nextId++
    }
  }

  const items = buildItems.map(({ id, tx, ty }) =>
    `<item objectid="${id}" transform="1 0 0 0 1 0 0 0 1 ${tx} ${ty} 0" printable="1"/>`
  ).join('')

  const enc = new TextEncoder()
  const zipFiles: { name: string; data: Uint8Array }[] = [
    { name: '[Content_Types].xml', data: enc.encode(
      `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`
    )},
    { name: '_rels/.rels', data: enc.encode(
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`
    )},
    { name: '3D/3dmodel.model', data: enc.encode(
      `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:slic3rpe="http://schemas.slic3r.org/3mf/2017/06"><metadata name="slic3rpe:Version3mf">1</metadata><resources>${objects.join('')}</resources><build>${items}</build></model>`
    )},
  ]

  if (configEntries.length > 0) {
    const volXml = (v: ConfigVol) => {
      const settingsMeta = v.settings ? Object.entries(v.settings).map(([k, val]) =>
        `<metadata type="volume" key="${k}" value="${val.replace(/"/g, '&quot;')}"/>`).join('') : ''
      return `<volume firstid="${v.firstid}" lastid="${v.lastid}"><metadata type="volume" key="name" value="${v.label.replace(/"/g, '&quot;')}"/><metadata type="volume" key="volume_type" value="ModelPart"/>${settingsMeta}</volume>`
    }
    const objXml = (e: ConfigObj) =>
      `<object id="${e.id}" instances_count="1"><metadata type="object" key="name" value="${e.label.replace(/"/g, '&quot;')}"/>${e.volumes.map(volXml).join('')}</object>`
    zipFiles.push({ name: 'Metadata/Slic3r_PE_model.config', data: enc.encode(
      `<?xml version="1.0" encoding="UTF-8"?>\n<config>\n${configEntries.map(objXml).join('\n')}\n</config>`
    )})
  }

  return buildZip(zipFiles)
}

export function useGeometry(slug: string, params: () => Record<string, unknown>) {
  const worker = new Worker(new URL('../renderWorker.ts', import.meta.url), { type: 'module' })
  onCleanup(() => worker.terminate())

  const [geometry, setGeometry] = createSignal<RawMesh | null>(null)
  const [pieces, setPieces] = createSignal<PieceMesh[] | null>(null)
  const [rendering, setRendering] = createSignal(true)
  const [selectedPiece, setSelectedPiece] = createSignal<ReadonlySet<number>>(new Set<number>())
  let currentKey: string | null = null
  const pendingCallbacks = new Map<string, (mesh: RawMesh, pieces?: PieceMesh[]) => void>()

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
      if (cb) { pendingCallbacks.delete(msg.key); cb(msg.mesh, msg.pieces) }
    } else {
      if (msg.key === currentKey) { setGeometry(null); setPieces(null); setRendering(false); currentKey = null }
      pendingCallbacks.delete(msg.key)
    }
  }

  createEffect(() => {
    const p = params()
    setSelectedPiece(new Set<number>())

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

  const download = (pieceIndex?: number, format: 'stl' | '3mf' = 'stl') => {
    const p = params()
    const pieceLabel = pieceIndex !== undefined ? pieces()?.[pieceIndex]?.label : undefined
    const filename = (pieceLabel ?? slug).toLowerCase().replace(/\s+/g, '-')
    const wantPieces = format === '3mf' && pieceIndex === undefined
    const key = `export::${slug}::${pieceIndex ?? 'all'}::${format}::${JSON.stringify(p)}`
    pendingCallbacks.set(key, (mesh, exportPieces) => {
      const [buf, ext, mime] = format === '3mf'
        ? [build3mf(mesh, filename, exportPieces), '3mf', 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml']
        : [buildStl(mesh), 'stl', 'application/octet-stream']
      const url = URL.createObjectURL(new Blob([buf], { type: mime }))
      Object.assign(document.createElement('a'), { href: url, download: `${filename}.${ext}` }).click()
      URL.revokeObjectURL(url)
    })
    worker.postMessage({ type: 'export', key, slug, params: p, pieceIndex, wantPieces })
  }

  const togglePiece = (idx: number) => {
    if (idx < 0) { setSelectedPiece(new Set<number>()); return }
    setSelectedPiece(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }

  return { geometry, pieces, rendering, selectedPiece, togglePiece, download }
}
