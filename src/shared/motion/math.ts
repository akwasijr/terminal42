// The small amount of maths every component needs, in one place.
//
// Most of these exist to keep a generator honest about looping. A component
// that reaches for `Math.random()` or accumulates a running angle will drift,
// and the seam only shows up in an exported video — after the render, when it
// is expensive to notice. So randomness here is seeded and repeatable, and
// anything periodic is expressed in whole turns of the loop.

import type { CardPlacement, ParamValue } from './types'

export const TAU = Math.PI * 2

/** Degrees to radians, because every schema is authored in degrees. */
export const rad = (deg: number): number => (deg * Math.PI) / 180

export function num(params: Record<string, ParamValue>, key: string, fallback: number): number {
  const v = params[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

export function str(params: Record<string, ParamValue>, key: string, fallback: string): string {
  const v = params[key]
  return typeof v === 'string' ? v : fallback
}

export function bool(params: Record<string, ParamValue>, key: string, fallback: boolean): boolean {
  const v = params[key]
  return typeof v === 'boolean' ? v : fallback
}

/** Wrap into [0, 1). Negative phases wrap the same way, so reverse works. */
export function wrap01(t: number): number {
  const r = t % 1
  return r < 0 ? r + 1 : r
}

/** Wrap into [-0.5, 0.5): the shortest signed distance from the loop start. */
export function wrapSigned(t: number): number {
  return wrap01(t + 0.5) - 0.5
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v))

export const clamp01 = (v: number): number => clamp(v, 0, 1)

/**
 * Deterministic noise in [0, 1) from an integer.
 *
 * Scatter and drift need to look arbitrary but must be identical on every
 * render, or an exported frame would not match the frame the user approved on
 * screen. A hash of the index gives both.
 */
export function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** A repeatable pseudo-shuffle of 0..n-1, used by "Scatter" image order. */
export function scatterOrder(n: number, seed = 1): number[] {
  const out = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(hash01(i * 7 + seed * 13) * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Smooth 0 → 1 → 0 over one loop, peaking at phase 0.5.
 *
 * Written as a cosine rather than a triangle so the value and its slope both
 * match at the seam; a triangle wave loops in position but visibly kinks.
 */
export function pulse(phase: number): number {
  return 0.5 - 0.5 * Math.cos(wrap01(phase) * TAU)
}

/**
 * A stepped loop: `steps` holds separated by eased transitions.
 *
 * Returns the continuous position within the sequence, so a "stepped" slider
 * and a "continuous" one can share the same layout code — the only difference
 * is which of these two functions produced the offset. `hold` and `transition`
 * are relative durations; they are normalised, so the pattern always completes
 * in exactly one loop and the seam closes.
 */
export function steppedPosition(phase: number, steps: number, hold: number, transition: number): number {
  if (steps <= 0) return 0
  const unit = Math.max(1e-6, hold + transition)
  const p = wrap01(phase) * steps
  const step = Math.floor(p)
  const within = (p - step) * unit
  if (within <= hold) return step
  const t = clamp01((within - hold) / Math.max(1e-6, transition))
  return step + easeInOutCubic(t)
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * Sample a cubic-bezier easing the way CSS does.
 *
 * Newton-Raphson with a bisection fallback: the curve editor lets control
 * points sit almost vertically, where Newton alone stalls and would quietly
 * return the wrong time.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number, t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sampleX = (u: number): number => ((ax * u + bx) * u + cx) * u
  const slopeX = (u: number): number => (3 * ax * u + 2 * bx) * u + cx

  let u = t
  for (let i = 0; i < 8; i++) {
    const x = sampleX(u) - t
    if (Math.abs(x) < 1e-6) break
    const d = slopeX(u)
    if (Math.abs(d) < 1e-6) break
    u -= x / d
  }
  if (u < 0 || u > 1) {
    let lo = 0
    let hi = 1
    u = t
    for (let i = 0; i < 24; i++) {
      const x = sampleX(u)
      if (Math.abs(x - t) < 1e-6) break
      if (x < t) lo = u
      else hi = u
      u = (lo + hi) / 2
    }
  }
  return ((ay * u + by) * u + cy) * u
}

/** A placement with everything neutral, for components to spread over. */
export function restingPlacement(): CardPlacement {
  return { x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1, opacity: 1, bend: 0, bendAxis: 'vertical' }
}

/**
 * Direction as a multiplier.
 *
 * Reverse is -1 rather than a separate code path, so a reversed loop is the
 * same loop and cannot drift apart from the forward one.
 */
export function directionSign(params: Record<string, ParamValue>, key = 'direction'): number {
  return str(params, key, 'forward') === 'reverse' ? -1 : 1
}
