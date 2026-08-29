import { describe, expect, it } from 'vitest'
import { DECK_STYLES, deckStyleById, pickDeckStyle } from '../../src/main/deckStyles'
import type { DesignBrief } from '../../src/main/design.types'

function brief(over: Partial<DesignBrief> = {}): DesignBrief {
  return { kind: 'pitch-deck', idea: 'a deck', fidelity: 'highfidelity', ...over } as DesignBrief
}

describe('deckStyleById', () => {
  it('finds every house by its own id', () => {
    for (const s of DECK_STYLES) expect(deckStyleById(s.id)?.id).toBe(s.id)
  })

  it('returns null for an id no house has', () => {
    expect(deckStyleById('nope')).toBeNull()
    expect(deckStyleById(null)).toBeNull()
    expect(deckStyleById(undefined)).toBeNull()
  })
})

describe('pickDeckStyle', () => {
  it('honours a house chosen from the gallery', () => {
    for (const s of DECK_STYLES) {
      expect(pickDeckStyle(brief({ deckStyleId: s.id })).styleId).toBe(s.id)
    }
  })

  it('keeps the chosen house whatever else the brief says', () => {
    const a = pickDeckStyle(brief({ deckStyleId: 'grove', idea: 'one', createdAt: 1 }))
    const b = pickDeckStyle(brief({ deckStyleId: 'grove', idea: 'two', createdAt: 2 }))
    expect(a.styleId).toBe('grove')
    expect(b.styleId).toBe('grove')
  })

  it('falls back to the automatic pick when the id is unknown', () => {
    expect(DECK_STYLES.map((s) => s.id)).toContain(
      pickDeckStyle(brief({ deckStyleId: 'not-a-house' })).styleId
    )
  })

  it('still varies by brief when no house is pinned', () => {
    const ids = new Set(
      Array.from({ length: 40 }, (_, i) =>
        pickDeckStyle(brief({ idea: `deck ${i}`, createdAt: i * 1000 })).styleId
      )
    )
    expect(ids.size).toBeGreaterThan(1)
  })

  it('writes the house into the direction it returns', () => {
    const out = pickDeckStyle(brief({ deckStyleId: 'press' }))
    const press = deckStyleById('press')!
    expect(out.text).toContain(press.label)
    expect(out.text).toContain('--deck-bg')
  })

  it('drops the colour declarations when the brief already pins a palette', () => {
    const out = pickDeckStyle(brief({ deckStyleId: 'cellar', primaryColor: '#123456' }))
    expect(out.text).not.toContain('--deck-bg:')
    expect(out.text).toContain('derive --deck-bg')
  })

  it('drops the face declarations when the brief already pins fonts', () => {
    const out = pickDeckStyle(brief({ deckStyleId: 'cellar', fontPrimary: 'inter' }))
    expect(out.text).not.toContain('--deck-font:')
  })
})
