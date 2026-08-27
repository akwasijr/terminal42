import { describe, it, expect } from 'vitest'
import { formatTokensForPrompt, toCSS, toDTCG, toMarkdown } from '../../src/shared/tokens/export'
import type { Token, TokenStudio } from '../../src/shared/tokens/types'

const FEEL: Feel = {
  name: 'Test',
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
import { studioFromFeel, type Feel } from '../../src/shared/tokens/scaffold'

const tok = (path: string, value: Token['value'], tier: Token['tier'] = 'primitive', type: Token['type'] = 'color'): Token =>
  ({ id: `k${path}`, path, value, tier, type })

const s: TokenStudio = {
  id: 'x',
  name: 'X',
  sets: [
    { id: 'palette', name: 'Palette', order: 0, tokens: [tok('blue.500', '#2f6fed'), tok('grey.900', '#151515')] },
    {
      id: 'core',
      name: 'Core',
      order: 1,
      tokens: [
        tok('colour.action', '{blue.500}', 'semantic'),
        { id: 'sp', path: 'space.4', type: 'dimension', tier: 'primitive', value: 16 },
        { id: 'sh', path: 'shadow.card', type: 'shadow', tier: 'semantic', value: { x: 0, y: 1, blur: 3, color: '{grey.900}' } }
      ]
    }
  ],
  themes: [{ id: 'th', name: 'Theme', sets: { palette: 'source', core: 'enabled' } }],
  activeTheme: 'th'
}

describe('writing DTCG', () => {
  it('nests by path and writes values rather than aliases', () => {
    const doc = JSON.parse(toDTCG(s, 'th'))
    expect(doc.colour.action).toEqual({ $type: 'color', $value: '#2f6fed' })
  })

  it('leaves a source set out of the file', () => {
    const doc = JSON.parse(toDTCG(s, 'th'))
    expect(doc.blue).toBeUndefined()
    expect(doc.grey).toBeUndefined()
  })

  it('resolves the fields of a composite on the way out', () => {
    const doc = JSON.parse(toDTCG(s, 'th'))
    expect(doc.shadow.card.$value.color).toBe('#151515')
  })

  it('writes the same bytes twice', () => {
    expect(toDTCG(s, 'th')).toBe(toDTCG(s, 'th'))
  })

  it('is stable when the tokens are written in another order', () => {
    const shuffled: TokenStudio = {
      ...s,
      sets: s.sets.map((set) => ({ ...set, tokens: [...set.tokens].reverse() }))
    }
    expect(toDTCG(shuffled, 'th')).toBe(toDTCG(s, 'th'))
  })
})

describe('writing custom properties', () => {
  it('turns a path into a property name', () => {
    expect(toCSS(s, 'th')).toContain('--colour-action: #2f6fed;')
  })

  it('gives a dimension its unit', () => {
    expect(toCSS(s, 'th')).toContain('--space-4: 16px;')
  })

  it('writes a shadow as one usable value', () => {
    expect(toCSS(s, 'th')).toContain('--shadow-card: 0px 1px 3px 0px #151515;')
  })

  it('takes the selector it is given, so a theme can be a data attribute', () => {
    expect(toCSS(s, 'th', '[data-theme="dark"]')).toMatch(/^\[data-theme="dark"\] \{/)
  })

  it('writes the same bytes twice', () => {
    expect(toCSS(s, 'th')).toBe(toCSS(s, 'th'))
  })
})

describe('css names', () => {
  it('kebabs inside a segment as well as between them', () => {
    const studio = studioFromFeel('n', {
      name: 'n',
      primary: '#4338ca',
      secondary: '#0a2540',
      tertiary: '#06b6d4',
      headingFont: 'Geist',
      bodyFont: 'Geist',
      corner: 'slight',
      density: 'cozy',
      scale: 'balanced',
      elevation: 'flat'
    })
    const css = toCSS(studio, 'light')
    expect(css).toContain('--button-primary-bg-hover')
    expect(css).not.toMatch(/--[a-z-]*[A-Z]/)
  })
})

describe('toMarkdown', () => {
  it('groups the referenceable names by section and leaves the shelf out', () => {
    const studio = studioFromFeel('Test', FEEL)
    const md = toMarkdown(studio, studio.activeTheme)
    expect(md).toContain('## Colour')
    expect(md).toContain('| Variable | Value | Use for |')
    // A semantic name is there to be used.
    expect(md).toMatch(/--colour-text-primary/)
    // A primitive is the shelf it was built from, and naming it invites a page
    // to reach past the library instead of into it.
    expect(md).not.toMatch(/--neutral-900/)
  })

  it('writes the same bytes twice', () => {
    const studio = studioFromFeel('Test', FEEL)
    expect(toMarkdown(studio, studio.activeTheme)).toBe(toMarkdown(studio, studio.activeTheme))
  })

  it('never lets a value break the table it sits in', () => {
    const studio = studioFromFeel('Test', FEEL)
    const md = toMarkdown(studio, studio.activeTheme)
    for (const line of md.split('\n').filter((l) => l.startsWith('| `--'))) {
      expect(line.split('|').length).toBe(5)
    }
  })
})

describe('formatTokensForPrompt', () => {
  it('tells the model what to use and what not to write', () => {
    const studio = studioFromFeel('Test', FEEL)
    const block = formatTokensForPrompt(studio, studio.activeTheme)
    expect(block).toMatch(/Use only these/)
    expect(block).toMatch(/never write a raw/i)
    expect(block).toMatch(/--colour-text-primary \(#/)
  })

  it('is quiet when there is nothing to say', () => {
    expect(formatTokensForPrompt({ id: 'x', name: 'x', sets: [], themes: [], activeTheme: null }, null)).toBe('')
  })
})
