// Entrance and exit: the one-shot layer that hands cards to the idle loop.
//
// The property everything else depends on is the identity handover at
// progress 1 — get that wrong and every entrance would end with a visible
// snap into the idle loop.

import { describe, expect, it } from 'vitest'
import {
  applyEntrance, cardProgress, clipTimeline, defaultEntrance, ENTRANCE_SHAPES, placementsAt,
  totalDuration
} from '../../src/shared/motion/entrance'
import { computePlacements } from '../../src/shared/motion/frame'
import { defaultAnimation, emptyDoc, hydrateDoc } from '../../src/shared/motion/defaults'
import { restingPlacement } from '../../src/shared/motion/math'
import type { CardPlacement, EntranceShape, EntranceSpec, MotionDoc } from '../../src/shared/motion/types'

const NUMERIC_FIELDS: Array<keyof CardPlacement> = ['x', 'y', 'z', 'rotX', 'rotY', 'rotZ', 'scale', 'opacity', 'bend']

const spec = (shape: EntranceShape): EntranceSpec => ({
  enabled: true,
  shape,
  duration: 0.8,
  stagger: 0.1,
  easing: { x1: 0.25, y1: 0, x2: 0.75, y2: 1 }
})

const someBase = (i: number): CardPlacement => ({
  ...restingPlacement(),
  x: i * 0.3,
  y: 1.2,
  z: -0.4,
  rotX: 0.1,
  rotY: 0.2 * i,
  rotZ: -0.3,
  scale: 1.1,
  opacity: 0.9,
  bend: 0.05
})

describe('entrance shapes', () => {
  it('hands every shape back to the settled placement at progress 1', () => {
    for (const { id } of ENTRANCE_SHAPES) {
      for (let i = 0; i < 5; i++) {
        const base = someBase(i)
        expect(applyEntrance(base, spec(id), 1, i, 5)).toEqual(base)
      }
    }
  })

  it('leaves a card in an unarrived state at progress 0', () => {
    for (const { id } of ENTRANCE_SHAPES) {
      const base = someBase(0)
      const start = applyEntrance(base, spec(id), 0, 0, 5)
      expect(start).not.toEqual(base)
      expect(start.opacity).toBeLessThan(base.opacity)
    }
  })

  it('produces only finite numbers across a sweep of progress, for any card count', () => {
    for (const { id } of ENTRANCE_SHAPES) {
      for (const count of [0, 1, 2, 40]) {
        for (let i = 0; i < count; i++) {
          for (const p of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
            const placement = applyEntrance(someBase(i), spec(id), p, i, count)
            for (const key of NUMERIC_FIELDS) expect(Number.isFinite(placement[key])).toBe(true)
          }
        }
      }
    }
  })

  it('shuffles fly-in from alternating sides rather than sliding every card the same way', () => {
    const base = someBase(0)
    const even = applyEntrance(base, spec('fly-in'), 0, 0, 10)
    const odd = applyEntrance(base, spec('fly-in'), 0, 1, 10)
    expect(Math.sign(even.x - base.x)).not.toBe(Math.sign(odd.x - base.x))
  })
})

describe('defaultEntrance', () => {
  it('is switched off so a piece works with no entrance configured', () => {
    expect(defaultEntrance('in').enabled).toBe(false)
    expect(defaultEntrance('out').enabled).toBe(false)
  })

  it('pairs a gentle ease-out for arriving with a gentle ease-in for leaving', () => {
    const inSpec = defaultEntrance('in')
    const outSpec = defaultEntrance('out')
    // An ease-out front-loads motion (x1 near 0); an ease-in holds back at the
    // start and rushes at the end (x2 near 1). That is the distinction we are
    // checking for, not exact numbers.
    expect(inSpec.easing.x1).toBeLessThan(inSpec.easing.x2)
    expect(outSpec.easing.x2).toBeGreaterThan(outSpec.easing.x1)
  })
})

