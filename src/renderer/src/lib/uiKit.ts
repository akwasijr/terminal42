import { type ObjectSpec } from './canvasAgent'
import { readableInk } from './designQA'
import { type DesignSystem } from './designSystem'

// ── UI Kit ───────────────────────────────────────────────────────────────────
// Curated, pixel-considered mobile components. The assistant composes a screen by
// NAMING these (with content + one accent); we expand each into a polished, grouped
// object tree deterministically. This sidesteps the LLM's weakest skill — inventing
// exact coordinates — so output reads like a real product screen, not boxes.

export interface Kit {
  accent: string; onAccent: string
  ink: string; muted: string; faint: string
  surface: string; border: string; bg: string
  /** elevated panel/card fill (distinct from the subtle `surface` fill) */
  card: string
}
export const DEFAULT_KIT: Kit = {
  accent: '#0f766e', onAccent: '#ffffff',
  ink: '#111827', muted: '#6b7280', faint: '#9ca3af',
  surface: '#f9fafb', border: '#e5e7eb', bg: '#ffffff', card: '#ffffff'
}

function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return null
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
/** Blend a→b by t (0..1). Used to derive subtle/faint tints from DS tokens. */
function mix(a: string, b: string, t: number): string {
  const pa = hexToRgb(a), pb = hexToRgb(b)
  if (!pa || !pb) return a
  const m = pa.map((c, i) => Math.round(c + (pb[i] - c) * t))
  return '#' + m.map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('')
}

/** Derive a component Kit from an active Design System's tokens, so kit screens
 *  render ON-BRAND (and in dark mode automatically when the DS bg/text are dark). */
export function kitFromDesignSystem(ds: DesignSystem): Kit {
  const c = ds.colors
  const accent = vibrantAccent(c.primary)
  return {
    accent, onAccent: readableInk(accent),
    ink: c.text, muted: c.textMuted, faint: mix(c.textMuted, c.bg, 0.4),
    surface: mix(c.surface, c.text, 0.06), card: c.surface, border: c.border, bg: c.bg
  }
}

/** HSL saturation of a hex colour (0..1). Greys/near-black/near-white ≈ 0. */
export function saturation(hex?: string): number {
  if (!hex) return 0
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return 0
  const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2
  if (max === min) return 0
  const d = max - min
  return l > 0.5 ? d / (2 - max - min) : d / (max + min)
}

/** A confident, non-AI-default accent. If the caller's colour is missing or near-grey
 *  (the monochrome failure mode), substitute a tasteful teal so the primary action is
 *  never grey/black. Respects the "no indigo/violet/purple" rule. */
export function vibrantAccent(hex?: string): string {
  if (!hex || saturation(hex) < 0.25) return DEFAULT_KIT.accent
  return hex
}

let _uid = 0
const rid = (p: string): string => `${p}${(_uid++).toString(36)}`

// ── Components — each returns ObjectSpec[] (artboard-local), grouped under a frame ──
export function statusBar(x: number, y: number, w: number, k: Kit): ObjectSpec[] {
  const ref = rid('status')
  return [
    { type: 'frame', ref, name: 'Status bar', x, y, w, h: 44, fillEnabled: false },
    { type: 'text', parent: ref, name: 'Time', x: x + 22, y: y + 14, w: 64, h: 18, text: '9:41', color: k.ink, fontSize: 15, fontWeight: 600 },
    { type: 'rect', parent: ref, name: 'Battery', x: x + w - 46, y: y + 15, w: 24, h: 13, radius: 3, fillEnabled: false, strokeEnabled: true, stroke: k.ink, strokeWidth: 1 },
    { type: 'rect', parent: ref, name: 'Battery level', x: x + w - 44, y: y + 17, w: 18, h: 9, radius: 1, fill: k.ink, fillEnabled: true, strokeEnabled: false },
    { type: 'path', icon: 'globe', parent: ref, name: 'Signal', x: x + w - 78, y: y + 15, w: 14, h: 14, stroke: k.ink, strokeWidth: 1.6 }
  ]
}

export function navBar(x: number, y: number, w: number, props: { title: string; back?: boolean; action?: string }, k: Kit): ObjectSpec[] {
  const ref = rid('nav')
  const o: ObjectSpec[] = [{ type: 'frame', ref, name: 'Nav bar', x, y, w, h: 52, fillEnabled: false }]
  if (props.back !== false) o.push({ type: 'path', icon: 'chevron-left', parent: ref, name: 'Back', x: x + 20, y: y + 15, w: 22, h: 22, stroke: k.ink, strokeWidth: 1.8 })
  o.push({ type: 'text', parent: ref, name: 'Title', x: x + 52, y: y + 16, w: w - 104, h: 22, text: props.title, color: k.ink, fontSize: 17, fontWeight: 600, align: 'center' })
  if (props.action) o.push({ type: 'path', icon: props.action, parent: ref, name: 'Action', x: x + w - 42, y: y + 15, w: 22, h: 22, stroke: k.ink, strokeWidth: 1.8 })
  return o
}

export function heroAmount(x: number, y: number, w: number, props: { value: string; label?: string }, k: Kit): ObjectSpec[] {
  const ref = rid('hero')
  const o: ObjectSpec[] = [{ type: 'frame', ref, name: 'Amount', x, y, w, h: 118, fillEnabled: false }]
  if (props.label) o.push({ type: 'text', parent: ref, name: 'Amount label', x, y: y + 2, w, h: 18, text: props.label, color: k.muted, fontSize: 14, fontWeight: 500, align: 'center' })
  o.push({ type: 'text', parent: ref, name: 'Amount value', x, y: y + (props.label ? 26 : 18), w, h: 64, text: props.value, color: k.ink, fontSize: 48, fontWeight: 700, align: 'center' })
  o.push({ type: 'rect', parent: ref, name: 'Accent underline', x: x + w / 2 - 20, y: y + (props.label ? 98 : 92), w: 40, h: 4, radius: 2, fill: k.accent, fillEnabled: true, strokeEnabled: false })
  return o
}

