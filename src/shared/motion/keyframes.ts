// Keyframes: values that change across the loop.
//
// Everything else in a Motion document is fixed for the whole loop. A
// component animates its cards and nothing else moves — the pose holds, the
// parameters hold, the type holds. Keyframes are how a user says "this value
// is not the same at the end as it was at the start".
//
// THE ONE IDEA WORTH UNDERSTANDING HERE: a Motion track is a *ring*, not a
// line.
//
// Ordinary keyframe systems, Form's included, hold the first value before the
// first key and the last value after the last key. That is right for an
// animation that plays once and stops. It is wrong here, because a Motion
// piece loops forever: if the last key does not happen to hold the same value
// as the first, the loop jumps every time it comes round, and the jump gets
// worse the more the user edits. Asking people to keep both ends in agreement
// by hand would make the seam their problem, and they would lose.
//
// So the segment after the last key runs *back round to the first key*,
// across the seam. Phase 0 and phase 1 are then the same instant on the ring
// and necessarily produce the same value, whatever keys exist and wherever
// they sit. A user cannot author a loop that jumps, because there is nowhere
// in the model to express one.
//
// Times are a fraction of the loop rather than milliseconds, which keeps a
// keyed piece independent of how long the export happens to be. Change the
// duration and the choreography stretches with it instead of falling apart.

import type { Easing } from './types'
import { cubicBezier, wrap01 } from './math'

/** A value the track passes through, at a point in the loop. */
export type Key = {
  id: string
  /** Where in the loop, 0–1. */
  t: number
  v: number
  /** How the segment *starting* at this key is travelled. Linear if absent. */
  easing?: Easing
}

export type Track = {
  keys: Key[]
  /** Off keeps the keys but stops them applying, so a track can be auditioned. */
  muted?: boolean
}

/**
 * What a track drives, as a string so a document can name things that do not
 * exist in this build without failing to open.
 *
 *   param:<key>          a component parameter, e.g. `param:radius`
 *   pose:<field>         tiltX | tiltY | tiltZ
 *   text:<layerId>:<f>   a text layer's size | x | y | opacity | tracking
 *   fx:<field>           a frame effect
 *
 * A target naming a parameter the current component does not have is simply
 * not applied — switching component keeps the other one's tracks, exactly as
 * `params` already keeps both components' settings.
 */
export type TrackTarget = string

export type Keyframes = Record<TrackTarget, Track>

export function emptyKeyframes(): Keyframes {
  return {}
}

/** Linear unless the key says otherwise. */
function easeWith(curve: Easing | undefined, f: number): number {
  if (!curve) return f
  return cubicBezier(curve.x1, curve.y1, curve.x2, curve.y2, f)
}

/**
 * A track's value at a point in the loop.
 *
 * Returns `fallback` when the track has nothing to say, so an unkeyed value
 * keeps whatever the panel is set to and keying one parameter does not
 * quietly reset the others.
 */
export function sampleTrack(track: Track | undefined, phase: number, fallback: number): number {
  if (!track || track.muted) return fallback
  const keys = track.keys
  if (!keys || keys.length === 0) return fallback
  // One key is a constant, not an animation. It still overrides the panel,
  // because the user did put it there.
  if (keys.length === 1) return keys[0].v

  const s = [...keys].sort((a, b) => a.t - b.t)
  const t = wrap01(phase)

  // Start on the segment that crosses the seam: from the last key, over the
  // end of the loop, back to the first. It is the answer whenever `t` is
  // after the last key or before the first, which is why it is the default
  // rather than a special case bolted on afterwards.
  let a = s[s.length - 1]
  let b = s[0]
  let span = 1 - a.t + b.t
  let local = t >= a.t ? t - a.t : t + (1 - a.t)

  for (let i = 0; i < s.length - 1; i++) {
    if (t >= s[i].t && t < s[i + 1].t) {
      a = s[i]
      b = s[i + 1]
      span = b.t - a.t
      local = t - a.t
      break
    }
  }

  // Two keys at the same instant: take the later one rather than dividing by
  // a zero-length segment.
  if (span <= 0) return b.v
  return a.v + (b.v - a.v) * easeWith(a.easing, local / span)
}

