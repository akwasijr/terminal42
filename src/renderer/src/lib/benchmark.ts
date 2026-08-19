// ── Repeatable quality benchmark ─────────────────────────────────────────────
// Turns "is the design system getting better?" into a NUMBER, measured across many
// DOMAINS — not a per-screenshot vibe check. Two kinds of case:
//   • clean  — a golden semantic tree compiled + run through the QA gate; the score
//              must stay high (a cross-domain regression guard).
//   • adversarial — a raw object set that mimics what a weak model emits (hand-drawn
//              icons, off-grid, outlined boxes, a grey primary). We score it BEFORE
//              and AFTER the gate; the gate must lift it. This proves the fix is
//              model-independent and repeatable, not a per-prompt patch.

import { type FObj } from './freeformTypes'
import { type UINode, compileTree } from './uiTree'
import { buildObject, type ObjectSpec } from './canvasAgent'
import { lintObjects } from './designQA'
import { scoreDesign, type Scores } from './designEval'
import { DEFAULT_KIT, expandComponents } from './uiKit'
import { GOLDEN_EXAMPLES } from './goldenExamples'

export type Domain = 'form' | 'list' | 'settings' | 'commerce' | 'media' | 'dashboard' | 'social' | 'content'

export interface BenchmarkCase {
  id: string
  title: string
  domain: Domain
  device: 'mobile' | 'desktop'
  kind: 'clean' | 'adversarial'
  /** semantic tree (clean cases) */
  tree?: UINode
  /** raw object set (adversarial cases) */
  objects?: ObjectSpec[]
  accent?: string
}

/** Mirror the real create path: expand components → build → remap ref/parent → run the QA gate. */
export function specsToObjects(rawSpecs: ObjectSpec[], opts: { artboardBg?: string; accent?: string } = {}): FObj[] {
  const specs = expandComponents(rawSpecs)
  const built = specs.map((s) => buildObject(s, 0, 0))
  const refToId = new Map<string, string>()
  specs.forEach((s, i) => { if (s.ref) refToId.set(s.ref.toLowerCase(), built[i].id) })
  built.forEach((b, i) => {
    const p = specs[i].parent
    if (typeof p === 'string' && p.trim()) { const id = refToId.get(p.toLowerCase()); b.parent = id && id !== b.id ? id : undefined }
  })
  return lintObjects(built, { artboardBg: opts.artboardBg ?? '#ffffff', accent: opts.accent })
}

/** Build the object set WITHOUT the gate (to measure the "before" of an adversarial case). */
function specsRaw(specs: ObjectSpec[]): FObj[] {
  const built = specs.map((s) => buildObject(s, 0, 0))
  const refToId = new Map<string, string>()
  specs.forEach((s, i) => { if (s.ref) refToId.set(s.ref.toLowerCase(), built[i].id) })
  built.forEach((b, i) => {
    const p = specs[i].parent
    if (typeof p === 'string' && p.trim()) { const id = refToId.get(p.toLowerCase()); b.parent = id && id !== b.id ? id : undefined }
  })
  return built
}

export interface BenchmarkRow {
  id: string
  title: string
  domain: Domain
  device: 'mobile' | 'desktop'
  kind: 'clean' | 'adversarial'
  before?: Scores
  after: Scores
}

export interface BenchmarkResult {
  rows: BenchmarkRow[]
  meanTotal: number
  /** mean uplift the gate delivered on adversarial cases (after - before) */
  meanGateUplift: number
}

const DOMAIN_OF: Record<string, Domain> = { expense: 'form', today: 'list', settings: 'settings', checkout: 'commerce', player: 'media', dashboard: 'dashboard' }

// A NEVER-SEEN domain (event scheduling) built ENTIRELY from generic atoms + the
// shared nav/button — zero domain-specific component code. If this scores well, the
// "compose from atoms" approach is proven repeatable, not a per-domain patch.
const newEvent: UINode = {
  stack: 'y', bg: 'bg', name: 'New event', children: [
    { component: 'statusBar' },
    { component: 'navBar', props: { title: 'New event', back: true } },
    { h: 16 },
    { stack: 'y', pad: 20, gap: 16, children: [
      { component: 'field', props: { label: 'Title', placeholder: 'Team standup' } },
      { component: 'field', props: { label: 'Location', icon: 'map', placeholder: 'Add location' } },
      { component: 'field', props: { label: 'Date', icon: 'calendar', value: 'Mon, Jun 29' } },
      { component: 'slider', props: { label: 'Remind me (minutes before)', value: 15, max: 60 } },
      { component: 'divider' },
      { component: 'field', props: { label: 'Notes', placeholder: 'Add a note' } }] },
    { h: 80 },
    { stack: 'y', pad: 20, children: [{ component: 'primaryButton', props: { label: 'Create event', icon: 'check' } }] },
    { h: 12 },
    { component: 'homeIndicator' }]
}

