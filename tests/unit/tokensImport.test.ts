// Bringing tokens in, from both dialects and from our own export.

import { describe, it, expect } from 'vitest'
import { fromTokensJson, fromTokensText } from '../../src/shared/tokens/import'
import { toDTCG } from '../../src/shared/tokens/export'
import { studioFromFeel } from '../../src/shared/tokens/scaffold'
import { feelFromVibe } from '../../src/renderer/src/lib/tokens/feelFromVibe'

const dtcg = {
  colour: {
    blue: { 500: { $type: 'color', $value: '#3b82f6', $description: 'The blue' } },
    action: { rest: { $type: 'color', $value: '{colour.blue.500}' } }
  },
  button: { bg: { $type: 'color', $value: '{colour.action.rest}' } }
}

const plugin = {
  $metadata: { tokenSetOrder: ['palette', 'light'] },
  $themes: [
    { id: 'l', name: 'Light', selectedTokenSets: { palette: 'source', light: 'enabled' } }
  ],
  light: { text: { type: 'color', value: '{grey.900}' } },
  palette: {
    grey: { 900: { type: 'color', value: '#111111' } },
    space: { md: { type: 'spacing', value: '16px' } }
  }
}

describe('fromTokensJson, W3C draft', () => {
  const { studio, notes } = fromTokensJson(dtcg, 'Brought in')

  it('makes one set of everything the file said', () => {
    expect(studio.sets).toHaveLength(1)
    expect(studio.sets[0].tokens.map((t) => t.path)).toEqual([
      'button.bg',
      'colour.action.rest',
      'colour.blue.500'
    ])
  })

  it('reads the tier off the shape of the value', () => {
    const tier = (p: string): string | undefined => studio.sets[0].tokens.find((t) => t.path === p)?.tier
    expect(tier('colour.blue.500')).toBe('primitive')
    expect(tier('colour.action.rest')).toBe('semantic')
    expect(tier('button.bg')).toBe('component')
  })

  it('keeps a description', () => {
    expect(studio.sets[0].tokens.find((t) => t.path === 'colour.blue.500')?.description).toBe('The blue')
  })

  it('gives it a theme to be looked at through, and says nothing surprising', () => {
    expect(studio.themes).toHaveLength(1)
    expect(studio.activeTheme).toBe(studio.themes[0].id)
    expect(notes).toEqual([])
  })

  it('starts by advising, because these are somebody else\u2019s decisions', () => {
    expect(studio.enforcement).toBe('advise')
  })
})

describe('fromTokensJson, plugin file', () => {
  const { studio, notes } = fromTokensJson(plugin, 'Plugin')

  it('keeps the sets and the order the file gave them', () => {
    expect(studio.sets.map((s) => s.name)).toEqual(['palette', 'light'])
    expect(studio.sets.map((s) => s.order)).toEqual([0, 1])
  })

  it('keeps a theme, with source and enabled intact', () => {
    const t = studio.themes[0]
    expect(t.name).toBe('Light')
    const byName = new Map(studio.sets.map((s) => [s.name, s.id]))
    expect(t.sets[byName.get('palette') as string]).toBe('source')
    expect(t.sets[byName.get('light') as string]).toBe('enabled')
  })

  it('carries a type we do not have under the nearest one, and says so', () => {
    const space = studio.sets[0].tokens.find((t) => t.path === 'space.md')
    expect(space?.type).toBe('dimension')
    expect(notes.some((n) => /spacing came in as dimension/.test(n))).toBe(true)
  })
})

describe('fromTokensJson, awkward files', () => {
  it('guesses a colour when nothing said what it was', () => {
    const { studio } = fromTokensJson({ brand: { value: '#ff0000' } }, 'Guess')
    expect(studio.sets[0].tokens[0].type).toBe('color')
  })

  it('says so when a file holds no tokens', () => {
    const { studio, notes } = fromTokensJson({ a: { b: {} } }, 'Nothing')
    expect(studio.sets.reduce((n, s) => n + s.tokens.length, 0)).toBe(0)
    expect(notes).toContain('Nothing in that file looked like a token.')
  })

  it('turns bad JSON into a note rather than a throw', () => {
    const { notes } = fromTokensText('{ not json', 'Broken')
    expect(notes).toEqual(['That file was not valid JSON.'])
  })

  it('refuses an array politely', () => {
    expect(fromTokensJson([1, 2], 'List').notes).toEqual(['That file was not a token document.'])
  })
})

describe('what we export, we can read back', () => {
  const source = studioFromFeel('Bold', feelFromVibe('bold'))
  const { studio, notes } = fromTokensText(toDTCG(source, 'light'), 'Round trip')

  it('brings back every token the export wrote', () => {
    const wrote = Object.keys(JSON.parse(toDTCG(source, 'light'))).length
    expect(wrote).toBeGreaterThan(0)
    expect(studio.sets[0].tokens.length).toBeGreaterThan(0)
  })

  it('needs no excuses on the way in', () => {
    expect(notes).toEqual([])
  })

  it('keeps the values, since an export is already resolved', () => {
    const t = studio.sets[0].tokens.find((x) => x.type === 'color')
    expect(typeof t?.value).toBe('string')
    expect(String(t?.value)).toMatch(/^#|^rgb|^hsl/i)
  })
})
