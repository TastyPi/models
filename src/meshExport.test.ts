import { describe, it, expect } from 'vitest'
import { buildStl, build3mf, buildZip } from './meshExport'
import type { RawMesh } from './types'
import type { ExportObj } from './meshExport'

// One triangle: vertices at (0,0,0), (1,0,0), (0,1,0) with numProp=3
function singleTriMesh(): RawMesh {
  return {
    vertProperties: new Float32Array([0, 0, 0,  1, 0, 0,  0, 1, 0]),
    triVerts: new Uint32Array([0, 1, 2]),
    numProp: 3,
  }
}

// Two triangles sharing no vertices
function twoTriMesh(): RawMesh {
  return {
    vertProperties: new Float32Array([
      0, 0, 0,  1, 0, 0,  0, 1, 0,
      2, 0, 0,  3, 0, 0,  2, 1, 0,
    ]),
    triVerts: new Uint32Array([0, 1, 2,  3, 4, 5]),
    numProp: 3,
  }
}

describe('buildStl', () => {
  it('produces correct size for a single mesh', () => {
    const buf = buildStl([singleTriMesh()])
    expect(buf.byteLength).toBe(84 + 1 * 50)
  })

  it('writes triangle count in the header', () => {
    const buf = buildStl([singleTriMesh()])
    const dv = new DataView(buf)
    expect(dv.getUint32(80, true)).toBe(1)
  })

  it('concatenates two meshes into one STL', () => {
    const buf = buildStl([singleTriMesh(), twoTriMesh()])
    const dv = new DataView(buf)
    expect(dv.getUint32(80, true)).toBe(3)
    expect(buf.byteLength).toBe(84 + 3 * 50)
  })

  it('produces the same result as passing meshes together in one mesh', () => {
    const combined = twoTriMesh()
    const separate = buildStl([singleTriMesh(), singleTriMesh()])
    const together = buildStl([combined])
    // Both should report 2 triangles and have the same file size
    const dvSep = new DataView(separate)
    const dvTog = new DataView(together)
    expect(dvSep.getUint32(80, true)).toBe(2)
    expect(dvTog.getUint32(80, true)).toBe(2)
    expect(separate.byteLength).toBe(together.byteLength)
  })

  it('produces an empty (header-only) STL for an empty mesh list', () => {
    const buf = buildStl([])
    const dv = new DataView(buf)
    expect(buf.byteLength).toBe(84)
    expect(dv.getUint32(80, true)).toBe(0)
  })

  it('swaps y/z axes (manifold y→STL z, manifold z negated→STL y)', () => {
    // Vertex at manifold (1, 2, 3) should appear in STL as (1, -3, 2)
    const mesh: RawMesh = {
      vertProperties: new Float32Array([0, 0, 0,  1, 2, 3,  0, 1, 0]),
      triVerts: new Uint32Array([0, 1, 2]),
      numProp: 3,
    }
    const buf = buildStl([mesh])
    const dv = new DataView(buf)
    // First vertex of the triangle starts at byte 84 + 12 (normal) = 96
    const v1x = dv.getFloat32(96, true)
    const v1y = dv.getFloat32(100, true)
    const v1z = dv.getFloat32(104, true)
    expect(v1x).toBeCloseTo(0)
    expect(v1y).toBeCloseTo(0)
    expect(v1z).toBeCloseTo(0)
    // Second vertex starts at 108
    const v2x = dv.getFloat32(108, true)
    const v2y = dv.getFloat32(112, true)
    const v2z = dv.getFloat32(116, true)
    expect(v2x).toBeCloseTo(1)
    expect(v2y).toBeCloseTo(-3)
    expect(v2z).toBeCloseTo(2)
  })
})

describe('buildZip', () => {
  it('starts with a local file header signature', () => {
    const enc = new TextEncoder()
    const buf = buildZip([{ name: 'test.txt', data: enc.encode('hello') }])
    const dv = new DataView(buf)
    expect(dv.getUint32(0, true)).toBe(0x04034b50)
  })

  it('ends with an end-of-central-directory signature', () => {
    const enc = new TextEncoder()
    const buf = buildZip([{ name: 'test.txt', data: enc.encode('hello') }])
    const dv = new DataView(buf)
    // EOCD is the last 22 bytes
    expect(dv.getUint32(buf.byteLength - 22, true)).toBe(0x06054b50)
  })
})

describe('build3mf', () => {
  it('produces a ZIP with the three required 3MF files', () => {
    const obj: ExportObj = { label: 'test', mesh: singleTriMesh() }
    const buf = build3mf([obj])
    const bytes = new Uint8Array(buf)
    const text = new TextDecoder().decode(bytes)
    expect(text).toContain('[Content_Types].xml')
    expect(text).toContain('_rels/.rels')
    expect(text).toContain('3D/3dmodel.model')
  })

  it('includes the object label in the model XML', () => {
    const obj: ExportObj = { label: 'my-piece', mesh: singleTriMesh() }
    const buf = build3mf([obj])
    const text = new TextDecoder().decode(new Uint8Array(buf))
    expect(text).toContain('my-piece')
  })

  it('includes Slic3r config when settings are provided', () => {
    const obj: ExportObj = {
      label: 'part',
      mesh: singleTriMesh(),
      settings: { fill_density: '15%' },
    }
    const buf = build3mf([obj])
    const text = new TextDecoder().decode(new Uint8Array(buf))
    expect(text).toContain('Slic3r_PE_model.config')
    expect(text).toContain('fill_density')
  })

  it('omits Slic3r config when no settings or parts', () => {
    const obj: ExportObj = { label: 'plain', mesh: singleTriMesh() }
    const buf = build3mf([obj])
    const text = new TextDecoder().decode(new Uint8Array(buf))
    expect(text).not.toContain('Slic3r_PE_model.config')
  })

  it('uses mergedMeshXml and writes config volumes when parts are present', () => {
    const obj: ExportObj = {
      label: 'multi',
      mesh: twoTriMesh(),
      parts: [
        { label: 'body', mesh: singleTriMesh() },
        { label: 'insert', mesh: singleTriMesh(), settings: { extruder: '2' } },
      ],
    }
    const buf = build3mf([obj])
    const text = new TextDecoder().decode(new Uint8Array(buf))
    expect(text).toContain('body')
    expect(text).toContain('insert')
    expect(text).toContain('extruder')
  })
})
