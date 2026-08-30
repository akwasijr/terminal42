import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { WEBSITE_TEMPLATES, type WebsiteTemplate } from '../../../shared/websites/templates'
import { Modal } from './Modal'
import { CardMenu } from './CardMenu'

/**
 * The website templates, shown under Website.
 *
 * Website used to be handed App's gallery — nineteen industry dashboards and
 * a Teams shell — which is not a set of websites by any reading. These are.
 *
 * Each preview draws its own archetype rather than a shared wireframe in a
 * different colour. That was the failing the deck gallery had first time: if
 * only the palette changes between cards, the gallery is telling you every
 * template is the same template, and it is right.
 */

function useTemplateFonts(): void {
  useEffect(() => {
    for (const href of new Set(WEBSITE_TEMPLATES.map((t) => t.fontsHref).filter(Boolean) as string[])) {
      if (document.querySelector(`link[href="${href}"]`)) continue
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      document.head.appendChild(link)
    }
  }, [])
}

/** The size every preview is drawn at, before it is scaled to fit its box. */
const BASE_W = 480
const BASE_H = 300

function tok(t: WebsiteTemplate, name: string, fallback = ''): string {
  return t.tokens[name] ?? fallback
}

function headingStyle(t: WebsiteTemplate, px: number): React.CSSProperties {
  return {
    fontFamily: tok(t, '--site-font', 'system-ui, sans-serif'),
    fontWeight: t.heading.weight,
    fontSize: `${px * t.heading.scale}px`,
    lineHeight: 1.05,
    letterSpacing: t.heading.track
  }
}

/** A photograph we do not have: a flat tint. No stroke, no cross, no plate. */
function Slot({ tint, style }: { tint: string; style?: React.CSSProperties }): JSX.Element {
  return <div style={{ background: tint, ...style }} />
}

/** A line of text we are not going to set: a bar at the weight of the type. */
function Line({ w, c, h = 3 }: { w: string; c: string; h?: number }): JSX.Element {
  return <div style={{ width: w, height: h, background: c, borderRadius: 1, opacity: 0.55 }} />
}

/**
 * The template's home page at thumbnail size.
 *
 * Every branch is one of the archetypes, so the card shows the arrangement
 * you will actually get.
 */
