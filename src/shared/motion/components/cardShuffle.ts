// Card shuffle: a tight stack whose front card arcs out and returns to the back.
//
// The trick that makes this loop is to treat the stack as a closed orbit. Each
// card sits at an angle on a flattened ellipse; the angle advances with phase,
// so a card that swings out along the wide part of the ellipse is carried all
// the way round and re-enters behind the others. Because the cards are evenly
// spaced in angle, one full turn of the orbit is exactly `images` shuffles, and
// an orbit closes on itself by construction.

import type { CardPlacement, MotionComponent, ParamSpec, ParamValue } from '../types'
import { TAU, directionSign, hash01, num, restingPlacement, steppedPosition, str, wrap01 } from '../math'

const schema: ParamSpec[] = [
  {
    kind: 'segmented',
    key: 'images',
    label: 'Images',
    options: [{ value: '3', label: '3' }, { value: '5', label: '5' }, { value: '7', label: '7' }],
    default: '5'
  },
  { kind: 'slider', key: 'cardScale', label: 'Card scale', min: 0.5, max: 6, step: 0.01, default: 3.5, precision: 2 },
  { kind: 'slider', key: 'stagger', label: 'Stagger', min: 0, max: 2, step: 0.01, default: 0, precision: 2, zeroLabel: 'none' },
  { kind: 'slider', key: 'depth', label: 'Depth', min: 0, max: 4, step: 0.01, default: 1, precision: 2, zeroLabel: 'flat' },
  {
    kind: 'segmented',
    key: 'axis',
    label: 'Axis',
    options: [{ value: 'horizontal', label: 'Horizontal' }, { value: 'vertical', label: 'Vertical' }],
    default: 'horizontal'
  },
  {
    kind: 'segmented',
    key: 'mode',
    label: 'Mode',
    options: [{ value: 'continuous', label: 'Continuous' }, { value: 'stepped', label: 'Stepped' }],
    default: 'continuous'
  },
  { kind: 'slider', key: 'stepSize', label: 'Step size', min: 1, max: 4, step: 1, default: 1, precision: 0, unit: '×' },
  {
    kind: 'segmented',
    key: 'direction',
    label: 'Direction',
    options: [{ value: 'forward', label: 'Forward' }, { value: 'reverse', label: 'Reverse' }],
    default: 'forward'
  },
  { kind: 'slider', key: 'hold', label: 'Hold', min: 0, max: 4, step: 0.1, default: 1, precision: 1, unit: 's' },
  { kind: 'slider', key: 'transition', label: 'Transition', min: 0.1, max: 4, step: 0.05, default: 1, precision: 2, unit: 's' },
  { kind: 'slider', key: 'drift', label: 'Drift', min: 0, max: 40, step: 1, default: 10, precision: 0, unit: '%', zeroLabel: 'none' }
]

function imageCount(params: Record<string, ParamValue>): number {
  return Math.max(1, Math.round(Number(str(params, 'images', '5'))))
}

function count(params: Record<string, ParamValue>): number {
  return imageCount(params)
}

function layout(
  phase: number,
  index: number,
  _total: number,
  params: Record<string, ParamValue>
): CardPlacement {
  const n = imageCount(params)
  const dir = directionSign(params)
  const stepped = str(params, 'mode', 'continuous') === 'stepped'
  const cycles = Math.max(1, Math.round(num(params, 'stepSize', 1)))

  // Turns of the orbit over one loop. A whole number guarantees each card lands
  // back on its own start; every turn contributes `n` shuffles.
  const turnsSteps = n * cycles
  const g = stepped
    ? steppedPosition(phase, turnsSteps, num(params, 'hold', 1), num(params, 'transition', 1)) / n
    : wrap01(phase) * cycles

  const t = wrap01(index / n - g * dir)
  const theta = t * TAU

  const swing = 2.2 + num(params, 'stagger', 0)
  const along = Math.sin(theta) * swing
  // The far side of the ellipse is pushed back and shrunk, which is what reads
  // as a card passing behind the stack rather than in front of it.
  const back = (1 - Math.cos(theta)) * 0.5

  const drift = num(params, 'drift', 0) / 100
  const wobble = drift * Math.sin(TAU * cycles * wrap01(phase) + hash01(index) * TAU)

  const p = restingPlacement()
  if (str(params, 'axis', 'horizontal') === 'vertical') {
    p.y = along
    p.x = wobble
  } else {
    p.x = along
    p.y = wobble
  }

  p.z = -num(params, 'depth', 1) * back * 3
  p.scale = num(params, 'cardScale', 3.5) * (1 - 0.18 * back)
  p.rotZ = Math.sin(theta) * 0.15

  return p
}

export const cardShuffle: MotionComponent = {
  id: 'card-shuffle',
  label: 'Card shuffle',
  cardCount: count,
  schema,
  layout
}
