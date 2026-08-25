// Presets: the same component, tuned differently.
//
// They are generated from each component's own schema rather than hand-written
// per component. Hand-authoring fifteen presets for eleven components would be
// 165 tables to maintain, and every new parameter would silently leave all of
// them stale. Sampling the schema means a component that gains a slider gets
// presets that use it the day it lands.
//
// The sampling is deterministic — the same index always gives the same numbers
// — so a preset a user picked yesterday is the same preset today.

import type { MotionComponent, ParamValue } from './types'
import { hash01 } from './math'

export const PRESETS_PER_COMPONENT = 15

/**
 * The parameters for preset `index` of a component.
 *
 * Preset 0 is always the component's own defaults, so the first thumbnail in
 * the strip is what you get by picking the component — a strip whose first
 * entry was a random variation would make the default feel unreachable.
 */
export function presetParams(component: MotionComponent, index: number): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {}
  for (const spec of component.schema) {
    if (index === 0) { out[spec.key] = spec.default; continue }
    const seed = hash01(index * 977 + hashKey(spec.key))
    if (spec.kind === 'slider') {
      // Sampling is pulled towards the default rather than spread evenly over
      // the range: the extremes of most of these parameters are interesting
      // once and unusable the rest of the time, so a strip of pure extremes
      // would be a strip of things nobody picks.
      const span = spec.max - spec.min
      const bias = (seed - 0.5) * span * 0.85
      const raw = spec.default + bias
      const stepped = Math.round(raw / spec.step) * spec.step
      out[spec.key] = Math.min(spec.max, Math.max(spec.min, Number(stepped.toFixed(4))))
    } else if (spec.kind === 'toggle') {
      out[spec.key] = seed > 0.45
    } else {
      out[spec.key] = spec.options[Math.floor(seed * spec.options.length) % spec.options.length].value
    }
  }
  return out
}

export function presetLabel(index: number): string {
  return String(index + 1).padStart(2, '0')
}

function hashKey(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 100003
  return h
}