function PagePreview({ t }: { t: WebsiteTemplate }): JSX.Element {
  const ink = tok(t, '--site-ink', '#111')
  const ink2 = tok(t, '--site-ink-2', ink)
  const bg = tok(t, '--site-bg', '#fff')
  const line = tok(t, '--site-line', ink2)
  const accent = tok(t, '--site-accent', ink)
  const panel = tok(t, '--site-panel', '#f5f5f5')
  const mono = tok(t, '--site-mono', 'ui-monospace, monospace')

  const frame: React.CSSProperties = { background: bg, color: ink }

  if (t.archetype === 'split') {
    return (
      <div className="absolute inset-0 flex flex-col" style={frame}>
        <div className="flex items-center gap-2 px-[6%] py-[3%]" style={{ borderBottom: `1px solid ${line}` }}>
          <div style={{ width: 14, height: 4, background: ink }} />
          <div className="ml-auto flex gap-1.5">
            <Line w="12px" c={ink2} h={2.5} />
            <Line w="10px" c={ink2} h={2.5} />
            <Line w="14px" c={ink2} h={2.5} />
          </div>
          <div style={{ width: 20, height: 8, background: accent, borderRadius: 2 }} />
        </div>
        <div className="flex flex-1 items-center gap-[5%] px-[6%]">
          <div className="flex-1">
            <div style={headingStyle(t, 13)}>
              Ship the thing
              <br />
              you promised
            </div>
            <div className="mt-1.5 space-y-1">
              <Line w="90%" c={ink2} h={2.5} />
              <Line w="70%" c={ink2} h={2.5} />
            </div>
            <div className="mt-2 flex gap-1.5">
              <div style={{ width: 26, height: 9, background: accent, borderRadius: 2 }} />
              <div style={{ width: 22, height: 9, border: `1px solid ${line}`, borderRadius: 2 }} />
            </div>
          </div>
          <Slot tint={panel} style={{ width: '42%', aspectRatio: '4/3' }} />
        </div>
        <div className="flex items-center justify-between px-[6%] pb-[4%]">
          {[0, 1, 2, 3, 4].map((i) => (
            <Line key={i} w="11px" c={ink2} h={3} />
          ))}
        </div>
      </div>
    )
  }

  if (t.archetype === 'editorial') {
    return (
      <div className="absolute inset-0 flex flex-col px-[6%] py-[4%]" style={frame}>
        <div className="flex items-baseline justify-between" style={{ font: `400 5px/1 ${mono}`, color: ink2 }}>
          <span>No. 14</span>
          <span>Autumn</span>
        </div>
        <div className="mt-1 text-center" style={{ ...headingStyle(t, 13), letterSpacing: '0.02em' }}>
          The Review
        </div>
        <div style={{ height: 1, background: ink, opacity: 0.5, margin: '5px 0' }} />
        <div style={{ ...headingStyle(t, 9), textAlign: 'center' }}>
          A quiet argument for slower software
        </div>
        <div className="mt-2 flex flex-1 gap-[5%]">
          {[0, 1, 2].map((c) => (
            <div key={c} className="flex-1 space-y-[3px]">
              {Array.from({ length: 9 }).map((_, i) => (
                <Line key={i} w={i === 8 ? '55%' : '100%'} c={ink2} h={2} />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (t.archetype === 'grid') {
    return (
      <div className="absolute inset-0 flex flex-col px-[5%] py-[4%]" style={frame}>
        <div className="flex items-center">
          <span style={{ ...headingStyle(t, 7) }}>Ada Mensah</span>
          <div className="ml-auto flex gap-2">
            <Line w="10px" c={ink2} h={2.5} />
            <Line w="12px" c={ink2} h={2.5} />
          </div>
        </div>
        <div className="mt-2 grid flex-1 grid-cols-2 gap-[4%]">
          <div className="flex flex-col gap-[6px]">
            <Slot tint={panel} style={{ flex: 3 }} />
            <Slot tint={accent} style={{ flex: 2, opacity: 0.18 }} />
          </div>
          <div className="flex flex-col gap-[6px]">
            <Slot tint={accent} style={{ flex: 2, opacity: 0.1 }} />
            <Slot tint={panel} style={{ flex: 3 }} />
          </div>
        </div>
      </div>
    )
  }

  if (t.archetype === 'docs') {
    return (
      <div className="absolute inset-0 flex flex-col" style={frame}>
        <div className="flex items-center gap-2 px-[4%] py-[2.5%]" style={{ borderBottom: `1px solid ${line}` }}>
          <div style={{ width: 12, height: 4, background: ink }} />
          <div style={{ flex: 1, height: 8, background: panel, borderRadius: 2 }} />
          <Line w="10px" c={ink2} h={2.5} />
        </div>
        <div className="flex flex-1 gap-[3%] px-[4%] py-[3%]">
          <div className="w-[22%] space-y-[5px]">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-1">
                <div style={{ width: 1.5, height: 6, background: i === 2 ? accent : 'transparent' }} />
                <Line w={i === 2 ? '80%' : '65%'} c={i === 2 ? accent : ink2} h={2.5} />
              </div>
            ))}
          </div>
          <div className="flex-1 space-y-[4px]">
            <div style={headingStyle(t, 9)}>Getting started</div>
            <Line w="100%" c={ink2} h={2.5} />
            <Line w="88%" c={ink2} h={2.5} />
            <Slot tint={panel} style={{ height: 20, marginTop: 4 }} />
            <Line w="94%" c={ink2} h={2.5} />
          </div>
          <div className="w-[16%] space-y-[4px] pt-3">
            {[0, 1, 2].map((i) => (
              <Line key={i} w="100%" c={ink2} h={2} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (t.archetype === 'storefront') {
    return (
      <div className="absolute inset-0 flex flex-col" style={frame}>
        <div className="flex items-center gap-2 px-[5%] py-[2.5%]">
          <span style={{ ...headingStyle(t, 6) }}>Provision</span>
          <div className="ml-auto flex gap-1.5">
            <Line w="8px" c={ink2} h={2.5} />
            <Line w="8px" c={ink2} h={2.5} />
          </div>
        </div>
        <div className="flex gap-2 px-[5%] pb-[2%]" style={{ borderBottom: `1px solid ${line}` }}>
          {[0, 1, 2, 3].map((i) => (
            <Line key={i} w="14px" c={i === 0 ? accent : ink2} h={2.5} />
          ))}
        </div>
        <Slot tint={panel} style={{ height: '22%', margin: '3% 5% 0' }} />
        <div className="grid flex-1 grid-cols-4 gap-[3%] px-[5%] py-[3%]">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              <Slot tint={panel} style={{ flex: 1 }} />
              <Line w="80%" c={ink2} h={2} />
              <Line w="40%" c={ink} h={2} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (t.archetype === 'longform') {
    return (
      <div className="absolute inset-0 flex flex-col items-center" style={frame}>
        <div className="w-full px-[18%] pt-[7%] text-center">
          <div style={{ ...headingStyle(t, 12) }}>Invoices that chase themselves</div>
          <div className="mt-1.5 flex justify-center">
            <Line w="70%" c={ink2} h={2.5} />
          </div>
          <div className="mt-2 flex justify-center">
            <div style={{ width: 30, height: 9, background: accent, borderRadius: 3 }} />
          </div>
        </div>
        <div className="mt-[5%] w-full px-[12%] py-[3%]" style={{ background: panel }}>
          <div className="flex items-center gap-[5%]">
            <div className="flex-1 space-y-1">
              <Line w="55%" c={ink} h={3} />
              <Line w="100%" c={ink2} h={2} />
              <Line w="85%" c={ink2} h={2} />
            </div>
            <Slot tint={bg} style={{ width: '38%', aspectRatio: '3/2' }} />
          </div>
        </div>
        <div className="flex w-full flex-1 items-center justify-center gap-[3%] px-[12%]">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex-1 space-y-1 p-[6%]"
              style={{ border: `${i === 1 ? 2 : 1}px solid ${i === 1 ? ink : line}` }}
            >
              <Line w="50%" c={ink2} h={2} />
              <Line w="70%" c={ink} h={4} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (t.archetype === 'studio') {
    return (
      <div className="absolute inset-0 flex flex-col px-[6%] py-[5%]" style={frame}>
        <div className="flex items-start justify-between" style={{ font: `400 5px/1 ${mono}`, color: ink2 }}>
          <span>Field Office</span>
          <span>Index</span>
        </div>
        <div className="mt-auto" style={headingStyle(t, 15)}>
          We make
          <br />
          things that
          <br />
          <span style={{ color: accent }}>last</span>
        </div>
        <div className="mt-auto flex items-center gap-2 pt-2" style={{ borderTop: `1px solid ${line}` }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Line key={i} w="13px" c={ink2} h={2.5} />
          ))}
        </div>
      </div>
    )
  }

  // venue
  return (
    <div className="absolute inset-0 flex flex-col" style={frame}>
      <div className="relative" style={{ height: '46%' }}>
        <Slot tint={panel} style={{ position: 'absolute', inset: 0 }} />
        <div className="absolute inset-0 flex items-end p-[5%]">
          <span style={headingStyle(t, 12)}>Rosewater</span>
        </div>
      </div>
      <div className="flex gap-[6%] px-[6%] py-[4%]" style={{ borderBottom: `1px solid ${line}` }}>
        {['Hours', 'Address', 'Call'].map((h) => (
          <div key={h} className="flex-1 space-y-[3px]">
            <div style={{ font: `400 4.5px/1 ${mono}`, color: accent, letterSpacing: '0.06em' }}>
              {h.toUpperCase()}
            </div>
            <Line w="100%" c={ink2} h={2} />
            <Line w="75%" c={ink2} h={2} />
          </div>
        ))}
      </div>
      <div className="flex-1 space-y-[5px] px-[6%] py-[3%]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-baseline gap-2">
            <Line w="38%" c={ink} h={2.5} />
            <div style={{ flex: 1, height: 1, background: line }} />
            <Line w="8%" c={ink2} h={2.5} />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Draw the preview at one nominal size and scale it to whatever box it is in.
 *
 * Without this the card and the modal are two different drawings: the preview
 * is built from a mix of percentages and pixels, so at modal width the
 * percentages grow, the pixels do not, and the rules thin to hairlines while
 * the type shrinks into the corner. Scaling one drawing keeps the modal an
 * enlargement of the card rather than a distortion of it.
 */
function ScaledPreview({ t }: { t: WebsiteTemplate }): JSX.Element {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setScale(el.clientWidth / BASE_W))
    ro.observe(el)
    setScale(el.clientWidth / BASE_W)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={box} className="absolute inset-0 overflow-hidden">
      <div
        className="absolute left-0 top-0"
        style={{ width: BASE_W, height: BASE_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        <PagePreview t={t} />
      </div>
    </div>
  )
}

function TemplateCard({
  t,
  onUse,
  onDuplicate,
  onOpen,
  busy,
  failed
}: {
  t: WebsiteTemplate
  onUse: () => void
  onDuplicate: () => void
  onOpen: () => void
  busy: boolean
  failed: string | null
}): JSX.Element {
  return (
    <li className="group relative overflow-hidden rounded-xl bg-surface/40">
      <button
        type="button"
        onClick={onOpen}
        className="relative block aspect-[16/10] w-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label={`${t.name} — see how the page is built`}
      >
        <ScaledPreview t={t} />
        {busy && (
          <span className="absolute inset-0 grid place-items-center bg-bg/70 text-[12px] text-text-secondary">
            Copying…
          </span>
        )}
      </button>
      {/* Deliberately no Delete: a starting point is not yours to throw away. */}
      <CardMenu
        label={t.name}
        actions={[
          { label: 'Use as a starting point', onSelect: onUse },
          { label: 'Duplicate to my websites', onSelect: onDuplicate }
        ]}
      />
      <div className="px-4 py-3">
        <p className="truncate text-[13px] font-medium text-text-primary">{t.name}</p>
        <p className="mt-0.5 text-[12px] leading-snug text-text-secondary">{t.note}</p>
        {failed && <p className="mt-1 text-[11.5px] text-error">Could not copy: {failed}</p>}
      </div>
    </li>
  )
}

/** What the template does, as its list of moves rather than a paragraph. */
function TemplateDetail({
  t,
  onUse,
  onClose
}: {
  t: WebsiteTemplate
  onUse: () => void
  onClose: () => void
}): JSX.Element {
  return (
    <Modal title={t.name} onClose={onClose} size="medium">
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        <ScaledPreview t={t} />
      </div>
      <div className="px-5 py-4">
        <h2 className="text-[15px] font-semibold text-text-primary">{t.name}</h2>
        <p className="mt-0.5 text-[12px] text-text-muted">{t.suits}</p>
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

export function WebsiteTemplates({
  onUse,
  onDuplicate
}: {
  onUse: (t: WebsiteTemplate) => void
  onDuplicate: (t: WebsiteTemplate) => Promise<string | null>
}): JSX.Element {
  useTemplateFonts()
  const [open, setOpen] = useState<WebsiteTemplate | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [failed, setFailed] = useState<Record<string, string>>({})

  const duplicate = async (t: WebsiteTemplate): Promise<void> => {
    if (busy) return
    setBusy(t.id)
    setFailed((f) => {
      const { [t.id]: _drop, ...rest } = f
      return rest
    })
    const err = await onDuplicate(t)
    setBusy(null)
    if (err) setFailed((f) => ({ ...f, [t.id]: err }))
  }

  return (
    <div className="pb-6">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {WEBSITE_TEMPLATES.map((t) => (
          <TemplateCard
            key={t.id}
            t={t}
            busy={busy === t.id}
            failed={failed[t.id] ?? null}
            onUse={() => onUse(t)}
            onDuplicate={() => void duplicate(t)}
            onOpen={() => setOpen(t)}
          />
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
