// Starting a token library by being asked about it.
//
// The previous version was one page: a heading, nine palette cards and a text
// box. It asked nothing. Whatever you clicked, the library that came out was
// whatever that card happened to hold, and the six decisions that actually
// separate one library from another — the brand colour, how round things are,
// how much air there is, how far apart the type sizes run, whether anything
// lifts off the page, what the variables end up called — were never put to
// you at all.
//
// So it is a sequence now. One question at a time, each one answered by
// looking rather than by reading, and every answer lands on a real field of
// the library being built. Nothing here is asked for the sake of having a
// step: if a question had nowhere to go, it is not in the list.
//
// The reverse holds too, and cost us: for a while the wizard opened on nine
// palette cards -- a whole style, chosen before anything else, that silently
// decided the typefaces. Anyone who had a style in mind was being asked to
// find the nearest card to it, and everyone ended up with fonts they were
// never shown. The cards are gone. What the library holds is now exactly
// what was asked for, typefaces included.

import { useEffect, useState } from 'react'
import { Modal, ModalAside, ModalHeader, ModalBody, ModalFooter, ModalSteps, ModalButton } from '../Modal'
import { FEEL_PRESETS, type Vibe } from '../../lib/designSystem'
import { emptyStudio, ramp, studioFromFeel, SEMANTIC_DEFAULTS, type Feel, type SemanticRole } from '../../../../shared/tokens/scaffold'
import { feelFromVibe } from '../../lib/tokens/feelFromVibe'
import { DEFAULT_CSS, type TokenStudio } from '../../../../shared/tokens/types'

type StepId = 'name' | 'colour' | 'support' | 'meaning' | 'corner' | 'space' | 'type' | 'lift' | 'naming' | 'review'

// Space and type used to read as the same question twice -- "How much air is
// there?" then "How far apart are the type sizes?", both answered by picking
// one of a row of grey bars. They are not the same question: one sets the gap
// between things on a page, the other sets the jump from one text size to the
// next. They now say so, and the pictograms show a layout and some lettering
// rather than two sets of bars.
const STEPS: { id: StepId; question: string }[] = [
  { id: 'name',    question: 'What is this set called?' },
  { id: 'colour',  question: 'What is the brand colour?' },
  { id: 'support', question: 'What sits beside it?' },
  { id: 'meaning', question: 'What do good and bad look like?' },
  { id: 'corner',  question: 'How round are things?' },
  { id: 'space',   question: 'How much space between things?' },
  { id: 'type',    question: 'What does text look like?' },
  { id: 'lift',    question: 'Does anything lift off the page?' },
  { id: 'naming',  question: 'What are the variables called?' },
  { id: 'review',  question: 'Ready to build' }
]

/* ── pictograms ───────────────────────────────────────────────────────────
   Drawn from the answer itself rather than illustrating it: the corner
   choices are corners, the air choices are gaps, the type choices are type
   sizes. A picture of the answer beats a sentence describing it.          */

function CornerPicto({ r, pill = false }: { r: number; pill?: boolean }): React.JSX.Element {
  // A pill drawn on a square comes out a circle, which is a different shape
  // and a different answer. So the pill is drawn on an oblong, where fully
  // round ends read as ends rather than as a ring.
  const w = pill ? 30 : 28
  const h = pill ? 17 : 28
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden="true">
      <rect
        x={(40 - w) / 2} y={(40 - h) / 2} width={w} height={h}
        rx={pill ? h / 2 : r}
        fill="none" stroke="currentColor" strokeWidth="2"
      />
    </svg>
  )
}

/**
 * Space, drawn as a card with things inside it.
 *
 * The gap is the answer, so the gap is what moves: the frame stays the same
 * size and the blocks inside it crowd together or spread out. Bars floating
 * on their own could as easily have been about type, which is exactly the
 * confusion this step used to cause.
 */
function SpacePicto({ gap }: { gap: number }): React.JSX.Element {
  const top = 20 - (gap + 3)
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden="true">
      <rect x="4" y="4" width="32" height="32" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x="10" y={top + i * (gap + 3)} width="20" height="3" rx="1.5" fill="currentColor" />
      ))}
    </svg>
  )
}

/** Type, drawn as type. Three letters at the three sizes being chosen. */
function TypePicto({ steps }: { steps: number[] }): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden="true">
      {steps.map((size, i) => (
        <text
          key={i}
          x={7 + i * 11} y="27"
          fontSize={size} fontWeight="600"
          fill="currentColor" textAnchor="middle" dominantBaseline="alphabetic"
        >
          A
        </text>
      ))}
    </svg>
  )
}

