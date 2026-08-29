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

import { useState } from 'react'
import { Modal, ModalAside, ModalHeader, ModalBody, ModalFooter, ModalSteps, ModalButton } from '../Modal'
import { FEEL_PRESETS, type Vibe } from '../../lib/designSystem'
import { buildFeelPrompt, parseFeelReply } from '../../lib/tokenBrief'
import { emptyStudio, ramp, studioFromFeel, SEMANTIC_DEFAULTS, type Feel, type SemanticRole } from '../../../../shared/tokens/scaffold'
import { feelFromVibe } from '../../lib/tokens/feelFromVibe'
import { DEFAULT_CSS, type TokenStudio } from '../../../../shared/tokens/types'

const VIBES: Vibe[] = [
  'minimal', 'professional', 'bold', 'playful', 'soft',
  'elegant', 'brutalist', 'technical', 'luxe'
]

type StepId = 'feel' | 'colour' | 'support' | 'meaning' | 'corner' | 'air' | 'scale' | 'lift' | 'naming' | 'review'

const STEPS: { id: StepId; question: string }[] = [
  { id: 'feel',   question: 'Where should it start?' },
  { id: 'colour', question: 'What is the brand colour?' },
  { id: 'support', question: 'What sits beside it?' },
  { id: 'meaning', question: 'What do good and bad look like?' },
  { id: 'corner', question: 'How round are things?' },
  { id: 'air',    question: 'How much air is there?' },
  { id: 'scale',  question: 'How far apart are the type sizes?' },
  { id: 'lift',   question: 'Does anything lift off the page?' },
  { id: 'naming', question: 'What are the variables called?' },
  { id: 'review', question: 'Ready to build' }
]

/* ── pictograms ───────────────────────────────────────────────────────────
   Drawn from the answer itself rather than illustrating it: the corner
   choices are corners, the air choices are gaps, the type choices are type
   sizes. A picture of the answer beats a sentence describing it.          */

function CornerPicto({ r }: { r: number }): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden="true">
      <rect x="6" y="6" width="28" height="28" rx={r} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function AirPicto({ gap }: { gap: number }): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <rect key={i} x="8" y={20 - gap - 3 + i * (gap + 3)} width="24" height="3" rx="1.5" fill="currentColor" />
      ))}
    </svg>
  )
}

