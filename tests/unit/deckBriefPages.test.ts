import { describe, it, expect } from 'vitest'
import { pageList, branchOf } from '../../src/renderer/src/components/BriefWizard'

const deck = pageList(branchOf('slide-deck'), 'slide-deck')

describe('the slide deck brief', () => {
  // A deck template already carries the palette, the type, the corner shape
  // and the way a slide is laid out. Asking those again invites an answer that
  // fights the template, and a tech stack means nothing for a presentation.
  it('stops asking the questions a deck template has already answered', () => {
    for (const p of ['look', 'fonts', 'images', 'brand', 'stack', 'ui', 'theme', 'surfaces', 'motion', 'data']) {
      expect(deck, p).not.toContain(p)
    }
  })

  it('asks the deck its own question instead', () => {
    expect(deck).toContain('deck')
  })

  it('still asks what the template cannot decide', () => {
    for (const p of ['type', 'context', 'audience', 'colors']) expect(deck).toContain(p)
  })

  it('is shorter than the flow a print piece gets', () => {
    expect(deck.length).toBeLessThan(pageList(branchOf('poster'), 'poster').length)
  })

  // The deck page is the one that names the template, so it has to come before
  // the colour page — that page offers to keep the template's palette, and it
  // cannot offer that before a template exists.
  it('names the template before it offers to keep its palette', () => {
    expect(deck.indexOf('deck')).toBeLessThan(deck.indexOf('colors'))
  })

  it('leaves the other print pieces on their own flow', () => {
    const poster = pageList(branchOf('poster'), 'poster')
    expect(poster).toContain('look')
    expect(poster).not.toContain('deck')
  })
})
