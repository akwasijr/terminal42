import { describe, expect, it } from 'vitest'
import { DESIGN_KINDS, pagesForState } from '../../src/renderer/src/lib/designBrief'

const DECKS = ['pitch-deck', 'talk-slides', 'sales-deck', 'workshop-deck'] as const

function deckPages(kind: string): string[] {
  return pagesForState({ category: 'presentation', kind: kind as never, target: 'html' })
}

describe('a deck is only asked about decks', () => {
  it('does not ask a slide about corner radius, shadows and borders', () => {
    // Shape describes buttons, cards and inputs. A slide has none of them, so
    // the step was inherited from the default and answering it changed nothing.
    for (const kind of DECKS) {
      expect(deckPages(kind), `${kind} still asks about shape`).not.toContain('shape')
    }
  })

  it('says so on the kind rather than special-casing the page list', () => {
    for (const kind of DECKS) {
      const def = DESIGN_KINDS.find((k) => k.id === kind)
      expect(def?.hasShape, `${kind} has no explicit shape flag`).toBe(false)
    }
  })

  it('keeps the questions that do change a deck', () => {
    for (const kind of DECKS) {
      const pages = deckPages(kind)
      for (const p of ['look', 'palette', 'fonts', 'idea', 'summary']) {
        expect(pages, `${kind} dropped ${p}`).toContain(p)
      }
    }
  })

  it('never asks a deck about things slides do not have', () => {
    // Slides are 16:9, always polished, and are not shipped as an app.
    for (const kind of DECKS) {
      const pages = deckPages(kind)
      for (const p of ['surface', 'fidelity', 'stack', 'density', 'spacing', 'grid']) {
        expect(pages, `${kind} asks about ${p}`).not.toContain(p)
      }
    }
  })

  it('leaves shape on for the kinds that really have components', () => {
    const app = pagesForState({ category: 'app', kind: 'app', target: 'html' })
    expect(app).toContain('shape')
  })
})
