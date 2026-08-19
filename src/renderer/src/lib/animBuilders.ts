import { type AnimKind, type AnimSpec, type LayerMotion, type PropName, type TKey, type Tracks, PROP_ORDER, newKeyId } from './timelineModel'

// Compiles high-level AnimSpec entries into keyframe tracks. Each spec owns a
// single target property (so two specs never fight over one track), while any
// hand-keyed tracks the panel didn't create are preserved untouched.

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))
const k = (t: number, v: number, easing?: string): TKey => ({ id: newKeyId(), t: Math.round(t), v, ...(easing ? { easing } : {}) })

export interface AnimKindMeta {
  label: string
  group: 'Entrance' | 'Emphasis' | 'Exit'
  /** which configurable fields the popup should show */
  fields: Array<'dir' | 'distance' | 'amount' | 'degrees'>
}

export const ANIM_KINDS: Record<AnimKind, AnimKindMeta> = {
  'fade-in': { label: 'Fade in', group: 'Entrance', fields: ['amount'] },
  'slide-in': { label: 'Slide in', group: 'Entrance', fields: ['dir', 'distance'] },
  'scale-in': { label: 'Scale in', group: 'Entrance', fields: ['amount'] },
  pop: { label: 'Pop in', group: 'Entrance', fields: ['amount'] },
  rotate: { label: 'Rotate', group: 'Emphasis', fields: ['degrees'] },
  'blur-in': { label: 'Blur in', group: 'Entrance', fields: [] },
  'fade-out': { label: 'Fade out', group: 'Exit', fields: ['amount'] },
  'slide-out': { label: 'Slide out', group: 'Exit', fields: ['dir', 'distance'] },
  'scale-out': { label: 'Scale out', group: 'Exit', fields: ['amount'] }
}

export const ANIM_KIND_ORDER: AnimKind[] = ['fade-in', 'slide-in', 'scale-in', 'pop', 'rotate', 'blur-in', 'fade-out', 'slide-out', 'scale-out']

/** Sensible defaults when adding a brand-new animation of a given kind. */
export function defaultSpec(kind: AnimKind): AnimSpec {
  const base: AnimSpec = { id: newKeyId(), kind, delay: 0, duration: 1000, easing: 'cubic-bezier(0,0,0.58,1)' }
  const f = ANIM_KINDS[kind].fields
  if (f.includes('dir')) base.dir = 'left'
  if (f.includes('distance')) base.distance = 200
  if (f.includes('degrees')) base.degrees = 180
  if (f.includes('amount')) base.amount = kind.startsWith('fade') ? 0 : kind.startsWith('scale') ? 0.3 : 0.6
  return base
}

/** The single property an animation kind drives. */
export function targetProp(s: AnimSpec): PropName {
  switch (s.kind) {
    case 'fade-in':
    case 'fade-out':
      return 'opacity'
    case 'slide-in':
    case 'slide-out':
      return s.dir === 'up' || s.dir === 'down' ? 'y' : 'x'
    case 'scale-in':
    case 'scale-out':
    case 'pop':
      return 'scale'
    case 'rotate':
      return 'rotate'
    case 'blur-in':
      return 'blur'
  }
}

/** Build the keyframes for one spec across the timeline [0, total]. */
export function buildAnimKeys(s: AnimSpec, total: number): TKey[] {
  const t0 = clamp(s.delay, 0, total)
  const t1 = clamp(s.delay + s.duration, t0 + 1, total)
  const e = s.easing
  switch (s.kind) {
    case 'fade-in':
      return [k(t0, clamp(s.amount ?? 0, 0, 1), e), k(t1, 1)]
    case 'fade-out':
      return [k(t0, 1, e), k(t1, clamp(s.amount ?? 0, 0, 1))]
    case 'slide-in': {
      const off = (s.dir === 'left' || s.dir === 'up' ? -1 : 1) * (s.distance ?? 200)
      return [k(t0, off, e), k(t1, 0)]
    }
    case 'slide-out': {
      const off = (s.dir === 'left' || s.dir === 'up' ? -1 : 1) * (s.distance ?? 200)
      return [k(t0, 0, e), k(t1, off)]
    }
    case 'scale-in':
      return [k(t0, s.amount ?? 0.3, e), k(t1, 1)]
    case 'scale-out':
      return [k(t0, 1, e), k(t1, s.amount ?? 0.3)]
    case 'pop':
      return [k(t0, s.amount ?? 0.6, e), k(t0 + (t1 - t0) * 0.6, 1.06, e), k(t1, 1)]
    case 'rotate':
      return [k(t0, 0, e), k(t1, s.degrees ?? 180)]
    case 'blur-in':
      return [k(t0, 12, e), k(t1, 0)]
  }
}

/** Apply (add or replace) one animation: writes its target track, keeps the rest. */
export function applyAnim(motion: LayerMotion | undefined, spec: AnimSpec, total: number): { motion: LayerMotion; anims: (prev: AnimSpec[]) => AnimSpec[] } {
  const prop = targetProp(spec)
  const tracks: Tracks = { ...(motion?.tracks ?? {}) }
  tracks[prop] = buildAnimKeys(spec, total)
  return {
    motion: { duration: total, tracks },
    anims: (prev) => [...prev.filter((a) => a.id !== spec.id && targetProp(a) !== prop), spec]
  }
}

/** Remove an animation spec and its compiled track. */
export function removeAnim(motion: LayerMotion | undefined, spec: AnimSpec): { motion: LayerMotion; anims: (prev: AnimSpec[]) => AnimSpec[] } {
  const prop = targetProp(spec)
  const tracks: Tracks = { ...(motion?.tracks ?? {}) }
  delete tracks[prop]
  return {
    motion: { duration: motion?.duration ?? total(motion), tracks },
    anims: (prev) => prev.filter((a) => a.id !== spec.id)
  }
}

function total(m: LayerMotion | undefined): number {
  return m?.duration ?? 2000
}

/** A short human summary of an animation for the list row. */
export function summarize(s: AnimSpec): string {
  const ms = `${s.duration}ms`
  const delay = s.delay ? ` · ${s.delay}ms delay` : ''
  if (s.kind === 'slide-in' || s.kind === 'slide-out') return `${s.dir ?? 'left'} · ${s.distance ?? 200}px · ${ms}${delay}`
  if (s.kind === 'rotate') return `${s.degrees ?? 180}° · ${ms}${delay}`
  return `${ms}${delay}`
}

/** Property labels for tracks that exist in motion but weren't authored here. */
export const PROP_ANIM_LABEL: Record<PropName, string> = {
  x: 'Position X', y: 'Position Y', scale: 'Scale', rotate: 'Rotation',
  opacity: 'Opacity', blur: 'Blur', brightness: 'Brightness', glow: 'Glow'
}

/** Props animated in motion that no spec owns (hand-keyed or preset-applied). */
export function unspeccedProps(motion: LayerMotion | undefined, anims: AnimSpec[]): PropName[] {
  if (!motion) return []
  const owned = new Set(anims.map(targetProp))
  return PROP_ORDER.filter((p) => (motion.tracks[p]?.length ?? 0) > 0 && !owned.has(p))
}
