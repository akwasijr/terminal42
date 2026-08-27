// The types the draft does not name, and what the rest of the app does with them.

import { describe, it, expect } from 'vitest'
import { TOKEN_TYPES, type TokenStudio } from '../../src/shared/tokens/types'
import { blankValue } from '../../src/shared/tokens/edit'
import { sectionOf } from '../../src/shared/tokens/groups'
import { toCSS } from '../../src/shared/tokens/export'
import { fromTokensJson } from '../../src/shared/tokens/import'

const NEW = ['text', 'boolean', 'asset', 'textCase', 'textDecoration', 'gradient'] as const

describe('the added types', () => {
  it('are all known', () => {
    for (const t of NEW) expect(TOKEN_TYPES).toContain(t)
  })

  it('each start at a value rather than nothing', () => {
    for (const t of TOKEN_TYPES) expect(blankValue(t)).toBeDefined()
    expect(blankValue('boolean')).toBe('false')
    expect(blankValue('textCase')).toBe('none')
    expect(String(blankValue('gradient'))).toMatch(/gradient\(/)
  })

  it('land where a person would look for them', () => {
    expect(sectionOf({ path: 'brand.wash', type: 'gradient' })).toBe('colour')
    expect(sectionOf({ path: 'label.case', type: 'textCase' })).toBe('type')
    expect(sectionOf({ path: 'link.line', type: 'textDecoration' })).toBe('type')
    expect(sectionOf({ path: 'brand.name', type: 'text' })).toBe('other')
    expect(sectionOf({ path: 'flag.beta', type: 'boolean' })).toBe('other')
    expect(sectionOf({ path: 'logo.mark', type: 'asset' })).toBe('other')
  })
})

function studioOf(tokens: { path: string; type: (typeof NEW)[number]; value: string }[]): TokenStudio {
  return {
    id: 'ts',
    name: 'Types',
    sets: [
      {
        id: 's1',
        name: 'All',
        order: 0,
        tokens: tokens.map((t) => ({ id: t.path, path: t.path, type: t.type, value: t.value, tier: 'primitive' }))
      }
    ],
    themes: [{ id: 'one', name: 'One', sets: { s1: 'enabled' } }],
    activeTheme: 'one'
  }
}

describe('what a stylesheet gets', () => {
  const css = toCSS(
    studioOf([
      { path: 'brand.wash', type: 'gradient', value: 'linear-gradient(180deg, #fff 0%, #000 100%)' },
      { path: 'logo.mark', type: 'asset', value: '/brand/logo.svg' },
      { path: 'label.case', type: 'textCase', value: 'uppercase' },
      { path: 'brand.name', type: 'text', value: 'Terminal 42' }
    ]),
    'one'
  )

  it('writes a gradient as itself', () => {
    expect(css).toContain('--brand-wash: linear-gradient(180deg, #fff 0%, #000 100%);')
  })

  it('wraps an asset so it does something where it is used', () => {
    expect(css).toContain('--logo-mark: url("/brand/logo.svg");')
  })

  it('leaves the plain strings alone', () => {
    expect(css).toContain('--label-case: uppercase;')
    expect(css).toContain('--brand-name: Terminal 42;')
  })

  it('does not wrap an asset that already says url()', () => {
    const one = toCSS(studioOf([{ path: 'a.b', type: 'asset', value: 'url("/x.png")' }]), 'one')
    expect(one).toContain('--a-b: url("/x.png");')
  })
})

describe('what an import makes of them', () => {
  it('keeps a plugin file\u2019s own names for them', () => {
    const { studio, notes } = fromTokensJson(
      {
        brand: {
          name: { type: 'text', value: 'Acme' },
          beta: { type: 'boolean', value: 'true' },
          logo: { type: 'asset', value: '/logo.svg' },
          caps: { type: 'textCase', value: 'uppercase' },
          line: { type: 'textDecoration', value: 'underline' }
        }
      },
      'Plugin types'
    )
    const type = (p: string): string | undefined => studio.sets[0].tokens.find((t) => t.path === p)?.type
    expect(type('brand.name')).toBe('text')
    expect(type('brand.beta')).toBe('boolean')
    expect(type('brand.logo')).toBe('asset')
    expect(type('brand.caps')).toBe('textCase')
    expect(type('brand.line')).toBe('textDecoration')
    expect(notes).toEqual([])
  })

  it('guesses a gradient, and a plain string, when nothing said', () => {
    const { studio } = fromTokensJson(
      { a: { value: 'linear-gradient(90deg, #fff, #000)' }, b: { value: 'Acme' } },
      'Guess'
    )
    const type = (p: string): string | undefined => studio.sets[0].tokens.find((t) => t.path === p)?.type
    expect(type('a')).toBe('gradient')
    expect(type('b')).toBe('text')
  })
})
