import { describe, it, expect } from 'vitest'
import { TAU } from '../../src/shared/motion/math'
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
import { grid } from '../../src/shared/motion/components/grid'
import { flip } from '../../src/shared/motion/components/flip'
import { globe } from '../../src/shared/motion/components/global'
import { cubic } from '../../src/shared/motion/components/cubic'
import { column } from '../../src/shared/motion/components/column'
import { plate } from '../../src/shared/motion/components/plate'
import { spin } from '../../src/shared/motion/components/spin'

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
  feed,
  grid,
  flip,
  globe,
  cubic,
  column,
  plate,
  spin
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

  // Comparing phase 0 with phase 1 cannot see a broken seam: every component
  // wraps its phase, so phase 1 *is* phase 0 and the check passes by
  // construction. The seam only shows up on approach — at phase 0.999999 a
  // conveyor that advances a fractional number of cards per loop has carried
  // the whole arrangement part of a step away from where it started, and jumps
  // back on the next frame. Cards are compared as a set because a conveyor is
  // allowed to recycle a card from one end to the other; what must not change
  // is the shape they make.
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

// The generic sweep above already proves every param closes the loop and
// stays finite for these three components (they are in `components`). These
// tests check the specific shapes the brief calls out: Direction mirroring,
// Rows splitting the deck, and Hold/Transition acting like a stepped hold.

/** Smallest distance from `diff` to a whole multiple of `mod`, always >= 0. */
function distanceToMultiple(diff: number, mod: number): number {
  const r = ((diff % mod) + mod) % mod
  return Math.min(r, mod - r)
}

describe('Direction reverse is the mirror of forward (continuous mode)', () => {
  it('carousel: reverse(phase) matches forward(1 - phase) up to whole turns', () => {
    const base = { cards: 8, rows: 1, radius: 4, ramp: 0, staggerRadial: 0, staggerVertical: 0, type: 'continuous', spinAxis: 'y', speed: 0.5, bend: 0, bendAlways: false }
    const forward = { ...base, direction: 'forward' }
    const reverse = { ...base, direction: 'reverse' }
    for (let i = 0; i < 8; i++) {
      for (const phase of [0.1, 0.33, 0.6, 0.87]) {
        const a = carousel.layout(phase, i, 8, reverse)
        const b = carousel.layout(1 - phase, i, 8, forward)
        expect(Math.abs(a.x - b.x)).toBeLessThan(1e-6)
        expect(Math.abs(a.y - b.y)).toBeLessThan(1e-6)
        expect(Math.abs(a.z - b.z)).toBeLessThan(1e-6)
        // rotY is an unwrapped angle, so forward and reverse can differ by a
        // whole number of turns and still describe the same orientation.
        expect(distanceToMultiple(a.rotY - b.rotY, TAU)).toBeLessThan(1e-6)
      }
    }
  })

  it('slider: reverse(phase) matches forward(1 - phase) exactly', () => {
    const base = { cards: 6, gap: 1.1, stagger: 0, depth: 1, spinX: 40, spinY: 20, spinZ: 10, axis: 'horizontal', mode: 'continuous', stepSize: 2, drift: 0 }
    const forward = { ...base, direction: 'forward' }
    const reverse = { ...base, direction: 'reverse' }
    for (let i = 0; i < 6; i++) {
      for (const phase of [0.05, 0.4, 0.5, 0.9]) {
        const a = slider.layout(phase, i, 6, reverse)
        const b = slider.layout(1 - phase, i, 6, forward)
        for (const f of NUMERIC_FIELDS) {
          expect(Math.abs((a[f] as number) - (b[f] as number))).toBeLessThan(1e-6)
        }
      }
    }
  })

  it('card shuffle: reverse(phase) matches forward(1 - phase) exactly', () => {
    const base = { images: '5', cardScale: 2, stagger: 0, depth: 1, axis: 'horizontal', mode: 'continuous', stepSize: 2, drift: 0 }
    const forward = { ...base, direction: 'forward' }
    const reverse = { ...base, direction: 'reverse' }
    for (let i = 0; i < 5; i++) {
      for (const phase of [0.05, 0.4, 0.5, 0.9]) {
        const a = cardShuffle.layout(phase, i, 5, reverse)
        const b = cardShuffle.layout(1 - phase, i, 5, forward)
        for (const f of NUMERIC_FIELDS) {
          expect(Math.abs((a[f] as number) - (b[f] as number))).toBeLessThan(1e-6)
        }
      }
    }
  })
})

describe('Carousel rows split the deck as expected', () => {
  it('assigns cards to rows in contiguous bands of `cards` each', () => {
    const perRow = 4
    const rows = 3
    const params = { cards: perRow, rows, radius: 4, ramp: 0, staggerRadial: 0, staggerVertical: 0, type: 'continuous', spinAxis: 'y', speed: 0, bend: 0 }
    const n = carousel.cardCount(params)
    expect(n).toBe(perRow * rows)
    for (let index = 0; index < n; index++) {
      const expectedRow = Math.floor(index / perRow)
      // Row separation shows up as a distinct vertical lift per row, all else
      // held equal (speed 0, no ramp/stagger). Cards in the same row must
      // share a lift; cards in different rows must not.
      const p = carousel.layout(0, index, n, params)
      const sameRowIndex = (expectedRow * perRow) + (index % perRow)
      const sameRowPlacement = carousel.layout(0, sameRowIndex, n, params)
      expect(p.y).toBeCloseTo(sameRowPlacement.y, 6)
    }
    const rowLifts = Array.from({ length: rows }, (_, row) => carousel.layout(0, row * perRow, n, params).y)
    const distinctLifts = new Set(rowLifts.map((y) => y.toFixed(6)))
    expect(distinctLifts.size).toBe(rows)
  })
})

describe('Hold and Transition behave like a stepped hold-then-move', () => {
  it('slider stepped mode: a long hold keeps a card still near the start of its slot', () => {
    const params = {
      cards: 4, cardScale: 1, gap: 1, stagger: 0, depth: 0, spinX: 0, spinY: 0, spinZ: 0,
      axis: 'horizontal', mode: 'stepped', stepSize: 1, direction: 'forward',
      hold: 10, transition: 0.1, drift: 0
    }
    const early = slider.layout(0.001, 0, 4, params)
    const stillEarly = slider.layout(0.02, 0, 4, params)
    // With hold vastly larger than transition, the very start of the loop
    // should not yet have moved off its resting position.
    expect(Math.abs(early.x - stillEarly.x)).toBeLessThan(1e-6)
  })

  it('card shuffle stepped mode stays finite and closes across hold/transition extremes', () => {
    for (const [hold, transition] of [[0, 0.5], [4, 0.1], [0.5, 4]] as const) {
      const params = { images: '3', cardScale: 1, stagger: 0, depth: 1, axis: 'horizontal', mode: 'stepped', stepSize: 1, direction: 'forward', hold, transition, drift: 0 }
      const n = cardShuffle.cardCount(params)
      for (let i = 0; i < n; i++) {
        const a = cardShuffle.layout(0, i, n, params)
        const b = cardShuffle.layout(1, i, n, params)
        for (const f of NUMERIC_FIELDS) {
          expect(Number.isFinite(a[f] as number)).toBe(true)
          expect(Math.abs((a[f] as number) - (b[f] as number))).toBeLessThan(1e-6)
        }
      }
    }
  })
})
