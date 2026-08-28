import { describe, expect, it } from 'vitest'
import { layerVisibility } from '../../src/shared/motion/frame'

/**
 * The eye in the layer list.
 *
 * `hidden` and the `from`/`to`/`fade` window are two different things that
 * both end up as "you cannot see it": the window is part of the piece, the eye
 * is how you get something out of the way while you work. They meet in
 * `layerVisibility`, which is what every draw path, the hit test and the
 * export all multiply by — so these tests are the guard that the eye reaches
 * all of them, and that a layer nobody has hidden behaves exactly as before.
 */
describe('layerVisibility and the eye', () => {
  const phases = [0, 0.01, 0.17, 0.25, 0.5, 0.63, 0.75, 0.99, 1]

  it('hides the layer at every phase, whatever its timing', () => {
    const spans = [
      {},
      { from: 0.2, to: 0.8 },
      { from: 0.2, to: 0.8, fade: 0.1 },
      { from: 0.9, to: 0.1 },
      { from: 0.9, to: 0.1, fade: 0.05 },
      { to: 0.4 },
      { from: 0.6 }
    ]
    for (const span of spans) {
      for (const p of phases) {
        expect(layerVisibility({ ...span, hidden: true }, p)).toBe(0)
      }
    }
  })

  it('leaves an unhidden layer byte-identical to before', () => {
    const spans = [
      {},
      { from: 0.2, to: 0.8 },
      { from: 0.2, to: 0.8, fade: 0.1 },
      { from: 0.9, to: 0.1 },
      { from: 0.9, to: 0.1, fade: 0.05 },
      { to: 0.4 },
      { from: 0.6 }
    ]
    for (const span of spans) {
      for (const p of phases) {
        const base = layerVisibility(span, p)
        expect(layerVisibility({ ...span, hidden: false }, p)).toBe(base)
        expect(layerVisibility({ ...span, hidden: undefined }, p)).toBe(base)
      }
    }
  })

  it('is fully on for an untimed, unhidden layer, so the eye is the only thing turning it off', () => {
    for (const p of phases) expect(layerVisibility({}, p)).toBe(1)
  })

  it('beats a fade rather than scaling it', () => {
    // Mid-fade the layer is part way on; hidden it is off outright, not
    // dimmed by whatever the fade happened to be at.
    const mid = { from: 0.2, to: 0.8, fade: 0.2 }
    const partial = layerVisibility(mid, 0.25)
    expect(partial).toBeGreaterThan(0)
    expect(partial).toBeLessThan(1)
    expect(layerVisibility({ ...mid, hidden: true }, 0.25)).toBe(0)
  })
})
