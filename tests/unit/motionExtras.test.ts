import { describe, it, expect } from 'vitest'
import { springFn, isSpring, springParams, easingFn } from '../../src/renderer/src/lib/easing'
import { ANIMATION_PRESETS, PRESET_GROUPS } from '../../src/renderer/src/lib/animationPresets'
import { frameSvg } from '../../src/renderer/src/lib/svgExport'
import { makeObject, type FObj } from '../../src/renderer/src/lib/freeformTypes'
import { newKeyId } from '../../src/renderer/src/lib/timelineModel'

describe('springFn', () => {
  it('starts at 0 and settles near 1', () => {
    const f = springFn(0.5, 12)
    expect(f(0)).toBeCloseTo(0, 2)
    expect(f(1)).toBeGreaterThan(0.9)
    expect(f(1)).toBeLessThan(1.1)
  })
  it('overshoots past 1 for a bouncy spring', () => {
    const f = springFn(0.7, 12)
    let max = 0
    for (let i = 0; i <= 100; i++) max = Math.max(max, f(i / 100))
    expect(max).toBeGreaterThan(1)
  })
  it('is detected and parsed from a spring(...) string', () => {
    expect(isSpring('spring(0.5,12)')).toBe(true)
    expect(isSpring('cubic-bezier(0,0,1,1)')).toBe(false)
    const p = springParams('spring(0.6,10)')
    expect(p.bounce).toBeCloseTo(0.6)
    expect(p.freq).toBeCloseTo(10)
    expect(typeof easingFn('spring(0.5,12)')).toBe('function')
  })
})

describe('animation presets', () => {
  it('every preset builds a motion with at least one track and the given duration', () => {
    for (const p of ANIMATION_PRESETS) {
      const motion = p.build(1000)
      expect(motion.duration).toBe(1000)
      const tracks = Object.values(motion.tracks).filter(Boolean)
      expect(tracks.length).toBeGreaterThan(0)
      for (const tr of tracks) expect(tr!.length).toBeGreaterThanOrEqual(2)
      expect(PRESET_GROUPS).toContain(p.group)
    }
  })
  it('entrance presets resolve toward rest (opacity ends at 1 when animated)', () => {
    const fade = ANIMATION_PRESETS.find((p) => p.id === 'fade-up')!.build(800)
    const op = fade.tracks.opacity!
    expect(op[op.length - 1].v).toBe(1)
  })
})

describe('frameSvg', () => {
  const art = { w: 200, h: 200, bg: '#000000' }
  it('returns the static svg when the object has no keys', () => {
    const o = makeObject('rect', 10, 10)
    const svg = frameSvg(art, [o], 500)
    expect(svg).toContain('<svg')
    expect(svg).toContain('<rect')
  })
  it('moves an object according to its position track at time t', () => {
    const base: FObj = { ...makeObject('rect', 0, 0, ), w: 40, h: 40 }
    base.motion = { duration: 1000, tracks: { x: [{ id: newKeyId(), t: 0, v: 0 }, { id: newKeyId(), t: 1000, v: 100 }] } }
    const mid = frameSvg(art, [base], 500)
    // halfway the x offset should be ~50 -> rect x near 50 (skip the bg rect at x=0)
    const xs = [...mid.matchAll(/<rect x="([0-9.]+)"/g)].map((mm) => Number(mm[1]))
    const objX = xs[xs.length - 1]
    expect(objX).toBeGreaterThan(40)
    expect(objX).toBeLessThan(60)
  })
})
