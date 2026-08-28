import { describe, it, expect } from 'vitest'
import {
  sampleTrack, setKey, removeKey, moveKey, removeTrack, setMuted, setKeyEasing, setKeyValue,
  valueAt, isKeyed, keyedTargets, emptyKeyframes, type Track
} from '../../src/shared/motion/keyframes'
import { computePlacements, paramAffectsCount } from '../../src/shared/motion/frame'
import { emptyDoc, paramsFor } from '../../src/shared/motion/defaults'
import { componentFor } from '../../src/shared/motion/registry'
import { cubicBezier } from '../../src/shared/motion/math'
import type { MotionDoc } from '../../src/shared/motion/types'

const t = (keys: Array<{ t: number; v: number }>, muted?: boolean): Track => ({
  keys: keys.map((k, i) => ({ id: `k${i}`, ...k })),
  muted
})

describe('sampleTrack basics', () => {
  it('says nothing when it has nothing to say', () => {
    expect(sampleTrack(undefined, 0.5, 42)).toBe(42)
    expect(sampleTrack(t([]), 0.5, 42)).toBe(42)
  })

  it('holds a single key as a constant', () => {
    const track = t([{ t: 0.3, v: 7 }])
    for (const p of [0, 0.1, 0.3, 0.9, 1]) expect(sampleTrack(track, p, 42)).toBe(7)
  })

  it('lets a muted track fall back without losing its keys', () => {
    const track = t([{ t: 0, v: 0 }, { t: 0.5, v: 10 }], true)
    expect(sampleTrack(track, 0.5, 42)).toBe(42)
    expect(track.keys).toHaveLength(2)
  })

  it('lands exactly on each key at its own instant', () => {
    const track = t([{ t: 0, v: 0 }, { t: 0.25, v: 10 }, { t: 0.75, v: -4 }])
    expect(sampleTrack(track, 0, 99)).toBe(0)
    expect(sampleTrack(track, 0.25, 99)).toBe(10)
    expect(sampleTrack(track, 0.75, 99)).toBe(-4)
  })

  it('interpolates linearly between keys by default', () => {
    const track = t([{ t: 0, v: 0 }, { t: 1, v: 0 }, { t: 0.5, v: 10 }])
    expect(sampleTrack(track, 0.25, 0)).toBeCloseTo(5, 10)
  })

  it('reads keys in time order however they were stored', () => {
    const jumbled = t([{ t: 0.8, v: 8 }, { t: 0.2, v: 2 }, { t: 0.5, v: 5 }])
    expect(sampleTrack(jumbled, 0.2, 0)).toBe(2)
    expect(sampleTrack(jumbled, 0.35, 0)).toBeCloseTo(3.5, 10)
  })

  it('takes the later value when two keys share an instant', () => {
    const track: Track = { keys: [{ id: 'a', t: 0.5, v: 1 }, { id: 'b', t: 0.5, v: 9 }] }
    expect(Number.isFinite(sampleTrack(track, 0.5, 0))).toBe(true)
  })
})

