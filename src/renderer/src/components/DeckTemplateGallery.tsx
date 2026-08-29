import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { DECK_TEMPLATES, type DeckTemplate } from '../../../shared/decks/templates'
import { Modal } from './Modal'

/**
 * The deck templates, shown under Decks.
 *
 * The preview draws each template's own cover composition rather than the same
 * miniature slide in six colours. That was the previous version's failing: the
 * only thing that changed between cards was the palette, so the gallery said
 * every deck was the same deck. A cover here is a marker, a wordmark, a
 * photograph, a split panel or a pair of frames, and you can tell them apart
 * across the room.
 */

/** Pull the fonts the templates name, once, and leave them in place. */
function useTemplateFonts(): void {
  useEffect(() => {
    for (const href of new Set(DECK_TEMPLATES.map((t) => t.fontsHref).filter(Boolean) as string[])) {
      if (document.querySelector(`link[href="${href}"]`)) continue
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      document.head.appendChild(link)
    }
    // Not removed on unmount: the gallery is reopened often and re-fetching the
    // same stylesheet would flash unstyled type for no gain.
  }, [])
}

function tok(t: DeckTemplate, name: string, fallback = ''): string {
  return t.tokens[name] ?? fallback
}

/** The heading style a template sets, as inline CSS for the preview. */
function headingStyle(t: DeckTemplate, px: number): React.CSSProperties {
  return {
    fontFamily: tok(t, '--deck-font', 'system-ui, sans-serif'),
    fontWeight: t.heading.weight,
    fontSize: `${px * t.heading.scale}px`,
    lineHeight: 1.06,
    letterSpacing: t.heading.track,
    textTransform: t.heading.case === 'uppercase' ? 'uppercase' : 'none'
  }
}

/** A photograph we do not have: a flat tint, no stroke, no cross, no plate. */
function Slot({ tint, style }: { tint: string; style?: React.CSSProperties }): JSX.Element {
  return <div style={{ background: tint, ...style }} />
}

/**
 * The template's cover at thumbnail size.
 *
 * Every branch here is one of the reference covers, so the card shows the
 * arrangement you will actually get and not a generic slide.
 */
function CoverPreview({ t }: { t: DeckTemplate }): JSX.Element {
  const ink = tok(t, '--deck-ink', '#111')
  const ink3 = tok(t, '--deck-ink-3', ink)
  const bg = tok(t, '--deck-bg', '#fff')
  const accent = tok(t, '--deck-accent-1', ink)
  const accent4 = tok(t, '--deck-accent-4', accent)
  const mono = tok(t, '--deck-mono', 'ui-monospace, monospace')

  if (t.cover === 'marker') {
    // Deck 01: index marker top left, regular-weight heading, a phrase in the
    // highlighter, a hairline over a footer.
    return (
      <div className="absolute inset-0 flex flex-col p-[7%]" style={{ background: bg, color: ink }}>
        <span style={{ font: `400 7px/1 ${mono}`, color: ink3 }}>[02]</span>
        <div className="mt-auto">
          <div style={headingStyle(t, 19)}>
            Everything your brand
            <br />
            needs to <span style={{ background: accent, padding: '0 2px' }}>stand out</span>
          </div>
        </div>
        <div style={{ height: 1, background: ink3, opacity: 0.4, margin: '8px 0 5px' }} />
        <div className="flex items-center justify-between" style={{ font: `400 6.5px/1 ${mono}`, color: ink3 }}>
          <span>Creative</span>
          <span>www.crtve-studio.com</span>
        </div>
      </div>
    )
  }

  if (t.cover === 'wordmark') {
    // Deck 02: the mark centred on the saturated ground, nothing else.
    return (
      <div className="absolute inset-0 grid place-items-center" style={{ background: bg, color: ink }}>
        <div style={{ ...headingStyle(t, 26), textAlign: 'center' }}>Wordmark</div>
      </div>
    )
  }

  if (t.cover === 'photo') {
    // Deck 03: photograph over the top, heading in a band beneath, second line
    // in the accent.
    return (
      <div className="absolute inset-0 flex flex-col" style={{ background: bg, color: ink }}>
        <Slot tint={accent4} style={{ flex: '1 1 0' }} />
        <div style={{ background: accent, padding: '7% 7% 8%' }}>
          <div style={{ ...headingStyle(t, 15), color: bg }}>
            Performance built on
            <br />
            precision logistics
          </div>
        </div>
      </div>
    )
  }

  if (t.cover === 'panel') {
    // Deck 04: portrait left, heading on the dark panel right, standing header.
    return (
      <div className="absolute inset-0 flex" style={{ background: bg, color: ink }}>
        <div className="flex flex-col justify-between" style={{ width: '34%', padding: '6%' }}>
          <span style={{ font: `400 6px/1 ${tok(t, '--deck-font')}`, color: ink }}>Banyu Company</span>
          <Slot tint={accent4} style={{ height: '52%' }} />
          <span style={{ font: `400 6px/1 ${tok(t, '--deck-font')}`, color: ink3 }}>Page 17</span>
        </div>
        <div className="flex flex-col justify-center" style={{ width: '66%', background: tok(t, '--deck-accent-2', ink), padding: '7%' }}>
          <div style={{ ...headingStyle(t, 15), color: bg }}>
            Crisis budget &amp;
            <br />
            resource planning
          </div>
          <div style={{ height: 1, background: bg, opacity: 0.35, margin: '7px 0 6px' }} />
          <span style={{ font: `400 6px/1.4 ${tok(t, '--deck-font')}`, color: bg, opacity: 0.8 }}>
            Emergency funds · Technology · Maintenance
          </span>
        </div>
      </div>
    )
  }

  // Deck Other: two frames at different crops with light capitals over them.
  return (
    <div className="absolute inset-0 flex flex-col p-[7%]" style={{ background: bg, color: ink }}>
      <div className="flex items-start justify-between">
        <span style={{ font: `400 6.5px/1 ${mono}`, color: ink3 }}>Ref. 01 / 26</span>
        <span style={{ font: `400 6.5px/1 ${mono}`, color: ink3 }}>2026</span>
      </div>
      <div style={{ ...headingStyle(t, 15), margin: '7px 0 8px' }}>
        From mood
        <br />
        to form
      </div>
      <div className="mt-auto flex gap-[4%]">
        <Slot tint={accent4} style={{ width: '38%', height: 34 }} />
        <Slot tint={tok(t, '--deck-accent-2', accent)} style={{ width: '58%', height: 34, opacity: 0.55 }} />
      </div>
    </div>
  )
}

