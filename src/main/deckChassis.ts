// The deck chassis: a working presentation, shipped as code.
//
// Web pages get an engine base (see designAssets.ts) so that motion, spacing
// and focus are real code a page inherits rather than something each
// generation re-derives and half-botches. Decks had nothing of the sort. They
// were given prose — "the furniture at the edge of every slide", "a bracketed
// index in the top left" — and prose is a thing a model reads and then
// approximates. What came back was a stack of <section>s with a heading and
// some bullets, cut off at the edges, with no navigation and no contents.
//
// This is the same treatment decks should have had: the chassis from
// ~/deck-template, distilled to the parts that are not about that particular
// deck. A horizontal snap-scrolling stage, a dots rail, a contents list,
// reveal-on-enter, and the seven layouts the template documents — cover,
// reason list, carousel, split, exhibit, tiles, recap. The model writes the
// slides and the token values. It does not write the deck.
//
// Everything visual hangs off a --deck-* custom property, so a house style, a
// pinned palette or a bound token library recolours the whole thing by
// redeclaring six values. Light decks are a tone switch rather than a fork:
// the glass treatment reads as tinted paper on a light ground, and the
// contrast comes out of the same variables.

export const DECK_BASE_ID = 'deck-base'
export const DECK_RUNTIME_ID = 'deck-runtime'

