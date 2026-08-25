// Carousel: cards ranged around a vertical axis, spinning as one body.
//
// This is the component the whole contract was designed against, so it is the
// place to look for how a generator is meant to be written. Two things matter:
//
//   - Every angle is derived from `phase`, never accumulated. A running angle
//     would drift by a fraction of a degree per frame and the loop would not
//     close.
//   - "Step" mode reuses the same layout as "Continuous"; only the source of
//     the rotation offset changes. Two code paths would eventually disagree
//     about where card 3 is.

import type { CardPlacement, MotionComponent, ParamSpec, ParamValue } from '../types'
import {
  TAU, bool, directionSign, hash01, num, rad, restingPlacement, steppedPosition, str, wrap01
} from '../math'

const schema: ParamSpec[] = [
  { kind: 'slider', key: 'cards', label: 'Cards', min: 1, max: 60, step: 1, default: 10, precision: 0 },
  { kind: 'slider', key: 'cardScale', label: 'Card scale', min: 0.1, max: 4, step: 0.01, default: 1, precision: 2 },
  { kind: 'slider', key: 'rows', label: 'Rows', min: 1, max: 8, step: 1, default: 1, precision: 0 },
  { kind: 'slider', key: 'radius', label: 'Radius', min: 0, max: 12, step: 0.05, default: 4.5, precision: 2 },
  { kind: 'slider', key: 'ramp', label: 'Ramp amount', min: 0, max: 4, step: 0.01, default: 0, precision: 2 },
  { kind: 'slider', key: 'staggerRadial', label: 'Stagger radial', min: -2, max: 2, step: 0.01, default: 0, precision: 2 },
  { kind: 'slider', key: 'staggerVertical', label: 'Stagger vertical', min: -2, max: 2, step: 0.01, default: 0, precision: 2 },
  {
    kind: 'segmented',
    key: 'imageOrder',
    label: 'Image order',
    options: [{ value: 'in-order', label: 'In order' }, { value: 'scatter', label: 'Scatter' }],
    default: 'in-order'
  },
  {
    kind: 'segmented',
    key: 'type',
    label: 'Type',
    options: [{ value: 'continuous', label: 'Continuous' }, { value: 'step', label: 'Step' }],
    default: 'continuous'
  },
  {
    kind: 'segmented',
    key: 'spinAxis',
    label: 'Spin axis',
    options: [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }, { value: 'z', label: 'Z' }],
    default: 'y'
  },
  { kind: 'slider', key: 'speed', label: 'Speed', min: 0, max: 4, step: 0.01, default: 0.35, precision: 2, zeroLabel: 'still' },
  { kind: 'slider', key: 'bend', label: 'Bend', min: 0, max: 90, step: 1, default: 0, precision: 0, unit: '°', zeroLabel: 'none' },
  {
    kind: 'segmented',
    key: 'bendAxis',
    label: 'Bend axis',
    options: [
      { value: 'auto', label: 'Auto' },
      { value: 'vertical', label: 'Vertical' },
      { value: 'horizontal', label: 'Horizontal' }
    ],
    default: 'vertical'
  },
  { kind: 'toggle', key: 'bendAlways', label: 'Bend always', default: false },
  {
    kind: 'segmented',
    key: 'direction',
    label: 'Direction',
    options: [{ value: 'forward', label: 'Forward' }, { value: 'reverse', label: 'Reverse' }],
    default: 'forward'
  },
  { kind: 'slider', key: 'hold', label: 'Hold', min: 0, max: 4, step: 0.1, default: 1, precision: 1, unit: 's' },
  { kind: 'slider', key: 'transition', label: 'Transition', min: 0.1, max: 4, step: 0.05, default: 0.6, precision: 2, unit: 's' }
]

function count(params: Record<string, ParamValue>): number {
  return Math.max(1, Math.round(num(params, 'cards', 10)) * Math.max(1, Math.round(num(params, 'rows', 1))))
}

function layout(
  phase: number,
  index: number,
  total: number,
  params: Record<string, ParamValue>
): CardPlacement {
  const perRow = Math.max(1, Math.round(num(params, 'cards', 10)))
  const rows = Math.max(1, Math.round(num(params, 'rows', 1)))
  const col = index % perRow
  const row = Math.floor(index / perRow) % rows

  const radius = num(params, 'radius', 4.5)
  const speed = num(params, 'speed', 0.35)
  const dir = directionSign(params)
  const stepped = str(params, 'type', 'continuous') === 'step'

  // Turns completed over one loop. Rounded so the body always ends where it
  // started: a speed of 0.35 that produced 0.35 of a turn would jump at the
  // seam, and the jump is exactly the artefact this feature must not have.
  const turns = Math.max(1, Math.round(speed * 4))
  const spin = stepped
    ? (steppedPosition(phase, perRow, num(params, 'hold', 1), num(params, 'transition', 0.6)) / perRow) * TAU * dir
    : wrap01(phase) * TAU * turns * dir * (speed > 0 ? 1 : 0)

  const angle = (col / perRow) * TAU + spin

  const ramp = num(params, 'ramp', 0)
  const staggerRadial = num(params, 'staggerRadial', 0)
  const staggerVertical = num(params, 'staggerVertical', 0)
  // Stagger is deliberately per-card noise rather than a wave: the design
  // calls it "stagger", and a wave would read as a second, competing rotation.
  const jitter = hash01(index * 3.7) - 0.5

  const r = radius + row * 0.9 + staggerRadial * jitter * 2
  const axis = str(params, 'spinAxis', 'y')

  const p = restingPlacement()
  const rowLift = (row - (rows - 1) / 2) * 1.4
  const lift = rowLift + ramp * Math.sin(angle) + staggerVertical * jitter * 2

  if (axis === 'y') {
    p.x = Math.sin(angle) * r
    p.z = Math.cos(angle) * r
    p.y = lift
    p.rotY = angle
  } else if (axis === 'x') {
    p.y = Math.sin(angle) * r + rowLift
    p.z = Math.cos(angle) * r
    p.x = lift - rowLift
    p.rotX = -angle
  } else {
    p.x = Math.sin(angle) * r
    p.y = Math.cos(angle) * r + rowLift
    p.rotZ = -angle
  }

  p.scale = num(params, 'cardScale', 1)

  const bend = rad(num(params, 'bend', 0))
  if (bend !== 0) {
    // "Bend always" curves every card; otherwise the curve eases off as a card
    // turns away from the camera, which is what keeps the ring reading as a
    // ring rather than a bag of curved sheets.
    const facing = bool(params, 'bendAlways', false) ? 1 : Math.max(0, Math.cos(angle))
    p.bend = bend * facing
    const bendAxis = str(params, 'bendAxis', 'vertical')
    p.bendAxis = bendAxis === 'horizontal' ? 'horizontal' : bendAxis === 'auto' && axis !== 'y' ? 'horizontal' : 'vertical'
  }

  return p
}

export const carousel: MotionComponent = {
  id: 'carousel',
  label: 'Carousel',
  cardCount: count,
  schema,
  layout
}
