// Plate: cards lying face-up on a turntable.
//
// Ring puts cards round a circle still facing the camera. Plate lays them down
// into the floor plane instead, so you look across them rather than at them,
// and the arrangement reads as objects on a surface rather than a dial.
//
// Once a card is flat its heading is no longer rotY. With rotX at -90° the
// card's own up-vector is steered by rotZ, which is why the radial heading is
// written there; adding the turntable's rotation to rotY would tip the card out
// of the plane instead of turning it within it.
//
// A plate lying truly flat is invisible from a camera sitting at its own
// height: the disc collapses to a line and the cards present their edges. Tip
// leans the whole plate back towards the viewer so the disc opens into an
// ellipse and the faces come into view. It is a rotation of the arrangement,
// not of each card, so it moves the positions as well as the orientations —
// and because the cards already carry an X rotation and nothing on Y, the two
// X rotations collapse into a single angle rather than needing a real compose.

import type { CardPlacement, MotionComponent, ParamSpec, ParamValue } from '../types'
import { TAU, directionSign, hash01, num, rad, restingPlacement, str, wrap01 } from '../math'

const QUARTER = Math.PI / 2

const schema: ParamSpec[] = [
  { kind: 'slider', key: 'cards', label: 'Cards', min: 1, max: 60, step: 1, default: 12, precision: 0 },
  { kind: 'slider', key: 'rings', label: 'Rings', min: 1, max: 5, step: 1, default: 1, precision: 0 },
  { kind: 'slider', key: 'cardScale', label: 'Card scale', min: 0.1, max: 4, step: 0.01, default: 0.9, precision: 2 },
  { kind: 'slider', key: 'radius', label: 'Radius', min: 0.5, max: 10, step: 0.05, default: 4, precision: 2 },
  { kind: 'slider', key: 'ringGap', label: 'Ring gap', min: 0.4, max: 4, step: 0.01, default: 1.6, precision: 2 },
  { kind: 'slider', key: 'speed', label: 'Speed', min: 0, max: 4, step: 0.01, default: 0.4, precision: 2, zeroLabel: 'still' },
  { kind: 'slider', key: 'tip', label: 'Tip', min: 0, max: 90, step: 1, default: 55, precision: 0, unit: '°', zeroLabel: 'flat' },
  { kind: 'slider', key: 'lift', label: 'Ring lift', min: -2, max: 2, step: 0.01, default: 0, precision: 2, zeroLabel: 'level' },
  { kind: 'slider', key: 'scatter', label: 'Scatter', min: 0, max: 2, step: 0.01, default: 0, precision: 2, zeroLabel: 'none' },
  {
    kind: 'segmented',
    key: 'heading',
    label: 'Heading',
    options: [{ value: 'radial', label: 'Radial' }, { value: 'aligned', label: 'Aligned' }],
    default: 'radial'
  },
  {
    kind: 'segmented',
    key: 'direction',
    label: 'Direction',
    options: [{ value: 'forward', label: 'Forward' }, { value: 'reverse', label: 'Reverse' }],
    default: 'forward'
  }
]

const perRing = (params: Record<string, ParamValue>): number => Math.max(1, Math.round(num(params, 'cards', 12)))
const ringsOf = (params: Record<string, ParamValue>): number => Math.max(1, Math.round(num(params, 'rings', 1)))

function count(params: Record<string, ParamValue>): number {
  return perRing(params) * ringsOf(params)
}

function layout(
  phase: number,
  index: number,
  _total: number,
  params: Record<string, ParamValue>
): CardPlacement {
  const per = perRing(params)
  const rings = ringsOf(params)
  const slot = index % per
  const ring = Math.floor(index / per) % rings

  const t = wrap01(phase)
  const dir = directionSign(params)
  const speed = num(params, 'speed', 0.4)
  const turns = speed > 0 ? Math.max(1, Math.round(speed * 4)) : 0
  const spin = t * TAU * turns * dir

  // Alternate rings are offset by half a slot so cards sit in the gaps of the
  // ring inside them rather than lining up into spokes.
  const stagger = ring % 2 === 0 ? 0 : 0.5
  const angle = ((slot + stagger) / per) * TAU + spin

  const jitter = hash01(index * 5.1) - 0.5
  const radius = num(params, 'radius', 4) + ring * num(params, 'ringGap', 1.6) + num(params, 'scatter', 0) * jitter

  const p = restingPlacement()
  const flatX = Math.sin(angle) * radius
  const flatZ = Math.cos(angle) * radius
  const flatY = ring * num(params, 'lift', 0)

  // Tip the whole plate back about the world X axis so the disc reads as an
  // ellipse instead of a line.
  const tip = rad(num(params, 'tip', 55))
  const ct = Math.cos(tip)
  const st = Math.sin(tip)
  p.x = flatX
  p.y = flatY * ct - flatZ * st
  p.z = flatY * st + flatZ * ct

  // Flat on the floor, then carried round by the plate's own tip. Both are X
  // rotations and the card has none on Y, so they add.
  p.rotX = -QUARTER + tip
  // A flat card's in-plane heading lives on Z. The half-turn points its top
  // outward rather than back at the middle of the plate.
  if (str(params, 'heading', 'radial') === 'radial') p.rotZ = angle + Math.PI

  p.scale = num(params, 'cardScale', 0.9)

  return p
}

export const plate: MotionComponent = {
  id: 'plate',
  label: 'Plate',
  cardCount: count,
  schema,
  layout
}