function LiftPicto({ level }: { level: 0 | 1 | 2 }): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden="true">
      {level > 0 && (
        <rect
          x={10 + level} y={14 + level * 2} width="22" height="16" rx="3"
          fill="currentColor" opacity={level === 1 ? 0.16 : 0.3}
        />
      )}
      <rect x="8" y="12" width="22" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

const CORNERS: { id: Feel['corner']; label: string; r: number; pill?: boolean }[] = [
  { id: 'angular', label: 'Square',  r: 0 },
  { id: 'slight',  label: 'Slight',  r: 3 },
  { id: 'rounded', label: 'Rounded', r: 7 },
  { id: 'curved',  label: 'Curved',  r: 11 },
  { id: 'full',    label: 'Pill',    r: 14, pill: true }
]

const SPACES: { id: Feel['density']; label: string; gap: number }[] = [
  { id: 'compact',     label: 'Tight',   gap: 2 },
  { id: 'cozy',        label: 'Snug',    gap: 4 },
  { id: 'comfortable', label: 'Roomy',   gap: 6 },
  { id: 'spacious',    label: 'Airy',    gap: 9 }
]

// No label here repeats one from the space step: two rows of options sharing
// the word "Even" is most of why the two read as the same question.
const SCALES: { id: Feel['scale']; label: string; steps: number[] }[] = [
  { id: 'compact',    label: 'Gentle jump', steps: [11, 13, 15] },
  { id: 'balanced',   label: 'Clear jump',  steps: [9, 14, 20] },
  { id: 'expressive', label: 'Big jump',    steps: [7, 14, 26] }
]

/**
 * Showing a font's name in some other font is a worse answer than showing no
 * sample at all, and none of these ship with the app. The families are
 * fetched once, on demand, when the wizard opens -- not at boot, since most
 * sessions never open it.
 */
function useTypefaces(): void {
  useEffect(() => {
    const id = 't42-token-typefaces'
    if (document.getElementById(id)) return
    const families = TYPEFACES
      .flatMap((t) => [t.heading, t.body])
      .filter((f) => f !== 'inherit' && !f.startsWith('ui-'))
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href =
      'https://fonts.googleapis.com/css2?' +
      [...new Set(families)].map((f) => `family=${encodeURIComponent(f)}:wght@400;600`).join('&') +
      '&display=swap'
    document.head.appendChild(link)
  }, [])
}

/**
 * The typefaces on offer.
 *
 * These used to arrive with the style card, so the library came out holding
 * a heading font and a body font nobody had been shown. Asking is two clicks
 * and removes the surprise.
 */
const TYPEFACES: { id: string; label: string; heading: string; body: string }[] = [
  { id: 'geist',     label: 'Geist',        heading: 'Geist', body: 'Geist' },
  { id: 'jakarta',   label: 'Jakarta Sans', heading: 'Plus Jakarta Sans', body: 'Plus Jakarta Sans' },
  { id: 'dm',        label: 'DM Sans',      heading: 'DM Sans', body: 'DM Sans' },
  { id: 'plex',      label: 'IBM Plex',     heading: 'IBM Plex Sans', body: 'IBM Plex Sans' },
  { id: 'grotesk',   label: 'Space Grotesk', heading: 'Space Grotesk', body: 'Plus Jakarta Sans' },
  { id: 'fraunces',  label: 'Fraunces',     heading: 'Fraunces', body: 'Source Serif Pro' },
  { id: 'playfair',  label: 'Playfair',     heading: 'Playfair Display', body: 'Plus Jakarta Sans' },
  { id: 'mono',      label: 'Geist Mono',   heading: 'Geist', body: 'Geist Mono' },
  { id: 'system',    label: 'System font',  heading: 'inherit', body: 'inherit' }
]

const LIFTS: { id: Feel['elevation']; label: string; level: 0 | 1 | 2 }[] = [
  { id: 'flat',     label: 'Nothing lifts', level: 0 },
  { id: 'subtle',   label: 'Barely',        level: 1 },
  { id: 'elevated', label: 'Clearly',       level: 2 }
]

