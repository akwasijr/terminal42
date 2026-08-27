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
import { peakOnScreen } from './visibility'

export const PRESETS_PER_COMPONENT = 15

/**
 * The parameters for preset `index` of a component.
 *
 * Preset 0 is always the component's own defaults, so the first thumbnail in
 * the strip is what you get by picking the component — a strip whose first
 * entry was a random variation would make the default feel unreachable.
 */
export function presetParams(component: MotionComponent, index: number): Record<string, ParamValue> {
  // Cached because the result is fixed for a component and an index, while the
  // callers are not: the drawer asks for all fifteen on every render, and then
  // asks again to work out which one is selected. Sampling is cheap, but the
  // check below walks the whole loop for every card, and an arrangement can
  // hold a hundred of them.
  const key = `${component.id}:${index}`
  const hit = cache.get(key)
  if (hit) return { ...hit }
  const made = build(component, index)
  cache.set(key, made)
  return { ...made }
}

const cache = new Map<string, Record<string, ParamValue>>()

function build(component: MotionComponent, index: number): Record<string, ParamValue> {
  // A preset that puts nothing in the frame is not a choice, it is a gap in
  // the strip. Rather than special-casing the arrangements that can reach one,
  // the sample is simply drawn again with a different salt until the frame has
  // something in it. Deterministic, because the salt is a counted sequence and
  // not a random one, so a strip is the same strip every time it is drawn.
  if (index === 0) return sample(component, index, 0)
  let best = sample(component, index, 0)
  let bestPeak = -1
  for (let salt = 0; salt < 8; salt++) {
    const attempt = salt === 0 ? best : sample(component, index, salt)
    const peak = peakOnScreen(component, attempt)
    // Three cards, or all of them if the arrangement only draws one or two.
    // A flat floor would keep resampling an arrangement that is meant to show
    // a single card, and a fraction of the total would let a ring of forty
    // pass on two.
    if (peak >= Math.min(3, component.cardCount(attempt))) return attempt
    // Some arrangements cannot reach the floor at any setting — a slider whose
    // cards are wide enough will only ever fit two. Keeping the fullest of the
    // attempts means those still get their best frame rather than their first.
    if (peak > bestPeak) { best = attempt; bestPeak = peak }
  }
  return best
}

function sample(component: MotionComponent, index: number, salt: number): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {}
  for (const spec of component.schema) {
    if (index === 0) { out[spec.key] = spec.default; continue }
    // The component is part of the seed. Without it, every component with a
    // parameter of the same name drew the same number at the same index, so
    // four of the fifteen presets were the identical idea in all eighteen
    // arrangements — and when that number was a card count of one, four of
    // every strip were the same empty frame.
    const seed = hash01(index * 977 + hashKey(spec.key) + hashKey(component.id) * 31 + salt * 6113)
    if (spec.kind === 'slider') {
      // Sampling is pulled towards the default rather than spread evenly over
      // the range: the extremes of most of these parameters are interesting
      // once and unusable the rest of the time, so a strip of pure extremes
      // would be a strip of things nobody picks.
      //
      // Each side is measured to its own end. Scaling one excursion by the
      // whole span instead treats a default sitting near the bottom of its
      // range as though it had room below it, and every low sample piles up
      // clamped against the minimum — which is how a card count whose default
      // was 6 in a range of 1 to 40 kept landing on exactly one card.
      const reach = seed < 0.5 ? spec.default - spec.min : spec.max - spec.default
      const raw = spec.default + (seed - 0.5) * 2 * reach * 0.85
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