// The reason this module exists. A Motion piece loops forever, so a track
// whose ends disagree would visibly jump once per loop. The segment after the
// last key runs back round to the first, which makes phase 0 and phase 1 the
// same instant on a ring rather than two ends of a line.
describe('sampleTrack closes the loop by construction', () => {
  it('gives the same value at both ends of the loop', () => {
    const cases: Track[] = [
      t([{ t: 0, v: 0 }, { t: 0.5, v: 10 }]),
      t([{ t: 0.2, v: -3 }, { t: 0.9, v: 40 }]),
      t([{ t: 0.1, v: 1 }, { t: 0.4, v: 2 }, { t: 0.6, v: 3 }, { t: 0.95, v: 4 }]),
      t([{ t: 0.5, v: 100 }]),
      t([{ t: 0, v: 5 }, { t: 1, v: 5 }])
    ]
    for (const track of cases) {
      expect(sampleTrack(track, 1, 0)).toBeCloseTo(sampleTrack(track, 0, 0), 12)
    }
  })

  it('closes even when the first and last key hold different values', () => {
    // Exactly the case a line-shaped track gets wrong: 0 at the start, 10 at
    // the end, and nothing to carry it back.
    const track = t([{ t: 0, v: 0 }, { t: 0.8, v: 10 }])
    expect(sampleTrack(track, 1, 0)).toBeCloseTo(0, 12)
    // Halfway back across the seam it is halfway between the two.
    expect(sampleTrack(track, 0.9, 0)).toBeCloseTo(5, 10)
  })

  it('runs the wrap segment continuously through the seam', () => {
    const track = t([{ t: 0.25, v: 0 }, { t: 0.75, v: 8 }])
    // Just before and just after the seam should be a hair apart, not 8 apart.
    const before = sampleTrack(track, 0.999, 0)
    const after = sampleTrack(track, 0.001, 0)
    expect(Math.abs(after - before)).toBeLessThan(0.05)
  })

  it('is continuous everywhere, including across the seam', () => {
    const track = t([{ t: 0.1, v: -2 }, { t: 0.45, v: 6 }, { t: 0.8, v: 1 }])
    let prev = sampleTrack(track, 0, 0)
    let worst = 0
    for (let i = 1; i <= 2000; i++) {
      const v = sampleTrack(track, i / 2000, 0)
      worst = Math.max(worst, Math.abs(v - prev))
      prev = v
    }
    // No step anywhere is more than a small fraction of the track's range.
    expect(worst).toBeLessThan(0.1)
  })

  it('treats phases outside 0–1 as the same ring', () => {
    const track = t([{ t: 0.2, v: 3 }, { t: 0.7, v: 9 }])
    expect(sampleTrack(track, 1.35, 0)).toBeCloseTo(sampleTrack(track, 0.35, 0), 12)
    expect(sampleTrack(track, -0.65, 0)).toBeCloseTo(sampleTrack(track, 0.35, 0), 12)
  })
})

describe('sampleTrack easing', () => {
  it('eases the segment that starts at the key carrying the curve', () => {
    const eased: Track = {
      keys: [
        { id: 'a', t: 0, v: 0, easing: { x1: 0.9, y1: 0, x2: 1, y2: 0.1 } },
        { id: 'b', t: 0.5, v: 10 }
      ]
    }
    const linear = t([{ t: 0, v: 0 }, { t: 0.5, v: 10 }])
    // A curve that loiters near zero should be well below the straight line.
    expect(sampleTrack(eased, 0.25, 0)).toBeLessThan(sampleTrack(linear, 0.25, 0) - 1)
  })

  it('still lands on its keys however it is eased', () => {
    const eased: Track = {
      keys: [
        { id: 'a', t: 0.1, v: 4, easing: { x1: 0.2, y1: 1.4, x2: 0.8, y2: -0.4 } },
        { id: 'b', t: 0.6, v: 20 }
      ]
    }
    expect(sampleTrack(eased, 0.1, 0)).toBeCloseTo(4, 8)
    expect(sampleTrack(eased, 0.6, 0)).toBeCloseTo(20, 8)
  })

  it('closes the loop even with easing on the wrap segment', () => {
    const eased: Track = {
      keys: [
        { id: 'a', t: 0.2, v: 1 },
        { id: 'b', t: 0.8, v: 9, easing: { x1: 0.4, y1: 0, x2: 0.6, y2: 1 } }
      ]
    }
    expect(sampleTrack(eased, 1, 0)).toBeCloseTo(sampleTrack(eased, 0, 0), 12)
  })
})

