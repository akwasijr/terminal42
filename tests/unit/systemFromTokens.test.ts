// A design system reading its values out of its token library.
//
// The two used to hold the same colours in two shapes with nothing keeping
// them in step, so a team could change their blue in one and watch the other
// stay the old blue, with no way to tell which was wrong because both were
// saved and both looked deliberate. These tests are the shape of the fix:
// the library answers, the system reads.

import { describe, expect, it } from 'vitest'
import { studioFromFeel } from '../../src/shared/tokens/scaffold'
import { applyStudioToSystem } from '../../src/renderer/src/lib/tokens/toDesignSystem'
import type { DesignSystem } from '../../src/renderer/src/lib/designSystem'
import type { TokenStudio } from '../../src/shared/tokens/types'

const system = (): DesignSystem =>
  ({
    id: 'a',
    name: 'A',
    vibe: 'minimal',
    base: 'light',
    colors: {
      primary: '#000001', secondary: '#000002', tertiary: '#000003', bg: '#000004',
      surface: '#000005', text: '#000006', textMuted: '#000007', border: '#000008',
      success: '#000009', warning: '#00000a', error: '#00000b', info: '#00000c'
    },
    font: { family: 'Old', heading: 'Old' },
    type: { xs: 1, sm: 2, base: 3, md: 4, lg: 5, xl: 6, xxl: 7, xxxl: 8 },
    weights: { regular: 1, medium: 2, semibold: 3, bold: 4 },
    spacing: [0, 1, 2, 3],
    radii: { sm: 1, md: 2, lg: 3, pill: 4 },
    shadow: 'subtle',
    motion: { fast: 1, normal: 2, slow: 3, easing: 'linear' }
  }) as DesignSystem

const library = (): TokenStudio =>
  studioFromFeel('Lib', {
    name: 'Lib',
    primary: '#2f6f4f',
    secondary: '#b4642a',
    tertiary: '#2c5aa0',
    headingFont: 'Fraunces',
    bodyFont: 'DM Sans',
    corner: 'rounded',
    density: 'cozy',
    scale: 'balanced',
    elevation: 'subtle'
  })

