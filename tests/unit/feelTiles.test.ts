import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FEEL_PRESETS, applyFeel, DEFAULT_ANSWERS } from '../../src/renderer/src/lib/designSystem'
import { vibeFromWords } from '../../src/renderer/src/lib/vibeFromWords'

const src = readFileSync(
  resolve(__dirname, '../../src/renderer/src/components/DesignSystemWizard.tsx'),
  'utf8'
)

describe('picking the feel of a design system', () => {
  it('no longer asks you to pick one of nine tiles', () => {
    // The nine tiles asked you to name a feel before you had said what you
    // were making. The description now carries it.
    expect(src).not.toContain('FEEL_OPTIONS')
    expect(src).not.toMatch(/SelectField label="Feel"/)
    expect(src).not.toContain('<FeelSwatch')
    expect(src).not.toMatch(/const FEELS\b/)
  })

  it('keeps both ways in', () => {
    expect(src).toContain('Describe your own')
    expect(src).toContain('Match a screenshot')
    expect(src).toContain('<WriteItSwatch')
    expect(src).toContain('<ScreenshotSwatch')
  })

  it('reads the feel out of the description as you type', () => {
    expect(src).toContain('onChange={(e) => onStyleWords(e.target.value)}')
    expect(src).toContain('vibeFromWords')
  })

  it('gives every preset a distinct look to reach', () => {
    const fingerprints = Object.values(FEEL_PRESETS).map(
      (f) => [f.cornerStyle, f.borderStyle, f.fill, f.primary, f.secondary, f.tertiary].join('|')
    )
    expect(new Set(fingerprints).size).toBe(fingerprints.length)
  })

  it('every feel a description can name is one applyFeel can apply', () => {
    for (const vibe of Object.keys(FEEL_PRESETS)) {
      const applied = applyFeel(DEFAULT_ANSWERS, vibe as keyof typeof FEEL_PRESETS)
      expect(applied.vibe).toBe(vibe)
      expect(applied.headingFont).toBe(FEEL_PRESETS[vibe as keyof typeof FEEL_PRESETS].headingFont)
    }
  })

  it('turns two different descriptions into two different systems', () => {
    const luxe = applyFeel(DEFAULT_ANSWERS, vibeFromWords('premium gold luxury exclusive'))
    const technical = applyFeel(DEFAULT_ANSWERS, vibeFromWords('a dense monospace developer tool'))
    expect(luxe.vibe).toBe('luxe')
    expect(technical.vibe).toBe('technical')
    expect(luxe.headingFont).not.toBe(technical.headingFont)
  })
})
