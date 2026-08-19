import { describe, it, expect } from 'vitest'
import { makeObject, type FObj } from '../../src/renderer/src/lib/freeformTypes'
import { layoutFrame, reflowAll, isFlex } from '../../src/renderer/src/lib/autoLayout'

const frame = (p: Partial<FObj>): FObj => ({ ...makeObject('frame', 0, 0), w: 400, h: 200, layoutMode: 'horizontal', layoutGap: 10, layoutPadX: 20, layoutPadY: 20, ...p })
const child = (id: string, p: Partial<FObj>): FObj => ({ ...makeObject('rect', 0, 0), id, w: 50, h: 50, parent: 'F', ...p })

describe('isFlex', () => {
  it('is true only for frames with a layout mode', () => {
    expect(isFlex(frame({ layoutMode: 'horizontal' }))).toBe(true)
    expect(isFlex(frame({ layoutMode: 'none' }))).toBe(false)
    expect(isFlex(makeObject('rect', 0, 0))).toBe(false)
  })
})

describe('layoutFrame horizontal', () => {
  const f = frame({ x: 100, y: 100 })
  const kids = [child('a', { x: 0 }), child('b', { x: 999 }), child('c', { x: 500 })]
  const { children } = layoutFrame(f, kids)
  it('orders children by main-axis position and packs with gap + padding', () => {
    const a = children.find((c) => c.id === 'a')!
    const c = children.find((c) => c.id === 'c')!
    const b = children.find((c) => c.id === 'b')!
    expect(a.x).toBe(120) // frame.x(100) + padX(20)
    expect(c.x).toBe(180) // a + 50 + gap 10
    expect(b.x).toBe(240) // c + 50 + gap 10
    expect(a.y).toBe(120) // frame.y(100) + padY(20)
  })
})

describe('layoutFrame fit + alignment', () => {
  it('hugs content when width is fit', () => {
    const f = frame({ widthMode: 'fit', heightMode: 'fit' })
    const { size } = layoutFrame(f, [child('a', { x: 0 }), child('b', { x: 100 })])
    expect(size.w).toBe(50 + 50 + 10 + 40) // two children + gap + 2*padX
    expect(size.h).toBe(50 + 40) // child + 2*padY
  })
  it('centers on the cross axis', () => {
    const f = frame({ h: 200, layoutAlign: 'center' })
    const { children } = layoutFrame(f, [child('a', { x: 0, h: 50 })])
    // inner cross = 200 - 40 = 160; (160-50)/2 = 55; + padY 20 = 75
    expect(children[0].y).toBe(f.y + 75)
  })
})

describe('layoutFrame child fill', () => {
  it('grows a fill child to share leftover main space', () => {
    const f = frame({ w: 400, layoutJustify: 'start' })
    const kids = [child('a', { x: 0, w: 50 }), child('b', { x: 100, w: 50, widthMode: 'fill' })]
    const { children } = layoutFrame(f, kids)
    const b = children.find((c) => c.id === 'b')!
    // inner = 400-40 = 360; fixed = 50 + gap 10 -> leftover 300 for b
    expect(b.w).toBe(300)
  })
})

describe('reflowAll', () => {
  it('returns the same reference when nothing flex exists', () => {
    const os = [makeObject('rect', 0, 0)]
    expect(reflowAll(os)).toBe(os)
  })
  it('repositions children of a flex frame and is idempotent', () => {
    const f = frame({ id: 'F', x: 0, y: 0 })
    const os: FObj[] = [f, child('a', { x: 9 }), child('b', { x: 9 })]
    const out = reflowAll(os)
    expect(out).not.toBe(os)
    const a = out.find((o) => o.id === 'a')!
    expect(a.x).toBe(20)
    // second pass: already laid out -> same reference
    expect(reflowAll(out)).toBe(out)
  })
})

describe('layoutFrame grid', () => {
  it('packs children row-major into uniform cells and hugs', () => {
    const f = frame({ x: 0, y: 0, layoutMode: 'grid', layoutGap: 10, layoutPadX: 20, layoutPadY: 20, widthMode: 'fit', heightMode: 'fit', layoutCols: 2 })
    const kids = [child('a', { x: 0, y: 0, w: 60, h: 40 }), child('b', { x: 100, y: 0, w: 50, h: 50 }), child('c', { x: 0, y: 100, w: 40, h: 40 })]
    const { children, size } = layoutFrame(f, kids)
    const byId = Object.fromEntries(children.map((c) => [c.id, c]))
    // cell = max(60,50,40) x max(40,50,40) = 60 x 50
    expect(byId.a.x).toBe(20); expect(byId.a.y).toBe(20)
    expect(byId.b.x).toBe(20 + 60 + 10) // second column
    expect(byId.c.x).toBe(20); expect(byId.c.y).toBe(20 + 50 + 10) // wraps to row 2
    // 2 cols, 2 rows -> w = 40 + 2*60 + 10 ; h = 40 + 2*50 + 10
    expect(size.w).toBe(20 * 2 + 60 * 2 + 10)
    expect(size.h).toBe(20 * 2 + 50 * 2 + 10)
  })
})

describe('layoutFrame wrap', () => {
  it('wraps horizontal children onto a new line when they overflow', () => {
    const f = frame({ x: 0, y: 0, layoutMode: 'horizontal', layoutWrap: true, w: 150, layoutGap: 10, layoutPadX: 10, layoutPadY: 10, heightMode: 'fit' })
    const kids = [child('a', { x: 0, w: 60, h: 30 }), child('b', { x: 70, w: 60, h: 30 }), child('c', { x: 140, w: 60, h: 30 })]
    const { children, size } = layoutFrame(f, kids)
    const byId = Object.fromEntries(children.map((c) => [c.id, c]))
    // inner width 150-20=130: a(60)+gap+b(60)=130 fits; c wraps
    expect(byId.a.y).toBe(byId.b.y)
    expect(byId.c.y).toBeGreaterThan(byId.a.y)
    expect(byId.c.x).toBe(10)
    // two rows of height 30 + gap 10 + 2*pad 20
    expect(size.h).toBe(10 * 2 + 30 * 2 + 10)
  })
})
