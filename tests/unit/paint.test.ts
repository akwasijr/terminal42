import { describe, it, expect } from 'vitest'
import {
  makeObject,
  type FObj,
  STROKE_PAINT,
  BORDER_PAINT,
  FILL_PAINT,
  paintCssOf,
  paintIsRich,
  paintStopsOf,
  svgLinearCoords,
} from '../../src/renderer/src/lib/freeformTypes'

const obj = (p: Partial<FObj>): FObj => ({ ...makeObject('rect', 0, 0), ...p })

describe('paintCssOf (stroke paint)', () => {
  it('returns the solid stroke colour by default', () => {
    expect(paintCssOf(obj({ stroke: '#112233' }), STROKE_PAINT)).toBe('#112233')
  })
  it('builds a linear gradient from stroke gradient stops', () => {
    const css = paintCssOf(obj({
      strokeMode: 'gradient',
      strokeGradientAngle: 90,
      strokeGradientStops: [{ color: '#000000', pos: 0 }, { color: '#ffffff', pos: 1 }],
    }), STROKE_PAINT)
    expect(css).toBe('linear-gradient(90deg, #000000 0%, #ffffff 100%)')
  })
  it('uses the stroke image as a cover background', () => {
    const css = paintCssOf(obj({ strokeMode: 'image', strokeImage: 'data:img' }), STROKE_PAINT)
    expect(css).toBe('url("data:img") center / cover no-repeat')
  })
  it('keeps fill and stroke paints independent', () => {
    const o = obj({ fillMode: 'gradient', gradientStops: [{ color: '#aa0000', pos: 0 }, { color: '#00aa00', pos: 1 }], stroke: '#0000ff' })
    expect(paintCssOf(o, FILL_PAINT)).toContain('linear-gradient')
    expect(paintCssOf(o, STROKE_PAINT)).toBe('#0000ff')
  })
})

describe('paintIsRich', () => {
  it('is false for a solid border', () => {
    expect(paintIsRich(obj({ borderColor: '#000000' }), BORDER_PAINT)).toBe(false)
  })
  it('is true for a gradient border', () => {
    expect(paintIsRich(obj({ borderMode: 'gradient' }), BORDER_PAINT)).toBe(true)
  })
  it('is false for image mode with no image set', () => {
    expect(paintIsRich(obj({ borderMode: 'image' }), BORDER_PAINT)).toBe(false)
  })
})

describe('paintStopsOf', () => {
  it('falls back to a 2-stop pair seeded from the paint colour', () => {
    const stops = paintStopsOf(obj({ stroke: '#abcdef' }), STROKE_PAINT)
    expect(stops).toHaveLength(2)
    expect(stops[0].color).toBe('#abcdef')
  })
})

describe('svgLinearCoords', () => {
  it('maps 90deg (to right) to a left->right axis', () => {
    const { x1, y1, x2, y2 } = svgLinearCoords(90)
    expect(x1).toBeCloseTo(0)
    expect(y1).toBeCloseTo(0.5)
    expect(x2).toBeCloseTo(1)
    expect(y2).toBeCloseTo(0.5)
  })
  it('maps 0deg (to top) to a bottom->top axis', () => {
    const { x1, y1, x2, y2 } = svgLinearCoords(0)
    expect(x1).toBeCloseTo(0.5)
    expect(y1).toBeCloseTo(1)
    expect(x2).toBeCloseTo(0.5)
    expect(y2).toBeCloseTo(0)
  })
})
