// Elevator: a vertical column of cards riding upward and wrapping round.
//
// This is the plainest possible conveyor and it leans on that: cards are evenly
// spaced up a fixed height, the whole set slides by a whole number of card
// pitches per loop, and a card that passes the top edge is the one re-entering
// at the bottom. Even spacing plus a whole-pitch advance means the wrap is
// seamless without any fade, the way a well-cut loop of film has no join.

import type { CardPlacement, MotionComponent, ParamSpec, ParamValue } from '../types'
import { directionSign, num, rad, restingPlacement, wrap01 } from '../math'

const schema: ParamSpec[] = [
  { kind: 'slider', key: 'cards', label: 'Cards', min: 1, max: 40, step: 1, default: 8, precision: 0 },
  { kind: 'slider', key: 'cardScale', label: 'Card scale', min: 0.1, max: 4, step: 0.01, default: 1, precision: 2 },
  { kind: 'slider', key: 'gap', label: 'Gap', min: 0.6, max: 4, step: 0.01, default: 1.6, precision: 2 },
  { kind: 'slider', key: 'offsetX', label: 'Side offset', min: 0, max: 5, step: 0.01, default: 0, precision: 2, zeroLabel: 'none' },
  { kind: 'slider', key: 'tilt', label: 'Tilt', min: 0, max: 45, step: 1, default: 0, precision: 0, unit: '°', zeroLabel: 'none' },
  { kind: 'slider', key: 'depth', label: 'Depth', min: 0, max: 6, step: 0.01, default: 0, precision: 2, zeroLabel: 'flat' },
  { kind: 'slider', key: 'speed', label: 'Speed', min: 1, max: 6, step: 1, default: 1, precision: 0, unit: '×' },
  {
    kind: 'segmented',
    key: 'direction',
    label: 'Direction',
    options: [{ value: 'forward', label: 'Up' }, { value: 'reverse', label: 'Down' }],
    default: 'forward'
  }
]

function count(params: Record<string, ParamValue>): number {
  return Math.max(1, Math.round(num(params, 'cards', 8)))
}

function layout(
  phase: number,
  index: number,
  _total: number,
  params: Record<string, ParamValue>
): CardPlacement {
  const cards = Math.max(1, Math.round(num(params, 'cards', 8)))
  const dir = directionSign(params)
  const passes = Math.max(1, Math.round(num(params, 'speed', 1)))
  const gap = num(params, 'gap', 1.6)

  const u = wrap01(index / cards + passes * wrap01(phase) * dir)
  const height = cards * gap

  const p = restingPlacement()
  p.y = (u - 0.5) * height

  // Cards alternate to left and right of the shaft, which reads as a lift with
  // two files rather than a single stack; the parity is a fixed card property.
  const side = index % 2 === 0 ? 1 : -1
  p.x = side * num(params, 'offsetX', 0)
  p.z = side * num(params, 'depth', 0)
  p.rotY = rad(num(params, 'tilt', 0)) * side

  p.scale = num(params, 'cardScale', 1)

  return p
}

export const elevator: MotionComponent = {
  id: 'elevator',
  label: 'Elevator',
  cardCount: count,
  schema,
  layout
}
