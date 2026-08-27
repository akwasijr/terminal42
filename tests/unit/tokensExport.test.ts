import { describe, it, expect } from 'vitest'
import { toCSS, toDTCG } from '../../src/shared/tokens/export'
import type { Token, TokenStudio } from '../../src/shared/tokens/types'
import { studioFromFeel } from '../../src/shared/tokens/scaffold'

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
    expect(css).toContain('--button-background-hover')
    expect(css).not.toMatch(/--[a-z-]*[A-Z]/)
  })
})
