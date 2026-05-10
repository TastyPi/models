import { describe, it, expect } from 'vitest'
import { resolveDriverDiameter, resolveScrew } from './screws'

describe('resolveDriverDiameter', () => {
  it('returns 10 for ltt driver', () => {
    expect(resolveDriverDiameter('ltt', 10)).toBe(10)
  })

  it('returns custom driver_diameter for custom type', () => {
    expect(resolveDriverDiameter('custom', 12.5)).toBe(12.5)
  })
})

describe('resolveScrew', () => {
  it('returns preset shaft/head for named wood screw types', () => {
    expect(resolveScrew('wood3', 0, 0)).toEqual({ shaft: 3.0, head: 6.0 })
    expect(resolveScrew('wood4', 0, 0)).toEqual({ shaft: 4.0, head: 8.0 })
    expect(resolveScrew('wood6', 0, 0)).toEqual({ shaft: 6.0, head: 12.0 })
  })

  it('returns preset shaft/head for named machine screw types', () => {
    expect(resolveScrew('m3', 0, 0)).toEqual({ shaft: 3.0, head: 6.72 })
    expect(resolveScrew('m4', 0, 0)).toEqual({ shaft: 4.0, head: 8.96 })
    expect(resolveScrew('m6', 0, 0)).toEqual({ shaft: 6.0, head: 13.44 })
  })

  it('passes through custom dimensions', () => {
    expect(resolveScrew('custom', 3.5, 7.2)).toEqual({ shaft: 3.5, head: 7.2 })
  })

  it('falls back to wood4 for unknown type', () => {
    expect(resolveScrew('unknown', 0, 0)).toEqual({ shaft: 4.0, head: 8.0 })
  })
})
