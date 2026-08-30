/**
 * Templates belong to a type, not to a tab of their own.
 *
 * There used to be one "Templates" tab sitting alongside App and Decks, as
 * though "template" were a kind of thing you make. It is not — it is a state
 * any kind of thing can be in, and the shared gallery mixed deck templates
 * with token templates in one undifferentiated grid.
 *
 * Now every type carries two shelves: your own work, and the starting points
 * for that same type. These tests hold that shape in place.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const LIST = readFileSync(
  join(__dirname, '..', '..', 'src', 'renderer', 'src', 'components', 'DesignsListView.tsx'),
  'utf8'
)

describe('the type row', () => {
  it('no longer offers Templates as a type of its own', () => {
    expect(LIST).not.toMatch(/typeFilter === 'templates'/)
    expect(LIST).not.toMatch(/setTypeFilter\('templates'\)/)
  })

  it('always offers the kinds you can start from, owned or not', () => {
    // A tab that appears only once you own the thing hides the very shelf you
    // would have used to make your first one.
    expect(LIST).toMatch(/ALWAYS_OFFERED: DesignGroup\[\] = \['web', 'app', 'presentation'\]/)
  })

  it('calls the web kind Website rather than Web', () => {
    expect(LIST).toMatch(/web: 'Website'/)
  })
})

describe('the shelf row', () => {
  it('has exactly two shelves', () => {
    expect(LIST).toMatch(/type Shelf = 'mine' \| 'templates'/)
  })

  it('names your own shelf after what is actually on it', () => {
    // "Ongoing projects" is right for an app and wrong for a token library,
    // which is not a project.
    expect(LIST).toMatch(/'My libraries'/)
    expect(LIST).toMatch(/'My systems'/)
    expect(LIST).toMatch(/'Ongoing projects'/)
  })

  it('returns to your own shelf when the type changes', () => {
    // Otherwise moving from Decks to Tokens silently keeps you on templates.
    const switches = LIST.match(/setTypeFilter\([^)]*\); setShelf\('mine'\)/g) ?? []
    expect(switches.length).toBeGreaterThanOrEqual(3)
  })

  it('offers templates only for types that have them', () => {
    expect(LIST).toMatch(/const hasTemplates =/)
    // "All" must not, or the mixed gallery comes back by the side door.
    expect(LIST).not.toMatch(/typeFilter === 'all' \|\|[\s\S]{0,80}hasTemplates/)
  })

  it('shows each type its own templates and nobody else\u2019s', () => {
    const shelf = LIST.slice(LIST.indexOf("shelf === 'templates' ? ("))
    expect(shelf).toMatch(/typeFilter === 'presentation' \?\s*\(\s*<DeckTemplateGallery/)
    expect(shelf).toMatch(/typeFilter === 'tokens' \?\s*\(\s*<TokenTemplates/)
  })
})

describe('an empty shelf', () => {
  it('tells the difference between no match and nothing made yet', () => {
    expect(LIST).toMatch(/Nothing here yet/)
    expect(LIST).toMatch(/search \|\| folderFilter !== 'all'/)
  })

  it('points at the templates shelf rather than leaving you there', () => {
    expect(LIST).toMatch(/Start from a template/)
  })
})

describe('getting back to everything', () => {
  /*
   * There was no "All" pill. Widening back meant pressing the pill you were
   * already on — a gesture nothing on screen mentioned — and Design systems
   * and Tokens did not honour it at all, so looking at tokens was a one-way
   * door. Checked in the app: Tokens → All now heads "All projects".
   */
  it('offers an explicit All pill', () => {
    expect(LIST).toMatch(/active=\{typeFilter === 'all'\}[\s\S]{0,160}>\s*All\s*</)
  })

  it('lets Design systems and Tokens be pressed off again', () => {
    expect(LIST).toContain("setTypeFilter(typeFilter === 'system' ? 'all' : 'system')")
    expect(LIST).toContain("setTypeFilter(typeFilter === 'tokens' ? 'all' : 'tokens')")
  })

  it('no longer claims there is no all pill', () => {
    expect(LIST).not.toContain('No "all" pill')
  })
})