describe('editing tracks', () => {
  it('adds a key and reports the target as keyed', () => {
    const k = setKey(emptyKeyframes(), 'param:radius', 0.5, 3)
    expect(isKeyed(k, 'param:radius')).toBe(true)
    expect(keyedTargets(k)).toEqual(['param:radius'])
    expect(valueAt(k, 'param:radius', 0.5, 0)).toBe(3)
  })

  it('does not touch the document it was given', () => {
    const before = emptyKeyframes()
    setKey(before, 'param:radius', 0.5, 3)
    expect(keyedTargets(before)).toEqual([])
  })

  it('replaces rather than duplicates a key at the same instant', () => {
    let k = setKey(emptyKeyframes(), 'pose:tiltX', 0.25, 1)
    k = setKey(k, 'pose:tiltX', 0.25, 7)
    expect(k['pose:tiltX'].keys).toHaveLength(1)
    expect(k['pose:tiltX'].keys[0].v).toBe(7)
  })

  it('keeps keys sorted as they are added out of order', () => {
    let k = setKey(emptyKeyframes(), 'p', 0.9, 1)
    k = setKey(k, 'p', 0.1, 2)
    k = setKey(k, 'p', 0.5, 3)
    expect(k['p'].keys.map((x) => x.t)).toEqual([0.1, 0.5, 0.9])
  })

  it('wraps a key placed outside the loop back onto it', () => {
    const k = setKey(emptyKeyframes(), 'p', 1.25, 5)
    expect(k['p'].keys[0].t).toBeCloseTo(0.25, 10)
  })

  it('drops the track when its last key goes', () => {
    const k = setKey(emptyKeyframes(), 'p', 0.5, 1)
    const id = k['p'].keys[0].id
    expect(keyedTargets(removeKey(k, 'p', id))).toEqual([])
  })

  it('keeps the other keys when one goes', () => {
    let k = setKey(emptyKeyframes(), 'p', 0.2, 1)
    k = setKey(k, 'p', 0.7, 2)
    const id = k['p'].keys[0].id
    expect(removeKey(k, 'p', id)['p'].keys).toHaveLength(1)
  })

  it('re-sorts after a key is moved past its neighbour', () => {
    let k = setKey(emptyKeyframes(), 'p', 0.2, 1)
    k = setKey(k, 'p', 0.7, 2)
    const id = k['p'].keys[0].id
    const moved = moveKey(k, 'p', id, 0.95)
    expect(moved['p'].keys.map((x) => x.t)).toEqual([0.7, 0.95])
  })

  it('removes a whole track and mutes one without losing it', () => {
    let k = setKey(emptyKeyframes(), 'p', 0.5, 1)
    expect(keyedTargets(removeTrack(k, 'p'))).toEqual([])
    k = setMuted(k, 'p', true)
    expect(k['p'].muted).toBe(true)
    expect(valueAt(k, 'p', 0.5, 99)).toBe(99)
  })

  it('leaves an unkeyed target on its fallback', () => {
    const k = setKey(emptyKeyframes(), 'param:radius', 0.5, 3)
    expect(valueAt(k, 'param:cards', 0.5, 12)).toBe(12)
    expect(isKeyed(k, 'param:cards')).toBe(false)
  })
})

describe('keys are read at the loop position, not the eased one', () => {
  // A keyframe is the user pointing at a mark on the scrubber. The default
  // easing is strongly non-linear, so sampling tracks through it would put
  // the value somewhere other than where it was set — and would disagree with
  // pose tracks, which the engine reads at the raw phase.
  it('puts a keyed parameter at its keyed value at the phase it was keyed', () => {
    const doc = emptyDoc('carousel')
    const spec = componentFor('carousel').schema.find(
      (s) => s.kind === 'slider' && !paramAffectsCount(componentFor('carousel'), paramsFor(componentFor('carousel').schema, undefined), s.key)
    )
    expect(spec).toBeDefined()
    const key = spec!.key

    const eased = cubicBezier(doc.easing.x1, doc.easing.y1, doc.easing.x2, doc.easing.y2, 0.5)
    // Guard the premise: if the default easing were linear this test could
    // pass while the bug was present.
    expect(Math.abs(eased - 0.5)).toBeGreaterThan(0.05)

    const lo = 0.2
    const hi = 3.4
    const keyed: MotionDoc = {
      ...doc,
      keys: setKey(setKey(emptyKeyframes(), `param:${key}`, 0, lo), `param:${key}`, 0.5, hi)
    }

    const params = paramsFor(componentFor('carousel').schema, doc.params['carousel'])
    const fixed: MotionDoc = {
      ...doc,
      params: { ...doc.params, carousel: { ...params, [key]: hi } }
    }

    // At half way round, the keyed document must look exactly like one whose
    // slider is simply parked at the keyed value.
    expect(computePlacements(keyed, 0.5)).toEqual(computePlacements(fixed, 0.5))
  })
})

