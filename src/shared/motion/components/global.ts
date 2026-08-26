// Global: cards spread over a sphere, turning as one body.
//
// Carousel and Ring both work a circle; this is the circle's next dimension.
// The hard part of a sphere is spacing, because the obvious approach — walk
// latitude and longitude in even steps — bunches everything at the poles. So
// the points come from the Fibonacci lattice, which lands each card on its own
// equal share of the surface, and looks even from any angle.
//
// Facing outward is exact rather than approximated. Given the card's direction
// from the centre, `rotY = asin(dx)` and `rotX = atan2(-dy, dz)` reproduce it
// precisely under the renderer's XYZ Euler order, over the whole sphere and not
// just the front of it.

import type { CardPlacement, MotionComponent, ParamSpec, ParamValue } from '../types'
import { TAU, clamp, directionSign, num, restingPlacement, str, wrap01 } from '../math'

/** The angle that makes consecutive points on the lattice miss each other. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

const schema: ParamSpec[] = [
  { kind: 'slider', key: 'cards', label: 'Cards', min: 1, max: 80, step: 1, default: 24, precision: 0 },
  { kind: 'slider', key: 'cardScale', label: 'Card scale', min: 0.1, max: 4, step: 0.01, default: 0.7, precision: 2 },
  { kind: 'slider', key: 'radius', label: 'Radius', min: 1, max: 10, step: 0.05, default: 4, precision: 2 },
  { kind: 'slider', key: 'band', label: 'Band', min: 0.05, max: 1, step: 0.01, default: 1, precision: 2 },
  { kind: 'slider', key: 'speed', label: 'Speed', min: 0, max: 4, step: 0.01, default: 0.5, precision: 2, zeroLabel: 'still' },
  {
    kind: 'segmented',
    key: 'facing',
    label: 'Facing',
    options: [{ value: 'outward', label: 'Outward' }, { value: 'camera', label: 'Camera' }],
    default: 'outward'
  },
  { kind: 'slider', key: 'swell', label: 'Swell', min: 0, max: 3, step: 0.01, default: 0, precision: 2, zeroLabel: 'none' },
  { kind: 'slider', key: 'scaleFalloff', label: 'Far cards', min: 0, max: 1, step: 0.01, default: 0, precision: 2, zeroLabel: 'same size' },
  {
    kind: 'segmented',
    key: 'direction',
    label: 'Direction',
    options: [{ value: 'forward', label: 'Forward' }, { value: 'reverse', label: 'Reverse' }],
    default: 'forward'
  }
]

function count(params: Record<string, ParamValue>): number {
  return Math.max(1, Math.round(num(params, 'cards', 24)))
}

function layout(
  phase: number,
  index: number,
  _total: number,
  params: Record<string, ParamValue>
): CardPlacement {
  const n = count(params)
  const i = index % n

  // Offset by a half share so a single card sits on the equator rather than
  // exactly on a pole, where it would be edge-on and invisible.
  const band = clamp(num(params, 'band', 1), 0.05, 1)
  const dy = (1 - 2 * ((i + 0.5) / n)) * band
  const ring = Math.sqrt(Math.max(0, 1 - dy * dy))

  const t = wrap01(phase)
  const dir = directionSign(params)
  const speed = num(params, 'speed', 0.5)
  // Whole turns per loop, so the globe closes where it opened.
  const turns = speed > 0 ? Math.max(1, Math.round(speed * 4)) : 0
  const theta = i * GOLDEN_ANGLE + t * TAU * turns * dir

  const dx = Math.cos(theta) * ring
  const dz = Math.sin(theta) * ring

  // Swell breathes the whole sphere once per loop. A cosine rather than a
  // triangle so the radius and its rate of change both match at the seam.
  const radius = num(params, 'radius', 4) + num(params, 'swell', 0) * (0.5 - 0.5 * Math.cos(t * TAU))

  const p = restingPlacement()
  p.x = dx * radius
  p.y = dy * radius
  p.z = dz * radius

  if (str(params, 'facing', 'outward') === 'outward') {
    p.rotY = Math.asin(clamp(dx, -1, 1))
    p.rotX = Math.atan2(-dy, dz)
  }

  // Cards on the far side can be shrunk to deepen the read of the sphere
  // beyond what perspective alone gives.
  const falloff = num(params, 'scaleFalloff', 0)
  const nearness = 0.5 + 0.5 * dz
  p.scale = num(params, 'cardScale', 0.7) * (1 - falloff + falloff * nearness)

  return p
}

export const globe: MotionComponent = {
  id: 'global',
  label: 'Global',
  cardCount: count,
  schema,
  layout
}
