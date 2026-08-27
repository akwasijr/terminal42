// Where a token ends up on screen, and what gets drawn once instead of many
// times. The old screen sorted every token into one alphabetical grid, which
// is why a badge's corner radius sat next to a font family; these tests are
// the shape of the fix.

import { describe, expect, it } from 'vitest'
import { familiesOf, familyOf, leafOf, sectionOf, SECTIONS } from '../../src/shared/tokens/groups'
import { studioFromFeel } from '../../src/shared/tokens/scaffold'

const t = (path: string, type: string, tier = 'semantic'): { path: string; type: never; tier: never } =>
  ({ path, type, tier }) as never

describe('sectionOf', () => {
  it('lets the type decide wherever the type is enough', () => {
    expect(sectionOf(t('colour.text.primary', 'color'))).toBe('colour')
    expect(sectionOf(t('type.body', 'typography'))).toBe('type')
    expect(sectionOf(t('family.sans', 'fontFamily'))).toBe('type')
    expect(sectionOf(t('lift.resting', 'shadow'))).toBe('elevation')
    expect(sectionOf(t('motion.fast', 'duration'))).toBe('motion')
    expect(sectionOf(t('ease.standard', 'cubicBezier'))).toBe('motion')
  })

  it('breaks the dimension tie on the first path segment', () => {
    // A dimension is a gap, a corner and a border width alike, so the type
    // cannot say which. Only the name the author chose can.
    expect(sectionOf(t('space.4', 'dimension'))).toBe('space')
    expect(sectionOf(t('gap.md', 'dimension'))).toBe('space')
    expect(sectionOf(t('radius.lg', 'dimension'))).toBe('shape')
    expect(sectionOf(t('corner.control', 'dimension'))).toBe('shape')
    expect(sectionOf(t('stroke.hairline', 'dimension'))).toBe('shape')
  })

  it('hears a component say what a number is for at the end of its name', () => {
    // A primitive says it first, a component says it last. Reading only the
    // stem filed every card and badge corner under Space.
    expect(sectionOf(t('badge.radius', 'dimension'))).toBe('shape')
    expect(sectionOf(t('card.radius', 'dimension'))).toBe('shape')
    expect(sectionOf(t('input.stroke', 'dimension'))).toBe('shape')
    expect(sectionOf(t('button.padX', 'dimension'))).toBe('space')
    expect(sectionOf(t('card.pad', 'dimension'))).toBe('space')
  })
})

describe('familyOf', () => {
  it('is everything but the last segment', () => {
    expect(familyOf('palette.brand.600')).toBe('palette.brand')
    expect(familyOf('colour.text.primary')).toBe('colour.text')
    expect(familyOf('type.body')).toBe('type')
    expect(familyOf('lonely')).toBe('lonely')
  })

  it('reads the last segment as the distinguishing part', () => {
    expect(leafOf('palette.brand.600')).toBe('600')
    expect(leafOf('lonely')).toBe('lonely')
  })
})

describe('familiesOf', () => {
  it('calls a run of numbered colours a ramp, in numeric order', () => {
    const fam = familiesOf([
      t('palette.brand.50', 'color', 'primitive'),
      t('palette.brand.500', 'color', 'primitive'),
      t('palette.brand.100', 'color', 'primitive')
    ])
    expect(fam).toHaveLength(1)
    expect(fam[0].ramp).toBe(true)
    // Sorted as numbers, or 1000 would come before 200.
    expect(fam[0].paths.map(leafOf)).toEqual(['50', '100', '500'])
  })

  it('does not call named colours a ramp', () => {
    const fam = familiesOf([
      t('colour.text.primary', 'color'),
      t('colour.text.muted', 'color'),
      t('colour.text.link', 'color')
    ])
    expect(fam[0].ramp).toBe(false)
  })

  it('does not call a pair a ramp', () => {
    // Two swatches are two swatches. A strip of two says nothing a pair of
    // tiles does not, and loses both names.
    const fam = familiesOf([
      t('palette.x.100', 'color', 'primitive'),
      t('palette.x.900', 'color', 'primitive')
    ])
    expect(fam[0].ramp).toBe(false)
  })

  it('sinks the raw shelf below the names', () => {
    const fam = familiesOf([
      t('palette.brand.500', 'color', 'primitive'),
      t('button.primary.bg', 'color', 'component'),
      t('colour.brand.rest', 'color', 'semantic')
    ])
    expect(fam.map((f) => f.id)).toEqual(['colour.brand', 'button.primary', 'palette.brand'])
  })

  it('reads surfaces, then text, then edges, then brand', () => {
    // Alphabetical put Accent first and split Bg from Border with Brand in
    // between: four unrelated things ordered by their first letter.
    const fam = familiesOf([
      t('colour.accent.rest', 'color'),
      t('colour.brand.rest', 'color'),
      t('colour.border.default', 'color'),
      t('colour.text.primary', 'color'),
      t('colour.bg.canvas', 'color')
    ])
    expect(fam.map((f) => f.label)).toEqual(['Bg', 'Text', 'Border', 'Brand', 'Accent'])
  })

  it('reads a type scale as a scale rather than a dictionary', () => {
    const fam = familiesOf([
      t('type.body', 'typography'),
      t('type.caption', 'typography'),
      t('type.display', 'typography'),
      t('type.heading', 'typography')
    ])
    expect(fam[0].paths.map(leafOf)).toEqual(['display', 'heading', 'body', 'caption'])
  })

  it('reads the states of a colour in the order they happen', () => {
    const fam = familiesOf([
      t('colour.brand.active', 'color'),
      t('colour.brand.subtle', 'color'),
      t('colour.brand.hover', 'color'),
      t('colour.brand.rest', 'color')
    ])
    expect(fam[0].paths.map(leafOf)).toEqual(['rest', 'hover', 'active', 'subtle'])
  })

  it('titles a family by its last segment', () => {
    expect(familiesOf([t('colour.bg.canvas', 'color')])[0].label).toBe('Bg')
    expect(familiesOf([t('type.bodyStrong', 'typography')])[0].label).toBe('Type')
  })
})

describe('a scaffolded library through the grouping', () => {
  const studio = studioFromFeel('S', {
    name: 'S',
    primary: '#2563eb',
    secondary: '#f97316',
    tertiary: '#14b8a6',
    headingFont: 'Fraunces',
    bodyFont: 'Inter',
    corner: 'rounded',
    density: 'cozy',
    scale: 'balanced',
    elevation: 'subtle'
  })
  const all = studio.sets.flatMap((s) => s.tokens)

  it('puts every token somewhere a person would look', () => {
    // Nothing should fall through to Other: if it does, the library has a
    // token whose name says nothing about what it is for.
    const other = all.filter((tk) => sectionOf(tk) === 'other')
    expect(other.map((tk) => tk.path)).toEqual([])
  })

  it('fills every section it offers', () => {
    for (const s of SECTIONS) {
      if (s.id === 'other') continue
      expect(all.some((tk) => sectionOf(tk) === s.id), s.id).toBe(true)
    }
  })

  it('draws the colour shelf as a handful of strips rather than a wall', () => {
    const colours = all.filter((tk) => sectionOf(tk) === 'colour' && tk.tier === 'primitive')
    const fam = familiesOf(colours)
    expect(fam.filter((f) => f.ramp)).toHaveLength(7)
    // Every ramp collapses, so the section is rows in single figures rather
    // than the fifty-odd tiles the tokens would otherwise be.
    expect(fam.length).toBeLessThan(10)
  })
})