const CASINGS: { id: 'kebab' | 'camel' | 'snake'; sample: string }[] = [
  { id: 'kebab', sample: 'color-text-primary' },
  { id: 'camel', sample: 'colorTextPrimary' },
  { id: 'snake', sample: 'color_text_primary' }
]

function varName(casing: 'kebab' | 'camel' | 'snake', prefix: string): string {
  const p = prefix.trim()
  const body = CASINGS.find((c) => c.id === casing)!.sample
  return `--${p ? `${p}-` : ''}${body}`
}

const SEMANTIC_LABELS: Record<SemanticRole, string> = {
  success: 'Good',
  warning: 'Careful',
  danger: 'Wrong',
  info: 'Worth knowing'
}

const SEMANTIC_HINTS: Record<SemanticRole, string> = {
  success: 'Saved, connected, passing',
  warning: 'Nearly out, about to expire',
  danger: 'Failed, destructive, blocked',
  info: 'Tips, notes, neutral notices'
}

/** One colour, named and explained, so the row says what it is for. */
function Swatch({
  label,
  hint,
  value,
  onChange,
  onReset
}: {
  label: string
  hint: string
  value: string
  onChange: (hex: string) => void
  onReset: () => void
}): React.JSX.Element {
  return (
    <div className="flex max-w-xl items-center gap-3">
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-11 flex-none cursor-pointer rounded-md bg-transparent"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] text-text-primary">{label}</span>
        <span className="block truncate text-[11px] text-text-muted">{hint}</span>
      </span>
      <input
        aria-label={`${label} hex`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-28 flex-none rounded-md bg-sunken px-2.5 py-1.5 font-mono text-[12px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      />
      <button
        type="button"
        onClick={onReset}
        className="flex-none rounded-md px-2 py-1.5 text-[11.5px] text-text-muted hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        Reset
      </button>
    </div>
  )
}

function tile(selected: boolean): string {
  return [
    'w-full rounded-md p-3 text-left transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
    selected ? 'bg-raised text-text-primary' : 'text-text-secondary hover:bg-raised hover:text-text-primary'
  ].join(' ')
}

export function TokensSetup({
  onCancel,
  onCreate,
  startFrom
}: {
  onCancel: () => void
  onCreate: (studio: TokenStudio) => void
  /**
   * The feel to open on. Arriving from a template means the first question is
   * already answered, so the wizard starts there instead of on Minimal and
   * makes you find your way back to what you clicked.
   */
  startFrom?: Vibe
}): React.JSX.Element {
  const [stepIdx, setStepIdx] = useState(0)
  const vibe: Vibe = startFrom ?? 'minimal'
  const [name, setName] = useState('')
  const [primary, setPrimary] = useState<string | null>(null)
  const [secondary, setSecondary] = useState<string | null>(null)
  const [tertiary, setTertiary] = useState<string | null>(null)
  const [semantic, setSemantic] = useState<Partial<Record<SemanticRole, string>>>({})
  const [corner, setCorner] = useState<Feel['corner'] | null>(null)
  const [density, setDensity] = useState<Feel['density'] | null>(null)
  const [scale, setScale] = useState<Feel['scale'] | null>(null)
  const [elevation, setElevation] = useState<Feel['elevation'] | null>(null)
  const [typeface, setTypeface] = useState<string>('geist')
  const [prefix, setPrefix] = useState('')
  const [casing, setCasing] = useState<'kebab' | 'camel' | 'snake'>('kebab')

  const step = STEPS[stepIdx]

  // The feel is the starting point; every later step overrides one field of
  // it. Answering nothing still produces a coherent library, which is why the
  // steps can be walked past rather than gated behind a required answer.
  const base = feelFromVibe(vibe)
  const face = TYPEFACES.find((t) => t.id === typeface)
  useTypefaces()
  const feel: Feel = {
    ...base,
    name: name.trim() || FEEL_PRESETS[vibe].label,
    primary: primary ?? base.primary,
    secondary: secondary ?? base.secondary,
    tertiary: tertiary ?? base.tertiary,
    semantic,
    corner: corner ?? base.corner,
    density: density ?? base.density,
    scale: scale ?? base.scale,
    elevation: elevation ?? base.elevation,
    ...(face ? { headingFont: face.heading, bodyFont: face.body } : {})
  }

  const cornerPx = CORNERS.find((c) => c.id === feel.corner)!.r

  const build = (): void => {
    const studio = studioFromFeel(feel.name, feel)
    onCreate({ ...studio, css: { ...DEFAULT_CSS, prefix: prefix.trim(), casing } })
  }

  const r = ramp(feel.primary)

  return (
    // Losing eight answers to a misplaced click is worse than reaching for
    // Escape, so the backdrop does not close this one.
    <Modal title="New token library" onClose={onCancel} size="large" closeOnBackdrop={false}>
      <div className="flex min-h-0 flex-1">
        <ModalAside>
          <span className="text-[11px] text-text-muted">Building</span>
          <p className="mt-0.5 truncate text-[13px] text-text-primary" style={{ fontFamily: feel.headingFont }}>
            {feel.name}
          </p>
          <span className="mt-4 flex h-7 overflow-hidden rounded-sm">
            {[100, 300, 600, 800].map((s) => <span key={s} style={{ background: r[s] }} className="flex-1" />)}
            <span style={{ background: feel.secondary }} className="flex-1" />
            <span style={{ background: feel.tertiary }} className="flex-1" />
          </span>
          <div
            className="mt-4 p-3"
            style={{
              background: r[100],
              borderRadius: cornerPx,
              boxShadow: feel.elevation === 'flat' ? 'none'
                : feel.elevation === 'subtle' ? '0 1px 3px rgba(0,0,0,.10)'
                  : '0 4px 8px rgba(0,0,0,.12)'
            }}
          >
            <span className="block text-[13px]" style={{ color: r[900], fontFamily: feel.headingFont }}>Heading</span>
            <span className="mt-1 block text-[11px]" style={{ color: r[700], fontFamily: feel.bodyFont }}>Body copy</span>
            <span
              className="mt-2 inline-block px-2 py-1 text-[11px]"
              style={{ background: r[600], color: '#fff', borderRadius: cornerPx }}
            >
              Button
            </span>
          </div>
        </ModalAside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="px-5 pt-5">
            <ModalSteps count={STEPS.length} at={stepIdx} />
          </div>
          <ModalHeader title={step.question} />

          <ModalBody height={300}>
            {step.id === 'name' && (
              <div>
                <input
                  id="token-name"
                  aria-label="Name this set"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) setStepIdx(1) }}
                  placeholder="Product tokens"
                  autoFocus
                  className="w-full rounded-md bg-sunken px-3 py-2.5 text-[14px] text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                />
              </div>
            )}

            {step.id === 'colour' && (
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="color"
                    aria-label="Brand colour"
                    value={primary ?? base.primary}
                    onChange={(e) => setPrimary(e.target.value)}
                    className="h-12 w-16 flex-none cursor-pointer rounded-md bg-transparent"
                  />
                  <input
                    aria-label="Brand colour hex"
                    value={primary ?? base.primary}
                    onChange={(e) => setPrimary(e.target.value)}
                    className="w-36 rounded-md bg-sunken px-2.5 py-2 font-mono text-[12.5px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                  />
                  <button
                    type="button"
                    onClick={() => setPrimary(null)}
                    className="rounded-md px-3 py-2 text-[12.5px] text-text-muted hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                  >
                    No brand colour yet
                  </button>
                </div>
                {/* The ramp is what the library will hold, so show that rather
                    than the single colour that was typed into the box. */}
                <span className="mt-4 flex h-9 overflow-hidden rounded-sm">
                  {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((s) => (
                    <span key={s} style={{ background: r[s] }} className="flex-1" />
                  ))}
                </span>
              </div>
            )}

            {step.id === 'support' && (
              <div>
                <div className="space-y-3">
                  <Swatch
                    label="Accent"
                    hint="Highlights, selected states, links"
                    value={feel.secondary}
                    onChange={setSecondary}
                    onReset={() => setSecondary(null)}
                  />
                  <Swatch
                    label="Third colour"
                    hint="Charts, categories, illustration"
                    value={feel.tertiary}
                    onChange={setTertiary}
                    onReset={() => setTertiary(null)}
                  />
                </div>
              </div>
            )}

            {step.id === 'meaning' && (
              <div>
                <div className="space-y-2.5">
                  {(Object.keys(SEMANTIC_DEFAULTS) as SemanticRole[]).map((role) => (
                    <Swatch
                      key={role}
                      label={SEMANTIC_LABELS[role]}
                      hint={SEMANTIC_HINTS[role]}
                      value={semantic[role] ?? SEMANTIC_DEFAULTS[role]}
                      onChange={(v) => setSemantic({ ...semantic, [role]: v })}
                      onReset={() => {
                        const next = { ...semantic }
                        delete next[role]
                        setSemantic(next)
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {step.id === 'corner' && (
              <ul className="grid grid-cols-5 gap-2">
                {CORNERS.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => setCorner(c.id)} aria-pressed={feel.corner === c.id} className={tile(feel.corner === c.id)}>
                      <CornerPicto r={c.r} pill={c.pill} />
                      <span className="mt-1.5 block text-[12px]">{c.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {step.id === 'space' && (
              <ul className="grid grid-cols-4 gap-2">
                {SPACES.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => setDensity(a.id)} aria-pressed={feel.density === a.id} className={tile(feel.density === a.id)}>
                      <SpacePicto gap={a.gap} />
                      <span className="mt-1.5 block text-[12px]">{a.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {step.id === 'type' && (
              <div>
                <ul className="grid grid-cols-3 gap-2">
                  {TYPEFACES.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setTypeface(t.id)}
                        aria-pressed={typeface === t.id}
                        className={`${tile(typeface === t.id)} flex items-baseline gap-2 !py-2`}
                      >
                        <span className="text-[16px] leading-none" style={{ fontFamily: t.heading }}>Ag</span>
                        <span className="truncate text-[11.5px] text-text-muted">{t.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <span className="mt-4 block text-[11px] text-text-secondary">Size steps</span>
                <ul className="mt-1.5 grid grid-cols-3 gap-2">
                  {SCALES.map((sc) => (
                    <li key={sc.id}>
                      <button type="button" onClick={() => setScale(sc.id)} aria-pressed={feel.scale === sc.id} className={tile(feel.scale === sc.id)}>
                        <TypePicto steps={sc.steps} />
                        <span className="mt-1.5 block text-[12px]">{sc.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {step.id === 'lift' && (
              <ul className="grid grid-cols-3 gap-2">
                {LIFTS.map((l) => (
                  <li key={l.id}>
                    <button type="button" onClick={() => setElevation(l.id)} aria-pressed={feel.elevation === l.id} className={tile(feel.elevation === l.id)}>
                      <LiftPicto level={l.level} />
                      <span className="mt-1.5 block text-[12px]">{l.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {step.id === 'naming' && (
              <div>
                <ul className="grid grid-cols-3 gap-2">
                  {CASINGS.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => setCasing(c.id)} aria-pressed={casing === c.id} className={tile(casing === c.id)}>
                        <span className="block truncate font-mono text-[11.5px]">{varName(c.id, prefix)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center gap-2">
                  <label htmlFor="token-prefix" className="text-[11px] text-text-secondary">Prefix</label>
                  <input
                    id="token-prefix"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    placeholder="none"
                    className="w-32 rounded-md bg-sunken px-2.5 py-1.5 font-mono text-[12px] text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                  />
                </div>
              </div>
            )}

            {step.id === 'review' && (
              <div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
                  {([
                    ['Name', feel.name],
                    ['Brand', feel.primary],
                    ['Accent', feel.secondary],
                    ['Corners', CORNERS.find((c) => c.id === feel.corner)!.label],
                    ['Space', SPACES.find((a) => a.id === feel.density)!.label],
                    ['Typeface', face?.label ?? 'System font'],
                    ['Size steps', SCALES.find((s) => s.id === feel.scale)!.label],
                    ['Lift', LIFTS.find((l) => l.id === feel.elevation)!.label],
                    ['Names', varName(casing, prefix)]
                  ] as [string, string][]).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <dt className="text-text-muted">{k}</dt>
                      <dd className="truncate text-text-primary">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </ModalBody>

          <ModalFooter
            left={
              stepIdx === 0 ? (
                <ModalButton tone="plain" onClick={() => onCreate(emptyStudio('Untitled'))}>
                  Start empty
                </ModalButton>
              ) : undefined
            }
          >
            <ModalButton tone="plain" onClick={() => (stepIdx === 0 ? onCancel() : setStepIdx(stepIdx - 1))}>
              {stepIdx === 0 ? 'Cancel' : 'Back'}
            </ModalButton>
            <ModalButton tone="primary" onClick={() => (step.id === 'review' ? build() : setStepIdx(stepIdx + 1))}>
              {step.id === 'review' ? 'Build' : 'Next'}
            </ModalButton>
          </ModalFooter>
        </div>
      </div>
    </Modal>
  )
}
