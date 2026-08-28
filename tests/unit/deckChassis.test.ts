// The chassis is shipped as a string, and a string cannot be typechecked.
//
// Two things can go quietly wrong with it. The CSS can lose a class that the
// usage doc still tells the model to write, in which case decks come back with
// unstyled markup; or the usage doc can describe a hook the runtime no longer
// listens for, in which case a control renders and does nothing. Both produce
// a deck that looks built and is not, which is the failure this whole piece of
// work exists to end. So the checks here hold the three parts against each
// other: what the CSS styles, what the JS wires, and what the doc promises.
//
// The behaviour itself — navigation, carousel, tile panel — is verified in a
// real browser rather than here, because a snap scroller has no meaning
// without layout.

import { describe, it, expect } from 'vitest'
import {
  DECK_CSS, DECK_JS, DECK_USAGE, DECK_BASE_ID, DECK_RUNTIME_ID, buildDeckBaseBlock
} from '../../src/main/deckChassis'

/** Every class the usage doc tells the model to write. */
const PROMISED_CLASSES = [
  'deck', 'slide', 'inner', 'slide-bg', 'cover', 'cover-bg', 'cover-meta',
  'display', 'eyebrow', 'lede', 'accent',
  'frame', 'brand', 'footnote', 'nav-cluster', 'dots',
  'toc', 'toc-list', 'toc-item', 'toc-head', 'toc-heading', 'toc-close', 'toc-btn', 'toc-n',
  'reasonlist', 'reason', 'picto',
  'carousel', 'carousel-stage', 'carousel-img', 'carousel-bar', 'carousel-nav', 'carousel-dots', 'carousel-dot', 'carousel-note',
  'split', 'card',
  'exhibit', 'exhibit-pane', 'exhibit-cap', 'exhibit-slot',
  'tiles', 'tile', 'tile-detail', 'detail-close',
  'recap', 'recap-n',
  'statgrid', 'stat', 'num', 'lbl',
  'chips', 'chip', 'outrow', 'item', 'ctarow', 'btn', 'note',
  'mark', 'bleed', 'bleed-media', 'bars', 'bar', 'col', 'v', 'k',
  'swatches', 'swatch', 'nm', 'hx', 'ro',
  'figures', 'figure', 'figcap', 'specimens', 'specimen', 'aa',
  'deck-num', 'foot'
] as const

/** The grounds a slide can be set to. */
const GROUNDS = ['invert', 'accent', 'soft'] as const

/** Every custom property the doc says you can redeclare. */
const TOKENS = [
  '--deck-bg', '--deck-panel', '--deck-panel-2', '--deck-sheen', '--deck-blur',
  '--deck-ink', '--deck-ink-2', '--deck-ink-3',
  '--deck-accent-1', '--deck-accent-2', '--deck-accent-3', '--deck-accent-4',
  '--deck-gradient', '--deck-font', '--deck-mono', '--deck-ease', '--deck-radius'
] as const

