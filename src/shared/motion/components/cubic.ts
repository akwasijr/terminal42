// Cubic: cards tiled over the six faces of a box that turns on the spot.
//
// The awkward part is the spin. A card's orientation here is not a free
// rotation but the face's orientation with the box's spin applied *before* it,
// and Euler angles do not compose by addition. For the four upright faces the
// spin is itself a Y rotation, so it does add. For the lid and the floor it
// does not, and the identity that rescues it is
//
//   Ry(s) · Rx(-90) = Rx(-90) · Rz(s)      and      Ry(s) · Rx(90) = Rx(90) · Rz(-s)
//
// so the spin lands on Z with the sign flipping between them. Both are exact
// under the renderer's XYZ order, checked against the matrices rather than
// reasoned about and hoped for.

import type { CardPlacement, MotionComponent, ParamSpec, ParamValue } from '../types'
import { TAU, directionSign, num, restingPlacement, wrap01 } from '../math'

const HALF_TURN = Math.PI
const QUARTER = Math.PI / 2

const schema: ParamSpec[] = [
  { kind: 'slider', key: 'perFace', label: 'Per face', min: 1, max: 5, step: 1, default: 2, precision: 0 },
  { kind: 'slider', key: 'size', label: 'Box size', min: 1, max: 8, step: 0.05, default: 3, precision: 2 },
  { kind: 'slider', key: 'cardScale', label: 'Card scale', min: 0.1, max: 4, step: 0.01, default: 0.8, precision: 2 },
  { kind: 'slider', key: 'spread', label: 'Spread', min: 0.5, max: 4, step: 0.01, default: 1.6, precision: 2 },
  { kind: 'slider', key: 'speed', label: 'Speed', min: 0, max: 4, step: 0.01, default: 0.4, precision: 2, zeroLabel: 'still' },
  { kind: 'slider', key: 'explode', label: 'Explode', min: 0, max: 4, step: 0.01, default: 0, precision: 2, zeroLabel: 'closed' },
  { kind: 'slider', key: 'breathe', label: 'Breathe', min: 0, max: 3, step: 0.01, default: 0, precision: 2, zeroLabel: 'none' },
  {
    kind: 'segmented',
    key: 'direction',
    label: 'Direction',
    options: [{ value: 'forward', label: 'Forward' }, { value: 'reverse', label: 'Reverse' }],
    default: 'forward'
  }
]

const perFaceOf = (params: Record<string, ParamValue>): number =>
  Math.max(1, Math.round(num(params, 'perFace', 2)))

function count(params: Record<string, ParamValue>): number {
  const n = perFaceOf(params)
  return 6 * n * n
}

function layout(
  phase: number,
  index: number,
  _total: number,
  params: Record<string, ParamValue>
): CardPlacement {
  const n = perFaceOf(params)
  const perFace = n * n
  const face = Math.floor(index / perFace) % 6
  const cell = index % perFace
  const col = cell % n
  const row = Math.floor(cell / n)

  const spread = num(params, 'spread', 1.6)
  // Cell centres within the face, so a single card per face sits dead centre.
  const u = (col - (n - 1) / 2) * spread
  const v = -(row - (n - 1) / 2) * spread

  const t = wrap01(phase)
  const dir = directionSign(params)
  const speed = num(params, 'speed', 0.4)
  const turns = speed > 0 ? Math.max(1, Math.round(speed * 4)) : 0
  const spin = t * TAU * turns * dir

  // Both the swell and the explode ride a cosine so they return to where they
  // began with matching slope, leaving no kink at the loop's seam.
  const breathe = num(params, 'breathe', 0) * (0.5 - 0.5 * Math.cos(t * TAU))
  const size = num(params, 'size', 3) + num(params, 'explode', 0) + breathe

  // Position on an axis-aligned box, then turned about world Y by `spin`.
  let x = 0
  let y = 0
  let z = 0
  const p = restingPlacement()

  if (face === 0) { x = u; y = v; z = size; p.rotY = 0 }
  else if (face === 1) { x = -u; y = v; z = -size; p.rotY = HALF_TURN }
  else if (face === 2) { x = size; y = v; z = -u; p.rotY = QUARTER }
  else if (face === 3) { x = -size; y = v; z = u; p.rotY = -QUARTER }
  else if (face === 4) { x = u; y = size; z = -v; p.rotX = -QUARTER }
  else { x = u; y = -size; z = v; p.rotX = QUARTER }

  // Spin the placement about Y. The lid and the floor carry it on Z instead,
  // per the identities in the header.
  const c = Math.cos(spin)
  const s = Math.sin(spin)
  p.x = x * c + z * s
  p.z = -x * s + z * c
  p.y = y

  if (face === 4) p.rotZ = spin
  else if (face === 5) p.rotZ = -spin
  else p.rotY += spin

  p.scale = num(params, 'cardScale', 0.8)

  return p
}

export const cubic: MotionComponent = {
  id: 'cubic',
  label: 'Cubic',
  cardCount: count,
  schema,
  layout
}