export const DECK_CSS = `:root{
--deck-bg:#0a0a0d;
--deck-panel:rgba(255,255,255,.032);
--deck-panel-2:rgba(255,255,255,.06);
--deck-sheen:rgba(255,255,255,.07);
--deck-blur:blur(30px) saturate(180%);
--deck-ink:#f2f3f7;--deck-ink-2:#8d94a8;--deck-ink-3:#5b6076;
--deck-accent-1:#f2a573;--deck-accent-2:#f45a9b;--deck-accent-3:#7e80ee;--deck-accent-4:#1376bf;
--deck-gradient:linear-gradient(100deg,var(--deck-accent-1),var(--deck-accent-2) 36%,var(--deck-accent-3) 66%,var(--deck-accent-4));
--deck-font:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
--deck-mono:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
--deck-ease:cubic-bezier(.16,1,.3,1);
--deck-radius:14px}
/* A light deck is the same deck with the tints turned over, not a second
   stylesheet. Panels become tinted paper, the sheen becomes a shadow. */
[data-deck-tone="light"]{
--deck-bg:#f6f6f4;
--deck-panel:rgba(15,17,26,.045);
--deck-panel-2:rgba(15,17,26,.085);
--deck-sheen:rgba(255,255,255,.55);
--deck-ink:#14161d;--deck-ink-2:#4d5364;--deck-ink-3:#7c8296}
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0;height:100%}
/* figure, figcaption and blockquote carry a UA margin of 1em 40px. Left
   unreset it pushes content off the headline's edge and shrinks it, which
   reads as a layout bug rather than a browser default. */
figure,figcaption,blockquote,dl,dd{margin:0}
body{background:var(--deck-bg);color:var(--deck-ink);font-family:var(--deck-font);font-feature-settings:'tnum' 1;-webkit-font-smoothing:antialiased;overflow:hidden}
button{font:inherit;color:inherit}
button:focus{outline:none}
button:focus-visible,a:focus-visible{outline:2px solid currentColor;outline-offset:2px;border-radius:inherit}
::selection{background:var(--deck-ink);color:var(--deck-bg)}

/* ---- the stage ---- */
.deck{position:relative;z-index:1;height:100vh;height:100dvh;display:flex;flex-direction:row;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scrollbar-width:none}
.deck::-webkit-scrollbar{display:none}
.slide{flex:0 0 100%;width:100%;height:100%;scroll-snap-align:start;display:flex;flex-direction:column;justify-content:center;padding:clamp(90px,10vw,140px) clamp(28px,5vw,90px) clamp(70px,8vw,110px);position:relative;overflow:hidden}
.slide .inner{max-width:1320px;width:100%;margin:0 auto;position:relative;z-index:2}

/* ---- grounds ----
   Every reference deck gets its rhythm from slides that change ground: a run
   of pale slides, then one that goes to ink, then back. Doing that by hand
   means restating six colours per slide and getting one of them wrong, so it
   is one attribute here.

   The overrides sit on .inner rather than on .slide because a custom property
   cannot be defined in terms of another property that the same rule is also
   redefining — --deck-ink read on .slide would be the new value, not the
   house's. On the child it still reads the house's, which is the whole trick. */
.slide[data-ground="invert"]{background:var(--deck-ink)}
.slide[data-ground="accent"]{background:var(--deck-accent-1)}
.slide[data-ground="soft"]{background:color-mix(in srgb,var(--deck-ink) 7%,var(--deck-bg))}
.slide[data-ground="invert"]>.inner,.slide[data-ground="accent"]>.inner{
--deck-ink:var(--deck-bg);
--deck-ink-2:color-mix(in srgb,var(--deck-bg) 68%,transparent);
--deck-ink-3:color-mix(in srgb,var(--deck-bg) 44%,transparent);
--deck-panel:color-mix(in srgb,var(--deck-bg) 10%,transparent);
--deck-panel-2:color-mix(in srgb,var(--deck-bg) 17%,transparent);
--deck-sheen:color-mix(in srgb,var(--deck-bg) 12%,transparent);
color:var(--deck-bg)}
/* On an accent ground the accent is the ground, so anything still painted
   with it would vanish. */
.slide[data-ground="accent"]>.inner{--deck-gradient:none;--deck-accent-3:var(--deck-bg)}
[data-slide-ground="invert"] .frame,[data-slide-ground="invert"] .nav-cluster,
[data-slide-ground="accent"] .frame,[data-slide-ground="accent"] .nav-cluster{
--deck-ink:var(--deck-bg);
--deck-ink-2:color-mix(in srgb,var(--deck-bg) 68%,transparent);
--deck-ink-3:color-mix(in srgb,var(--deck-bg) 46%,transparent);
--deck-panel-2:color-mix(in srgb,var(--deck-bg) 15%,transparent);
--deck-sheen:color-mix(in srgb,var(--deck-bg) 12%,transparent);
color:var(--deck-bg)}
.slide[data-ground="accent"]>.inner .accent,.slide[data-ground="accent"]>.inner .accent .w{background:none;color:var(--deck-bg);-webkit-text-fill-color:currentColor}
.slide[data-ground="invert"]>.inner .accent,.accent .w{background:var(--deck-gradient);-webkit-background-clip:text;background-clip:text;color:transparent}
.accent .wmask{background:none}
/* One word carried on a highlighter is how every reference deck points at the
   thing it wants you to read. It is a <mark>, so it survives being copied. */
mark,.mark{background:var(--deck-accent-2);color:var(--deck-bg)}
.display mark,.display .mark{background:none;padding:0}
.display mark .w,.display .mark .w{background:var(--deck-accent-2);color:var(--deck-bg);padding:.02em .22em;border-radius:calc(var(--deck-radius) * .25);box-decoration-break:clone;-webkit-box-decoration-break:clone}

.slide>.inner{opacity:.28;transform:translateX(34px) scale(.985);transition:opacity .58s ease,transform .72s var(--deck-ease)}
.slide.in-view>.inner{opacity:1;transform:translateX(0) scale(1)}
.slide-bg{position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.18;transform:translateX(var(--px,0px)) scale(1.035);transition:opacity .7s ease,transform .9s var(--deck-ease)}
.slide.in-view .slide-bg{opacity:.32;transform:translateX(var(--px,0px)) scale(1)}
.slide-bg img,.slide-bg video{width:100%;height:100%;object-fit:cover}

/* ---- type ---- */
h1.display,h2.display{font-weight:800;letter-spacing:-.02em;line-height:1.04;margin:0;text-wrap:balance;color:var(--deck-ink)}
h1.display{font-size:clamp(38px,6vw,96px)}
h2.display{font-size:clamp(30px,4.2vw,60px)}
.display .w{display:inline-block;transform:translateY(115%);filter:blur(6px);transition:transform .8s var(--deck-ease),filter .8s var(--deck-ease);transition-delay:calc(var(--i) * 45ms)}
.slide.in-view .display .w{transform:translateY(0);filter:blur(0)}
.wmask{display:inline-block;overflow:hidden;vertical-align:top}
.eyebrow{display:block;font-family:var(--deck-mono);font-size:clamp(11px,.92vw,13px);font-weight:500;letter-spacing:.04em;color:var(--deck-ink-2);margin:0 0 clamp(12px,1.4vw,18px)}
.lede{max-width:62ch;margin:clamp(16px,1.8vw,24px) 0 0;font-size:clamp(15px,1.2vw,19px);line-height:1.5;color:var(--deck-ink-2)}
.accent{background:var(--deck-gradient);-webkit-background-clip:text;background-clip:text;color:transparent}

/* ---- glass ---- */
.reason,.card,.tile,.tile-detail,.stat,.outrow .item,.recap li,.chip,.exhibit-slot{position:relative;backdrop-filter:var(--deck-blur);-webkit-backdrop-filter:var(--deck-blur);box-shadow:none}
.reason::before,.card::before,.tile::before,.stat::before,.outrow .item::before,.exhibit-slot::before{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(180deg,var(--deck-sheen),rgba(255,255,255,0) 45%)}

/* ---- reveal ---- */
[data-reveal]{opacity:0;transform:translateY(18px);transition:opacity .6s ease,transform .6s var(--deck-ease)}
.slide.in-view [data-reveal]{opacity:1;transform:translateY(0)}
.slide.in-view [data-reveal="1"]{transition-delay:.15s}
.slide.in-view [data-reveal="2"]{transition-delay:.28s}
.slide.in-view [data-reveal="3"]{transition-delay:.4s}
.slide.in-view [data-reveal="4"]{transition-delay:.5s}
.slide.in-view [data-reveal="5"]{transition-delay:.6s}
.reason,.card,.tile,.stat,.outrow .item,.recap li,.figure,.specimen{opacity:0;transform:translateY(26px) scale(.86);transition:opacity .7s var(--deck-ease),transform .7s var(--deck-ease),background-color .25s ease,box-shadow .25s ease}
.slide.in-view .reason,.slide.in-view .card,.slide.in-view .tile,.slide.in-view .stat,.slide.in-view .outrow .item,.slide.in-view .recap li,.slide.in-view .figure,.slide.in-view .specimen{opacity:1;transform:translateY(0) scale(1)}
.reasonlist>*:nth-child(n),.split>*:nth-child(n),.tiles>*:nth-child(n),.statgrid>*:nth-child(n),.outrow>*:nth-child(n),.recap>*:nth-child(n),.figures>*:nth-child(n),.swatches>*:nth-child(n),.specimens>*:nth-child(n){transition-delay:calc(var(--n,0) * 70ms + 50ms)}
.reason:hover,.card:hover,.tile:hover,.stat:hover,.outrow .item:hover{transform:translateY(-4px) scale(1.02);box-shadow:0 18px 36px rgba(0,0,0,.28)}
.picto{display:inline-flex;transition:transform .35s var(--deck-ease)}
.picto svg{width:100%;height:100%;display:block}
.reason:hover .picto,.card:hover .picto,.tile:hover .picto{transform:scale(1.18) rotate(-4deg)}

/* ---- chrome ---- */
.frame{position:fixed;inset:0;z-index:40;pointer-events:none;padding:clamp(20px,2.4vw,36px);display:flex;flex-direction:column;justify-content:space-between}
.brand{align-self:flex-start;display:flex;align-items:center;gap:9px;font-weight:700;font-size:clamp(14px,1.1vw,17px);letter-spacing:-.01em;pointer-events:auto;background:none;border:none;padding:0;color:var(--deck-ink);font-family:var(--deck-font);cursor:pointer;transition:opacity .2s ease}
.brand:hover{opacity:.75}
.brand .dot{width:8px;height:8px;border-radius:50%;background:var(--deck-gradient)}
.foot{align-self:flex-start;display:flex;flex-direction:column;gap:4px}
.footnote{align-self:flex-start;font-family:var(--deck-mono);font-size:11px;letter-spacing:.03em;color:var(--deck-ink-3)}
.nav-cluster{position:fixed;right:clamp(20px,2.4vw,36px);bottom:clamp(20px,2.4vw,30px);z-index:41;display:flex;align-items:center;gap:12px}
.toc-btn{flex:none;width:34px;height:34px;display:grid;place-items:center;border:none;border-radius:999px;background:var(--deck-panel-2);color:var(--deck-ink-2);cursor:pointer;padding:0;backdrop-filter:blur(18px) saturate(160%);-webkit-backdrop-filter:blur(18px) saturate(160%);box-shadow:inset 0 1px 0 var(--deck-sheen);transition:color .18s ease}
.toc-btn:hover,.toc-btn[aria-expanded="true"]{color:var(--deck-ink)}
.toc-btn svg{width:16px;height:16px}
.dots{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:999px;background:var(--deck-panel-2);backdrop-filter:blur(18px) saturate(160%);-webkit-backdrop-filter:blur(18px) saturate(160%);box-shadow:inset 0 1px 0 var(--deck-sheen)}
.dots button{width:7px;height:7px;flex:none;border-radius:999px;border:none;background:var(--deck-ink-3);padding:0;cursor:pointer;transition:width .25s var(--deck-ease),background .2s ease,transform .2s ease}
.dots button:hover{background:var(--deck-ink);transform:scale(1.2)}
.dots button.active{background:var(--deck-ink);width:22px}
.toc{position:absolute;right:0;bottom:calc(100% + 10px);width:min(320px,calc(100vw - 40px));padding:10px;border-radius:calc(var(--deck-radius) * 1.1);background:var(--deck-bg);backdrop-filter:blur(24px) saturate(160%);-webkit-backdrop-filter:blur(24px) saturate(160%);box-shadow:inset 0 1px 0 var(--deck-sheen),0 18px 48px rgba(0,0,0,.45);opacity:0;transform:translateY(8px) scale(.98);transform-origin:100% 100%;pointer-events:none;transition:opacity .22s ease,transform .22s var(--deck-ease)}
.toc.open{opacity:1;transform:none;pointer-events:auto}
.toc-head{display:flex;align-items:center;justify-content:space-between;padding:4px 6px 10px 10px}
.toc-heading{font-size:12px;font-weight:600;color:var(--deck-ink-3)}
.toc-close{width:26px;height:26px;display:grid;place-items:center;border:none;border-radius:999px;background:transparent;color:var(--deck-ink-3);cursor:pointer;padding:0}
.toc-close svg{width:15px;height:15px}
.toc-close:hover{background:var(--deck-panel-2);color:var(--deck-ink)}
.toc-list{list-style:none;margin:0;padding:0;max-height:calc(100vh - 168px);overflow-y:auto;overscroll-behavior:contain}
.toc-item{width:100%;display:flex;align-items:baseline;gap:10px;padding:7px 10px;border:none;border-radius:calc(var(--deck-radius) * .6);background:transparent;color:var(--deck-ink-2);cursor:pointer;font-family:var(--deck-font);font-size:13px;font-weight:500;line-height:1.35;text-align:left;transition:background .16s ease,color .16s ease}
.toc-item:hover{background:var(--deck-panel-2);color:var(--deck-ink)}
.toc-item.current{background:var(--deck-panel-2);color:var(--deck-ink);font-weight:600}
.toc-n{flex:none;min-width:18px;color:var(--deck-ink-3);font-family:var(--deck-mono);font-size:11px}

/* ---- layout: cover ---- */
.cover-bg{position:absolute;z-index:5;overflow:hidden;border-radius:calc(var(--deck-radius) * 1.1);right:clamp(24px,4vw,64px);top:50%;transform:translateY(-50%);width:clamp(260px,32vw,440px);height:clamp(260px,32vw,440px)}
.cover-bg img,.cover-bg video{width:100%;height:100%;object-fit:cover}
.slide.cover>.inner{max-width:56%;margin:0}
.cover-meta{display:flex;gap:clamp(16px,2vw,28px);flex-wrap:wrap;margin-top:clamp(24px,2.8vw,36px);font-family:var(--deck-mono);font-size:12px;color:var(--deck-ink-2)}

/* ---- layout: reason list ---- */
.reasonlist{display:flex;flex-direction:column;gap:12px;margin-top:clamp(28px,3.2vw,40px);max-width:760px}
.reason{display:flex;align-items:center;gap:14px;background:var(--deck-panel);padding:clamp(14px,1.6vw,18px) clamp(18px,2vw,22px);border-radius:var(--deck-radius)}
.reason .picto{width:20px;height:20px;color:var(--deck-ink);flex:none}
.reason p{margin:0;font-size:clamp(15px,1.15vw,18px);font-weight:600;color:var(--deck-ink);line-height:1.3}

/* ---- layout: split ---- */
.split{display:grid;grid-template-columns:1fr 1fr;gap:clamp(20px,3vw,56px);margin-top:clamp(24px,2.8vw,34px)}
.card{background:var(--deck-panel);border-radius:var(--deck-radius);padding:clamp(22px,2.4vw,30px)}
.card .picto{width:24px;height:24px;color:var(--deck-ink);margin-bottom:14px}
.card h3{margin:0 0 12px;font-size:clamp(18px,1.5vw,24px);font-weight:700;color:var(--deck-ink)}
.card ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:9px}
.card li{font-size:clamp(13px,1.05vw,16px);font-weight:600;line-height:1.4;color:var(--deck-ink-2);padding-left:14px;position:relative}
.card li::before{content:'';position:absolute;left:0;top:8px;width:5px;height:5px;border-radius:50%;background:var(--deck-accent-3)}

/* ---- layout: tiles + detail panel ---- */
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:clamp(28px,3.2vw,40px)}
.tile{background:var(--deck-panel);border-radius:calc(var(--deck-radius) * .7);padding:clamp(16px,1.6vw,20px);font-size:clamp(13px,1.05vw,15px);font-weight:600;color:var(--deck-ink);display:flex;align-items:center;gap:10px;min-height:64px;width:100%;text-align:left;border:none;cursor:pointer}
.tile:hover{background:var(--deck-panel-2)}
.tile.active{background:var(--deck-accent-4)}
.tile .picto{width:20px;height:20px;flex:none}
.tile-detail{position:relative;display:flex;align-items:flex-start;gap:14px;margin-top:0;min-height:0;background:var(--deck-panel-2);border-radius:var(--deck-radius);padding:0 44px 0 clamp(18px,2vw,22px);overflow:hidden;opacity:0;transform:translateY(10px) scale(.97);pointer-events:none;transition:opacity .4s var(--deck-ease),transform .4s var(--deck-ease),margin-top .35s var(--deck-ease),min-height .35s var(--deck-ease),padding .35s var(--deck-ease)}
.tile-detail.show{margin-top:clamp(14px,1.6vw,20px);min-height:52px;overflow:visible;padding:clamp(16px,1.8vw,20px) 44px clamp(16px,1.8vw,20px) clamp(18px,2vw,22px);opacity:1;transform:none;pointer-events:auto}
.tile-detail h4{margin:0 0 6px;font-size:clamp(15px,1.2vw,18px);font-weight:700}
.tile-detail ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}
.tile-detail li{font-size:clamp(13px,1.05vw,15px);font-weight:600;line-height:1.4;padding-left:14px;position:relative;color:var(--deck-ink-2)}
.tile-detail li::before{content:'';position:absolute;left:0;top:7px;width:5px;height:5px;border-radius:50%;background:var(--deck-accent-3)}
.detail-close{position:absolute;top:10px;right:10px;width:26px;height:26px;display:grid;place-items:center;border:none;border-radius:999px;background:transparent;color:var(--deck-ink-3);cursor:pointer}
.detail-close:hover{background:var(--deck-panel);color:var(--deck-ink)}

/* ---- layout: stats ---- */
.statgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(14px,1.8vw,20px);margin-top:clamp(28px,3.2vw,40px)}
.stat{background:var(--deck-panel);border-radius:calc(var(--deck-radius) * .9);padding:clamp(22px,2.4vw,28px)}
.stat .num{font-size:clamp(38px,4vw,54px);font-weight:800;line-height:1;margin-bottom:10px;color:var(--deck-ink);display:inline-block}
.stat .lbl{font-size:13px;font-weight:600;color:var(--deck-ink-2)}

/* ---- layout: carousel ---- */
.carousel{margin-top:clamp(20px,2.4vw,28px);width:100%;max-width:1180px}
.carousel-stage{position:relative;width:100%;aspect-ratio:16/9;border-radius:var(--deck-radius);overflow:hidden;background:var(--deck-panel)}
.carousel-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .35s ease}
.carousel-img.active{opacity:1}
.carousel-bar{display:flex;align-items:center;gap:14px;margin-top:16px}
.carousel-note{flex:1;margin:0 0 0 10px;font-size:15px;line-height:1.4;color:var(--deck-ink-2)}
.carousel-nav{flex:none;width:40px;height:40px;border:0;border-radius:50%;background:var(--deck-panel-2);color:var(--deck-ink);font-size:16px;cursor:pointer;transition:background .18s ease}
.carousel-nav:hover{background:var(--deck-panel)}
.carousel-dots{display:flex;gap:8px;flex:none}
.carousel-dot{width:7px;height:7px;padding:0;border:0;border-radius:50%;background:var(--deck-ink-3);cursor:pointer;transition:background .18s ease,transform .18s ease}
.carousel-dot.active{background:var(--deck-ink);transform:scale(1.25)}

/* ---- layout: exhibit ---- */
.exhibit{display:grid;grid-template-columns:1fr 1fr;gap:clamp(14px,1.6vw,24px);margin-top:clamp(20px,2.4vw,30px)}
.exhibit-pane{margin:0;display:flex;flex-direction:column;gap:10px}
.exhibit-cap{font-family:var(--deck-mono);font-size:12px;font-weight:500;letter-spacing:.02em;color:var(--deck-ink-2)}
.exhibit img{display:block;width:100%;height:auto;aspect-ratio:16/10;object-fit:cover;border-radius:var(--deck-radius);background:var(--deck-panel)}
.exhibit-slot{position:relative;width:100%;aspect-ratio:16/10;border-radius:var(--deck-radius);background:var(--deck-panel);display:flex;align-items:center;justify-content:center}
.exhibit-slot::after{content:attr(data-slot);font-family:var(--deck-mono);font-size:clamp(10px,.8vw,12px);font-weight:500;color:var(--deck-ink-3);text-align:center;padding:0 16px}

/* ---- layout: recap ---- */
.recap{list-style:none;margin:clamp(24px,2.8vw,34px) 0 0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:10px clamp(20px,2.6vw,44px)}
.recap li{display:flex;align-items:baseline;gap:9px;font-size:clamp(13px,1.05vw,16px);font-weight:600;line-height:1.4;color:var(--deck-ink);background:var(--deck-panel);border-radius:calc(var(--deck-radius) * .62);padding:clamp(11px,1.15vw,15px) clamp(13px,1.3vw,17px)}
.recap-n{flex:none;min-width:30px;color:var(--deck-ink-3);font-family:var(--deck-mono);font-size:12px}

/* ---- odds and ends ---- */
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:clamp(18px,2vw,26px)}
.chip{font-family:var(--deck-mono);font-size:clamp(11px,.9vw,13px);font-weight:500;color:var(--deck-ink);background:var(--deck-panel);border-radius:calc(var(--deck-radius) * .45);padding:7px 11px}
.outrow{display:flex;gap:clamp(14px,1.6vw,20px);flex-wrap:wrap;margin-top:clamp(28px,3.2vw,40px)}
.outrow .item{font-size:clamp(14px,1.1vw,16px);font-weight:600;display:flex;align-items:center;gap:10px;background:var(--deck-panel);padding:12px 18px;border-radius:calc(var(--deck-radius) * .7)}
.ctarow{display:flex;align-items:center;gap:clamp(18px,2vw,26px);margin-top:clamp(30px,3.4vw,42px);flex-wrap:wrap}
.btn{font-weight:700;font-size:14px;padding:14px 26px;border-radius:999px;border:none;background:var(--deck-ink);color:var(--deck-bg);cursor:pointer}
.ctarow .note{font-size:13px;font-family:var(--deck-mono);color:var(--deck-ink-2)}


/* ---- bleed: an image or a colour that runs to the edge of the slide ----
   A padded image reads as an illustration; the same image touching three
   edges reads as the slide itself, which is the difference between the
   reference decks and a document with pictures in it. */
.slide.bleed{padding:0;display:grid;grid-template-columns:1fr 1fr;align-items:stretch;gap:0}
.slide.bleed.right{grid-template-columns:1fr 1fr}
.slide.bleed>.bleed-media{position:relative;overflow:hidden;z-index:2;background:var(--deck-panel-2)}
.slide.bleed>.bleed-media img,.slide.bleed>.bleed-media video{width:100%;height:100%;object-fit:cover;display:block}
.slide.bleed.right>.bleed-media{order:2}
.slide.bleed>.inner{max-width:none;margin:0;display:flex;flex-direction:column;justify-content:center;padding:clamp(48px,6vw,96px) clamp(32px,4.4vw,76px)}
.slide.bleed>.bleed-media{opacity:0;transform:scale(1.06);transition:opacity .8s ease,transform 1s var(--deck-ease)}
.slide.bleed.in-view>.bleed-media{opacity:1;transform:scale(1)}

/* ---- bars: the chart every one of these decks opens its numbers with ---- */
.bars{display:flex;align-items:stretch;gap:clamp(8px,1vw,14px);margin-top:clamp(28px,3.2vw,40px);height:clamp(180px,26vh,300px)}
.bar{flex:1;min-width:0;display:grid;grid-template-rows:1fr auto;justify-items:center;gap:10px;text-align:center}
.bar>.col{align-self:end;width:100%;height:calc(var(--v,50) * 1%);max-height:100%;min-height:34px;background:var(--deck-panel-2);border-radius:calc(var(--deck-radius) * .5) calc(var(--deck-radius) * .5) 0 0;display:flex;align-items:flex-start;justify-content:center;padding:12px 8px;transform-origin:50% 100%;transform:scaleY(0);transition:transform .8s var(--deck-ease);transition-delay:calc(var(--n,0) * 80ms + 120ms)}
.slide.in-view .bar>.col{transform:scaleY(1)}
.bar.on>.col{background:var(--deck-accent-1)}
.bar.on>.col .v{color:var(--deck-bg)}
.bar .v{font-size:clamp(16px,1.7vw,28px);font-weight:700;color:var(--deck-ink);line-height:1}
.bar .k{font-size:clamp(11px,.9vw,13px);font-weight:600;color:var(--deck-ink-2);line-height:1.3}

/* ---- swatches: a palette shown as itself ---- */
.swatches{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:2px;margin-top:clamp(28px,3.2vw,40px);min-height:clamp(200px,30vh,340px);border-radius:var(--deck-radius);overflow:hidden}
.swatch{display:flex;flex-direction:column;justify-content:flex-end;gap:3px;padding:clamp(14px,1.6vw,20px);background:var(--sw,var(--deck-panel-2));color:var(--sw-ink,var(--deck-ink))}
.swatch .nm{font-size:clamp(12px,1vw,14px);font-weight:700}
.swatch .hx,.swatch .ro{font-family:var(--deck-mono);font-size:11px;opacity:.72}

/* ---- figure: an image that says who is in it ---- */
/* Flexible rather than a fixed four-column grid: two people should sit on
   the headline's left edge at a readable size, not be stranded at a quarter
   width next to an invisible grid. The cap stops two figures becoming
   billboards; the aspect ratio sets the height either way. */
.figures{display:flex;flex-wrap:wrap;gap:clamp(10px,1.2vw,16px);margin-top:clamp(28px,3.2vw,40px)}
.figure{position:relative;flex:1 1 0;min-width:0;max-width:340px;overflow:hidden;border-radius:calc(var(--deck-radius) * .7);aspect-ratio:3/4;background:var(--deck-panel-2)}
.figure img{width:100%;height:100%;object-fit:cover;display:block}
/* A grid, not two inline spans — otherwise the name and the role print as
   one word ("Daniel VerhartCEO"). */
.figcap{position:absolute;left:0;right:0;bottom:0;display:grid;gap:2px;padding:clamp(9px,1vw,13px) clamp(11px,1.2vw,15px);background:var(--deck-accent-1);color:var(--deck-bg)}
.figcap .nm{font-size:clamp(12px,1vw,15px);font-weight:700;line-height:1.2}
.figcap .ro{font-family:var(--deck-mono);font-size:10px;opacity:.8}

/* ---- specimen: a face shown at the size it is meant to be read ---- */
.specimens{display:grid;grid-template-columns:1fr 1fr;gap:clamp(18px,2.4vw,34px);margin-top:clamp(28px,3.2vw,40px)}
.specimen{display:flex;gap:clamp(16px,2vw,26px);align-items:flex-start}
.specimen .aa{font-size:clamp(40px,4.6vw,72px);font-weight:700;line-height:.9;color:var(--deck-ink);flex:none}
.specimen h3{margin:0 0 6px;font-family:var(--deck-mono);font-size:clamp(11px,.92vw,13px);font-weight:500;color:var(--deck-ink-2)}
.specimen p{margin:0;font-size:clamp(15px,1.4vw,22px);font-weight:600;line-height:1.3;color:var(--deck-ink)}
.specimen.body p{font-size:clamp(13px,1.05vw,15px);font-weight:400;color:var(--deck-ink-2);line-height:1.5}

/* ---- the slide number the reference decks all carry ---- */
.deck-num{align-self:flex-start;font-family:var(--deck-mono);font-size:11px;letter-spacing:.04em;color:var(--deck-ink-3)}

@media (max-width:900px){
.split,.statgrid,.exhibit,.recap,.specimens{grid-template-columns:1fr}
.slide.bleed{grid-template-columns:1fr;grid-template-rows:1fr auto}
.slide.bleed.right>.bleed-media{order:0}
.figures{grid-auto-flow:row;grid-template-columns:repeat(2,1fr)}
.figure{max-width:none;flex-basis:calc(50% - 8px)}
.swatches{grid-auto-flow:row;grid-auto-columns:auto}
.tiles{grid-template-columns:repeat(2,1fr)}
.slide.cover>.inner{max-width:100%}
.cover-bg{display:none}
.nav-cluster{display:none}}
@media (prefers-reduced-motion:reduce){
*,*::before,*::after{animation-duration:.01ms !important;animation-iteration-count:1 !important;scroll-behavior:auto !important}
.slide>.inner,.slide-bg,[data-reveal],.reason,.card,.tile,.stat,.recap li,.outrow .item,.display .w,.figure,.specimen,.bar>.col,.slide.bleed>.bleed-media{transition-duration:.01ms !important;opacity:1 !important;transform:none !important;filter:none !important}}`

