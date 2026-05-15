import { describe, it, expect } from 'vitest'
import { BufferGeometry, BufferAttribute } from 'three'
import { groupPartsByExtruder } from './workerShared'
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

describe('groupPartsByExtruder', () => {
  it('defaults to extruder 1 when extruder is not specified', () => {
    const groups = groupPartsByExtruder(makeObj([
      { label: 'Body', geom: makeGeom() },
    ]))
    expect(groups).toHaveLength(1)
    expect(groups[0].extruder).toBe(1)
  })

  it('respects explicit extruder numbers', () => {
    const groups = groupPartsByExtruder(makeObj([
      { label: 'Body', geom: makeGeom() },
      { label: 'Text', geom: makeGeom(), extruder: 2 },
    ]))
    expect(groups).toHaveLength(2)
    expect(groups[0].extruder).toBe(1)
    expect(groups[1].extruder).toBe(2)
  })

  it('merges parts that share the same extruder', () => {
    const groups = groupPartsByExtruder(makeObj([
      { label: 'Top text', geom: makeGeom(), extruder: 2 },
      { label: 'Bot text', geom: makeGeom(), extruder: 2 },
    ]))
    expect(groups).toHaveLength(1)
    expect(groups[0].extruder).toBe(2)
    expect(groups[0].geoms).toHaveLength(2)
  })

  it('sorts groups by extruder number', () => {
    const groups = groupPartsByExtruder(makeObj([
      { label: 'Text', geom: makeGeom(), extruder: 2 },
      { label: 'Body', geom: makeGeom(), extruder: 1 },
    ]))
    expect(groups.map(g => g.extruder)).toEqual([1, 2])
  })

  it('treats missing extruder and extruder 1 as the same group', () => {
    const groups = groupPartsByExtruder(makeObj([
      { label: 'A', geom: makeGeom() },
      { label: 'B', geom: makeGeom(), extruder: 1 },
    ]))
    expect(groups).toHaveLength(1)
    expect(groups[0].extruder).toBe(1)
    expect(groups[0].geoms).toHaveLength(2)
  })
})
