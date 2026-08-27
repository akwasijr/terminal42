// Where a flat layer is, and what is under the pointer.
//
// The measurement itself belongs to the browser, so it is stubbed with a fixed
// advance per character: what is being checked here is the arithmetic around
// it — which side of the anchor a block hangs from, where a multi-line block's
// middle is, and which of two overlapping layers a click means.

import { describe, expect, it } from 'vitest'
import { emptyDoc } from '../../src/shared/motion/defaults'
import type { MotionDoc, TextLayer } from '../../src/shared/motion/types'
import { overlayBoxes, pickOverlay, textBox } from '../../src/renderer/src/lib/motion/overlayPick'

/** A context that measures every character as exactly half the type size. */
function fakeCtx(): CanvasRenderingContext2D {
  let font = '10px sans'
  return {
    save() { /* nothing to keep */ },
    restore() { /* nothing to put back */ },
    set font(v: string) { font = v },
    get font() { return font },
    measureText(s: string) {
      const px = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 10)
      return { width: s.length * px * 0.5 } as TextMetrics
    },
    canvas: { width: 1000, height: 1000 }
  } as unknown as CanvasRenderingContext2D
}

function docWith(text: TextLayer[]): MotionDoc {
  const d = emptyDoc()
  return { ...d, visual: { ...d.visual, text } }
}

const layer = (over: Partial<TextLayer> = {}): TextLayer => ({
  id: over.id ?? 'a', text: 'abcd', size: 10, colour: '#fff', x: 50, y: 50, ...over
})

describe('textBox', () => {
  it('centres the block on the anchor by default', () => {
    // 10% of 1000 is 100px type; four characters at half that is 200px wide.
    const box = textBox(fakeCtx(), layer(), 1000, 1000, 0)
    expect(box).toEqual({ x: 400, y: 450, w: 200, h: 100 })
  })

  it('hangs the block to the right of the anchor when left aligned', () => {
    const box = textBox(fakeCtx(), layer({ align: 'left' }), 1000, 1000, 0)
    expect(box?.x).toBe(500)
  })

  it('hangs the block to the left of the anchor when right aligned', () => {
    const box = textBox(fakeCtx(), layer({ align: 'right' }), 1000, 1000, 0)
    expect(box?.x).toBe(300)
  })

  it('measures a block by its widest line and keeps it centred on the anchor', () => {
    const box = textBox(fakeCtx(), layer({ text: 'ab\nabcdef' }), 1000, 1000, 0)
    expect(box?.w).toBe(300)
    // Two lines at 1.2em: the box is 100 + 120 tall, still middled on y.
    expect(box?.h).toBe(220)
    expect(box && box.y + box.h / 2).toBe(500)
  })

  it('has no box for a layer with nothing in it', () => {
    expect(textBox(fakeCtx(), layer({ text: '   ' }), 1000, 1000, 0)).toBeNull()
  })

  it('has no box for a layer that is invisible', () => {
    expect(textBox(fakeCtx(), layer({ opacity: 0 }), 1000, 1000, 0)).toBeNull()
  })

  it('has no box outside the layer\u2019s own window in the loop', () => {
    const l = layer({ from: 0.6, to: 0.9 })
    expect(textBox(fakeCtx(), l, 1000, 1000, 0.7)).not.toBeNull()
    expect(textBox(fakeCtx(), l, 1000, 1000, 0.2)).toBeNull()
  })
})

describe('pickOverlay', () => {
  const doc = docWith([layer({ id: 'under' }), layer({ id: 'over' })])

  it('finds nothing on empty backdrop', () => {
    expect(pickOverlay(fakeCtx(), doc, new Map(), 1000, 1000, 0, 20, 20)).toBeNull()
  })

  it('gives the topmost layer when two overlap', () => {
    // Both are at the same place; the one painted last is the one seen.
    expect(pickOverlay(fakeCtx(), doc, new Map(), 1000, 1000, 0, 500, 500))
      .toEqual({ kind: 'text', id: 'over' })
  })

  it('forgives a click just outside a thin layer', () => {
    const one = docWith([layer({ id: 'a' })])
    // The box runs to x=600; three pixels past it is still that layer.
    expect(pickOverlay(fakeCtx(), one, new Map(), 1000, 1000, 0, 603, 500))
      .toEqual({ kind: 'text', id: 'a' })
    expect(pickOverlay(fakeCtx(), one, new Map(), 1000, 1000, 0, 640, 500)).toBeNull()
  })

  it('cannot pick a layer that is not on screen at this point in the loop', () => {
    const timed = docWith([layer({ id: 'a', from: 0.6, to: 0.9 })])
    expect(pickOverlay(fakeCtx(), timed, new Map(), 1000, 1000, 0.2, 500, 500)).toBeNull()
    expect(pickOverlay(fakeCtx(), timed, new Map(), 1000, 1000, 0.7, 500, 500))
      .toEqual({ kind: 'text', id: 'a' })
  })
})

describe('overlayBoxes', () => {
  it('lists layers in the order they are painted', () => {
    const doc = docWith([layer({ id: 'first' }), layer({ id: 'second', y: 20 })])
    expect(overlayBoxes(fakeCtx(), doc, new Map(), 1000, 1000, 0).map((b) => b.pick))
      .toEqual([{ kind: 'text', id: 'first' }, { kind: 'text', id: 'second' }])
  })

  it('skips a logo whose picture has not loaded', () => {
    const d = emptyDoc()
    const doc: MotionDoc = {
      ...d,
      visual: { ...d.visual, text: [], logos: [{ id: 'l', imageId: 'missing', size: 10, opacity: 100, x: 50, y: 50 }] }
    }
    expect(overlayBoxes(fakeCtx(), doc, new Map(), 1000, 1000, 0)).toEqual([])
  })
})
