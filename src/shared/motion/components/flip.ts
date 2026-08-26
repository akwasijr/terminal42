// Flip: a board of cards turning over in sequence, like a split-flap sign.
//
// Every card runs the same one-turn animation; the only thing that differs is
// when it starts. Offsetting the start by the card's diagonal position makes
// the turn sweep across the board rather than firing all at once, and because
// the offset is a constant per card the sweep costs nothing to compute.
//
// The turn is a whole revolution rather than a half. A half-turn would leave
// the card mirrored and reading backwards, and it would need a second half to
// get home; a full turn shows the back on the way past and lands facing front.
//
// `flips` multiplies the phase, so it is rounded: two and a half flips per loop
// would leave every card mid-turn at the seam.

import type { CardPlacement, MotionComponent, ParamSpec, ParamValue } from '../types'
import { TAU, directionSign, num, restingPlacement, steppedPosition, str, wrap01 } from '../math'

const schema: ParamSpec[] = [
  { kind: 'slider', key: 'columns', label: 'Columns', min: 1, max: 10, step: 1, default: 4, precision: 0 },
  { kind: 'slider', key: 'rows', label: 'Rows', min: 1, max: 8, step: 1, default: 3, precision: 0 },
  { kind: 'slider', key: 'cardScale', label: 'Card scale', min: 0.1, max: 4, step: 0.01, default: 0.9, precision: 2 },
  { kind: 'slider', key: 'gapX', label: 'Column gap', min: 0.6, max: 4, step: 0.01, default: 1.5, precision: 2 },
  { kind: 'slider', key: 'gapY', label: 'Row gap', min: 0.6, max: 4, step: 0.01, default: 2, precision: 2 },
  {
    kind: 'segmented',
    key: 'axis',
    label: 'Flip axis',
    options: [{ value: 'x', label: 'Over' }, { value: 'y', label: 'Across' }],
    default: 'x'
  },
  { kind: 'slider', key: 'flips', label: 'Flips per loop', min: 1, max: 6, step: 1, default: 1, precision: 0 },
  { kind: 'slider', key: 'stagger', label: 'Stagger', min: 0, max: 1, step: 0.01, default: 0.4, precision: 2, zeroLabel: 'together' },
  { kind: 'slider', key: 'hold', label: 'Hold', min: 0, max: 3, step: 0.1, default: 1, precision: 1, unit: 's' },
  { kind: 'slider', key: 'transition', label: 'Turn', min: 0.1, max: 3, step: 0.05, default: 0.6, precision: 2, unit: 's' },
  { kind: 'slider', key: 'depth', label: 'Depth', min: 0, max: 3, step: 0.01, default: 0, precision: 2, zeroLabel: 'flat' },
  {
    kind: 'segmented',
    key: 'direction',
    label: 'Direction',
    options: [{ value: 'forward', label: 'Forward' }, { value: 'reverse', label: 'Reverse' }],
    default: 'forward'
  }
]

const cols = (params: Record<string, ParamValue>): number => Math.max(1, Math.round(num(params, 'columns', 4)))
const rowsOf = (params: Record<string, ParamValue>): number => Math.max(1, Math.round(num(params, 'rows', 3)))

function count(params: Record<string, ParamValue>): number {
  return cols(params) * rowsOf(params)
}

function layout(
  phase: number,
  index: number,
  _total: number,
  params: Record<string, ParamValue>
): CardPlacement {
  const columns = cols(params)
  const rows = rowsOf(params)
  const col = index % columns
  const row = Math.floor(index / columns) % rows

  const gapX = num(params, 'gapX', 1.5)
  const gapY = num(params, 'gapY', 2)

  const p = restingPlacement()
  p.x = (col - (columns - 1) / 2) * gapX
  // Row 0 at the top, so a board fills downward the way one is read.
  p.y = -(row - (rows - 1) / 2) * gapY

  const dir = directionSign(params)
  const flips = Math.max(1, Math.round(num(params, 'flips', 1)))

  // The wave runs along the diagonal, so the corner nearest the start goes
  // first and the far corner last. Dividing by the longest diagonal keeps the
  // spread inside one turn however the board is shaped.
  const span = Math.max(1, columns + rows - 2)
  const offset = num(params, 'stagger', 0.4) * ((col + row) / span)

  const local = wrap01(wrap01(phase) * flips * dir - offset)
  // One step per cycle: the card sits still for `hold`, then turns over during
  // `transition`. Sharing steppedPosition with the other components is what
  // makes a Flip hold feel like a Carousel hold.
  const turn = steppedPosition(local, 1, num(params, 'hold', 1), num(params, 'transition', 0.6))
  const angle = turn * TAU

  if (str(params, 'axis', 'x') === 'y') p.rotY = angle
  else p.rotX = angle

  // Cards lift toward the camera as they turn, which stops a dense board from
  // clipping through itself at the halfway point.
  p.z = num(params, 'depth', 0) * Math.sin(turn * Math.PI)

  p.scale = num(params, 'cardScale', 0.9)

  return p
}

export const flip: MotionComponent = {
  id: 'flip',
  label: 'Flip',
  cardCount: count,
  schema,
  layout
}
