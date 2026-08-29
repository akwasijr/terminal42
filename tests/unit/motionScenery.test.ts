import { describe, it, expect } from 'vitest'
import { drawPictures, drawShapes, shapePath } from '../../src/renderer/src/lib/motion/backdrop'
import { resolvedPictureLayers, resolvedShapeLayers } from '../../src/shared/motion/frame'
import { emptyDoc } from '../../src/shared/motion/defaults'
import type { MotionDoc, PictureLayer, ShapeLayer } from '../../src/shared/motion/types'

// jsdom has no working 2D canvas, so the drawing code is exercised against a
// stand-in that records what was asked of it. What matters here is not the
// pixels but the geometry: whether a shape lands where the percentages say,
// whether a picture is clipped before it is drawn, and whether an empty slot
// paints something rather than nothing.
class FakeCtx {
  calls: Array<{ op: string; args: number[] }> = []
  globalAlpha = 1
  fillStyle = '#000000'
  strokeStyle = '#000000'
  lineWidth = 1
  font = ''
  textAlign = ''
  textBaseline = ''
  private tx = 0
  private ty = 0

  private log(op: string, ...args: number[]): void {
    this.calls.push({ op, args })
  }

  save(): void { this.log('save') }
  restore(): void { this.log('restore') }
  beginPath(): void { this.log('beginPath') }
  closePath(): void { this.log('closePath') }
  clip(): void { this.log('clip') }
  fill(): void { this.log('fill') }
  stroke(): void { this.log('stroke') }
  translate(x: number, y: number): void { this.tx = x; this.ty = y; this.log('translate', x, y) }
  rotate(a: number): void { this.log('rotate', a) }
  rect(x: number, y: number, w: number, h: number): void { this.log('rect', x, y, w, h) }
  roundRect(x: number, y: number, w: number, h: number, r: number): void { this.log('roundRect', x, y, w, h, r) }
  ellipse(cx: number, cy: number, rx: number, ry: number): void { this.log('ellipse', cx, cy, rx, ry) }
  arc(cx: number, cy: number, r: number): void { this.log('arc', cx, cy, r) }
  moveTo(x: number, y: number): void { this.log('moveTo', x, y) }
  lineTo(x: number, y: number): void { this.log('lineTo', x, y) }
  drawImage(_img: unknown, x: number, y: number, w: number, h: number): void { this.log('drawImage', x, y, w, h) }
  fillText(_t: string, x: number, y: number): void { this.log('fillText', x, y) }
  measureText(t: string): { width: number } { return { width: t.length * 6 } }

  ops(): string[] { return this.calls.map((c) => c.op) }
  find(op: string): { op: string; args: number[] } | undefined { return this.calls.find((c) => c.op === op) }
  at(): { x: number; y: number } { return { x: this.tx, y: this.ty } }
}

function ctx(): FakeCtx & CanvasRenderingContext2D {
  return new FakeCtx() as unknown as FakeCtx & CanvasRenderingContext2D
}

function shape(patch: Partial<ShapeLayer> = {}): ShapeLayer {
  return {
    id: 's1', kind: 'rect', width: 50, height: 25, x: 50, y: 50,
    rotation: 0, colour: '#ff0000', opacity: 100, ...patch
  }
}

function picture(patch: Partial<PictureLayer> = {}): PictureLayer {
  return {
    id: 'p1', mask: 'rect', width: 50, height: 25, x: 50, y: 50,
    rotation: 0, opacity: 100, fit: 'cover', ...patch
  }
}

function image(w: number, h: number): HTMLImageElement {
  return { complete: true, naturalWidth: w, naturalHeight: h } as HTMLImageElement
}

describe('shapePath', () => {
  it('draws a plain rectangle when no corner is asked for', () => {
    const c = ctx()
    shapePath(c, 'rect', 100, 50, 40, 20, 0)
    expect(c.find('rect')?.args).toEqual([80, 40, 40, 20])
    expect(c.find('roundRect')).toBeUndefined()
  })

  it('measures a corner against the shorter side, so a wide box is not over-rounded', () => {
    const c = ctx()
    shapePath(c, 'rect', 100, 50, 200, 20, 50)
    // Half of the shorter side (20), not of the longer one.
    expect(c.find('roundRect')?.args[4]).toBe(10)
  })

  it('gives a pill semicircular ends whatever the corner setting says', () => {
    const c = ctx()
    shapePath(c, 'pill', 0, 0, 100, 40, 0)
    expect(c.find('roundRect')?.args[4]).toBe(20)
  })

  it('centres an ellipse on the box it is given', () => {
    const c = ctx()
    shapePath(c, 'ellipse', 30, 60, 40, 20)
    expect(c.find('ellipse')?.args).toEqual([30, 60, 20, 10])
  })

  it('closes the arch and the triangle, so they can be filled', () => {
    for (const kind of ['arch', 'triangle', 'half'] as const) {
      const c = ctx()
      shapePath(c, kind, 0, 0, 40, 20)
      expect(c.ops(), kind).toContain('closePath')
    }
  })
})