/** Every target that currently has at least one key. */
export function keyedTargets(keys: Keyframes | undefined): TrackTarget[] {
  if (!keys) return []
  return Object.keys(keys).filter((k) => (keys[k]?.keys?.length ?? 0) > 0)
}

export function isKeyed(keys: Keyframes | undefined, target: TrackTarget): boolean {
  return (keys?.[target]?.keys?.length ?? 0) > 0
}

/** The value a target holds at a phase, or the fallback if it is not keyed. */
export function valueAt(
  keys: Keyframes | undefined,
  target: TrackTarget,
  phase: number,
  fallback: number
): number {
  return sampleTrack(keys?.[target], phase, fallback)
}

/**
 * Put a key on a track, replacing any key already at that instant.
 *
 * Returns a new Keyframes rather than mutating, because documents are handed
 * around by reference and an in-place edit would not re-render.
 */
export function setKey(
  keys: Keyframes,
  target: TrackTarget,
  t: number,
  v: number,
  easing?: Easing
): Keyframes {
  const at = wrap01(t)
  const track = keys[target] ?? { keys: [] }
  // Same instant means the same key: a track cannot hold two values at once,
  // and letting it would make the segment lookup depend on sort order.
  const existing = track.keys.find((k) => Math.abs(k.t - at) < 1e-6)
  const next: Key[] = existing
    ? track.keys.map((k) => (k === existing ? { ...k, v, easing: easing ?? k.easing } : k))
    : [...track.keys, { id: `k${Math.random().toString(36).slice(2, 9)}`, t: at, v, easing }]
  return { ...keys, [target]: { ...track, keys: next.sort((a, b) => a.t - b.t) } }
}

/** Take a key off a track, and the track off the document if it was the last. */
export function removeKey(keys: Keyframes, target: TrackTarget, id: string): Keyframes {
  const track = keys[target]
  if (!track) return keys
  const next = track.keys.filter((k) => k.id !== id)
  if (next.length === 0) {
    const out = { ...keys }
    delete out[target]
    return out
  }
  return { ...keys, [target]: { ...track, keys: next } }
}

/** Move a key to a different instant, keeping the track sorted. */
/**
 * How the segment starting at one key is travelled.
 *
 * Undefined clears it back to linear rather than storing a straight-line
 * curve, so a document only carries the easing somebody actually chose.
 */
export function setKeyEasing(
  keys: Keyframes,
  target: TrackTarget,
  id: string,
  easing: Easing | undefined
): Keyframes {
  const track = keys[target]
  if (!track) return keys
  return {
    ...keys,
    [target]: {
      ...track,
      keys: track.keys.map((k) => {
        if (k.id !== id) return k
        if (!easing) {
          const { easing: _drop, ...rest } = k
          return rest
        }
        return { ...k, easing }
      })
    }
  }
}

/**
 * Change what a key holds, leaving it where it is.
 *
 * Moving a key along the lane and changing the value it holds are two
 * different edits, and a timeline that only offers the first makes the second
 * reachable exactly one way: scrub to the key, then drag the slider it belongs
 * to and hope you land on the same phase. So the value is settable directly.
 */
export function setKeyValue(keys: Keyframes, target: TrackTarget, id: string, v: number): Keyframes {
  const track = keys[target]
  if (!track) return keys
  if (!Number.isFinite(v)) return keys
  return {
    ...keys,
    [target]: { ...track, keys: track.keys.map((k) => (k.id === id ? { ...k, v } : k)) }
  }
}

export function moveKey(keys: Keyframes, target: TrackTarget, id: string, t: number): Keyframes {
  const track = keys[target]
  if (!track) return keys
  const at = wrap01(t)
  return {
    ...keys,
    [target]: {
      ...track,
      keys: track.keys.map((k) => (k.id === id ? { ...k, t: at } : k)).sort((a, b) => a.t - b.t)
    }
  }
}

/** Drop a whole track. */
export function removeTrack(keys: Keyframes, target: TrackTarget): Keyframes {
  if (!keys[target]) return keys
  const out = { ...keys }
  delete out[target]
  return out
}

export function setMuted(keys: Keyframes, target: TrackTarget, muted: boolean): Keyframes {
  const track = keys[target]
  if (!track) return keys
  return { ...keys, [target]: { ...track, muted } }
}

