// A deck template is values plus a set of layout moves, and neither fails
// loudly.
//
// If a template loses a chassis variable, or two templates drift into
// describing the same deck, nothing throws — the decks just quietly go back to
// looking alike, which is the exact problem this registry exists to solve, and
// the exact complaint that caused it to be rewritten. So the checks here are
// about the shape of the data, that every template drives every part of the
// chassis, that no two templates share a cover or a heading, and about the
// promises pickDeckStyle makes: same brief, same template; different decks,
// different templates; and anything the user already answered is not answered
// again by the template.

import { describe, it, expect } from 'vitest'
import { DECK_TEMPLATES, deckTemplateById, pickDeckStyle } from '../../src/main/deckStyles'
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

describe('deck templates', () => {
  it('offers several genuinely different templates', () => {
    expect(DECK_TEMPLATES.length).toBeGreaterThanOrEqual(5)
    expect(new Set(DECK_TEMPLATES.map((s) => s.id)).size).toBe(DECK_TEMPLATES.length)
    expect(new Set(DECK_TEMPLATES.map((s) => s.name)).size).toBe(DECK_TEMPLATES.length)
  })

  it('finds a style by id, and nothing by a made-up one', () => {
    expect(deckTemplateById(DECK_TEMPLATES[0].id)?.name).toBe(DECK_TEMPLATES[0].name)
    expect(deckTemplateById('no-such-template')).toBeNull()
  })

  for (const style of DECK_TEMPLATES) {
    describe(style.name, () => {
      // A template that sets only some of the chassis variables is a half
      // template: the rest fall back to the chassis default, which is one
      // particular deck's dark grey, and the result reads as a mistake.
      it('sets every variable the chassis reads', () => {
        for (const key of [
          '--deck-bg', '--deck-panel', '--deck-panel-2',
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

      // Every move is instruction to a model. A one-word answer tells it
      // nothing it did not already assume, which is how a template silently
      // becomes a default again.
      it('gives enough moves, each concrete enough to follow', () => {
        expect(style.moves.length, style.id).toBeGreaterThanOrEqual(5)
        for (const m of style.moves) expect(m.length, `${style.id}: ${m}`).toBeGreaterThan(30)
      })

      it('names the reference it was taken from', () => {
        expect(style.source.length, style.id).toBeGreaterThan(0)
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
    expect(seen.size).toBe(DECK_TEMPLATES.length)
  })

  it('names its template and gives the tokens, the cover and the moves every time', () => {
    const text = pickDeckStyle(brief()).text
    expect(text).toContain('DECK TEMPLATE')
    expect(text).toContain(':root{')
    expect(text).toContain('--deck-bg:')
    expect(text).toContain('--deck-heading-weight:')
    expect(text).toContain('Cover:')
    expect(text).toContain('The moves that make this template itself')
  })

  it('tells a light template to turn the chassis tone over with it', () => {
    // Otherwise the panels stay tinted for a dark ground and a light deck
    // comes out with white-on-white cards, which is exactly the complaint.
    // Pinned rather than hunted for by seed. Searching seeds for a template
    // made this test depend on how many templates exist, so adding one broke
    // it without anything about the tone line changing.
    for (const s of DECK_TEMPLATES.filter((x) => x.tone === 'light')) {
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
      // The layout half of the template survives: that is the part doing
      // the work, and the part a pinned palette says nothing about.
      expect(t).toContain('Cover:')
      expect(t).toContain('The moves that make this template itself')
    }
  })

  it('drops its own type when the brief already picked fonts', () => {
    expect(pickDeckStyle(brief({ deckStyleId: 'editorial' })).text).toContain('--deck-font:')
    for (const pinned of [brief({ fontHeading: 'Fraunces' }), brief({ fontPairId: 'pair-2' })]) {
      const t = pickDeckStyle(pinned).text
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
// itself: a deck brief must arrive at the model with a template on it, and a
// web brief must not, because web already has its own art direction and two
// competing directions is worse than either.
describe('the template reaches the prompt', () => {
  it('puts a template on a presentation brief', async () => {
    const { buildPrefix } = await import('../../src/main/design')
    const text = buildPrefix('v2.html', brief())
    expect(text).toContain('DECK TEMPLATE')
    expect(text).toContain('The moves that make this template itself')
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
    expect(text).not.toContain('DECK TEMPLATE')
    expect(text).toContain('ART DIRECTION')
  })

  it('keeps the template across an iteration turn', async () => {
    const { buildPrefix } = await import('../../src/main/design')
    const b = brief({ createdAt: 77, idea: 'series A' })
    const first = buildPrefix('v2.html', b)
    const second = buildPrefix('v3.html', b, 'v2.html')
    const named = (t: string): string => t.split('- Template: ')[1]?.split('\n')[0] ?? ''
    expect(named(second)).toBe(named(first))
    expect(named(first).length).toBeGreaterThan(0)
  })
})

// The complaint that caused this rewrite was "they all look the same". These
// are the checks that would have caught it: two templates may share a palette
// family, but they may not share the thing you actually see first.
describe('no two templates are the same deck', () => {
  it('gives every template its own cover composition', () => {
    expect(new Set(DECK_TEMPLATES.map((t) => t.cover)).size).toBe(DECK_TEMPLATES.length)
  })

  it('sets headings differently enough to tell apart', () => {
    const sig = DECK_TEMPLATES.map((t) => `${t.heading.weight}|${t.heading.case}|${t.heading.scale}`)
    expect(new Set(sig).size).toBe(DECK_TEMPLATES.length)
  })

  // Two templates may both sit on white — several of the references do — but
  // not on the same white with the same accent, because then they are one
  // template with two names.
  it('gives every template its own ground and accent together', () => {
    const sig = DECK_TEMPLATES.map(
      (t) => `${t.tokens['--deck-bg']}|${t.tokens['--deck-accent-1']}`.toLowerCase()
    )
    expect(new Set(sig).size).toBe(DECK_TEMPLATES.length)
  })

  it('does not repeat a move between templates', () => {
    const seen = new Map<string, string>()
    for (const t of DECK_TEMPLATES) {
      for (const m of t.moves) {
        expect(seen.has(m), `${t.id} repeats a move from ${seen.get(m)}: ${m}`).toBe(false)
        seen.set(m, t.id)
      }
    }
  })
})