describe('the deck chassis CSS', () => {
  it('styles every class the usage doc asks for', () => {
    for (const cls of PROMISED_CLASSES) {
      expect(DECK_CSS, cls).toMatch(new RegExp(`\\.${cls}[\\s,{:.>]`))
    }
  })

  it('declares every token, so nothing falls back to a hardcoded colour', () => {
    for (const t of TOKENS) expect(DECK_CSS, t).toContain(`${t}:`)
  })

  it('has no colour that is not a token', () => {
    // Shadows and scrims are allowed to be raw rgba: they are depth, not
    // palette, and tinting them would tie the shadow to the brand.
    const hexes = DECK_CSS.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
    const declared = DECK_CSS.slice(0, DECK_CSS.indexOf('*,*::before'))
    for (const h of hexes) expect(declared, h).toContain(h)
  })

  // A house that asks for square corners and gets soft ones has had its
  // decision overridden by the chassis, which is the one thing the chassis is
  // not allowed to do.
  it('lets the house set every corner that is not deliberately a pill or a dot', () => {
    for (const decl of DECK_CSS.match(/border-radius:[^;}]*/g) ?? []) {
      const v = decl.slice('border-radius:'.length)
      if (v === '999px' || v === '50%' || v === 'inherit') continue
      expect(v, decl).toContain('var(--deck-radius)')
    }
  })

  // A ground that only repaints the background leaves ink the same colour it
  // was, which is how you get black type on a black slide.
  it('turns every colour over with a ground, not just the background', () => {
    for (const g of GROUNDS) expect(DECK_CSS, g).toContain(`.slide[data-ground="${g}"]`)
    const inv = DECK_CSS.slice(DECK_CSS.indexOf('.slide[data-ground="invert"]>.inner'))
    const body = inv.slice(0, inv.indexOf('}'))
    for (const t of ['--deck-ink', '--deck-ink-2', '--deck-ink-3', '--deck-panel', '--deck-panel-2', '--deck-sheen']) {
      expect(body, t).toContain(`${t}:`)
    }
  })

  it('does not define a ground token in terms of one it is redefining', () => {
    // A custom property that reads another property the same rule is also
    // setting resolves to the new value, so the whole rule silently voids.
    const inv = DECK_CSS.slice(DECK_CSS.indexOf('.slide[data-ground="invert"]>.inner'))
    const body = inv.slice(0, inv.indexOf('}'))
    const set = new Set((body.match(/--deck-[a-z0-9-]+(?=:)/g) ?? []))
    expect(set.size).toBeGreaterThan(3)
    for (const ref of body.match(/var\((--deck-[a-z0-9-]+)/g) ?? []) {
      expect(set.has(ref.slice(4)), `${ref} is both read and written here`).toBe(false)
    }
  })

  it('keeps the accent visible when the accent is the ground', () => {
    expect(DECK_CSS).toContain('.slide[data-ground="accent"]>.inner .accent')
  })

  it('turns its tints over for a light deck rather than forking', () => {
    const light = DECK_CSS.slice(DECK_CSS.indexOf('[data-deck-tone="light"]'))
    for (const t of ['--deck-bg', '--deck-panel', '--deck-panel-2', '--deck-sheen', '--deck-ink', '--deck-ink-2', '--deck-ink-3']) {
      expect(light.slice(0, light.indexOf('}')), t).toContain(t)
    }
  })

  it('stands down for anyone who asked for less motion', () => {
    expect(DECK_CSS).toContain('prefers-reduced-motion')
    const block = DECK_CSS.slice(DECK_CSS.lastIndexOf('prefers-reduced-motion'))
    // Not merely faster: a word-rise left half-transformed is unreadable, so
    // the transform and the opacity have to be cleared outright.
    expect(block).toContain('transform:none !important')
    expect(block).toContain('opacity:1 !important')
  })

  it('collapses to one column on a narrow screen instead of overflowing', () => {
    const q = DECK_CSS.slice(DECK_CSS.indexOf('@media (max-width:900px)'))
    for (const cls of ['.split', '.statgrid', '.exhibit', '.recap', '.specimens', '.figures', '.swatches', '.slide.bleed']) {
      expect(q, cls).toContain(cls)
    }
  })

  it('gives every animated primitive a resting state it can be forced into', () => {
    // .bar and .bleed-media start scaled to nothing. If reduced motion only
    // shortens their transition they stay at zero and the slide is empty.
    const block = DECK_CSS.slice(DECK_CSS.lastIndexOf('prefers-reduced-motion'))
    for (const cls of ['.bar>.col', '.slide.bleed>.bleed-media', '.figure', '.specimen']) {
      expect(block, cls).toContain(cls)
    }
  })
})

