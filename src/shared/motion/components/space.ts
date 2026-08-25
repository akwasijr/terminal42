// Space: a starfield of cards streaming out of the distance toward the camera.
//
// Every card walks the same depth corridor on a private clock, hashed so the
// field never pulses in unison. Depth is a wrapped fraction with a whole number
// of passes per loop, and a card is faded to nothing both at the far plane it
// spawns on and the near plane it exits through — so the instant it recycles
// from front to back happens entirely out of sight.

import type { CardPlacement, MotionComponent, ParamSpec, ParamValue } from '../types'
import { clamp01, directionSign, hash01, lerp, num, restingPlacement, wrap01 } from '../math'

const schema: ParamSpec[] = [
  { kind: 'slider', key: 'cards', label: 'Cards', min: 1, max: 120, step: 1, default: 40, precision: 0 },
  { kind: 'slider', key: 'cardScale', label: 'Card scale', min: 0.05, max: 2, step: 0.01, default: 0.5, precision: 2 },
  { kind: 'slider', key: 'spread', label: 'Spread', min: 1, max: 16, step: 0.1, default: 8, precision: 1 },
  { kind: 'slider', key: 'depthRange', label: 'Depth range', min: 4, max: 40, step: 0.5, default: 22, precision: 1 },
  { kind: 'slider', key: 'speed', label: 'Speed', min: 1, max: 6, step: 1, default: 1, precision: 0, unit: '×' },
  {
    kind: 'segmented',
    key: 'direction',
    label: 'Direction',
    options: [{ value: 'forward', label: 'Toward' }, { value: 'reverse', label: 'Away' }],
    default: 'forward'
  }
]

function count(params: Record<string, ParamValue>): number {
  return Math.max(1, Math.round(num(params, 'cards', 40)))
}

function layout(
  phase: number,
  index: number,
  _total: number,
  params: Record<string, ParamValue>
): CardPlacement {
  const dir = directionSign(params)
  const passes = Math.max(1, Math.round(num(params, 'speed', 1)))

  // The card's progress down the corridor, 0 at the far plane and 1 at the
  // camera, offset per card and wrapped so the loop closes on whole passes.
  const t = wrap01(passes * wrap01(phase) * dir + hash01(index * 1.7))

  const spread = num(params, 'spread', 8)
  const p = restingPlacement()
  // Fixed screen bearings so a star always returns along the same line of sight.
  p.x = (hash01(index * 3.3) - 0.5) * spread * 2
  p.y = (hash01(index * 6.1) - 0.5) * spread * 2

  const depthRange = num(params, 'depthRange', 22)
  p.z = lerp(-depthRange, 2, t)

  // Nearer cards are larger, which supplies the sense of rushing forward.
  p.scale = num(params, 'cardScale', 0.5) * lerp(0.3, 1.6, t)

  // Transparent at both planes, so spawning far and exiting near are equally
  // unseen and the recycle leaves no flicker.
  p.opacity = clamp01(t / 0.12) * clamp01((1 - t) / 0.12)

  return p
}

export const space: MotionComponent = {
  id: 'space',
  label: 'Space',
  cardCount: count,
  schema,
  layout
}
