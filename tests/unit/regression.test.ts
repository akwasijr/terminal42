import { describe, it, expect } from 'vitest'
import { writeFileSync } from 'fs'
import { buildObject, type ObjectSpec } from '../../src/renderer/src/lib/canvasAgent'
import { lintObjects } from '../../src/renderer/src/lib/designQA'
import { scoreDesign } from '../../src/renderer/src/lib/designEval'
import { addExpenseScreen, DEFAULT_KIT } from '../../src/renderer/src/lib/uiKit'
import { type FObj } from '../../src/renderer/src/lib/freeformTypes'

const ART = { w: 390, h: 844 }
const ACCENT = DEFAULT_KIT.accent

function render(specs: ObjectSpec[]): FObj[] {
  const built = specs.map((s) => buildObject(s, 0, 0))
  const refToId = new Map<string, string>()
  specs.forEach((s, i) => { if (s.ref) refToId.set(s.ref.toLowerCase(), built[i].id) })
  built.forEach((b, i) => { const p = specs[i].parent; if (typeof p === 'string') { const id = refToId.get(p.toLowerCase()); b.parent = id && id !== b.id ? id : undefined } })
  return lintObjects(built, { artboardBg: '#ffffff' })
}

// Reconstruction of the OLD rudimentary output (the three screenshots): every field
// wrapped in an outlined card, and a GREY primary button with no accent at all.
const OLD: ObjectSpec[] = [
  { type: 'path', icon: 'chevron-left', x: 20, y: 60, w: 22, h: 22, stroke: '#111827' },
  { type: 'text', x: 60, y: 62, w: 270, h: 22, text: 'New expense', color: '#111827', fontSize: 17, fontWeight: 600, align: 'center' },
  { type: 'rect', x: 20, y: 112, w: 350, h: 110, fill: '#f9fafb', fillEnabled: true, stroke: '#e5e7eb', strokeEnabled: true, strokeWidth: 1, radius: 12 },
  { type: 'text', x: 40, y: 128, w: 120, h: 18, text: 'Amount', color: '#6b7280', fontSize: 14 },
  { type: 'text', x: 40, y: 152, w: 220, h: 48, text: '$48.50', color: '#111827', fontSize: 40, fontWeight: 700 },
  { type: 'rect', x: 20, y: 236, w: 350, h: 64, fill: '#f9fafb', fillEnabled: true, stroke: '#e5e7eb', strokeEnabled: true, strokeWidth: 1, radius: 12 },
  { type: 'path', icon: 'tag', x: 40, y: 254, w: 22, h: 22, stroke: '#6b7280' },
  { type: 'text', x: 74, y: 256, w: 200, h: 20, text: 'Groceries', color: '#111827', fontSize: 15 },
  { type: 'rect', x: 20, y: 316, w: 350, h: 64, fill: '#f9fafb', fillEnabled: true, stroke: '#e5e7eb', strokeEnabled: true, strokeWidth: 1, radius: 12 },
  { type: 'path', icon: 'calendar', x: 40, y: 334, w: 22, h: 22, stroke: '#6b7280' },
  { type: 'text', x: 74, y: 336, w: 200, h: 20, text: 'Today, Jun 29', color: '#111827', fontSize: 15 },
  { type: 'rect', x: 20, y: 396, w: 350, h: 84, fill: '#f9fafb', fillEnabled: true, stroke: '#e5e7eb', strokeEnabled: true, strokeWidth: 1, radius: 12 },
  { type: 'path', icon: 'edit', x: 40, y: 414, w: 22, h: 22, stroke: '#9ca3af' },
  { type: 'text', x: 74, y: 416, w: 200, h: 20, text: 'Add a note', color: '#9ca3af', fontSize: 15 },
  { type: 'rect', x: 20, y: 760, w: 350, h: 56, fill: '#374151', fillEnabled: true, radius: 12 }, // GREY primary
  { type: 'text', x: 20, y: 778, w: 350, h: 20, text: 'Save expense', color: '#ffffff', fontSize: 16, fontWeight: 600, align: 'center' },
  { type: 'path', icon: 'check', x: 128, y: 779, w: 18, h: 18, stroke: '#ffffff' }
]

describe('regression — rudimentary output vs component kit', () => {
  it('the eval harness catches the old failures and the fix beats them', () => {
    const oldScore = scoreDesign(render(OLD), { artboardBg: '#ffffff', accent: ACCENT, artboard: ART })
    const newScore = scoreDesign(render(addExpenseScreen(DEFAULT_KIT, 390)), { artboardBg: '#ffffff', accent: ACCENT, artboard: ART })

    // What went wrong (now measurable):
    expect(oldScore.boxes).toBeGreaterThanOrEqual(3)        // boxy: outlined cards everywhere
    expect(oldScore.accentArea).toBeLessThan(0.002)         // grey primary → no accent at all

    // The fix:
    expect(newScore.boxes).toBe(0)                          // borderless rows + dividers
    expect(newScore.accentArea).toBeGreaterThan(0.01)       // accent present…
    expect(newScore.accentArea).toBeLessThan(0.25)          // …but with restraint
    expect(newScore.total).toBeGreaterThan(oldScore.total)

    try { writeFileSync('/tmp/t42-regression.json', JSON.stringify({ old: oldScore, new: newScore }, null, 2)) } catch { /* ignore */ }
  })
})
