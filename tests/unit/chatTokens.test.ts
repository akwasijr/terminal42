import { describe, it, expect } from 'vitest'
import { tokensPrefix } from '../../src/renderer/src/components/tokens/TokensChip'
import type { TokenLibrary } from '../../src/renderer/src/lib/tokens/useTokenLibraries'
import { studioFromFeel, type Feel } from '../../src/shared/tokens/scaffold'
import { brandItems } from '../../src/shared/tokens/bridges'

/**
 * What a chat turn carries when a library is attached.
 *
 * The prefix is the whole of the wiring: chat has no brief to read a binding
 * out of, so the only way a loose session stays on the library is that every
 * turn is told. It has to be silent in every case where it would be noise,
 * because a system block that regularly says nothing is a system block the
 * model learns to skip.
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
const library: TokenLibrary = {
  id: 'lib1',
  name: 'Calm',
  studio,
  themes: studio.themes.map((t) => ({ id: t.id, name: t.name })),
  swatches: brandItems(studio, studio.activeTheme).colours.slice(0, 6)
}

describe('the library a chat turn carries', () => {
  it('says nothing when nothing is attached', () => {
    expect(tokensPrefix([library], null)).toBeNull()
  })

  it('says nothing when the attached library has been deleted', () => {
    expect(tokensPrefix([], { id: 'lib1', themeId: null })).toBeNull()
    expect(tokensPrefix([library], { id: 'gone', themeId: null })).toBeNull()
  })

  it('names the library values so the model can use them', () => {
    const prefix = tokensPrefix([library], { id: 'lib1', themeId: null })
    expect(prefix).toBeTruthy()
    expect(prefix!.length).toBeGreaterThan(80)
  })

  it('tells the model not to invent what the library does not have', () => {
    const prefix = tokensPrefix([library], { id: 'lib1', themeId: null })!
    expect(prefix).toMatch(/do not invent/i)
    expect(prefix).toMatch(/say so rather than inventing/i)
  })

  it('falls back to the library own active theme when none is chosen', () => {
    const chosen = tokensPrefix([library], { id: 'lib1', themeId: studio.activeTheme })
    expect(tokensPrefix([library], { id: 'lib1', themeId: null })).toBe(chosen)
  })

  it('sends a different turn for a different theme', () => {
    const [light, dark] = studio.themes
    expect(tokensPrefix([library], { id: 'lib1', themeId: light.id }))
      .not.toBe(tokensPrefix([library], { id: 'lib1', themeId: dark.id }))
  })

  it('says nothing for a library with nothing in it', () => {
    const bare: TokenLibrary = { ...library, studio: { ...studio, sets: [] } }
    expect(tokensPrefix([bare], { id: 'lib1', themeId: null })).toBeNull()
  })
})
