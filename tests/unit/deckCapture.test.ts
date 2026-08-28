// The capture module is mostly page script held as strings, and its
// behaviour is proved in deckChassis.browser.test.ts against a real engine.
// What is left over is the shape of those strings and the one function that
// builds a document rather than manipulating one — the print sheet, which no
// browser test can check because it only means anything to a PDF printer.

import { describe, it, expect } from 'vitest'
import {
  EXPORT_PREP_JS, SLIDE_COUNT_JS, IS_CHASSIS_JS,
  showSlideJs, buildSlidePdfHtml, DECK_CAPTURE_SIZE
} from '../../src/main/deckCapture'

describe('the export prep', () => {
  it('unfreezes every part of the chassis that starts hidden', () => {
    // Mirrors the chassis rule that holds these back until a slide arrives.
    for (const sel of [
      '.slide>.inner', '.slide-bg', '[data-reveal]', '.reason', '.card', '.tile',
      '.stat', '.recap li', '.outrow .item', '.display .w', '.figure', '.specimen',
      '.slide.bleed>.bleed-media'
    ]) {
      expect(EXPORT_PREP_JS, sel).toContain(sel)
    }
  })

  it('stops everything moving, so a capture is not a photograph of a transition', () => {
    expect(EXPORT_PREP_JS).toContain('transition:none !important')
    expect(EXPORT_PREP_JS).toContain('animation:none !important')
  })

  it('gives a bar back its height rather than flattening it', () => {
    // "transform:none" on a bar means scaleY(1) is lost and the chart is a line.
    expect(EXPORT_PREP_JS).toContain('.bar>.col{transform:scaleY(1) !important}')
  })

  it('drops the controls but keeps the printed furniture', () => {
    expect(EXPORT_PREP_JS).toContain('.nav-cluster')
    expect(EXPORT_PREP_JS).toContain('.tile-detail')
    expect(EXPORT_PREP_JS).toContain('.carousel-bar')
    expect(EXPORT_PREP_JS).not.toContain('.frame,')
    expect(EXPORT_PREP_JS).not.toContain('.frame{')
  })

  it('runs once, however many times it is called', () => {
    expect(EXPORT_PREP_JS).toContain("getElementById('deck-export-prep')")
  })
})

describe('showSlideJs', () => {
  it('moves the scroll container, not the window', () => {
    // window.scrollTo is what the old exporter used, and it does nothing to a
    // deck: every slide came out as the same frame.
    const js = showSlideJs(3)
    expect(js).toContain('deck.scrollLeft = 3 * deck.clientWidth')
    expect(js).not.toContain('window.scrollTo')
  })

  it('falls back to the window for a deck that is a plain stack', () => {
    expect(showSlideJs(1)).toContain('scrollIntoView')
  })

  it('puts exactly the wanted slide in view', () => {
    expect(showSlideJs(2)).toContain("toggle('in-view', n === 2)")
  })

  it('keeps the printed slide number in step', () => {
    expect(showSlideJs(0)).toContain(".deck-num")
    expect(showSlideJs(0)).toContain("padStart(2, '0')")
  })

  it('cannot be talked into a broken index', () => {
    expect(showSlideJs(-4)).toContain('slides[0]')
    expect(showSlideJs(2.7)).toContain('slides[2]')
  })

  it('is a single expression, so executeJavaScript returns its answer', () => {
    for (const js of [showSlideJs(0), EXPORT_PREP_JS, SLIDE_COUNT_JS, IS_CHASSIS_JS]) {
      expect(js.trim().startsWith('(')).toBe(true)
      expect(js.trim().endsWith(')')).toBe(true)
    }
  })
})

describe('the printable sheet', () => {
  const png = (n: number): string[] =>
    Array.from({ length: n }, (_, i) => `data:image/png;base64,AAA${i}`)

  it('gives the PDF one page per slide', () => {
    const html = buildSlidePdfHtml(png(7), DECK_CAPTURE_SIZE)
    expect((html.match(/class="p"/g) ?? []).length).toBe(7)
    expect(html).toContain('break-after:page')
    // Otherwise the last slide is followed by a blank page.
    expect(html).toContain('.p:last-child{break-after:auto')
  })

  it('sizes the page to the slide, so nothing is cropped or letterboxed', () => {
    const html = buildSlidePdfHtml(png(2), { width: 1920, height: 1080 })
    expect(html).toContain('@page{size:1920px 1080px;margin:0}')
    expect(html).toContain('width:1920px;height:1080px')
    expect(html).toContain('object-fit:contain')
  })

  it('carries every picture it was handed, in order', () => {
    const html = buildSlidePdfHtml(png(3), DECK_CAPTURE_SIZE)
    expect(html.indexOf('AAA0')).toBeLessThan(html.indexOf('AAA1'))
    expect(html.indexOf('AAA1')).toBeLessThan(html.indexOf('AAA2'))
  })

  it('survives a deck of one slide', () => {
    const html = buildSlidePdfHtml(png(1), DECK_CAPTURE_SIZE)
    expect((html.match(/class="p"/g) ?? []).length).toBe(1)
  })

  it('captures a deck at its own size and 16:9', () => {
    expect(DECK_CAPTURE_SIZE.width / DECK_CAPTURE_SIZE.height).toBeCloseTo(16 / 9, 5)
    // PowerPoint's wide layout is 1280 CSS px; anything less is upscaled.
    expect(DECK_CAPTURE_SIZE.width).toBeGreaterThanOrEqual(1920)
  })
})
