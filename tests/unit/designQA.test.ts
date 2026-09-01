import { describe, it, expect } from 'vitest'
import { lintObjects, contrastRatio, readableInk, readablePair } from '../../src/renderer/src/lib/designQA'
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

describe('readablePair', () => {
  it('leaves a background alone when an ink already clears the bar', () => {
    for (const bg of ['#ffffff', '#000000', '#0f766e', '#1d4ed8']) {
      const p = readablePair(bg)
      expect(p.bg, bg).toBe(bg)
      expect(contrastRatio(p.ink, p.bg), bg).toBeGreaterThanOrEqual(4.5)
    }
  })

  // 339 of a 4096-colour sweep clear neither ink. readableInk returns the
  // better of the two with no floor, so a mid green like this used to hand back
  // text at 3.4:1 and call it done.
  it('shifts a background no ink could sit on', () => {
    const bg = '#008800'
    expect(contrastRatio(readableInk(bg), bg)).toBeLessThan(4.5)
    const p = readablePair(bg)
    expect(p.bg).not.toBe(bg)
    expect(contrastRatio(p.ink, p.bg)).toBeGreaterThanOrEqual(4.5)
  })

  it('always reaches the bar, whatever it is handed', () => {
    for (let r = 0; r < 256; r += 51) {
      for (let g = 0; g < 256; g += 51) {
        for (let b = 0; b < 256; b += 51) {
          const bg = `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`
          const p = readablePair(bg)
          expect(contrastRatio(p.ink, p.bg), bg).toBeGreaterThanOrEqual(4.5)
        }
      }
    }
  })

  it('moves the background, never the brand hue, and no further than it must', () => {
    const p = readablePair('#008800')
    // still recognisably the same green: red stays the smallest channel and
    // green the largest.
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(p.bg.slice(i, i + 2), 16))
    expect(r).toBeLessThan(g)
    expect(b).toBeLessThanOrEqual(g)
    expect(contrastRatio(p.ink, p.bg)).toBeLessThan(9)
  })

  it('honours a stricter bar when asked', () => {
    const p = readablePair('#0f766e', 7)
    expect(contrastRatio(p.ink, p.bg)).toBeGreaterThanOrEqual(7)
  })
})

describe('bgBehind — what is really behind the text', () => {
  // The generated dashboard drew a white label on a green button as BLACK: the
  // label hung off the top bar, the button was only a sibling, so the contrast
  // pass measured the label against the white page and "repaired" it.
  it('keeps light text light when a filled button sits under it', () => {
    const page = obj({ id: 'page', type: 'frame', x: 0, y: 0, w: 800, h: 600, fill: '#ffffff', fillEnabled: true })
    const bar = obj({ id: 'bar', type: 'frame', parent: 'page', x: 0, y: 0, w: 800, h: 64, fillEnabled: false })
    const btn = obj({ id: 'btn', type: 'frame', parent: 'bar', x: 600, y: 8, w: 150, h: 44, fill: '#0f766e', fillEnabled: true })
    const label = obj({ id: 'label', type: 'text', parent: 'bar', x: 600, y: 22, w: 150, h: 16, text: 'Download report', color: '#f9fafb', fontSize: 14 })
    const out = lintObjects([page, bar, btn, label], { artboardBg: '#ffffff' })
    expect(out.find((o) => o.id === 'label')!.color).toBe('#f9fafb')
  })

  it('still repairs text that genuinely sits on the page', () => {
    const page = obj({ id: 'page', type: 'frame', x: 0, y: 0, w: 800, h: 600, fill: '#ffffff', fillEnabled: true })
    const label = obj({ id: 'label', type: 'text', parent: 'page', x: 20, y: 300, w: 200, h: 16, text: 'Hi', color: '#f9fafb', fontSize: 14 })
    const out = lintObjects([page, label], { artboardBg: '#ffffff' })
    expect(out.find((o) => o.id === 'label')!.color).toBe('#111827')
  })

  it('ignores a fill that does not enclose the text', () => {
    const page = obj({ id: 'page', type: 'frame', x: 0, y: 0, w: 800, h: 600, fill: '#ffffff', fillEnabled: true })
    const btn = obj({ id: 'btn', type: 'frame', parent: 'page', x: 0, y: 0, w: 100, h: 40, fill: '#0f766e', fillEnabled: true })
    const label = obj({ id: 'label', type: 'text', parent: 'page', x: 300, y: 300, w: 200, h: 16, text: 'Hi', color: '#f9fafb', fontSize: 14 })
    const out = lintObjects([page, btn, label], { artboardBg: '#ffffff' })
    expect(out.find((o) => o.id === 'label')!.color).toBe('#111827')
  })
})
