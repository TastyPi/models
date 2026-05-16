import { describe, it, expect } from 'vitest'
import { BufferGeometry, BufferAttribute } from 'three'
import { buildPreviewMeshes } from './workerShared'
import type { ObjGeom } from './types'

function makeGeom(): BufferGeometry {
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3))
  geo.setIndex(new BufferAttribute(new Uint32Array([0, 1, 2]), 1))
  return geo
}

function makeObj(parts: ObjGeom['parts']): ObjGeom {
  return { label: 'test', parts }
}

describe('buildPreviewMeshes', () => {
  it('unassigned extruder produces a mesh with extruder 0', () => {
    const meshes = buildPreviewMeshes(makeObj([
      { label: 'Body', geom: makeGeom() },
    ]))
    expect(meshes).toHaveLength(1)
    expect(meshes[0].extruder).toBe(0)
  })

  it('explicit extruder is preserved in the output', () => {
    const meshes = buildPreviewMeshes(makeObj([
      { label: 'Body', geom: makeGeom(), extruder: 1 },
      { label: 'Text', geom: makeGeom(), extruder: 2 },
    ]))
    expect(meshes).toHaveLength(2)
    expect(meshes[0].extruder).toBe(1)
    expect(meshes[1].extruder).toBe(2)
  })

  it('unassigned and extruder 1 produce separate meshes', () => {
    const meshes = buildPreviewMeshes(makeObj([
      { label: 'A', geom: makeGeom() },
      { label: 'B', geom: makeGeom(), extruder: 1 },
    ]))
    expect(meshes).toHaveLength(2)
    expect(meshes[0].extruder).toBe(0)
    expect(meshes[1].extruder).toBe(1)
  })

  it('parts sharing an extruder are merged into one mesh', () => {
    const meshes = buildPreviewMeshes(makeObj([
      { label: 'Top text', geom: makeGeom(), extruder: 2 },
      { label: 'Bot text', geom: makeGeom(), extruder: 2 },
    ]))
    expect(meshes).toHaveLength(1)
    expect(meshes[0].extruder).toBe(2)
  })

  it('meshes are sorted by extruder number', () => {
    const meshes = buildPreviewMeshes(makeObj([
      { label: 'Text', geom: makeGeom(), extruder: 2 },
      { label: 'Body', geom: makeGeom(), extruder: 1 },
    ]))
    expect(meshes.map(m => m.extruder)).toEqual([1, 2])
  })

  it('each mesh entry contains vertex and triangle data', () => {
    const meshes = buildPreviewMeshes(makeObj([
      { label: 'Body', geom: makeGeom() },
    ]))
    expect(meshes[0].mesh.vertProperties).toBeInstanceOf(Float32Array)
    expect(meshes[0].mesh.triVerts).toBeInstanceOf(Uint32Array)
    expect(meshes[0].mesh.triVerts).toHaveLength(3)
  })
})
