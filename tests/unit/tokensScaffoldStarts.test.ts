// The two ways a library starts that are not a feel: empty, and a copy.

import { describe, it, expect } from 'vitest'
import { cloneStudio, emptyStudio, studioFromFeel } from '../../src/shared/tokens/scaffold'
import { feelFromVibe } from '../../src/renderer/src/lib/tokens/feelFromVibe'

const feel = feelFromVibe('bold')

describe('emptyStudio', () => {
  it('keeps the structure everything else in the app reads', () => {
    const s = emptyStudio('Ours')
    expect(s.name).toBe('Ours')
    expect(s.sets.map((x) => x.name)).toEqual(['Palette', 'Shape', 'Light', 'Dark', 'Parts'])
    expect(s.themes.map((t) => t.id)).toEqual(['light', 'dark'])
    expect(s.activeTheme).toBe('light')
  })

  it('decides nothing', () => {
    const s = emptyStudio('Ours')
    expect(s.sets.every((x) => x.tokens.length === 0)).toBe(true)
  })

  it('points its themes at sets that exist', () => {
    const s = emptyStudio('Ours')
    const ids = new Set(s.sets.map((x) => x.id))
    for (const t of s.themes) for (const k of Object.keys(t.sets)) expect(ids.has(k)).toBe(true)
  })

  it('starts at the bottom of the enforcement ladder', () => {
    expect(emptyStudio('Ours').enforcement).toBe('advise')
  })
})

describe('cloneStudio', () => {
  const source = studioFromFeel('Bold', feel)

  it('takes the name it is given and a fresh identity', () => {
    const c = cloneStudio(source, 'Bold copy')
    expect(c.name).toBe('Bold copy')
    expect(c.id).not.toBe(source.id)
  })

  it('carries every token across', () => {
    const c = cloneStudio(source, 'Bold copy')
    const count = (s: typeof source): number => s.sets.reduce((n, x) => n + x.tokens.length, 0)
    expect(count(c)).toBe(count(source))
    expect(count(c)).toBeGreaterThan(0)
  })

  it('shares no set id with the original', () => {
    const c = cloneStudio(source, 'Bold copy')
    const before = new Set(source.sets.map((x) => x.id))
    expect(c.sets.some((x) => before.has(x.id))).toBe(false)
  })

  it('repoints the themes at the new sets, keeping each state', () => {
    const c = cloneStudio(source, 'Bold copy')
    const ids = new Set(c.sets.map((x) => x.id))
    for (const t of c.themes) {
      for (const k of Object.keys(t.sets)) expect(ids.has(k)).toBe(true)
      const src = source.themes.find((x) => x.id === t.id)
      expect(Object.values(t.sets).sort()).toEqual(Object.values(src?.sets ?? {}).sort())
    }
  })

  it('cannot reach back into the library it came from', () => {
    const c = cloneStudio(source, 'Bold copy')
    const set = c.sets[0]
    if (set.tokens.length > 0) set.tokens[0].value = '#123456'
    expect(source.sets[0].tokens[0]?.value).not.toBe('#123456')
  })
})