export function listRow(x: number, y: number, w: number, props: { icon?: string; label: string; value?: string; chevron?: boolean; divider?: boolean }, k: Kit): ObjectSpec[] {
  const ref = rid('row')
  const o: ObjectSpec[] = [{ type: 'frame', ref, name: props.label || 'Row', x, y, w, h: 64, fillEnabled: false }]
  let lx = x + 20
  if (props.icon) { o.push({ type: 'path', icon: props.icon, parent: ref, name: 'Icon', x: lx, y: y + 21, w: 22, h: 22, stroke: k.muted, strokeWidth: 1.8 }); lx += 34 }
  o.push({ type: 'text', parent: ref, name: 'Label', x: lx, y: y + 22, w: 160, h: 20, text: props.label, color: k.ink, fontSize: 15, fontWeight: 500 })
  const chev = props.chevron !== false
  if (props.value) o.push({ type: 'text', parent: ref, name: 'Value', x: x + w - 168 - (chev ? 20 : 0), y: y + 22, w: 160, h: 20, text: props.value, color: k.ink, fontSize: 15, fontWeight: 500, align: 'right' })
  if (chev) o.push({ type: 'path', icon: 'chevron-right', parent: ref, name: 'Chevron', x: x + w - 26, y: y + 22, w: 18, h: 18, stroke: k.faint, strokeWidth: 1.8 })
  if (props.divider !== false) o.push({ type: 'rect', parent: ref, name: 'Divider', x: x + 20, y: y + 63, w: w - 40, h: 1, fill: k.border, fillEnabled: true, strokeEnabled: false })
  return o
}

export function inputRow(x: number, y: number, w: number, props: { icon?: string; placeholder: string; divider?: boolean }, k: Kit): ObjectSpec[] {
  const ref = rid('input')
  const o: ObjectSpec[] = [{ type: 'frame', ref, name: 'Field', x, y, w, h: 64, fillEnabled: false }]
  let lx = x + 20
  if (props.icon) { o.push({ type: 'path', icon: props.icon, parent: ref, name: 'Icon', x: lx, y: y + 21, w: 22, h: 22, stroke: k.faint, strokeWidth: 1.8 }); lx += 34 }
  o.push({ type: 'text', parent: ref, name: 'Placeholder', x: lx, y: y + 22, w: w - (lx - x) - 20, h: 20, text: props.placeholder, color: k.faint, fontSize: 15, fontWeight: 400 })
  if (props.divider !== false) o.push({ type: 'rect', parent: ref, name: 'Divider', x: x + 20, y: y + 63, w: w - 40, h: 1, fill: k.border, fillEnabled: true, strokeEnabled: false })
  return o
}

export function primaryButton(x: number, y: number, w: number, props: { label: string; icon?: string }, k: Kit): ObjectSpec[] {
  const ref = rid('btn')
  const o: ObjectSpec[] = [{ type: 'frame', ref, name: 'Primary button', x, y, w, h: 56, radius: 28, fill: k.accent, fillEnabled: true, strokeEnabled: false, shadow: true, shadowColor: k.accent }]
  o.push({ type: 'text', parent: ref, name: 'Label', x, y: y + 18, w, h: 20, text: props.label, color: k.onAccent, fontSize: 16, fontWeight: 600, align: 'center' })
  if (props.icon) o.push({ type: 'path', icon: props.icon, parent: ref, name: 'Icon', x: x + w / 2 - 72, y: y + 19, w: 18, h: 18, stroke: k.onAccent, strokeWidth: 2 })
  return o
}

export function homeIndicator(x: number, y: number, w: number, _k: Kit): ObjectSpec[] {
  return [{ type: 'rect', name: 'Home indicator', x: x + w / 2 - 67, y, w: 134, h: 5, radius: 3, fill: '#d1d5db', fillEnabled: true, strokeEnabled: false }]
}

// ── Dashboard / richer components (added from the Figma comparison) ───────────
export function avatar(x: number, y: number, _w: number, props: Record<string, unknown>, k: Kit): ObjectSpec[] {
  const s = Number(props.size) || 40
  const ref = rid('avatar')
  return [
    { type: 'ellipse', ref, name: 'Avatar', x, y, w: s, h: s, fill: k.accent, fillEnabled: true, strokeEnabled: false },
    { type: 'text', parent: ref, name: 'Initials', x, y: y + s * 0.3, w: s, h: s * 0.4, text: String(props.initials || 'A'), color: k.onAccent, fontSize: Math.round(s * 0.36), fontWeight: 600, align: 'center' }
  ]
}

export function topBar(x: number, y: number, w: number, props: Record<string, unknown>, k: Kit): ObjectSpec[] {
  const ref = rid('top')
  const h = Number(props.h) || 64
  const o: ObjectSpec[] = [{ type: 'frame', ref, name: 'Top bar', x, y, w, h, fillEnabled: false }]
  o.push({ type: 'text', parent: ref, name: 'Title', x, y: y + 4, w: w * 0.6, h: 30, text: String(props.title || ''), color: k.ink, fontSize: 22, fontWeight: 700 })
  if (props.subtitle) o.push({ type: 'text', parent: ref, name: 'Subtitle', x, y: y + 36, w: w * 0.6, h: 18, text: String(props.subtitle), color: k.muted, fontSize: 13.5 })
  if (props.action) {
    const bw = 150, bx = x + w - bw
    o.push({ type: 'frame', parent: ref, name: 'Action', x: bx, y: y + 8, w: bw, h: 44, radius: 10, fill: k.accent, fillEnabled: true, strokeEnabled: false })
    o.push({ type: 'text', parent: ref, name: 'Action label', x: bx, y: y + 22, w: bw, h: 18, text: String(props.action), color: k.onAccent, fontSize: 14, fontWeight: 600, align: 'center' })
  }
  return o
}

