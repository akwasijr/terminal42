import { describe, it, expect } from 'vitest'
import { brandItems, bridgeSummary } from '../../src/shared/tokens/bridges'
import { toFormCollection } from '../../src/renderer/src/lib/tokens/toForm'
import { studioFromFeel, type Feel } from '../../src/shared/tokens/scaffold'
import { resolveAll } from '../../src/shared/tokens/resolve'

/**
 * Carrying the library into Form and Motion.
 *
 * Both bridges leave the primitive tier behind on purpose. A Form file bound
 * to `neutral/900`, or a Motion swatch row showing fifty greys, has reached
 * past the library into its workings, which is the habit the library exists
 * to break.
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

describe('what Motion receives', () => {
  it('carries colours and typefaces', () => {
    const { colours, fonts } = brandItems(studio, theme)
    expect(colours.length).toBeGreaterThan(2)
    expect(fonts.length).toBeGreaterThan(0)
  })

  it('offers every colour as a hex Motion can paint with', () => {
    for (const c of brandItems(studio, theme).colours) expect(c).toMatch(/^#|^rgb/)
  })

  it('never repeats a value', () => {
    const { colours, fonts } = brandItems(studio, theme)
    expect(new Set(colours).size).toBe(colours.length)
    expect(new Set(fonts).size).toBe(fonts.length)
  })

  it('leaves the primitive ramp behind', () => {
    const primitives = [...resolveAll(studio, theme)]
      .filter(([, h]) => h.token.tier === 'primitive' && h.token.type === 'color')
    expect(primitives.length).toBeGreaterThan(0)
    // Every carried colour must be a semantic one, even where a semantic
    // happens to resolve to the same hex a primitive holds.
    const carried = brandItems(studio, theme).colours
    const semantic = [...resolveAll(studio, theme)]
      .filter(([, h]) => h.token.tier !== 'primitive' && h.token.type === 'color')
      .map(([, h]) => h.value)
    for (const c of carried) expect(semantic).toContain(c)
  })

  it('takes only the first family from a stack', () => {
    expect(brandItems(studio, theme).fonts.every((f) => !f.includes(','))).toBe(true)
  })

  it('sends a real family name, never an unresolved alias', () => {
    const fonts = brandItems(studio, theme).fonts
    expect(fonts).toContain('Inter')
    for (const f of fonts) expect(f).not.toMatch(/[{}]/)
  })

  it('counts what it would send before it sends it', () => {
    const counts = bridgeSummary(studio, theme)
    const { colours, fonts } = brandItems(studio, theme)
    expect(counts.colours).toBe(colours.length)
    expect(counts.fonts).toBe(fonts.length)
    expect(counts.variables).toBeGreaterThan(counts.colours)
  })
})

describe('what Form receives', () => {
  const col = toFormCollection(studio)

  it('is one collection named after the library', () => {
    expect(col.name).toBe('Calm')
  })

  it('has a mode per theme, not a collection per theme', () => {
    expect(col.modes.map((m) => m.name)).toEqual(studio.themes.map((t) => t.name))
  })

  it('opens on the library’s own active theme', () => {
    const want = studio.themes.findIndex((t) => t.id === studio.activeTheme)
    expect(col.activeMode).toBe(col.modes[want].id)
  })

  it('names variables by path, grouped the way Form groups', () => {
    expect(col.variables.length).toBeGreaterThan(4)
    for (const v of col.variables) expect(v.name).not.toContain('.')
    expect(col.variables.some((v) => v.name.includes('/'))).toBe(true)
  })

  it('carries no primitive', () => {
    const primitivePaths = [...resolveAll(studio, theme)]
      .filter(([, h]) => h.token.tier === 'primitive')
      .map(([p]) => p.replace(/\./g, '/'))
    for (const v of col.variables) expect(primitivePaths).not.toContain(v.name)
  })

  it('gives every colour variable a value in every mode', () => {
    const colours = col.variables.filter((v) => v.type === 'color')
    expect(colours.length).toBeGreaterThan(0)
    for (const v of colours) {
      for (const m of col.modes) expect(v.values[m.id]).toBeDefined()
    }
  })

  it('gives a number variable a number, not the string it was written as', () => {
    for (const v of col.variables.filter((x) => x.type === 'number')) {
      for (const m of col.modes) {
        const val = v.values[m.id]
        if (val !== undefined) expect(typeof val).toBe('number')
      }
    }
  })

  it('promises exactly what it delivers', () => {
    expect(bridgeSummary(studio, theme).variables).toBe(col.variables.length)
  })

  it('leaves behind what Form has nowhere to put', () => {
    const composites = [...resolveAll(studio, theme)]
      .filter(([, h]) => h.token.tier !== 'primitive'
        && ['shadow', 'border', 'cubicBezier', 'typography'].includes(h.token.type))
      .map(([p]) => p.replace(/\./g, '/'))
    expect(composites.length).toBeGreaterThan(0)
    for (const v of col.variables) expect(composites).not.toContain(v.name)
  })

  it('is stable: two runs describe the same library', () => {
    const again = toFormCollection(studio)
    expect(again.variables.map((v) => v.name)).toEqual(col.variables.map((v) => v.name))
  })
})
