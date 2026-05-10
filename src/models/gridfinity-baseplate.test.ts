import { describe, it, expect } from 'vitest'
import { EP_WALL_MIN } from './gridfinity-baseplate'

describe('EP_WALL_MIN', () => {
  it('is a positive number', () => {
    expect(EP_WALL_MIN).toBeGreaterThan(0)
  })

  it('is a multiple of 0.5 (slider step)', () => {
    expect(EP_WALL_MIN % 0.5).toBe(0)
  })
})
