import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const panel = readFileSync(
  join(__dirname, '../../src/renderer/src/components/TimelinePanel.tsx'),
  'utf8'
)

describe('the timeline menus are the app\u2019s own, not the operating system\u2019s', () => {
  it('has no native select left in the panel', () => {
    // A bare <select> is drawn by the OS: a blue highlight and system corners
    // in the middle of a panel that has neither. Comments are stripped first,
    // or this trips over the note explaining why they were removed.
    const code = panel.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')
    expect(code).not.toMatch(/<select\b/)
    expect(code).not.toMatch(/<option\b/)
    expect(code).not.toMatch(/<optgroup\b/)
  })

  it('shares one menu between the two lists', () => {
    expect(panel).toContain('function TimelineMenu(')
    expect(panel).toMatch(/<TimelineMenu[\s\S]{0,200}label="Preset"/)
    expect(panel).toContain('<AddPropertyMenu')
  })

  it('is a real menu as far as a screen reader is concerned', () => {
    expect(panel).toContain('aria-haspopup="menu"')
    expect(panel).toContain('role="menu"')
    expect(panel).toContain('role="menuitem"')
  })

  it('wears the same clothes as every other menu in the app', () => {
    expect(panel).toMatch(/t42-menu absolute[^"]*bg-raised/)
  })

  it('groups the properties, because a blur is not a position', () => {
    expect(panel).toMatch(/label: 'Transform'[\s\S]{0,120}label: 'Effects'/)
  })

  it('keeps the presets in the groups they were written in', () => {
    expect(panel).toMatch(/PRESET_GROUPS\.map\(\(g\) => \(\{[\s\S]{0,200}ANIMATION_PRESETS\.filter/)
  })

  it('drops a group rather than showing an empty heading', () => {
    expect(panel).toContain('groups.filter((g) => g.items.length > 0)')
  })

  it('opens above the ruler instead of sliding behind it', () => {
    expect(panel).toMatch(/relative z-40 flex items-center gap-1\.5 px-3/)
    expect(panel).toMatch(/absolute left-0 top-full z-50/)
  })

  it('closes on a click outside, on Escape, and once you have chosen', () => {
    expect(panel).toMatch(/onPick\(it\.id\); setOpen\(false\)/)
    expect(panel).toMatch(/e\.key === 'Escape'.*setOpen\(false\)/)
    expect(panel).toContain('box.current?.contains(e.target as Node)')
  })

  it('will not open while there is nothing to apply it to', () => {
    expect(panel).toContain('{open && !disabled ?')
  })
})
