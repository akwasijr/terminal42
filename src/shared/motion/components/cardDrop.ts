// Card drop: cards fall in from above, land, and are swapped for the next.
//
// Each card runs its own fall on a private clock offset by a hashed stagger, so
// they arrive in a loose cascade rather than a single sheet. The loop closes
// because the fall is expressed as a wrapped fraction with a whole number of
// drops per loop: the moment a card reaches the floor it has already faded out,
// and the "new" card fading in at the top is the same card beginning its next
// fall. The landing is eased with a cubic and a brief squash so it reads as
// weight meeting ground rather than a linear slide.

import type { CardPlacement, MotionComponent, ParamSpec, ParamValue } from '../types'
import { clamp01, directionSign, easeInOutCubic, hash01, num, rad, restingPlacement, wrap01 } from '../math'

const schema: ParamSpec[] = [
  { kind: 'slider', key: 'cards', label: 'Cards', min: 1, max: 40, step: 1, default: 8, precision: 0 },
  { kind: 'slider', key: 'cardScale', label: 'Card scale', min: 0.1, max: 4, step: 0.01, default: 1, precision: 2 },
  { kind: 'slider', key: 'spread', label: 'Spread', min: 0, max: 12, step: 0.05, default: 6, precision: 2 },
  { kind: 'slider', key: 'dropHeight', label: 'Drop height', min: 2, max: 14, step: 0.1, default: 8, precision: 1 },
  { kind: 'slider', key: 'squash', label: 'Squash', min: 0, max: 0.8, step: 0.01, default: 0.3, precision: 2, zeroLabel: 'none' },
  { kind: 'slider', key: 'spin', label: 'Landing spin', min: 0, max: 90, step: 1, default: 15, precision: 0, unit: '°', zeroLabel: 'none' },
  { kind: 'slider', key: 'stagger', label: 'Stagger', min: 0, max: 1, step: 0.01, default: 0.5, precision: 2, zeroLabel: 'none' },
  { kind: 'slider', key: 'drops', label: 'Drops', min: 1, max: 6, step: 1, default: 1, precision: 0, unit: '×' },
  {
    kind: 'segmented',
    key: 'direction',
    label: 'Direction',
    options: [{ value: 'forward', label: 'Forward' }, { value: 'reverse', label: 'Reverse' }],
    default: 'forward'
  }
]

function count(params: Record<string, ParamValue>): number {
  return Math.max(1, Math.round(num(params, 'cards', 8)))
}

function layout(
  phase: number,
  index: number,
  _total: number,
  params: Record<string, ParamValue>
): CardPlacement {
  const dir = directionSign(params)
  const drops = Math.max(1, Math.round(num(params, 'drops', 1)))

  // A hashed offset spreads the fall times; the private clock still wraps with
  // the loop because the drop count is a whole number.
  const offset = num(params, 'stagger', 0) * hash01(index * 5.7)
  const t = wrap01(drops * wrap01(phase) * dir - offset)

  const dropHeight = num(params, 'dropHeight', 8)
  // The fall takes the first three-quarters of the cycle; the rest is the card
  // settled on the floor before it fades and begins again.
  const fallEnd = 0.75
  const fall = clamp01(t / fallEnd)
  const eased = easeInOutCubic(fall)

  const p = restingPlacement()

  const spread = num(params, 'spread', 6)
  // A stable per-card column, so a card always returns to the same place.
  const col = (hash01(index * 2.3) - 0.5) * spread
  p.x = col
  p.y = dropHeight * (1 - eased)
  p.z = (hash01(index * 9.1) - 0.5) * 2

  // A short compression as the card meets the floor, strongest at touchdown and
  // gone by the time it rests.
  const impact = Math.max(0, 1 - Math.abs(fall - 1) * 6)
  p.scale = num(params, 'cardScale', 1) * (1 - num(params, 'squash', 0.3) * impact)

  // The tilt it fell with unwinds as it lands, so it settles flat.
  const spinDir = hash01(index * 3.1) < 0.5 ? -1 : 1
  p.rotZ = rad(num(params, 'spin', 15)) * spinDir * (1 - eased)

  // Both ends of the cycle are transparent, which is what hides the instant a
  // landed card is replaced by a fresh one at the top.
  p.opacity = clamp01(t / 0.08) * clamp01((1 - t) / 0.12)

  return p
}

export const cardDrop: MotionComponent = {
  id: 'card-drop',
  label: 'Card drop',
  cardCount: count,
  schema,
  layout
}
