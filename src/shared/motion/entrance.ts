// Entrance and exit: the one-shot animation that hands a card to the idle loop.
//
// This is deliberately not a component. A component is a pure function of
// loop phase that closes at both ends and runs forever; an entrance is a pure
// function of elapsed time that starts somewhere else and ends exactly at
// wherever the idle loop currently puts the card. `applyEntrance` is the
// blend that makes that handover invisible: at progress 1 it must return the
// settled placement unchanged, or the cut from entrance to loop would jump.

import type { CardPlacement, EntranceShape, EntranceSpec, MotionDoc } from './types'
import { clamp01, cubicBezier, hash01, lerp } from './math'
import { computePlacements } from './frame'

export const ENTRANCE_SHAPES: ReadonlyArray<{ id: EntranceShape; label: string }> = [
  { id: 'fade', label: 'Fade' },
  { id: 'rise', label: 'Rise' },
  { id: 'drop', label: 'Drop' },
  { id: 'scale', label: 'Scale' },
  { id: 'fly-in', label: 'Fly in' },
  { id: 'unfold', label: 'Unfold' },
  { id: 'spiral', label: 'Spiral' }
]

/**
 * Sensible starting point for a switch the export panel offers off by default.
 *
 * The piece has to work with entrances switched off, so `enabled` defaults to
 * false. 'in' gets a gentle ease-out (arrives and settles) and 'out' a gentle
 * ease-in (holds, then leaves), which is the usual pairing for arrival versus
 * departure.
 */
export function defaultEntrance(kind: 'in' | 'out'): EntranceSpec {
  return {
    enabled: false,
    shape: 'fade',
    duration: 0.8,
    stagger: 0.04,
    easing: kind === 'in' ? { x1: 0, y1: 0, x2: 0.2, y2: 1 } : { x1: 0.4, y1: 0, x2: 1, y2: 1 }
  }
}

/**
 * How far through its own move card `index` is, at `elapsedSec` into the
 * whole animation.
 *
 * Cards start in a stagger, each `spec.stagger` seconds after the last, and
 * then take `spec.duration` seconds to complete. Guarded against every
 * degenerate input the caller might hand it, because this runs every frame
 * from a live clock and a NaN here would freeze or blank the whole scene.
 */
export function cardProgress(spec: EntranceSpec, elapsedSec: number, index: number, count: number): number {
  if (count <= 0 || !Number.isFinite(elapsedSec)) return 1
  const duration = Math.max(1e-6, spec.duration)
  const start = Math.max(0, index) * Math.max(0, spec.stagger)
  const t = (elapsedSec - start) / duration
  return clamp01(Number.isFinite(t) ? t : 1)
}

/**
 * Seconds from the start of the animation to the last card finishing.
 *
 * Zero when the spec is disabled, so a caller can use this to know when Play
 * has finished without having to inspect every card's progress.
 */
export function totalDuration(spec: EntranceSpec, count: number): number {
  if (!spec.enabled || count <= 0) return 0
  return Math.max(0, spec.duration) + Math.max(0, spec.stagger) * (count - 1)
}

/**
 * Blend a card's settled placement with where it is partway through its
 * entrance shape.
 *
 * `progress` is 0 at the very start of the move and 1 once it is done; the
 * caller applies the spec's easing before calling in some paths, but this
 * function also eases internally so that `cardProgress`'s raw, linear output
 * can always be passed straight in. At progress 1 the result is `base`
 * exactly — the identity the idle loop takes back over from.
 *
 * The same shape runs an exit: the caller passes the exit spec and drives
 * `progress` from 1 down to 0, so leaving is arriving played backwards. This
 * function does not need to know which direction it is being used in.
 */