export function statTile(x: number, y: number, w: number, props: Record<string, unknown>, k: Kit): ObjectSpec[] {
  const ref = rid('stat')
  const o: ObjectSpec[] = [{ type: 'frame', ref, name: String(props.label || 'Stat'), x, y, w, h: 116, radius: 14, fill: k.card, fillEnabled: true, strokeEnabled: false, shadow: true, shadowColor: '#0f172a', shadowOpacity: 0.06, shadowX: 0, shadowY: 1, shadowBlur: 4, shadowSpread: 0 }]
  o.push({ type: 'text', parent: ref, name: 'Label', x: x + 20, y: y + 18, w: w - 76, h: 18, text: String(props.label || ''), color: k.muted, fontSize: 13, fontWeight: 500 })
  if (props.icon) {
    o.push({ type: 'rect', parent: ref, name: 'Icon box', x: x + w - 56, y: y + 16, w: 36, h: 36, radius: 9, fill: k.surface, fillEnabled: true, strokeEnabled: false })
    o.push({ type: 'path', icon: String(props.icon), parent: ref, name: 'Icon', x: x + w - 47, y: y + 25, w: 18, h: 18, stroke: k.accent, strokeWidth: 1.9 })
  }
  o.push({ type: 'text', parent: ref, name: 'Value', x: x + 20, y: y + 46, w: w - 40, h: 36, text: String(props.value || ''), color: k.ink, fontSize: 28, fontWeight: 700 })
  if (props.delta) o.push({ type: 'text', parent: ref, name: 'Delta', x: x + 20, y: y + 86, w: w - 40, h: 16, text: String(props.delta), color: k.accent, fontSize: 12.5, fontWeight: 500 })
  return o
}

export function barChart(x: number, y: number, w: number, props: Record<string, unknown>, k: Kit): ObjectSpec[] {
  const ref = rid('chart')
  const h = Number(props.h) || 240
  const o: ObjectSpec[] = [{ type: 'frame', ref, name: String(props.title || 'Chart'), x, y, w, h, radius: 14, fill: k.card, fillEnabled: true, strokeEnabled: false, shadow: true, shadowColor: '#0f172a', shadowOpacity: 0.06, shadowX: 0, shadowY: 1, shadowBlur: 4, shadowSpread: 0 }]
  const pad = 22
  if (props.title) o.push({ type: 'text', parent: ref, name: 'Chart title', x: x + pad, y: y + 18, w: w - 2 * pad, h: 22, text: String(props.title), color: k.ink, fontSize: 16, fontWeight: 600 })
  const vals = (Array.isArray(props.values) ? props.values.map(Number) : [40, 70, 55, 90, 75, 60, 100])
  const labels = Array.isArray(props.labels) ? props.labels : []
  const maxV = Math.max(1, ...vals)
  const top = props.title ? 56 : pad, bottom = 30, plotH = h - top - bottom, n = vals.length, gap = 14
  const barW = (w - 2 * pad - gap * (n - 1)) / n
  vals.forEach((v, i) => {
    const bh = Math.max(4, (v / maxV) * plotH), bx = x + pad + i * (barW + gap), by = y + top + (plotH - bh)
    o.push({ type: 'rect', parent: ref, name: 'Bar', x: bx, y: by, w: barW, h: bh, radius: 6, fill: k.accent, fillEnabled: true, fillOpacity: i === n - 1 ? 1 : 0.32, strokeEnabled: false })
    if (labels[i]) o.push({ type: 'text', parent: ref, name: 'Bar label', x: bx, y: y + h - 22, w: barW, h: 16, text: String(labels[i]), color: k.muted, fontSize: 12, align: 'center' })
  })
  return o
}

export function tabBar(x: number, y: number, w: number, props: Record<string, unknown>, k: Kit): ObjectSpec[] {
  const ref = rid('tab')
  const items = (Array.isArray(props.items) && props.items.length ? props.items : [{ icon: 'home', active: true }, { icon: 'chart' }, { icon: 'calendar' }, { icon: 'user' }]) as { icon?: string; active?: boolean }[]
  const o: ObjectSpec[] = [{ type: 'frame', ref, name: 'Tab bar', x, y, w, h: 64, fill: k.card, fillEnabled: true, strokeEnabled: false, shadow: true, shadowColor: '#0f172a', shadowOpacity: 0.05, shadowX: 0, shadowY: -1, shadowBlur: 6, shadowSpread: 0 }]
  const cell = w / items.length
  items.forEach((it, i) => o.push({ type: 'path', icon: String(it.icon || 'home'), parent: ref, name: `Tab ${i}`, x: x + i * cell + cell / 2 - 12, y: y + 14, w: 24, h: 24, stroke: it.active ? k.accent : k.faint, strokeWidth: 1.9 }))
  return o
}

export function sidebar(x: number, y: number, w: number, props: Record<string, unknown>, k: Kit): ObjectSpec[] {
  const ref = rid('side')
  const h = Number(props.h) || 640
  const o: ObjectSpec[] = [{ type: 'frame', ref, name: 'Sidebar', x, y, w, h, fill: k.card, fillEnabled: true, strokeEnabled: false, shadow: true, shadowColor: '#0f172a', shadowOpacity: 0.04, shadowX: 1, shadowY: 0, shadowBlur: 6, shadowSpread: 0 }]
  o.push({ type: 'rect', parent: ref, name: 'Logo', x: x + 18, y: y + 22, w: 32, h: 32, radius: 8, fill: k.accent, fillEnabled: true, strokeEnabled: false })
  if (props.brandIcon) o.push({ type: 'path', icon: String(props.brandIcon), parent: ref, name: 'Logo icon', x: x + 25, y: y + 29, w: 18, h: 18, stroke: k.onAccent, strokeWidth: 2 })
  o.push({ type: 'text', parent: ref, name: 'Brand', x: x + 58, y: y + 30, w: w - 70, h: 24, text: String(props.brand || 'App'), color: k.ink, fontSize: 18, fontWeight: 700 })
  const items = (Array.isArray(props.items) ? props.items : []) as { icon?: string; label?: string; active?: boolean }[]
  items.forEach((it, i) => {
    const iy = y + 84 + i * 46
    if (it.active) o.push({ type: 'rect', parent: ref, name: 'Active', x: x + 12, y: iy, w: w - 24, h: 38, radius: 9, fill: k.accent, fillEnabled: true, fillOpacity: 0.1, strokeEnabled: false })
    o.push({ type: 'path', icon: String(it.icon || 'home'), parent: ref, name: 'Nav icon', x: x + 24, y: iy + 9, w: 20, h: 20, stroke: it.active ? k.accent : k.muted, strokeWidth: 1.9 })
    o.push({ type: 'text', parent: ref, name: 'Nav label', x: x + 56, y: iy + 10, w: w - 70, h: 18, text: String(it.label || ''), color: it.active ? k.accent : k.muted, fontSize: 14, fontWeight: it.active ? 600 : 500 })
  })
  return o
}

