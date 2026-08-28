// The sample deck, kept out of any one test so that both the Playwright
// tests and the Electron export smoke test look at the same page. If they
// drift apart, the thing the smoke test proves stops being the thing the
// browser tests checked.

import { buildDeckBaseBlock } from '../../src/main/deckChassis'

/** Every layout the usage doc documents, in one page. */
export const SLIDES = `
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
