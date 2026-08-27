import { describe, it, expect } from 'vitest'
import { aliasTarget, emptyStudio, hydrateStudio, type Token, type TokenStudio } from '../../src/shared/tokens/types'
import { flatten, problems, resolve, resolveAll, exported } from '../../src/shared/tokens/resolve'

const tok = (path: string, value: Token['value'], tier: Token['tier'] = 'primitive', type: Token['type'] = 'color'): Token =>
  ({ id: `k${path}`, path, value, tier, type })

const studio = (sets: Array<{ id: string; order: number; tokens: Token[] }>, on: Record<string, 'off' | 'source' | 'enabled'>): TokenStudio => ({
  id: 's',
  name: 'Test',
  sets: sets.map((s) => ({ ...s, name: s.id })),
  themes: [{ id: 'th', name: 'Theme', sets: on }],
  activeTheme: 'th'
})

describe('naming another token', () => {
  it('reads a path out of braces and nothing else', () => {
    expect(aliasTarget('{colour.blue.500}')).toBe('colour.blue.500')
    expect(aliasTarget(' {a.b} ')).toBe('a.b')
    expect(aliasTarget('#ff0000')).toBeNull()
    expect(aliasTarget('{a}{b}')).toBeNull()
    expect(aliasTarget(16)).toBeNull()
  })
})

describe('stacking sets', () => {
  const base = { id: 'base', order: 0, tokens: [tok('c.bg', '#ffffff'), tok('c.fg', '#000000')] }
  const dark = { id: 'dark', order: 1, tokens: [tok('c.bg', '#111111')] }

  it('lets a later set win, token by token', () => {
    const map = flatten(studio([base, dark], { base: 'enabled', dark: 'enabled' }), 'th')
    expect(map.get('c.bg')?.token.value).toBe('#111111')
    // The set that did not mention it is still where the other token lives.
    expect(map.get('c.fg')?.token.value).toBe('#000000')
    expect(map.get('c.fg')?.setId).toBe('base')
  })

  it('stacks by order rather than by the order they were written', () => {
    const flipped = studio([{ ...dark, order: 0 }, { ...base, order: 1 }], { base: 'enabled', dark: 'enabled' })
    expect(flatten(flipped, 'th').get('c.bg')?.token.value).toBe('#ffffff')
  })

  it('leaves out a set the theme has switched off', () => {
    const map = flatten(studio([base, dark], { base: 'enabled', dark: 'off' }), 'th')
    expect(map.get('c.bg')?.token.value).toBe('#ffffff')
  })

  it('resolves through a source set without exporting it', () => {
    const map = flatten(studio([base, dark], { base: 'source', dark: 'enabled' }), 'th')
    expect(map.get('c.fg')?.token.value).toBe('#000000')
    const theme = studio([base, dark], { base: 'source', dark: 'enabled' }).themes[0]
    expect(exported(theme, 'base')).toBe(false)
    expect(exported(theme, 'dark')).toBe(true)
  })
})

describe('following aliases', () => {
  const s = studio([{
    id: 'a',
    order: 0,
    tokens: [
      tok('blue.500', '#2f6fed'),
      tok('colour.action', '{blue.500}', 'semantic'),
      tok('button.bg', '{colour.action}', 'component')
    ]
  }], { a: 'enabled' })

  it('walks a chain down to the value and says how it got there', () => {
    const r = resolve(flatten(s, 'th'), 'button.bg')
    expect(r.ok && r.value).toBe('#2f6fed')
    expect(r.through).toEqual(['button.bg', 'colour.action', 'blue.500'])
  })

  it('reports a dangling alias rather than throwing', () => {
    const broken = studio([{ id: 'a', order: 0, tokens: [tok('x', '{nope}', 'semantic')] }], { a: 'enabled' })
    const r = resolve(flatten(broken, 'th'), 'x')
    expect(r.ok).toBe(false)
    expect(!r.ok && r.reason).toBe('missing')
    expect(!r.ok && r.at).toBe('nope')
  })

  it('stops on a loop instead of running out of stack', () => {
    const loop = studio([{
      id: 'a', order: 0,
      tokens: [tok('one', '{two}', 'semantic'), tok('two', '{one}', 'semantic')]
    }], { a: 'enabled' })
    const r = resolve(flatten(loop, 'th'), 'one')
    expect(!r.ok && r.reason).toBe('cycle')
  })

  it('resolves the fields of a composite', () => {
    const s2 = studio([{
      id: 'a', order: 0,
      tokens: [
        tok('grey.900', '#151515'),
        { id: 'sh', path: 'shadow.card', type: 'shadow', tier: 'semantic', value: { color: '{grey.900}', blur: 8, y: 4 } }
      ]
    }], { a: 'enabled' })
    const r = resolve(flatten(s2, 'th'), 'shadow.card')
    expect(r.ok && r.value).toEqual({ color: '#151515', blur: 8, y: 4 })
  })

  it('re-resolves when the theme changes, without the token changing', () => {
    const light = { id: 'l', order: 1, tokens: [tok('page', '#ffffff')] }
    const dark = { id: 'd', order: 1, tokens: [tok('page', '#101010')] }
    const semantic = { id: 's', order: 0, tokens: [tok('colour.bg', '{page}', 'semantic')] }
    const both: TokenStudio = {
      id: 'x', name: 'x',
      sets: [semantic, light, dark].map((s) => ({ ...s, name: s.id })),
      themes: [
        { id: 'light', name: 'Light', sets: { s: 'enabled', l: 'source', d: 'off' } },
        { id: 'dark', name: 'Dark', sets: { s: 'enabled', l: 'off', d: 'source' } }
      ],
      activeTheme: 'light'
    }
    expect(resolve(flatten(both, 'light'), 'colour.bg')).toMatchObject({ ok: true, value: '#ffffff' })
    expect(resolve(flatten(both, 'dark'), 'colour.bg')).toMatchObject({ ok: true, value: '#101010' })
  })
})

