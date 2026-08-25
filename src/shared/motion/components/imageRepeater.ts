// Image repeater: a wall of small tiles with a wave rippling across it.
//
// The grid itself is static; all the life comes from one travelling wave whose
// spatial phase is the tile's position and whose temporal phase is the loop.
// The wave speed is quantised to whole cycles per loop so the ripple arrives
// back where it started, and because the spatial term never depends on `phase`
// the seam closes for every tile regardless of grid size.

import type { CardPlacement, MotionComponent, ParamSpec, ParamValue } from '../types'
import { TAU, directionSign, num, restingPlacement, str, wrap01 } from '../math'

const schema: ParamSpec[] = [
  { kind: 'slider', key: 'columns', label: 'Columns', min: 1, max: 20, step: 1, default: 8, precision: 0 },
  { kind: 'slider', key: 'rows', label: 'Rows', min: 1, max: 20, step: 1, default: 5, precision: 0 },
  { kind: 'slider', key: 'gap', label: 'Gap', min: 0.4, max: 3, step: 0.01, default: 1.1, precision: 2 },
  { kind: 'slider', key: 'cardScale', label: 'Card scale', min: 0.05, max: 2, step: 0.01, default: 0.5, precision: 2 },
  { kind: 'slider', key: 'waveAmp', label: 'Wave amount', min: 0, max: 3, step: 0.01, default: 0.5, precision: 2, zeroLabel: 'still' },
  { kind: 'slider', key: 'waveSpeed', label: 'Wave speed', min: 1, max: 6, step: 1, default: 2, precision: 0, unit: '×' },
  {
    kind: 'segmented',
    key: 'waveAxis',
    label: 'Wave axis',
    options: [
      { value: 'depth', label: 'Depth' },
      { value: 'horizontal', label: 'Horizontal' },
      { value: 'vertical', label: 'Vertical' }
    ],
    default: 'depth'
  },
  {
    kind: 'segmented',
    key: 'direction',
    label: 'Direction',
    options: [{ value: 'forward', label: 'Forward' }, { value: 'reverse', label: 'Reverse' }],
    default: 'forward'
  }
]

function count(params: Record<string, ParamValue>): number {
  return Math.max(1, Math.round(num(params, 'columns', 8)) * Math.max(1, Math.round(num(params, 'rows', 5))))
}

function layout(
  phase: number,
  index: number,
  _total: number,
  params: Record<string, ParamValue>
): CardPlacement {
  const columns = Math.max(1, Math.round(num(params, 'columns', 8)))
  const rows = Math.max(1, Math.round(num(params, 'rows', 5)))
  const col = index % columns
  const row = Math.floor(index / columns) % rows

  const gap = num(params, 'gap', 1.1)
  const p = restingPlacement()
  p.x = (col - (columns - 1) / 2) * gap
  p.y = ((rows - 1) / 2 - row) * gap
  p.scale = num(params, 'cardScale', 0.5)

  const dir = directionSign(params)
  const cycles = Math.max(1, Math.round(num(params, 'waveSpeed', 2)))
  // The ripple runs on the diagonal so the wall does not simply pulse in
  // columns; the spatial offset is constant in phase, so only the whole-cycle
  // temporal term decides whether the seam closes, and it always does.
  const spatial = (col / columns + row / rows) * TAU
  const wave = Math.sin(cycles * wrap01(phase) * TAU * dir - spatial) * num(params, 'waveAmp', 0)

  const axis = str(params, 'waveAxis', 'depth')
  if (axis === 'horizontal') p.x += wave
  else if (axis === 'vertical') p.y += wave
  else p.z = wave

  return p
}

export const imageRepeater: MotionComponent = {
  id: 'image-repeater',
  label: 'Image repeater',
  cardCount: count,
  schema,
  layout
}
