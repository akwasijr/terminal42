import { type FObj } from './freeformTypes'
import { ICON_PATHS, resolveIcon } from './icons24'

// ── Deterministic design QA (the "linter" pass) ──────────────────────────────
// Cheap, model-independent fixes applied to freshly generated objects so output
// always meets baseline craft: on-grid geometry, a tidy radius/type scale, and
// readable text contrast. It is intentionally conservative and NEVER touches a
// field the caller marks as locked (the user's stated intent is law).

const TYPE_SCALE = [11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 40, 48, 60, 72]
const RADII = [0, 2, 4, 6, 8, 12, 16, 20, 24, 9999]

const snap = (v: number, step: number): number => Math.round(v / step) * step
const nearest = (v: number, arr: number[]): number => arr.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), arr[0])

// ── colour helpers ───────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function relLuminance([r, g, b]: [number, number, number]): number {
  const f = (c: number): number => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export function contrastRatio(a: string, b: string): number {
  const ca = hexToRgb(a), cb = hexToRgb(b)
  if (!ca || !cb) return 21
  const la = relLuminance(ca), lb = relLuminance(cb)
  const hi = Math.max(la, lb), lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}
/** Pick the most readable ink (near-black or near-white) for a background. */
export function readableInk(bg: string): string {
  return contrastRatio('#111827', bg) >= contrastRatio('#f9fafb', bg) ? '#111827' : '#f9fafb'
}

const INK_DARK = '#111827'
const INK_LIGHT = '#f9fafb'

