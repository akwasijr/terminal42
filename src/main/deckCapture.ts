// Turning a deck into pictures is not screenshotting it.
//
// A deck built on the chassis is a horizontally snapping container whose
// slides are transparent until they are scrolled into view. Point the old
// exporter at one and you get the same frame N times, most of them blank:
// window.scrollTo does not move a scroll container, and a slide that has
// never been in view is still at opacity 0 with its words translated out of
// their masks.
//
// So an export is a small, deliberate mode rather than a screenshot. Freeze
// every transition, force everything that reveals into its final state, drop
// the interactive chrome, then walk the slides one at a time. Everything
// here is a string of page script because it has to run inside the render
// process; keeping it in one module means it can be read and tested as code
// rather than discovered as a bug in a customer's PowerPoint.

/** Does this page use the deck chassis, or is it a plain stack of sections? */
export const IS_CHASSIS_JS = `(() => !!(document.getElementById('deck-runtime') || document.querySelector('main.deck, .deck')))()`

/**
 * Puts the page into a state where any slide can be photographed:
 * nothing in motion, nothing waiting to be revealed, no chrome that only
 * means something to someone holding a mouse.
 */
export const EXPORT_PREP_JS = `(() => {
  if (document.getElementById('deck-export-prep')) return true;
  const st = document.createElement('style');
  st.id = 'deck-export-prep';
  st.textContent = [
    '*,*::before,*::after{transition:none !important;animation:none !important;scroll-behavior:auto !important}',
    // Everything the chassis holds back until a slide arrives.
    '.slide>.inner,.slide-bg,[data-reveal],.reason,.card,.tile,.stat,.recap li,.outrow .item,',
    '.display .w,.figure,.specimen,.slide.bleed>.bleed-media,.chip,.exhibit-slot,.exhibit-pane',
    '{opacity:1 !important;transform:none !important;filter:none !important}',
    // A bar is drawn by scaling it up from nothing, so "no transform" would
    // flatten the chart. It needs its full height instead.
    '.bar>.col{transform:scaleY(1) !important}',
    // The parallax layer sits at its travelled offset; put it back.
    '.slide-bg{opacity:.32 !important;transform:none !important}',
    // Dots, the contents button and the tile panel are things you click.
    '.nav-cluster,.tile-detail,.carousel-bar{display:none !important}',
    // Every carousel frame is a slide's worth of picture; show the first.
    '.carousel-img{display:none !important}',
    '.carousel-img.active,.carousel-img:first-child{display:block !important}'
  ].join('');
  document.head.appendChild(st);
  return true;
})()`

/** How many slides are there to photograph? */
export const SLIDE_COUNT_JS = `(() => document.querySelectorAll('section.slide, .slide, [data-slide]').length)()`

/**
 * Moves to one slide and puts it in view. Returns once the DOM says so;
 * transitions are already frozen by the prep, so there is nothing to wait for
 * beyond a paint.
 */
export function showSlideJs(index: number): string {
  const i = Math.max(0, Math.floor(index))
  return `(() => {
  const slides = document.querySelectorAll('section.slide, .slide, [data-slide]');
  const s = slides[${i}];
  if (!s) return false;
  const deck = document.querySelector('main.deck, .deck');
  if (deck && deck.scrollWidth > deck.clientWidth + 4) {
    deck.scrollLeft = ${i} * deck.clientWidth;
  } else {
    // A plain stack of sections still scrolls the window.
    s.scrollIntoView({ block: 'start', inline: 'start', behavior: 'auto' });
  }
  slides.forEach((el, n) => el.classList.toggle('in-view', n === ${i}));
  const num = document.querySelector('.deck-num');
  if (num) num.textContent = '[' + String(${i} + 1).padStart(2, '0') + ']';
  return true;
})()`
}

/**
 * A print document built from slide pictures.
 *
 * Chromium will not paginate a deck: the chassis is one viewport tall with
 * overflow hidden, so printToPDF returns a single page of whatever happened
 * to be on screen. Handing it a plain document of one full-bleed image per
 * page is the only way to get a PDF whose page count matches the deck.
 */
export function buildSlidePdfHtml(
  pngs: readonly string[],
  size: { width: number; height: number }
): string {
  const pages = pngs
    .map((src) => `<figure class="p"><img src="${src}" alt=""></figure>`)
    .join('\n')
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@page{size:${size.width}px ${size.height}px;margin:0}
html,body{margin:0;padding:0;background:#000}
.p{margin:0;width:${size.width}px;height:${size.height}px;overflow:hidden;break-after:page;page-break-after:always}
.p:last-child{break-after:auto;page-break-after:auto}
.p img{display:block;width:100%;height:100%;object-fit:contain}
</style></head><body>
${pages}
</body></html>`
}

/**
 * The size to photograph a deck at.
 *
 * PowerPoint's wide layout is 13.3in, which a reader will happily throw at a
 * 4K display, and the chassis type is clamped so it stops growing well before
 * that. 1920×1080 is the deck's own native size and gives PowerPoint half
 * again as many pixels as it strictly needs, which is what "high quality"
 * costs here. Larger than that and the clamps have topped out, so the type
 * starts looking small in its own slide.
 */
export const DECK_CAPTURE_SIZE = { width: 1920, height: 1080 } as const
