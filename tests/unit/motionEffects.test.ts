import { describe, it, expect } from 'vitest'
import { effectsAreNeutral, beforeCardsFilter, drawEffects } from '../../src/renderer/src/lib/motion/effects'
import { defaultEffects } from '../../src/shared/motion/defaults'
import type { EffectsState } from '../../src/shared/motion/types'

// jsdom has no working 2D canvas (getContext('2d') returns null without the
// optional `canvas` package), and the unit suite runs under plain node
// besides, so effects.ts is exercised against a hand-written stand-in for
// CanvasRenderingContext2D that records everything called on it. It carries
// its own pixel buffer so drawGrain's read-modify-write round trip has
// something real to work against.
class FakeGradient {
  stops: Array<{ offset: number; color: string }> = []
  addColorStop(offset: number, color: string): void {
    this.stops.push({ offset, color })
  }
}

class FakeCtx {
  calls: string[] = []
  globalAlpha = 1
  globalCompositeOperation = 'source-over'
  filter = 'none'
  fillStyle: string | FakeGradient = '#000000'
  private readonly pixels: Uint8ClampedArray

  constructor(private readonly width: number, private readonly height: number) {
    this.pixels = new Uint8ClampedArray(Math.max(0, width) * Math.max(0, height) * 4)
    for (let i = 0; i < this.pixels.length; i += 4) {
      this.pixels[i] = 100
      this.pixels[i + 1] = 100
      this.pixels[i + 2] = 100
      this.pixels[i + 3] = 255
    }
  }

  save(): void {
    this.calls.push('save')
  }

  restore(): void {
    this.calls.push('restore')
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.calls.push(`fillRect ${x},${y},${w},${h}`)
  }

  createLinearGradient(x0: number, y0: number, x1: number, y1: number): FakeGradient {
    this.calls.push(`linearGradient ${x0},${y0},${x1},${y1}`)
    return new FakeGradient()
  }

  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): FakeGradient {
    this.calls.push(`radialGradient ${x0},${y0},${r0},${x1},${y1},${r1}`)
    return new FakeGradient()
  }

  getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray; width: number; height: number } {
    this.calls.push(`getImageData ${w}x${h}`)
    return { data: this.pixels.slice(0), width: w, height: h }
  }

  putImageData(frame: { data: Uint8ClampedArray }): void {
    this.calls.push('putImageData')
    this.pixels.set(frame.data)
  }

  snapshot(): Uint8ClampedArray {
    return this.pixels.slice(0)
  }
}

function ctxFor(width: number, height: number): CanvasRenderingContext2D {
  return new FakeCtx(width, height) as unknown as CanvasRenderingContext2D
}

describe('effectsAreNeutral', () => {
  it('is true for the default, neutral state', () => {
    expect(effectsAreNeutral(defaultEffects())).toBe(true)
  })

  const cases: Array<[keyof EffectsState, unknown]> = [
    ['blur', 8],
    ['grain', 20],
    ['vignette', 30],
    ['shadow', 40],
    ['brightness', 120],
    ['contrast', 80],
    ['saturation', 150]
  ]

  for (const [key, value] of cases) {
    it(`is false once ${key} moves off its neutral value`, () => {
      const fx = { ...defaultEffects(), [key]: value }
      expect(effectsAreNeutral(fx)).toBe(false)
    })
  }

  it('is false once tintAmount moves off zero', () => {
    expect(effectsAreNeutral({ ...defaultEffects(), tintAmount: 25 })).toBe(false)
  })

  it('stays true for a tint colour on its own, since a zero amount paints nothing', () => {
    expect(effectsAreNeutral({ ...defaultEffects(), tint: '#ff0000' })).toBe(true)
  })
})

describe('beforeCardsFilter', () => {
  it('returns none for a neutral state', () => {
    expect(beforeCardsFilter(defaultEffects(), 1080)).toBe('none')
  })

  it('includes blur, scaled to the frame height', () => {
    const fx = { ...defaultEffects(), blur: 10 }
    expect(beforeCardsFilter(fx, 1080)).toBe('blur(10.00px)')
    // Twice the reference height means twice the blur radius, so a 4K export
    // reads the same as the 1080p screen rather than looking sharper.
    expect(beforeCardsFilter(fx, 2160)).toBe('blur(20.00px)')
    expect(beforeCardsFilter(fx, 540)).toBe('blur(5.00px)')
  })

  it('includes brightness, contrast and saturate only when each differs from neutral', () => {
    expect(beforeCardsFilter({ ...defaultEffects(), brightness: 120 }, 1080)).toBe('brightness(120%)')
    expect(beforeCardsFilter({ ...defaultEffects(), contrast: 80 }, 1080)).toBe('contrast(80%)')
    expect(beforeCardsFilter({ ...defaultEffects(), saturation: 150 }, 1080)).toBe('saturate(150%)')
  })

  it('composes every non-neutral part together in a stable order', () => {
    const fx = { ...defaultEffects(), blur: 4, brightness: 110, contrast: 90, saturation: 70 }
    expect(beforeCardsFilter(fx, 1080)).toBe('blur(4.00px) brightness(110%) contrast(90%) saturate(70%)')
  })

  it('does not blow up on a zero or negative height', () => {
    expect(() => beforeCardsFilter({ ...defaultEffects(), blur: 5 }, 0)).not.toThrow()
    expect(() => beforeCardsFilter({ ...defaultEffects(), blur: 5 }, -100)).not.toThrow()
  })
})

