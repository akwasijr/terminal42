import { describe, it, expect } from 'vitest'
import { waveAt } from '../../src/shared/motion/frame'
import { emptyDoc } from '../../src/shared/motion/defaults'
import type { Wave } from '../../src/shared/motion/types'

const wave = (patch: Partial<Wave> = {}): Wave => ({
  ...emptyDoc('carousel').displacement.wave,
  depth: 4,
  frequency: 1,
  speed: 1,
  ...patch
})

describe('the wave', () => {
  it('does nothing at its default, so no existing piece moves', () => {
    const d = emptyDoc('carousel').displacement.wave
    expect(d.depth).toBe(0)
    for (const p of [0, 0.25, 0.5, 0.75]) expect(waveAt(d, 3, -2, p)).toBe(0)
  })

  it('does nothing with no depth or no frequency', () => {
    expect(waveAt(wave({ depth: 0 }), 3, 1, 0.3)).toBe(0)
    expect(waveAt(wave({ frequency: 0 }), 3, 1, 0.3)).toBe(0)
  })

  it('never pushes a card further than the depth asked for', () => {
    const w = wave({ depth: 7, frequency: 5 })
    for (let i = 0; i <= 40; i += 1) {
      const v = waveAt(w, (i % 9) - 4, (i % 7) - 3, i / 40)
      expect(Math.abs(v)).toBeLessThanOrEqual(7 + 1e-9)
    }
  })

  // The loop is the point of the whole app: a wave that is somewhere else at
  // the end of a pass makes the video jump every time it repeats.
  it('comes back to where it started at the end of the loop', () => {
    for (const speed of [0, 1, 2, 5]) {
      for (const style of ['wave', 'ripple'] as const) {
        const w = wave({ speed, style, frequency: 2.5 })
        expect(waveAt(w, 2, -1, 1)).toBeCloseTo(waveAt(w, 2, -1, 0), 10)
      }
    }
  })

  it('rounds a fractional speed rather than breaking the loop', () => {
    const w = wave({ speed: 2.4 })
    expect(waveAt(w, 1, 1, 1)).toBeCloseTo(waveAt(w, 1, 1, 0), 10)
  })

  it('puts two cards in different places, which is what makes it a wave', () => {
    const w = wave({ frequency: 2 })
    expect(waveAt(w, -3, 0, 0.2)).not.toBeCloseTo(waveAt(w, 3, 0, 0.2), 3)
  })

  it('sweeps along the axis it is pointed at', () => {
    const h = wave({ direction: 'horizontal' })
    const v = wave({ direction: 'vertical' })
    // Moving along x changes a horizontal wave and leaves a vertical one alone.
    expect(waveAt(h, 0, 0, 0)).not.toBeCloseTo(waveAt(h, 2, 0, 0), 6)
    expect(waveAt(v, 0, 0, 0)).toBeCloseTo(waveAt(v, 2, 0, 0), 10)
    expect(waveAt(v, 0, 0, 0)).not.toBeCloseTo(waveAt(v, 0, 2, 0), 6)
  })

  it('spreads a ripple from the middle, so direction stops mattering', () => {
    const r = wave({ style: 'ripple' })
    expect(waveAt(r, 3, 0, 0.1)).toBeCloseTo(waveAt(r, -3, 0, 0.1), 10)
    expect(waveAt(r, 0, 3, 0.1)).toBeCloseTo(waveAt(r, 3, 0, 0.1), 10)
    expect(waveAt({ ...r, direction: 'vertical' }, 3, 1, 0.1)).toBeCloseTo(waveAt(r, 3, 1, 0.1), 10)
  })

  it('turns the whole wave over when the depth goes negative', () => {
    const up = wave({ depth: 5 })
    const down = wave({ depth: -5 })
    expect(waveAt(down, 2, 1, 0.3)).toBeCloseTo(-waveAt(up, 2, 1, 0.3), 10)
  })
})
