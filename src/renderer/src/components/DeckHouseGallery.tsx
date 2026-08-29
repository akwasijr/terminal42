/**
 * The deck house styles, as something you can look at and choose.
 *
 * The houses have existed for a while, but only inside the generator: one was
 * picked from a hash of the brief and written into the prompt, and nobody ever
 * saw them. That is a strange thing to build — five worked-out art directions
 * that the person making the deck cannot see, compare, or ask for.
 *
 * So they get a gallery, and the gallery is here beside the designs rather
 * than in Motion, because a deck is a design.
 *
 * The previews are drawn from `DECK_STYLES` itself — the same ground, inks,
 * accents, faces and radius the deck will be built from. Nothing here is a
 * screenshot and nothing is hand-tuned per house, so a house whose colours
 * change shows its new colours here without anyone remembering to update a
 * picture. A preview that can drift from what it promises is worse than none.
 *
 * Deliberately flat: no outlines around the panels, no drop shadows, square
 * or house-radius corners only. The references these houses came from are
 * printed-page flat, and a preview wearing a border and a shadow would be
 * advertising a deck the generator does not make.
 */

import { useEffect, useState, type JSX } from 'react'
import { DECK_STYLES, type DeckStyle } from '../../../shared/decks/houses'

/** Load the houses' faces once, so a preview is set in the type it promises. */
function useHouseFonts(): void {
  useEffect(() => {
    const added: HTMLLinkElement[] = []
    for (const href of new Set(DECK_STYLES.map((s) => s.fontsHref).filter(Boolean) as string[])) {
      if (document.querySelector(`link[href="${href}"]`)) continue
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      document.head.appendChild(link)
      added.push(link)
    }
    // Left in place on unmount: the gallery is reopened often and re-fetching
    // the same stylesheet each time would flash unstyled type for no gain.
  }, [])
}

function tok(s: DeckStyle, name: string, fallback = ''): string {
  return s.tokens[name] ?? fallback
}

/**
 * One house as a miniature slide.
 *
 * Modelled on the slide every one of these decks actually opens with — an
 * index marker, a short headline, a rule, and one accent — because that is the
 * slide a house is recognised by.
 */
function HousePreview({ style }: { style: DeckStyle }): JSX.Element {
  const ink = tok(style, '--deck-ink', '#111')
  const ink2 = tok(style, '--deck-ink-2', ink)
  const ink3 = tok(style, '--deck-ink-3', ink2)
  const accent = tok(style, '--deck-accent-1', ink)
  const accent2 = tok(style, '--deck-accent-2', accent)
  const font = tok(style, '--deck-font', 'system-ui, sans-serif')
  const mono = tok(style, '--deck-mono', 'ui-monospace, monospace')
  const radius = tok(style, '--deck-radius', '0px')
  // The preview is only honest if it sets type the way the chassis does, so it
  // reads the same three heading tokens rather than assuming bold lower case.
  const headWeight = tok(style, '--deck-heading-weight', '800')
  const headCase = tok(style, '--deck-heading-case', 'none') as 'none' | 'uppercase'
  const headTrack = tok(style, '--deck-heading-track', '-0.02em')

  return (
    <div
      aria-hidden="true"
      className="relative aspect-[16/9] w-full overflow-hidden"
      style={{ background: tok(style, '--deck-bg', '#fff'), color: ink }}
    >
      <div className="absolute inset-0 flex flex-col justify-between p-[7%]">
        <div className="flex items-start justify-between">
          <span style={{ font: `500 7px/1 ${mono}`, color: ink3, letterSpacing: '0.04em' }}>[01]</span>
          <span style={{ font: `500 7px/1 ${mono}`, color: ink3 }}>{style.id}</span>
        </div>

        <div>
          <div
            style={{
              fontFamily: font,
              fontWeight: Number(headWeight),
              fontSize: '19px',
              lineHeight: 1.05,
              letterSpacing: headTrack,
              textTransform: headCase,
              color: ink
            }}
          >
            Every slide
            <br />
            earns its place
          </div>
          <div style={{ height: 1, background: ink3, opacity: 0.45, margin: '7px 0 6px' }} />
          <div className="flex items-end gap-[6%]">
            <span style={{ fontFamily: font, fontWeight: 800, fontSize: '17px', lineHeight: 1, color: accent }}>
              88<span style={{ fontSize: '9px' }}>%</span>
            </span>
            <span style={{ font: `400 7px/1.35 ${mono}`, color: ink2, maxWidth: '52%' }}>
              {style.tone === 'dark' ? 'dark' : 'light'}
            </span>
            <span className="ml-auto flex gap-[3px]">
              {[accent, accent2, ink2].map((c, i) => (
                <span key={i} style={{ width: 12, height: 12, background: c, borderRadius: radius === '0px' ? 0 : 3 }} />
              ))}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function DeckHouseGallery({ onUse }: { onUse: (style: DeckStyle) => void }): JSX.Element {
  useHouseFonts()
  const [open, setOpen] = useState<DeckStyle | null>(null)

  return (
    <div className="pb-6">
      <p className="mb-4 max-w-[62ch] text-[12.5px] leading-relaxed text-text-secondary">
        Pick a house and the deck is built in it. Skip this and one is picked for you.
      </p>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {DECK_STYLES.map((style) => (
          <li key={style.id}>
            <button
              type="button"
              onClick={() => setOpen(style)}
              className="block w-full overflow-hidden rounded-panel bg-elevated text-left transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <HousePreview style={style} />
              <span className="block px-3 py-2.5">
                <span className="block text-[12.5px] font-medium text-text-primary">{style.label}</span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-text-muted">{style.note}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {open && <HouseDetail style={open} onClose={() => setOpen(null)} onUse={(st) => { setOpen(null); onUse(st) }} />}
    </div>
  )
}

/** What the house does, in its own words, plus the one button that matters. */
function HouseDetail({
  style,
  onClose,
  onUse
}: {
  style: DeckStyle
  onClose: () => void
  onUse: (style: DeckStyle) => void
}): JSX.Element {
  useEffect(() => {
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])

  const rows: Array<[string, string]> = [
    ['Type', style.type],
    ['Imagery', style.imagery],
    ['Numbers', style.data],
    ['Running order', style.sequence]
  ]

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6"
      role="dialog"
      aria-modal="true"
      aria-label={style.label}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="max-h-[86vh] w-full max-w-4xl overflow-y-auto rounded-panel bg-surface p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-medium text-text-primary">{style.label}</h2>
            <p className="mt-0.5 text-[12px] text-text-muted">{style.note}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-text-muted hover:bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <div className="overflow-hidden rounded-panel">
              <HousePreview style={style} />
            </div>
            <button
              type="button"
              onClick={() => onUse(style)}
              className="mt-4 w-full rounded-md bg-action px-3 py-2 text-[12.5px] font-medium text-action-text hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              Make a deck in this house
            </button>
          </div>

          <dl className="space-y-3">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] text-text-muted">{k}</dt>
                <dd className="text-[12px] leading-normal text-text-secondary">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}