describe('cardProgress', () => {
  it('is 0 before a card is due to start and 1 once it has finished', () => {
    const s = spec('fade')
    expect(cardProgress(s, -1, 2, 10)).toBe(0)
    expect(cardProgress(s, 0, 2, 10)).toBe(0)
    expect(cardProgress(s, 100, 2, 10)).toBe(1)
  })

  it('rises monotonically between a card\'s start and its finish', () => {
    const s = spec('fade')
    let last = -1
    for (let t = 0; t <= 2; t += 0.05) {
      const p = cardProgress(s, t, 3, 10)
      expect(p).toBeGreaterThanOrEqual(last)
      last = p
    }
  })

  it('has the last card finish exactly at totalDuration', () => {
    const s = spec('fade')
    const count = 10
    const finish = totalDuration(s, count)
    expect(cardProgress(s, finish, count - 1, count)).toBeCloseTo(1, 6)
    expect(cardProgress(s, finish - 1e-3, count - 1, count)).toBeLessThan(1)
  })

  it('moves every card together when stagger is zero', () => {
    const s = { ...spec('fade'), stagger: 0 }
    for (const t of [0, 0.2, 0.4, 0.8, 2]) {
      const progresses = [0, 1, 2, 3, 9].map((i) => cardProgress(s, t, i, 10))
      for (const p of progresses) expect(p).toBeCloseTo(progresses[0], 9)
    }
  })

  it('stays finite and clamped for degenerate inputs', () => {
    const s = spec('fade')
    expect(cardProgress(s, NaN, 2, 10)).toBe(1)
    expect(cardProgress(s, 1, -1, 10)).toBeGreaterThanOrEqual(0)
    expect(cardProgress(s, 1, 2, 0)).toBe(1)
    expect(cardProgress(s, 1, 2, 1)).toBeGreaterThanOrEqual(0)
  })
})

describe('totalDuration', () => {
  it('is duration plus stagger times the gaps between cards', () => {
    const s = spec('fade')
    expect(totalDuration(s, 5)).toBeCloseTo(s.duration + s.stagger * 4, 9)
  })

  it('is zero when the spec is disabled', () => {
    expect(totalDuration({ ...spec('fade'), enabled: false }, 5)).toBe(0)
  })

  it('is zero for an empty deck', () => {
    expect(totalDuration(spec('fade'), 0)).toBe(0)
  })
})

describe('placementsAt', () => {
  it('is exactly computePlacements when there is no animation running', () => {
    const doc = emptyDoc('ring')
    expect(placementsAt(doc, 0.4, null)).toEqual(computePlacements(doc, 0.4))
  })

  it('is unchanged from the idle placement when the switch is off', () => {
    const doc: MotionDoc = { ...emptyDoc('ring'), animation: defaultAnimation() }
    const idle = computePlacements(doc, 0.4)
    expect(placementsAt(doc, 0.4, { kind: 'in', elapsedSec: 0.1 })).toEqual(idle)
  })

  it('starts an entrance away from the idle placement and settles into it', () => {
    const base = { ...defaultAnimation(), componentIn: spec('rise') }
    const doc: MotionDoc = { ...emptyDoc('ring'), animation: base }
    const idle = computePlacements(doc, 0.4)
    const atStart = placementsAt(doc, 0.4, { kind: 'in', elapsedSec: 0 })
    const long = totalDuration(base.componentIn, idle.length)
    const atEnd = placementsAt(doc, 0.4, { kind: 'in', elapsedSec: long + 1 })
    expect(atStart).not.toEqual(idle)
    expect(atEnd).toEqual(idle)
  })

  it('starts an exit at the settled placement and moves away from it over time', () => {
    const base = { ...defaultAnimation(), componentOut: spec('fade') }
    const doc: MotionDoc = { ...emptyDoc('ring'), animation: base }
    const idle = computePlacements(doc, 0.4)
    const atStart = placementsAt(doc, 0.4, { kind: 'out', elapsedSec: 0 })
    expect(atStart).toEqual(idle)
    const long = totalDuration(base.componentOut, idle.length)
    const atEnd = placementsAt(doc, 0.4, { kind: 'out', elapsedSec: long })
    expect(atEnd[0].opacity).toBeLessThan(idle[0].opacity)
  })
})

