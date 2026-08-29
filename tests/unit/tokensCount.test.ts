import { describe, it, expect } from 'vitest'
import { countTokens, emptyStudio, hydrateStudio, type TokenStudio } from '../../src/shared/tokens/types'
import { resolveAll } from '../../src/shared/tokens/resolve'

function studioWithTwoSets(): TokenStudio {
  const s = hydrateStudio(emptyStudio('Two sets'))
  s.sets = [
    { id: 'a', name: 'A', tokens: [
      { path: 'colour.one', type: 'color', value: '#111111' },
      { path: 'colour.two', type: 'color', value: '#222222' }
    ] },
    { id: 'b', name: 'B', tokens: [
      { path: 'colour.three', type: 'color', value: '#333333' }
    ] }
  ] as TokenStudio['sets']
  return s
}

describe('countTokens', () => {
  it('adds up every set', () => {
    expect(countTokens(studioWithTwoSets())).toBe(3)
  })

  it('is zero for a studio with nothing in it', () => {
    expect(countTokens({ sets: [] })).toBe(0)
  })

  // The bug this replaced: the library list counted every set while the detail
  // counted what the active theme resolved to, so the same library reported
  // two different sizes a click apart.
  it('does not change when a theme switches a set off', () => {
    const s = studioWithTwoSets()
    const before = countTokens(s)
    s.themes = [
      { id: 't1', name: 'Both', sets: { a: 'enabled', b: 'enabled' } },
      { id: 't2', name: 'Only A', sets: { a: 'enabled', b: 'off' } }
    ] as TokenStudio['themes']
    s.activeTheme = 't2'
    expect(countTokens(s)).toBe(before)
    // …and it is deliberately not the same as what the theme resolves to.
    expect(resolveAll(s, 't2').size).toBeLessThan(before)
  })
})
