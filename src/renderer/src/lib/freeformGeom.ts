// Pure geometry helpers for the freeform canvas. Kept free of React/DOM so they
// can be unit-tested and reused by both the editor and (potentially) the export.

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

// Bounding box that contains every box in the list.
export function groupBounds(boxes: Box[]): Box | null {
  if (boxes.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const b of boxes) {
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.w)
    maxY = Math.max(maxY, b.y + b.h)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export function boxesIntersect(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

// Normalize a possibly-inverted rectangle (negative width/height) to positive.
export function normalizeBox(b: Box): Box {
  return {
    x: b.w < 0 ? b.x + b.w : b.x,
    y: b.h < 0 ? b.y + b.h : b.y,
    w: Math.abs(b.w),
    h: Math.abs(b.h),
  }
}

// Resize a box by dragging one of its 8 handles. `aspect` locks the ratio for
// corner handles. Edges can't cross (clamped to `min`).
export function resizeBox(b: Box, handle: Handle, dx: number, dy: number, aspect = false, min = 2): Box {
  let left = b.x
  let top = b.y
  let right = b.x + b.w
  let bottom = b.y + b.h
  const E = handle.includes('e')
  const W = handle.includes('w')
  const N = handle.includes('n')
  const S = handle.includes('s')
  if (E) right = Math.max(left + min, b.x + b.w + dx)
  if (W) left = Math.min(right - min, b.x + dx)
  if (N) top = Math.min(bottom - min, b.y + dy)
  if (S) bottom = Math.max(top + min, b.y + b.h + dy)
  let w = right - left
  let h = bottom - top
  if (aspect && handle.length === 2 && b.h !== 0) {
    const ratio = b.w / b.h || 1
    h = Math.max(min, w / ratio)
    if (N) top = bottom - h
    else bottom = top + h
  }
  w = right - left
  h = bottom - top
  return { x: left, y: top, w, h }
}

export interface SnapGuide {
  axis: 'x' | 'y'
  pos: number
  start: number
  end: number
}

export interface SnapResult {
  dx: number
  dy: number
  guides: SnapGuide[]
}

// Snap a moving box to other boxes' and the artboard's edges + centers. The
// artboard is given as a world-space box (or null to skip artboard snapping).
export function computeSnaps(
  box: Box,
  others: Box[],
  artboard: Box | null,
  threshold = 6,
): SnapResult {
  const movingX = [box.x, box.x + box.w / 2, box.x + box.w]
  const movingY = [box.y, box.y + box.h / 2, box.y + box.h]
  const vTargets: number[] = []
  const hTargets: number[] = []
  if (artboard) {
    vTargets.push(artboard.x, artboard.x + artboard.w / 2, artboard.x + artboard.w)
    hTargets.push(artboard.y, artboard.y + artboard.h / 2, artboard.y + artboard.h)
  }
  for (const o of others) {
    vTargets.push(o.x, o.x + o.w / 2, o.x + o.w)
    hTargets.push(o.y, o.y + o.h / 2, o.y + o.h)
  }
  let bestDx = 0
  let bestAbsX = threshold + 1
  let snapX: number | null = null
  for (const m of movingX) {
    for (const t of vTargets) {
      const d = t - m
      if (Math.abs(d) < bestAbsX) {
        bestAbsX = Math.abs(d)
        bestDx = d
        snapX = t
      }
    }
  }
  let bestDy = 0
  let bestAbsY = threshold + 1
  let snapY: number | null = null
  for (const m of movingY) {
    for (const t of hTargets) {
      const d = t - m
      if (Math.abs(d) < bestAbsY) {
        bestAbsY = Math.abs(d)
        bestDy = d
        snapY = t
      }
    }
  }
  const dx = snapX !== null ? bestDx : 0
  const dy = snapY !== null ? bestDy : 0
  const guides: SnapGuide[] = []
  const ab = artboard ?? { x: 0, y: 0, w: 0, h: 0 }
  if (snapX !== null) guides.push({ axis: 'x', pos: snapX, start: ab.y, end: ab.y + ab.h })
  if (snapY !== null) guides.push({ axis: 'y', pos: snapY, start: ab.x, end: ab.x + ab.w })
  return { dx, dy, guides }
}

export type AlignMode = 'left' | 'center-h' | 'right' | 'top' | 'middle-v' | 'bottom'

// Compute new x/y for each box to align them within their shared group bounds.
export function alignBoxes(boxes: Box[], mode: AlignMode): Box[] {
  const g = groupBounds(boxes)
  if (!g) return boxes
  return boxes.map((b) => {
    switch (mode) {
      case 'left':
        return { ...b, x: g.x }
      case 'center-h':
        return { ...b, x: g.x + (g.w - b.w) / 2 }
      case 'right':
        return { ...b, x: g.x + g.w - b.w }
      case 'top':
        return { ...b, y: g.y }
      case 'middle-v':
        return { ...b, y: g.y + (g.h - b.h) / 2 }
      case 'bottom':
        return { ...b, y: g.y + g.h - b.h }
      default:
        return b
    }
  })
}

// Distribute boxes so the gaps between them are equal along an axis.
export function distributeBoxes(boxes: Box[], axis: 'h' | 'v'): Box[] {
  if (boxes.length < 3) return boxes
  const idx = boxes.map((b, i) => i)
  if (axis === 'h') {
    idx.sort((a, b) => boxes[a].x - boxes[b].x)
    const first = boxes[idx[0]]
    const last = boxes[idx[idx.length - 1]]
    const totalW = idx.reduce((s, i) => s + boxes[i].w, 0)
    const span = last.x + last.w - first.x
    const gap = (span - totalW) / (idx.length - 1)
    let cursor = first.x
    const out = boxes.slice()
    for (const i of idx) {
      out[i] = { ...boxes[i], x: cursor }
      cursor += boxes[i].w + gap
    }
    return out
  }
  idx.sort((a, b) => boxes[a].y - boxes[b].y)
  const first = boxes[idx[0]]
  const last = boxes[idx[idx.length - 1]]
  const totalH = idx.reduce((s, i) => s + boxes[i].h, 0)
  const span = last.y + last.h - first.y
  const gap = (span - totalH) / (idx.length - 1)
  let cursor = first.y
  const out = boxes.slice()
  for (const i of idx) {
    out[i] = { ...boxes[i], y: cursor }
    cursor += boxes[i].h + gap
  }
  return out
}
