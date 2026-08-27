import { describe, it, expect } from 'vitest'
import { libraryBrandSets, isTokensSet, CORE_SETS } from '../../src/renderer/src/lib/motion/brand'
import { studioFromFeel, type Feel } from '../../src/shared/tokens/scaffold'

/**
 * Token libraries as brand sets.
 *
 * Motion already had brand sets — a set of colours and typefaces kept across
 * pieces — and a library is that, only shared and already agreed. So a
 * library arrives as sets rather than as a fifth place to keep colours, one
 * set per theme, derived on load so that the library remains the thing being
 * followed rather than the thing that was once copied.
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
const rows = [{ id: 'lib1', name: 'Calm', studio }]

describe('a library seen as brand sets', () => {
  it('offers one set per theme', () => {
    const sets = libraryBrandSets(rows, 'colours')
    expect(sets.length).toBe(studio.themes.length)
    for (const theme of studio.themes) {
      expect(sets.some((s) => s.name === `Calm · ${theme.name}`)).toBe(true)
    }
  })

  it('names a set after the library and the theme it shows', () => {
    const [first] = libraryBrandSets(rows, 'colours')
    expect(first.name.startsWith('Calm · ')).toBe(true)
  })

  it('gives every theme its own id, so choosing one is choosing that theme', () => {
    const ids = libraryBrandSets(rows, 'colours').map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(isTokensSet(id)).toBe(true)
  })

  it('keeps a library set apart from a set of your own', () => {
    expect(isTokensSet(CORE_SETS.colours.id)).toBe(false)
    expect(isTokensSet('7f3a-not-a-library')).toBe(false)
  })

  it('brings colours to the colour chooser and typefaces to the font one', () => {
    const colours = libraryBrandSets(rows, 'colours')[0].items
    const fonts = libraryBrandSets(rows, 'fonts')[0].items
    for (const c of colours) expect(c).toMatch(/^#|^rgb/)
    for (const f of fonts) expect(f).not.toMatch(/^#/)
    expect(colours.length).toBeGreaterThan(2)
    expect(fonts.length).toBeGreaterThan(0)
  })

  it('leaves out a library that has nothing of this kind to offer', () => {
    const empty = { ...studio, sets: [] }
    expect(libraryBrandSets([{ id: 'x', name: 'Bare', studio: empty }], 'colours')).toEqual([])
  })

  it('still offers a library that was saved with no themes', () => {
    // Hydration gives it one, so the library appears rather than vanishing
    // from the chooser because nobody had got round to theming it.
    const themeless = { ...studio, themes: [], activeTheme: null }
    const sets = libraryBrandSets([{ id: 'x', name: 'Flat', studio: themeless }], 'colours')
    expect(sets.length).toBe(1)
    expect(sets[0].items.length).toBeGreaterThan(0)
  })

  it('follows the library rather than a copy of it', () => {
    const before = libraryBrandSets(rows, 'colours')[0].items
    const changed = studioFromFeel('Calm', { ...FEEL, primary: '#b91c1c' })
    const after = libraryBrandSets([{ id: 'lib1', name: 'Calm', studio: changed }], 'colours')[0].items
    expect(after).not.toEqual(before)
    // The set is the same set — it is the values underneath that moved.
    expect(libraryBrandSets([{ id: 'lib1', name: 'Calm', studio: changed }], 'colours')[0].id)
      .toBe(libraryBrandSets(rows, 'colours')[0].id)
  })
})
