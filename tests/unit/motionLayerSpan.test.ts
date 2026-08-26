import { describe, expect, it } from 'vitest'
import { layerVisibility } from '../../src/shared/motion/frame'

describe('layerVisibility', () => {
  it('shows a layer with no timing all the way round', () => {
    for (const p of [0, 0.25, 0.5, 0.75, 0.999]) {
      expect(layerVisibility({}, p)).toBe(1)
    }
  })

  it('treats one bound as running to the end of the loop', () => {
    expect(layerVisibility({ from: 0.5 }, 0.4)).toBe(0)
    expect(layerVisibility({ from: 0.5 }, 0.6)).toBe(1)
    expect(layerVisibility({ to: 0.5 }, 0.4)).toBe(1)
    expect(layerVisibility({ to: 0.5 }, 0.6)).toBe(0)
  })

  it('is on inside a plain window and off outside it', () => {
    const span = { from: 0.25, to: 0.75 }
    expect(layerVisibility(span, 0.1)).toBe(0)
    expect(layerVisibility(span, 0.5)).toBe(1)
    expect(layerVisibility(span, 0.9)).toBe(0)
  })

  it('carries a window through the seam', () => {
    const span = { from: 0.8, to: 0.2 }
    expect(layerVisibility(span, 0.9)).toBe(1)
    expect(layerVisibility(span, 0)).toBe(1)
    expect(layerVisibility(span, 0.1)).toBe(1)
    expect(layerVisibility(span, 0.5)).toBe(0)
  })

  it('reads a shut window as shut, not as open all the way round', () => {
    expect(layerVisibility({ from: 0.3, to: 0.3 }, 0.3)).toBe(0)
    expect(layerVisibility({ from: 0.3, to: 0.3 }, 0.8)).toBe(0)
  })

  it('wraps bounds given outside the loop', () => {
    expect(layerVisibility({ from: 1.25, to: 1.75 }, 0.5)).toBe(1)
    expect(layerVisibility({ from: -0.75, to: -0.25 }, 0.5)).toBe(1)
  })

  it('fades in at the start and out at the end', () => {
    const span = { from: 0, to: 1, fade: 0.1 }
    expect(layerVisibility(span, 0)).toBe(0)
    expect(layerVisibility(span, 0.05)).toBeCloseTo(0.5, 5)
    expect(layerVisibility(span, 0.5)).toBe(1)
    expect(layerVisibility(span, 0.95)).toBeCloseTo(0.5, 5)
  })

  it('measures the fade against the window, not the loop', () => {
    // A quarter-long window with a tenth fade fades over a fortieth of the
    // loop, so half way through that is 1/80 in.
    const span = { from: 0.5, to: 0.75, fade: 0.1 }
    expect(layerVisibility(span, 0.5 + 1 / 80)).toBeCloseTo(0.5, 5)
    expect(layerVisibility(span, 0.625)).toBe(1)
  })

  it('never lets the two fades cross, however long the fade is asked to be', () => {
    for (const fade of [0.5, 0.9, 5]) {
      const span = { from: 0.2, to: 0.8, fade }
      const mid = layerVisibility(span, 0.5)
      expect(mid).toBeGreaterThan(0)
      expect(mid).toBeLessThanOrEqual(1)
    }
  })

  it('stays within zero and one everywhere, wrapped or not', () => {
    for (const span of [
      { from: 0.1, to: 0.9, fade: 0.25 },
      { from: 0.9, to: 0.1, fade: 0.25 },
      { from: 0.4, to: 0.45, fade: 0.5 }
    ]) {
      for (let i = 0; i < 200; i += 1) {
        const v = layerVisibility(span, i / 200)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
  })

  it('is continuous across the seam, so a wrapped fade does not jump', () => {
    const span = { from: 0.9, to: 0.4, fade: 0.2 }
    const before = layerVisibility(span, 0.999)
    const after = layerVisibility(span, 0)
    expect(Math.abs(before - after)).toBeLessThan(0.02)
  })
})