function ScalePicto({ steps }: { steps: number[] }): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden="true">
      {steps.map((h, i) => (
        <rect key={i} x={8 + i * 10} y={30 - h} width="7" height={h} rx="1" fill="currentColor" />
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

const CORNERS: { id: Feel['corner']; label: string; r: number }[] = [
  { id: 'angular', label: 'Square',  r: 0 },
  { id: 'slight',  label: 'Slight',  r: 3 },
  { id: 'rounded', label: 'Rounded', r: 7 },
  { id: 'curved',  label: 'Curved',  r: 11 },
  { id: 'full',    label: 'Pill',    r: 14 }
]

const AIRS: { id: Feel['density']; label: string; gap: number }[] = [
  { id: 'compact',     label: 'Tight', gap: 2 },
  { id: 'cozy',        label: 'Close', gap: 4 },
  { id: 'comfortable', label: 'Even',  gap: 6 },
  { id: 'spacious',    label: 'Open',  gap: 9 }
]

const SCALES: { id: Feel['scale']; label: string; steps: number[] }[] = [
  { id: 'compact',    label: 'Close together', steps: [9, 12, 15] },
  { id: 'balanced',   label: 'Even',           steps: [6, 13, 20] },
  { id: 'expressive', label: 'Far apart',      steps: [4, 13, 25] }
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
  onCreate
}: {
  onCancel: () => void
  onCreate: (studio: TokenStudio) => void
}): React.JSX.Element {
  const [stepIdx, setStepIdx] = useState(0)
  const [vibe, setVibe] = useState<Vibe>('minimal')
  const [name, setName] = useState('')
  const [primary, setPrimary] = useState<string | null>(null)
  const [secondary, setSecondary] = useState<string | null>(null)
  const [tertiary, setTertiary] = useState<string | null>(null)
  const [semantic, setSemantic] = useState<Partial<Record<SemanticRole, string>>>({})
  const [corner, setCorner] = useState<Feel['corner'] | null>(null)
  const [density, setDensity] = useState<Feel['density'] | null>(null)
  const [scale, setScale] = useState<Feel['scale'] | null>(null)
  const [elevation, setElevation] = useState<Feel['elevation'] | null>(null)
  const [prefix, setPrefix] = useState('')
  const [casing, setCasing] = useState<'kebab' | 'camel' | 'snake'>('kebab')
  const [brief, setBrief] = useState('')
  const [thinking, setThinking] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const step = STEPS[stepIdx]

  // The feel is the starting point; every later step overrides one field of
  // it. Answering nothing still produces a coherent library, which is why the
  // steps can be walked past rather than gated behind a required answer.
  const base = feelFromVibe(vibe)
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
    elevation: elevation ?? base.elevation
  }

  const cornerPx = CORNERS.find((c) => c.id === feel.corner)!.r

  const build = (): void => {
    const studio = studioFromFeel(feel.name, feel)
    onCreate({ ...studio, css: { ...DEFAULT_CSS, prefix: prefix.trim(), casing } })
  }

  const fromBrief = async (): Promise<void> => {
    if (thinking) return
    setThinking(true)
    setNote(null)
    const res = await window.terminal42.canvas.assist(buildFeelPrompt(brief))
    setThinking(false)
    if (!res.ok) {
      setNote('That did not come back. Carry on and pick instead.')
      return
    }
    // A described product answers every question at once, so it lands on the
    // review step rather than walking the user back through choices that have
    // already been made for them.
    const got = parseFeelReply(res.text, base)
    setPrimary(got.primary)
    setSecondary(got.secondary)
    setTertiary(got.tertiary)
    setCorner(got.corner)
    setDensity(got.density)
    setScale(got.scale)
    setElevation(got.elevation)
    if (!name.trim()) setName(got.name)
    setStepIdx(STEPS.length - 1)
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
            <p className="mt-3 text-[11px] text-text-muted">Step {stepIdx + 1} of {STEPS.length}</p>
          </div>
          <ModalHeader title={step.question} />

          <ModalBody height={300}>
            {step.id === 'feel' && (
              <>
                <ul className="grid grid-cols-3 gap-2">
                  {VIBES.map((v) => {
                    const f = feelFromVibe(v)
                    const rr = ramp(f.primary)
                    return (
                      <li key={v}>
                        <button type="button" onClick={() => setVibe(v)} aria-pressed={vibe === v} className={tile(vibe === v)}>
                          <span className="flex h-6 overflow-hidden rounded-sm">
                            {[100, 400, 700].map((s) => <span key={s} style={{ background: rr[s] }} className="flex-1" />)}
                            <span style={{ background: f.secondary }} className="flex-1" />
                          </span>
                          <span className="mt-1.5 block truncate text-[12px]" style={{ fontFamily: f.headingFont }}>
                            {FEEL_PRESETS[v].label}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
                <div className="mt-4">
                  <label htmlFor="token-brief" className="text-[11px] text-text-secondary">
                    Or describe the product and skip the rest
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      id="token-brief"
                      value={brief}
                      onChange={(e) => setBrief(e.target.value)}
                      placeholder="A calm booking tool for independent clinics."
                      className="min-w-0 flex-1 rounded-md bg-sunken px-2.5 py-2 text-[12.5px] text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                    />
                    <button
                      type="button"
                      onClick={() => void fromBrief()}
                      disabled={brief.trim().length === 0 || thinking}
                      className="flex-none rounded-md px-3 py-2 text-[12.5px] text-text-secondary hover:bg-raised hover:text-text-primary disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                    >
                      {thinking ? 'Choosing' : 'Use this'}
                    </button>
                  </div>
                  {note ? <p className="mt-2 text-[11px] text-text-muted">{note}</p> : null}
                </div>
              </>
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
                <p className="max-w-prose text-[12px] text-text-secondary">
                  The accent carries the second-most important thing on a page, and the
                  third colour is what is left for charts and categories. Both start
                  from the feel, so leaving them alone is a real answer.
                </p>
                <div className="mt-4 space-y-3">
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
                <p className="max-w-prose text-[12px] text-text-secondary">
                  These four mean something rather than look like something, so
                  convention matters more than taste. The defaults are the
                  convention; change them only where the brand demands it.
                </p>
                <div className="mt-4 space-y-2.5">
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
                      <CornerPicto r={c.r} />
                      <span className="mt-1.5 block text-[12px]">{c.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {step.id === 'air' && (
              <ul className="grid grid-cols-4 gap-2">
                {AIRS.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => setDensity(a.id)} aria-pressed={feel.density === a.id} className={tile(feel.density === a.id)}>
                      <AirPicto gap={a.gap} />
                      <span className="mt-1.5 block text-[12px]">{a.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {step.id === 'scale' && (
              <ul className="grid grid-cols-3 gap-2">
                {SCALES.map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => setScale(s.id)} aria-pressed={feel.scale === s.id} className={tile(feel.scale === s.id)}>
                      <ScalePicto steps={s.steps} />
                      <span className="mt-1.5 block text-[12px]">{s.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
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
                <label htmlFor="token-name" className="text-[11px] text-text-secondary">Name this library</label>
                <input
                  id="token-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={FEEL_PRESETS[vibe].label}
                  className="mt-1.5 w-full rounded-md bg-sunken px-2.5 py-2 text-[12.5px] text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                />
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
                  {([
                    ['Brand', feel.primary],
                    ['Accent', feel.secondary],
                    ['Corners', CORNERS.find((c) => c.id === feel.corner)!.label],
                    ['Air', AIRS.find((a) => a.id === feel.density)!.label],
                    ['Type sizes', SCALES.find((s) => s.id === feel.scale)!.label],
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
              <ModalButton tone="plain" onClick={() => onCreate(emptyStudio('Untitled'))}>
                Start empty
              </ModalButton>
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