export function progressRing(x: number, y: number, w: number, props: Record<string, unknown>, k: Kit): ObjectSpec[] {
  const s = Number(props.size) || 150
  const cx = x + Math.max(0, (w - s) / 2)
  const ref = rid('ring')
  const value = Number(props.value || 0), max = Math.max(1, Number(props.max || 1))
  const f = Math.max(0, Math.min(1, value / max))
  const ang = (-90 + f * 360) * Math.PI / 180
  const ex = (50 + 42 * Math.cos(ang)).toFixed(2), ey = (50 + 42 * Math.sin(ang)).toFixed(2)
  const large = f > 0.5 ? 1 : 0
  const o: ObjectSpec[] = [{ type: 'frame', ref, name: 'Progress', x: cx, y, w: s, h: s, fillEnabled: false }]
  o.push({ type: 'path', parent: ref, name: 'Ring bg', x: cx, y, w: s, h: s, path: 'M50 8 A42 42 0 1 1 49.99 8', pathViewBox: '0 0 100 100', strokeEnabled: true, stroke: k.border, strokeWidth: 11, fillEnabled: false })
  if (f > 0.001) o.push({ type: 'path', parent: ref, name: 'Ring fill', x: cx, y, w: s, h: s, path: `M50 8 A42 42 0 ${large} 1 ${ex} ${ey}`, pathViewBox: '0 0 100 100', strokeEnabled: true, stroke: k.accent, strokeWidth: 11, fillEnabled: false })
  o.push({ type: 'text', parent: ref, name: 'Ring value', x: cx, y: y + s * 0.32, w: s, h: s * 0.24, text: `${value}${props.max ? '/' + props.max : ''}`, color: k.ink, fontSize: Math.round(s * 0.22), fontWeight: 700, align: 'center' })
  if (props.label) o.push({ type: 'text', parent: ref, name: 'Ring label', x: cx, y: y + s * 0.58, w: s, h: 16, text: String(props.label), color: k.muted, fontSize: 12, align: 'center' })
  return o
}

// ── Media / music player components (added from the Now Playing comparison) ──
const artSize = (props: Record<string, unknown>, w: number): number => Number(props.size) || Math.min(w, 320)

/** Square artwork placeholder — a neutral surface tile with a centred music glyph
 *  (a real image fill drops in later). Never an accent block. */
export function albumArt(x: number, y: number, w: number, props: Record<string, unknown>, k: Kit): ObjectSpec[] {
  const s = artSize(props, w)
  const ax = x + Math.max(0, (w - s) / 2)
  const ref = rid('art')
  return [
    { type: 'frame', ref, name: 'Album art', x: ax, y, w: s, h: s, radius: 24, fill: k.surface, fillEnabled: true, strokeEnabled: false, shadow: true, shadowColor: '#0f172a', shadowOpacity: 0.08, shadowX: 0, shadowY: 8, shadowBlur: 24, shadowSpread: 0 },
    { type: 'path', icon: 'music', parent: ref, name: 'Artwork', x: ax + s / 2 - 22, y: y + s / 2 - 22, w: 44, h: 44, stroke: k.faint, strokeWidth: 1.6 }
  ]
}

/** Centred track title + artist. */
export function trackInfo(x: number, y: number, w: number, props: Record<string, unknown>, k: Kit): ObjectSpec[] {
  const ref = rid('track')
  return [
    { type: 'frame', ref, name: 'Track info', x, y, w, h: 60, fillEnabled: false },
    { type: 'text', parent: ref, name: 'Title', x, y, w, h: 32, text: String(props.title || ''), color: k.ink, fontSize: 24, fontWeight: 700, align: 'center' },
    { type: 'text', parent: ref, name: 'Artist', x, y: y + 36, w, h: 22, text: String(props.artist || ''), color: k.muted, fontSize: 16, fontWeight: 500, align: 'center' }
  ]
}

/** A scrubber/progress slider with a thumb + optional time labels under each end. */
export function scrubber(x: number, y: number, w: number, props: Record<string, unknown>, k: Kit): ObjectSpec[] {
  const ref = rid('scrub')
  const max = Math.max(1, Number(props.max || 1)), f = Math.max(0, Math.min(1, Number(props.value || 0) / max))
  const fillW = Math.max(4, w * f)
  const o: ObjectSpec[] = [{ type: 'frame', ref, name: 'Scrubber', x, y, w, h: 40, fillEnabled: false }]
  o.push({ type: 'rect', parent: ref, name: 'Track', x, y: y + 6, w, h: 4, radius: 2, fill: k.border, fillEnabled: true, strokeEnabled: false })
  o.push({ type: 'rect', parent: ref, name: 'Fill', x, y: y + 6, w: fillW, h: 4, radius: 2, fill: k.accent, fillEnabled: true, strokeEnabled: false })
  o.push({ type: 'ellipse', parent: ref, name: 'Thumb', x: x + fillW - 7, y: y + 1, w: 14, h: 14, fill: '#ffffff', fillEnabled: true, strokeEnabled: false, shadow: true, shadowColor: '#0f172a', shadowOpacity: 0.18, shadowX: 0, shadowY: 1, shadowBlur: 3, shadowSpread: 0 })
  if (props.leftLabel || props.rightLabel) {
    o.push({ type: 'text', parent: ref, name: 'Elapsed', x, y: y + 18, w: 80, h: 16, text: String(props.leftLabel || ''), color: k.muted, fontSize: 12, fontWeight: 500 })
    o.push({ type: 'text', parent: ref, name: 'Remaining', x: x + w - 80, y: y + 18, w: 80, h: 16, text: String(props.rightLabel || ''), color: k.muted, fontSize: 12, fontWeight: 500, align: 'right' })
  }
  return o
}

