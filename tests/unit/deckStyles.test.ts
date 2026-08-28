// A house style is prose, and prose does not fail loudly.
//
// If a style loses its palette, or two styles drift into describing the same
// deck, nothing throws — the decks just quietly go back to looking alike,
// which is the exact problem the registry exists to solve. So the checks here
// are about the shape of the data and about the promises pickDeckStyle makes:
// same brief, same house; different decks, different houses; and anything the
// user already answered is not answered again by the style.

import { describe, it, expect } from 'vitest'
import { DECK_STYLES, deckStyleById, pickDeckStyle } from '../../src/main/deckStyles'
import type { DesignBrief } from '../../src/main/design.types'

function brief(over: Partial<DesignBrief> = {}): DesignBrief {
  return {
    v: 1,
    kind: 'pitch-deck',
    kindLabel: 'Pitch deck',
    group: 'presentation',
    fidelity: 'highfidelity',
    createdAt: 1000,
    ...over,
  } as DesignBrief
}

describe('deck house styles', () => {
  it('offers several genuinely different houses', () => {
    expect(DECK_STYLES.length).toBeGreaterThanOrEqual(5)
    expect(new Set(DECK_STYLES.map((s) => s.id)).size).toBe(DECK_STYLES.length)
    expect(new Set(DECK_STYLES.map((s) => s.label)).size).toBe(DECK_STYLES.length)
  })

  it('finds a style by id, and nothing by a made-up one', () => {
    expect(deckStyleById(DECK_STYLES[0].id)?.label).toBe(DECK_STYLES[0].label)
    expect(deckStyleById('no-such-house')).toBeNull()
  })

  for (const style of DECK_STYLES) {
    describe(style.label, () => {
      it('names a palette of real colours with a role each', () => {
        expect(style.palette.length).toBeGreaterThanOrEqual(4)
        for (const p of style.palette) {
          expect(p.hex, `${style.id} ${p.role}`).toMatch(/^#[0-9A-F]{6}$/)
          expect(p.role.trim().length).toBeGreaterThan(2)
        }
        expect(new Set(style.palette.map((p) => p.hex)).size).toBe(style.palette.length)
      })

      // Every field is instruction to a model. A one-word answer tells it
      // nothing it did not already assume, which is how a house style
      // silently becomes a default again.
      it('says enough in every part to actually direct a deck', () => {
        for (const key of ['note', 'slideGrounds', 'type', 'furniture', 'imagery', 'data', 'sequence'] as const) {
          expect(style[key].length, `${style.id}.${key}`).toBeGreaterThan(40)
        }
      })

      it('describes a running order of several slides', () => {
        expect(style.sequence.split(',').length).toBeGreaterThanOrEqual(6)
      })
    })
  }
})

describe('pickDeckStyle', () => {
  it('is deterministic for the same brief, so a deck keeps its house while it is edited', () => {
    const a = pickDeckStyle(brief({ createdAt: 42, idea: 'a seed round' }))
    const b = pickDeckStyle(brief({ createdAt: 42, idea: 'a seed round' }))
    expect(a.styleId).toBe(b.styleId)
    expect(a.text).toBe(b.text)
  })

  it('spreads across the houses rather than favouring one', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 60; i++) {
      seen.add(pickDeckStyle(brief({ createdAt: i * 977 + 3, idea: 'deck ' + i })).styleId)
    }
    expect(seen.size).toBe(DECK_STYLES.length)
  })

  it('names its house and gives the furniture, imagery, data and order every time', () => {
    const text = pickDeckStyle(brief()).text
    expect(text).toContain('DECK HOUSE STYLE')
    expect(text).toContain('Slide furniture:')
    expect(text).toContain('Imagery:')
    expect(text).toContain('Numbers and charts:')
    expect(text).toContain('Running order:')
  })

  it('drops its own palette when the brief already picked one', () => {
    const free = pickDeckStyle(brief())
    expect(free.text).toContain('Palette:')
    for (const pinned of [
      brief({ primaryColor: '#3b352c' }),
      brief({ paletteId: 'forest' }),
      brief({ paletteColors: ['#101010'] }),
      brief({ tokensId: 'lib-1' }),
    ]) {
      const t = pickDeckStyle(pinned).text
      expect(t).not.toContain('- Palette:')
      expect(t).toContain('use the palette already given in this brief')
      // The layout half of the house survives: that is the part doing the work.
      expect(t).toContain('Running order:')
    }
  })

  it('drops its own type when the brief already picked fonts', () => {
    expect(pickDeckStyle(brief()).text).toContain('- Type:')
    expect(pickDeckStyle(brief({ fontHeading: 'Fraunces' })).text).not.toContain('- Type:')
    expect(pickDeckStyle(brief({ fontPairId: 'pair-2' })).text).not.toContain('- Type:')
  })

  it('defers to a look the user asked for instead of replacing it', () => {
    const t = pickDeckStyle(brief({ look: 'brutalist' })).text
    expect(t).toContain('"brutalist"')
    expect(t).toContain('rather than replacing it')
  })

  it('rules out the default deck by name', () => {
    expect(pickDeckStyle(brief()).text).toContain('three equal bullet points')
  })
})

// The registry is worthless if the prompt never carries it. This is the wiring
// itself: a deck brief must arrive at the model with a house on it, and a web
// brief must not, because web already has its own art direction and two
// competing directions is worse than either.
describe('the house style reaches the prompt', () => {
  it('puts a house on a presentation brief', async () => {
    const { buildPrefix } = await import('../../src/main/design')
    const text = buildPrefix('v2.html', brief())
    expect(text).toContain('DECK HOUSE STYLE')
    expect(text).toContain('Running order:')
  })

  it('leaves web pages to the art direction they already have', async () => {
    const { buildPrefix } = await import('../../src/main/design')
    const text = buildPrefix('v2.html', brief({ kind: 'landing', group: 'web' }))
    expect(text).not.toContain('DECK HOUSE STYLE')
    expect(text).toContain('ART DIRECTION')
  })

  it('keeps the house across an iteration turn', async () => {
    const { buildPrefix } = await import('../../src/main/design')
    const b = brief({ createdAt: 77, idea: 'series A' })
    const first = buildPrefix('v2.html', b)
    const second = buildPrefix('v3.html', b, 'v2.html')
    const house = (t: string): string => t.split('- House: ')[1]?.split('\n')[0] ?? ''
    expect(house(second)).toBe(house(first))
    expect(house(first).length).toBeGreaterThan(0)
  })
})