export function applyEntrance(
  base: CardPlacement,
  spec: EntranceSpec,
  progress: number,
  index: number,
  count: number
): CardPlacement {
  const raw = Number.isFinite(progress) ? clamp01(progress) : 1
  const e = spec.easing
  const t = clamp01(cubicBezier(e.x1, e.y1, e.x2, e.y2, raw))
  if (t >= 1) return base

  const jitter = hash01(index * 5.3 + count * 0.7)
  const side = index % 2 === 0 ? 1 : -1

  switch (spec.shape) {
    case 'fade':
      return { ...base, opacity: lerp(0, base.opacity, t) }

    case 'rise':
      return { ...base, y: lerp(base.y - 2, base.y, t), opacity: lerp(0, base.opacity, t) }

    case 'drop':
      return { ...base, y: lerp(base.y + 2, base.y, t), opacity: lerp(0, base.opacity, t) }

    case 'scale':
      return { ...base, scale: lerp(base.scale * 0.01, base.scale, t), opacity: lerp(0, base.opacity, t) }

    case 'fly-in':
      // The side alternates by index so a batch of cards reads as a shuffle
      // converging from both wings rather than one long slide from one edge.
      return {
        ...base,
        x: lerp(base.x + side * (4 + jitter * 2), base.x, t),
        z: lerp(base.z - 6, base.z, t),
        opacity: lerp(0, base.opacity, t)
      }

    case 'unfold':
      return {
        ...base,
        rotY: lerp(base.rotY + Math.PI / 2, base.rotY, t),
        opacity: lerp(0, base.opacity, t)
      }

    case 'spiral': {
      const extraRadius = lerp(3 + jitter * 2, 0, t)
      return {
        ...base,
        x: base.x + extraRadius,
        rotZ: lerp(base.rotZ + Math.PI * 1.5, base.rotZ, t),
        opacity: lerp(0, base.opacity, t)
      }
    }

    default:
      return base
  }
}

/**
 * The one function the renderer calls: idle placements, optionally blended
 * with an in-flight entrance or exit.
 *
 * With `anim` null this is exactly `computePlacements`, so a piece with
 * entrances switched off (the common case) pays nothing beyond that call. An
 * exit is driven the opposite way to an entrance — progress starts at 1 (the
 * settled placement) and runs down to 0 (fully departed) — because leaving is
 * the same shape played in reverse.
 */
export function placementsAt(
  doc: MotionDoc,
  phase: number,
  anim: { kind: 'in' | 'out'; elapsedSec: number } | null
): CardPlacement[] {
  const base = computePlacements(doc, phase)
  if (!anim) return base

  const spec = anim.kind === 'in' ? doc.animation.componentIn : doc.animation.componentOut
  if (!spec.enabled) return base

  const count = base.length
  return base.map((placement, index) => {
    const raw = cardProgress(spec, anim.elapsedSec, index, count)
    const progress = anim.kind === 'in' ? raw : 1 - raw
    return applyEntrance(placement, spec, progress, index, count)
  })
}

/**
 * Where a clip is at frame `k`.
 *
 * The whole shape of an export lives here rather than in the exporter so it
 * can be checked without a GPU: a clip is the entrance, then exactly one loop,
 * then the exit, with the loop turning underneath the entrance rather than
 * waiting for it.
 */
export type ClipTimeline = {
  frames: number
  inSpan: number
  loopSpan: number
  outSpan: number
  at: (k: number) => { phase: number; anim: { kind: 'in' | 'out'; elapsedSec: number } | null }
}

export function clipTimeline(doc: MotionDoc, count: number): ClipTimeline {
  const fps = Math.max(1, doc.export.fps)
  const inSpan = totalDuration(doc.animation.componentIn, count)
  const outSpan = totalDuration(doc.animation.componentOut, count)
  const loopSpan = Math.max(0.1, doc.export.durationSec)
  const frames = Math.max(1, Math.round((inSpan + loopSpan + outSpan) * fps))

  return {
    frames,
    inSpan,
    loopSpan,
    outSpan,
    at: (k: number) => {
      const t = k / fps
      // Phase is measured from the moment the entrance finishes, so the
      // settled part of the clip is exactly one loop starting at phase 0.
      // Phase 1 is never rendered: it is the same picture as phase 0, and
      // including it would make a seamless loop hitch once per repeat.
      const phase = ((((t - inSpan) / loopSpan) % 1) + 1) % 1
      const anim = t < inSpan
        ? { kind: 'in' as const, elapsedSec: t }
        : t >= inSpan + loopSpan
          ? { kind: 'out' as const, elapsedSec: t - inSpan - loopSpan }
          : null
      return { phase, anim }
    }
  }
}