describe('drawEffects', () => {
  it('draws nothing against a neutral state', () => {
    const ctx = new FakeCtx(400, 300)
    drawEffects(ctx as unknown as CanvasRenderingContext2D, defaultEffects(), 400, 300)
    expect(ctx.calls).toEqual([])
  })

  it('restores globalAlpha, globalCompositeOperation and filter after drawing', () => {
    const ctx = new FakeCtx(400, 300)
    ctx.globalAlpha = 0.42
    ctx.globalCompositeOperation = 'multiply'
    ctx.filter = 'blur(3px)'
    const fx: EffectsState = { ...defaultEffects(), tint: '#ff0000', tintAmount: 50, vignette: 30, shadow: 20, grain: 10 }
    drawEffects(ctx as unknown as CanvasRenderingContext2D, fx, 400, 300)
    expect(ctx.globalAlpha).toBe(0.42)
    expect(ctx.globalCompositeOperation).toBe('multiply')
    expect(ctx.filter).toBe('blur(3px)')
  })

  it('draws tint, vignette and shadow with fillRect and gradients when each is turned on alone', () => {
    const tintOnly = new FakeCtx(200, 100)
    drawEffects(tintOnly as unknown as CanvasRenderingContext2D, { ...defaultEffects(), tintAmount: 40 }, 200, 100)
    expect(tintOnly.calls.some((c) => c.startsWith('fillRect'))).toBe(true)

    const vignetteOnly = new FakeCtx(200, 100)
    drawEffects(vignetteOnly as unknown as CanvasRenderingContext2D, { ...defaultEffects(), vignette: 60 }, 200, 100)
    expect(vignetteOnly.calls.some((c) => c.startsWith('radialGradient'))).toBe(true)

    const shadowOnly = new FakeCtx(200, 100)
    drawEffects(shadowOnly as unknown as CanvasRenderingContext2D, { ...defaultEffects(), shadow: 60 }, 200, 100)
    expect(shadowOnly.calls.some((c) => c.startsWith('linearGradient'))).toBe(true)
  })

  it('produces an identical call record and pixel result for the same grain input, twice over', () => {
    const fx: EffectsState = { ...defaultEffects(), grain: 35 }
    const a = new FakeCtx(64, 48)
    const b = new FakeCtx(64, 48)
    drawEffects(a as unknown as CanvasRenderingContext2D, fx, 64, 48)
    drawEffects(b as unknown as CanvasRenderingContext2D, fx, 64, 48)
    expect(a.calls).toEqual(b.calls)
    expect(Array.from(a.snapshot())).toEqual(Array.from(b.snapshot()))
  })

  it('actually perturbs the frame pixels when grain is on', () => {
    const ctx = new FakeCtx(64, 48)
    const before = ctx.snapshot()
    drawEffects(ctx as unknown as CanvasRenderingContext2D, { ...defaultEffects(), grain: 50 }, 64, 48)
    expect(Array.from(ctx.snapshot())).not.toEqual(Array.from(before))
  })

  it('does not throw for zero width, zero height or extreme parameters', () => {
    const fx: EffectsState = {
      blur: 1000,
      grain: 500,
      vignette: -50,
      shadow: 99999,
      brightness: -10,
      contrast: 10000,
      saturation: 0,
      tint: '#123456',
      tintAmount: 1000
    }
    expect(() => drawEffects(ctxFor(0, 100), fx, 0, 100)).not.toThrow()
    expect(() => drawEffects(ctxFor(100, 0), fx, 100, 0)).not.toThrow()
    expect(() => drawEffects(ctxFor(-10, -10), fx, -10, -10)).not.toThrow()
    expect(() => drawEffects(ctxFor(50, 50), fx, 50, 50)).not.toThrow()
  })
})
