/**
 * Website templates, and the direction they turn into.
 *
 * Website used to be handed App's gallery — nineteen industry dashboards and
 * a Teams shell. These tests hold the separation, and hold the templates to
 * the rule the deck set learned the hard way: what distinguishes one from
 * another is the composition, not the palette.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { WEBSITE_TEMPLATES, websiteTemplateById } from '../../src/shared/websites/templates'
import { pickWebsiteStyle } from '../../src/main/websiteStyles'
import type { DesignBrief } from '../../src/main/design.types'

const brief = (over: Partial<DesignBrief> = {}): DesignBrief =>
  ({ v: 1, kind: 'website', kindLabel: 'Website', group: 'web', fidelity: 'highfidelity', createdAt: 1, ...over }) as DesignBrief

describe('the set itself', () => {
  it('has no duplicate ids', () => {
    const ids = WEBSITE_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every template a different composition', () => {
    // This is the whole point. Nine palettes over one layout is one template
    // shown nine times, which is what the deck gallery did first time round.
    const shapes = WEBSITE_TEMPLATES.map((t) => t.archetype)
    expect(new Set(shapes).size).toBe(WEBSITE_TEMPLATES.length)
  })

  it('says who each one is for', () => {
    for (const t of WEBSITE_TEMPLATES) {
      expect(t.suits.length).toBeGreaterThan(10)
      expect(t.note.length).toBeGreaterThan(10)
      // A note is one line. The gallery shows the page; it needs no essay.
      expect(t.note.length).toBeLessThan(80)
    }
  })

  it('gives every template enough structure to be followed', () => {
    for (const t of WEBSITE_TEMPLATES) {
      expect(t.moves.length).toBeGreaterThanOrEqual(4)
      expect(t.tokens['--site-bg']).toMatch(/^#/)
      expect(t.tokens['--site-ink']).toMatch(/^#/)
      expect(t.tokens['--site-accent']).toMatch(/^#/)
    }
  })

  it('finds a template by id, and nothing by a bad one', () => {
    expect(websiteTemplateById('venue-booking')?.name).toBe('Venue')
    expect(websiteTemplateById('nope')).toBeNull()
    expect(websiteTemplateById(null)).toBeNull()
  })
})

describe('pickWebsiteStyle', () => {
  it('uses the template the user chose', () => {
    const r = pickWebsiteStyle(brief({ webStyleId: 'docs-rail' }))
    expect(r.styleId).toBe('docs-rail')
    expect(r.text).toContain('Documentation')
  })

  it('falls back to a stable automatic pick', () => {
    const b = brief({ idea: 'a bakery' })
    expect(pickWebsiteStyle(b).styleId).toBe(pickWebsiteStyle(b).styleId)
  })

  it('gives two different briefs different templates', () => {
    const picks = new Set(
      ['one', 'two', 'three', 'four', 'five', 'six'].map((idea) => pickWebsiteStyle(brief({ idea })).styleId)
    )
    expect(picks.size).toBeGreaterThan(1)
  })

  it('writes out the moves so they cannot be skipped', () => {
    const t = websiteTemplateById('storefront')!
    const text = pickWebsiteStyle(brief({ webStyleId: 'storefront' })).text
    for (const m of t.moves) expect(text).toContain(m)
  })

  it('drops its colours when the brief already fixed them', () => {
    // Overruling a palette the user chose would be the template exceeding its
    // remit: composition is its business, colour is not.
    const text = pickWebsiteStyle(brief({ webStyleId: 'studio-cover', primaryColor: '#ff0000' })).text
    // The declaration must go; naming the token in the "derive it" line is fine.
    expect(text).not.toMatch(/^\s+--site-accent:/m)
    expect(text).not.toMatch(/^\s+--site-bg:/m)
    expect(text).toContain('derive --site-bg')
    // The composition still applies.
    expect(text).toContain('A cover filling the first screen')
  })

  it('drops its faces when the brief already fixed them', () => {
    const text = pickWebsiteStyle(brief({ webStyleId: 'editorial-review', fontHeading: 'Times' })).text
    expect(text).not.toMatch(/^\s+--site-font:/m)
    expect(text).not.toContain('fonts.googleapis.com')
  })

  it('names the default AI landing page as the thing to avoid', () => {
    const text = pickWebsiteStyle(brief({ webStyleId: 'work-grid' })).text
    expect(text).toMatch(/gradient hero/i)
    expect(text).toMatch(/testimonial/i)
    expect(text).toMatch(/blob|wave divider|aurora/i)
  })
})

describe('the gallery', () => {
  const SRC = readFileSync(
    join(__dirname, '..', '..', 'src', 'renderer', 'src', 'components', 'WebsiteTemplates.tsx'),
    'utf8'
  )

  it('offers no way to delete a starting point', () => {
    expect(SRC).not.toMatch(/danger: true/)
    expect(SRC).not.toMatch(/label: 'Delete'/)
  })

  it('draws the card and the modal from the same drawing', () => {
    // Otherwise the modal is a distortion: percentages grow with the box and
    // the pixel values do not, so rules thin to hairlines.
    expect(SRC).toMatch(/function ScaledPreview/)
    expect((SRC.match(/<ScaledPreview t=\{t\} \/>/g) ?? []).length).toBe(2)
  })

  it('says so when a copy fails rather than doing nothing visible', () => {
    expect(SRC).toMatch(/Could not copy/)
    expect(SRC).toMatch(/Copying…/)
  })
})

describe('the wizard it opens', () => {
  const LIST = readFileSync(
    join(__dirname, '..', '..', 'src', 'renderer', 'src', 'components', 'DesignsListView.tsx'),
    'utf8'
  )

  it('does not ask what you are designing when you already said', () => {
    // Choosing a website template answers that question. Asking again let you
    // pick Presentation and pin a website template onto a deck.
    expect(LIST).toMatch(/presetCategory=\{deckHouse \? 'presentation' : webHouse \? 'web' :/)
  })

  it('pins the chosen template onto the brief', () => {
    expect(LIST).toMatch(/webStyleId: webHouse\.id/)
  })

  it('never carries a website template into another kind of wizard', () => {
    const clears = (LIST.match(/setWebHouse\(null\)/g) ?? []).length
    expect(clears).toBeGreaterThanOrEqual(3)
  })
})
