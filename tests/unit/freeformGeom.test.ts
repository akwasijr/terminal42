import { describe, it, expect } from 'vitest'
import {
  type Box,
  groupBounds,
  boxesIntersect,
  normalizeBox,
  resizeBox,
  computeSnaps,
  alignBoxes,
  distributeBoxes,
} from '../../src/renderer/src/lib/freeformGeom'

describe('groupBounds', () => {
  it('returns null for an empty list', () => {
    expect(groupBounds([])).toBeNull()
  })
  it('wraps all boxes', () => {
    const b = groupBounds([{ x: 10, y: 10, w: 20, h: 20 }, { x: 50, y: 5, w: 10, h: 40 }])
    expect(b).toEqual({ x: 10, y: 5, w: 50, h: 40 })
  })
})

describe('boxesIntersect / normalizeBox', () => {
  it('detects overlap', () => {
    expect(boxesIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true)
    expect(boxesIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 5, h: 5 })).toBe(false)
  })
  it('normalizes negative dimensions', () => {
    expect(normalizeBox({ x: 30, y: 30, w: -20, h: -10 })).toEqual({ x: 10, y: 20, w: 20, h: 10 })
  })
})

describe('resizeBox', () => {
  const start: Box = { x: 100, y: 100, w: 200, h: 100 }
  it('grows from the south-east handle', () => {
    expect(resizeBox(start, 'se', 50, 30)).toEqual({ x: 100, y: 100, w: 250, h: 130 })
  })
  it('moves the left edge from the west handle', () => {
    expect(resizeBox(start, 'w', -40, 0)).toEqual({ x: 60, y: 100, w: 240, h: 100 })
  })
  it('clamps so edges cannot invert', () => {
    const r = resizeBox(start, 'e', -1000, 0, false, 2)
    expect(r.w).toBeGreaterThanOrEqual(2)
    expect(r.x).toBe(100)
  })
  it('locks the aspect ratio on corner handles', () => {
    const r = resizeBox({ x: 0, y: 0, w: 200, h: 100 }, 'se', 100, 0, true)
    expect(r.w).toBe(300)
    expect(r.h).toBeCloseTo(150, 5)
  })
})

describe('computeSnaps', () => {
  it('snaps a box left edge to another box left edge', () => {
    const moving = { x: 103, y: 0, w: 50, h: 50 }
    const others = [{ x: 100, y: 300, w: 50, h: 50 }]
    const r = computeSnaps(moving, others, { x: 0, y: 0, w: 1000, h: 1000 }, 6)
    expect(r.dx).toBe(-3)
    expect(r.guides.some((g) => g.axis === 'x' && g.pos === 100)).toBe(true)
  })
  it('snaps to artboard horizontal center', () => {
    const moving = { x: 0, y: 497, w: 0, h: 0 }
    const r = computeSnaps(moving, [], { x: 0, y: 0, w: 1000, h: 1000 }, 6)
    expect(r.dy).toBe(3)
  })
  it('snaps to an artboard offset in world space', () => {
    const moving = { x: 2003, y: 0, w: 50, h: 50 }
    const r = computeSnaps(moving, [], { x: 2000, y: 0, w: 1000, h: 1000 }, 6)
    expect(r.dx).toBe(-3)
  })
  it('does not snap when nothing is within threshold', () => {
    const r = computeSnaps({ x: 400, y: 400, w: 10, h: 10 }, [{ x: 0, y: 0, w: 10, h: 10 }], null, 6)
    expect(r.dx).toBe(0)
    expect(r.dy).toBe(0)
    expect(r.guides).toHaveLength(0)
  })
})

describe('alignBoxes', () => {
  const boxes: Box[] = [{ x: 0, y: 0, w: 40, h: 20 }, { x: 100, y: 60, w: 80, h: 40 }]
  it('aligns left edges', () => {
    expect(alignBoxes(boxes, 'left').map((b) => b.x)).toEqual([0, 0])
  })
  it('aligns to the vertical middle of the group', () => {
    const g = groupBounds(boxes)!
    const out = alignBoxes(boxes, 'middle-v')
    out.forEach((b, i) => expect(b.y).toBeCloseTo(g.y + (g.h - boxes[i].h) / 2, 5))
  })
})

describe('distributeBoxes', () => {
  it('equalizes horizontal gaps between three boxes', () => {
    const boxes: Box[] = [
      { x: 0, y: 0, w: 20, h: 10 },
      { x: 40, y: 0, w: 20, h: 10 },
      { x: 200, y: 0, w: 20, h: 10 },
    ]
    const out = distributeBoxes(boxes, 'h')
    const gap1 = out[1].x - (out[0].x + out[0].w)
    const gap2 = out[2].x - (out[1].x + out[1].w)
    expect(gap1).toBeCloseTo(gap2, 5)
    expect(out[0].x).toBe(0)
    expect(out[2].x).toBe(200)
  })
})
