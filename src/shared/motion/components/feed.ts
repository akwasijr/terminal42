// Feed: a column (or few columns) of cards scrolling up like a social feed.
//
// Cards are laid out in rows and the whole column scrolls upward by a whole
// number of rows per loop, so the card leaving the top is the one arriving at
// the bottom. "Stepped" mode advances row by row with an eased settle between
// stops — the rounded pause a feed makes as it snaps to the next post — while
// "continuous" glides; both share the same row fraction, so they cannot drift
// apart. Cards dim and shrink toward the top and bottom edges so the ends read
// as fading out of view rather than being clipped.

import type { CardPlacement, MotionComponent, ParamSpec, ParamValue } from '../types'
import { clamp01, directionSign, num, restingPlacement, steppedPosition, str, wrap01 } from '../math'

const schema: ParamSpec[] = [
  { kind: 'slider', key: 'cards', label: 'Cards', min: 1, max: 40, step: 1, default: 12, precision: 0 },
  { kind: 'slider', key: 'columns', label: 'Columns', min: 1, max: 4, step: 1, default: 1, precision: 0 },
  { kind: 'slider', key: 'cardScale', label: 'Card scale', min: 0.1, max: 3, step: 0.01, default: 1, precision: 2 },
  { kind: 'slider', key: 'gap', label: 'Gap', min: 0.8, max: 5, step: 0.05, default: 2.2, precision: 2 },
  { kind: 'slider', key: 'edgeFalloff', label: 'Edge falloff', min: 0, max: 1, step: 0.01, default: 0.6, precision: 2, zeroLabel: 'none' },
  {
    kind: 'segmented',
    key: 'mode',
    label: 'Mode',
    options: [{ value: 'continuous', label: 'Continuous' }, { value: 'stepped', label: 'Stepped' }],
    default: 'stepped'
  },
  {
    kind: 'segmented',
    key: 'direction',
    label: 'Direction',
    options: [{ value: 'forward', label: 'Up' }, { value: 'reverse', label: 'Down' }],
    default: 'forward'
  },
  { kind: 'slider', key: 'hold', label: 'Hold', min: 0, max: 4, step: 0.1, default: 0.8, precision: 1, unit: 's' },
  { kind: 'slider', key: 'transition', label: 'Transition', min: 0.1, max: 4, step: 0.05, default: 0.5, precision: 2, unit: 's' }
]

function count(params: Record<string, ParamValue>): number {
  return Math.max(1, Math.round(num(params, 'cards', 12)))
}

function layout(
  phase: number,
  index: number,
  _total: number,
  params: Record<string, ParamValue>
): CardPlacement {
  const cards = Math.max(1, Math.round(num(params, 'cards', 12)))
  const columns = Math.max(1, Math.round(num(params, 'columns', 1)))
  const rowsTotal = Math.max(1, Math.ceil(cards / columns))
  const col = index % columns
  const rowIndex = Math.floor(index / columns)

  const dir = directionSign(params)
  const stepped = str(params, 'mode', 'stepped') === 'stepped'
  // Advance measured in rows. Stepped mode holds on each post and eases to the
  // next; both forms complete exactly `rowsTotal` rows over the loop, so the
  // column returns to its start.
  const advance = stepped
    ? steppedPosition(phase, rowsTotal, num(params, 'hold', 0.8), num(params, 'transition', 0.5))
    : wrap01(phase) * rowsTotal

  const f = wrap01(rowIndex / rowsTotal + (advance / rowsTotal) * dir)

  const gap = num(params, 'gap', 2.2)
  const height = rowsTotal * gap

  const p = restingPlacement()
  p.x = (col - (columns - 1) / 2) * gap
  p.y = (f - 0.5) * height

  // Nearness to either edge, 1 in the middle band and 0 at top and bottom, used
  // to taper size and opacity so the ends of the feed dissolve.
  const edge = Math.min(f, 1 - f)
  const falloff = num(params, 'edgeFalloff', 0.6)
  const taper = 1 - falloff * (1 - clamp01(edge / 0.18))

  p.scale = num(params, 'cardScale', 1) * taper
  p.opacity = clamp01(edge / 0.06)

  return p
}

export const feed: MotionComponent = {
  id: 'feed',
  label: 'Feed',
  cardCount: count,
  schema,
  layout
}
