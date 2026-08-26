// Spin: a fan of cards pivoting about a shared point, like a dealt hand.
//
// Card shuffle also works a stack, but there the cards travel a closed orbit
// one at a time. Here nothing leaves: the whole hand is held open at once and
// the fan itself rotates, so the arrangement reads as a single object turning
// rather than a sequence of events.
//
// The pivot is what makes it a fan. Each card is pushed out along its own
// heading and then pulled back towards the hand, which puts the point every
// card turns about away from its own centre — the difference between a hand of
// cards and a pile of cards all facing different ways.
//
// How far back it is pulled is left open, because it decides what the spin
// looks like. Pull it all the way and the pivot lands at the origin, giving a
// hand held from below that sweeps around like a clock hand. Leave it at
// nothing and the cards ring the middle instead, so the arrangement turns on
// the spot and stays in shot at every point of the loop. The default is the
// second, which is why Spread opens almost the whole way round by default too.
//
// Spread stops at 340° rather than 360° on purpose: the seat below runs from
// -0.5 to 0.5 inclusive, so a full turn would land the first and last card on
// the same spot.

import type { CardPlacement, MotionComponent, ParamSpec, ParamValue } from '../types'
import { TAU, clamp, directionSign, num, rad, restingPlacement, wrap01 } from '../math'

const schema: ParamSpec[] = [
  { kind: 'slider', key: 'cards', label: 'Cards', min: 1, max: 40, step: 1, default: 9, precision: 0 },
  { kind: 'slider', key: 'cardScale', label: 'Card scale', min: 0.1, max: 4, step: 0.01, default: 1, precision: 2 },
  { kind: 'slider', key: 'spread', label: 'Spread', min: 0, max: 340, step: 1, default: 320, precision: 0, unit: '°' },
  { kind: 'slider', key: 'reach', label: 'Reach', min: 0, max: 8, step: 0.05, default: 2.6, precision: 2 },
  { kind: 'slider', key: 'pivot', label: 'Pivot', min: 0, max: 1, step: 0.01, default: 0, precision: 2, zeroLabel: 'centred' },
  { kind: 'slider', key: 'speed', label: 'Speed', min: 0, max: 4, step: 0.01, default: 0.35, precision: 2, zeroLabel: 'still' },
  { kind: 'slider', key: 'depth', label: 'Depth', min: 0, max: 3, step: 0.01, default: 0, precision: 2, zeroLabel: 'flat' },
  { kind: 'slider', key: 'taper', label: 'Taper', min: 0.1, max: 2, step: 0.01, default: 1, precision: 2, zeroLabel: 'none' },
  { kind: 'slider', key: 'breathe', label: 'Breathe', min: 0, max: 180, step: 1, default: 0, precision: 0, unit: '°', zeroLabel: 'none' },
  { kind: 'slider', key: 'lean', label: 'Lean', min: -60, max: 60, step: 1, default: 0, precision: 0, unit: '°', zeroLabel: 'none' },
  {
    kind: 'segmented',
    key: 'direction',
    label: 'Direction',
    options: [{ value: 'forward', label: 'Forward' }, { value: 'reverse', label: 'Reverse' }],
    default: 'forward'
  }
]

function count(params: Record<string, ParamValue>): number {
  return Math.max(1, Math.round(num(params, 'cards', 9)))
}

function layout(
  phase: number,
  index: number,
  _total: number,
  params: Record<string, ParamValue>
): CardPlacement {
  const cards = count(params)
  const i = index % cards

  const t = wrap01(phase)
  const dir = directionSign(params)
  const speed = num(params, 'speed', 0.35)
  const turns = speed > 0 ? Math.max(1, Math.round(speed * 4)) : 0
  const spin = t * TAU * turns * dir

  // The fan opens and closes once per loop when Breathe is up. A cosine keeps
  // the width and its rate of change matched where the loop joins.
  const swell = rad(num(params, 'breathe', 0)) * (0.5 - 0.5 * Math.cos(t * TAU))
  const spread = rad(num(params, 'spread', 120)) + swell

  // A single card sits straight up rather than at one end of the arc.
  const seat = cards === 1 ? 0 : i / (cards - 1) - 0.5
  const angle = seat * spread + spin

  // Out along the heading, then back down towards the hand. The pull-back is
  // the untapered reach so every card is drawn to the same pivot rather than
  // each to its own.
  const reach = num(params, 'reach', 2.6) * clamp(1 + seat * 2 * (num(params, 'taper', 1) - 1), 0, 4)
  const anchor = num(params, 'reach', 2.6) * clamp(num(params, 'pivot', 0), 0, 1)

  const p = restingPlacement()
  p.x = Math.sin(angle) * reach
  p.y = Math.cos(angle) * reach - anchor
  p.z = seat * num(params, 'depth', 0)

  // In the picture plane, so the fan turns the way a hand of cards does.
  p.rotZ = -angle
  p.rotX = rad(num(params, 'lean', 0))

  p.scale = num(params, 'cardScale', 1)

  return p
}

export const spin: MotionComponent = {
  id: 'spin',
  label: 'Spin',
  cardCount: count,
  schema,
  layout
}
