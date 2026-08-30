import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const listView = readFileSync(
  resolve(__dirname, '../../src/renderer/src/components/DesignsListView.tsx'),
  'utf8'
)
const wizard = readFileSync(
  resolve(__dirname, '../../src/renderer/src/components/DesignWizard.tsx'),
  'utf8'
)

// Picking "Deck" and then being asked "what are you designing?" is the wizard
// forgetting the answer you just gave it. Each door has to carry its type in.
describe('the New project menu opens the wizard on the type you picked', () => {
  it('offers a door for each of the three things you can build', () => {
    for (const label of ['Website', 'App', 'Deck']) {
      expect(listView).toContain(`{ label: '${label}',`)
    }
  })

  it('gives each door its own category rather than sharing one handler', () => {
    const categories = [...listView.matchAll(/openHtmlWizard\('([a-z]+)'\)/g)].map((m) => m[1])
    expect(categories).toEqual(['web', 'app', 'presentation'])
    expect(new Set(categories).size).toBe(categories.length)
  })

  it('still calls "Deck" a deck, not a web experience', () => {
    expect(listView).not.toContain("label: 'Web experience'")
  })

  it('clears the category on every other way into the wizard', () => {
    // A category left over from a previous open would silently pick the type
    // for you. Count the resets: three template doors plus the cancel path.
    const resets = listView.match(/setWizardCategory\(null\)/g) ?? []
    expect(resets.length).toBeGreaterThanOrEqual(4)
  })

  it('hands the category to the wizard as its preset', () => {
    expect(listView).toMatch(/presetCategory=\{[^}]*wizardCategory/)
  })
})

describe('the wizard tiles', () => {
  it('draws each deck kind differently', () => {
    // These four shared one drawing, so the page was four identical pictures
    // and the label was doing all the work.
    const kinds = ['pitch-deck', 'sales-deck', 'talk-slides', 'workshop-deck']
    const bodies = kinds.map((k) => {
      const at = wizard.indexOf(`case '${k}':`)
      expect(at, `${k} has no mock`).toBeGreaterThan(-1)
      const body = wizard.slice(at, wizard.indexOf('case ', at + 10))
      // A fallthrough case has no drawing of its own — that is the bug.
      expect(body, `${k} falls through to another kind`).toContain('return (')
      return body.slice(body.indexOf('return ('))
    })
    expect(new Set(bodies).size).toBe(kinds.length)
  })

  it('calls the thing it makes a project', () => {
    expect(wizard).toContain("'Create project'")
    expect(wizard).not.toContain("'Create design'")
  })
})
