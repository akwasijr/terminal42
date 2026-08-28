// The filter tabs on the designs screen are a row you read by scanning, and a
// row you scan cannot move while you scan it. It used to: the labels sat at
// different x positions depending on which tab was selected, so pressing one
// tab nudged the next one out from under the pointer.
//
// Measured in the running app the row is now identical in all five states
// (App / Decks / Design systems / Tokens / Templates — same left edge, same
// width, same per-pill positions to the pixel). That is a property of how the
// pill is written rather than of any one screen, so this is the test that
// keeps it true: the selected branch of the class list is allowed to change
// colour, and nothing else.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(
  join(__dirname, '../../src/renderer/src/components/DesignsListView.tsx'),
  'utf8'
)

// The ternary inside ViewPill's className, both arms of it.
function pillBranches(): { active: string[]; inactive: string[] } {
  const m = source.match(/active \? '([^']+)' : '([^']+)'/)
  if (!m) throw new Error('ViewPill no longer has a two-arm selected style')
  return { active: m[1].split(/\s+/), inactive: m[2].split(/\s+/) }
}

// A class that cannot change the box it is on. Colour, background, shadow and
// the transition between them are safe; padding, size, weight, tracking and
// borders are not.
const LAYOUT_NEUTRAL = /^(hover:)?(bg-|text-(?!\[)(?!xs|sm|base|lg|xl|\d)|shadow-|ring-|opacity-|transition|duration-|ease-)/

describe('the designs filter tabs', () => {
  it('changes only colour when a tab is selected', () => {
    const { active, inactive } = pillBranches()
    for (const cls of [...active, ...inactive]) {
      expect(cls, `"${cls}" can change the size of a pill`).toMatch(LAYOUT_NEUTRAL)
    }
  })

  it('keeps every measurable class outside the selected branch', () => {
    // Padding, type size and weight are on the unconditional line, which is
    // the only reason both arms above can be colour-only.
    const shared = source.match(/'(rounded-md px-3[^']+)'/)
    expect(shared, 'the shared half of the pill class list has moved').toBeTruthy()
    for (const need of ['px-3', 'py-1.5', 'text-[13px]', 'font-medium']) {
      expect(shared![1]).toContain(need)
    }
  })

  it('holds the scrollbar gutter open so the centred page cannot slide', () => {
    // Measured in the running app: without this the Templates state sat 5px
    // to the left of the other four, because it was short enough not to
    // scroll and the page re-centred itself in the reclaimed width.
    expect(source).toContain('t42-stable-gutter')
  })

  it('spaces the two groups of tabs with a container rather than an empty span', () => {
    // <span className="mx-1.5" /> was an element that existed only to be 12px
    // wide, which is a margin pretending to be content and wraps on its own.
    expect(source).not.toMatch(/<span className="mx-[\d.]+" \/>/)
    expect(source).toContain('<div className="ml-3 inline-flex items-center gap-1">')
  })
})
