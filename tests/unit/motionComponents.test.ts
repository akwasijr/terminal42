import { describe, it, expect } from 'vitest'
import type { CardPlacement, MotionComponent, ParamSpec, ParamValue } from '../../src/shared/motion/types'
import { carousel } from '../../src/shared/motion/components/carousel'
import { ring } from '../../src/shared/motion/components/ring'
import { slider } from '../../src/shared/motion/components/slider'
import { cardShuffle } from '../../src/shared/motion/components/cardShuffle'
import { cardDrop } from '../../src/shared/motion/components/cardDrop'
import { imageRepeater } from '../../src/shared/motion/components/imageRepeater'
import { space } from '../../src/shared/motion/components/space'
import { elevator } from '../../src/shared/motion/components/elevator'
import { ribbon } from '../../src/shared/motion/components/ribbon'
import { parallax } from '../../src/shared/motion/components/parallax'
import { feed } from '../../src/shared/motion/components/feed'

// Imported directly rather than from a registry: the registry file is authored
// separately and must not be a dependency of the invariant these components owe.
const components: MotionComponent[] = [
  carousel,
  ring,
  slider,
  cardShuffle,
  cardDrop,
  imageRepeater,
  space,
  elevator,
  ribbon,
  parallax,
  feed
]

const NUMERIC_FIELDS: Array<keyof CardPlacement> = ['x', 'y', 'z', 'rotX', 'rotY', 'rotZ', 'scale', 'opacity', 'bend']

/**
 * Build a spread of parameter sets from a component's own schema.
 *
 * Each set walks every slider across its range and rotates through every
 * segmented option and both toggle states, so the 24 samples between them
 * exercise the extremes the loop-closure guarantee has to hold at.
 */
function sampleParams(schema: ParamSpec[], k: number): Record<string, ParamValue> {
  const params: Record<string, ParamValue> = {}
  schema.forEach((spec, s) => {
    if (spec.kind === 'slider') {
      const frac = ((k + 1 + s * 3.1) % 25) / 25
      params[spec.key] = spec.min + frac * (spec.max - spec.min)
    } else if (spec.kind === 'segmented') {
      params[spec.key] = spec.options[(k + s) % spec.options.length].value
    } else {
      params[spec.key] = (k + s) % 2 === 0
    }
  })
  return params
}

// A cap only on the loop count, never on the maths: dense grids still get
// sampled, they just do not each blow the test out to hundreds of thousands of
// placements.
const MAX_CARDS = 240

describe.each(components.map((c) => [c.label, c] as const))('%s component', (_label, component) => {
  const combos = Array.from({ length: 24 }, (_, k) => sampleParams(component.schema, k))

  it('reports a positive integer card count', () => {
    for (const params of combos) {
      const n = component.cardCount(params)
      expect(Number.isInteger(n)).toBe(true)
      expect(n).toBeGreaterThan(0)
    }
  })

  it('closes the loop: phase 0 matches phase 1 for every card', () => {
    for (const params of combos) {
      const n = Math.min(MAX_CARDS, component.cardCount(params))
      for (let i = 0; i < n; i++) {
        const a = component.layout(0, i, n, params)
        const b = component.layout(1, i, n, params)
        for (const f of NUMERIC_FIELDS) {
          expect(Math.abs((a[f] as number) - (b[f] as number))).toBeLessThan(1e-6)
        }
        expect(a.bendAxis).toBe(b.bendAxis)
      }
    }
  })

  it('is deterministic: identical arguments give identical placements', () => {
    for (const params of combos) {
      const n = Math.min(MAX_CARDS, component.cardCount(params))
      for (let i = 0; i < n; i++) {
        const a = component.layout(0.37, i, n, params)
        const b = component.layout(0.37, i, n, params)
        expect(a).toEqual(b)
      }
    }
  })

  it('produces only finite numbers across the loop', () => {
    for (const params of combos) {
      const n = Math.min(MAX_CARDS, component.cardCount(params))
      for (let j = 0; j < 16; j++) {
        const phase = j / 16
        for (let i = 0; i < n; i++) {
          const p = component.layout(phase, i, n, params)
          for (const f of NUMERIC_FIELDS) {
            expect(Number.isFinite(p[f] as number)).toBe(true)
          }
        }
      }
    }
  })
})