/** Transport controls: shuffle · previous · play (accent circle) · next · repeat. */
export function transport(x: number, y: number, w: number, props: Record<string, unknown>, k: Kit): ObjectSpec[] {
  const ref = rid('transport')
  const h = 72, cx = x + w / 2, cs = 64, iy = y + (h - 24) / 2
  const o: ObjectSpec[] = [{ type: 'frame', ref, name: 'Controls', x, y, w, h, fillEnabled: false }]
  o.push({ type: 'path', icon: 'shuffle', parent: ref, name: 'Shuffle', x: x + 6, y: iy + 1, w: 22, h: 22, stroke: k.muted, strokeWidth: 1.8 })
  o.push({ type: 'path', icon: 'skip-back', parent: ref, name: 'Previous', x: cx - cs / 2 - 48, y: iy, w: 24, h: 24, stroke: k.ink, strokeWidth: 1.8 })
  o.push({ type: 'ellipse', parent: ref, name: 'Play', x: cx - cs / 2, y: y + (h - cs) / 2, w: cs, h: cs, fill: k.accent, fillEnabled: true, strokeEnabled: false, shadow: true, shadowColor: k.accent, shadowOpacity: 0.35, shadowX: 0, shadowY: 6, shadowBlur: 18, shadowSpread: 0 })
  if (props.playing) {
    o.push({ type: 'rect', parent: ref, name: 'Pause left', x: cx - 8, y: y + (h - 22) / 2, w: 5, h: 22, radius: 2, fill: k.onAccent, fillEnabled: true, strokeEnabled: false })
    o.push({ type: 'rect', parent: ref, name: 'Pause right', x: cx + 3, y: y + (h - 22) / 2, w: 5, h: 22, radius: 2, fill: k.onAccent, fillEnabled: true, strokeEnabled: false })
  } else {
    o.push({ type: 'polygon', sides: 3, rotation: 90, parent: ref, name: 'Play icon', x: cx - 10, y: y + (h - 24) / 2, w: 22, h: 24, fill: k.onAccent, fillEnabled: true, strokeEnabled: false })
  }
  o.push({ type: 'path', icon: 'skip-forward', parent: ref, name: 'Next', x: cx + cs / 2 + 24, y: iy, w: 24, h: 24, stroke: k.ink, strokeWidth: 1.8 })
  o.push({ type: 'path', icon: 'repeat', parent: ref, name: 'Repeat', x: x + w - 28, y: iy + 1, w: 22, h: 22, stroke: k.muted, strokeWidth: 1.8 })
  return o
}

/** Volume slider row: volume icon · slider · optional queue icon. */
export function volumeRow(x: number, y: number, w: number, props: Record<string, unknown>, k: Kit): ObjectSpec[] {
  const ref = rid('vol')
  const raw = Number(props.value ?? 0.6), f = Math.max(0, Math.min(1, raw > 1 ? raw / 100 : raw))
  const hasQueue = props.queue !== false
  const tx = x + 34, tw = w - 34 - (hasQueue ? 36 : 0), fillW = Math.max(4, tw * f)
  const o: ObjectSpec[] = [{ type: 'frame', ref, name: 'Volume', x, y, w, h: 36, fillEnabled: false }]
  o.push({ type: 'path', icon: 'volume-2', parent: ref, name: 'Volume icon', x, y: y + 7, w: 22, h: 22, stroke: k.muted, strokeWidth: 1.8 })
  o.push({ type: 'rect', parent: ref, name: 'Track', x: tx, y: y + 15, w: tw, h: 4, radius: 2, fill: k.border, fillEnabled: true, strokeEnabled: false })
  o.push({ type: 'rect', parent: ref, name: 'Fill', x: tx, y: y + 15, w: fillW, h: 4, radius: 2, fill: k.ink, fillEnabled: true, strokeEnabled: false })
  o.push({ type: 'ellipse', parent: ref, name: 'Thumb', x: tx + fillW - 6, y: y + 11, w: 12, h: 12, fill: '#ffffff', fillEnabled: true, strokeEnabled: false, shadow: true, shadowColor: '#0f172a', shadowOpacity: 0.18, shadowX: 0, shadowY: 1, shadowBlur: 3, shadowSpread: 0 })
  if (hasQueue) o.push({ type: 'path', icon: 'queue', parent: ref, name: 'Up next', x: x + w - 24, y: y + 7, w: 22, h: 22, stroke: k.muted, strokeWidth: 1.8 })
  return o
}

// ── Generic atoms (domain-agnostic primitives — these compose ANY screen, so a
//    new domain needs no new component code: a scrubber is a slider, a play/FAB is
//    an iconButton, a status pill is a badge, a tag is a chip) ──────────────────
export function slider(x: number, y: number, w: number, props: Record<string, unknown>, k: Kit): ObjectSpec[] {
  const ref = rid('slider')
  const max = Math.max(1, Number(props.max || 1)), f = Math.max(0, Math.min(1, Number(props.value || 0) / max))
  const hasLabel = !!props.label, top = hasLabel ? 22 : 0, fillW = Math.max(4, w * f)
  const o: ObjectSpec[] = [{ type: 'frame', ref, name: String(props.label || 'Slider'), x, y, w, h: top + 24, fillEnabled: false }]
  if (hasLabel) o.push({ type: 'text', parent: ref, name: 'Label', x, y, w, h: 18, text: String(props.label), color: k.muted, fontSize: 13, fontWeight: 500 })
  o.push({ type: 'rect', parent: ref, name: 'Track', x, y: y + top + 6, w, h: 4, radius: 2, fill: k.border, fillEnabled: true, strokeEnabled: false })
  o.push({ type: 'rect', parent: ref, name: 'Fill', x, y: y + top + 6, w: fillW, h: 4, radius: 2, fill: k.accent, fillEnabled: true, strokeEnabled: false })
  o.push({ type: 'ellipse', parent: ref, name: 'Thumb', x: x + fillW - 7, y: y + top + 1, w: 14, h: 14, fill: '#ffffff', fillEnabled: true, strokeEnabled: false, shadow: true, shadowColor: '#0f172a', shadowOpacity: 0.18, shadowX: 0, shadowY: 1, shadowBlur: 3, shadowSpread: 0 })
  return o
}