describe('hydrateDoc animation repair', () => {
  it('fills in a missing animation with the defaults', () => {
    const doc = hydrateDoc({ version: 1, componentId: 'ring' })
    expect(doc.animation).toEqual(defaultAnimation())
  })

  it('repairs a corrupt animation rather than letting it through', () => {
    const doc = hydrateDoc({
      version: 1,
      componentId: 'ring',
      animation: {
        componentIn: { enabled: true, shape: 'not-a-shape', duration: '1s', stagger: 0.02 },
        replayEvery: -5
      }
    })
    expect(doc.animation.componentIn.enabled).toBe(true)
    expect(ENTRANCE_SHAPES.map((s) => s.id)).toContain(doc.animation.componentIn.shape)
    expect(Number.isFinite(doc.animation.componentIn.duration)).toBe(true)
    expect(doc.animation.componentIn.duration).toBeGreaterThan(0)
    expect(doc.animation.componentIn.easing).toEqual(defaultAnimation().componentIn.easing)
    expect(doc.animation.componentOut).toEqual(defaultAnimation().componentOut)
    expect(doc.animation.replayEvery).toBeGreaterThan(0)
    for (const p of computePlacements(doc, 0.3)) expect(Number.isFinite(p.x)).toBe(true)
  })

  it('keeps a well-formed stored animation as-is', () => {
    const stored = defaultAnimation()
    stored.componentIn.enabled = true
    stored.componentIn.shape = 'spiral'
    const doc = hydrateDoc({ version: 1, componentId: 'ring', animation: stored })
    expect(doc.animation.componentIn.enabled).toBe(true)
    expect(doc.animation.componentIn.shape).toBe('spiral')
  })
})

describe('A clip timeline', () => {
  const withAnim = (inOn: boolean, outOn: boolean): MotionDoc => {
    const doc = emptyDoc('carousel')
    doc.export = { ...doc.export, fps: 24, durationSec: 2 }
    doc.animation = {
      ...doc.animation,
      componentIn: { ...doc.animation.componentIn, enabled: inOn, duration: 0.8, stagger: 0.04 },
      componentOut: { ...doc.animation.componentOut, enabled: outOn, duration: 0.5, stagger: 0.02 }
    }
    return doc
  }

  it('is exactly one loop long when nothing enters or leaves', () => {
    const t = clipTimeline(withAnim(false, false), 10)
    expect(t.inSpan).toBe(0)
    expect(t.outSpan).toBe(0)
    expect(t.frames).toBe(48)
  })

  it('makes room for the entrance and the exit', () => {
    const t = clipTimeline(withAnim(true, true), 10)
    // 0.8 + 0.04 * 9 = 1.16 in, 0.5 + 0.02 * 9 = 0.68 out, plus a 2s loop.
    expect(t.inSpan).toBeCloseTo(1.16, 6)
    expect(t.outSpan).toBeCloseTo(0.68, 6)
    expect(t.frames).toBe(Math.round((1.16 + 2 + 0.68) * 24))
  })

  it('runs the entrance first, then nothing, then the exit', () => {
    const doc = withAnim(true, true)
    const t = clipTimeline(doc, 10)
    const kinds = new Set<string>()
    for (let k = 0; k < t.frames; k++) kinds.add(t.at(k).anim?.kind ?? 'settled')
    expect(kinds).toEqual(new Set(['in', 'settled', 'out']))

    expect(t.at(0).anim).toEqual({ kind: 'in', elapsedSec: 0 })
    const firstSettled = Math.ceil(t.inSpan * 24)
    expect(t.at(firstSettled).anim).toBeNull()
    expect(t.at(t.frames - 1).anim?.kind).toBe('out')
  })

  it('starts the loop at the moment the entrance hands over', () => {
    const t = clipTimeline(withAnim(true, false), 10)
    const handover = t.inSpan * 24
    expect(Number.isInteger(handover)).toBe(false)
    // Phase is measured from the handover, so a frame exactly one loop later
    // is back where the loop began.
    const k = Math.ceil(handover)
    const phase = t.at(k).phase
    expect(t.at(k + 48).phase).toBeCloseTo(phase, 6)
  })

  it('never renders phase 1, which is the same picture as phase 0', () => {
    const t = clipTimeline(withAnim(true, true), 10)
    for (let k = 0; k < t.frames; k++) {
      const p = t.at(k).phase
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThan(1)
    }
  })

  it('hands the exit an elapsed time that starts at zero', () => {
    const t = clipTimeline(withAnim(false, true), 10)
    const firstOut = Array.from({ length: t.frames }, (_, k) => t.at(k))
      .find((f) => f.anim?.kind === 'out')
    expect(firstOut?.anim?.elapsedSec).toBeCloseTo(0, 6)
  })
})
