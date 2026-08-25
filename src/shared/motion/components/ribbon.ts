// Ribbon: cards threaded along a flowing sine ribbon that drifts through the scene.
//
// The ribbon is a helix seen side-on: horizontal position spans a fixed length,
// while height and depth trace a sine and cosine of the same travelling phase.
// Wavelength is counted in whole cycles across the ribbon so the two ends meet,
// and both the travel and the accumulating twist are driven by a wrapped
// fraction, so a card handed off the end re-enters at the start with the same
// pose. Nothing is integrated frame to frame, so nothing drifts.

import type { CardPlacement, MotionComponent, ParamSpec, ParamValue } from '../types'
import { TAU, directionSign, num, rad, restingPlacement, wrap01 } from '../math'

const schema: ParamSpec[] = [
  { kind: 'slider', key: 'cards', label: 'Cards', min: 1, max: 60, step: 1, default: 16, precision: 0 },
  { kind: 'slider', key: 'cardScale', label: 'Card scale', min: 0.1, max: 3, step: 0.01, default: 0.8, precision: 2 },
  { kind: 'slider', key: 'length', label: 'Length', min: 4, max: 20, step: 0.1, default: 14, precision: 1 },
  { kind: 'slider', key: 'amplitude', label: 'Amplitude', min: 0, max: 6, step: 0.01, default: 2, precision: 2, zeroLabel: 'flat' },
  { kind: 'slider', key: 'wavelength', label: 'Wavelength', min: 1, max: 6, step: 1, default: 2, precision: 0, unit: '×' },
  { kind: 'slider', key: 'twist', label: 'Twist', min: 0, max: 180, step: 1, default: 0, precision: 0, unit: '°', zeroLabel: 'none' },
  { kind: 'slider', key: 'depth', label: 'Helix depth', min: 0, max: 6, step: 0.01, default: 1.5, precision: 2, zeroLabel: 'flat' },
  { kind: 'slider', key: 'speed', label: 'Speed', min: 1, max: 6, step: 1, default: 1, precision: 0, unit: '×' },
  {
    kind: 'segmented',
    key: 'direction',
    label: 'Direction',
    options: [{ value: 'forward', label: 'Forward' }, { value: 'reverse', label: 'Reverse' }],
    default: 'forward'
  }
]

function count(params: Record<string, ParamValue>): number {
  return Math.max(1, Math.round(num(params, 'cards', 16)))
}

function layout(
  phase: number,
  index: number,
  _total: number,
  params: Record<string, ParamValue>
): CardPlacement {
  const cards = Math.max(1, Math.round(num(params, 'cards', 16)))
  const dir = directionSign(params)
  const passes = Math.max(1, Math.round(num(params, 'speed', 1)))
  const waves = Math.max(1, Math.round(num(params, 'wavelength', 2)))

  // Progress along the ribbon, wrapped so a card leaving the far end reappears
  // at the near end with the same phase on whole passes.
  const s = wrap01(index / cards + passes * wrap01(phase) * dir)

  const length = num(params, 'length', 14)
  const amp = num(params, 'amplitude', 2)
  const depth = num(params, 'depth', 1.5)
  const angle = s * TAU * waves

  const p = restingPlacement()
  p.x = (s - 0.5) * length
  p.y = Math.sin(angle) * amp
  p.z = Math.cos(angle) * depth

  // The twist winds along the ribbon in card pitches, so the accumulation is a
  // function of the wrapped position and closes with it.
  p.rotZ = rad(num(params, 'twist', 0)) * s * cards
  // Cards lean into the ribbon's slope so they follow the flow rather than
  // sitting square to it.
  p.rotX = Math.cos(angle) * amp * 0.15

  p.scale = num(params, 'cardScale', 0.8)

  return p
}

export const ribbon: MotionComponent = {
  id: 'ribbon',
  label: 'Ribbon',
  cardCount: count,
  schema,
  layout
}
