import { describe, it, expect } from 'vitest'
import { polygonPoints, starPoints, shapeClipPath, makeObject, type FObj } from '../../src/renderer/src/lib/freeformTypes'

describe('polygonPoints', () => {
  it('produces N vertices for an N-gon', () => {
    expect(polygonPoints(3).split(',')).toHaveLength(3)
    expect(polygonPoints(6).split(',')).toHaveLength(6)
  })
  it('clamps to a minimum of 3 sides', () => {
    expect(polygonPoints(1).split(',')).toHaveLength(3)
  })
  it('puts the first vertex at top-center', () => {
    expect(polygonPoints(4).startsWith('50.00% 0.00%')).toBe(true)
  })
})

describe('starPoints', () => {
  it('produces 2N vertices (outer + inner) for an N-point star', () => {
    expect(starPoints(5, 0.45).split(',')).toHaveLength(10)
  })
  it('alternates outer (radius 50) and inner (radius 50*ratio) points', () => {
    const pts = starPoints(4, 0.5).split(',').map((p) => p.trim())
    // first outer point is top-center
    expect(pts[0]).toBe('50.00% 0.00%')
  })
})

describe('shapeClipPath', () => {
  it('returns a polygon clip-path for polygon + star, undefined otherwise', () => {
    const poly = makeObject('polygon', 0, 0)
    const star = makeObject('star', 0, 0)
    const rect = makeObject('rect', 0, 0)
    expect(shapeClipPath(poly)).toMatch(/^polygon\(/)
    expect(shapeClipPath(star)).toMatch(/^polygon\(/)
    expect(shapeClipPath(rect)).toBeUndefined()
  })
})

describe('makeObject new primitives', () => {
  it('creates frame/arrow/polygon/star with sensible defaults', () => {
    const frame = makeObject('frame', 0, 0)
    expect(frame.strokeEnabled).toBe(true)
    const arrow = makeObject('arrow', 0, 0)
    expect(arrow.strokeEnabled).toBe(true)
    const poly: FObj = makeObject('polygon', 0, 0)
    expect(poly.sides).toBeGreaterThanOrEqual(3)
    const star: FObj = makeObject('star', 0, 0)
    expect(star.points).toBeGreaterThanOrEqual(3)
    expect(star.innerRatio).toBeGreaterThan(0)
  })
})

describe('pathFromPoints (pencil)', () => {
  it('returns null for fewer than 2 points', async () => {
    const { pathFromPoints } = await import('../../src/renderer/src/lib/freeformTypes')
    expect(pathFromPoints([])).toBeNull()
    expect(pathFromPoints([{ x: 1, y: 1 }])).toBeNull()
  })
  it('builds a normalised path with a padded bounding box', async () => {
    const { pathFromPoints } = await import('../../src/renderer/src/lib/freeformTypes')
    const r = pathFromPoints([{ x: 10, y: 20 }, { x: 30, y: 20 }, { x: 30, y: 60 }], 2)
    expect(r).toBeTruthy()
    expect(r!.d.startsWith('M')).toBe(true)
    // padded by max(2, strokeWidth)=2 on each side
    expect(r!.x).toBe(8)
    expect(r!.y).toBe(18)
    expect(r!.w).toBe(24)
    expect(r!.h).toBe(44)
    // all coordinates are within the 0..1 unit box
    const nums = (r!.d.match(/[0-9.]+/g) || []).map(Number)
    expect(nums.every((n) => n >= 0 && n <= 1)).toBe(true)
  })
})