export function iconButton(x: number, y: number, _w: number, props: Record<string, unknown>, k: Kit): ObjectSpec[] {
  const ref = rid('iconbtn'), size = Number(props.size) || 44, filled = !!props.filled
  if (filled) return [
    { type: 'ellipse', ref, name: 'Button', x, y, w: size, h: size, fill: k.accent, fillEnabled: true, strokeEnabled: false, shadow: true, shadowColor: k.accent, shadowOpacity: 0.3, shadowX: 0, shadowY: 4, shadowBlur: 12, shadowSpread: 0 },
    { type: 'path', icon: String(props.icon || 'plus'), parent: ref, name: 'Icon', x: x + size / 2 - 11, y: y + size / 2 - 11, w: 22, h: 22, stroke: k.onAccent, strokeWidth: 2 }]
  return [
    { type: 'frame', ref, name: 'Button', x, y, w: size, h: size, fillEnabled: false },
    { type: 'path', icon: String(props.icon || 'plus'), parent: ref, name: 'Icon', x: x + size / 2 - 11, y: y + size / 2 - 11, w: 22, h: 22, stroke: k.ink, strokeWidth: 1.9 }]
}

export function field(x: number, y: number, w: number, props: Record<string, unknown>, k: Kit): ObjectSpec[] {
  const ref = rid('field'), hasLabel = !!props.label, top = hasLabel ? 24 : 0
  const o: ObjectSpec[] = [{ type: 'frame', ref, name: String(props.label || 'Field'), x, y, w, h: top + 48, fillEnabled: false }]
  if (hasLabel) o.push({ type: 'text', parent: ref, name: 'Label', x, y, w, h: 18, text: String(props.label), color: k.ink, fontSize: 13, fontWeight: 600 })
  o.push({ type: 'rect', parent: ref, name: 'Input', x, y: y + top, w, h: 48, radius: 10, fill: k.surface, fillEnabled: true, strokeEnabled: true, stroke: k.border, strokeWidth: 1 })
  let tx = x + 16
  if (props.icon) { o.push({ type: 'path', icon: String(props.icon), parent: ref, name: 'Icon', x: tx, y: y + top + 14, w: 20, h: 20, stroke: k.faint, strokeWidth: 1.8 }); tx += 30 }
  const val = props.value ? String(props.value) : ''
  o.push({ type: 'text', parent: ref, name: val ? 'Value' : 'Placeholder', x: tx, y: y + top + 15, w: w - (tx - x) - 16, h: 18, text: val || String(props.placeholder || ''), color: val ? k.ink : k.faint, fontSize: 15 })
  return o
}

export function chip(x: number, y: number, w: number, props: Record<string, unknown>, k: Kit): ObjectSpec[] {
  const ref = rid('chip'), active = !!props.active, label = String(props.label || '')
  const cw = w && w < 320 ? w : Math.max(56, 28 + label.length * 8 + (props.icon ? 22 : 0))
  const o: ObjectSpec[] = [{ type: 'frame', ref, name: 'Chip · ' + label, x, y, w: cw, h: 34, radius: 17, fill: active ? k.accent : k.surface, fillEnabled: true, strokeEnabled: false }]
  let tx = x + 14
  if (props.icon) { o.push({ type: 'path', icon: String(props.icon), parent: ref, name: 'Icon', x: tx, y: y + 8, w: 18, h: 18, stroke: active ? k.onAccent : k.muted, strokeWidth: 1.8 }); tx += 24 }
  o.push({ type: 'text', parent: ref, name: 'Label', x: tx, y: y + 8, w: cw - (tx - x) - 10, h: 18, text: label, color: active ? k.onAccent : k.ink, fontSize: 14, fontWeight: 500 })
  return o
}

const TONES: Record<string, { bg: string; fg: string; dot: string }> = {
  success: { bg: '#dcfce7', fg: '#166534', dot: '#16a34a' },
  warning: { bg: '#fef3c7', fg: '#92400e', dot: '#d97706' },
  error: { bg: '#fee2e2', fg: '#991b1b', dot: '#dc2626' },
  info: { bg: '#dbeafe', fg: '#1e40af', dot: '#2563eb' },
  neutral: { bg: '#f3f4f6', fg: '#374151', dot: '#6b7280' }
}
export function badge(x: number, y: number, w: number, props: Record<string, unknown>, _k: Kit): ObjectSpec[] {
  const ref = rid('badge'), label = String(props.label || ''), t = TONES[String(props.tone || 'neutral')] || TONES.neutral
  const bw = w && w < 320 ? w : Math.max(44, 26 + label.length * 7.5)
  return [
    { type: 'frame', ref, name: 'Badge · ' + label, x, y, w: bw, h: 24, radius: 12, fill: t.bg, fillEnabled: true, strokeEnabled: false },
    { type: 'ellipse', parent: ref, name: 'Dot', x: x + 10, y: y + 9, w: 6, h: 6, fill: t.dot, fillEnabled: true, strokeEnabled: false },
    { type: 'text', parent: ref, name: 'Label', x: x + 22, y: y + 4, w: bw - 28, h: 16, text: label, color: t.fg, fontSize: 12, fontWeight: 600 }]
}

export function divider(x: number, y: number, w: number, _props: Record<string, unknown>, k: Kit): ObjectSpec[] {
  return [{ type: 'rect', name: 'Divider', x, y: y + 11, w, h: 1, fill: k.border, fillEnabled: true, strokeEnabled: false }]
}

