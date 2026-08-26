// Column: cards climbing a helix, like a spiral stair seen from the side.
//
// Elevator already runs cards straight up a shaft, so this one gives the shaft
// a twist: height and angle both come from the same travelling parameter, which
// is what makes the path a helix rather than a stack of separate rings.
//
// The wrap is the same trick Elevator uses — cards are evenly spread along the
// path and the whole set advances by a whole number of card pitches per loop,
// so the card falling off the top is precisely the one arriving at the bottom
// and no fade is needed to hide the join.

import type { CardPlacement, MotionComponent, ParamSpec, ParamValue } from '../types'
import { TAU, directionSign, lerp, num, rad, restingPlacement, str, wrap01 } from '../math'

const schema: ParamSpec[] = [
  { kind: 'slider', key: 'cards', label: 'Cards', min: 1, max: 60, step: 1, default: 14, precision: 0 },
  { kind: 'slider', key: 'cardScale', label: 'Card scale', min: 0.1, max: 4, step: 0.01, default: 0.8, precision: 2 },
  { kind: 'slider', key: 'radius', label: 'Radius', min: 0, max: 10, step: 0.05, default: 3, precision: 2 },
  { kind: 'slider', key: 'pitch', label: 'Rise', min: 0.2, max: 3, step: 0.01, default: 0.9, precision: 2 },
  { kind: 'slider', key: 'twist', label: 'Turns', min: 0.25, max: 6, step: 0.25, default: 2, precision: 2 },
  { kind: 'slider', key: 'taper', label: 'Taper', min: 0.1, max: 2, step: 0.01, default: 1, precision: 2, zeroLabel: 'none' },
  { kind: 'slider', key: 'speed', label: 'Speed', min: 0, max: 6, step: 1, default: 1, precision: 0, unit: '×', zeroLabel: 'still' },
  { kind: 'slider', key: 'lean', label: 'Lean', min: -45, max: 45, step: 1, default: 0, precision: 0, unit: '°', zeroLabel: 'none' },
  {
    kind: 'segmented',
    key: 'facing',
    label: 'Facing',
    options: [{ value: 'outward', label: 'Outward' }, { value: 'camera', label: 'Camera' }],
    default: 'outward'
  },
  {
    kind: 'segmented',
    key: 'direction',
    label: 'Direction',
    options: [{ value: 'forward', label: 'Up' }, { value: 'reverse', label: 'Down' }],
    default: 'forward'
  }
]

function count(params: Record<string, ParamValue>): number {
  return Math.max(1, Math.round(num(params, 'cards', 14)))
}

function layout(
  phase: number,
  index: number,
  _total: number,
  params: Record<string, ParamValue>
): CardPlacement {
  const cards = count(params)
  const dir = directionSign(params)
  // Whole pitches per loop: a fractional advance would leave the helix a part
  // of a card out of step with itself at the seam.
  const passes = Math.max(0, Math.round(num(params, 'speed', 1)))

  // Where this card sits along the helix, wrapped so it re-enters at the foot.
  const u = wrap01(index / cards + passes * wrap01(phase) * dir)

  const twist = num(params, 'twist', 2)
  const angle = u * TAU * twist

  // Taper is applied along the climb, so the column can open out or close in.
  const radius = num(params, 'radius', 3) * lerp(1, num(params, 'taper', 1), u)

  const p = restingPlacement()
  p.x = Math.sin(angle) * radius
  p.z = Math.cos(angle) * radius
  p.y = (u - 0.5) * cards * num(params, 'pitch', 0.9)

  if (str(params, 'facing', 'outward') === 'outward') p.rotY = angle
  p.rotX = rad(num(params, 'lean', 0))

  p.scale = num(params, 'cardScale', 0.8)

  return p
}

export const column: MotionComponent = {
  id: 'column',
  label: 'Column',
  cardCount: count,
  schema,
  layout
}
