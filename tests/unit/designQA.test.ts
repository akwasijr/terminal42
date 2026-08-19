import { describe, it, expect } from 'vitest'
import { lintObjects, contrastRatio, readableInk } from '../../src/renderer/src/lib/designQA'
import { makeObject, type FObj } from '../../src/renderer/src/lib/freeformTypes'
import { ICON_PATHS } from '../../src/renderer/src/lib/icons24'

const obj = (p: Partial<FObj>): FObj => ({ ...makeObject('rect', 0, 0), ...p })

describe('lintObjects — geometry', () => {
  it('snaps x/y/w/h to the 4px grid', () => {
    const [o] = lintObjects([obj({ id: 'a', x: 13, y: 7, w: 99, h: 51 })])
    expect(o.x).toBe(12); expect(o.y).toBe(8); expect(o.w).toBe(100); expect(o.h).toBe(52)
  })
  it('snaps radius to the allowed scale', () => {
    expect(lintObjects([obj({ id: 'a', radius: 7 })])[0].radius).toBe(6)
    expect(lintObjects([obj({ id: 'a', radius: 23 })])[0].radius).toBe(24)
  })
})

describe('lintObjects — icons', () => {
  const iconPath = (p: Partial<FObj>): FObj => obj({ type: 'path', path: 'M1 1L9 9', pathViewBox: '0 0 1 1', w: 22, h: 22, ...p })
  it('swaps a hand-drawn icon-shaped path for crisp library geometry by name', () => {
    const [o] = lintObjects([iconPath({ id: 'i', name: 'Search' })])
    expect(o.path).toBe(ICON_PATHS.search)
    expect(o.pathViewBox).toBe('0 0 24 24')
    expect(o.fillEnabled).toBe(false)
    expect(o.strokeEnabled).toBe(true)
  })
  it('resolves a synonym name (cart → bag)', () => {
    expect(lintObjects([iconPath({ id: 'i', name: 'cart' })])[0].path).toBe(ICON_PATHS.bag)
  })
  it('leaves a large freehand drawing alone (not icon-shaped)', () => {
    const d = 'M2 2L9 9'
    const [o] = lintObjects([iconPath({ id: 'd', name: 'Drawing 1', w: 300, h: 180, path: d })])
    expect(o.path).toBe(d)
  })
  it('leaves an icon-shaped path with an unrecognisable name alone', () => {
    const d = 'M3 3L7 7'
    const [o] = lintObjects([iconPath({ id: 'i', name: 'squiggle', path: d })])
    expect(o.path).toBe(d)
  })
  it('gives a hand-drawn icon path (no viewBox) a square viewBox so it never skews', () => {
    const [o] = lintObjects([iconPath({ id: 'i', name: 'doodle', path: 'M4 4L20 4L12 20Z', pathViewBox: undefined })])
    expect(o.pathViewBox).toBeTruthy()
    const p = o.pathViewBox!.split(' ').map(Number)
    expect(p[2]).toBeCloseTo(p[3], 5) // width === height (square → uniform scale)
  })
  it('leaves a normalised pencil path (0..1 coords, no viewBox) alone', () => {
    const [o] = lintObjects([iconPath({ id: 'd', name: 'Drawing 1', path: 'M0.1 0.1L0.9 0.9', pathViewBox: undefined, w: 40, h: 30 })])
    expect(o.pathViewBox).toBeFalsy()
  })
  it('respects a path lock', () => {
    const d = 'M1 1L2 2'
    const [o] = lintObjects([iconPath({ id: 'i', name: 'Search', path: d })], { locked: (id, f) => id === 'i' && f === 'path' })
    expect(o.path).toBe(d)
  })
})

describe('lintObjects — type + contrast', () => {  it('snaps font size to the type scale', () => {
    const [o] = lintObjects([obj({ id: 't', type: 'text', text: 'Hi', fontSize: 17 })])
    expect(o.fontSize).toBe(16)
  })
  it('fixes unreadable text colour against the artboard background', () => {
    const [o] = lintObjects([obj({ id: 't', type: 'text', text: 'Hi', color: '#ffffff' })], { artboardBg: '#ffffff' })
    expect(contrastRatio(o.color!, '#ffffff')).toBeGreaterThan(4.5)
    expect(o.color).toBe('#111827')
  })
  it('uses the nearest ancestor fill as the background for contrast', () => {
    const frame = obj({ id: 'f', type: 'frame', fill: '#111827', fillEnabled: true })
    const txt = obj({ id: 't', type: 'text', text: 'Hi', color: '#222222', parent: 'f' })
    const out = lintObjects([frame, txt], { artboardBg: '#ffffff' })
    expect(out[1].color).toBe('#f9fafb') // dark frame → light ink
  })
  it('leaves already-readable text alone', () => {
    const [o] = lintObjects([obj({ id: 't', type: 'text', text: 'Hi', color: '#111111' })], { artboardBg: '#ffffff' })
    expect(o.color).toBe('#111111')
  })
})

describe('lintObjects — intent lock', () => {
  it('never touches a locked field', () => {
    const [o] = lintObjects([obj({ id: 'a', x: 13, w: 99 })], { locked: (id, f) => id === 'a' && (f === 'x' || f === 'w') })
    expect(o.x).toBe(13); expect(o.w).toBe(99)
  })
})

describe('lintObjects — no container outlines', () => {
  it('strips strokes from container frames but keeps leaf borders', () => {
    const card = obj({ id: 'card', type: 'frame', strokeEnabled: true, stroke: '#e5e7eb' })
    const child = obj({ id: 'c', type: 'text', parent: 'card', text: 'x' })
    const input = obj({ id: 'inp', type: 'frame', strokeEnabled: true, stroke: '#e5e7eb' })
    const [c, , i] = lintObjects([card, child, input])
    expect(c.strokeEnabled).toBe(false) // container outline removed
    expect(i.strokeEnabled).toBe(true)  // leaf (input/toggle) border kept
  })
})

describe('lintObjects — production invariants (always-on gate)', () => {
  it('normalises an adversarial design to meet every guarantee', () => {
    const btn = obj({ id: 'btn', type: 'frame', x: 20, y: 700, w: 300, h: 52, radius: 14, fill: '#374151', fillEnabled: true })
    const lbl = obj({ id: 'lbl', type: 'text', parent: 'btn', text: 'Save', color: '#ffffff', fontWeight: 600, x: 20, y: 716, w: 300, h: 20 })
    const card = obj({ id: 'card', type: 'frame', strokeEnabled: true, stroke: '#e5e7eb', x: 13, y: 7, w: 200, h: 100, radius: 17 })
    const cardTxt = obj({ id: 'ct', type: 'text', parent: 'card', text: 'hi', color: '#ffffff' })
    const out = lintObjects([btn, lbl, card, cardTxt], { accent: '#0f766e', artboardBg: '#ffffff' })
    const m = Object.fromEntries(out.map((o) => [o.id, o]))
    expect(m.btn.fill).toBe('#0f766e')        // grey primary recoloured to the accent
    expect(m.card.strokeEnabled).toBe(false)  // container outline stripped
    expect(m.card.x).toBe(12)                 // snapped to the 4px grid
    expect(m.card.radius).toBe(16)            // 17 -> nearest scale step
    expect(m.ct.color).toBe('#111827')        // unreadable white-on-white fixed
  })
})

describe('colour helpers', () => {
  it('computes contrast and picks readable ink', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(readableInk('#ffffff')).toBe('#111827')
    expect(readableInk('#111827')).toBe('#f9fafb')
  })
})
