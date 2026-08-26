import { describe, it, expect } from 'vitest'
import { steppedPosition, wrap01 } from '../../src/shared/motion/math'

// steppedPosition is the helper every stepped component (Carousel's Step type,
// Slider's Stepped mode, Card shuffle's Stepped mode) shares for turning Hold
// and Transition into a position. It is exercised directly here because the
// per-component tests only see the result after it has been folded into an
// angle or an offset, which can hide a broken edge case behind trigonometry.

describe('steppedPosition', () => {
  it('closes the loop for every steps/hold/transition combination', () => {
    // The helper is built so the loop always closes: phase is wrapped before
    // it is split into a step, so phase 0 and phase 1 land on the same step
    // regardless of how hold and transition divide up the time in between.
    const stepsToTry = [1, 2, 3, 5, 12]
    const holds = [0, 0.1, 1, 4]
    const transitions = [0, 0.05, 0.6, 4]
    for (const steps of stepsToTry) {
      for (const hold of holds) {
        for (const transition of transitions) {
          const a = steppedPosition(0, steps, hold, transition)
          const b = steppedPosition(1, steps, hold, transition)
          expect(Math.abs(a - b)).toBeLessThan(1e-9)
        }
      }
    }
  })

  it('holds still for the hold portion of each step, then moves', () => {
    const steps = 4
    const hold = 3
    const transition = 1
    // With hold much larger than transition, most of each step's time slot is
    // spent not moving: sampling early in the slot should still read as the
    // step index itself, with no fractional creep.
    const early = steppedPosition(0.02, steps, hold, transition)
    expect(early).toBeCloseTo(0, 5)
    const stillHolding = steppedPosition(0.1, steps, hold, transition)
    expect(stillHolding).toBeCloseTo(0, 5)
    // Deep into the transition portion of the same step, the position should
    // have moved on towards the next integer step.
    const late = steppedPosition(0.24, steps, hold, transition)
    expect(late).toBeGreaterThan(0.5)
  })

  it('with hold at 0, transitions start immediately', () => {
    const steps = 4
    const hold = 0
    const transition = 1
    const justAfterStart = steppedPosition(0.01, steps, hold, transition)
    // No hold portion at all, so the very start of a step's slot should
    // already be easing away from the step index rather than sitting flat.
    expect(justAfterStart).toBeGreaterThan(0)
  })

  it('is monotonic non-decreasing within a single step for forward phase', () => {
    const steps = 5
    const hold = 0.5
    const transition = 1.5
    let previous = steppedPosition(0, steps, hold, transition)
    for (let i = 1; i <= 40; i++) {
      const phase = i / 200 // stay inside the first step's slot
      const value = steppedPosition(phase, steps, hold, transition)
      expect(value).toBeGreaterThanOrEqual(previous - 1e-9)
      previous = value
    }
  })

  it('is safe when steps is 0 or 1', () => {
    expect(steppedPosition(0.5, 0, 1, 1)).toBe(0)
    for (let i = 0; i <= 10; i++) {
      const phase = i / 10
      const value = steppedPosition(phase, 1, 1, 1)
      expect(Number.isFinite(value)).toBe(true)
    }
  })

  it('is safe when hold or transition is 0', () => {
    for (const [hold, transition] of [[0, 0], [0, 1], [1, 0]] as const) {
      for (let i = 0; i <= 20; i++) {
        const phase = i / 20
        const value = steppedPosition(phase, 6, hold, transition)
        expect(Number.isFinite(value)).toBe(true)
      }
    }
  })

  it('is pure and finite across a dense sweep of phase, steps, hold and transition', () => {
    for (let s = 1; s <= 8; s++) {
      for (let h = 0; h <= 4; h += 0.7) {
        for (let t = 0; t <= 4; t += 0.9) {
          for (let i = 0; i <= 12; i++) {
            const phase = wrap01(i / 12)
            const a = steppedPosition(phase, s, h, t)
            const b = steppedPosition(phase, s, h, t)
            expect(a).toBe(b)
            expect(Number.isFinite(a)).toBe(true)
          }
        }
      }
    }
  })
})