// — Adversarial fixtures: what a weak model tends to emit, per failure mode. —
function advHandDrawnIcons(): ObjectSpec[] {
  // icon-shaped paths with bespoke (non-library) geometry, named after real icons.
  const card = 'c'
  return [
    { type: 'frame', ref: card, name: 'Row', x: 0, y: 0, w: 320, h: 56, fillEnabled: false },
    { type: 'path', parent: card, name: 'Search', x: 16, y: 18, w: 22, h: 22, path: 'M2 2L20 20M10 2v18', pathViewBox: '0 0 1 1', strokeEnabled: true, stroke: '#111827' },
    { type: 'path', parent: card, name: 'Calendar', x: 60, y: 18, w: 22, h: 22, path: 'M3 3h16v16H3z', pathViewBox: '0 0 1 1', strokeEnabled: true, stroke: '#111827' },
    { type: 'text', parent: card, name: 'Label', x: 96, y: 18, w: 200, h: 20, text: 'Find events', color: '#111827', fontSize: 16 }]
}
function advBoxyOffGrid(): ObjectSpec[] {
  // outlined cards, off-grid geometry — the rudimentary look.
  const a = 'a', b = 'b'
  return [
    { type: 'frame', ref: a, name: 'Card', x: 13, y: 7, w: 322, h: 121, radius: 10, fillEnabled: false, strokeEnabled: true, stroke: '#e5e7eb', strokeWidth: 1 },
    { type: 'text', parent: a, name: 'Title', x: 29, y: 23, w: 200, h: 20, text: 'Revenue', color: '#9ca3af', fontSize: 17 },
    { type: 'frame', ref: b, name: 'Card', x: 13, y: 145, w: 322, h: 121, radius: 10, fillEnabled: false, strokeEnabled: true, stroke: '#e5e7eb', strokeWidth: 1 },
    { type: 'text', parent: b, name: 'Title', x: 29, y: 161, w: 200, h: 20, text: 'Active users', color: '#aab0bb', fontSize: 15 }]
}
function advGreyPrimary(): ObjectSpec[] {
  // a "primary" button painted grey instead of the accent.
  const btn = 'btn'
  return [
    { type: 'frame', ref: btn, name: 'Save button', x: 20, y: 20, w: 320, h: 52, radius: 26, fill: '#4b5563', fillEnabled: true, strokeEnabled: false },
    { type: 'text', parent: btn, name: 'Label', x: 20, y: 36, w: 320, h: 20, text: 'Save', color: '#ffffff', fontSize: 16, fontWeight: 600, align: 'center' }]
}

function advMisplaced(): ObjectSpec[] {  // a volume slider parked OUTSIDE its section (the music-player failure, generalised).
  const sec = 's'
  return [
    { type: 'frame', ref: sec, name: 'Player controls', x: 20, y: 40, w: 320, h: 120, radius: 16, fill: '#ffffff', fillEnabled: true, strokeEnabled: false },
    { type: 'text', parent: sec, name: 'Now playing', x: 40, y: 60, w: 200, h: 20, text: 'Now playing', color: '#111827', fontSize: 16, fontWeight: 600 },
    { type: 'rect', parent: sec, name: 'Volume track', x: 40, y: 320, w: 280, h: 6, radius: 3, fill: '#e5e7eb', fillEnabled: true, strokeEnabled: false },
    { type: 'ellipse', parent: sec, name: 'Volume thumb', x: 180, y: 316, w: 14, h: 14, fill: '#ffffff', fillEnabled: true, strokeEnabled: false }]
}

