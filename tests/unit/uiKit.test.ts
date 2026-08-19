import { describe, it, expect } from 'vitest'
import { writeFileSync } from 'fs'
import { expandComponentSpec, expandComponents, addExpenseScreen, DEFAULT_KIT, resolveComponent, repairComponentSpec, kitFromDesignSystem } from '../../src/renderer/src/lib/uiKit'
import { buildObject } from '../../src/renderer/src/lib/canvasAgent'
import { compileTree, type UINode } from '../../src/renderer/src/lib/uiTree'
import { lintObjects } from '../../src/renderer/src/lib/designQA'
import { scoreDesign } from '../../src/renderer/src/lib/designEval'
import { type DesignSystem } from '../../src/renderer/src/lib/designSystem'
import { type FObj } from '../../src/renderer/src/lib/freeformTypes'

describe('uiKit — component expansion', () => {
  it('expands a listRow into a grouped, polished row', () => {
    const out = expandComponentSpec({ type: 'frame', component: 'listRow', x: 0, y: 0, w: 350, props: { icon: 'tag', label: 'Category', value: 'Groceries' } })!
    expect(out).toBeTruthy()
    const names = out.map((o) => o.name)
    expect(names).toContain('Icon')
    expect(names).toContain('Label')
    expect(names).toContain('Value')
    expect(names).toContain('Chevron')
    expect(names).toContain('Divider')
    // children are parented to the row frame
    const frame = out[0]
    expect(out.slice(1).every((o) => o.parent === frame.ref)).toBe(true)
  })
  it('paints the primary button in the accent and nothing else', () => {
    const out = expandComponentSpec({ type: 'frame', component: 'primaryButton', x: 0, y: 0, w: 320, accent: '#6366f1', props: { label: 'Save', icon: 'check' } })!
    expect(out[0]).toMatchObject({ fill: '#6366f1', fillEnabled: true })
  })
  it('returns null for unknown components and passes raw specs through', () => {
    expect(expandComponentSpec({ type: 'rect', component: 'nope' })).toBeNull()
    const raw = [{ type: 'rect' as const }, { type: 'frame' as const, component: 'navBar', props: { title: 'Hi' } }]
    const flat = expandComponents(raw)
    expect(flat.length).toBeGreaterThan(raw.length) // navBar expanded into several
    expect(flat[0]).toMatchObject({ type: 'rect' })
  })
  it('builds transport controls with library icons + an accent play button', () => {
    const out = expandComponentSpec({ type: 'frame', component: 'transport', x: 0, y: 0, w: 350, accent: '#7c3aed', props: {} })!
    const names = out.map((o) => o.name)
    expect(names).toContain('Shuffle')
    expect(names).toContain('Previous')
    expect(names).toContain('Next')
    expect(names).toContain('Repeat')
    expect(names).toContain('Play icon') // filled triangle, not a stroked path
    const playBg = out.find((o) => o.name === 'Play')!
    expect(playBg).toMatchObject({ type: 'ellipse', fill: '#7c3aed', fillEnabled: true })
    const playIcon = out.find((o) => o.name === 'Play icon')!
    expect(playIcon).toMatchObject({ type: 'polygon', fillEnabled: true })
  })
  it('builds a scrubber with a track, accent fill and a thumb', () => {
    const out = expandComponentSpec({ type: 'frame', component: 'scrubber', x: 0, y: 0, w: 300, accent: '#0ea5e9', props: { value: 50, max: 100, leftLabel: '0:30', rightLabel: '1:00' } })!
    const fill = out.find((o) => o.name === 'Fill')!
    expect(fill).toMatchObject({ fill: '#0ea5e9' })
    expect(Math.round(fill.w as number)).toBe(150) // 50% of 300
    expect(out.map((o) => o.name)).toContain('Thumb')
    expect(out.map((o) => o.name)).toContain('Elapsed')
  })
})

