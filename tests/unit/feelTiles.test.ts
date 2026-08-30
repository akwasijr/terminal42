import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FEEL_PRESETS } from '../../src/renderer/src/lib/designSystem'

const src = readFileSync(
  resolve(__dirname, '../../src/renderer/src/components/DesignSystemWizard.tsx'),
  'utf8'
)

describe('picking the feel of a design system', () => {
  it('shows the feels rather than listing them in a dropdown', () => {
    // Nine visual identities behind a <select> meant choosing a look by
    // reading nine words.
    expect(src).not.toContain('FEEL_OPTIONS')
    expect(src).not.toMatch(/SelectField label="Feel"/)
    expect(src).toContain('<FeelSwatch')
  })

  it('keeps both escape hatches alongside the presets', () => {
    expect(src).toContain('Describe your own')
    expect(src).toContain('Match a screenshot')
    // Neither has a look yet, so neither borrows a preset's drawing.
    expect(src).toContain('<WriteItSwatch')
    expect(src).toContain('<ScreenshotSwatch')
  })

  it('draws each swatch from the preset it stands for', () => {
    for (const key of ['cornerStyle', 'borderStyle', 'headingFont', 'primary', 'fill']) {
      expect(src, `swatch ignores ${key}`).toMatch(new RegExp(`f\\.${key}`))
    }
  })

  it('has a corner size for every corner style a preset can use', () => {
    const styles = new Set(Object.values(FEEL_PRESETS).map((f) => f.cornerStyle))
    const mapped = src.slice(src.indexOf('CORNER_PX'), src.indexOf('}', src.indexOf('CORNER_PX')))
    for (const s of styles) expect(mapped, `no corner size for ${s}`).toContain(`${s}:`)
  })

  it('gives every preset a distinct look to show', () => {
    // If two presets shared corners, border, fill and all three colours the
    // tiles would be indistinguishable.
    const fingerprints = Object.values(FEEL_PRESETS).map(
      (f) => [f.cornerStyle, f.borderStyle, f.fill, f.primary, f.secondary, f.tertiary].join('|')
    )
    expect(new Set(fingerprints).size).toBe(fingerprints.length)
  })
})
