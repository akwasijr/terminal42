// The chassis is CSS and JS shipped as strings. Every other test in this
// folder reads those strings; none of them runs them, and the interesting
// failures only exist once there is a browser.
//
// Three kinds of bug live here and nowhere else:
//   - layout that silently collapses (a percentage height with no definite
//     parent, so every bar in a chart comes out the same size),
//   - contrast that inverts (a slide turns its ground over and the fixed
//     brand above it stays the colour it was),
//   - the runtime eating markup it was supposed to preserve.
// All three shipped at some point and none was visible from the strings.
//
// Skipped rather than failed when the browser is not downloaded, so a fresh
// checkout does not fail the suite on something that is not the code's fault.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Browser, Page } from 'playwright'
import { buildDeckBaseBlock } from '../../src/main/deckChassis'
import { EXPORT_PREP_JS, SLIDE_COUNT_JS, showSlideJs, IS_CHASSIS_JS } from '../../src/main/deckCapture'

let browser: Browser | null = null
let page: Page | null = null

/** Every layout the usage doc documents, in one page. */
const SLIDES = `
<section class="slide cover" data-title="Cover"><div class="inner">
  <h1 class="display">A deck that <span class="accent">already</span> works.</h1>
  <div class="cover-meta"><span>Terminal 42</span><span>May 2026</span></div></div></section>

<section class="slide" data-title="Reasons"><div class="inner">
  <span class="eyebrow">Section 01</span><h2 class="display">Three reasons.</h2>
  <div class="reasonlist">
    <div class="reason" data-reveal="1"><span class="picto"></span><p>First.</p></div>
    <div class="reason" data-reveal="2"><span class="picto"></span><p>Second.</p></div>
    <div class="reason" data-reveal="3"><span class="picto"></span><p>Third.</p></div>
  </div></div></section>

<section class="slide" data-ground="invert" data-title="Growth"><div class="inner">
  <h2 class="display">Scaling <span class="accent">revenue</span> and <mark>margin</mark>.</h2>
  <div class="bars">
    <div class="bar" style="--v:28"><div class="col"><span class="v">31%</span></div><span class="k">Margin</span></div>
    <div class="bar" style="--v:55"><div class="col"><span class="v">$1.2B</span></div><span class="k">Fleet</span></div>
    <div class="bar on" style="--v:100"><div class="col"><span class="v">+218%</span></div><span class="k">Revenue</span></div>
    <div class="bar" style="--v:42"><div class="col"><span class="v">+44%</span></div><span class="k">Subs</span></div>
  </div></div></section>

<section class="slide" data-ground="accent" data-title="Palette"><div class="inner">
  <h2 class="display">Palette.</h2>
  <div class="swatches">
    <div class="swatch" data-hex="#B89457"><span class="nm">Harvest Gold</span><span class="hx">#B89457</span><span class="ro">Primary</span></div>
    <div class="swatch" data-hex="#432818"><span class="nm">Espresso</span><span class="hx">#432818</span><span class="ro">Secondary</span></div>
    <div class="swatch" data-hex="#FFE5A7"><span class="nm">Wheat Cream</span><span class="hx">#FFE5A7</span><span class="ro">Light</span></div>
  </div></div></section>

<section class="slide" data-title="Team"><div class="inner"><h2 class="display">Leadership.</h2>
  <div class="figures">
    <figure class="figure"><figcaption class="figcap"><span class="nm">Daniel Verhart</span><span class="ro">CEO</span></figcaption></figure>
    <figure class="figure"><figcaption class="figcap"><span class="nm">Amelia Ryden</span><span class="ro">CTO</span></figcaption></figure>
  </div></div></section>

<section class="slide" data-ground="soft" data-title="Type"><div class="inner"><h2 class="display">Type.</h2>
  <div class="specimens">
    <div class="specimen"><span class="aa">Aa</span><div><h3>Bold</h3><p>Cut the noise.</p></div></div>
    <div class="specimen body"><span class="aa">Aa</span><div><h3>Regular</h3><p>Body copy.</p></div></div>
  </div></div></section>

<section class="slide bleed" data-title="Precision">
  <div class="bleed-media"></div>
  <div class="inner"><h2 class="display">Built on precision.</h2><p class="lede">To three edges.</p></div></section>

<section class="slide" data-title="Examples"><div class="inner"><h2 class="display">Examples.</h2>
  <div class="carousel" data-carousel><div class="carousel-stage">
    <img class="carousel-img active" alt="one" data-note="First caption">
    <img class="carousel-img" alt="two" data-note="Second caption">
  </div><div class="carousel-bar">
    <button class="carousel-nav" data-car-prev aria-label="Previous">&#8592;</button>
    <button class="carousel-nav" data-car-next aria-label="Next">&#8594;</button>
    <div class="carousel-dots" data-car-dots></div><p class="carousel-note" data-car-note></p>
  </div></div></div></section>

<section class="slide" data-title="Tiles"><div class="inner"><h2 class="display">What you get.</h2>
  <div class="tiles">
    <button class="tile" data-detail="d-1">Tile one</button>
    <button class="tile" data-detail="d-2">Tile two</button>
  </div>
  <div class="tile-detail"><button class="detail-close" aria-label="Close">&times;</button><div data-detail-body></div></div>
  <template id="d-1"><h4>Tile one</h4><ul><li>Detail A</li></ul></template>
  <template id="d-2"><h4>Tile two</h4><ul><li>Detail B</li></ul></template>
</div></section>

<section class="slide" data-title="Recap"><div class="inner"><h2 class="display">Recap.</h2>
  <ol class="recap"><li><span class="recap-n">01</span>One</li><li><span class="recap-n">02</span>Two</li></ol>
</div></section>`

