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

describe('an app is not asked what the renderer already handles', () => {
  const app = (): string[] => pagesForState({ category: 'app', kind: 'app', target: 'html' })

  it('skips the steps the website flow already stopped asking about', () => {
    // The same renderer builds both, so responsive layout and the motion
    // engine are handled for you in an app too.
    expect(app()).not.toContain('surface')
    expect(app()).not.toContain('motion')
  })

  it('keeps what genuinely shapes an app', () => {
    for (const p of ['stack', 'look', 'shape', 'palette', 'fonts', 'theme', 'spacing', 'grid']) {
      expect(app(), `app dropped ${p}`).toContain(p)
    }
  })

  it('still asks about surface when the output is not ours to render', () => {
    // Figma frames are static, so that path has its own rules and must not
    // be swept up by the app shortcut.
    const figma = pagesForState({ category: 'app', kind: 'app', target: 'figma' })
    expect(figma).not.toContain('surface')
    expect(figma).toContain('figma')
  })
})
