// How the stylesheet is written.

import { describe, it, expect } from 'vitest'
import { toCSS, toMarkdown } from '../../src/shared/tokens/export'
import { cssOptionsOf, type TokenStudio } from '../../src/shared/tokens/types'

const base: TokenStudio = {
  id: 'ts',
  name: 'Ours',
  sets: [
    {
      id: 's1',
      name: 'Core',
      order: 0,
      tokens: [
        { id: '1', path: 'colour.text.primary', type: 'color', value: '#111111', tier: 'semantic' },
        { id: '2', path: 'button.backgroundHover', type: 'color', value: '#222222', tier: 'component' }
      ]
    },
    {
      id: 's2',
      name: 'Dark',
      order: 1,
      tokens: [{ id: '3', path: 'colour.text.primary', type: 'color', value: '#eeeeee', tier: 'semantic' }]
    }
  ],
  themes: [
    { id: 'light', name: 'Light', sets: { s1: 'enabled', s2: 'off' } },
    { id: 'dark', name: 'Dark mode', sets: { s1: 'enabled', s2: 'enabled' } }
  ],
  activeTheme: 'light'
}

const withCss = (css: Partial<ReturnType<typeof cssOptionsOf>>): TokenStudio => ({
  ...base,
  css: cssOptionsOf(css)
})

describe('cssOptionsOf', () => {
  it('fills in what an older library never stored', () => {
    expect(cssOptionsOf(undefined)).toEqual({
      prefix: '',
      selector: ':root',
      casing: 'kebab',
      layer: '',
      allThemes: false
    })
  })

  it('refuses an empty selector rather than writing one', () => {
    expect(cssOptionsOf({ selector: '   ' }).selector).toBe(':root')
  })
})

describe('toCSS', () => {
  it('writes kebab names under :root by default', () => {
    const css = toCSS(base, 'light')
    expect(css).toContain(':root {')
    expect(css).toContain('--colour-text-primary: #111111;')
    expect(css).toContain('--button-background-hover: #222222;')
  })

  it('still takes a selector as its third argument, as it always did', () => {
    expect(toCSS(base, 'light', '.theme')).toContain('.theme {')
  })

  it('puts a prefix in front of every name', () => {
    expect(toCSS(withCss({ prefix: 't42' }), 'light')).toContain('--t42-colour-text-primary:')
  })

  it('spells names the way the receiving codebase does', () => {
    expect(toCSS(withCss({ casing: 'snake' }), 'light')).toContain('--colour_text_primary:')
    expect(toCSS(withCss({ casing: 'camel' }), 'light')).toContain('--colourTextPrimary:')
    expect(toCSS(withCss({ casing: 'camel' }), 'light')).toContain('--buttonBackgroundHover:')
  })

  it('wraps the file in a layer when asked, so an app can order it', () => {
    const css = toCSS(withCss({ layer: 'tokens' }), 'light')
    expect(css.startsWith('@layer tokens {\n')).toBe(true)
    expect(css.trimEnd().endsWith('}')).toBe(true)
    expect(css).toContain('  :root {')
  })

  it('writes only the theme on screen unless told otherwise', () => {
    const css = toCSS(base, 'light')
    expect(css).not.toContain('data-theme')
    expect(css).not.toContain('#eeeeee')
  })

  it('writes the other themes under an attribute, which is how they are switched', () => {
    const css = toCSS(withCss({ allThemes: true }), 'light')
    expect(css).toContain(':root {')
    expect(css).toContain('[data-theme="dark-mode"] {')
    expect(css).toContain('#eeeeee')
  })

  it('is the same bytes twice, so a re-export is a no-op in a diff', () => {
    const opts = withCss({ prefix: 'x', allThemes: true, layer: 'tokens' })
    expect(toCSS(opts, 'light')).toBe(toCSS(opts, 'light'))
  })
})

describe('the other two files', () => {
  it('quote the variable names that were actually written', () => {
    const md = toMarkdown(withCss({ prefix: 't42', casing: 'snake' }), 'light')
    expect(md).toContain('--t42_colour_text_primary')
  })
})
