// Grid: a wall of cards drifting as one sheet, wrapping at both edges.
//
// Image repeater already owns the static wall with a wave running over it, so
// this one is the opposite arrangement: the cells never move relative to each
// other, the whole sheet travels, and a card leaving one edge is the card
// entering the other. That wrap is only seamless if the sheet advances by a
// whole number of cells per loop, so the drift sliders are rounded before they
// touch the phase — a drift of 1.4 columns would leave the wall four tenths of
// a cell out of place at the seam.
//
// `curve` rolls the same sheet into a cylinder. It is a lerp rather than a
// separate mode so the two readings are one continuous parameter, and the
// cylinder's circumference is the wall's own width, which is what keeps the
// cards touching at full curve instead of overlapping or gapping.

import type { CardPlacement, MotionComponent, ParamSpec, ParamValue } from '../types'
import { TAU, directionSign, lerp, num, rad, restingPlacement, wrap01 } from '../math'

const schema: ParamSpec[] = [
  { kind: 'slider', key: 'columns', label: 'Columns', min: 1, max: 14, step: 1, default: 5, precision: 0 },
  { kind: 'slider', key: 'rows', label: 'Rows', min: 1, max: 10, step: 1, default: 4, precision: 0 },
  { kind: 'slider', key: 'cardScale', label: 'Card scale', min: 0.1, max: 4, step: 0.01, default: 0.9, precision: 2 },
  { kind: 'slider', key: 'gapX', label: 'Column gap', min: 0.6, max: 4, step: 0.01, default: 1.5, precision: 2 },
  { kind: 'slider', key: 'gapY', label: 'Row gap', min: 0.6, max: 4, step: 0.01, default: 1.9, precision: 2 },
  { kind: 'slider', key: 'driftX', label: 'Drift across', min: -4, max: 4, step: 1, default: 1, precision: 0, zeroLabel: 'still' },
  { kind: 'slider', key: 'driftY', label: 'Drift up', min: -4, max: 4, step: 1, default: 0, precision: 0, zeroLabel: 'still' },
  { kind: 'slider', key: 'curve', label: 'Curve', min: 0, max: 1, step: 0.01, default: 0, precision: 2, zeroLabel: 'flat' },
  { kind: 'slider', key: 'depth', label: 'Depth', min: 0, max: 4, step: 0.01, default: 0, precision: 2, zeroLabel: 'flat' },
  { kind: 'slider', key: 'lean', label: 'Lean', min: -45, max: 45, step: 1, default: 0, precision: 0, unit: '°', zeroLabel: 'none' },
  {
    kind: 'segmented',
    key: 'direction',
    label: 'Direction',
    options: [{ value: 'forward', label: 'Forward' }, { value: 'reverse', label: 'Reverse' }],
    default: 'forward'
  }
]

const cols = (params: Record<string, ParamValue>): number => Math.max(1, Math.round(num(params, 'columns', 5)))
const rowsOf = (params: Record<string, ParamValue>): number => Math.max(1, Math.round(num(params, 'rows', 4)))

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

  const dir = directionSign(params)
  const t = wrap01(phase)
  // Rounded because these multiply the phase: only a whole number of cells per
  // loop puts the sheet back where it started.
  const driftX = Math.round(num(params, 'driftX', 1))
  const driftY = Math.round(num(params, 'driftY', 0))

  // Cell centres, so a single column sits in the middle rather than off to one
  // side, and the wrap happens at the gap between cards rather than through one.
  const u = wrap01((col + 0.5) / columns + driftX * t * dir)
  const v = wrap01((row + 0.5) / rows + driftY * t * dir)

  const gapX = num(params, 'gapX', 1.5)
  const gapY = num(params, 'gapY', 1.9)
  const width = columns * gapX
  const curve = num(params, 'curve', 0)

  const p = restingPlacement()

  // The cylinder that has this wall as its circumference. Shifting by -radius
  // keeps the nearest cards at z = 0, so turning Curve up rolls the wall away
  // from the camera instead of driving it through it.
  const radius = width / TAU
  const ang = u * TAU
  p.x = lerp((u - 0.5) * width, Math.sin(ang) * radius, curve)
  p.z = lerp(0, Math.cos(ang) * radius - radius, curve)
  p.rotY = curve * ang

  // Depth is a fixed relief across the rows rather than a travelling wave;
  // a cosine of the wrapped row keeps it continuous where the sheet joins.
  p.z += num(params, 'depth', 0) * Math.cos(v * TAU)

  p.y = (v - 0.5) * rows * gapY
  p.rotX = rad(num(params, 'lean', 0))
  p.scale = num(params, 'cardScale', 0.9)

  return p
}

export const grid: MotionComponent = {
  id: 'grid',
  label: 'Grid',
  cardCount: count,
  schema,
  layout
}