type Builder = (x: number, y: number, w: number, props: Record<string, unknown>, k: Kit) => ObjectSpec[]
const COMPONENTS: Record<string, Builder> = {
  statusBar: (x, y, w, _p, k) => statusBar(x, y, w, k),
  navBar: (x, y, w, p, k) => navBar(x, y, w, p as { title: string; back?: boolean; action?: string }, k),
  heroAmount: (x, y, w, p, k) => heroAmount(x, y, w, p as { value: string; label?: string }, k),
  listRow: (x, y, w, p, k) => listRow(x, y, w, p as { icon?: string; label: string; value?: string; chevron?: boolean; divider?: boolean }, k),
  inputRow: (x, y, w, p, k) => inputRow(x, y, w, p as { icon?: string; placeholder: string; divider?: boolean }, k),
  primaryButton: (x, y, w, p, k) => primaryButton(x, y, w, p as { label: string; icon?: string }, k),
  homeIndicator: (x, y, w, _p, k) => homeIndicator(x, y, w, k),
  avatar, topBar, statTile, barChart, tabBar, sidebar, progressRing,
  albumArt, trackInfo, scrubber, transport, volumeRow,
  slider, iconButton, field, chip, badge, divider
}

export const COMPONENT_NAMES = Object.keys(COMPONENTS)

// ── Component schema repair ──────────────────────────────────────────────────
// The model often names a component slightly off (a synonym, a typo, a near-miss)
// or uses the wrong prop key (title vs label, number vs value). Rather than
// silently dropping to a raw box, we deterministically resolve the name and remap
// the props onto the real schema — model-independent, so it helps EVERY prompt.
const norm = (s: string): string => s.toLowerCase().replace(/[\s_-]+/g, '')
const CANON = new Map(COMPONENT_NAMES.map((n) => [norm(n), n]))
const COMPONENT_ALIASES: Record<string, string> = {
  button: 'primaryButton', cta: 'primaryButton', btn: 'primaryButton', submit: 'primaryButton', actionbutton: 'primaryButton',
  appbar: 'navBar', header: 'navBar', topnav: 'navBar', titlebar: 'navBar', navigationbar: 'navBar',
  pageheader: 'topBar', sectionheader: 'topBar', pagetitle: 'topBar',
  input: 'field', textfield: 'field', textinput: 'field', inputfield: 'field', formfield: 'field', searchbar: 'field', search: 'field',
  listitem: 'listRow', row: 'listRow', settingrow: 'listRow', settingsrow: 'listRow', cell: 'listRow', menurow: 'listRow', menuitem: 'listRow',
  stat: 'statTile', kpi: 'statTile', metric: 'statTile', statcard: 'statTile', metriccard: 'statTile', statistic: 'statTile',
  chart: 'barChart', bargraph: 'barChart', graph: 'barChart', bars: 'barChart', histogram: 'barChart',
  bottomnav: 'tabBar', tabbarbottom: 'tabBar', tabs: 'tabBar', bottomtabs: 'tabBar',
  nav: 'sidebar', sidenav: 'sidebar', drawer: 'sidebar', navrail: 'sidebar',
  ring: 'progressRing', progresscircle: 'progressRing', circularprogress: 'progressRing', donut: 'progressRing',
  fab: 'iconButton', floatingbutton: 'iconButton', circlebutton: 'iconButton', roundbutton: 'iconButton',
  range: 'slider', rangeslider: 'slider', seekbar: 'slider', progressbar: 'slider', track: 'slider',
  pill: 'chip', tag: 'chip', filterchip: 'chip', token: 'chip',
  status: 'badge', statusbadge: 'badge', statuspill: 'badge', tagbadge: 'badge', label: 'badge',
  hr: 'divider', rule: 'divider', separator: 'divider', line: 'divider', spacer: 'divider',
  amount: 'heroAmount', balance: 'heroAmount', bignumber: 'heroAmount', total: 'heroAmount',
  cover: 'albumArt', artwork: 'albumArt', albumcover: 'albumArt', poster: 'albumArt', thumbnail: 'albumArt',
  controls: 'transport', playercontrols: 'transport', transportcontrols: 'transport', playbackcontrols: 'transport',
  volume: 'volumeRow', volumeslider: 'volumeRow', volumecontrol: 'volumeRow',
  profile: 'avatar', useravatar: 'avatar', photo: 'avatar', userpic: 'avatar',
  notch: 'statusBar', iosstatusbar: 'statusBar',
  homebar: 'homeIndicator', handle: 'homeIndicator', homehandle: 'homeIndicator',
  songinfo: 'trackInfo', nowplaying: 'trackInfo', tracktitle: 'trackInfo', metadata: 'trackInfo'
}
/** Resolve any component name (synonym, typo, suffix) to a real component key, or ''. */
export function resolveComponent(name?: string): string {
  if (!name || typeof name !== 'string') return ''
  const n = norm(name)
  if (CANON.has(n)) return CANON.get(n)!
  if (COMPONENT_ALIASES[n]) return COMPONENT_ALIASES[n]
  const n2 = n.replace(/(component|comp|view|widget|el)$/, '')
  if (CANON.has(n2)) return CANON.get(n2)!
  if (COMPONENT_ALIASES[n2]) return COMPONENT_ALIASES[n2]
  if (n.endsWith('s')) { const s = n.slice(0, -1); if (CANON.has(s)) return CANON.get(s)!; if (COMPONENT_ALIASES[s]) return COMPONENT_ALIASES[s] }
  for (const [k, v] of CANON) if (k.length > 3 && (n.includes(k) || k.includes(n))) return v
  return ''
}

