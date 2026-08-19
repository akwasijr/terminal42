import { describe, it, expect } from 'vitest'
import { writeFileSync } from 'fs'
import { compileTree, type UINode } from '../../src/renderer/src/lib/uiTree'
import { buildObject } from '../../src/renderer/src/lib/canvasAgent'
import { lintObjects } from '../../src/renderer/src/lib/designQA'
import { scoreDesign } from '../../src/renderer/src/lib/designEval'
import { type FObj, type ObjectSpec } from '../../src/renderer/src/lib/freeformTypes'

// Build → remap ref/parent → lint, mirroring assistantCreate.
function render(specs: ObjectSpec[]): FObj[] {
  const built = specs.map((s) => buildObject(s, 0, 0))
  const refToId = new Map<string, string>()
  specs.forEach((s, i) => { if (s.ref) refToId.set(s.ref.toLowerCase(), built[i].id) })
  built.forEach((b, i) => {
    const p = specs[i].parent
    if (typeof p === 'string' && p.trim()) { const id = refToId.get(p.toLowerCase()); b.parent = id && id !== b.id ? id : undefined }
  })
  return lintObjects(built, { artboardBg: '#ffffff' })
}

describe('uiTree — layout compiler', () => {
  it('stacks children vertically with the gap and hugs height', () => {
    const tree: UINode = { stack: 'y', gap: 8, pad: 0, children: [{ text: 'A', h: 20 }, { text: 'B', h: 20 }, { text: 'C', h: 20 }] }
    const specs = compileTree(tree, { width: 300 })
    const texts = specs.filter((s) => s.type === 'text')
    expect(texts.map((t) => t.y)).toEqual([0, 28, 56])
    const frame = specs.find((s) => s.type === 'frame')!
    expect(frame.h).toBe(76) // 20+8+20+8+20
  })
  it('lays a 2-column grid', () => {
    const tree: UINode = { stack: 'grid', cols: 2, gap: 10, pad: 0, children: [{ text: 'a', h: 30 }, { text: 'b', h: 30 }, { text: 'c', h: 30 }, { text: 'd', h: 30 }] }
    const specs = compileTree(tree, { width: 210 }).filter((s) => s.type === 'text')
    // cellW = (210 - 10)/2 = 100
    expect(specs.map((s) => [s.x, s.y])).toEqual([[0, 0], [110, 0], [0, 40], [110, 40]])
  })
  it('applies padding to inner content', () => {
    const tree: UINode = { stack: 'y', pad: 16, children: [{ text: 'x', h: 20 }] }
    const t = compileTree(tree, { width: 300 }).find((s) => s.type === 'text')!
    expect(t.x).toBe(16); expect(t.y).toBe(16); expect(t.w).toBe(268)
  })
})

describe('uiTree + eval — benchmark add-expense screen', () => {
  const tree: UINode = {
    stack: 'y', gap: 0, pad: 0, bg: 'bg', name: 'Add expense', children: [
      { component: 'statusBar' },
      { component: 'navBar', props: { title: 'New expense' } },
      { h: 24 },
      { component: 'heroAmount', props: { value: '$48.50' } },
      { h: 24 },
      { component: 'listRow', props: { icon: 'tag', label: 'Category', value: 'Groceries' } },
      { component: 'listRow', props: { icon: 'calendar', label: 'Date', value: 'Today, Jun 29' } },
      { component: 'inputRow', props: { icon: 'edit', placeholder: 'Add a note', divider: false } },
      { h: 196 },
      { stack: 'y', pad: 20, children: [{ component: 'primaryButton', props: { label: 'Save expense', icon: 'check' } }] },
      { h: 12 },
      { component: 'homeIndicator' }
    ]
  }
  it('scores well on contrast / grid / structure with no overlaps', () => {
    const objs = render(compileTree(tree, { accent: '#4f46e5', width: 390 }))
    const s = scoreDesign(objs, { artboardBg: '#ffffff', accent: '#4f46e5' })
    expect(s.contrast).toBeGreaterThanOrEqual(0.9)
    expect(s.grid).toBeGreaterThanOrEqual(0.9)
    expect(s.overlaps).toBe(0)
    expect(s.total).toBeGreaterThan(0.8)
    try { writeFileSync('/tmp/t42-tree.json', JSON.stringify(objs)) } catch { /* ignore */ }
  })
})
