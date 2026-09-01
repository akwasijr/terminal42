import { describe, it, expect } from 'vitest'
import { compileTree, type UINode } from '../../src/renderer/src/lib/uiTree'
import { buildObject } from '../../src/renderer/src/lib/canvasAgent'
import { reflowAll } from '../../src/renderer/src/lib/autoLayout'

const build = (tree: UINode, width = 1440): ReturnType<typeof buildObject>[] => {
  const specs = compileTree(tree, { width, accent: '#0f766e' })
  const objs = specs.map((s) => buildObject(s, 0, 0))
  const refToId = new Map<string, string>()
  specs.forEach((s, i) => { if (s.ref) refToId.set(s.ref, objs[i].id) })
  return objs.map((o) => ({ ...o, parent: o.parent ? refToId.get(o.parent) ?? o.parent : undefined }))
}

const DASH: UINode = {
  stack: 'x', name: 'Dashboard', bg: 'bg', children: [
    { w: 240, component: 'sidebar', props: { brand: 'Utility', h: 900, items: [{ section: 'Main' }, { icon: 'gauge', label: 'Overview', active: true }, { icon: 'bolt', label: 'Usage' }] } },
    { stack: 'y', pad: 32, gap: 22, children: [
      { component: 'topBar', props: { title: 'Usage', action: 'Download report' } },
      { stack: 'x', gap: 20, children: [
        { component: 'statTile', props: { label: 'Now', value: '2.4 kW', icon: 'bolt' } },
        { component: 'statTile', props: { label: 'Today', value: '18 kWh', icon: 'activity' } }] },
      { stack: 'grid', cols: 2, gap: 16, children: [
        { component: 'barChart', props: { title: 'This week', values: [1, 2, 3], h: 240 } },
        { text: 'Some notes that wrap over a couple of lines in this cell.', fontSize: 14 }] }] }]
}

describe('generated auto layout', () => {
  it('stamps every container the compiler emits', () => {
    const objs = build(DASH)
    const frames = objs.filter((o) => o.layoutMode && o.layoutMode !== 'none')
    expect(frames.length).toBeGreaterThanOrEqual(4)
    expect(frames.every((f) => typeof f.layoutGap === 'number' && typeof f.layoutPadX === 'number')).toBe(true)
    expect(objs.some((o) => o.layoutMode === 'grid' && o.layoutCols === 2)).toBe(true)
  })

  it('agrees with the reflow engine, so nothing jumps on load', () => {
    const objs = build(DASH)
    const after = reflowAll(objs)
    const byId = new Map(objs.map((o) => [o.id, o]))
    const moved = after.filter((a) => {
      const b = byId.get(a.id)!
      return Math.abs(a.x - b.x) > 1 || Math.abs(a.y - b.y) > 1 || Math.abs(a.w - b.w) > 1 || Math.abs(a.h - b.h) > 1
    })
    expect(moved.map((m) => `${m.name} ${m.x},${m.y} ${m.w}x${m.h}`)).toEqual([])
  })

  // Guards against the test above passing for the wrong reason: if nothing were
  // stamped, reflow would be a no-op and "nothing moved" would be trivially true.
  it('actually reflows, so editing one thing pushes the next one down', () => {
    const objs = build(DASH)
    const main = objs.find((o) => o.layoutMode === 'vertical')!
    const kids = objs.filter((o) => o.parent === main.id).sort((a, b) => a.y - b.y)
    expect(kids.length).toBeGreaterThanOrEqual(3)
    const grown = objs.map((o) => (o.id === kids[0].id ? { ...o, h: o.h + 100 } : o))
    const after = reflowAll(grown)
    const nextBefore = kids[1].y
    const nextAfter = after.find((o) => o.id === kids[1].id)!.y
    expect(nextAfter - nextBefore).toBe(100)
    expect(after.find((o) => o.id === main.id)!.h).toBe(main.h + 100)
  })
})
