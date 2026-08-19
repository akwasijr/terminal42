import { describe, it, expect } from 'vitest'
import {
  type LayerMotion,
  baseState,
  sampleTrack,
  sampleLayer,
  styleAt,
  layerToCss,
  setKey,
  removeKey,
  emptyMotion,
  hasAnyKeys,
} from '../../src/renderer/src/lib/timelineModel'

describe('sampleTrack', () => {
  it('returns the default for an empty track', () => {
    expect(sampleTrack(undefined, 100, 5)).toBe(5)
    expect(sampleTrack([], 100, 5)).toBe(5)
  })
  it('holds before first and after last keyframe', () => {
    const keys = [{ id: 'a', t: 100, v: 10 }, { id: 'b', t: 300, v: 30 }]
    expect(sampleTrack(keys, 0, 0)).toBe(10)
    expect(sampleTrack(keys, 500, 0)).toBe(30)
  })
  it('linearly interpolates with linear easing', () => {
    const keys = [{ id: 'a', t: 0, v: 0, easing: 'linear' }, { id: 'b', t: 100, v: 100 }]
    expect(sampleTrack(keys, 50, 0)).toBeCloseTo(50, 5)
  })
})

describe('sampleLayer', () => {
  it('uses base values for untracked properties', () => {
    const m: LayerMotion = { duration: 1000, tracks: { opacity: [{ id: 'a', t: 0, v: 0 }, { id: 'b', t: 1000, v: 1 }] } }
    const s = sampleLayer(m, 500, baseState({ rotate: 45 }))
    expect(s.rotate).toBe(45) // untracked → base
    expect(s.opacity).toBeCloseTo(0.5, 1)
  })
})

describe('styleAt', () => {
  it('builds transform + opacity + filter, omitting filter when no effects', () => {
    const m: LayerMotion = { duration: 1000, tracks: { y: [{ id: 'a', t: 0, v: 20, easing: 'linear' }, { id: 'b', t: 1000, v: 0 }] } }
    const st = styleAt(m, 500, baseState(), '#fff')
    expect(st.transform).toContain('translate3d(0px, 10px, 0)')
    expect(st.filter).toBe('')
  })
  it('emits a filter when an effect track is present', () => {
    const m: LayerMotion = { duration: 1000, tracks: { blur: [{ id: 'a', t: 0, v: 0, easing: 'linear' }, { id: 'b', t: 1000, v: 10 }] } }
    const st = styleAt(m, 1000, baseState(), '#00f')
    expect(st.filter).toContain('blur(10px)')
    expect(st.filter).toContain('drop-shadow')
  })
})

describe('layerToCss', () => {
  const m: LayerMotion = { duration: 600, tracks: { opacity: [{ id: 'a', t: 0, v: 0, easing: 'linear' }, { id: 'b', t: 600, v: 1 }] } }
  it('emits a named keyframes block + animation rule + reduced-motion guard', () => {
    const css = layerToCss('#x', 'lm1', m, baseState(), '#fff', { playback: 'once' })
    expect(css).toContain('@keyframes lm1')
    expect(css).toContain('#x { animation: lm1 600ms linear both')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('0% {')
    expect(css).toContain('100% {')
  })
  it('preserves a static rotation in every frame via the base state', () => {
    const css = layerToCss('#x', 'lm', emptyMotion(500), baseState({ rotate: 30 }), '#fff')
    // even with no tracks we emit start/end frames carrying the static rotation
    expect(css).toContain('rotate(30deg)')
  })
})

describe('setKey / removeKey / hasAnyKeys', () => {
  it('adds, replaces and removes keys', () => {
    let m = emptyMotion(1000)
    expect(hasAnyKeys(m)).toBe(false)
    m = setKey(m, 'x', 0, 0)
    m = setKey(m, 'x', 1000, 200)
    expect(m.tracks.x).toHaveLength(2)
    expect(hasAnyKeys(m)).toBe(true)
    // replace at same time
    m = setKey(m, 'x', 0, 50)
    expect(m.tracks.x).toHaveLength(2)
    expect(m.tracks.x!.find((k) => k.t === 0)!.v).toBe(50)
    const id = m.tracks.x![0].id
    m = removeKey(m, 'x', id)
    expect(m.tracks.x).toHaveLength(1)
  })
})
