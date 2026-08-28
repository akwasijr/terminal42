import { describe, it, expect } from 'vitest'
import { colourSwatches, brandItems } from '../../src/shared/tokens/bridges'
import { studioFromFeel, type Feel } from '../../src/shared/tokens/scaffold'
import { setDeprecated } from '../../src/shared/tokens/edit'

/**
 * The library, at the moment somebody picks a colour somewhere else.
 *
 * `brandItems` answers "what colours are ours" and throws the names away.
 * This answers "which of ours is this", which is the question a picker asks,
 * and the names are the entire answer — six greys are indistinguishable until
 * one of them is called `colour.text.muted`.
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

describe('the colours a picker offers', () => {
  it('finds some', () => {
    expect(colourSwatches(studio, theme).length).toBeGreaterThan(2)
  })

  it('keeps the name, which is the reason for choosing one', () => {
    for (const s of colourSwatches(studio, theme)) {
      expect(s.path.length).toBeGreaterThan(0)
      expect(s.path).toContain('.')
    }
  })

  it('offers only values that can be painted', () => {
    for (const s of colourSwatches(studio, theme)) expect(s.hex).toMatch(/^#|^rgb/)
  })

  it('leaves the primitive ramp behind, as the other bridges do', () => {
    const paths = colourSwatches(studio, theme).map((s) => s.path)
    const primitives = studio.sets
      .flatMap((s) => s.tokens)
      .filter((t) => t.tier === 'primitive')
      .map((t) => t.path)
    for (const p of primitives) expect(paths).not.toContain(p)
  })

  it('agrees with the swatch row about which colours are ours', () => {
    const named = colourSwatches(studio, theme).map((s) => s.hex)
    for (const c of brandItems(studio, theme).colours) expect(named).toContain(c)
  })

  it('carries no colour twice under one name', () => {
    const paths = colourSwatches(studio, theme).map((s) => s.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('stops offering a token once it is deprecated', () => {
    const first = colourSwatches(studio, theme)[0]
    const set = studio.sets.find((s) => s.tokens.some((t) => t.path === first.path))
    expect(set).toBeTruthy()
    const after = setDeprecated(studio, set!.id, first.path, {
      severity: 'warning',
      message: 'use colour.text.primary'
    })
    const paths = colourSwatches(after, theme).map((s) => s.path)
    expect(paths).not.toContain(first.path)
  })

  it('is empty rather than broken for a library with nothing in it', () => {
    expect(colourSwatches({ ...studio, sets: [] }, theme)).toEqual([])
  })
})
