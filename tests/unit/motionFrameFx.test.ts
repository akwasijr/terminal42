import { describe, it, expect } from 'vitest'
import {
  anyEdge,
  dropShadowActive,
  edgeBlurActive,
  edgeShadeActive,
  glassActive,
  needsPixelPass,
  shadeColour,
  shadowOffset
} from '../../src/renderer/src/lib/motion/frameFx'
import { defaultEffects, emptyDoc, hydrateDoc } from '../../src/shared/motion/defaults'
import type { EdgeAmounts, EffectsState } from '../../src/shared/motion/types'

const all = (n: number): EdgeAmounts => ({ top: n, bottom: n, left: n, right: n })

/** An effects state with one group turned up, everything else at its default. */
function withFx(patch: Partial<EffectsState>): EffectsState {
  return { ...defaultEffects(), ...patch }
}

describe('edge amounts', () => {
  it('is inactive only when every edge is zero', () => {
    expect(anyEdge(all(0))).toBe(false)
    expect(anyEdge({ ...all(0), top: 1 })).toBe(true)
    expect(anyEdge({ ...all(0), bottom: 1 })).toBe(true)
    expect(anyEdge({ ...all(0), left: 1 })).toBe(true)
    expect(anyEdge({ ...all(0), right: 1 })).toBe(true)
  })
})

describe('what counts as switched on', () => {
  const d = defaultEffects()

  it('leaves every group off by default', () => {
    expect(dropShadowActive(d.dropShadow)).toBe(false)
    expect(edgeBlurActive(d.edgeBlur)).toBe(false)
    expect(edgeShadeActive(d.edgeShade)).toBe(false)
    expect(glassActive(d.glass)).toBe(false)
  })

  it('ignores a shadow with no density', () => {
    expect(dropShadowActive({ ...d.dropShadow, enabled: true, density: 0 })).toBe(false)
    expect(dropShadowActive({ ...d.dropShadow, enabled: true, density: 1 })).toBe(true)
  })

  it('ignores a shadow that is switched off however it is set', () => {
    expect(dropShadowActive({ ...d.dropShadow, enabled: false, density: 100, blur: 20 })).toBe(false)
  })

  it('needs both an amount and an edge before blurring', () => {
    const on = { ...d.edgeBlur, enabled: true }
    expect(edgeBlurActive({ ...on, amount: 0, edges: all(50) })).toBe(false)
    expect(edgeBlurActive({ ...on, amount: 5, edges: all(0) })).toBe(false)
    expect(edgeBlurActive({ ...on, amount: 5, edges: all(50) })).toBe(true)
  })

  it('shades whenever an edge reaches in, at any softness', () => {
    const on = { ...d.edgeShade, enabled: true }
    expect(edgeShadeActive({ ...on, edges: all(0) })).toBe(false)
    expect(edgeShadeActive({ ...on, edges: all(30), softness: 0 })).toBe(true)
  })

  it('needs width and refraction before glass does anything', () => {
    const on = { ...d.glass, enabled: true }
    expect(glassActive({ ...on, width: 0, refraction: 50 })).toBe(false)
    expect(glassActive({ ...on, width: 10, refraction: 0 })).toBe(false)
    expect(glassActive({ ...on, width: 10, refraction: 50, edges: 'all' })).toBe(true)
  })

  it('lets per-edge glass be switched on with every edge at zero', () => {
    const on = { ...d.glass, enabled: true, width: 10, refraction: 50, edges: 'per-edge' as const }
    expect(glassActive({ ...on, per: all(0) })).toBe(false)
    expect(glassActive({ ...on, per: { ...all(0), left: 40 } })).toBe(true)
  })
})

describe('deciding to composite', () => {
  // The screen picks the cheap three-canvas path whenever this is false, so a
  // disagreement here is an effect that silently does nothing.
  it('stays on the cheap path for a piece with no pixel effects', () => {
    expect(needsPixelPass(defaultEffects())).toBe(false)
  })

  it('stays on the cheap path for the flat effects, however strong', () => {
    expect(
      needsPixelPass(
        withFx({ blur: 40, grain: 100, vignette: 100, shadow: 100, tintAmount: 100, saturation: 0 })
      )
    ).toBe(false)
  })

  const d = defaultEffects()
  const cases: Array<[string, EffectsState]> = [
    ['shadow', withFx({ dropShadow: { ...d.dropShadow, enabled: true, density: 60 } })],
    ['edge blur', withFx({ edgeBlur: { ...d.edgeBlur, enabled: true, amount: 8, edges: all(40) } })],
    ['edge shade', withFx({ edgeShade: { ...d.edgeShade, enabled: true, edges: all(40) } })],
    ['glass', withFx({ glass: { ...d.glass, enabled: true, width: 8, refraction: 60 } })]
  ]

  for (const [name, fx] of cases) {
    it(`switches to the pixel pass for ${name}`, () => {
      expect(needsPixelPass(fx)).toBe(true)
    })
  }

  it('agrees with the four checks on every combination', () => {
    for (let bits = 0; bits < 16; bits += 1) {
      const fx = withFx({
        dropShadow: { ...d.dropShadow, enabled: (bits & 1) !== 0, density: 60 },
        edgeBlur: { ...d.edgeBlur, enabled: (bits & 2) !== 0, amount: 8, edges: all(40) },
        edgeShade: { ...d.edgeShade, enabled: (bits & 4) !== 0, edges: all(40) },
        glass: { ...d.glass, enabled: (bits & 8) !== 0, width: 8, refraction: 60 }
      })
      expect(needsPixelPass(fx)).toBe(bits !== 0)
    }
  })
})

