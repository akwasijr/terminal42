import { describe, it, expect } from 'vitest'
import { lintAgainstBasis, describeBasisFindings, toRGB } from '../../src/shared/tokens/lint'
import { studioFromFeel, type Feel } from '../../src/shared/tokens/scaffold'
import { toCSS } from '../../src/shared/tokens/export'
import { enforcementOf, emptyStudio, hydrateStudio } from '../../src/shared/tokens/types'

/**
 * Reading a page back against its library.
 *
 * The two cases that matter are told apart deliberately: a literal the library
 * already holds is a missed reference, and a literal it does not hold is a
 * drift. Conflating them would make the report useless, because the fixes are
 * different sentences.
 */

const FEEL: Feel = {
  name: 'Calm',
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

const studio = studioFromFeel('Calm', FEEL)
const theme = studio.activeTheme
const css = toCSS(studio, theme)
const page = (body: string): string => `<html><style>${body}</style></html>`

/** A colour the library really does hold, read out of its own export. */
const known = (): string => {
  const m = css.match(/--colour-[a-z-]*:\s*(#[0-9a-fA-F]{6})/)
  return m ? m[1] : '#4338ca'
}

describe('reading a page against its library', () => {
  it('finds nothing in a page that only uses variables', () => {
    const out = lintAgainstBasis(page('.a{color:var(--colour-text-primary);padding:var(--space-4)}'), studio, theme)
    expect(out).toEqual([])
  })

  it('ignores zero, none and the other words that mean nothing', () => {
    const out = lintAgainstBasis(page('.a{border:none;margin:0;color:inherit;background:transparent}'), studio, theme)
    expect(out).toEqual([])
  })

  it('calls a hardcoded library colour a missed reference', () => {
    const hex = known()
    const out = lintAgainstBasis(page(`.a{color:${hex}}`), studio, theme)
    expect(out).toHaveLength(1)
    expect(out[0].exact).toBe(true)
    expect(out[0].nearest).toMatch(/^--/)
    expect(describeBasisFindings(out, 'Calm')[0]).toContain('written out by hand')
  })

  it('calls an invented colour a drift and names the closest token', () => {
    const out = lintAgainstBasis(page('.a{color:#ff00aa}'), studio, theme)
    expect(out).toHaveLength(1)
    expect(out[0].exact).toBe(false)
    expect(out[0].nearest).toMatch(/^--/)
    expect(out[0].nearestValue).toBeTruthy()
    expect(describeBasisFindings(out, 'Calm')[0]).toContain('closest is')
  })

  it('counts a literal once, however often it appears', () => {
    const out = lintAgainstBasis(page('.a{color:#ff00aa}.b{color:#FF00AA}.c{background-color:#ff00aa}'), studio, theme)
    expect(out).toHaveLength(1)
    expect(out[0].count).toBe(3)
  })

  it('reads colours out of a shadow, where they hide', () => {
    const out = lintAgainstBasis(page('.a{box-shadow:0 1px 3px rgba(1,2,3,0.2)}'), studio, theme)
    expect(out.some((f) => f.kind === 'colour' && f.literal.startsWith('rgba'))).toBe(true)
  })

  it('reads an inline style attribute as well as a stylesheet', () => {
    const out = lintAgainstBasis('<div style="color:#ff00aa"></div>', studio, theme)
    expect(out).toHaveLength(1)
  })

  it('reports both lengths in a shorthand', () => {
    const out = lintAgainstBasis(page('.a{padding:17px 23px}'), studio, theme)
    const spacing = out.filter((f) => f.kind === 'spacing').map((f) => f.literal).sort()
    expect(spacing).toEqual(['17px', '23px'])
  })

  it('offers a radius for a corner and never a gap', () => {
    const out = lintAgainstBasis(page('.a{border-radius:7px}'), studio, theme)
    const hit = out.find((f) => f.kind === 'radius')
    expect(hit).toBeTruthy()
    expect(hit?.nearest).toMatch(/radius|corner|round/i)
  })

  it('notices a typeface the library does not have', () => {
    const out = lintAgainstBasis(page('.a{font-family:Comic Sans MS, sans-serif}'), studio, theme)
    const hit = out.find((f) => f.kind === 'typeface')
    expect(hit).toBeTruthy()
    expect(hit?.exact).toBe(false)
  })

  it('accepts a typeface the library does have', () => {
    const out = lintAgainstBasis(page(`.a{font-family:Inter, sans-serif}`), studio, theme)
    const hit = out.find((f) => f.kind === 'typeface')
    expect(hit?.exact).toBe(true)
  })

  it('puts drifts above missed references', () => {
    const out = lintAgainstBasis(page(`.a{color:${known()}}.b{color:#ff00aa}`), studio, theme)
    expect(out[0].exact).toBe(false)
    expect(out[1].exact).toBe(true)
  })

  it('says nothing about a page with no CSS at all', () => {
    expect(lintAgainstBasis('<p>hello</p>', studio, theme)).toEqual([])
    expect(lintAgainstBasis('', studio, theme)).toEqual([])
  })
})

describe('reading a colour', () => {
  it('understands three, six and eight digit hex', () => {
    expect(toRGB('#fff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(toRGB('#102030')).toEqual({ r: 16, g: 32, b: 48 })
    expect(toRGB('#10203040')).toEqual({ r: 16, g: 32, b: 48 })
  })

  it('understands rgb and rgba, comma or slash', () => {
    expect(toRGB('rgb(1, 2, 3)')).toEqual({ r: 1, g: 2, b: 3 })
    expect(toRGB('rgba(1 2 3 / 0.5)')).toEqual({ r: 1, g: 2, b: 3 })
  })

  it('gives up rather than guessing', () => {
    expect(toRGB('teal')).toBeNull()
    expect(toRGB('#zzz')).toBeNull()
    expect(toRGB('')).toBeNull()
  })
})

/**
 * The enforcement ladder.
 *
 * The setting decides how far a finding travels, so the only thing worth
 * pinning is the default, which is the one value nobody chooses on purpose.
 */
describe('what a library asks of its designs', () => {
  it('reads a library made before the ladder existed as the strictest rung', () => {
    // Not because strict is better, but because it is what the app already did
    // to every bound design. Relaxing it silently while nobody was looking
    // would be a worse surprise than a setting that appears already on.
    expect(enforcementOf({})).toBe('block')
    expect(enforcementOf(null)).toBe('block')
    expect(enforcementOf({ enforcement: undefined })).toBe('block')
  })

  it('starts a new library at the bottom of the ladder', () => {
    expect(enforcementOf(emptyStudio('New'))).toBe('advise')
    expect(enforcementOf(studioFromFeel('New', FEEL))).toBe('advise')
  })

  it('keeps a choice through a save and a reload', () => {
    const chosen = { ...emptyStudio('New'), enforcement: 'check' as const }
    expect(enforcementOf(hydrateStudio(JSON.parse(JSON.stringify(chosen))))).toBe('check')
  })

  it('ignores a value that is not one of the three', () => {
    expect(enforcementOf({ enforcement: 'whatever' as never })).toBe('block')
  })
})