// Per-component prop-key aliases → the real schema key.
const PROP_ALIASES: Record<string, Record<string, string>> = {
  primaryButton: { text: 'label', title: 'label', caption: 'label', cta: 'label' },
  navBar: { heading: 'title', name: 'title', text: 'title' },
  topBar: { heading: 'title', name: 'title', sub: 'subtitle', caption: 'subtitle', description: 'subtitle', cta: 'action' },
  listRow: { title: 'label', text: 'label', name: 'label', primary: 'label', heading: 'label', subtitle: 'value', secondary: 'value', detail: 'value', trailing: 'value', right: 'value' },
  inputRow: { hint: 'placeholder', text: 'placeholder', title: 'placeholder' },
  field: { name: 'label', title: 'label', heading: 'label', hint: 'placeholder', text: 'placeholder' },
  statTile: { title: 'label', name: 'label', heading: 'label', metric: 'value', number: 'value', amount: 'value', stat: 'value', change: 'delta', trend: 'delta', subtitle: 'delta' },
  barChart: { heading: 'title', name: 'title', data: 'values', series: 'values', categories: 'labels', xlabels: 'labels' },
  heroAmount: { amount: 'value', text: 'value', number: 'value', subtitle: 'label', caption: 'label' },
  chip: { text: 'label', title: 'label', name: 'label', selected: 'active', checked: 'active' },
  badge: { text: 'label', title: 'label', name: 'label', status: 'tone', variant: 'tone', type: 'tone', severity: 'tone' },
  slider: { title: 'label', name: 'label', current: 'value', val: 'value', maximum: 'max', maxvalue: 'max' },
  trackInfo: { song: 'title', name: 'title', track: 'title', subtitle: 'artist', author: 'artist', by: 'artist' },
  avatar: { text: 'initials', name: 'initials', label: 'initials' },
  scrubber: { current: 'value', position: 'value', duration: 'max', elapsed: 'leftLabel', remaining: 'rightLabel' }
}
function repairProps(name: string, props: Record<string, unknown>): Record<string, unknown> {
  const map = PROP_ALIASES[name]
  if (!map) return props
  const out: Record<string, unknown> = { ...props }
  for (const key of Object.keys(props)) {
    const canon = map[norm(key)] ?? map[key]
    if (canon && !(canon in out)) { out[canon] = props[key]; if (key !== canon) delete out[key] }
  }
  return out
}
/** Resolve a component spec's name + props onto the real schema, or null if unresolvable. */
export function repairComponentSpec(spec: ObjectSpec): ObjectSpec | null {
  const canon = resolveComponent(typeof spec.component === 'string' ? spec.component : '')
  if (!canon) return null
  const props = (spec.props && typeof spec.props === 'object') ? repairProps(canon, spec.props as Record<string, unknown>) : {}
  return { ...spec, component: canon, props }
}

/** Intrinsic height of a component, used by the layout compiler to stack them. */
export const COMPONENT_HEIGHT: Record<string, (props: Record<string, unknown>, w: number) => number> = {
  statusBar: () => 44,
  navBar: () => 52,
  heroAmount: () => 118,
  listRow: () => 64,
  inputRow: () => 64,
  primaryButton: () => 56,
  homeIndicator: () => 20,
  avatar: (p) => Number(p.size) || 40,
  topBar: (p) => Number(p.h) || 64,
  statTile: () => 116,
  barChart: (p) => Number(p.h) || 240,
  tabBar: () => 64,
  sidebar: (p) => Number(p.h) || 640,
  progressRing: (p) => Number(p.size) || 150,
  albumArt: (p, w) => artSize(p, w),
  trackInfo: () => 60,
  scrubber: () => 40,
  transport: () => 72,
  volumeRow: () => 36,
  slider: (p) => (p.label ? 22 : 0) + 24,
  iconButton: (p) => Number(p.size) || 44,
  field: (p) => (p.label ? 24 : 0) + 48,
  chip: () => 34,
  badge: () => 24,
  divider: () => 24
}
export function componentHeight(name: string, props: Record<string, unknown>, w: number): number {
  const canon = resolveComponent(name)
  if (!canon) return 56
  return (COMPONENT_HEIGHT[canon]?.(repairProps(canon, props), w)) ?? 56
}
export function buildComponent(name: string, x: number, y: number, w: number, props: Record<string, unknown>, k: Kit): ObjectSpec[] {
  const canon = resolveComponent(name)
  return canon && COMPONENTS[canon] ? COMPONENTS[canon](x, y, w, repairProps(canon, props), k) : []
}
export function isComponent(name: string): boolean { return !!resolveComponent(name) }

/** Expand an assistant-emitted component spec into its polished object tree, or
 *  null if the spec doesn't name a (resolvable) component. */
export function expandComponentSpec(spec: ObjectSpec, baseKit: Kit = DEFAULT_KIT): ObjectSpec[] | null {
  const repaired = repairComponentSpec(spec)
  if (!repaired) return null
  const fn = COMPONENTS[repaired.component as string]
  if (!fn) return null
  const accent = vibrantAccent(typeof repaired.accent === 'string' ? repaired.accent : baseKit.accent)
  const k: Kit = { ...baseKit, accent, onAccent: readableInk(accent) }
  return fn(repaired.x ?? 0, repaired.y ?? 0, repaired.w ?? 350, (repaired.props && typeof repaired.props === 'object' ? repaired.props : {}) as Record<string, unknown>, k)
}

/** Replace component specs in a list with their expansions; pass others through. */
export function expandComponents(specs: ObjectSpec[], baseKit: Kit = DEFAULT_KIT): ObjectSpec[] {
  return specs.flatMap((s) => (s.component ? (expandComponentSpec(s, baseKit) ?? [s]) : [s]))
}

/** Reference composition (used in tests / as a quality benchmark): a polished
 *  "Add expense" screen built entirely from the kit. */
export function addExpenseScreen(k: Kit = DEFAULT_KIT, w = 390): ObjectSpec[] {
  const root = rid('screen')
  const out: ObjectSpec[] = [{ type: 'frame', ref: root, name: 'Add expense', x: 0, y: 0, w, h: 844, fill: k.bg, fillEnabled: true, strokeEnabled: false }]
  const add = (arr: ObjectSpec[]): void => { for (const o of arr) out.push({ ...o, parent: o.parent ?? root }) }
  add(statusBar(0, 0, w, k))
  add(navBar(0, 44, w, { title: 'New expense' }, k))
  add(heroAmount(0, 150, w, { value: '$48.50' }, k))
  add(listRow(0, 312, w, { icon: 'tag', label: 'Category', value: 'Groceries' }, k))
  add(listRow(0, 384, w, { icon: 'calendar', label: 'Date', value: 'Today, Jun 29' }, k))
  add(inputRow(0, 456, w, { icon: 'edit', placeholder: 'Add a note', divider: false }, k))
  add(primaryButton(20, 752, w - 40, { label: 'Save expense', icon: 'check' }, k))
  add(homeIndicator(0, 826, w, k))
  return out
}