describe('shade colour', () => {
  const d = defaultEffects()

  it('follows the mode while the colour is still black or white', () => {
    expect(shadeColour({ ...d.edgeShade, mode: 'dark', colour: '#000000' })).toBe('#000000')
    expect(shadeColour({ ...d.edgeShade, mode: 'light', colour: '#000000' })).toBe('#ffffff')
    expect(shadeColour({ ...d.edgeShade, mode: 'dark', colour: '#ffffff' })).toBe('#000000')
  })

  it('keeps a colour that was actually chosen', () => {
    expect(shadeColour({ ...d.edgeShade, mode: 'dark', colour: '#3b6ea5' })).toBe('#3b6ea5')
    expect(shadeColour({ ...d.edgeShade, mode: 'light', colour: '#3b6ea5' })).toBe('#3b6ea5')
  })
})

describe('opening a piece', () => {
  it('gives the four groups to a piece saved before they existed', () => {
    const old = emptyDoc('card-shuffle') as unknown as Record<string, unknown>
    const visual = old.visual as Record<string, unknown>
    const fx = { ...(visual.effects as object) } as Record<string, unknown>
    delete fx.dropShadow
    delete fx.edgeBlur
    delete fx.edgeShade
    delete fx.glass
    old.visual = { ...visual, effects: fx }

    const doc = hydrateDoc(old)
    expect(doc.visual.effects.dropShadow.enabled).toBe(false)
    expect(doc.visual.effects.edgeBlur.enabled).toBe(false)
    expect(doc.visual.effects.edgeShade.enabled).toBe(false)
    expect(doc.visual.effects.glass.enabled).toBe(false)
    expect(needsPixelPass(doc.visual.effects)).toBe(false)
  })

  it('keeps the four groups through a round trip', () => {
    const doc = emptyDoc('card-shuffle')
    doc.visual.effects.dropShadow = { enabled: true, angle: 135, distance: 12, blur: 20, density: 70, colour: '#101010' }
    doc.visual.effects.edgeBlur = { enabled: true, falloff: 'soft', edges: { top: 60, bottom: 10, left: 0, right: 30 }, amount: 9, softness: 40, over: 'everything' }
    doc.visual.effects.edgeShade = { enabled: true, mode: 'light', colour: '#f0e6d2', falloff: 'linear', edges: all(45), softness: 65, over: 'component' }
    doc.visual.effects.glass = { enabled: true, edges: 'per-edge', per: { top: 0, bottom: 80, left: 20, right: 20 }, width: 14, refraction: 55, curve: 2.4 }

    const back = hydrateDoc(JSON.parse(JSON.stringify(doc)))
    expect(back.visual.effects).toEqual(doc.visual.effects)
  })

  it('replaces nonsense with the default rather than passing it on', () => {
    const doc = emptyDoc('card-shuffle') as unknown as Record<string, unknown>
    const visual = doc.visual as Record<string, unknown>
    visual.effects = {
      ...(visual.effects as object),
      dropShadow: { enabled: 'yes', angle: 'north', distance: null, blur: [], density: {}, colour: 12 },
      glass: { enabled: true, edges: 'sideways', per: 'lots', width: 'wide', refraction: NaN, curve: -3 }
    }

    const back = hydrateDoc(doc)
    const d = defaultEffects()
    expect(back.visual.effects.dropShadow).toEqual(d.dropShadow)
    expect(back.visual.effects.glass.edges).toBe(d.glass.edges)
    expect(Number.isFinite(back.visual.effects.glass.refraction)).toBe(true)
    expect(back.visual.effects.glass.curve).toBeGreaterThanOrEqual(1)
  })
})

describe('where the shadow falls', () => {
  const base = { ...defaultEffects().dropShadow, enabled: true, distance: 100 }
  const at = (angle: number): { x: number; y: number } => {
    const o = shadowOffset({ ...base, angle }, 1000, 1000)
    return { x: Math.round(o.x), y: Math.round(o.y) }
  }

  // Zero is straight down because that is where a light overhead puts it,
  // and a canvas counts y downwards, so down is a positive number.
  it('puts a shadow below the component at zero', () => {
    const o = at(0)
    expect(o.x).toBe(0)
    expect(o.y).toBeGreaterThan(0)
  })

  it('turns clockwise: down, then left, then up, then right', () => {
    expect(at(90).x).toBeLessThan(0)
    expect(Math.abs(at(90).y)).toBe(0)
    expect(at(180).y).toBeLessThan(0)
    expect(at(270).x).toBeGreaterThan(0)
  })

  it('goes nowhere at no distance', () => {
    const o = shadowOffset({ ...base, distance: 0, angle: 45 }, 1000, 1000)
    expect(o.x).toBeCloseTo(0, 10)
    expect(o.y).toBeCloseTo(0, 10)
  })

  it('scales with the short side, so a resize does not move it', () => {
    const wide = shadowOffset(base, 4000, 1000)
    const square = shadowOffset(base, 1000, 1000)
    expect(wide.y).toBeCloseTo(square.y, 6)
  })
})
