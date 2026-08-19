import { easingFn } from './easing'

// After Effects–style motion model: each layer (object) has independent keyframe
// tracks per property. Transform props animate via CSS transform, effects via
// CSS filter. We bake to CSS by dense-sampling each track (values pre-eased) and
// emitting combined keyframes with linear timing, so the export matches the live
// preview exactly regardless of per-property easing.

export type PropName = 'opacity' | 'x' | 'y' | 'scale' | 'rotate' | 'blur' | 'brightness' | 'glow'

export interface TKey {
  id: string
  /** time in ms (0..duration) */
  t: number
  v: number
  /** easing for the segment starting at this key (to the next) */
  easing?: string
}

export type Tracks = Partial<Record<PropName, TKey[]>>

export interface LayerMotion {
  duration: number
  tracks: Tracks
  /** property tracks kept but temporarily not applied (hidden/disabled per track) */
  disabled?: PropName[]
}

// High-level "animation" specs authored from the inspector Animations panel. Each
// spec compiles down to keyframes on a single target track (so the timeline,
// preview and export stay the single source of truth). Stored on the object so
// the panel can re-open and edit an animation it created.
export type AnimKind =
  | 'fade-in' | 'fade-out'
  | 'slide-in' | 'slide-out'
  | 'scale-in' | 'scale-out' | 'pop'
  | 'rotate' | 'blur-in'

export interface AnimSpec {
  id: string
  kind: AnimKind
  delay: number
  duration: number
  easing: string
  dir?: 'left' | 'right' | 'up' | 'down'
  distance?: number
  amount?: number
  degrees?: number
}

export interface PropMeta {
  label: string
  short: string
  group: 'transform' | 'effect'
  def: number
  min?: number
  max?: number
  step: number
}

export const PROP_ORDER: PropName[] = ['x', 'y', 'scale', 'rotate', 'opacity', 'blur', 'brightness', 'glow']

export const PROP_META: Record<PropName, PropMeta> = {
  x: { label: 'Position X', short: 'X', group: 'transform', def: 0, step: 1 },
  y: { label: 'Position Y', short: 'Y', group: 'transform', def: 0, step: 1 },
  scale: { label: 'Scale', short: 'S', group: 'transform', def: 1, min: 0, step: 0.05 },
  rotate: { label: 'Rotation', short: 'R', group: 'transform', def: 0, step: 1 },
  opacity: { label: 'Opacity', short: 'O', group: 'transform', def: 1, min: 0, max: 1, step: 0.05 },
  blur: { label: 'Blur', short: 'Bl', group: 'effect', def: 0, min: 0, step: 0.5 },
  brightness: { label: 'Brightness', short: 'Br', group: 'effect', def: 1, min: 0, step: 0.05 },
  glow: { label: 'Glow', short: 'Gl', group: 'effect', def: 0, min: 0, step: 1 },
}

export type LayerState = Record<PropName, number>

/** Base (resting) values for an object: transform offsets are identity, opacity
 * and effects come from the object's static values. */
export function baseState(over: Partial<LayerState> = {}): LayerState {
  return { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1, blur: 0, brightness: 1, glow: 0, ...over }
}

let kc = 0
export function newKeyId(): string {
  return `tk${Date.now().toString(36)}${(kc++).toString(36)}`
}

export function emptyMotion(duration = 2000): LayerMotion {
  return { duration, tracks: {} }
}

export function hasAnyKeys(m: LayerMotion | undefined): boolean {
  if (!m) return false
  return Object.values(m.tracks).some((k) => k && k.length > 0)
}

/** Sample one track at time t (ms) with per-segment easing. */
export function sampleTrack(keys: TKey[] | undefined, t: number, def: number): number {
  if (!keys || keys.length === 0) return def
  const s = [...keys].sort((a, b) => a.t - b.t)
  if (t <= s[0].t) return s[0].v
  const last = s[s.length - 1]
  if (t >= last.t) return last.v
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i], b = s[i + 1]
    if (t >= a.t && t <= b.t) {
      const f = easingFn(a.easing)((t - a.t) / ((b.t - a.t) || 1))
      return a.v + (b.v - a.v) * f
    }
  }
  return last.v
}

/** Full property state at time t, falling back to base for untracked props. */
export function sampleLayer(m: LayerMotion, t: number, base: LayerState): LayerState {
  const out = { ...base }
  for (const p of PROP_ORDER) {
    if (m.disabled?.includes(p)) continue
    const track = m.tracks[p]
    if (track && track.length) out[p] = sampleTrack(track, t, base[p])
  }
  return out
}

