/**
 * Turning a feel preset into a real token library.
 *
 * The token templates are not pictures of libraries — pressing Duplicate has
 * to produce one that is indistinguishable from the wizard's output, or the
 * template is a promise the app cannot keep.
 */
import { describe, it, expect } from 'vitest'
import { FEEL_PRESETS, type Vibe } from '../../src/renderer/src/lib/designSystem'
import { feelFromPreset, studioFromPreset, CORNER_PX } from '../../src/renderer/src/lib/tokenPresets'

const VIBES = Object.keys(FEEL_PRESETS) as Vibe[]

describe('feelFromPreset', () => {
  it('covers every feel the wizard offers', () => {
    expect(VIBES.length).toBe(9)
    for (const v of VIBES) expect(() => feelFromPreset(v)).not.toThrow()
  })

  it('carries the preset\u2019s own colours through unchanged', () => {
    for (const v of VIBES) {
      const p = FEEL_PRESETS[v]
      const f = feelFromPreset(v)
      expect(f.primary).toBe(p.primary)
      expect(f.secondary).toBe(p.secondary)
      expect(f.tertiary).toBe(p.tertiary)
      expect(f.headingFont).toBe(p.headingFont)
      expect(f.bodyFont).toBe(p.bodyFont)
    }
  })

  it('maps squircle onto the roundest corner a library can express', () => {
    // The scaffold only carries a radius, so there is no squircle to map to.
    // Silently dropping to square would be the wrong kind of wrong.
    expect(CORNER_PX.squircle).toBeGreaterThan(CORNER_PX.rounded)
  })
})

describe('studioFromPreset', () => {
  it('builds a full library for every feel', () => {
    for (const v of VIBES) {
      const studio = studioFromPreset(v)
      const count = studio.sets.reduce((n, s) => n + Object.keys(s.tokens).length, 0)
      // A library with a handful of tokens means the scaffold quietly failed.
      expect(count).toBeGreaterThan(100)
    }
  })

  it('takes its name from the feel, or from whatever it is given', () => {
    expect(studioFromPreset('bold').name).toBe('Bold')
    expect(studioFromPreset('bold', 'House style').name).toBe('House style')
  })

  it('puts the chosen primary somewhere in the library it built', () => {
    // The ramp is anchored so the colour you picked appears on its own ramp.
    // It used to land between two steps and appear nowhere at all.
    for (const v of VIBES) {
      const studio = studioFromPreset(v)
      const values = studio.sets.flatMap((s) => Object.values(s.tokens)).map((t) => String(t.value).toLowerCase())
      expect(values).toContain(FEEL_PRESETS[v].primary.toLowerCase())
    }
  })

  it('gives two different feels two different libraries', () => {
    const a = studioFromPreset('minimal')
    const b = studioFromPreset('playful')
    const flat = (s: typeof a): string[] =>
      s.sets.flatMap((set) => Object.values(set.tokens)).map((t) => String(t.value))
    expect(flat(a)).not.toEqual(flat(b))
  })
})
