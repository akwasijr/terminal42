// Ring: cards laid flat around a circle, facing the camera.
//
// Where Carousel wraps cards around a cylinder seen edge-on, Ring keeps every
// card parallel to the frame, so what changes around the circle is position,
// size and — with several rings — depth. That is why it can look like a dial,
// a wreath, or a spiral of confetti depending on four numbers.

import type { CardPlacement, MotionComponent, ParamSpec, ParamValue } from '../types'
import {
  TAU, directionSign, hash01, num, rad, restingPlacement, steppedPosition, str, wrap01, pulse
} from '../math'

const schema: ParamSpec[] = [
  { kind: 'slider', key: 'cards', label: 'Cards', min: 1, max: 80, step: 1, default: 12, precision: 0 },
  { kind: 'slider', key: 'rings', label: 'Rings', min: 1, max: 6, step: 1, default: 1, precision: 0 },
  { kind: 'slider', key: 'cardScale', label: 'Card scale', min: 0.05, max: 4, step: 0.01, default: 0.7, precision: 2 },
  { kind: 'slider', key: 'radius', label: 'Radius', min: 0.5, max: 12, step: 0.05, default: 3.2, precision: 2 },
  { kind: 'slider', key: 'ringGap', label: 'Ring gap', min: 0.2, max: 4, step: 0.05, default: 1.2, precision: 2 },
  { kind: 'slider', key: 'arc', label: 'Arc', min: 30, max: 360, step: 1, default: 360, precision: 0, unit: '°' },
  { kind: 'slider', key: 'spiral', label: 'Spiral', min: 0, max: 3, step: 0.01, default: 0, precision: 2, zeroLabel: 'none' },
  { kind: 'slider', key: 'sizeFalloff', label: 'Size falloff', min: 0, max: 1, step: 0.01, default: 0, precision: 2, zeroLabel: 'none' },
  { kind: 'slider', key: 'jitter', label: 'Jitter', min: 0, max: 2, step: 0.01, default: 0, precision: 2, zeroLabel: 'none' },
  { kind: 'toggle', key: 'faceCentre', label: 'Point at centre', default: false },
  {
    kind: 'segmented',
    key: 'type',
    label: 'Type',
    options: [{ value: 'continuous', label: 'Continuous' }, { value: 'step', label: 'Step' }],
    default: 'continuous'
  },
  { kind: 'slider', key: 'speed', label: 'Speed', min: 0, max: 4, step: 0.01, default: 0.4, precision: 2, zeroLabel: 'still' },
  { kind: 'slider', key: 'breathe', label: 'Breathe', min: 0, max: 1, step: 0.01, default: 0, precision: 2, zeroLabel: 'none' },
  {
    kind: 'segmented',
    key: 'direction',
    label: 'Direction',
    options: [{ value: 'forward', label: 'Forward' }, { value: 'reverse', label: 'Reverse' }],
    default: 'forward'
  },
  { kind: 'slider', key: 'hold', label: 'Hold', min: 0, max: 4, step: 0.1, default: 0.8, precision: 1, unit: 's' },
  { kind: 'slider', key: 'transition', label: 'Transition', min: 0.1, max: 4, step: 0.05, default: 0.5, precision: 2, unit: 's' }
]

function count(params: Record<string, ParamValue>): number {
  return Math.max(1, Math.round(num(params, 'cards', 12)) * Math.max(1, Math.round(num(params, 'rings', 1))))
}

function layout(
  phase: number,
  index: number,
  _total: number,
  params: Record<string, ParamValue>
): CardPlacement {
  const perRing = Math.max(1, Math.round(num(params, 'cards', 12)))
  const rings = Math.max(1, Math.round(num(params, 'rings', 1)))
  const slot = index % perRing
  const ring = Math.floor(index / perRing) % rings

  const dir = directionSign(params)
  const speed = num(params, 'speed', 0.4)
  const stepped = str(params, 'type', 'continuous') === 'step'
  const turns = Math.max(1, Math.round(speed * 4))
  const spin = stepped
    ? (steppedPosition(phase, perRing, num(params, 'hold', 0.8), num(params, 'transition', 0.5)) / perRing) * TAU * dir
    : wrap01(phase) * TAU * turns * dir * (speed > 0 ? 1 : 0)

  const arc = rad(num(params, 'arc', 360))
  // A full circle divides by the card count; a partial arc divides by the gaps
  // between cards, so both ends of the arc actually carry a card.
  const spread = arc >= TAU - 1e-6 ? arc / perRing : perRing > 1 ? arc / (perRing - 1) : 0
  const angle = slot * spread + spin

  const jitterAmount = num(params, 'jitter', 0)
  const jitterR = (hash01(index * 5.1) - 0.5) * jitterAmount
  const jitterA = (hash01(index * 9.3) - 0.5) * jitterAmount * 0.4

  const breathe = num(params, 'breathe', 0)
  const breatheScale = 1 + breathe * (pulse(phase) - 0.5)

  const radius =
    num(params, 'radius', 3.2) +
    ring * num(params, 'ringGap', 1.2) +
    num(params, 'spiral', 0) * (slot / perRing) +
    jitterR

  const p = restingPlacement()
  p.x = Math.sin(angle + jitterA) * radius * breatheScale
  p.y = Math.cos(angle + jitterA) * radius * breatheScale
  p.z = ring * -0.35

  const falloff = num(params, 'sizeFalloff', 0)
  // Cards shrink with distance from the first ring, which is what turns a flat
  // wreath into something that reads as receding.
  const shrink = 1 - falloff * (ring / Math.max(1, rings - 1 || 1))
  p.scale = num(params, 'cardScale', 0.7) * shrink * breatheScale

  if (params.faceCentre === true) p.rotZ = -angle

  return p
}

export const ring: MotionComponent = {
  id: 'ring',
  label: 'Ring',
  cardCount: count,
  schema,
  layout
}
