// Where a key lands.
//
// The timeline let a key sit anywhere along the lane, so dragging one gave it
// a time like 0.3874 of a loop — a number that looks precise and renders on
// whichever frame is nearest anyway. Every animation tool snaps, and the two
// properties you most want starting together were the two hardest to line up.
//
// These are the two functions that decide it, kept out of the component so the
// arithmetic can be checked rather than eyeballed at nine pixels wide.

import { describe, it, expect } from 'vitest'
import { nudgeKeyTime, snapKeyTime } from '../../src/shared/motion/keyframes'

describe('snapKeyTime', () => {
  it('lands on the nearest frame', () => {
    // 24 frames: the grid is every 1/24.
    expect(snapKeyTime(0.3874, 24)).toBeCloseTo(9 / 24, 10)
    expect(snapKeyTime(0.5, 24)).toBeCloseTo(12 / 24, 10)
    expect(snapKeyTime(0.02, 24)).toBeCloseTo(0, 10)
  })

  it('stays inside the loop', () => {
    expect(snapKeyTime(-3, 24)).toBe(0)
    expect(snapKeyTime(4, 24)).toBe(1)
    // The last frame is the end of the loop, not one frame past it.
    expect(snapKeyTime(0.999, 24)).toBeLessThanOrEqual(1)
  })

  it('prefers a neighbour inside the magnet to the grid', () => {
    // 0.51 would round to 12/24 = 0.5, but another key sits at 0.52 and the
    // magnet is wide enough to reach it.
    expect(snapKeyTime(0.51, 24, [0.52], 0.03)).toBeCloseTo(0.52, 10)
  })

  it('ignores a neighbour outside the magnet', () => {
    expect(snapKeyTime(0.51, 24, [0.8], 0.03)).toBeCloseTo(0.5, 10)
  })

  it('takes the nearest neighbour when two are in reach', () => {
    expect(snapKeyTime(0.5, 24, [0.53, 0.505], 0.06)).toBeCloseTo(0.505, 10)
  })

  it('does nothing at all when the drag is free', () => {
    expect(snapKeyTime(0.3874, 24, [0.39], 0.05, true)).toBeCloseTo(0.3874, 10)
    // Free still means inside the loop.
    expect(snapKeyTime(1.4, 24, [], 0, true)).toBe(1)
  })

  it('falls back to the raw time when the loop has no frames', () => {
    expect(snapKeyTime(0.3874, 0)).toBeCloseTo(0.3874, 10)
  })

  it('is stable: snapping an already snapped time does not move it', () => {
    const once = snapKeyTime(0.3874, 24)
    expect(snapKeyTime(once, 24)).toBeCloseTo(once, 10)
  })
})

describe('nudgeKeyTime', () => {
  it('moves exactly one frame', () => {
    expect(nudgeKeyTime(9 / 24, 24, 1)).toBeCloseTo(10 / 24, 10)
    expect(nudgeKeyTime(9 / 24, 24, -1)).toBeCloseTo(8 / 24, 10)
  })

  it('takes ten frames at a time when asked', () => {
    expect(nudgeKeyTime(0, 24, 10)).toBeCloseTo(10 / 24, 10)
  })

  it('pulls an off-grid key onto the grid rather than carrying its offset', () => {
    // 0.3874 is between frames 9 and 10; one step right is frame 10, not
    // 0.3874 + 1/24, which would stay off the grid forever.
    expect(nudgeKeyTime(0.3874, 24, 1)).toBeCloseTo(10 / 24, 10)
  })

  it('stops at both ends of the loop', () => {
    expect(nudgeKeyTime(0, 24, -1)).toBe(0)
    expect(nudgeKeyTime(1, 24, 1)).toBe(1)
  })

  it('still moves when the loop has no frames', () => {
    expect(nudgeKeyTime(0.5, 0, 1)).toBeGreaterThan(0.5)
  })
})
