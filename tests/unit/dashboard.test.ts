import { describe, it, expect } from 'vitest'
import { writeFileSync } from 'fs'
import { compileTree, type UINode } from '../../src/renderer/src/lib/uiTree'
import { buildObject, type ObjectSpec } from '../../src/renderer/src/lib/canvasAgent'
import { lintObjects } from '../../src/renderer/src/lib/designQA'
import { scoreDesign } from '../../src/renderer/src/lib/designEval'
import { DEFAULT_KIT } from '../../src/renderer/src/lib/uiKit'
import { type FObj } from '../../src/renderer/src/lib/freeformTypes'

function render(specs: ObjectSpec[]): FObj[] {
  const built = specs.map((s) => buildObject(s, 0, 0))
  const refToId = new Map<string, string>()
  specs.forEach((s, i) => { if (s.ref) refToId.set(s.ref.toLowerCase(), built[i].id) })
  built.forEach((b, i) => { const p = specs[i].parent; if (typeof p === 'string') { const id = refToId.get(p.toLowerCase()); b.parent = id && id !== b.id ? id : undefined } })
  return lintObjects(built, { artboardBg: '#ffffff' })
}

const dashboard: UINode = {
  stack: 'x', bg: 'surface', name: 'Dashboard', children: [
    { w: 240, component: 'sidebar', props: { brand: 'Streak', brandIcon: 'flame', h: 900, items: [
      { icon: 'home', label: 'Dashboard', active: true }, { icon: 'check', label: 'Habits' }, { icon: 'chart', label: 'Statistics' }, { icon: 'calendar', label: 'Calendar' }, { icon: 'settings', label: 'Settings' }] } },
    { stack: 'y', pad: 32, gap: 22, children: [
      { component: 'topBar', props: { title: 'Good morning, Akwasi', subtitle: "You're on a 12-day streak — keep going.", action: 'New habit' } },
      { stack: 'x', gap: 20, children: [
        { component: 'statTile', props: { label: 'Current streak', value: '12 days', delta: '+2 vs last week', icon: 'flame' } },
        { component: 'statTile', props: { label: 'Completion rate', value: '84%', delta: '+6% this month', icon: 'chart' } },
        { component: 'statTile', props: { label: 'Active habits', value: '6', delta: '2 due today', icon: 'check' } }] },
      { stack: 'x', gap: 20, children: [
        { component: 'barChart', props: { title: 'This week', values: [60, 90, 75, 120, 150, 110, 175], labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], h: 300 } },
        { w: 360, stack: 'y', bg: 'white', radius: 14, pad: 18, name: 'Today', children: [
          { text: "Today's habits", fontSize: 16, fontWeight: 600 }, { h: 6 },
          { component: 'listRow', props: { icon: 'flame', label: 'Morning run', value: '12d' } },
          { component: 'listRow', props: { icon: 'book', label: 'Read 20 pages', value: '5d' } },
          { component: 'listRow', props: { icon: 'drop', label: 'Drink water', value: '6/8', divider: false } }] }] }] }]
}

const mobile: UINode = {
  stack: 'y', bg: 'bg', name: 'Today', children: [
    { component: 'statusBar' }, { component: 'navBar', props: { title: 'Today', back: false } }, { h: 10 },
    { component: 'progressRing', props: { value: 4, max: 6, label: 'done today', size: 150 } }, { h: 16 },
    { stack: 'y', pad: 20, gap: 0, children: [
      { component: 'listRow', props: { icon: 'flame', label: 'Morning run', value: '12 days' } },
      { component: 'listRow', props: { icon: 'book', label: 'Read 20 pages', value: '5 days' } },
      { component: 'listRow', props: { icon: 'drop', label: 'Drink water', value: '6/8', divider: false } }] },
    { h: 120 }, { component: 'tabBar', props: { items: [{ icon: 'home', active: true }, { icon: 'chart' }, { icon: 'calendar' }, { icon: 'user' }] } }]
}

describe('dashboard + mobile from the expanded kit', () => {
  it('compiles a clean desktop dashboard', () => {
    const objs = render(compileTree(dashboard, { width: 1440, accent: DEFAULT_KIT.accent }))
    const s = scoreDesign(objs, { artboardBg: '#f9fafb', accent: DEFAULT_KIT.accent, artboard: { w: 1440, h: 900 } })
    expect(s.accentArea).toBeGreaterThan(0.001)
    expect(s.overlaps).toBe(0)
    expect(objs.length).toBeGreaterThan(40)
    try { writeFileSync('/tmp/t42-dash.json', JSON.stringify(objs)) } catch { /* ignore */ }
  })
  it('compiles a clean mobile screen with a progress ring + tab bar', () => {
    const objs = render(compileTree(mobile, { width: 390, accent: DEFAULT_KIT.accent }))
    const s = scoreDesign(objs, { artboardBg: '#ffffff', accent: DEFAULT_KIT.accent, artboard: { w: 390, h: 844 } })
    expect(s.contrast).toBeGreaterThanOrEqual(0.9)
    expect(s.overlaps).toBe(0)
    try { writeFileSync('/tmp/t42-mob.json', JSON.stringify(objs)) } catch { /* ignore */ }
  })
})
