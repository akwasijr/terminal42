import { describe, it, expect } from 'vitest'
import { ramp, prefersLightText, studioFromFeel, type Feel } from '../../src/shared/tokens/scaffold'
import { problems, flatten, resolve } from '../../src/shared/tokens/resolve'
import { isAlias } from '../../src/shared/tokens/types'
import { toCSS, toDTCG } from '../../src/shared/tokens/export'

const FEEL: Feel = {
  name: 'Test',
  primary: '#4338ca',
  secondary: '#0a2540',
  tertiary: '#06b6d4',
  headingFont: 'Space Grotesk',
  bodyFont: 'Inter',
  corner: 'rounded',
  density: 'comfortable',
  scale: 'balanced',
  elevation: 'subtle'
}

describe('ramp', () => {
  it('passes exactly through the colour it was given', () => {
    expect(ramp('#4338ca')[600]).toBe('#4338ca')
  })

  it('runs light to dark without going backwards', () => {
    const r = ramp('#4338ca')
    const lum = (hex: string): number =>
      [1, 3, 5].reduce((n, i) => n + parseInt(hex.slice(i, i + 2), 16), 0)
    const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
    for (let i = 1; i < steps.length; i++) {
      expect(lum(r[steps[i]])).toBeLessThan(lum(r[steps[i - 1]]))
    }
  })

  it('copes with a three character hex', () => {
    expect(ramp('#abc')[600]).toBe('#aabbcc')
  })

  it('is the same every time', () => {
    expect(ramp('#16a34a')).toEqual(ramp('#16a34a'))
  })
})

describe('prefersLightText', () => {
  it('says light on a dark colour and dark on a light one', () => {
    expect(prefersLightText('#09090b')).toBe(true)
    expect(prefersLightText('#ffffff')).toBe(false)
  })
})

describe('studioFromFeel', () => {
  const studio = studioFromFeel('Test', FEEL)

  it('builds four sets and two themes', () => {
    expect(studio.sets.map((s) => s.name)).toEqual(['Palette', 'Light', 'Dark', 'Parts'])
    expect(studio.themes.map((t) => t.name)).toEqual(['Light', 'Dark'])
  })

  it('leaves nothing wrong in either theme', () => {
    expect(problems(studio, 'light')).toEqual([])
    expect(problems(studio, 'dark')).toEqual([])
  })

  it('holds no literal above the primitive tier', () => {
    for (const set of studio.sets) {
      for (const t of set.tokens) {
        if (t.tier === 'primitive') continue
        expect(isAlias(t.value), `${t.path} is a literal`).toBe(true)
      }
    }
  })

  it('resolves every token down to a real value', () => {
    for (const theme of ['light', 'dark']) {
      const map = flatten(studio, theme)
      for (const path of map.keys()) {
        expect(resolve(map, path).ok, `${path} in ${theme}`).toBe(true)
      }
    }
  })

  it('gives the two themes different backgrounds from the same token', () => {
    const light = flatten(studio, 'light')
    const dark = flatten(studio, 'dark')
    const a = resolve(light, 'colour.background')
    const b = resolve(dark, 'colour.background')
    expect(a.ok && b.ok && a.value !== b.value).toBe(true)
  })

  it('carries the corner and density choices into the values', () => {
    const tight = studioFromFeel('a', { ...FEEL, corner: 'angular', density: 'compact' })
    const round = studioFromFeel('b', { ...FEEL, corner: 'full', density: 'spacious' })
    const at = (s: typeof tight, p: string): unknown => {
      const r = resolve(flatten(s, 'light'), p)
      return r.ok ? r.value : null
    }
    expect(Number(at(tight, 'corner.control'))).toBeLessThan(Number(at(round, 'corner.control')))
    expect(Number(at(tight, 'gap.wide'))).toBeLessThan(Number(at(round, 'gap.wide')))
  })

  it('does not export the palette, only what points at it', () => {
    const css = toCSS(studio, 'light')
    expect(css).toContain('--colour-brand')
    expect(css).not.toContain('--palette-brand-600')
  })

  it('exports the same bytes twice running', () => {
    expect(toDTCG(studio, 'light')).toBe(toDTCG(studioFromFeel('Test', FEEL), 'light'))
  })
})
