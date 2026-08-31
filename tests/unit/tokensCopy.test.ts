// A guard against the thing that keeps happening.
//
// Every panel in the token studio started as a label and grew an explanation,
// then the explanation grew a second clause, and the result reads as filler
// rather than help — "way too much text… it makes it look unprofessional and
// too much AI generated" was the verdict, and the fix does not hold unless
// something checks it.
//
// So: microcopy has a length, panels get one explanation rather than one per
// row, and both of those are assertions rather than intentions.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ENFORCEMENT_OPTIONS, MENU_HINT_LIMIT } from '../../src/shared/tokens/enforcementCopy'
import { CHECKS } from '../../src/shared/tokens/coverage'

const view = readFileSync(
  join(__dirname, '../../src/renderer/src/components/tokens/TokensView.tsx'),
  'utf8'
)

describe('the off-library setting', () => {
  it('says each rung in a few words, not a sentence', () => {
    for (const o of ENFORCEMENT_OPTIONS) {
      expect(o.hint.length, `${o.label}: "${o.hint}"`).toBeLessThanOrEqual(MENU_HINT_LIMIT)
      // A full stop is the tell: it means somebody wrote a sentence.
      expect(o.hint.endsWith('.'), `${o.label} ends in a full stop`).toBe(false)
    }
  })

  it('keeps the rungs cumulative rather than repeating itself', () => {
    // Each rung after the first continues the one above it.
    expect(ENFORCEMENT_OPTIONS[0].hint.startsWith('…')).toBe(false)
    for (const o of ENFORCEMENT_OPTIONS.slice(1)) {
      expect(o.hint.startsWith('…'), `${o.label} should continue the rung above`).toBe(true)
    }
  })

  it('has one option per enforcement level and no duplicates', () => {
    expect(ENFORCEMENT_OPTIONS.map((o) => o.id)).toEqual(['advise', 'check', 'block'])
    expect(new Set(ENFORCEMENT_OPTIONS.map((o) => o.hint)).size).toBe(ENFORCEMENT_OPTIONS.length)
  })
})

describe('the gaps panel', () => {
  it('names each gap in a few words', () => {
    for (const c of CHECKS) {
      expect(c.label.length, `"${c.label}"`).toBeLessThanOrEqual(40)
    }
  })

  it('gives the reason in one sentence that fits the slot', () => {
    // The slot reserves two lines. A reason longer than that either clips or
    // pushes the button down as the pointer moves, which is the jumping panel
    // the reserved slot exists to prevent.
    for (const c of CHECKS) {
      expect(c.why.length, `"${c.why}"`).toBeLessThanOrEqual(74)
      expect(c.why.split('. ').length, `"${c.why}"`).toBeLessThanOrEqual(1)
    }
  })

  it('says what is missing in the section it is missing from', () => {
    // The gaps used to live behind a header chip reading "Complete", which
    // named neither where they were nor what they were. The list now sits at
    // the foot of the section it belongs to.
    expect(view).toContain('Not decided yet')
    expect(view).toContain('gaps.get(s.id)')
  })

  it('carries the reason without spending a line on it', () => {
    // Fifteen reasons rendered at once is fifteen paragraphs nobody reads;
    // none at all leaves a label with no way to find out what it means.
    expect(view).toContain('title={g.why}')
  })

  it('offers one way to settle them all', () => {
    expect(view).toContain('Decide them from what is here')
    expect(view).toContain('fillGaps(studio, themeId)')
  })
})

describe('the token studio menus generally', () => {
  it('does not carry a paragraph of explanation per row anywhere', () => {
    // `leading-relaxed` is what a paragraph gets. Inside a repeated row it is
    // the signature of the pattern this test exists to stop, so it is allowed
    // only in the handful of single, non-repeated explanation slots.
    const relaxed = view.match(/leading-relaxed/g) ?? []
    expect(relaxed.length).toBeLessThanOrEqual(6)
  })
})
