// Slider: a line of cards marching past a fixed camera, biggest at the centre.
//
// The whole component is one conveyor. Rather than move each card and recycle
// it with a branch, every card owns a fraction of the track and that fraction
// advances with `phase`; the card that walks off one end is simply the one
// whose fraction wrapped. That keeps the motion a pure function and lets the
// recycle happen at a point where the card has already faded to nothing, so
// the wrap is never seen. "Stepped" and "Continuous" differ only in what feeds
// the advance, exactly as Carousel does, so the two modes cannot disagree.

import type { CardPlacement, MotionComponent, ParamSpec, ParamValue } from '../types'
import { TAU, clamp01, directionSign, hash01, num, rad, restingPlacement, steppedPosition, str, wrap01 } from '../math'

const schema: ParamSpec[] = [
  { kind: 'slider', key: 'cards', label: 'Cards', min: 1, max: 40, step: 1, default: 6, precision: 0 },
  { kind: 'slider', key: 'cardScale', label: 'Card scale', min: 0.1, max: 4, step: 0.01, default: 1.47, precision: 2 },
  { kind: 'slider', key: 'gap', label: 'Gap', min: 0.4, max: 4, step: 0.01, default: 1.1, precision: 2 },
  { kind: 'slider', key: 'stagger', label: 'Stagger', min: 0, max: 3, step: 0.01, default: 0, precision: 2, zeroLabel: 'none' },
  { kind: 'slider', key: 'depth', label: 'Depth', min: 0, max: 6, step: 0.01, default: 1.3, precision: 2, zeroLabel: 'flat' },
  { kind: 'slider', key: 'spinX', label: 'Spin X', min: 0, max: 180, step: 1, default: 0, precision: 0, unit: '°', zeroLabel: 'none' },
  { kind: 'slider', key: 'spinY', label: 'Spin Y', min: 0, max: 180, step: 1, default: 0, precision: 0, unit: '°', zeroLabel: 'none' },
  { kind: 'slider', key: 'spinZ', label: 'Spin Z', min: 0, max: 180, step: 1, default: 0, precision: 0, unit: '°', zeroLabel: 'none' },
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
  { kind: 'slider', key: 'stepSize', label: 'Step size', min: 1, max: 6, step: 1, default: 3, precision: 0, unit: '×' },
  {
    kind: 'segmented',
    key: 'direction',
    label: 'Direction',
    options: [{ value: 'forward', label: 'Forward' }, { value: 'reverse', label: 'Reverse' }],
    default: 'forward'
  },
  { kind: 'slider', key: 'hold', label: 'Hold', min: 0, max: 4, step: 0.1, default: 1, precision: 1, unit: 's' },
  { kind: 'slider', key: 'transition', label: 'Transition', min: 0.1, max: 4, step: 0.05, default: 3, precision: 2, unit: 's' },
  { kind: 'slider', key: 'drift', label: 'Drift', min: 0, max: 40, step: 1, default: 7, precision: 0, unit: '%', zeroLabel: 'none' }
]

function count(params: Record<string, ParamValue>): number {
  return Math.max(1, Math.round(num(params, 'cards', 6)))
}

function layout(
  phase: number,
  index: number,
  _total: number,
  params: Record<string, ParamValue>
): CardPlacement {
  const cards = Math.max(1, Math.round(num(params, 'cards', 6)))
  const dir = directionSign(params)
  const stepped = str(params, 'mode', 'continuous') === 'stepped'
  // Cycles per loop is forced to a whole number so the conveyor lands back on
  // its start; a fractional advance would jump at the seam.
  const cycles = Math.max(1, Math.round(num(params, 'stepSize', 3)))
  const steps = cards * cycles

  const advance = stepped
    ? steppedPosition(phase, steps, num(params, 'hold', 1), num(params, 'transition', 3)) * dir
    : wrap01(phase) * steps * dir

  // Each card's place on the track. Adding the whole-number advance and
  // wrapping means phase 0 and phase 1 resolve to the same fraction.
  const f = wrap01((index + advance) / cards)

  // Distance from the centre of the visible line, 1 at the centre and 0 at the
  // wrap point, so size, depth and opacity all key off the same quantity.
  const centreness = 1 - Math.abs(f - 0.5) * 2

  const span = cards * num(params, 'gap', 1.1)
  const along = (f - 0.5) * span

  const stagger = num(params, 'stagger', 0)
  const drift = num(params, 'drift', 0) / 100
  const cross =
    stagger * (hash01(index * 7.3) - 0.5) * 2 +
    // A slow wobble that completes whole cycles over the loop, kept alive at
    // both ends by the integer cycle count.
    drift * Math.sin(TAU * cycles * wrap01(phase) + hash01(index) * TAU)

  const p = restingPlacement()
  if (str(params, 'axis', 'horizontal') === 'vertical') {
    p.y = along
    p.x = cross
  } else {
    p.x = along
    p.y = cross
  }

  // The recycle is invisible because a card is already transparent by the time
  // its fraction wraps from the far edge back to the near one.
  const edge = Math.min(f, 1 - f)
  p.opacity = clamp01(edge / 0.12)

  p.z = -num(params, 'depth', 1.3) * (1 - centreness)
  p.scale = num(params, 'cardScale', 1.47) * (0.6 + 0.4 * centreness)

  const twist = f * cards
  p.rotX = rad(num(params, 'spinX', 0)) * twist
  p.rotY = rad(num(params, 'spinY', 0)) * twist
  p.rotZ = rad(num(params, 'spinZ', 0)) * twist

  return p
}

export const slider: MotionComponent = {
  id: 'slider',
  label: 'Slider',
  cardCount: count,
  schema,
  layout
}