describe('uiKit — component schema repair', () => {
  it('resolves a fuzzy/typo component name to the real one', () => {
    expect(resolveComponent('stat')).toBe('statTile')
    expect(resolveComponent('btn')).toBe('primaryButton')
    expect(resolveComponent('Status Bar')).toBe('statusBar')
    expect(resolveComponent('list-item')).toBe('listRow')
    expect(resolveComponent('fab')).toBe('iconButton')
    expect(resolveComponent('totally-unknown-xyz')).toBe('')
  })
  it('expands a sloppy stat spec (wrong name + wrong prop keys) instead of dropping to a box', () => {
    const out = expandComponentSpec({ type: 'frame', component: 'metric-card', x: 0, y: 0, w: 300, props: { title: 'Revenue', number: '$48k', change: '+12%' } })!
    expect(out).toBeTruthy()
    const byName = (n: string): string => String(out.find((o) => o.name === n)?.text ?? '')
    expect(byName('Label')).toBe('Revenue')   // title -> label
    expect(byName('Value')).toBe('$48k')       // number -> value
    expect(byName('Delta')).toBe('+12%')       // change -> delta
  })
  it('keeps the canonical key when both canonical and alias are present', () => {
    const out = expandComponentSpec({ type: 'frame', component: 'statTile', x: 0, y: 0, w: 300, props: { label: 'Right', title: 'Wrong', value: '10' } })!
    expect(String(out.find((o) => o.name === 'Label')?.text)).toBe('Right')
  })
  it('repairComponentSpec returns null for an unresolvable component', () => {
    expect(repairComponentSpec({ type: 'frame', component: 'zzzqqq' })).toBeNull()
  })
})

describe('uiKit — design-system theming (on-brand + dark mode)', () => {
  const darkDS = { colors: { primary: '#22d3ee', secondary: '#7c5cff', tertiary: '#f472b6', bg: '#0b0b0f', surface: '#1a1a1f', text: '#f5f5f7', textMuted: '#9a9aa3', border: '#2a2a30', success: '#16a34a', warning: '#d97706', error: '#dc2626', info: '#2563eb' } } as unknown as DesignSystem
  const render = (specs: ReturnType<typeof compileTree>, bg: string, accent: string): FObj[] => {
    const built = specs.map((s) => buildObject(s, 0, 0))
    const refToId = new Map<string, string>()
    specs.forEach((s, i) => { if (s.ref) refToId.set(s.ref.toLowerCase(), built[i].id) })
    built.forEach((b, i) => { const p = specs[i].parent; if (typeof p === 'string') { const id = refToId.get(p.toLowerCase()); b.parent = id && id !== b.id ? id : undefined } })
    return lintObjects(built, { artboardBg: bg, accent })
  }
  it('derives a dark kit (dark bg, light ink, brand accent) from a dark DS', () => {
    const k = kitFromDesignSystem(darkDS)
    expect(k.bg).toBe('#0b0b0f')
    expect(k.ink).toBe('#f5f5f7')
    expect(k.card).toBe('#1a1a1f')
    expect(k.accent).toBe('#22d3ee')
  })
  it('renders a kit screen in dark mode with readable contrast and the DS bg', () => {
    const k = kitFromDesignSystem(darkDS)
    const tree: UINode = { stack: 'y', bg: 'bg', name: 'Screen', children: [
      { component: 'navBar', props: { title: 'Now playing' } },
      { component: 'listRow', props: { label: 'Track', value: 'M83' } },
      { stack: 'y', pad: 20, children: [{ component: 'primaryButton', props: { label: 'Play' } }] }] }
    const objs = render(compileTree(tree, { width: 390, kit: k }), k.bg, k.accent)
    const s = scoreDesign(objs, { artboardBg: k.bg, accent: k.accent, artboard: { w: 390, h: 844 } })
    expect(s.contrast).toBeGreaterThanOrEqual(0.9)   // light ink on dark bg passes AA
    expect(objs.some((o) => o.fill === '#0b0b0f')).toBe(true) // root frame uses the DS dark bg
    expect(s.accentArea).toBeGreaterThan(0)           // brand accent present on the button
  })
})

describe('uiKit — reference screen export (visual proof)', () => {
  it('builds the add-expense screen and writes it for seeding', () => {
    const specs = addExpenseScreen(DEFAULT_KIT, 390)
    // Mirror assistantCreate: build → remap ref/parent → lint.
    const built = specs.map((s) => buildObject(s, 0, 0))
    const refToId = new Map<string, string>()
    specs.forEach((s, i) => { if (s.ref) refToId.set(s.ref.toLowerCase(), built[i].id) })
    built.forEach((b, i) => {
      const p = specs[i].parent
      if (typeof p === 'string' && p.trim()) { const id = refToId.get(p.toLowerCase()); b.parent = id && id !== b.id ? id : undefined }
    })
    const linted: FObj[] = lintObjects(built, { artboardBg: '#ffffff' })
    expect(linted.length).toBeGreaterThan(15)
    try { writeFileSync('/tmp/t42-screen.json', JSON.stringify(linted)) } catch { /* ignore in CI */ }
  })
})
