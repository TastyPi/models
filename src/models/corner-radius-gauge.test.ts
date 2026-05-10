import { describe, it, expect } from 'vitest'
import { segBox, SEGS, LABEL_W, DW, DH } from './corner-radius-gauge'

describe('segBox', () => {
  const VALID_SEGS = ['a', 'b', 'c', 'd', 'e', 'f', 'g']

  it('returns non-null for all valid segment names', () => {
    for (const seg of VALID_SEGS) {
      expect(segBox(seg), `segment ${seg}`).not.toBeNull()
    }
  })

  it('returns null for unknown segment names', () => {
    expect(segBox('h')).toBeNull()
    expect(segBox('')).toBeNull()
    expect(segBox('A')).toBeNull()
  })

  it('every box has x1 < x2 and y1 < y2', () => {
    for (const seg of VALID_SEGS) {
      const [x1, y1, x2, y2] = segBox(seg)!
      expect(x2, `${seg} x2 > x1`).toBeGreaterThan(x1)
      expect(y2, `${seg} y2 > y1`).toBeGreaterThan(y1)
    }
  })

  it('every box fits within the digit bounding box [0,0,DW,DH]', () => {
    for (const seg of VALID_SEGS) {
      const [x1, y1, x2, y2] = segBox(seg)!
      expect(x1, `${seg} x1 >= 0`).toBeGreaterThanOrEqual(0)
      expect(y1, `${seg} y1 >= 0`).toBeGreaterThanOrEqual(0)
      expect(x2, `${seg} x2 <= DW`).toBeLessThanOrEqual(DW)
      expect(y2, `${seg} y2 <= DH`).toBeLessThanOrEqual(DH)
    }
  })
})

describe('SEGS', () => {
  it('covers all digits 0–9', () => {
    for (let i = 0; i <= 9; i++) {
      expect(SEGS[String(i)], `digit ${i}`).toBeDefined()
    }
  })

  it('every digit references only valid segment names', () => {
    const valid = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g'])
    for (const [digit, segs] of Object.entries(SEGS)) {
      for (const seg of segs) {
        expect(valid.has(seg), `digit ${digit} references unknown segment '${seg}'`).toBe(true)
      }
    }
  })

  it('digit 8 uses all seven segments', () => {
    expect(SEGS['8']).toHaveLength(7)
  })

  it('digit 1 uses only the two right-side verticals', () => {
    expect(SEGS['1']).toEqual(['b', 'c'])
  })

  it('digit 0 omits only the middle segment', () => {
    expect(SEGS['0']).not.toContain('g')
    expect(SEGS['0']).toHaveLength(6)
  })
})

describe('LABEL_W', () => {
  it('equals DW + gap + dot + gap + DW (format "X.Y")', () => {
    const DOT = 0.5
    const CHAR_GAP = 0.4
    expect(LABEL_W).toBeCloseTo(DW + CHAR_GAP + DOT + CHAR_GAP + DW)
  })
})
