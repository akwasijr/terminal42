import { describe, it, expect } from 'vitest'
import { applyLayerTransform, layerScaleVisible } from '../../src/renderer/src/lib/motion/layerTransform'
import type { LayerTransform } from '../../src/shared/motion/types'

/**
 * A context that keeps a real 2D matrix, so a transform can be checked by
 * asking where a point ends up rather than by reading back the calls that
 * were made to produce it. What matters about a rotation is where the corner
 * lands, not that `rotate` was called.
 */
class Matrix {
  m = [1, 0, 0, 1, 0, 0]
  translate(x: number, y: number): void { this.mul([1, 0, 0, 1, x, y]) }
  scale(x: number, y: number): void { this.mul([x, 0, 0, y, 0, 0]) }
  rotate(a: number): void {
    this.mul([Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0])
  }
  private mul(n: number[]): void {
    const m = this.m
    this.m = [
      m[0] * n[0] + m[2] * n[1],
      m[1] * n[0] + m[3] * n[1],
      m[0] * n[2] + m[2] * n[3],
      m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4],
      m[1] * n[4] + m[3] * n[5] + m[5]
    ]
  }
  at(x: number, y: number): { x: number; y: number } {
    const [a, b, c, d, e, f] = this.m
    return { x: a * x + c * y + e, y: b * x + d * y + f }
  }
}

const BOX = { cx: 100, cy: 100, w: 40, h: 20 }

function place(layer: LayerTransform, x = 0, y = 0, box = BOX): { x: number; y: number } {
  const ctx = new Matrix()
  applyLayerTransform(ctx as unknown as CanvasRenderingContext2D, layer, box)
  const p = ctx.at(x, y)
  return { x: round(p.x), y: round(p.y) }
}

const round = (v: number): number => Math.round(v * 1000) / 1000

describe('a layer with nothing set is where it always was', () => {
  it('puts the middle of the layer on its x and y', () => {
    expect(place({})).toEqual({ x: 100, y: 100 })
  })

  it('leaves the corners alone', () => {
    expect(place({}, -20, -10)).toEqual({ x: 80, y: 90 })
    expect(place({}, 20, 10)).toEqual({ x: 120, y: 110 })
  })

  it('treats an explicit centre anchor as no anchor at all', () => {
    expect(place({ anchor: { x: 0.5, y: 0.5 } }, -20, -10)).toEqual(place({}, -20, -10))
  })
})

describe('rotation', () => {
  it('turns a quarter clockwise about the middle', () => {
    // The right edge goes to the bottom, which is clockwise on a canvas
    // whose y grows downwards.
    expect(place({ rotation: 90 }, 20, 0)).toEqual({ x: 100, y: 120 })
  })

  it('leaves the anchor itself exactly where it was', () => {
    for (const rotation of [0, 37, 90, 180, 270]) {
      expect(place({ rotation }, 0, 0)).toEqual({ x: 100, y: 100 })
    }
  })

  it('swings about a corner when the anchor is moved to it', () => {
    // Anchor at the top left, which sits at (80, 90) with this box.
    const anchor = { x: 0, y: 0 }
    // Moving the anchor must not move the layer while nothing is turned.
    expect(place({ anchor }, 0, 0)).toEqual({ x: 100, y: 100 })
    // And the corner it now turns about stays put.
    expect(place({ anchor, rotation: 90 }, -20, -10)).toEqual({ x: 80, y: 90 })
    expect(place({ anchor, rotation: 180 }, -20, -10)).toEqual({ x: 80, y: 90 })
  })

  it('is a full turn at 360', () => {
    expect(place({ rotation: 360 }, 20, 10)).toEqual(place({}, 20, 10))
  })
})

describe('scale', () => {
  it('does nothing at 100', () => {
    expect(place({ scale: 100 }, 20, 10)).toEqual(place({}, 20, 10))
  })

  it('grows and shrinks about the middle', () => {
    expect(place({ scale: 200 }, 20, 10)).toEqual({ x: 140, y: 120 })
    expect(place({ scale: 50 }, 20, 10)).toEqual({ x: 110, y: 105 })
  })

  it('keeps both axes together, so nothing is stretched out of shape', () => {
    const p = place({ scale: 200 }, 10, 10)
    expect(p.x - 100).toBe(p.y - 100)
  })

  it('grows away from the anchor when the anchor is a corner', () => {
    const anchor = { x: 0, y: 0 }
    expect(place({ anchor, scale: 200 }, -20, -10)).toEqual({ x: 80, y: 90 })
  })

  it('reports a collapsed layer rather than drawing nothing at cost', () => {
    expect(layerScaleVisible({})).toBe(true)
    expect(layerScaleVisible({ scale: 100 })).toBe(true)
    expect(layerScaleVisible({ scale: 1 })).toBe(true)
    expect(layerScaleVisible({ scale: 0 })).toBe(false)
  })
})

describe('rotation and scale together', () => {
  it('scales first and then turns, so a turned layer keeps its size', () => {
    // Half size then a quarter turn: the right edge is 10 away, and lands
    // below the middle.
    expect(place({ scale: 50, rotation: 90 }, 20, 0)).toEqual({ x: 100, y: 110 })
  })

  it('still holds the anchor still', () => {
    expect(place({ scale: 250, rotation: 42, anchor: { x: 1, y: 1 } }, 20, 10))
      .toEqual({ x: 120, y: 110 })
  })
})