describe('what is wrong with a theme', () => {
  it('says nothing about a studio that is right', () => {
    const s = studio([{
      id: 'a', order: 0,
      tokens: [tok('blue.500', '#2f6fed'), tok('colour.action', '{blue.500}', 'semantic')]
    }], { a: 'enabled' })
    expect(problems(s, 'th')).toEqual([])
  })

  it('catches a semantic token holding a value of its own', () => {
    const s = studio([{ id: 'a', order: 0, tokens: [tok('colour.action', '#2f6fed', 'semantic')] }], { a: 'enabled' })
    const p = problems(s, 'th')
    expect(p).toHaveLength(1)
    expect(p[0].kind).toBe('literal-semantic')
  })

  it('catches a token pointing at the wrong kind of thing', () => {
    const s = studio([{
      id: 'a', order: 0,
      tokens: [
        { id: 'n', path: 'space.4', type: 'dimension', tier: 'primitive', value: 16 },
        tok('colour.action', '{space.4}', 'semantic')
      ]
    }], { a: 'enabled' })
    expect(problems(s, 'th').some((p) => p.kind === 'type-mismatch')).toBe(true)
  })

  it('catches a semantic token reaching down into a component one', () => {
    const s = studio([{
      id: 'a', order: 0,
      tokens: [tok('button.bg', '#fff', 'component'), tok('colour.action', '{button.bg}', 'semantic')]
    }], { a: 'enabled' })
    expect(problems(s, 'th').some((p) => p.note.includes('component'))).toBe(true)
  })

  it('never complains about a primitive holding a value', () => {
    const s = studio([{ id: 'a', order: 0, tokens: [tok('blue.500', '#2f6fed')] }], { a: 'enabled' })
    expect(problems(s, 'th')).toEqual([])
  })
})

describe('resolving the lot', () => {
  it('leaves out what it cannot work out rather than exporting the alias text', () => {
    const s = studio([{
      id: 'a', order: 0,
      tokens: [tok('good', '#fff'), tok('bad', '{nope}', 'semantic')]
    }], { a: 'enabled' })
    const all = resolveAll(s, 'th')
    expect(all.has('good')).toBe(true)
    expect(all.has('bad')).toBe(false)
  })
})

describe('opening a stored studio', () => {
  it('survives a row with nothing in it', () => {
    const s = hydrateStudio(null)
    expect(s.sets).toHaveLength(1)
    expect(s.themes).toHaveLength(1)
    expect(s.activeTheme).toBe(s.themes[0].id)
  })

  it('drops a token it cannot make sense of and keeps the rest', () => {
    const s = hydrateStudio({
      id: 'x', name: 'X',
      sets: [{ id: 'a', name: 'A', order: 0, tokens: [tok('good', '#fff'), { id: 'z', path: '', type: 'nope', tier: 'primitive', value: 1 }] }],
      themes: [{ id: 't', name: 'T', sets: { a: 'enabled' } }],
      activeTheme: 't'
    })
    expect(s.sets[0].tokens.map((t) => t.path)).toEqual(['good'])
  })

  it('points at a theme that exists', () => {
    const s = hydrateStudio({
      id: 'x', name: 'X',
      sets: [{ id: 'a', name: 'A', order: 0, tokens: [] }],
      themes: [{ id: 't', name: 'T', sets: {} }],
      activeTheme: 'gone'
    })
    expect(s.activeTheme).toBe('t')
  })

  it('round-trips a studio it has already opened', () => {
    const s = hydrateStudio(emptyStudio('Round'))
    expect(hydrateStudio(JSON.parse(JSON.stringify(s)))).toEqual(s)
  })
})