/**
 * Where a key should land when it is dragged to `t`.
 *
 * A timeline that lets a key sit anywhere produces keys at 0.3874 of a loop,
 * which is between two frames and so renders on one of them anyway — the
 * number is precise and the result is not. So a drag lands on a frame, and on
 * another key's frame in preference to its own, because lining two properties
 * up to start together is the single most common thing anyone does here.
 *
 * `free` is the escape hatch (Alt), for the rare case where the grid is
 * getting in the way rather than helping.
 *
 * @param t Where the pointer is, 0..1 along the loop.
 * @param frames How many frames the loop is, so the grid has a spacing.
 * @param others The times of the other keys in the lane, already 0..1.
 * @param magnet How close another key has to be to win, as a fraction of the
 *   loop. Callers pass a pixel distance converted to loop fraction, so the
 *   pull feels the same at any lane width.
 */
export function snapKeyTime(
  t: number,
  frames: number,
  others: readonly number[] = [],
  magnet = 0,
  free = false
): number {
  const clamped = Math.min(1, Math.max(0, t))
  if (free) return clamped
  let best = frames > 0 ? Math.round(clamped * frames) / frames : clamped
  if (magnet > 0) {
    // A neighbour inside the magnet beats the grid, and the nearest neighbour
    // beats a further one. Ties go to the earlier key, which is stable.
    let bestGap = magnet
    for (const o of others) {
      const gap = Math.abs(o - clamped)
      if (gap < bestGap) { bestGap = gap; best = o }
    }
  }
  return Math.min(1, Math.max(0, best))
}

/**
 * One frame either side, for the arrow keys. Returns the new time rather than
 * the whole map so it can be fed straight to `moveKey`.
 */
export function nudgeKeyTime(t: number, frames: number, steps: number): number {
  const step = frames > 0 ? 1 / frames : 0.01
  // Nudging from a time that is already off the grid should land on the grid,
  // not carry the offset along forever.
  const onGrid = frames > 0 ? Math.round(t * frames) / frames : t
  return Math.min(1, Math.max(0, onGrid + step * steps))
}

/** The kinds of track that belong to a layer, and so die with it. */
const LAYER_KINDS = ['text', 'logo', 'shape', 'picture']

/**
 * Drop the tracks of layers that are no longer in the piece.
 *
 * Deleting a layer used to leave its keyframes behind, and a track with no
 * layer still draws a row: the timeline showed something called "Layer down"
 * that was nowhere in the scene and could not be selected, because the name
 * comes from a layer that had gone. It applied to nothing and could not be
 * got rid of except by finding the × on a row you had no reason to trust.
 *
 * Only layer tracks are pruned. A `param:` target naming a parameter this
 * component does not have is deliberately kept -- that is how switching
 * component and switching back keeps the motion you built -- and the same
 * goes for `pose:` and `fx:`, which belong to the piece rather than to any
 * layer.
 *
 * Returns the original map when there is nothing to drop, so this can sit on
 * a hot path without making a new object on every edit.
 */
export function pruneLayerTracks(
  keys: Keyframes | undefined,
  alive: ReadonlySet<string>
): Keyframes | undefined {
  if (!keys) return keys
  let dropped = false
  const out: Keyframes = {}
  for (const [target, track] of Object.entries(keys)) {
    const parts = target.split(':')
    if (parts.length >= 3 && LAYER_KINDS.includes(parts[0]) && !alive.has(`${parts[0]}:${parts[1]}`)) {
      dropped = true
      continue
    }
    out[target] = track
  }
  return dropped ? out : keys
}

/** Every layer in a piece, as the `kind:id` keys a track target begins with. */
export function liveLayerIds(visual: {
  text?: Array<{ id: string }>
  logos?: Array<{ id: string }>
  shapes?: Array<{ id: string }>
  pictures?: Array<{ id: string }>
}): Set<string> {
  const out = new Set<string>()
  for (const l of visual.text ?? []) out.add(`text:${l.id}`)
  for (const l of visual.logos ?? []) out.add(`logo:${l.id}`)
  for (const l of visual.shapes ?? []) out.add(`shape:${l.id}`)
  for (const l of visual.pictures ?? []) out.add(`picture:${l.id}`)
  return out
}
