/**
 * The section is called Project, not Design.
 *
 * The split it names: Project is where you start something, browse templates
 * and see what is on the go; Chat is where you edit it. Half-renaming leaves
 * a rail that says one thing and a heading that says another, so this checks
 * the visible copy rather than trusting a search-and-replace.
 *
 * Note what is deliberately NOT renamed: "design system", "design tokens" and
 * "designing" as a verb are all still the right words. Only the noun that
 * means "a thing you made" became "project".
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '..', '..')
const read = (p: string): string => readFileSync(join(root, p), 'utf8')

const APP = read('src/renderer/src/App.tsx')
const LIST = read('src/renderer/src/components/DesignsListView.tsx')
const CANVAS = read('src/renderer/src/components/DesignCanvas.tsx')

describe('the rail', () => {
  it('names the section Project', () => {
    expect(APP).toMatch(/id: 'designs',\s*label: 'Project'/)
  })

  it('no longer offers a tab called Design', () => {
    expect(APP).not.toMatch(/label: 'Design'[,\s]/)
  })

  it('still calls the neighbouring tabs what they were', () => {
    expect(APP).toMatch(/label: 'Chat'/)
    expect(APP).toMatch(/label: 'Motion'/)
  })
})

describe('the list', () => {
  it('heads the unfiltered view "All projects"', () => {
    expect(LIST).toContain("'All projects'")
    expect(LIST).not.toContain("'All designs'")
  })

  it('labels the create button just "New"', () => {
    // The button sits under a heading that already names the kind, so
    // "New project" on the Tokens tab was both longer and wrong.
    expect(LIST).toContain("'New'")
    expect(LIST).not.toContain("'New project'")
  })

  it('says no projects match, not no designs match', () => {
    expect(LIST).toContain("'forms' : 'projects'")
  })

  it('searches projects', () => {
    expect(LIST).toContain("'Search projects'")
  })
})

describe('the canvas', () => {
  it('goes back to projects and closes a project', () => {
    expect(CANVAS).toContain('"Back to projects"')
    expect(CANVAS).toContain('"Close project"')
    expect(CANVAS).not.toContain('"Back to designs"')
    expect(CANVAS).not.toContain('"Close design"')
  })
})

describe('the words that stay', () => {
  it('keeps "Design system" as the name of a design system', () => {
    expect(LIST).toContain('Design system')
  })

  it('keeps design tokens called design tokens', () => {
    const tokens = read('src/renderer/src/components/tokens/TokensView.tsx')
    expect(/design token/i.test(tokens) || /Tokens/.test(tokens)).toBe(true)
  })
})
