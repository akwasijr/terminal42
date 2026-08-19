import { describe, it, expect } from 'vitest'
import { writeFileSync } from 'fs'
import { GOLDEN_EXAMPLES, pickGoldenExamples, deviceFromArtboard, formatGoldenForPrompt } from '../../src/renderer/src/lib/goldenExamples'
import { compileTree } from '../../src/renderer/src/lib/uiTree'
import { buildObject, type ObjectSpec } from '../../src/renderer/src/lib/canvasAgent'
import { lintObjects } from '../../src/renderer/src/lib/designQA'
import { scoreDesign } from '../../src/renderer/src/lib/designEval'
import { DEFAULT_KIT } from '../../src/renderer/src/lib/uiKit'
import { type FObj } from '../../src/renderer/src/lib/freeformTypes'

function render(specs: ObjectSpec[]): FObj[] {
  const built = specs.map((s) => buildObject(s, 0, 0))
  const refToId = new Map<string, string>()
  specs.forEach((s, i) => { if (s.ref) refToId.set(s.ref.toLowerCase(), built[i].id) })
  built.forEach((b, i) => { const p = specs[i].parent; if (typeof p === 'string') { const id = refToId.get(p.toLowerCase()); b.parent = id && id !== b.id ? id : undefined } })
  return lintObjects(built, { artboardBg: '#ffffff', accent: DEFAULT_KIT.accent })
}

describe('golden examples — every tree is at the quality bar', () => {
  for (const ex of GOLDEN_EXAMPLES) {
    it(`${ex.id} compiles to a clean, scored design`, () => {
      const width = ex.device === 'desktop' ? 1440 : 390
      const objs = render(compileTree(ex.tree, { width, accent: DEFAULT_KIT.accent }))
      const s = scoreDesign(objs, { artboardBg: '#ffffff', accent: DEFAULT_KIT.accent, artboard: { w: width, h: ex.device === 'desktop' ? 900 : 844 } })
      expect(objs.length).toBeGreaterThan(8)
      expect(s.overlaps).toBe(0)
      expect(s.contrast).toBeGreaterThanOrEqual(0.85)
      try { writeFileSync(`/tmp/t42-golden-${ex.id}.json`, JSON.stringify(objs)) } catch { /* ignore */ }
      // accent-fill components (primary button / stat tiles / sidebar) must show real accent area
      if (/primaryButton|statTile|barChart|sidebar/.test(JSON.stringify(ex.tree))) {
        expect(s.accentArea).toBeGreaterThan(0.0005)
      }
    })
  }
})

describe('golden retrieval', () => {
  it('infers device from the artboard', () => {
    expect(deviceFromArtboard(1440, 900)).toBe('desktop')
    expect(deviceFromArtboard(390, 844)).toBe('mobile')
    expect(deviceFromArtboard(834, 1194)).toBe('mobile')
  })
  it('picks the finance form for an expense request', () => {
    expect(pickGoldenExamples('an expense tracker entry screen', 'mobile', 1)[0].id).toBe('expense')
  })
  it('picks the analytics dashboard for a desktop admin request', () => {
    expect(pickGoldenExamples('an analytics admin panel with stats and a chart', 'desktop', 1)[0].id).toBe('dashboard')
  })
  it('picks settings for a profile/preferences request', () => {
    expect(pickGoldenExamples('account settings and preferences', 'mobile', 1)[0].id).toBe('settings')
  })
  it('picks checkout for a payment request', () => {
    expect(pickGoldenExamples('checkout and payment summary', 'mobile', 1)[0].id).toBe('checkout')
  })
  it('picks the music player for a now-playing request', () => {
    expect(pickGoldenExamples('a music player now playing screen with album art', 'mobile', 1)[0].id).toBe('player')
  })
  it('prefers the device that matches when keywords are weak', () => {
    expect(pickGoldenExamples('something nice', 'desktop', 1)[0].device).toBe('desktop')
  })
  it('formats a non-empty prompt block that references the screen tree shape', () => {
    const block = formatGoldenForPrompt(pickGoldenExamples('expense form', 'mobile', 1))
    expect(block).toContain('QUALITY REFERENCE')
    expect(block).toContain('kind')
  })
  it('returns nothing when asked for zero', () => {
    expect(pickGoldenExamples('anything', 'mobile', 0)).toHaveLength(0)
  })
})