export function samplePage(tone: 'dark' | 'light'): string {
  const house = tone === 'light'
    ? `<style>:root{--deck-bg:#FFFFFF;--deck-panel:rgba(15,17,26,.045);--deck-panel-2:rgba(15,17,26,.085);--deck-sheen:rgba(255,255,255,.55);--deck-ink:#0A0A0A;--deck-ink-2:#5E5E5E;--deck-ink-3:#8A8A8A;--deck-accent-1:#0A0A0A;--deck-accent-2:#EFEE3C;--deck-accent-3:#0A0A0A;--deck-accent-4:#EFEE3C;--deck-radius:0px}</style>`
    : ''
  return `<!doctype html><html lang="en"${tone === 'light' ? ' data-deck-tone="light"' : ''}><head><meta charset="utf-8">
${buildDeckBaseBlock()}
${house}
</head><body>
<div class="frame">
  <button type="button" class="brand"><span class="dot"></span>Terminal 42</button>
  <div class="foot"><span class="deck-num"></span><span class="footnote">Draft</span></div>
</div>
<div class="nav-cluster">
  <button type="button" class="toc-btn" aria-expanded="false" aria-label="Contents"><svg viewBox="0 0 24 24"></svg></button>
  <div class="toc"><div class="toc-head"><span class="toc-heading">Contents</span><button class="toc-close" aria-label="Close"><svg viewBox="0 0 24 24"></svg></button></div><ul class="toc-list"></ul></div>
  <div class="dots"></div>
</div>
<main class="deck">${SLIDES}</main>
</body></html>`
}