describe('the deck chassis runtime', () => {
  it('wires every hook the usage doc tells the model to write', () => {
    for (const hook of [
      'data-title', 'data-depth', 'data-carousel', 'data-car-prev', 'data-car-next',
      'data-car-dots', 'data-car-note', 'data-note', 'data-detail', 'data-detail-body',
      'data-hex'
    ]) {
      expect(DECK_JS, hook).toContain(hook)
    }
  })

  it('takes the keys a presenter actually presses', () => {
    for (const key of ['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', 'Home', 'End', 'Escape']) {
      expect(DECK_JS, key).toContain(key)
    }
  })

  it('does not steal a key from a field', () => {
    expect(DECK_JS).toContain('INPUT|TEXTAREA|SELECT')
  })

  it('leaves controls alone when a click means "next slide"', () => {
    // Without this, opening a tile or stepping a carousel also advances the
    // deck, and the thing you clicked scrolls off the screen as you click it.
    expect(DECK_JS).toContain("closest('button,a,input,select,textarea,[data-carousel],.tile-detail')")
  })

  it('is one self-starting expression, so load order cannot break it', () => {
    expect(DECK_JS.trim().startsWith('(function(){')).toBe(true)
    expect(DECK_JS.trim().endsWith('})()')).toBe(true)
    expect(DECK_JS).toContain("document.readyState!='loading'")
  })

  it('indexes every staggered container, so nothing arrives all at once', () => {
    const wired = DECK_JS.slice(DECK_JS.indexOf("setProperty('--n'") - 400, DECK_JS.indexOf("setProperty('--n'"))
    const at = DECK_CSS.indexOf('transition-delay:calc(var(--n')
    const styled = DECK_CSS.slice(DECK_CSS.lastIndexOf('\n', at), at)
    for (const cls of ['reasonlist', 'split', 'tiles', 'statgrid', 'outrow', 'recap', 'bars', 'figures', 'swatches', 'specimens']) {
      expect(wired, `js ${cls}`).toContain(cls)
    }
    for (const cls of ['reasonlist', 'split', 'tiles', 'statgrid', 'outrow', 'recap', 'figures', 'swatches', 'specimens']) {
      expect(styled, `css ${cls}`).toContain(cls)
    }
    // A bar grows rather than fades, so it spends its index on its own rule.
    expect(DECK_CSS).toMatch(/\.bar>\.col\{[^}]*var\(--n/)
  })

  it('picks a readable type colour for a swatch instead of trusting the model to', () => {
    expect(DECK_JS).toContain("--sw-ink")
    expect(DECK_JS).toContain('0.2126')
  })

  it('keeps the slide number current', () => {
    expect(DECK_JS).toContain('.deck-num')
    expect(DECK_JS).toContain("padStart(2,'0')")
  })

  // The heading is the one place the doc tells the model to put <span
  // class="accent"> and <mark>. Rebuilding it from textContent deletes both,
  // and the deck comes back with the emphasis silently gone.
  it('splits a headline into words without eating the markup inside it', () => {
    const at = DECK_JS.indexOf("querySelectorAll('.display')")
    const body = DECK_JS.slice(at, at + 1400)
    expect(body).not.toMatch(/innerHTML\s*=/)
    expect(body).toContain('nodeType===1')
    expect(body).toContain('replaceChild')
  })

  it('follows the slide ground with the chrome floating above it', () => {
    // The frame is fixed, so it keeps the deck's ink over a slide that has
    // turned its own over, and the brand disappears into the background.
    expect(DECK_JS).toContain('data-slide-ground')
    expect(DECK_CSS).toContain('[data-slide-ground="invert"] .frame')
    expect(DECK_CSS).toContain('[data-slide-ground="accent"] .nav-cluster')
  })

  it('does nothing at all on a page that is not a deck', () => {
    expect(DECK_JS).toContain("if(!deck)return")
  })
})

describe('the block that goes into the deck', () => {
  it('carries both ids, so an iteration can find and keep them', () => {
    const block = buildDeckBaseBlock()
    expect(block).toContain(`<style id="${DECK_BASE_ID}">`)
    expect(block).toContain(`<script id="${DECK_RUNTIME_ID}" defer>`)
    expect(block).toContain(DECK_CSS)
    expect(block).toContain(DECK_JS)
  })

  it('closes both tags', () => {
    const block = buildDeckBaseBlock()
    expect((block.match(/<\/style>/g) ?? []).length).toBe(1)
    expect((block.match(/<\/script>/g) ?? []).length).toBe(1)
  })

  it('does not carry a </script> inside the script, which would end it early', () => {
    expect(DECK_JS.toLowerCase()).not.toContain('</script')
  })
})

describe('the usage doc', () => {
  it('names every layout', () => {
    for (const layout of [
      'Cover', 'Reason list', 'Carousel', 'Split', 'Exhibit', 'Tiles', 'Recap',
      'Bars', 'Figures', 'Swatches', 'Specimens', 'Bleed'
    ]) {
      expect(DECK_USAGE, layout).toContain(layout)
    }
  })

  it('documents every class it ships, and ships every class it documents', () => {
    // The doc is the only thing the model reads. A layout that exists in the
    // CSS and not here is dead code; one here and not in the CSS is a slide
    // that renders unstyled.
    for (const cls of ['bars', 'figures', 'swatches', 'specimens', 'bleed-media', 'figcap']) {
      expect(DECK_USAGE, cls).toContain(cls)
    }
  })

  it('tells the model to change ground rather than recolour by hand', () => {
    expect(DECK_USAGE).toContain('data-ground=')
    for (const g of GROUNDS) expect(DECK_USAGE, g).toContain(g)
    expect(DECK_USAGE).toContain('Do not restate colours yourself')
  })

  it('tells the model not to rebuild what it has been given', () => {
    expect(DECK_USAGE).toContain('THE CHASSIS IS THE DECK')
    expect(DECK_USAGE).toContain('Do not write your own navigation')
  })

  it('rules out the two things that make a generated deck unopenable', () => {
    // A made-up local path renders as a broken image icon, and an emoji as an
    // icon is the tell that nobody looked at the result.
    expect(DECK_USAGE).toContain('Never invent a local file path')
    expect(DECK_USAGE).toContain('Never emoji')
  })

  it('says how to recolour it, since that is the whole point of the tokens', () => {
    expect(DECK_USAGE).toContain('do not hardcode colours on elements')
    expect(DECK_USAGE).toContain('data-deck-tone="light"')
  })
})
