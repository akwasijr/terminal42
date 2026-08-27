import { describe, it, expect } from 'vitest'
import {
  addToken,
  aliasCandidates,
  blankValue,
  deleteToken,
  freePath,
  renameToken,
  setAlias,
  setTokenValue
} from '../../src/shared/tokens/edit'
import { studioFromFeel, type Feel } from '../../src/shared/tokens/scaffold'
import { flatten, problems, resolve } from '../../src/shared/tokens/resolve'
import type { TokenStudio } from '../../src/shared/tokens/types'

const FEEL: Feel = {
  name: 'Test',
  primary: '#4338ca',
  secondary: '#0a2540',
  tertiary: '#06b6d4',
  headingFont: 'Geist',
  bodyFont: 'Geist',
  corner: 'rounded',
  density: 'comfortable',
  scale: 'balanced',
  elevation: 'subtle'
}

const base = (): TokenStudio => studioFromFeel('Test', FEEL)
const setNamed = (s: TokenStudio, name: string): string =>
  s.sets.find((x) => x.name === name)!.id
const valueOf = (s: TokenStudio, path: string): unknown => {
  const r = resolve(flatten(s, 'light'), path)
  return r.ok ? r.value : null
}

describe('setTokenValue', () => {
  it('changes one token and leaves the rest alone', () => {
    const s = base()
    const next = setTokenValue(s, setNamed(s, 'Palette'), 'palette.brand.600', '#ff0000')
    expect(valueOf(next, 'colour.brand.rest')).toBe('#ff0000')
    expect(valueOf(next, 'colour.accent')).toBe(valueOf(s, 'colour.accent'))
  })

  it('does not touch the studio it was given', () => {
    const s = base()
    const before = JSON.stringify(s)
    setTokenValue(s, setNamed(s, 'Palette'), 'palette.brand.600', '#ff0000')
    expect(JSON.stringify(s)).toBe(before)
  })
})

describe('renameToken', () => {
  it('carries everything that pointed at it', () => {
    const s = base()
    const next = renameToken(s, setNamed(s, 'Palette'), 'palette.brand.600', 'palette.hero.600')
    expect(problems(next, 'light')).toEqual([])
    expect(valueOf(next, 'colour.brand.rest')).toBe(valueOf(s, 'colour.brand.rest'))
  })

  it('repoints aliases in sets that are switched off too', () => {
    const s = base()
    const next = renameToken(s, setNamed(s, 'Palette'), 'palette.brand.400', 'palette.hero.400')
    expect(problems(next, 'dark')).toEqual([])
  })

  it('refuses an empty name and strips stray braces', () => {
    const s = base()
    expect(renameToken(s, setNamed(s, 'Palette'), 'palette.brand.600', '  ')).toBe(s)
    const braced = renameToken(s, setNamed(s, 'Palette'), 'palette.brand.600', '{palette.x}')
    expect(problems(braced, 'light')).toEqual([])
  })
})

describe('deleteToken', () => {
  it('leaves what pointed at it visibly broken rather than silently repointed', () => {
    const s = base()
    const next = deleteToken(s, setNamed(s, 'Palette'), 'palette.brand.600')
    const found = problems(next, 'light')
    expect(found.some((p) => p.path === 'colour.brand.rest' && p.kind === 'missing')).toBe(true)
  })
})

describe('addToken', () => {
  it('lands in the set with a usable value', () => {
    const s = base()
    const { studio, path } = addToken(s, setNamed(s, 'Palette'), 'color', 'primitive', 'palette.new')
    expect(path).toBe('palette.new')
    expect(valueOf(studio, 'palette.new')).toBe(blankValue('color'))
  })

  it('does not collide when added twice', () => {
    const s = base()
    const one = addToken(s, setNamed(s, 'Palette'), 'color', 'primitive', 'palette.new')
    const two = addToken(one.studio, setNamed(s, 'Palette'), 'color', 'primitive', 'palette.new')
    expect(two.path).toBe('palette.new2')
  })

  it('keeps the studio sound', () => {
    const s = base()
    const { studio } = addToken(s, setNamed(s, 'Palette'), 'dimension', 'primitive', 'space.99')
    expect(problems(studio, 'light')).toEqual([])
  })
})

describe('freePath', () => {
  it('gives back what was asked for when it is free', () => {
    const s = base()
    expect(freePath(s, setNamed(s, 'Palette'), 'palette.spare')).toBe('palette.spare')
  })
})

describe('setAlias', () => {
  it('points a token at another one', () => {
    const s = base()
    const next = setAlias(s, setNamed(s, 'Light'), 'colour.brand.rest', 'palette.accent.700', '#000')
    expect(valueOf(next, 'colour.brand.rest')).toBe(valueOf(s, 'colour.accent.rest'))
  })

  it('cuts it loose with a literal', () => {
    const s = base()
    const next = setAlias(s, setNamed(s, 'Light'), 'colour.brand.rest', null, '#123456')
    expect(valueOf(next, 'colour.brand.rest')).toBe('#123456')
  })
})

describe('aliasCandidates', () => {
  const s = base()

  it('offers only the same type', () => {
    const list = aliasCandidates(s, 'colour.brand.rest', 'color')
    expect(list).toContain('palette.accent.700')
    expect(list).not.toContain('space.4')
  })

  it('never offers itself', () => {
    expect(aliasCandidates(s, 'colour.brand.rest', 'color')).not.toContain('colour.brand.rest')
  })

  it('never offers something that already reaches it', () => {
    const list = aliasCandidates(s, 'colour.brand.rest', 'color')
    expect(list).not.toContain('button.background')
  })

  it('comes back sorted, so the list does not jump about', () => {
    const list = aliasCandidates(s, 'colour.brand.rest', 'color')
    expect(list).toEqual([...list].sort())
  })
})