/** Relative luminance of a computed `rgb(...)` colour. */
function lum(css: string): number {
  const m = (css.match(/[\d.]+/g) ?? []).map(Number)
  const f = m.slice(0, 3).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Loads a fresh deck at a real URL. setContent leaves the current one in
 * place, hash and all, and the runtime honours a hash on load — so every test
 * after the first would otherwise open wherever the previous one finished.
 */
const ORIGIN = 'https://deck.test/'
let loadN = 0

async function load(p: Page, tone: 'dark' | 'light' = 'dark', hash = ''): Promise<void> {
  // A fresh path per load: going from /x to /x#6 is a same-document
  // navigation, so the page would not reload and the deck would not re-run.
  const url = `${ORIGIN}${++loadN}`
  await p.route(url, (route) => route.fulfill({ contentType: 'text/html', body: samplePage(tone) }))
  await p.goto(url + hash)
  await p.waitForTimeout(450)
}

async function show(p: Page, i: number): Promise<void> {
  await p.evaluate((n) => {
    const d = document.querySelector('.deck') as HTMLElement
    d.scrollLeft = n * d.clientWidth
  }, i)
  await p.waitForTimeout(1200)
}

let available = true
beforeAll(async () => {
  try {
    const { chromium } = await import('playwright')
    browser = await chromium.launch()
    page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  } catch {
    available = false
  }
}, 60_000)

afterAll(async () => { await browser?.close() })

describe.runIf(process.env.SKIP_BROWSER_TESTS !== '1')('the deck chassis in a browser', () => {
  const it_ = (name: string, fn: (p: Page) => Promise<void>, timeout = 30_000): void => {
    it(name, async () => {
      if (!available || !page) return
      await fn(page)
    }, timeout)
  }

  it_('renders every layout without throwing and without overflowing', async (p) => {
    const errors: string[] = []
    p.on('pageerror', (e) => errors.push(String(e)))
    await load(p)
    expect(errors).toEqual([])
    // A deck that scrolls the document has escaped its own stage.
    const over = await p.evaluate(() => ({
      x: document.documentElement.scrollWidth - window.innerWidth,
      y: document.body.scrollHeight - window.innerHeight,
    }))
    expect(over).toEqual({ x: 0, y: 0 })
    expect(await p.$$eval('.slide', (s) => s.length)).toBe(10)
    expect(await p.$$eval('.dots button', (b) => b.length)).toBe(10)
    expect(await p.$$eval('.toc-item', (b) => b.length)).toBe(10)
  })

  it_('keeps the emphasis written inside a headline', async (p) => {
    // The splitter used to rebuild the heading from textContent, which threw
    // away every span and mark the doc tells the model to write.
    await load(p)
    const h = await p.evaluate(() => {
      const s = document.querySelectorAll('.slide')[2]
      return {
        accent: !!s.querySelector('.accent .w'),
        mark: !!s.querySelector('mark .w'),
        text: (s.querySelector('.display') as HTMLElement).textContent?.replace(/\s+/g, ' ').trim(),
        words: s.querySelectorAll('.display .w').length,
      }
    })
    expect(h.accent).toBe(true)
    expect(h.mark).toBe(true)
    expect(h.text).toBe('Scaling revenue and margin.')
    expect(h.words).toBe(5)
  })

  it_('gives a bar its height from --v', async (p) => {
    // A percentage height against an auto-sized parent resolves to auto, and
    // every bar comes out at its minimum, which reads as a bug in the data.
    await load(p)
    await show(p, 2)
    const hs = await p.$$eval('.slide[data-ground="invert"] .bar > .col',
      (c) => c.map((x) => x.getBoundingClientRect().height))
    expect(hs).toHaveLength(4)
    expect(hs[2]).toBeGreaterThan(hs[1])
    expect(hs[1]).toBeGreaterThan(hs[3])
    expect(hs[3]).toBeGreaterThan(hs[0])
    expect(hs[2]).toBeGreaterThan(100)
  })

  it_('turns a slide over without leaving anything unreadable', async (p) => {
    await load(p)
    for (const [i, ground] of [[2, 'invert'], [3, 'accent'], [5, 'soft']] as const) {
      await show(p, i)
      const r = await p.evaluate(() => {
        const s = document.querySelector('.slide.in-view') as HTMLElement
        const head = s.querySelector('.display') as HTMLElement
        const brand = document.querySelector('.brand') as HTMLElement
        const ground = getComputedStyle(s).backgroundColor
        return { ground, ink: getComputedStyle(head).color, brand: getComputedStyle(brand).color }
      })
      expect(contrast(r.ink, r.ground), `${ground} heading`).toBeGreaterThan(4.5)
      // The frame is fixed above the slide, so it has to follow the ground too.
      expect(contrast(r.brand, r.ground), `${ground} brand`).toBeGreaterThan(4.5)
    }
  })

  it_('paints each swatch from its own hex and picks type that reads on it', async (p) => {
    await load(p)
    await show(p, 3)
    const sw = await p.$$eval('.swatch', (ws) => ws.map((w) => {
      const g = getComputedStyle(w)
      return { bg: g.backgroundColor, ink: getComputedStyle(w.querySelector('.nm') as Element).color }
    }))
    expect(sw).toHaveLength(3)
    expect(sw[0].bg).toBe('rgb(184, 148, 87)')
    expect(sw[2].bg).toBe('rgb(255, 229, 167)')
    for (const [i, s] of sw.entries()) {
      expect(contrast(s.ink, s.bg), `swatch ${i}`).toBeGreaterThan(4.5)
    }
  })

  it_('runs a bleed image to three edges', async (p) => {
    await load(p)
    await show(p, 6)
    const box = await p.$eval('.slide.bleed .bleed-media', (e) => {
      const r = e.getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height }
    })
    expect(box.x).toBe(0)
    expect(box.y).toBe(0)
    expect(box.h).toBe(720)
    expect(box.w).toBeCloseTo(640, 0)
  })

  it_('navigates by key, by dot and by hash, and keeps the number current', async (p) => {
    await load(p)
    await p.keyboard.press('ArrowRight')
    await p.waitForTimeout(900)
    expect(await p.$eval('.deck-num', (e) => e.textContent)).toBe('[02]')
    expect(await p.evaluate(() => location.hash)).toBe('#2')
    await p.$$eval('.dots button', (b) => (b[4] as HTMLElement).click())
    await p.waitForTimeout(900)
    expect(await p.$eval('.deck-num', (e) => e.textContent)).toBe('[05]')
    await p.keyboard.press('Home')
    await p.waitForTimeout(900)
    expect(await p.$eval('.deck-num', (e) => e.textContent)).toBe('[01]')
  })

  it_('opens on the slide a deep link names', async (p) => {
    await load(p, 'dark', '#6')
    await p.waitForTimeout(700)
    expect(await p.$eval('.deck-num', (e) => e.textContent)).toBe('[06]')
    expect(await p.$eval('.slide.in-view', (e) => (e as HTMLElement).dataset.title)).toBe('Type')
  })

  it_('follows a hash pasted into an already-open deck', async (p) => {
    await load(p)
    await p.evaluate(() => { location.hash = '#4' })
    await p.waitForTimeout(900)
    expect(await p.$eval('.deck-num', (e) => e.textContent)).toBe('[04]')
    expect(await p.$eval('.slide.in-view', (e) => (e as HTMLElement).dataset.title)).toBe('Palette')
  })

  it_('steps a carousel and opens a tile without also advancing the deck', async (p) => {
    await load(p)
    await show(p, 7)
    const before = await p.$eval('.deck-num', (e) => e.textContent)
    await p.click('[data-car-next]')
    await p.waitForTimeout(400)
    expect(await p.$eval('[data-car-note]', (e) => e.textContent)).toBe('Second caption')
    expect(await p.$eval('.deck-num', (e) => e.textContent)).toBe(before)

    await show(p, 8)
    await p.click('.tile[data-detail="d-2"]')
    await p.waitForTimeout(400)
    expect(await p.$eval('[data-detail-body]', (e) => e.textContent)).toContain('Detail B')
    const atTile = await p.$eval('.deck-num', (e) => e.textContent)
    await p.click('.detail-close')
    await p.waitForTimeout(400)
    expect(await p.$eval('.deck-num', (e) => e.textContent)).toBe(atTile)
  })

  // Everything below is the export path. It runs in Electron rather than
  // Playwright in production, but it is page script either way, and the
  // failure it exists to prevent — a PowerPoint of blank slides — is only
  // visible once a real engine has laid the deck out.
  it_('recognises a chassis deck', async (p) => {
    await load(p)
    expect(await p.evaluate(IS_CHASSIS_JS)).toBe(true)
    await p.setContent('<body><section>Not a deck</section></body>')
    expect(await p.evaluate(IS_CHASSIS_JS)).toBe(false)
  })

  it_('counts the slides an export has to produce', async (p) => {
    await load(p)
    expect(await p.evaluate(SLIDE_COUNT_JS)).toBe(10)
  })

  it_('leaves every slide fully painted once prepared for export', async (p) => {
    // This is the bug in full: without the prep, only the slide that happens
    // to be in view has any opacity, so the deck exports as one picture and
    // nine blanks.
    await load(p)
    const bare = await p.$$eval('.slide > .inner', (els) =>
      els.filter((e) => Number(getComputedStyle(e).opacity) > 0.9).length)
    expect(bare).toBe(1)

    expect(await p.evaluate(EXPORT_PREP_JS)).toBe(true)
    await p.waitForTimeout(120)
    const prepped = await p.$$eval('.slide > .inner', (els) =>
      els.map((e) => ({ o: getComputedStyle(e).opacity, t: getComputedStyle(e).transform })))
    for (const [i, r] of prepped.entries()) {
      expect(Number(r.o), `slide ${i} opacity`).toBeGreaterThan(0.99)
      expect(r.t, `slide ${i} transform`).toBe('none')
    }
    // The words of a headline are held below their masks until they arrive.
    const words = await p.$$eval('.display .w', (els) =>
      els.every((e) => getComputedStyle(e).transform === 'none' && Number(getComputedStyle(e).opacity) > 0.99))
    expect(words).toBe(true)
  })

  it_('keeps a bar chart standing up in an export', async (p) => {
    // The generic "no transforms" rule would flatten a bar to nothing,
    // because a bar is drawn by scaling it up.
    await load(p)
    await p.evaluate(EXPORT_PREP_JS)
    await p.evaluate(showSlideJs(2))
    await p.waitForTimeout(150)
    const hs = await p.$$eval('.slide[data-ground="invert"] .bar > .col',
      (c) => c.map((x) => x.getBoundingClientRect().height))
    expect(Math.min(...hs)).toBeGreaterThan(20)
    expect(hs[2]).toBeGreaterThan(hs[0])
  })

  it_('hides the things that only mean something to a mouse', async (p) => {
    await load(p)
    await p.evaluate(EXPORT_PREP_JS)
    await p.waitForTimeout(100)
    for (const sel of ['.nav-cluster', '.tile-detail', '.carousel-bar']) {
      expect(await p.$eval(sel, (e) => getComputedStyle(e).display), sel).toBe('none')
    }
    // The frame stays: brand, slide number and footnote belong on the slide.
    expect(await p.$eval('.frame', (e) => getComputedStyle(e).display)).not.toBe('none')
  })

  it_('walks the deck one distinct slide at a time', async (p) => {
    // The old exporter called window.scrollTo, which does nothing to a scroll
    // container, so every capture was the same frame.
    await load(p)
    await p.evaluate(EXPORT_PREP_JS)
    const seen: string[] = []
    for (let i = 0; i < 10; i++) {
      expect(await p.evaluate(showSlideJs(i)), `step ${i}`).toBe(true)
      await p.waitForTimeout(120)
      seen.push(await p.evaluate(() => {
        const d = document.querySelector('.deck') as HTMLElement
        const s = document.querySelector('.slide.in-view') as HTMLElement
        return `${Math.round(d.scrollLeft)}:${s.dataset.title}:${document.querySelector('.deck-num')?.textContent}`
      }))
    }
    expect(new Set(seen).size).toBe(10)
    expect(seen[0]).toBe('0:Cover:[01]')
    expect(seen[9]).toBe('11520:Recap:[10]')
  })

  it_('asks for a slide that is not there without throwing', async (p) => {
    await load(p)
    await p.evaluate(EXPORT_PREP_JS)
    expect(await p.evaluate(showSlideJs(99))).toBe(false)
  })

  it_('prepares a plain stack of sections too', async (p) => {
    // Not every deck in the library was generated against the chassis.
    await p.setContent(`<body style="margin:0">
      <section class="slide" style="height:720px">One</section>
      <section class="slide" style="height:720px">Two</section>
      <section class="slide" style="height:720px">Three</section></body>`)
    expect(await p.evaluate(SLIDE_COUNT_JS)).toBe(3)
    expect(await p.evaluate(EXPORT_PREP_JS)).toBe(true)
    await p.evaluate(showSlideJs(2))
    await p.waitForTimeout(120)
    expect(await p.evaluate(() => Math.round(window.scrollY))).toBe(1440)
  })

  it_('reads on a light house as well as a dark one', async (p) => {
    // The recurring complaint has always been a light theme that went pale on
    // pale, so the light path gets the same contrast check as the dark one.
    await load(p, 'light')
    for (const i of [1, 8]) {
      await show(p, i)
      const r = await p.evaluate(() => {
        const s = document.querySelector('.slide.in-view') as HTMLElement
        const panel = s.querySelector('.reason, .tile') as HTMLElement | null
        const head = s.querySelector('.display') as HTMLElement
        return {
          bg: getComputedStyle(document.body).backgroundColor,
          ink: getComputedStyle(head).color,
          panelBg: panel ? getComputedStyle(panel).backgroundColor : null,
          panelInk: panel ? getComputedStyle(panel).color : null,
        }
      })
      expect(contrast(r.ink, r.bg), `light heading ${i}`).toBeGreaterThan(4.5)
      if (r.panelInk && r.panelBg) {
        // A translucent panel over the page ground still has to carry its text.
        expect(contrast(r.panelInk, r.bg), `light panel ${i}`).toBeGreaterThan(4.5)
      }
    }
    // A sharp house must actually come out sharp.
    expect(await p.$eval('.tile', (e) => getComputedStyle(e).borderRadius)).toBe('0px')
  })
})
