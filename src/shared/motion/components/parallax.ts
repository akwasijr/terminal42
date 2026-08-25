// Parallax: stacked depth layers sliding sideways at different rates.
//
// Depth is faked the honest way — the near layer simply travels faster than the
// far one. Each layer is an independent conveyor with its own whole-number cycle
// count, so every layer wraps seamlessly on its own and, because all counts are
// integers, the whole scene closes together. Assigning more cycles to the near
// layers and pushing the far ones back in z and down in scale is the entire
// illusion.

import type { CardPlacement, MotionComponent, ParamSpec, ParamValue } from '../types'
import { directionSign, hash01, lerp, num, restingPlacement, wrap01 } from '../math'

const schema: ParamSpec[] = [
  { kind: 'slider', key: 'layers', label: 'Layers', min: 2, max: 5, step: 1, default: 3, precision: 0 },
  { kind: 'slider', key: 'perLayer', label: 'Cards per layer', min: 1, max: 20, step: 1, default: 6, precision: 0 },
  { kind: 'slider', key: 'cardScale', label: 'Card scale', min: 0.1, max: 3, step: 0.01, default: 1, precision: 2 },
  { kind: 'slider', key: 'speedSpread', label: 'Speed spread', min: 1, max: 5, step: 1, default: 2, precision: 0, unit: '×' },
  { kind: 'slider', key: 'depthSpread', label: 'Depth spread', min: 0.5, max: 6, step: 0.05, default: 2, precision: 2 },
  { kind: 'slider', key: 'span', label: 'Span', min: 6, max: 24, step: 0.5, default: 16, precision: 1 },
  {
    kind: 'segmented',
    key: 'direction',
    label: 'Direction',
    options: [{ value: 'forward', label: 'Left' }, { value: 'reverse', label: 'Right' }],
    default: 'forward'
  }
]

function layerCount(params: Record<string, ParamValue>): number {
  return Math.max(2, Math.round(num(params, 'layers', 3)))
}

function perLayer(params: Record<string, ParamValue>): number {
  return Math.max(1, Math.round(num(params, 'perLayer', 6)))
}

function count(params: Record<string, ParamValue>): number {
  return layerCount(params) * perLayer(params)
}

function layout(
  phase: number,
  index: number,
  _total: number,
  params: Record<string, ParamValue>
): CardPlacement {
  const layers = layerCount(params)
  const cols = perLayer(params)
  const layer = Math.floor(index / cols) % layers
  const slot = index % cols

  const dir = directionSign(params)
  const spread = Math.max(1, Math.round(num(params, 'speedSpread', 2)))
  // Near layers (low index) get the most cycles; the far ones crawl. Every count
  // is a whole number so each layer's slide wraps on the loop.
  const cycles = 1 + (layers - 1 - layer) * spread

  const u = wrap01(slot / cols + cycles * wrap01(phase) * dir)
  const span = num(params, 'span', 16)

  const p = restingPlacement()
  p.x = (u - 0.5) * span
  // A little stable vertical scatter within a layer so cards do not sit on a
  // perfect line.
  p.y = (hash01(index * 4.9) - 0.5) * 3

  const far = layers > 1 ? layer / (layers - 1) : 0
  p.z = -far * num(params, 'depthSpread', 2) * 3
  p.scale = num(params, 'cardScale', 1) * lerp(1, 0.5, far)
  // Far layers are hazier, which reinforces the recession the speed already
  // implies.
  p.opacity = lerp(1, 0.55, far)

  return p
}

export const parallax: MotionComponent = {
  id: 'parallax',
  label: 'Parallax',
  cardCount: count,
  schema,
  layout
}
