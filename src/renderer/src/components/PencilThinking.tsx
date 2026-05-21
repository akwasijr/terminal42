// Drawing-style "thinking" indicator for the canvas. Each design kind gets
// a slightly different animation that hints at what's about to render :
// slides draw three slide outlines, charts draw rising bars, web kinds draw
// stacked page sections, prints draw a single artboard outline, etc. A small
// pencil glyph sits at the trailing edge of the drawn line.
//
// All variants use the same stroke-dashoffset technique driven by CSS
// keyframes in styles/globals.css. No SVG <animateMotion> (it was
// rendering inconsistently before).

type AnimationKind = 'signature' | 'slides' | 'chart' | 'page' | 'square' | 'lines'

export function pickAnimationForKind(kind?: string | null): AnimationKind {
  if (!kind) return 'signature'
  if (['pitch-deck', 'sales-deck', 'talk-slides', 'workshop-deck'].includes(kind)) return 'slides'
  if (['chart', 'infographic', 'report'].includes(kind)) return 'chart'
  if (['landing', 'app-screen', 'dashboard', 'pricing', 'login', 'hero', 'component', 'wireframe'].includes(kind)) return 'page'
  if (['social-post', 'social-story', 'cover-image', 'ad-banner', 'poster', 'flyer', 'invitation', 'business-card', 'certificate', 'mood-board', 'style-tile'].includes(kind)) return 'square'
  if (['blog-post', 'case-study', 'resume', 'one-pager', 'brochure', 'email', 'design-system', 'component-library'].includes(kind)) return 'lines'
  return 'signature'
}

export function PencilThinking({
  size = 'md',
  variant = 'signature'
}: {
  size?: 'sm' | 'md' | 'lg'
  variant?: AnimationKind
}): JSX.Element {
  const dim = size === 'lg' ? { w: 220, h: 90 } : size === 'sm' ? { w: 90, h: 40 } : { w: 150, h: 60 }
  return (
    <span className="t42-pencil" aria-hidden="true">
      <svg viewBox="0 0 220 90" width={dim.w} height={dim.h} preserveAspectRatio="xMidYMid meet">
        {variant === 'slides'    && <Slides />}
        {variant === 'chart'     && <Chart />}
        {variant === 'page'      && <Page />}
        {variant === 'square'    && <Square />}
        {variant === 'lines'     && <Lines />}
        {variant === 'signature' && <Signature />}
      </svg>
    </span>
  )
}

// ─── Per-kind drawn paths ───────────────────────────────────────────────────
// All paths use class .t42-pencil-line with kind-specific dasharray length
// applied via inline style. Drawing duration kept at 2.4s across the board
// so the pencil bob stays in sync.

function Signature(): JSX.Element {
  return (
    <path
      className="t42-pencil-line"
      style={{ strokeDasharray: 360 }}
      d="M 10 60
         C 22 28, 44 28, 56 56
         C 66 84, 96 16, 118 50
         S 158 70, 178 40
         C 188 24, 200 30, 208 44"
      fill="none"
    />
  )
}

function Slides(): JSX.Element {
  // Three slide outlines drawn left → right in sequence.
  return (
    <>
      <rect className="t42-pencil-line" style={{ strokeDasharray: 200 }}
            x="14" y="22" width="56" height="40" rx="3" fill="none" />
      <rect className="t42-pencil-line t42-pencil-d1" style={{ strokeDasharray: 200 }}
            x="80" y="22" width="56" height="40" rx="3" fill="none" />
      <rect className="t42-pencil-line t42-pencil-d2" style={{ strokeDasharray: 200 }}
            x="146" y="22" width="56" height="40" rx="3" fill="none" />
    </>
  )
}