describe('drawShapes', () => {
  it('places a shape by percentage of the frame', () => {
    const c = ctx()
    drawShapes(c, [shape({ x: 25, y: 80 })], 800, 400)
    expect(c.at()).toEqual({ x: 200, y: 320 })
    // 50% of 800 wide, 25% of 400 tall.
    expect(c.find('rect')?.args).toEqual([-200, -50, 400, 100])
  })

  it('multiplies opacity by how visible the layer is at this moment', () => {
    const c = ctx()
    // A window over the first half, so at three-quarters it is gone.
    drawShapes(c, [shape({ from: 0, to: 0.5 })], 800, 400, 0.75)
    expect(c.ops()).toEqual([])
  })

  it('skips a shape with no size rather than drawing a hairline', () => {
    const c = ctx()
    drawShapes(c, [shape({ width: 0 })], 800, 400)
    expect(c.ops()).toEqual([])
  })

  it('rotates about the shape\u2019s own centre', () => {
    const c = ctx()
    drawShapes(c, [shape({ rotation: 90 })], 800, 400)
    const order = c.ops()
    expect(order.indexOf('translate')).toBeLessThan(order.indexOf('rotate'))
    expect(c.find('rotate')?.args[0]).toBeCloseTo(Math.PI / 2, 6)
  })
})

describe('drawPictures', () => {
  it('clips to the mask before drawing, so the cut is what shows', () => {
    const c = ctx()
    const images = new Map([['img', image(100, 100)]])
    drawPictures(c, [picture({ imageId: 'img', mask: 'ellipse' })], images, 800, 400)
    const order = c.ops()
    expect(order.indexOf('ellipse')).toBeLessThan(order.indexOf('clip'))
    expect(order.indexOf('clip')).toBeLessThan(order.indexOf('drawImage'))
  })

  it('fills the mask on cover, losing the overflow', () => {
    const c = ctx()
    const images = new Map([['img', image(100, 100)]])
    // The box is 400x100; a square picture must scale to 400 to cover it.
    drawPictures(c, [picture({ imageId: 'img', fit: 'cover' })], images, 800, 400)
    expect(c.find('drawImage')?.args).toEqual([-200, -200, 400, 400])
  })

  it('shows the whole picture on contain, leaving the mask part empty', () => {
    const c = ctx()
    const images = new Map([['img', image(100, 100)]])
    drawPictures(c, [picture({ imageId: 'img', fit: 'contain' })], images, 800, 400)
    expect(c.find('drawImage')?.args).toEqual([-50, -50, 100, 100])
  })

  it('draws a marked placeholder for an empty slot rather than nothing', () => {
    const c = ctx()
    drawPictures(c, [picture({ placeholder: 'Portrait' })], new Map(), 800, 400)
    expect(c.ops()).toContain('fill')
    expect(c.ops()).toContain('fillText')
    expect(c.find('drawImage')).toBeUndefined()
  })

  it('leaves the empty slot unstroked, so a template is not full of crossed-out boxes', () => {
    const c = ctx()
    drawPictures(c, [picture({ placeholder: 'Portrait' })], new Map(), 800, 400)
    expect(c.ops()).not.toContain('stroke')
  })

  it('draws the placeholder when the named picture has not loaded', () => {
    const c = ctx()
    const images = new Map([['img', { complete: false, naturalWidth: 0, naturalHeight: 0 } as HTMLImageElement]])
    drawPictures(c, [picture({ imageId: 'img' })], images, 800, 400)
    expect(c.ops()).toContain('fillText')
    expect(c.find('drawImage')).toBeUndefined()
  })
})

describe('scenery keyframes', () => {
  function docWith(patch: Partial<MotionDoc['visual']>, keys: MotionDoc['keys']): MotionDoc {
    const d = emptyDoc()
    return { ...d, visual: { ...d.visual, ...patch }, keys }
  }

  it('reads a shape\u2019s width from its track', () => {
    const doc = docWith({ shapes: [shape({ width: 10 })] }, {
      'shape:s1:width': {
        keys: [
          { id: 'a', t: 0, v: 10 },
          { id: 'b', t: 0.5, v: 90 }
        ]
      }
    })
    expect(resolvedShapeLayers(doc, 0).at(0)?.width).toBeCloseTo(10, 4)
    expect(resolvedShapeLayers(doc, 0.5).at(0)?.width).toBeCloseTo(90, 4)
    const mid = resolvedShapeLayers(doc, 0.25).at(0)?.width ?? 0
    expect(mid).toBeGreaterThan(10)
    expect(mid).toBeLessThan(90)
  })

  it('leaves the layers alone when nothing is keyed, so nothing is allocated', () => {
    const layers = [shape()]
    const doc = docWith({ shapes: layers }, undefined)
    expect(resolvedShapeLayers(doc, 0.4)).toBe(layers)
  })

  it('treats a document written before scenery existed as having none', () => {
    const d = emptyDoc()
    expect(resolvedShapeLayers(d, 0.3)).toEqual([])
    expect(resolvedPictureLayers(d, 0.3)).toEqual([])
  })

  it('keys a picture on the same fields a shape uses', () => {
    const doc = docWith({ pictures: [picture({ opacity: 0 })] }, {
      'picture:p1:opacity': {
        keys: [
          { id: 'a', t: 0, v: 0 },
          { id: 'b', t: 0.5, v: 100 }
        ]
      }
    })
    expect(resolvedPictureLayers(doc, 0.5).at(0)?.opacity).toBeCloseTo(100, 4)
  })
})