export const DECK_JS = `(function(){
var R=matchMedia('(prefers-reduced-motion:reduce)').matches;
function ready(f){document.readyState!='loading'?f():document.addEventListener('DOMContentLoaded',f)}
ready(function(){
var deck=document.querySelector('.deck');if(!deck)return;
var slides=[].slice.call(deck.querySelectorAll('.slide'));if(!slides.length)return;
var idx=0;

// Headlines rise a word at a time, so each word needs its own box. Done here
// rather than in the markup because a writer should not be typing spans.
slides.forEach(function(s){
  [].forEach.call(s.querySelectorAll('.display'),function(h){
    if(h.querySelector('.w'))return;
    var i=0;
    // Walk the text nodes rather than rewriting innerHTML from textContent:
    // a heading is where <span class="accent"> and <mark> live, and reading
    // it back as plain text throws both of them away.
    (function walk(node){
      [].slice.call(node.childNodes).forEach(function(n){
        if(n.nodeType===1){walk(n);return}
        if(n.nodeType!==3||!n.nodeValue.trim())return;
        var frag=document.createDocumentFragment();
        n.nodeValue.split(/(\\s+)/).forEach(function(p){
          if(!p)return;
          if(!p.trim()){frag.appendChild(document.createTextNode(p));return}
          var mask=document.createElement('span');mask.className='wmask';
          var w=document.createElement('span');w.className='w';
          w.style.setProperty('--i',i++);w.textContent=p;
          mask.appendChild(w);frag.appendChild(mask)
        });
        n.parentNode.replaceChild(frag,n)
      })
    })(h)
  });
  // Stagger indices, so a list of any length cascades without a rule per item.
  [].forEach.call(s.querySelectorAll('.reasonlist,.split,.tiles,.statgrid,.outrow,.recap,.bars,.figures,.swatches,.specimens'),function(g){
    [].forEach.call(g.children,function(c,i){c.style.setProperty('--n',i)})
  })
});

[].forEach.call(document.querySelectorAll('.swatch'),function(w){
  var hex=(w.getAttribute('data-hex')||(w.querySelector('.hx')||{}).textContent||'').trim();
  if(!/^#[0-9a-f]{6}$/i.test(hex))return;
  w.style.setProperty('--sw',hex);
  var n=parseInt(hex.slice(1),16),
      L=(0.2126*((n>>16)&255)+0.7152*((n>>8)&255)+0.0722*(n&255))/255;
  w.style.setProperty('--sw-ink',L>0.55?'#111':'#fff')
});

var num=document.querySelector('.deck-num');
var dotsWrap=document.querySelector('.dots');
var tocList=document.querySelector('.toc-list');
var toc=document.querySelector('.toc');
var dots=[];
slides.forEach(function(s,i){
  var title=s.getAttribute('data-title')||('Slide '+(i+1));
  if(dotsWrap){
    var d=document.createElement('button');
    d.type='button';d.setAttribute('aria-label',title);
    d.addEventListener('click',function(e){e.stopPropagation();go(i)});
    dotsWrap.appendChild(d);dots.push(d)
  }
  if(tocList){
    var li=document.createElement('li');
    var b=document.createElement('button');
    b.type='button';b.className='toc-item';
    b.innerHTML='<span class="toc-n">'+String(i+1).padStart(2,'0')+'</span><span>'+title+'</span>';
    b.addEventListener('click',function(e){e.stopPropagation();go(i);closeToc()});
    li.appendChild(b);tocList.appendChild(li)
  }
});

function closeToc(){if(!toc)return;toc.classList.remove('open');toc.setAttribute('aria-hidden','true');toc.setAttribute('inert','');var t=document.querySelector('.toc-btn');if(t)t.setAttribute('aria-expanded','false')}
function openToc(){if(!toc)return;toc.classList.add('open');toc.setAttribute('aria-hidden','false');toc.removeAttribute('inert')}
var tocBtn=document.querySelector('.toc-btn');
if(tocBtn&&toc){
  tocBtn.addEventListener('click',function(e){
    e.stopPropagation();
    var on=!toc.classList.contains('open');
    on?openToc():closeToc();
    tocBtn.setAttribute('aria-expanded',String(on))
  })
}
if(toc)addEventListener('click',function(e){
  if(toc.classList.contains('open')&&!e.target.closest('.nav-cluster')){closeToc();if(tocBtn)tocBtn.setAttribute('aria-expanded','false')}
},true);
var tocClose=document.querySelector('.toc-close');
if(tocClose)tocClose.addEventListener('click',function(e){e.stopPropagation();closeToc()});

function go(i){
  idx=Math.max(0,Math.min(slides.length-1,i));
  deck.scrollTo({left:idx*deck.clientWidth,behavior:R?'auto':'smooth'})
}
function mark(){
  slides.forEach(function(s,i){s.classList.toggle('in-view',i===idx)});
  dots.forEach(function(d,i){d.classList.toggle('active',i===idx)});
  if(tocList)[].forEach.call(tocList.querySelectorAll('.toc-item'),function(b,i){b.classList.toggle('current',i===idx)});
  if(num)num.textContent='['+String(idx+1).padStart(2,'0')+']';
  var g=slides[idx]&&slides[idx].getAttribute('data-ground');
  if(g)document.documentElement.setAttribute('data-slide-ground',g);
  else document.documentElement.removeAttribute('data-slide-ground');
  if(location.hash.slice(1)!==String(idx+1))history.replaceState(null,'','#'+(idx+1))
}

var raf=false;
deck.addEventListener('scroll',function(){
  if(raf)return;raf=true;
  requestAnimationFrame(function(){
    raf=false;
    var w=deck.clientWidth||1;
    var n=Math.round(deck.scrollLeft/w);
    // Background art drifts against the scroll, which is what makes a snap
    // scroller read as depth rather than as a slideshow.
    slides.forEach(function(s,i){
      var bg=s.querySelector('.slide-bg');if(!bg)return;
      var d=parseFloat(bg.getAttribute('data-depth')||'0.05');
      bg.style.setProperty('--px',((i*w-deck.scrollLeft)*-d).toFixed(1)+'px')
    });
    if(n!==idx){idx=n;mark()}
  })
},{passive:true});

addEventListener('keydown',function(e){
  if(/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement||{}).tagName||''))return;
  if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' '){e.preventDefault();go(idx+1)}
  else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();go(idx-1)}
  else if(e.key==='Home'){e.preventDefault();go(0)}
  else if(e.key==='End'){e.preventDefault();go(slides.length-1)}
  else if(e.key==='Escape')closeToc()
});

// A wheel is a vertical gesture on most hardware; a horizontal deck has to
// take it or the deck simply will not move for half its audience.
deck.addEventListener('wheel',function(e){
  if(Math.abs(e.deltaY)<=Math.abs(e.deltaX))return;
  e.preventDefault();deck.scrollLeft+=e.deltaY
},{passive:false});

// Click anywhere that is not itself a control advances, the way a remote does.
deck.addEventListener('click',function(e){
  if(e.target.closest('button,a,input,select,textarea,[data-carousel],.tile-detail'))return;
  go(idx+1)
});

var brand=document.querySelector('.brand');
if(brand)brand.addEventListener('click',function(e){e.stopPropagation();go(0)});

// ---- carousels ----
[].forEach.call(document.querySelectorAll('[data-carousel]'),function(c){
  var imgs=[].slice.call(c.querySelectorAll('.carousel-img'));if(!imgs.length)return;
  var note=c.querySelector('[data-car-note]'),dotBox=c.querySelector('[data-car-dots]'),at=0,cdots=[];
  if(dotBox)imgs.forEach(function(_,i){
    var b=document.createElement('button');b.type='button';b.className='carousel-dot';
    b.setAttribute('aria-label','Example '+(i+1));
    b.addEventListener('click',function(e){e.stopPropagation();show(i)});
    dotBox.appendChild(b);cdots.push(b)
  });
  function show(i){
    at=(i+imgs.length)%imgs.length;
    imgs.forEach(function(m,j){m.classList.toggle('active',j===at)});
    cdots.forEach(function(d,j){d.classList.toggle('active',j===at)});
    if(note)note.textContent=imgs[at].getAttribute('data-note')||''
  }
  var p=c.querySelector('[data-car-prev]'),n=c.querySelector('[data-car-next]');
  if(p)p.addEventListener('click',function(e){e.stopPropagation();show(at-1)});
  if(n)n.addEventListener('click',function(e){e.stopPropagation();show(at+1)});
  show(0)
});

// ---- tiles that open a detail panel ----
[].forEach.call(document.querySelectorAll('.tiles'),function(grid){
  var panel=grid.parentElement.querySelector('.tile-detail');if(!panel)return;
  var body=panel.querySelector('[data-detail-body]')||panel;
  var open=null;
  function close(){if(open)open.classList.remove('active');open=null;panel.classList.remove('show')}
  var x=panel.querySelector('.detail-close');
  if(x)x.addEventListener('click',function(e){e.stopPropagation();close()});
  [].forEach.call(grid.querySelectorAll('.tile'),function(t){
    t.addEventListener('click',function(e){
      e.stopPropagation();
      if(open===t){close();return}
      if(open)open.classList.remove('active');
      open=t;t.classList.add('active');
      var src=document.getElementById(t.getAttribute('data-detail')||'');
      body.innerHTML=src?src.innerHTML:('<h4>'+t.textContent.trim()+'</h4>');
      if(x&&!panel.contains(x))panel.appendChild(x);
      panel.classList.add('show')
    })
  })
});

var start=parseInt(location.hash.slice(1),10);
if(start>0&&start<=slides.length){
  idx=start-1;
  // A scroll set during load is not reliably kept: the snap container
  // re-snaps, and a browser restoring a previous position lands on top of it.
  // Re-assert it over the next frames and once more after load, then stop.
  var want=idx,tries=0;
  (function place(){
    deck.scrollLeft=want*deck.clientWidth;
    if(++tries<6)requestAnimationFrame(place)
  })();
  addEventListener('load',function(){deck.scrollLeft=want*deck.clientWidth},{once:true})
}
mark();
// Changing only the fragment does not reload the page, so a link pasted into
// the address bar of an already-open deck would otherwise do nothing.
addEventListener('hashchange',function(){
  var n=parseInt(location.hash.slice(1),10);
  if(n>0&&n<=slides.length&&n-1!==idx)go(n-1)
});
addEventListener('resize',function(){deck.scrollLeft=idx*deck.clientWidth},{passive:true})
})})()`