/** Move a colour toward black (t < 0) or white (t > 0) by |t|, keeping its hue. */
function shade(hex: string, t: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const target = t > 0 ? 255 : 0
  const k = Math.min(1, Math.abs(t))
  const out = rgb.map((c) => Math.round(c + (target - c) * k))
  return `#${out.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

export interface ReadablePair { bg: string; ink: string }

/**
 * A background and an ink that are guaranteed to clear `min` (WCAG 2.2 SC 1.4.3
 * asks for 4.5:1 on normal text). readableInk on its own only picks the better
 * of two inks, with no floor, which is how a mid-tone green button ended up
 * carrying near-black text at about 3:1.
 *
 * When neither ink clears the bar the BACKGROUND moves, not the text, because a
 * filled control has to keep looking like the brand. Both directions are tried
 * and the smaller shift wins, so the colour travels as little as it can.
 */
export function readablePair(bg: string, min = 4.5): ReadablePair {
  const ink = readableInk(bg)
  if (!hexToRgb(bg) || contrastRatio(ink, bg) >= min) return { bg, ink }
  let darker: ReadablePair | null = null
  let lighter: ReadablePair | null = null
  for (let t = 0.02; t <= 1.0001; t += 0.02) {
    if (!darker) { const c = shade(bg, -t); if (contrastRatio(INK_LIGHT, c) >= min) darker = { bg: c, ink: INK_LIGHT } }
    if (!lighter) { const c = shade(bg, t); if (contrastRatio(INK_DARK, c) >= min) lighter = { bg: c, ink: INK_DARK } }
    if (darker && lighter) break
  }
  // Whichever direction got there first is the smaller move. Darkening is
  // preferred on a tie because a washed-out primary reads as disabled.
  if (darker && lighter) {
    const dd = Math.abs(relLuminance(hexToRgb(darker.bg)!) - relLuminance(hexToRgb(bg)!))
    const dl = Math.abs(relLuminance(hexToRgb(lighter.bg)!) - relLuminance(hexToRgb(bg)!))
    return dd <= dl ? darker : lighter
  }
  return darker ?? lighter ?? { bg, ink }
}

/** HSL saturation of a hex colour (0..1). Greys/near-black/near-white ≈ 0. */
function saturation(hex?: string): number {
  const rgb = hex ? hexToRgb(hex) : null
  if (!rgb) return 0
  const [r, g, b] = rgb.map((c) => c / 255) as [number, number, number]
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  if (max === min) return 0
  const l = (max + min) / 2, d = max - min
  return l > 0.5 ? d / (2 - max - min) : d / (max + min)
}
function luminanceOf(hex?: string): number {
  const rgb = hex ? hexToRgb(hex) : null
  return rgb ? relLuminance(rgb) : 1
}

const paints = (o: FObj, fill: (o: FObj) => string | undefined): string | undefined => {
  const cf = fill(o)
  if (!o.fillEnabled || o.fillMode === 'gradient' || o.fillMode === 'image') return undefined
  if (o.visible === false) return undefined
  if (typeof cf !== 'string' || !hexToRgb(cf)) return undefined
  return cf
}
const contains = (outer: FObj, inner: FObj): boolean =>
  outer.x <= inner.x + 1 && outer.y <= inner.y + 1 &&
  outer.x + outer.w >= inner.x + inner.w - 1 && outer.y + outer.h >= inner.y + inner.h - 1

/**
 * The solid colour actually visible behind an object.
 *
 * The ancestor chain alone is not enough: a kit component may park a label on
 * the component frame while a filled button sits between the two, which is how
 * a white "Download report" label was judged against the white page and flipped
 * to black. So the topmost thing painted UNDER the object that also encloses it
 * wins, whether or not it is an ancestor. Later in the array means nearer the
 * front.
 */
function bgBehind(o: FObj, byId: Map<string, FObj>, artboardBg?: string, fillOf?: (o: FObj) => string | undefined, order?: FObj[], index?: number): string | undefined {
  const fill = fillOf ?? ((x: FObj) => x.fill)
  if (order && typeof index === 'number') {
    for (let i = index - 1; i >= 0; i--) {
      const c = order[i]
      if (c.id === o.id || !contains(c, o)) continue
      const cf = paints(c, fill)
      if (cf) return cf
    }
  }
  let cur: FObj | undefined = o.parent ? byId.get(o.parent) : undefined
  let guard = 0
  while (cur && guard++ < 8) {
    const cf = paints(cur, fill)
    if (cf) return cf
    cur = cur.parent ? byId.get(cur.parent) : undefined
  }
  return artboardBg
}

export interface LintOptions {
  /** background colour of the active artboard (for contrast checks) */
  artboardBg?: string
  /** geometry grid in px (default 4) */
  grid?: number
  /** the project accent — a grey/black "primary" action is recoloured to this */
  accent?: string
  /** return true for an (id, field) pair the user has locked — it will be left untouched */
  locked?: (id: string, field: keyof FObj) => boolean
}

/** Is this object a hand-drawn vector that's clearly meant to be a small UI icon? */
function isIconShaped(o: FObj): boolean {
  if (o.type !== 'path' || !o.path) return false
  const w = o.w, h = o.h
  const lo = Math.min(w, h), hi = Math.max(w, h)
  if (lo < 8 || hi > 64) return false
  return hi / Math.max(1, lo) <= 2 // roughly square
}

/** Rough bounding box of a path's coordinates (treats the number stream as x,y
 * pairs — good enough to give a hand-drawn icon a sane, non-skewing viewBox). */
function pathBBox(d: string): { x: number; y: number; s: number } | null {
  const nums = (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number).filter((n) => isFinite(n))
  if (nums.length < 4) return null
  const xs: number[] = [], ys: number[] = []
  for (let i = 0; i + 1 < nums.length; i += 2) { xs.push(nums[i]); ys.push(nums[i + 1]) }
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const w = maxX - minX, h = maxY - minY
  if (!(w > 0) || !(h > 0)) return null
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, s = Math.max(w, h) * 1.12
  return { x: cx - s / 2, y: cy - s / 2, s }
}

/** A library icon renders perfectly (uniform "meet" scale in a 24-grid). A model
 * that hand-draws icon geometry gets imperfect/skewed glyphs, so we (1) swap any
 * icon-shaped path whose layer name maps to a library icon for the real geometry,
 * and (2) failing that, give a viewBox-less icon path a SQUARE viewBox so it scales
 * uniformly (meet) instead of stretching (the visible "skew"). */
function snapIcon(o: FObj, isLocked: (id: string, field: keyof FObj) => boolean): Partial<FObj> | null {
  if (!isIconShaped(o) || isLocked(o.id, 'path')) return null
  const key = resolveIcon(o.name)
  const path = key ? ICON_PATHS[key] : ''
  if (path && !(o.path === path && o.pathViewBox === '0 0 24 24')) {
    return { path, pathViewBox: '0 0 24 24', fillEnabled: false, strokeEnabled: true }
  }
  // No library match: at least stop it skewing. Only touch paths in a real coordinate
  // space (max coord > 2) so normalised freehand pencil drawings (0..1) are left alone.
  if (!o.pathViewBox && o.path && !isLocked(o.id, 'pathViewBox')) {
    const nums = (o.path.match(/-?\d*\.?\d+/g) || []).map(Number)
    if (nums.length && Math.max(...nums.map(Math.abs)) > 2) {
      const bb = pathBBox(o.path)
      if (bb) { const r = (n: number): number => Math.round(n * 100) / 100; return { pathViewBox: `${r(bb.x)} ${r(bb.y)} ${r(bb.s)} ${r(bb.s)}` } }
    }
  }
  return null
}

/** Apply the deterministic QA pass, returning a new array of corrected objects. */
export function lintObjects(objs: FObj[], opts: LintOptions = {}): FObj[] {
  const grid = opts.grid ?? 4
  const isLocked = opts.locked ?? ((): boolean => false)
  const byId = new Map(objs.map((o) => [o.id, o]))
  // Containers (anything that has children) must never be outlined — the user
  // rejects card/group borders. Strips the model's spurious "outline every group".
  const parentIds = new Set(objs.map((o) => o.parent).filter((p): p is string => !!p))
  const childrenOf = new Map<string, FObj[]>()
  for (const o of objs) if (o.parent) (childrenOf.get(o.parent) ?? childrenOf.set(o.parent, []).get(o.parent)!).push(o)

  // Accent guarantee: a primary-action button must never be grey/black. Detect
  // button-shaped filled frames whose fill is near-neutral and recolour to the accent.
  const recolor = new Map<string, string>()
  if (opts.accent && hexToRgb(opts.accent)) {
    for (const o of objs) {
      if ((o.type === 'frame' || o.type === 'rect') && o.fillEnabled && (o.radius ?? 0) >= 10 && o.w >= 120 && o.w <= 720 && o.h >= 40 && o.h <= 64) {
        const kids = childrenOf.get(o.id) ?? []
        const looksPrimary = kids.some((c) => c.type === 'text' && (c.fontWeight ?? 400) >= 600) || /\b(button|primary|cta|save|submit|continue|sign|add|create|get started|new)\b/i.test(o.name ?? '')
        const neutralDark = saturation(o.fill) < 0.22 && luminanceOf(o.fill) < 0.6 && luminanceOf(o.fill) > 0.01
        if (looksPrimary && neutralDark && !isLocked(o.id, 'fill')) recolor.set(o.id, opts.accent)
      }
    }
  }
  const fillOf = (o: FObj): string | undefined => recolor.get(o.id) ?? o.fill

  const out = objs.map((o, oi) => {
    const n: FObj = { ...o }
    if (!isLocked(o.id, 'x')) n.x = snap(o.x, grid)
    if (!isLocked(o.id, 'y')) n.y = snap(o.y, grid)
    if (!isLocked(o.id, 'w')) n.w = Math.max(1, snap(o.w, grid))
    if (!isLocked(o.id, 'h')) n.h = Math.max(1, snap(o.h, grid))
    if (typeof o.radius === 'number' && o.radius > 0 && !isLocked(o.id, 'radius')) n.radius = nearest(o.radius, RADII)
    if ((o.type === 'frame' || o.type === 'rect') && parentIds.has(o.id) && o.strokeEnabled && !isLocked(o.id, 'strokeEnabled')) n.strokeEnabled = false
    if (recolor.has(o.id)) n.fill = recolor.get(o.id)!
    const iconFix = snapIcon(o, isLocked)
    if (iconFix) Object.assign(n, iconFix)
    if (o.type === 'text') {
      if (typeof o.fontSize === 'number' && !isLocked(o.id, 'fontSize')) n.fontSize = nearest(o.fontSize, TYPE_SCALE)
      if (!isLocked(o.id, 'color')) {
        const bg = bgBehind(o, byId, opts.artboardBg, fillOf, objs, oi)
        const ink = o.color
        if (bg && hexToRgb(bg) && (!ink || !hexToRgb(ink) || contrastRatio(ink, bg) < 4.5)) n.color = readableInk(bg)
      }
    }
    return n
  })

  // Placement repair: a child whose box lands largely OUTSIDE its parent has been
  // misplaced (e.g. a slider parked in the wrong section). Pull it back inside the
  // parent — model-independent, so it generalises to any domain. Hairlines/dividers
  // sit on edges by design and content-bearing frames aren't nudged by their kids.
  const nById = new Map(out.map((o) => [o.id, o]))
  for (const o of out) {
    const p = o.parent ? nById.get(o.parent) : undefined
    if (!p || isLocked(o.id, 'x') || isLocked(o.id, 'y')) continue
    if (o.type === 'line' || Math.min(o.w, o.h) <= 2) continue
    const ix = Math.max(0, Math.min(o.x + o.w, p.x + p.w) - Math.max(o.x, p.x))
    const iy = Math.max(0, Math.min(o.y + o.h, p.y + p.h) - Math.max(o.y, p.y))
    if ((ix * iy) / Math.max(1, o.w * o.h) >= 0.6) continue
    o.x = o.w <= p.w ? Math.min(Math.max(o.x, p.x), p.x + p.w - o.w) : p.x
    o.y = o.h <= p.h ? Math.min(Math.max(o.y, p.y), p.y + p.h - o.h) : p.y
  }
  return out
}