describe('shaping one segment', () => {
  const EASE_OUT = { x1: 0, y1: 0, x2: 0.58, y2: 1 }
  const built = (): ReturnType<typeof setKey> =>
    setKey(setKey(emptyKeyframes(), 'param:radius', 0, 0), 'param:radius', 0.5, 10)

  it('bends the segment it is set on and no other', () => {
    const keys = built()
    const eased = setKeyEasing(keys, 'param:radius', keys['param:radius'].keys[0].id, EASE_OUT)
    const flat = sampleTrack(keys['param:radius'], 0.25, 0)
    const bent = sampleTrack(eased['param:radius'], 0.25, 0)
    expect(bent).toBeGreaterThan(flat)
    // The segment on the other side of the second key is untouched.
    expect(sampleTrack(eased['param:radius'], 0.75, 0)).toBe(sampleTrack(keys['param:radius'], 0.75, 0))
  })

  it('clears back to a straight line rather than storing one', () => {
    const keys = built()
    const id = keys['param:radius'].keys[0].id
    const eased = setKeyEasing(keys, 'param:radius', id, EASE_OUT)
    const cleared = setKeyEasing(eased, 'param:radius', id, undefined)
    expect(cleared['param:radius'].keys[0]).not.toHaveProperty('easing')
    expect(cleared).toEqual(keys)
  })

  it('leaves a track it does not have alone', () => {
    const keys = built()
    expect(setKeyEasing(keys, 'param:nothing', 'k1', EASE_OUT)).toBe(keys)
    expect(setKeyEasing(keys, 'param:radius', 'no-such-key', EASE_OUT)).toEqual(keys)
  })
})

describe('setKeyValue', () => {
  it('changes what a key holds and leaves it where it is', () => {
    let k = setKey(emptyKeyframes(), 'param:speed', 0.25, 1)
    const id = k['param:speed'].keys[0].id
    k = setKeyValue(k, 'param:speed', id, 7)
    expect(k['param:speed'].keys[0].v).toBe(7)
    expect(k['param:speed'].keys[0].t).toBe(0.25)
  })

  it('keeps the easing that was already on the key', () => {
    let k = setKey(emptyKeyframes(), 'param:speed', 0.5, 1)
    const id = k['param:speed'].keys[0].id
    k = setKeyEasing(k, 'param:speed', id, { x1: 0.2, y1: 0, x2: 0.4, y2: 1 })
    k = setKeyValue(k, 'param:speed', id, 3)
    expect(k['param:speed'].keys[0].easing).toEqual({ x1: 0.2, y1: 0, x2: 0.4, y2: 1 })
  })

  it('refuses a value that is not a number, rather than poisoning the track', () => {
    const k = setKey(emptyKeyframes(), 'param:speed', 0.5, 1)
    const id = k['param:speed'].keys[0].id
    expect(setKeyValue(k, 'param:speed', id, Number.NaN)).toBe(k)
    expect(setKeyValue(k, 'param:speed', id, Number.POSITIVE_INFINITY)).toBe(k)
  })

  it('does nothing on a track that is not there', () => {
    const k = emptyKeyframes()
    expect(setKeyValue(k, 'param:speed', 'nope', 3)).toBe(k)
  })
})