function advSloppyComponents(): ObjectSpec[] {
  // wrong component names + wrong prop keys — without repair these drop to bare boxes.
  return [
    { type: 'frame', component: 'metric-card', name: 'stat', x: 0, y: 0, w: 320, props: { title: 'Revenue', number: '$48,200', change: '+12% MoM' } },
    { type: 'frame', component: 'btn', name: 'button', x: 0, y: 132, w: 320, accent: '#0f766e', props: { text: 'Continue' } }]
}

export const BENCHMARK_CASES: BenchmarkCase[] = [
  // clean cross-domain baseline (compile + gate must stay high)
  ...GOLDEN_EXAMPLES.map((ex): BenchmarkCase => ({
    id: `clean-${ex.id}`, title: ex.title, domain: DOMAIN_OF[ex.id] ?? 'content', device: ex.device, kind: 'clean', tree: ex.tree
  })),
  // adversarial (gate must lift the score)
  { id: 'adv-icons', title: 'Hand-drawn icons', domain: 'list', device: 'mobile', kind: 'adversarial', objects: advHandDrawnIcons() },
  { id: 'adv-boxy', title: 'Outlined boxes + off-grid', domain: 'dashboard', device: 'mobile', kind: 'adversarial', objects: advBoxyOffGrid() },
  { id: 'adv-grey', title: 'Grey primary button', domain: 'form', device: 'mobile', kind: 'adversarial', objects: advGreyPrimary(), accent: DEFAULT_KIT.accent },
  { id: 'adv-misplaced', title: 'Slider outside its section', domain: 'media', device: 'mobile', kind: 'adversarial', objects: advMisplaced() },
  { id: 'adv-sloppy', title: 'Sloppy component specs', domain: 'dashboard', device: 'mobile', kind: 'adversarial', objects: advSloppyComponents(), accent: DEFAULT_KIT.accent },
  // new-domain proof: composed only from generic atoms, no domain component code
  { id: 'clean-newdomain', title: 'New event (atoms only)', domain: 'content', device: 'mobile', kind: 'clean', tree: newEvent },
]

/** Run the whole benchmark and return per-case scores + headline aggregates. */
export function runBenchmark(cases: BenchmarkCase[] = BENCHMARK_CASES): BenchmarkResult {
  const rows: BenchmarkRow[] = cases.map((c) => {
    const accent = c.accent ?? DEFAULT_KIT.accent
    if (c.kind === 'clean' && c.tree) {
      const width = c.device === 'desktop' ? 1440 : 390
      const objs = specsToObjects(compileTree(c.tree, { width, accent }), { accent })
      const after = scoreDesign(objs, { accent, artboard: { w: width, h: c.device === 'desktop' ? 900 : 844 } })
      return { id: c.id, title: c.title, domain: c.domain, device: c.device, kind: c.kind, after }
    }
    const specs = c.objects ?? []
    const before = scoreDesign(specsRaw(specs), { accent })
    const after = scoreDesign(specsToObjects(specs, { accent }), { accent })
    return { id: c.id, title: c.title, domain: c.domain, device: c.device, kind: c.kind, before, after }
  })
  const meanTotal = rows.reduce((s, r) => s + r.after.total, 0) / Math.max(1, rows.length)
  const adv = rows.filter((r) => r.before)
  const meanGateUplift = adv.length ? adv.reduce((s, r) => s + (r.after.total - r.before!.total), 0) / adv.length : 0
  return { rows, meanTotal, meanGateUplift }
}

/** A compact text scorecard for the generation inspector / CLI. */
export function formatScorecard(res: BenchmarkResult): string {
  const pct = (n: number): string => (n * 100).toFixed(0).padStart(3) + '%'
  const head = 'case'.padEnd(26) + 'domain'.padEnd(11) + 'total  contr  grid  ovlp  box  hand  orph'
  const lines = res.rows.map((r) => {
    const s = r.after
    return r.title.slice(0, 25).padEnd(26) + r.domain.padEnd(11) +
      pct(s.total) + '  ' + pct(s.contrast) + '  ' + pct(s.grid) +
      '  ' + String(s.overlaps).padStart(4) + ' ' + String(s.boxes).padStart(4) + ' ' + String(s.handIcons).padStart(5) + ' ' + String(s.orphans).padStart(5)
  })
  return [head, ...lines, '', `mean total: ${pct(res.meanTotal)}   mean gate uplift (adversarial): +${(res.meanGateUplift * 100).toFixed(0)}%`].join('\n')
}