function Chart(): JSX.Element {
  // X axis baseline + 5 bars rising (drawn as vertical strokes).
  return (
    <>
      <line className="t42-pencil-line" style={{ strokeDasharray: 200 }}
            x1="20" y1="68" x2="200" y2="68" />
      <line className="t42-pencil-line t42-pencil-d1" style={{ strokeDasharray: 60 }}
            x1="40"  y1="68" x2="40"  y2="50" strokeWidth="6" strokeLinecap="round" />
      <line className="t42-pencil-line t42-pencil-d1" style={{ strokeDasharray: 60 }}
            x1="70"  y1="68" x2="70"  y2="40" strokeWidth="6" strokeLinecap="round" />
      <line className="t42-pencil-line t42-pencil-d2" style={{ strokeDasharray: 60 }}
            x1="100" y1="68" x2="100" y2="28" strokeWidth="6" strokeLinecap="round" />
      <line className="t42-pencil-line t42-pencil-d2" style={{ strokeDasharray: 60 }}
            x1="130" y1="68" x2="130" y2="36" strokeWidth="6" strokeLinecap="round" />
      <line className="t42-pencil-line t42-pencil-d2" style={{ strokeDasharray: 60 }}
            x1="160" y1="68" x2="160" y2="20" strokeWidth="6" strokeLinecap="round" />
    </>
  )
}

function Page(): JSX.Element {
  // Browser frame + a stack of section lines.
  return (
    <>
      <rect className="t42-pencil-line" style={{ strokeDasharray: 600 }}
            x="14" y="14" width="180" height="60" rx="4" fill="none" />
      <line className="t42-pencil-line t42-pencil-d1" style={{ strokeDasharray: 60 }}
            x1="14" y1="26" x2="194" y2="26" />
      <line className="t42-pencil-line t42-pencil-d2" style={{ strokeDasharray: 80 }}
            x1="26" y1="40" x2="106" y2="40" strokeWidth="3" strokeLinecap="round" />
      <line className="t42-pencil-line t42-pencil-d2" style={{ strokeDasharray: 80 }}
            x1="26" y1="52" x2="160" y2="52" strokeWidth="2" strokeLinecap="round" />
      <line className="t42-pencil-line t42-pencil-d2" style={{ strokeDasharray: 80 }}
            x1="26" y1="62" x2="120" y2="62" strokeWidth="2" strokeLinecap="round" />
    </>
  )
}

function Square(): JSX.Element {
  // Single artboard outline (poster / social tile / business card etc.) +
  // a small inner mark.
  return (
    <>
      <rect className="t42-pencil-line" style={{ strokeDasharray: 280 }}
            x="70" y="14" width="80" height="60" rx="3" fill="none" />
      <circle className="t42-pencil-line t42-pencil-d2" style={{ strokeDasharray: 80 }}
              cx="110" cy="44" r="12" fill="none" />
    </>
  )
}

function Lines(): JSX.Element {
  // Document / article: stacked horizontal text lines.
  return (
    <>
      <line className="t42-pencil-line" style={{ strokeDasharray: 200 }}
            x1="14" y1="20" x2="180" y2="20" strokeWidth="3" strokeLinecap="round" />
      <line className="t42-pencil-line t42-pencil-d1" style={{ strokeDasharray: 200 }}
            x1="14" y1="34" x2="160" y2="34" strokeWidth="2" strokeLinecap="round" />
      <line className="t42-pencil-line t42-pencil-d1" style={{ strokeDasharray: 200 }}
            x1="14" y1="46" x2="170" y2="46" strokeWidth="2" strokeLinecap="round" />
      <line className="t42-pencil-line t42-pencil-d2" style={{ strokeDasharray: 200 }}
            x1="14" y1="58" x2="140" y2="58" strokeWidth="2" strokeLinecap="round" />
      <line className="t42-pencil-line t42-pencil-d2" style={{ strokeDasharray: 200 }}
            x1="14" y1="70" x2="120" y2="70" strokeWidth="2" strokeLinecap="round" />
    </>
  )
}

// The 3-square stack: used in chat rails (not the canvas).
export function BoxesThinking(): JSX.Element {
  return (
    <span className="t42-boxes" aria-hidden="true">
      <span /><span /><span />
    </span>
  )
}
