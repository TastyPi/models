import { describe, it, expect } from 'vitest'
import { resolveBed, splitSizes, splitMaxInterior } from './printBed'

describe('resolveBed', () => {
  it('returns known printer bed sizes', () => {
    expect(resolveBed('prusa_core_one', 0, 0)).toEqual({ x: 250, y: 220 })
    expect(resolveBed('prusa_mk4', 0, 0)).toEqual({ x: 250, y: 210 })
    expect(resolveBed('bambu_a1_mini', 0, 0)).toEqual({ x: 180, y: 180 })
    expect(resolveBed('ender3', 0, 0)).toEqual({ x: 220, y: 220 })
  })

  it('returns custom dimensions for custom type', () => {
    expect(resolveBed('custom', 300, 400)).toEqual({ x: 300, y: 400 })
    expect(resolveBed('custom', 180, 180)).toEqual({ x: 180, y: 180 })
  })

  it('falls back to 220×220 for unknown type', () => {
    expect(resolveBed('unknown_printer', 0, 0)).toEqual({ x: 220, y: 220 })
  })
})

describe('splitSizes', () => {
  it('returns single piece when n fits in maxPer', () => {
    expect(splitSizes(5, 5)).toEqual([5])
    expect(splitSizes(1, 10)).toEqual([1])
    expect(splitSizes(13, 13)).toEqual([13])
  })

  it('splits evenly when divisible', () => {
    expect(splitSizes(10, 5)).toEqual([5, 5])
    expect(splitSizes(14, 7)).toEqual([7, 7])
    expect(splitSizes(9, 3)).toEqual([3, 3, 3])
  })

  it('puts larger pieces first when not evenly divisible', () => {
    expect(splitSizes(13, 5)).toEqual([5, 4, 4])
    expect(splitSizes(11, 5)).toEqual([4, 4, 3])
    expect(splitSizes(7, 3)).toEqual([3, 2, 2])
    expect(splitSizes(13, 7)).toEqual([7, 6])
  })

  it('always sums to n', () => {
    for (const n of [1, 5, 10, 13, 17, 20]) {
      for (const max of [1, 3, 5, 7]) {
        const sizes = splitSizes(n, max)
        expect(sizes.reduce((a, b) => a + b, 0)).toBe(n)
        expect(Math.max(...sizes)).toBeLessThanOrEqual(max)
      }
    }
  })

  it('produces non-increasing sizes', () => {
    const sizes = splitSizes(13, 5)
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeLessThanOrEqual(sizes[i - 1])
    }
  })
})

describe('splitMaxInterior', () => {
  it('returns single piece when n fits in bothMax', () => {
    expect(splitMaxInterior(5, 5, 5, 5, 5)).toEqual([5])
    expect(splitMaxInterior(3, 5, 5, 5, 3)).toEqual([3])
    expect(splitMaxInterior(1, 5, 5, 5, 5)).toEqual([1])
  })

  it('splits into two pieces with no interior when both edges fit', () => {
    expect(splitMaxInterior(6, 5, 5, 5, 5)).toEqual([3, 3])
    expect(splitMaxInterior(4, 5, 5, 5, 3)).toEqual([2, 2])
  })

  it('puts a maxInterior interior piece between two edge pieces', () => {
    expect(splitMaxInterior(13, 5, 5, 5, 5)).toEqual([4, 5, 4])
    expect(splitMaxInterior(10, 5, 3, 3, 3)).toEqual([3, 5, 2])
  })

  it('uses multiple interior pieces when needed', () => {
    expect(splitMaxInterior(18, 5, 5, 5, 5)).toEqual([4, 5, 5, 4])
  })

  it('always sums to n', () => {
    const cases: [number, number, number, number, number][] = [
      [5, 5, 5, 5, 5],
      [13, 5, 5, 5, 5],
      [18, 5, 5, 5, 5],
      [10, 5, 3, 3, 3],
      [1, 5, 5, 5, 5],
      [4, 5, 5, 5, 3],
    ]
    for (const [n, maxI, lm, rm, bm] of cases) {
      const sizes = splitMaxInterior(n, maxI, lm, rm, bm)
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(n)
    }
  })

  it('interior pieces do not exceed maxInterior', () => {
    const sizes = splitMaxInterior(18, 5, 5, 5, 5)
    const interior = sizes.slice(1, -1)
    expect(interior.every(s => s <= 5)).toBe(true)
  })
})
