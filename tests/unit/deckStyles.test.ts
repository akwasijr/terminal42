// A house style is values plus prose, and neither fails loudly.
//
// If a house loses a chassis variable, or two houses drift into describing the
// same deck, nothing throws — the decks just quietly go back to looking alike,
// which is the exact problem the registry exists to solve. So the checks here
// are about the shape of the data, that every house drives every part of the
// chassis, and about the promises pickDeckStyle makes: same brief, same house;
// different decks, different houses; and anything the user already answered is
// not answered again by the style.

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
      // A house that sets only some of the chassis variables is a half
      // house: the rest fall back to the chassis default, which is one
      // particular deck's dark grey, and the result reads as a mistake.
      it('sets every variable the chassis reads', () => {
        for (const key of [
          '--deck-bg', '--deck-panel', '--deck-panel-2', '--deck-sheen',
          '--deck-ink', '--deck-ink-2', '--deck-ink-3',
          '--deck-accent-1', '--deck-accent-2', '--deck-accent-3', '--deck-accent-4',
          '--deck-font', '--deck-mono', '--deck-radius'
        ]) {
          expect(style.tokens[key], `${style.id} ${key}`).toBeTruthy()
        }
      })

      it('gives real colours and a ground that matches its tone', () => {
        for (const key of ['--deck-bg', '--deck-ink', '--deck-ink-2', '--deck-ink-3']) {
          expect(style.tokens[key], `${style.id} ${key}`).toMatch(/^#[0-9A-Fa-f]{6}$/)
        }
        const lum = (hex: string): number => {
          const n = parseInt(hex.slice(1), 16)
          return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
        }
        const bg = lum(style.tokens['--deck-bg'])
        const ink = lum(style.tokens['--deck-ink'])
        expect(style.tone === 'light' ? bg > 0.5 : bg < 0.5, `${style.id} tone`).toBe(true)
        // Ink has to be on the other side of the ground or the deck is unreadable.
        expect(Math.abs(bg - ink), `${style.id} contrast`).toBeGreaterThan(0.4)
      })

      it('loads the faces it names, or names only faces that need no loading', () => {
        if (!style.fontsHref) return
        expect(style.fontsHref).toMatch(/^https:\/\/fonts\.googleapis\.com\/css2\?/)
        const first = /'([^']+)'/.exec(style.tokens['--deck-font'])?.[1] ?? ''
        expect(style.fontsHref).toContain(first.replace(/ /g, '+'))
      })

      // Every field is instruction to a model. A one-word answer tells it
      // nothing it did not already assume, which is how a house style
      // silently becomes a default again.
      it('says enough in every part to actually direct a deck', () => {
        for (const key of ['note', 'type', 'imagery', 'data', 'sequence'] as const) {
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

  it('names its house and gives the tokens, imagery, numbers and order every time', () => {
    const text = pickDeckStyle(brief()).text
    expect(text).toContain('DECK HOUSE STYLE')
    expect(text).toContain(':root{')
    expect(text).toContain('--deck-bg:')
    expect(text).toContain('Imagery:')
    expect(text).toContain('Numbers:')
    expect(text).toContain('Running order:')
  })

  it('tells a light house to flip the chassis tone with it', () => {
    // Otherwise the panels stay tinted for a dark ground and a light deck
    // comes out with white-on-white cards, which is exactly the complaint.
    // Pinned rather than hunted for by seed. Searching seeds for a house made
    // this test depend on how many houses exist, so adding a sixth broke it
    // without anything about the tone line changing.
    for (const s of DECK_STYLES.filter((x) => x.tone === 'light')) {
      const t = pickDeckStyle(brief({ deckStyleId: s.id })).text
      expect(t, s.id).toContain('data-deck-tone="light"')
    }
  })

  it('drops its own palette when the brief already picked one', () => {
    const free = pickDeckStyle(brief())
    expect(free.text).toContain('--deck-bg:')
    for (const pinned of [
      brief({ primaryColor: '#3b352c' }),
      brief({ paletteId: 'forest' }),
      brief({ paletteColors: ['#101010'] }),
      brief({ tokensId: 'lib-1' }),
    ]) {
      const t = pickDeckStyle(pinned).text
      expect(t).not.toContain('--deck-bg:')
      expect(t).not.toContain('--deck-accent-1:')
      expect(t).toContain('derive --deck-bg')
      // The radius is not a colour question, so the house keeps it.
      expect(t).toContain('--deck-radius:')
      // The layout half of the house survives: that is the part doing the work.
      expect(t).toContain('Running order:')
    }
  })

  it('drops its own type when the brief already picked fonts', () => {
    expect(pickDeckStyle(brief()).text).toContain('- Type:')
    for (const pinned of [brief({ fontHeading: 'Fraunces' }), brief({ fontPairId: 'pair-2' })]) {
      const t = pickDeckStyle(pinned).text
      expect(t).not.toContain('- Type:')
      expect(t).not.toContain('--deck-font:')
      expect(t).not.toContain('- Load the faces:')
    }
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

  it('ships the chassis itself, not a description of one', async () => {
    const { buildPrefix } = await import('../../src/main/design')
    const text = buildPrefix('v2.html', brief())
    expect(text).toContain('DECK CHASSIS')
    expect(text).toContain('<style id="deck-base">')
    expect(text).toContain('<script id="deck-runtime"')
    expect(text).toContain('THE CHASSIS IS THE DECK')
  })

  it('does not put a deck chassis on a web page', async () => {
    const { buildPrefix } = await import('../../src/main/design')
    const text = buildPrefix('v2.html', brief({ kind: 'landing', group: 'web' }))
    expect(text).not.toContain('DECK CHASSIS')
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