describe('a system standing on a library', () => {
  it('takes its colours from the library rather than its own copy', () => {
    const out = applyStudioToSystem(system(), library(), 'light')
    expect(out.colors.primary).not.toBe('#000001')
    expect(out.colors.primary).toMatch(/^#[0-9a-f]{6}$/i)
    expect(out.colors.text).not.toBe('#000006')
  })

  it('takes its typefaces and type scale from the library', () => {
    const out = applyStudioToSystem(system(), library(), 'light')
    expect(out.font.family).toBe('DM Sans')
    expect(out.font.heading).toBe('Fraunces')
    // The scale is a real ramp, not the placeholder 1..8 above.
    expect(out.type.base).toBeGreaterThan(10)
    expect(out.type.xxxl).toBeGreaterThan(out.type.base)
  })

  it('keeps everything the library has no opinion about', () => {
    // The name, the brief, the docs, the components: the parts that make it a
    // design system rather than a second copy of the palette.
    const before = { ...system(), notes: 'ours', components: [{ id: 'Button', variants: ['Primary'], states: ['Default'] }] }
    const out = applyStudioToSystem(before, library(), 'light')
    expect(out.name).toBe('A')
    expect(out.notes).toBe('ours')
    expect(out.components).toEqual(before.components)
  })

  it('reads a duration as a number and a measure as neither', () => {
    // `65ch` is a dimension that is not pixels. Reading it as 65 would put a
    // character count where a pixel value goes and nothing would complain.
    const out = applyStudioToSystem(system(), library(), 'light')
    expect(Number.isFinite(out.motion.normal)).toBe(true)
    expect(out.motion.normal).toBeGreaterThan(0)
  })

  it('leaves the system alone when the library resolves to nothing', () => {
    const empty: TokenStudio = { id: 'x', name: 'x', sets: [], themes: [], activeTheme: null }
    expect(applyStudioToSystem(system(), empty, null)).toEqual(system())
  })

  it('follows the theme it is asked for', () => {
    const lib = library()
    const light = applyStudioToSystem(system(), lib, 'light')
    const dark = applyStudioToSystem(system(), lib, 'dark')
    expect(dark.base).toBe('dark')
    expect(dark.colors.bg).not.toBe(light.colors.bg)
  })
})

// The scaffold names a brand colour `colour.brand.rest`; libraries written by
// the other hand name it plainly `colour.brand`. Both are saved on real
// machines, so the reader has to answer to both names or a system standing on
// half the libraries in the app quietly keeps its own generated colours and
// looks linked when it is not.
const plainVocabulary = (): TokenStudio => ({
  id: 'ts2',
  name: 'Calm',
  activeTheme: 'light',
  themes: [
    { id: 'light', name: 'Light', sets: { p: 'source', l: 'enabled' } },
    { id: 'dark', name: 'Dark', sets: { p: 'source', l: 'off' } }
  ],
  sets: [
    {
      id: 'p',
      name: 'Palette',
      order: 0,
      tokens: [
        { path: 'palette.brand.600', type: 'color', tier: 'primitive', value: '#3f7d5b' },
        { path: 'palette.accent.600', type: 'color', tier: 'primitive', value: '#b4642a' },
        { path: 'palette.support.600', type: 'color', tier: 'primitive', value: '#2c5aa0' },
        { path: 'palette.white', type: 'color', tier: 'primitive', value: '#ffffff' },
        { path: 'palette.neutral.200', type: 'color', tier: 'primitive', value: '#e5e5e5' },
        { path: 'palette.neutral.50', type: 'color', tier: 'primitive', value: '#fafafa' },
        { path: 'family.body', type: 'fontFamily', tier: 'primitive', value: 'Lato' },
        { path: 'family.heading', type: 'fontFamily', tier: 'primitive', value: 'Merriweather' }
      ]
    },
    {
      id: 'l',
      name: 'Light',
      order: 1,
      tokens: [
        { path: 'colour.brand', type: 'color', tier: 'semantic', value: '{palette.brand.600}' },
        { path: 'colour.accent', type: 'color', tier: 'semantic', value: '{palette.accent.600}' },
        { path: 'colour.support', type: 'color', tier: 'semantic', value: '{palette.support.600}' },
        { path: 'colour.background', type: 'color', tier: 'semantic', value: '{palette.neutral.50}' },
        { path: 'colour.surface', type: 'color', tier: 'semantic', value: '{palette.white}' },
        { path: 'colour.border', type: 'color', tier: 'semantic', value: '{palette.neutral.200}' },
        { path: 'colour.positive', type: 'color', tier: 'semantic', value: '#16a34a' },
        { path: 'colour.caution', type: 'color', tier: 'semantic', value: '#d97706' },
        { path: 'colour.critical', type: 'color', tier: 'semantic', value: '#dc2626' }
      ]
    }
  ]
})

describe('a library that names its semantics plainly', () => {
  it('is read as readily as the scaffold vocabulary', () => {
    const out = applyStudioToSystem(system(), plainVocabulary(), 'light')
    expect(out.colors.primary).toBe('#3f7d5b')
    expect(out.colors.secondary).toBe('#b4642a')
    expect(out.colors.tertiary).toBe('#2c5aa0')
    expect(out.colors.bg).toBe('#fafafa')
    expect(out.colors.surface).toBe('#ffffff')
    expect(out.colors.border).toBe('#e5e5e5')
    expect(out.colors.success).toBe('#16a34a')
    expect(out.colors.warning).toBe('#d97706')
    expect(out.colors.error).toBe('#dc2626')
    expect(out.font.family).toBe('Lato')
    expect(out.font.heading).toBe('Merriweather')
  })

  it('does not cost the scaffold vocabulary its own answers', () => {
    const out = applyStudioToSystem(system(), library(), 'light')
    expect(out.font.family).toBe('DM Sans')
    expect(out.font.heading).toBe('Fraunces')
    expect(out.colors.primary).toMatch(/^#[0-9a-f]{6}$/i)
    expect(out.colors.primary).not.toBe('#000001')
    expect(out.colors.surface).not.toBe('#000005')
    expect(out.colors.border).not.toBe('#000008')
  })
})
