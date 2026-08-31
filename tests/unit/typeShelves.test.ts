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

  it('keeps a shelf of looks away from decks, tokens and systems', () => {
    // A generated starting point there was never as good as the thing you
    // would have described, and it set the result off on the wrong foot.
    expect(LIST).toMatch(/hasTemplates = scope === 'design' && \(typeFilter === 'app' \|\| typeFilter === 'web'\)/)
    const shelf = LIST.slice(LIST.indexOf("shelf === 'templates' ? ("))
    expect(shelf).toMatch(/typeFilter === 'web' \?\s*\(\s*<WebsiteTemplates/)
    expect(shelf).not.toMatch(/DeckTemplateGallery|TokenTemplates/)
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

describe('there is no everything to get back to', () => {
  /*
   * An All pill was added once, to fix a real problem: Design systems and
   * Tokens were a one-way door. It turned out to be the wrong fix. "All"
   * showed five kinds of thing in one grid and was the tab the list opened
   * on, so the first thing anyone saw was a pile. The pills are now the only
   * view, one kind each, and Website is where the list starts.
   */
  it('offers no All pill', () => {
    expect(LIST).not.toMatch(/>\s*All\s*</)
    // 'all' survives only as something to be pushed out of: the form scope
    // has no pills and legitimately uses it, so entering the design scope
    // has to correct for it.
    expect(LIST).toContain("if (scope === 'design' && typeFilter === 'all') setTypeFilter('web')")
  })

  it('leaves you on a pill you press twice', () => {
    // Pressing the one you are on used to widen to everything, which is now
    // nowhere. It does nothing instead.
    expect(LIST).not.toContain("? 'all' :")
  })

  it('opens on Website rather than on a pile', () => {
    expect(LIST).toMatch(/useState<TypeFilter>\('web'\)/)
  })
})
