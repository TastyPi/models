import type { RawMesh } from './types'

export type ExportObj = {
  label: string
  mesh: RawMesh
  parts?: { label: string; mesh: RawMesh; settings?: Record<string, string> }[]
  settings?: Record<string, string>
}

export function buildStl(meshes: RawMesh[]): ArrayBuffer {
  const totalTris = meshes.reduce((sum, m) => sum + m.triVerts.length / 3, 0)
  const buf = new ArrayBuffer(84 + totalTris * 50)
  const dv = new DataView(buf)
  dv.setUint32(80, totalTris, true)
  let o = 84
  for (const { vertProperties: v, triVerts: t, numProp: s } of meshes) {
    const n = t.length / 3
    const px = (base: number) => v[base]
    const py = (base: number) => v[base + 1]
    const pz = (base: number) => v[base + 2]
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

export function buildZip(files: { name: string; data: Uint8Array }[]): ArrayBuffer {
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
    verts.push(`<vertex x="${f(v[i*s] + dx)}" y="${f(v[i*s+1] + dy)}" z="${f(v[i*s+2] + dz)}"/>`)
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
    const x = f(v[i*s]), y = f(v[i*s+1]), z = f(v[i*s+2])
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
      verts.push(`<vertex x="${f(v[i*s] + dx)}" y="${f(v[i*s+1] + dy)}" z="${f(v[i*s+2] + dz)}"/>`)
    for (let i = 0; i < nt; i++)
      tris.push(`<triangle v1="${t[i*3] + vertOffset}" v2="${t[i*3+1] + vertOffset}" v3="${t[i*3+2] + vertOffset}"/>`)
    triCounts.push(nt)
    vertOffset += nv
  }
  return { xml: `<vertices>${verts.join('')}</vertices><triangles>${tris.join('')}</triangles>`, triCounts }
}

export function build3mf(objects: ExportObj[]): ArrayBuffer {
  const xmlObjects: string[] = []
  const buildItems: { id: number; tx: number; ty: number }[] = []
  type ConfigVol = { label: string; firstid: number; lastid: number; settings?: Record<string, string> }
  type ConfigObj = { id: number; label: string; volumes: ConfigVol[] }
  const configEntries: ConfigObj[] = []
  let nextId = 1

  for (const e of objects) {
    const { cx, cy, minZ } = meshBounds(e.mesh)
    const tx = +cx.toFixed(4)
    const ty = +cy.toFixed(4)

    if (e.parts && e.parts.length > 0) {
      const partMeshes = e.parts.map(part => ({ mesh: part.mesh, dx: -cx, dy: -cy, dz: -minZ }))
      const { xml, triCounts } = mergedMeshXml(partMeshes)
      xmlObjects.push(`<object id="${nextId}" name="${e.label.replace(/"/g, '&quot;')}" type="model"><mesh>${xml}</mesh></object>`)
      buildItems.push({ id: nextId, tx, ty })
      const volumes: ConfigVol[] = []
      let triStart = 0
      for (let j = 0; j < e.parts.length; j++) {
        volumes.push({ label: e.parts[j].label, firstid: triStart, lastid: triStart + triCounts[j] - 1, settings: e.parts[j].settings })
        triStart += triCounts[j]
      }
      configEntries.push({ id: nextId, label: e.label, volumes })
      nextId++
    } else {
      const triCount = e.mesh.triVerts.length / 3
      xmlObjects.push(`<object id="${nextId}" name="${e.label.replace(/"/g, '&quot;')}" type="model"><mesh>${meshXml(e.mesh, -cx, -cy, -minZ)}</mesh></object>`)
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
      `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:slic3rpe="http://schemas.slic3r.org/3mf/2017/06"><metadata name="slic3rpe:Version3mf">1</metadata><resources>${xmlObjects.join('')}</resources><build>${items}</build></model>`
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
