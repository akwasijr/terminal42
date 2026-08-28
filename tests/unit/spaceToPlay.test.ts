// Space is the one shortcut every tool with a playhead agrees on, and it lived
// in Form's timeline and nowhere else — so the same key did the same job in
// one half of the app and nothing in the other half.
//
// There is no DOM renderer here, so this is a source-level check that both
// timelines go through the one implementation rather than each growing their
// own, which is exactly how the two drifted apart in the first place.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string): string => readFileSync(join(__dirname, '../../', p), 'utf8')

const hook = read('src/renderer/src/lib/useSpaceToPlay.ts')
const form = read('src/renderer/src/components/TimelinePanel.tsx')
const motion = read('src/renderer/src/components/motion/MotionStudio.tsx')

describe('space to play', () => {
  it('is wired into both timelines', () => {
    for (const [name, src] of [['Form', form], ['Motion', motion]] as const) {
      expect(src, `${name} no longer imports the hook`).toContain("from '../lib/useSpaceToPlay'".replace('../lib', name === 'Motion' ? '../../lib' : '../lib'))
      expect(src, `${name} no longer calls the hook`).toContain('useSpaceToPlay(')
    }
  })

  it('is written once, not once per timeline', () => {
    // A second copy of the listener is how the two came to disagree.
    for (const [name, src] of [['Form', form], ['Motion', motion]] as const) {
      expect(src, `${name} has grown its own Space listener again`).not.toContain("e.code !== 'Space'")
    }
  })

  it('ignores auto-repeat, so holding Space does not strobe playback', () => {
    expect(hook).toContain('e.repeat')
  })

  it('ignores a field, where Space is a space', () => {
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) expect(hook).toContain(tag)
    expect(hook).toContain('isContentEditable')
  })

  it('leaves modified presses alone', () => {
    // Cmd-Space is the OS, and Alt-Space is not ours either.
    expect(hook).toContain('e.metaKey || e.ctrlKey || e.altKey')
  })

  it('calls preventDefault, which is what stops the double toggle', () => {
    // A focused <button> is activated by Space on keyup. Without
    // preventDefault, pressing Space with the play button focused toggles
    // twice and looks like it did nothing.
    expect(hook).toContain('e.preventDefault()')
  })

  it('can be switched off, for when something is over the timeline', () => {
    expect(hook).toContain('if (!enabled) return')
    // Motion turns it off for the picker, the export and the naming dialog.
    expect(motion).toMatch(/useSpaceToPlay\(.*!pickerReq && !exporting && !naming\)/)
  })
})