/** How to write slides against the chassis. Injected with the code itself. */
export const DECK_USAGE = `THE CHASSIS IS THE DECK. Write slides against it; do not rebuild it.
It already gives you: horizontal snap navigation, arrow/space/Home/End keys, wheel, click-to-advance, a dots rail, a Contents list built from your slide titles, deep links (#3), reveal-on-enter, word-by-word headlines, background parallax, carousels, and the tile detail panel. Do not write your own navigation, your own reveal observer, or your own reset.

SKELETON — the page is exactly this shape:
<body>
<div class="frame">
  <button type="button" class="brand"><span class="dot"></span>Brand or project name</button>
  <div class="foot"><span class="deck-num"></span><span class="footnote">Any standing footer line, or omit</span></div>
</div>
<div class="nav-cluster">
  <nav class="toc" aria-label="All slides" aria-hidden="true" inert>
    <div class="toc-head"><span class="toc-heading">Contents</span><button type="button" class="toc-close" aria-label="Close contents"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></div>
    <ol class="toc-list"></ol>
  </nav>
  <button type="button" class="toc-btn" aria-label="Contents" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
  <div class="dots"></div>
</div>
<main class="deck">  ...one <section class="slide" data-title="…"> per slide...  </main>
</body>

EVERY SLIDE:
- <section class="slide" data-title="Short label"> — data-title feeds the Contents list and the dot labels, so give every slide one.
- Content goes in a single <div class="inner">. Nothing outside it except an optional <div class="slide-bg" data-depth="0.05"><img src="…" alt=""></div>.
- Headings are <h1 class="display"> on the cover and <h2 class="display"> everywhere else. The chassis splits them into words; write plain text.
- data-reveal="1".."5" on blocks you want to arrive in order.
- Optional above the heading: <span class="eyebrow">Section 02</span>. Optional under it: <p class="lede">…</p>.
- Colour a phrase with <span class="accent">…</span> — it takes the brand gradient. Highlight one with <mark>…</mark>.
- data-ground="invert" | "accent" | "soft" on the <section> changes that slide's ground and turns every colour in it over for you. Use it to break a run of identical slides: roughly every third or fourth slide, and always on the recap. Do not restate colours yourself.

THE LAYOUTS:
1. Cover — <section class="slide cover" data-title="Cover">, an <h1 class="display">, an optional <div class="cover-bg"><img …></div>, and an optional <div class="cover-meta"><span>Author</span><span>Date</span></div>.
2. Reason list — <div class="reasonlist"> of <div class="reason" data-reveal="n"><span class="picto"><svg…></svg></span><p>One sentence.</p></div>. Three to five. The workhorse.
3. Carousel — <div class="carousel" data-carousel><div class="carousel-stage"><img class="carousel-img active" src="…" alt="…" data-note="Caption"> …</div><div class="carousel-bar"><button class="carousel-nav" data-car-prev aria-label="Previous">←</button><button class="carousel-nav" data-car-next aria-label="Next">→</button><div class="carousel-dots" data-car-dots></div><p class="carousel-note" data-car-note></p></div></div>.
4. Split — <div class="split"> of two <div class="card" data-reveal="n"> each with a .picto, an <h3> and a <ul> of three to five <li>.
5. Exhibit — <div class="exhibit"> of two <figure class="exhibit-pane"> each with an <img> (or <div class="exhibit-slot" data-slot="What this image should show">) and a <figcaption class="exhibit-cap">.
6. Tiles — <div class="tiles"> of <button class="tile" data-detail="d-1"> …, followed by <div class="tile-detail"><button class="detail-close" aria-label="Close">×</button><div data-detail-body></div></div>, plus one <template id="d-1"><h4>…</h4><ul><li>…</li></ul></template> per tile.
7. Recap — <ol class="recap"> of <li><span class="recap-n">01</span>Point</li>.
8. Bars — <div class="bars"> of <div class="bar" style="--v:74"><div class="col"><span class="v">+218%</span></div><span class="k">Revenue</span></div>. --v is the height as a percentage. Put class="bar on" on the one bar the slide is about; leave the rest plain. Use this instead of a paragraph whenever the point is a comparison.
9. Figures — <div class="figures"> of <figure class="figure"><img src="…" alt="…"><figcaption class="figcap"><span class="nm">Name</span><span class="ro">Role</span></figcaption></figure>. For people and for portfolio work.
10. Swatches — <div class="swatches"> of <div class="swatch" data-hex="#8F1D1B"><span class="nm">Deep Maroon</span><span class="hx">#8F1D1B</span><span class="ro">Accent</span></div>. Each swatch paints itself from its own hex and picks readable type; do not colour them yourself.
11. Specimens — <div class="specimens"> of <div class="specimen"><span class="aa">Aa</span><div><h3>Heading — 700</h3><p>The line it is meant to set.</p></div></div>. Add class="specimen body" for the body face.
12. Bleed — <section class="slide bleed" data-title="…"> (add class="bleed right" to put the picture on the right) containing exactly <div class="bleed-media"><img src="…" alt=""></div> and <div class="inner">…</div>. The picture runs to three edges. Use it once or twice, for the slide that has to land.
Also available: <div class="statgrid"> of <div class="stat"><div class="num">88%</div><div class="lbl">…</div></div>; <div class="chips"> of <span class="chip">; <div class="outrow"> of <span class="item">; <div class="ctarow"><button class="btn">…</button><span class="note">…</span></div>.

MAKING IT YOURS:
- Redeclare the tokens in your own <style> after the chassis: --deck-bg, --deck-panel, --deck-panel-2, --deck-ink, --deck-ink-2, --deck-ink-3, --deck-accent-1..4, --deck-font, --deck-mono, --deck-radius. That is how the palette is applied — do not hardcode colours on elements.
- For a light deck put data-deck-tone="light" on <html> as well, so the panel tints and the sheen turn over with it. Never set a light --deck-bg without it.
- Load your fonts with a <link> to Google Fonts and point --deck-font at them.
- Icons are inline <svg> inside <span class="picto">, stroke="currentColor", 24×24 viewBox. Never emoji.
- Images you do not have: use <div class="exhibit-slot" data-slot="A short description of the picture that belongs here">, or an <img> pointing at a real, stable, hotlinkable URL. Never invent a local file path.
- Eight to fourteen slides. Every slide must be one of the layouts above; a slide that is only a heading and a paragraph is not a slide.`

/** The inline chassis block to drop into the generated deck once. */
export function buildDeckBaseBlock(): string {
  return `<style id="${DECK_BASE_ID}">\n${DECK_CSS}\n</style>\n<script id="${DECK_RUNTIME_ID}" defer>\n${DECK_JS}\n</script>`
}
