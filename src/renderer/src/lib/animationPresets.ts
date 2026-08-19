import { type LayerMotion, type TKey, type PropName, newKeyId } from './timelineModel'

// A curated library of entrance / emphasis / exit animation presets, applied to a
// layer's motion. Values are translate offsets (x/y), uniform scale, rotate (deg)
// and opacity — matching the timeline track model.

export type PresetGroup = 'Entrance' | 'Emphasis' | 'Exit'
export interface AnimPreset {
  id: string
  label: string
  group: PresetGroup
  build: (dur: number) => LayerMotion
}

const EASE_OUT = 'cubic-bezier(0,0,0.58,1)'
const EASE_IN = 'cubic-bezier(0.42,0,1,1)'
const EASE_IN_OUT = 'cubic-bezier(0.42,0,0.58,1)'
const BACK_OUT = 'cubic-bezier(0.34,1.56,0.64,1)'
const SPRING = 'spring(0.55,6)'

const k = (t: number, v: number, easing?: string): TKey => ({ id: newKeyId(), t: Math.round(t), v, ...(easing ? { easing } : {}) })

function m(dur: number, tracks: Partial<Record<PropName, TKey[]>>): LayerMotion {
  return { duration: dur, tracks }
}

export const ANIMATION_PRESETS: AnimPreset[] = [
  // ── Entrance ──
  { id: 'fade-in', label: 'Fade in', group: 'Entrance', build: (d) => m(d, { opacity: [k(0, 0, EASE_OUT), k(d, 1)] }) },
  { id: 'fade-up', label: 'Fade in up', group: 'Entrance', build: (d) => m(d, { opacity: [k(0, 0, EASE_OUT), k(d, 1)], y: [k(0, 24, EASE_OUT), k(d, 0)] }) },
  { id: 'fade-down', label: 'Fade in down', group: 'Entrance', build: (d) => m(d, { opacity: [k(0, 0, EASE_OUT), k(d, 1)], y: [k(0, -24, EASE_OUT), k(d, 0)] }) },
  { id: 'fade-left', label: 'Fade in left', group: 'Entrance', build: (d) => m(d, { opacity: [k(0, 0, EASE_OUT), k(d, 1)], x: [k(0, -24, EASE_OUT), k(d, 0)] }) },
  { id: 'fade-right', label: 'Fade in right', group: 'Entrance', build: (d) => m(d, { opacity: [k(0, 0, EASE_OUT), k(d, 1)], x: [k(0, 24, EASE_OUT), k(d, 0)] }) },
  { id: 'slide-up', label: 'Slide in up', group: 'Entrance', build: (d) => m(d, { y: [k(0, 200, EASE_OUT), k(d, 0)] }) },
  { id: 'slide-left', label: 'Slide in left', group: 'Entrance', build: (d) => m(d, { x: [k(0, -200, EASE_OUT), k(d, 0)] }) },
  { id: 'zoom-in', label: 'Zoom in', group: 'Entrance', build: (d) => m(d, { opacity: [k(0, 0, EASE_OUT), k(d, 1)], scale: [k(0, 0.3, EASE_OUT), k(d, 1)] }) },
  { id: 'pop', label: 'Pop in', group: 'Entrance', build: (d) => m(d, { opacity: [k(0, 0, EASE_OUT), k(d * 0.4, 1)], scale: [k(0, 0.85, BACK_OUT), k(d, 1)] }) },
  { id: 'bounce-in', label: 'Bounce in', group: 'Entrance', build: (d) => m(d, { opacity: [k(0, 0, EASE_OUT), k(d * 0.3, 1)], scale: [k(0, 0.3, SPRING), k(d, 1)] }) },
  { id: 'spin-in', label: 'Spin in', group: 'Entrance', build: (d) => m(d, { opacity: [k(0, 0, EASE_OUT), k(d, 1)], rotate: [k(0, -180, EASE_OUT), k(d, 0)], scale: [k(0, 0.6, EASE_OUT), k(d, 1)] }) },
  { id: 'blur-in', label: 'Blur in', group: 'Entrance', build: (d) => m(d, { opacity: [k(0, 0, EASE_OUT), k(d, 1)], blur: [k(0, 12, EASE_OUT), k(d, 0)] }) },

  // ── Emphasis ──
  { id: 'pulse', label: 'Pulse', group: 'Emphasis', build: (d) => m(d, { scale: [k(0, 1, EASE_IN_OUT), k(d * 0.5, 1.1, EASE_IN_OUT), k(d, 1)] }) },
  { id: 'bounce', label: 'Bounce', group: 'Emphasis', build: (d) => m(d, { y: [k(0, 0, EASE_OUT), k(d * 0.4, -30, EASE_IN), k(d * 0.7, 0, EASE_OUT), k(d * 0.85, -12, EASE_IN), k(d, 0)] }) },
  { id: 'shake', label: 'Shake', group: 'Emphasis', build: (d) => m(d, { x: [k(0, 0), k(d * 0.2, -10), k(d * 0.4, 10), k(d * 0.6, -10), k(d * 0.8, 10), k(d, 0)] }) },
  { id: 'tada', label: 'Tada', group: 'Emphasis', build: (d) => m(d, { scale: [k(0, 1, EASE_IN_OUT), k(d * 0.2, 0.9), k(d * 0.4, 1.1), k(d, 1)], rotate: [k(0, 0), k(d * 0.2, -3), k(d * 0.4, 3), k(d * 0.6, -3), k(d * 0.8, 3), k(d, 0)] }) },
  { id: 'wobble', label: 'Wobble', group: 'Emphasis', build: (d) => m(d, { rotate: [k(0, 0, EASE_IN_OUT), k(d * 0.25, -8), k(d * 0.5, 6), k(d * 0.75, -4), k(d, 0)], x: [k(0, 0), k(d * 0.25, -20), k(d * 0.5, 15), k(d * 0.75, -8), k(d, 0)] }) },
  { id: 'flash', label: 'Flash', group: 'Emphasis', build: (d) => m(d, { opacity: [k(0, 1, EASE_IN_OUT), k(d * 0.25, 0), k(d * 0.5, 1), k(d * 0.75, 0), k(d, 1)] }) },

  // ── Exit ──
  { id: 'fade-out', label: 'Fade out', group: 'Exit', build: (d) => m(d, { opacity: [k(0, 1, EASE_IN), k(d, 0)] }) },
  { id: 'fade-out-up', label: 'Fade out up', group: 'Exit', build: (d) => m(d, { opacity: [k(0, 1, EASE_IN), k(d, 0)], y: [k(0, 0, EASE_IN), k(d, -24)] }) },
  { id: 'zoom-out', label: 'Zoom out', group: 'Exit', build: (d) => m(d, { opacity: [k(0, 1, EASE_IN), k(d, 0)], scale: [k(0, 1, EASE_IN), k(d, 0.3)] }) },
  { id: 'slide-out-down', label: 'Slide out down', group: 'Exit', build: (d) => m(d, { y: [k(0, 0, EASE_IN), k(d, 200)] }) },
]

export const PRESET_GROUPS: PresetGroup[] = ['Entrance', 'Emphasis', 'Exit']
