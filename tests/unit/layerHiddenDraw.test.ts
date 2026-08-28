import { describe, expect, it } from 'vitest'
import { drawLogos, drawOverlay, drawPictures, drawShapes } from '../../src/renderer/src/lib/motion/backdrop'
import type { LogoLayer, PictureLayer, ShapeLayer, TextLayer } from '../../src/shared/motion/types'

/**
 * The eye, checked against the code that actually paints.
 *
 * `layerVisibility` returning 0 is only half the promise: something has to
 * read it. These call the four real draw functions — the same ones the stage,
 * the thumbnails and the exported frames all go through — with a context that
 * writes down what it was asked to do, and check that a hidden layer asks for
 * nothing at all.
 */

type Call = string

/**
 * Enough of a 2D context to be driven, and nothing more.
 *
 * Only the calls that put marks on the canvas are recorded. `save`, `restore`
 * and the transform calls happen either way and would drown the signal.
 */
function recorder(): { ctx: CanvasRenderingContext2D; marks: Call[] } {
  const marks: Call[] = []
  const mark = (name: string) => (): void => { marks.push(name) }
  const stub = {
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {},
    ellipse() {}, rect() {}, roundRect() {}, clip() {}, clearRect() {},
    fill: mark('fill'),
    stroke: mark('stroke'),
    fillRect: mark('fillRect'),
    fillText: mark('fillText'),
    drawImage: mark('drawImage'),
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    fillStyle: '', strokeStyle: '', font: '', letterSpacing: '',
    textAlign: '', textBaseline: '', globalAlpha: 1, lineWidth: 1,
    canvas: { width: 800, height: 450 }
  }
  return { ctx: stub as unknown as CanvasRenderingContext2D, marks }
}

/** An image the draw code will accept as loaded. */
const img = { complete: true, naturalWidth: 100, naturalHeight: 100, width: 100, height: 100 } as HTMLImageElement

const text = (over: Partial<TextLayer> = {}): TextLayer =>
  ({ id: 't1', text: 'Hello', size: 10, colour: '#ffffff', x: 50, y: 50, ...over })
const logo = (over: Partial<LogoLayer> = {}): LogoLayer =>
  ({ id: 'g1', imageId: 'i1', size: 10, opacity: 100, x: 50, y: 50, ...over })
const shape = (over: Partial<ShapeLayer> = {}): ShapeLayer =>
  ({ id: 's1', kind: 'rect', width: 20, height: 20, x: 50, y: 50, rotation: 0, colour: '#ff0000', opacity: 100, ...over })
const picture = (over: Partial<PictureLayer> = {}): PictureLayer =>
  ({ id: 'p1', imageId: 'i1', width: 20, height: 20, x: 50, y: 50, rotation: 0, colour: '#ff0000', opacity: 100, mask: 'none', fit: 'cover', ...over })

const images = new Map<string, HTMLImageElement>([['i1', img]])

describe('a hidden layer is not painted', () => {
  it('draws text when it is not hidden, and nothing when it is', () => {
    const a = recorder()
    drawOverlay(a.ctx, [text()], 800, 450, 0)
    expect(a.marks.length).toBeGreaterThan(0)

    const b = recorder()
    drawOverlay(b.ctx, [text({ hidden: true })], 800, 450, 0)
    expect(b.marks).toEqual([])
  })

  it('draws a logo when it is not hidden, and nothing when it is', () => {
    const a = recorder()
    drawLogos(a.ctx, [logo()], images, 800, 450, 0)
    expect(a.marks.length).toBeGreaterThan(0)

    const b = recorder()
    drawLogos(b.ctx, [logo({ hidden: true })], images, 800, 450, 0)
    expect(b.marks).toEqual([])
  })

  it('draws a shape when it is not hidden, and nothing when it is', () => {
    const a = recorder()
    drawShapes(a.ctx, [shape()], 800, 450, 0)
    expect(a.marks.length).toBeGreaterThan(0)

    const b = recorder()
    drawShapes(b.ctx, [shape({ hidden: true })], 800, 450, 0)
    expect(b.marks).toEqual([])
  })

  it('draws a picture when it is not hidden, and nothing when it is', () => {
    const a = recorder()
    drawPictures(a.ctx, [picture()], images, 800, 450, 0)
    expect(a.marks.length).toBeGreaterThan(0)

    const b = recorder()
    drawPictures(b.ctx, [picture({ hidden: true })], images, 800, 450, 0)
    expect(b.marks).toEqual([])
  })

  it('leaves its neighbours alone', () => {
    // The one that matters: hiding a layer must not take the layer next to it
    // with it, which is what a mis-scoped `continue` would do.
    const all = recorder()
    drawShapes(all.ctx, [shape({ id: 'a' }), shape({ id: 'b' }), shape({ id: 'c' })], 800, 450, 0)
    const one = recorder()
    drawShapes(one.ctx, [shape({ id: 'a' }), shape({ id: 'b', hidden: true }), shape({ id: 'c' })], 800, 450, 0)
    expect(one.marks.length).toBe((all.marks.length / 3) * 2)
  })
})
