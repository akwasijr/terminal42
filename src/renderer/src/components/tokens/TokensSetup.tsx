// Starting a token studio the way Form starts an artboard.
//
// Two ways in, side by side, because they suit different moments. Either you
// know the look and pick it off a shelf of nine, or you can only describe the
// product, in which case a sentence is enough and the model picks the shelf
// for you. Both land in the same place: a full three tier studio, never a
// blank one.

import { useState } from 'react'
import { FEEL_PRESETS, type Vibe } from '../../lib/designSystem'
import { buildFeelPrompt, parseFeelReply } from '../../lib/tokenBrief'
import { ramp, studioFromFeel, type Feel } from '../../../../shared/tokens/scaffold'
import type { TokenStudio } from '../../../../shared/tokens/types'

const VIBES: Vibe[] = [
  'minimal',
  'professional',
  'bold',
  'playful',
  'soft',
  'elegant',
  'brutalist',
  'technical',
  'luxe'
]

/** The design system's nine feels, said in the vocabulary the scaffold reads. */
export function feelFromVibe(v: Vibe): Feel {
  const p = FEEL_PRESETS[v]
  return {
    name: p.label,
    primary: p.primary,
    secondary: p.secondary,
    tertiary: p.tertiary,
    headingFont: p.headingFont,
    bodyFont: p.bodyFont,
    corner: p.cornerStyle === 'squircle' ? 'curved' : p.cornerStyle,
    density: p.density,
    scale: p.scale,
    elevation: p.elevation
  }
}

export function TokensSetup({
  onCancel,
  onCreate
}: {
  onCancel: () => void
  onCreate: (studio: TokenStudio) => void
}): React.JSX.Element {
  const [vibe, setVibe] = useState<Vibe>('minimal')
  const [brief, setBrief] = useState('')
  const [thinking, setThinking] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const make = (feel: Feel): void => onCreate(studioFromFeel(feel.name, feel))

  const fromBrief = async (): Promise<void> => {
    if (thinking) return
    setThinking(true)
    setNote(null)
    const fallback = feelFromVibe(vibe)
    const res = await window.terminal42.canvas.assist(buildFeelPrompt(brief))
    setThinking(false)
    if (!res.ok) {
      setNote('That did not come back. The chosen feel is still here to start from.')
      return
    }
    make(parseFeelReply(res.text, fallback))
  }

  return (
    <div className="t42-scrim fixed inset-0 z-50 grid place-items-center bg-black/40 p-6" role="dialog" aria-label="New tokens">
      <div className="w-full max-w-2xl rounded-panel bg-elevated p-5">
        <h2 className="text-[15px] font-medium text-text-primary">New tokens</h2>
        <p className="mt-1 text-[12px] text-text-muted">
          A studio arrives with a palette, two themes and the parts already wired up.
        </p>

        <div className="mt-4">
          <span className="text-[11px] text-text-secondary">Start from a feel</span>
          <ul className="mt-2 grid grid-cols-3 gap-2">
            {VIBES.map((v) => {
              const feel = feelFromVibe(v)
              const r = ramp(feel.primary)
              return (
                <li key={v}>
                  <button
                    type="button"
                    onClick={() => setVibe(v)}
                    onDoubleClick={() => make(feel)}
                    aria-pressed={vibe === v}
                    className={`w-full rounded-md p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                      vibe === v ? 'bg-raised' : 'hover:bg-raised'
                    }`}
                  >
                    <span className="flex h-6 overflow-hidden rounded-sm">
                      {[100, 300, 600, 800].map((s) => (
                        <span key={s} style={{ background: r[s] }} className="flex-1" />
                      ))}
                      <span style={{ background: feel.secondary }} className="flex-1" />
                      <span style={{ background: feel.tertiary }} className="flex-1" />
                    </span>
                    <span
                      style={{ fontFamily: feel.headingFont }}
                      className="mt-1.5 block truncate text-[12px] text-text-primary"
                    >
                      {FEEL_PRESETS[v].label}
                    </span>
                    <span className="block truncate text-[10.5px] text-text-muted">
                      {FEEL_PRESETS[v].blurb}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="mt-4">
          <label htmlFor="token-brief" className="text-[11px] text-text-secondary">
            Or describe the product and let it choose
          </label>
          <textarea
            id="token-brief"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={2}
            placeholder="A calm booking tool for independent clinics."
            className="mt-1.5 w-full resize-none rounded-md bg-sunken px-2.5 py-2 text-[12.5px] text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          />
        </div>

        {note ? <p className="mt-2 text-[11px] text-text-muted">{note}</p> : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-[12.5px] text-text-muted hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void fromBrief()}
            disabled={brief.trim().length === 0 || thinking}
            className="rounded-md px-3 py-1.5 text-[12.5px] text-text-secondary hover:bg-raised hover:text-text-primary disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            {thinking ? 'Choosing' : 'Build from the brief'}
          </button>
          <button
            type="button"
            onClick={() => make(feelFromVibe(vibe))}
            className="rounded-md bg-action px-3 py-1.5 text-[12.5px] font-medium text-action-text hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Build
          </button>
        </div>
      </div>
    </div>
  )
}