function round(n: number, d = 2): number {
  const f = Math.pow(10, d)
  return Math.round((Number.isFinite(n) ? n : 0) * f) / f
}

export function transformOf(s: LayerState): string {
  return `translate3d(${round(s.x)}px, ${round(s.y)}px, 0) scale(${round(s.scale, 3)}) rotate(${round(s.rotate)}deg)`
}

export function filterOf(s: LayerState, glowColor: string, present: boolean): string {
  if (!present) return ''
  const parts: string[] = []
  parts.push(`blur(${round(s.blur, 2)}px)`)
  parts.push(`brightness(${round(s.brightness, 3)})`)
  if (s.glow > 0 || present) parts.push(`drop-shadow(0 0 ${round(s.glow, 1)}px ${glowColor})`)
  return parts.join(' ')
}

function effectsPresent(m: LayerMotion, base: LayerState): boolean {
  return (
    !!(m.tracks.blur?.length || m.tracks.brightness?.length || m.tracks.glow?.length) ||
    base.blur > 0 || base.brightness !== 1 || base.glow > 0
  )
}

/** The set of frame times (ms) we emit: every keyframe time + uniform fill so
 * curves render smoothly. */
function frameTimes(m: LayerMotion): number[] {
  const set = new Set<number>([0, m.duration])
  for (const p of PROP_ORDER) for (const k of m.tracks[p] ?? []) set.add(Math.max(0, Math.min(m.duration, k.t)))
  const steps = 30
  for (let i = 0; i <= steps; i++) set.add(Math.round((i / steps) * m.duration))
  return Array.from(set).sort((a, b) => a - b)
}

/** Live preview helper: CSS-ready styles at time t. */
export function styleAt(m: LayerMotion, t: number, base: LayerState, glowColor: string): { transform: string; opacity: number; filter: string } {
  const s = sampleLayer(m, t, base)
  return { transform: transformOf(s), opacity: Math.max(0, Math.min(1, s.opacity)), filter: filterOf(s, glowColor, effectsPresent(m, base)) }
}

/** Bake a layer's motion into a `@keyframes` block + animation rule for the
 * selector. Values are pre-eased, so timing is linear and the result matches the
 * live preview exactly. */
export function layerToCss(
  selector: string,
  name: string,
  m: LayerMotion,
  base: LayerState,
  glowColor: string,
  opts: { playback?: 'once' | 'loop' | 'pingpong' } = {},
): string {
  const present = effectsPresent(m, base)
  const dur = Math.max(1, m.duration)
  const frames = frameTimes(m)
    .map((t) => {
      const s = sampleLayer(m, t, base)
      const pct = round((t / dur) * 100, 2)
      const filter = present ? ` filter: ${filterOf(s, glowColor, present)};` : ''
      return `  ${pct}% { transform: ${transformOf(s)}; opacity: ${round(Math.max(0, Math.min(1, s.opacity)), 3)};${filter} }`
    })
    .join('\n')
  const tail = opts.playback === 'loop' ? 'infinite' : opts.playback === 'pingpong' ? 'infinite alternate' : 'both'
  return [
    `@keyframes ${name} {\n${frames}\n}`,
    `${selector} { animation: ${name} ${Math.round(dur)}ms linear ${tail}; will-change: transform, opacity, filter; }`,
    `@media (prefers-reduced-motion: reduce) { ${selector} { animation: none; } }`,
  ].join('\n')
}

/** Insert/replace a keyframe on a track at time t (ms). */
export function setKey(m: LayerMotion, prop: PropName, t: number, v: number, easing?: string): LayerMotion {
  const track = [...(m.tracks[prop] ?? [])]
  const existing = track.findIndex((k) => Math.abs(k.t - t) < 1)
  if (existing >= 0) track[existing] = { ...track[existing], v, ...(easing ? { easing } : {}) }
  else track.push({ id: newKeyId(), t: Math.max(0, Math.min(m.duration, t)), v, easing: easing ?? 'cubic-bezier(0.22,1,0.36,1)' })
  track.sort((a, b) => a.t - b.t)
  return { ...m, tracks: { ...m.tracks, [prop]: track } }
}

export function removeKey(m: LayerMotion, prop: PropName, id: string): LayerMotion {
  const track = (m.tracks[prop] ?? []).filter((k) => k.id !== id)
  const tracks = { ...m.tracks }
  if (track.length) tracks[prop] = track
  else delete tracks[prop]
  return { ...m, tracks }
}
