/**
 * Starting something, or opening it, puts you in front of it.
 *
 * The rule: an app, a website or a deck is edited by talking to it with the
 * preview alongside. So opening one goes straight to that view, and so does
 * making one — you should not have to find the thing you just made.
 *
 * DesignWorkspace is that view: the chat rail and the canvas, side by side.
 * These check the routing rather than the layout, because the layout is
 * checked by looking at it.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '..', '..')
const read = (p: string): string => readFileSync(join(root, p), 'utf8')

const LIST = read('src/renderer/src/components/DesignsListView.tsx')
const APP = read('src/renderer/src/App.tsx')
const WORKSPACE = read('src/renderer/src/components/DesignWorkspace.tsx')

describe('the workspace is chat beside the preview', () => {
  it('puts the chat rail and the canvas in one view', () => {
    expect(WORKSPACE).toContain('<DesignChatRail')
    expect(WORKSPACE).toContain('<DesignCanvas')
  })

  it('lets the rail be resized rather than fixing the split', () => {
    expect(WORKSPACE).toContain('<ResizeHandle')
  })

  it('hands both halves the same design, so they cannot drift apart', () => {
    const rail = WORKSPACE.slice(WORKSPACE.indexOf('<DesignChatRail'))
    expect(rail).toMatch(/<DesignChatRail designId=\{designId\}/)
    expect(WORKSPACE).toMatch(/<DesignCanvas\s+designId=\{designId\}/)
  })
})

describe('opening one', () => {
  it('routes an opened design to the workspace', () => {
    expect(APP).toMatch(/activeDesignId \? \([\s\S]{0,600}<DesignWorkspace/)
  })

  it('sends a form to its own canvas instead, which has no preview to chat to', () => {
    expect(APP).toMatch(/openedDesignKind === 'freeform' \? \(\s*<FreeformCanvas/)
  })
})

describe('making one', () => {
  it('opens what the wizard just created', () => {
    const done = LIST.slice(LIST.indexOf('const handleWizardComplete'))
    expect(done).toMatch(/onOpen\(d\)/)
  })

  it('opens a website built straight from its template', () => {
    const dup = LIST.slice(LIST.indexOf('const duplicateWebTemplate'))
    expect(dup.slice(0, 1400)).toMatch(/onOpen\(d\)/)
  })

  it('opens a design copied out of a starter template', () => {
    // This one used to throw away the design it had just made and leave you
    // on the shelf, with nothing to say anything had happened.
    const dup = LIST.slice(LIST.indexOf('const duplicateTemplate'))
    expect(dup.slice(0, 900)).toMatch(/onOpen\(r\.design\)/)
  })

  it('routes every "use this template" through the wizard, which opens', () => {
    for (const fn of ['createDeckFromTemplate', 'createFromTemplate', 'createWebFromTemplate']) {
      const body = LIST.slice(LIST.indexOf(`const ${fn}`), LIST.indexOf(`const ${fn}`) + 420)
      expect(body, fn).toMatch(/setWizardOpen\(true\)/)
    }
  })
})
