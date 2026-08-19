import { describe, it, expect } from 'vitest'
import { generateMotionCss, generateKeyframes, defaultKeyframes } from '../../src/renderer/src/lib/motionCss'

const spec = {
  name: 't42motion',
  duration: 600,
  easing: 'cubic-bezier(.22,1,.36,1)',
  keyframes: defaultKeyframes(),
}

describe('motionCss', () => {
  it('emits a named @keyframes block with sorted frames', () => {
    const kf = generateKeyframes({ ...spec, keyframes: [
      { id: 'b', t: 100, x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 },
      { id: 'a', t: 0, x: 0, y: 24, scale: 1, rotate: 0, opacity: 0 },
    ] })
    expect(kf).toContain('@keyframes t42motion')
    // 0% must come before 100%
    expect(kf.indexOf('0%')).toBeLessThan(kf.indexOf('100%'))
    expect(kf).toContain('opacity: 0')
    expect(kf).toContain('translate3d(0px, 24px, 0)')
  })

  it('emits the animation rule on the selector with duration + easing', () => {
    const css = generateMotionCss('.hero h1', spec)
    expect(css).toContain('.hero h1 { animation: t42motion 600ms cubic-bezier(.22,1,.36,1) both')
  })

  it('always includes a reduced-motion guard', () => {
    const css = generateMotionCss('#x', spec)
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('#x { animation: none; }')
  })

  it('clamps opacity and timeline position', () => {
    const css = generateKeyframes({ ...spec, keyframes: [
      { id: 'a', t: -10, x: 0, y: 0, scale: 1, rotate: 0, opacity: 2 },
      { id: 'b', t: 250, x: 0, y: 0, scale: 1, rotate: 0, opacity: -1 },
    ] })
    expect(css).toContain('0%')
    expect(css).toContain('100%')
    expect(css).toContain('opacity: 1')
    expect(css).toContain('opacity: 0')
  })

  it('emits per-segment easing via animation-timing-function on the start keyframe only', () => {
    const css = generateKeyframes({ ...spec, keyframes: [
      { id: 'a', t: 0, x: 0, y: 0, scale: 1, rotate: 0, opacity: 0, easing: 'ease-in' },
      { id: 'b', t: 50, x: 0, y: 0, scale: 1, rotate: 0, opacity: 1, easing: 'cubic-bezier(0.34,1.56,0.64,1)' },
      { id: 'c', t: 100, x: 0, y: 0, scale: 1, rotate: 0, opacity: 1, easing: 'linear' },
    ] })
    expect(css).toContain('animation-timing-function: ease-in')
    expect(css).toContain('animation-timing-function: cubic-bezier(0.34,1.56,0.64,1)')
    // the final keyframe has no outgoing segment, so its easing is not emitted
    expect(css).not.toContain('animation-timing-function: linear')
  })

  it('omits per-keyframe easing when none is set (backward compatible)', () => {
    const css = generateKeyframes(spec)
    expect(css).not.toContain('animation-timing-function')
  })
})
