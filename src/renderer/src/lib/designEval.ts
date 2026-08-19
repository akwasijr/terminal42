import { type FObj } from './freeformTypes'
import { contrastRatio } from './designQA'
import { ICON_PATHS } from './icons24'

// ── Design eval harness ──────────────────────────────────────────────────────
// Deterministic scorers over a finished object set. Lets us measure generation
// quality (and regressions) without eyeballing screenshots — the meta-lever for
// scaling quality. Scores are 0..1 (higher better) except count fields.

export interface Scores {
  textCount: number
  contrast: number     // share of text with WCAG-AA contrast
  grid: number         // share of objects on the 4px grid
  overlaps: number     // sibling overlaps (lower is better; 0 ideal)
  grouped: number      // share of objects that live inside a frame (structure)
  accentArea: number   // share of filled area painted in the accent (want small but > 0)
  boxes: number        // bordered card-like rects (boxiness; lower is better)
  handIcons: number    // icon-shaped paths NOT from the library (hand-drawn; lower is better)
  orphans: number      // children placed outside their parent's box (misplacement; lower is better)
  total: number        // headline 0..1
}

const LIB_ICONS = new Set(Object.values(ICON_PATHS))

const onGrid = (v: number): boolean => Math.abs(v - Math.round(v / 4) * 4) < 0.5

function hexOk(s?: string): boolean { return !!s && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s) }
function sameHex(a?: string, b?: string): boolean {
  if (!hexOk(a) || !hexOk(b)) return false
  const norm = (h: string): string => { let s = h.replace('#', ''); if (s.length === 3) s = s.split('').map((c) => c + c).join(''); return s.toLowerCase() }
  return norm(a!) === norm(b!)
}

function bgBehind(o: FObj, byId: Map<string, FObj>, artboardBg: string): string {
  let cur: FObj | undefined = o.parent ? byId.get(o.parent) : undefined
  let g = 0
  while (cur && g++ < 8) {
    if (cur.fillEnabled && cur.fillMode !== 'gradient' && cur.fillMode !== 'image' && hexOk(cur.fill)) return cur.fill!
    cur = cur.parent ? byId.get(cur.parent) : undefined
  }
  return artboardBg
}

const overlap = (a: FObj, b: FObj): number => {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  const inter = ix * iy
  const min = Math.max(1, Math.min(a.w * a.h, b.w * b.h))
  return inter / min
}

export function scoreDesign(objs: FObj[], opts: { artboardBg?: string; accent?: string; artboard?: { w: number; h: number } } = {}): Scores {
  const bg = opts.artboardBg ?? '#ffffff'
  const byId = new Map(objs.map((o) => [o.id, o]))
  const texts = objs.filter((o) => o.type === 'text')
  const contrastPass = texts.filter((o) => contrastRatio(o.color || '#111827', bgBehind(o, byId, bg)) >= 4.5).length
  const gridPass = objs.filter((o) => onGrid(o.x) && onGrid(o.y) && onGrid(o.w) && onGrid(o.h)).length

  // sibling overlaps (same parent): only PARTIAL overlaps are real layout bugs;
  // full containment (icon inside a button, fill inside an outline) is intentional.
  let overlaps = 0
  const groups = new Map<string, FObj[]>()
  for (const o of objs) { const key = o.parent ?? '__root'; (groups.get(key) ?? groups.set(key, []).get(key)!).push(o) }
  for (const sibs of groups.values()) {
    for (let i = 0; i < sibs.length; i++) for (let j = i + 1; j < sibs.length; j++) {
      const f = overlap(sibs[i], sibs[j])
      if (f > 0.5 && f < 0.92) overlaps++
    }
  }
  const grouped = objs.filter((o) => o.parent).length

  // Boxiness: bordered CARD-like rectangles (visible stroke, rounded, card-sized).
  // Input fields/toggles are smaller and legitimately bordered, so the height floor
  // keeps this measuring the rudimentary "everything in an outlined card" look.
  const boxes = objs.filter((o) => (o.type === 'rect' || o.type === 'frame') && o.strokeEnabled && (o.strokeWidth ?? 0) > 0 && (o.radius ?? 0) >= 6 && o.w >= 120 && o.h >= 56).length

  // Hand-drawn icons: a path that is icon-shaped (small, ~square) but whose geometry
  // isn't from the library — the "model drew its own wonky glyph" failure, domain-agnostic.
  const handIcons = objs.filter((o) => {
    if (o.type !== 'path' || !o.path) return false
    const lo = Math.min(o.w, o.h), hi = Math.max(o.w, o.h)
    if (lo < 8 || hi > 64 || hi / Math.max(1, lo) > 2) return false
    return !LIB_ICONS.has(o.path)
  }).length

  // Orphans: a child whose box falls largely outside its parent's box — the
  // misplacement signal (a slider parked in the wrong section, an element off-frame).
  // Hairlines (dividers/rules) sit on edges by design, so they don't count.
  let orphans = 0
  for (const o of objs) {
    const p = o.parent ? byId.get(o.parent) : undefined
    if (!p) continue
    if (o.type === 'line' || Math.min(o.w, o.h) <= 2) continue
    const ix = Math.max(0, Math.min(o.x + o.w, p.x + p.w) - Math.max(o.x, p.x))
    const iy = Math.max(0, Math.min(o.y + o.h, p.y + p.h) - Math.max(o.y, p.y))
    const inside = (ix * iy) / Math.max(1, o.w * o.h)
    if (inside < 0.6) orphans++
  }

  // Accent usage: share of filled area painted in the accent. We want it small but
  // present (restraint) — 0 means "grey primary / no accent", huge means "over-accent".
  let accentArea = 0
  if (opts.accent) {
    const area = (opts.artboard ? opts.artboard.w * opts.artboard.h : Math.max(1, ...objs.map((o) => o.w * o.h)))
    let acc = 0
    for (const o of objs) if (o.fillEnabled && sameHex(o.fill, opts.accent)) acc += o.w * o.h
    accentArea = acc / Math.max(1, area)
  }

  const contrast = texts.length ? contrastPass / texts.length : 1
  const grid = objs.length ? gridPass / objs.length : 1
  const groupedShare = objs.length ? grouped / objs.length : 0
  // headline: contrast + grid + structure, penalised by overlaps, boxiness,
  // hand-drawn icons and misplaced (orphan) elements — the systemic defects.
  const total = Math.max(0, Math.min(1,
    0.35 * contrast + 0.25 * grid + 0.2 * groupedShare
    - 0.05 * overlaps - 0.03 * boxes - 0.04 * handIcons - 0.05 * orphans
    + (accentArea > 0.0005 ? 0.2 : 0)))
  return { textCount: texts.length, contrast, grid, overlaps, grouped: groupedShare, accentArea, boxes, handIcons, orphans, total }
}
