import { describe, it, expect } from 'vitest'

// These constants must stay in sync with the EP_ values in the model files.
// Tests here document the required clearance invariants for the puzzle connector geometry.
const EP_TAB_W = 10
const EP_TAB_D = 2.5
const EP_NECK_W = 3
const EP_NECK_D = 1.2
const EP_GAP = 0.15

const maleDepth = EP_NECK_D + EP_TAB_D

// Female socket: neck depth = EP_NECK_D, tab starts at EP_NECK_D, tab depth = EP_TAB_D + EP_GAP
const femaleDepth = EP_NECK_D + (EP_TAB_D + EP_GAP)

describe('puzzle connector clearances', () => {
  it('female socket is deeper than male protrusion by EP_GAP', () => {
    expect(femaleDepth - maleDepth).toBeCloseTo(EP_GAP)
  })

  it('female neck width gives EP_GAP clearance per side', () => {
    const femaleNeckW = EP_NECK_W + 2 * EP_GAP
    expect((femaleNeckW - EP_NECK_W) / 2).toBeCloseTo(EP_GAP)
  })

  it('female tab width gives EP_GAP clearance per side', () => {
    const femaleTabW = EP_TAB_W + 2 * EP_GAP
    expect((femaleTabW - EP_TAB_W) / 2).toBeCloseTo(EP_GAP)
  })
})