function TemplateCard({
  t,
  onUse,
  onOpen
}: {
  t: DeckTemplate
  onUse: () => void
  onOpen: () => void
}): JSX.Element {
  return (
    <li className="group overflow-hidden rounded-xl bg-surface/40">
      <button
        type="button"
        onClick={onOpen}
        className="relative block aspect-[16/9] w-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label={`${t.name} — see the slides`}
      >
        <CoverPreview t={t} />
      </button>
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-text-primary">{t.name}</p>
          <p className="mt-0.5 text-[12px] leading-snug text-text-secondary">{t.note}</p>
        </div>
        <button
          type="button"
          onClick={onUse}
          className="ml-auto mt-0.5 shrink-0 rounded-md bg-text-primary px-2.5 py-1 text-[12px] font-medium text-bg opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Use
        </button>
      </div>
    </li>
  )
}

/** What the template does, as the short list of moves rather than a paragraph. */
function TemplateDetail({
  t,
  onUse,
  onClose
}: {
  t: DeckTemplate
  onUse: () => void
  onClose: () => void
}): JSX.Element {
  return (
    <Modal title={t.name} onClose={onClose} size="medium">
      <div className="relative aspect-[16/9] w-full overflow-hidden">
        <CoverPreview t={t} />
      </div>
      <div className="px-5 py-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[15px] font-semibold text-text-primary">{t.name}</h2>
          <span className="text-[12px] text-text-muted">{t.source}</span>
        </div>
        <ul className="mt-3 space-y-1.5">
          {t.moves.map((m) => (
            <li key={m} className="flex gap-2 text-[12.5px] leading-snug text-text-secondary">
              <span aria-hidden="true" className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-text-muted" />
              {m}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-[12.5px] text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onUse}
            className="rounded-md bg-text-primary px-3 py-1.5 text-[12.5px] font-medium text-bg"
          >
            Use this template
          </button>
        </div>
      </div>
    </Modal>
  )
}

export function DeckTemplateGallery({
  onUse
}: {
  onUse: (t: DeckTemplate) => void
}): JSX.Element {
  useTemplateFonts()
  const [open, setOpen] = useState<DeckTemplate | null>(null)

  return (
    <div className="pb-6">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {DECK_TEMPLATES.map((t) => (
          <TemplateCard key={t.id} t={t} onUse={() => onUse(t)} onOpen={() => setOpen(t)} />
        ))}
      </ul>
      {open && (
        <TemplateDetail
          t={open}
          onClose={() => setOpen(null)}
          onUse={() => {
            const t = open
            setOpen(null)
            onUse(t)
          }}
        />
      )}
    </div>
  )
}
