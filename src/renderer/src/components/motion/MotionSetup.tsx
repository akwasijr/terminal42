// Setting up a new piece, the way Form sets up a new artboard.
//
// Starting a motion used to be one click on an arrangement, which meant the
// frame was always 16:9 on near-black and you found out later. Form asks for
// the size first and nobody minds, because choosing a shape is part of
// deciding what you are making. This asks the same three questions, in the
// same visual grammar: a proportioned glyph, a name, the pixels.

import { useState } from 'react'
import { MOTION_COMPONENTS } from '../../../../shared/motion/registry'
import type { FrameAspect, MotionDoc } from '../../../../shared/motion/types'

export type MotionSetupChoice = {
  componentId: MotionDoc['componentId']
  aspect: FrameAspect
  background: string
}

const SIZES: ReadonlyArray<{ aspect: FrameAspect; name: string; w: number; h: number }> = [
  { aspect: '16:9', name: 'Widescreen', w: 1920, h: 1080 },
  { aspect: '4:3', name: 'Classic', w: 1440, h: 1080 },
  { aspect: '1:1', name: 'Square', w: 1080, h: 1080 },
  { aspect: '4:5', name: 'Portrait', w: 1080, h: 1350 },
  { aspect: '9:16', name: 'Story', w: 1080, h: 1920 }
]

const BACKGROUNDS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '#000000', label: 'Black' },
  { value: '#111113', label: 'Near black' },
  { value: '#1d2430', label: 'Ink blue' },
  { value: '#3a3a3f', label: 'Slate' },
  { value: '#cfcac2', label: 'Stone' },
  { value: '#f2f0ec', label: 'Paper' },
  { value: '#ffffff', label: 'White' }
]

/** A rectangle in the size's own proportion, so the list reads at a glance. */
function SizeGlyph({ w, h }: { w: number; h: number }): React.JSX.Element {
  const box = 18
  const width = w >= h ? box : Math.round((w / h) * box)
  const height = h >= w ? box : Math.round((h / w) * box)
  return (
    <span className="grid h-[18px] w-[18px] shrink-0 place-items-center" aria-hidden="true">
      <span
        style={{ width, height }}
        className="rounded-[2px] border border-current opacity-60"
      />
    </span>
  )
}

export function MotionSetup({
  onCancel,
  onCreate
}: {
  onCancel: () => void
  onCreate: (choice: MotionSetupChoice) => void
}): React.JSX.Element {
  const [componentId, setComponentId] = useState<MotionDoc['componentId']>(MOTION_COMPONENTS[0].id)
  const [aspect, setAspect] = useState<FrameAspect>('16:9')
  const [background, setBackground] = useState('#111113')

  return (
    <div
      className="t42-scrim fixed inset-0 z-50 grid place-items-center bg-black/40 p-6"
      role="dialog"
      aria-modal="true"
      aria-label="New motion"
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}
    >
      <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-panel bg-surface">
        <header className="shrink-0 px-5 pb-3 pt-5">
          <h2 className="text-[15px] font-semibold text-text-primary">New motion</h2>
          <p className="mt-1 text-[12px] text-text-muted">Pick an arrangement and the shape it plays in.</p>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[1fr_260px] gap-5 overflow-y-auto px-5 pb-4">
          <section>
            <h3 className="pb-1.5 text-[11px] font-medium text-text-muted">Arrangement</h3>
            <div className="grid grid-cols-3 gap-1">
              {MOTION_COMPONENTS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setComponentId(c.id)}
                  aria-pressed={componentId === c.id}
                  className={`rounded-lg px-2.5 py-2 text-left text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    componentId === c.id
                      ? 'bg-raised text-text-primary'
                      : 'text-text-secondary hover:bg-raised hover:text-text-primary'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <div>
              <h3 className="pb-1.5 text-[11px] font-medium text-text-muted">Frame</h3>
              <div className="space-y-0.5">
                {SIZES.map((s) => (
                  <button
                    key={s.aspect}
                    type="button"
                    onClick={() => setAspect(s.aspect)}
                    aria-pressed={aspect === s.aspect}
                    className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                      aspect === s.aspect
                        ? 'bg-raised text-text-primary'
                        : 'text-text-secondary hover:bg-raised hover:text-text-primary'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <SizeGlyph w={s.w} h={s.h} />
                      {s.name}
                    </span>
                    <span className="text-[11px] tabular-nums text-text-muted">{s.w} × {s.h}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="pb-1.5 text-[11px] font-medium text-text-muted">Background</h3>
              <div className="flex flex-wrap gap-1.5">
                {BACKGROUNDS.map((b) => (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() => setBackground(b.value)}
                    aria-label={b.label}
                    aria-pressed={background === b.value}
                    style={{ background: b.value }}
                    className={`h-6 w-6 rounded-full transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                      background === b.value ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : 'ring-1 ring-border'
                    }`}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 px-5 pb-5 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-[12.5px] text-text-secondary hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onCreate({ componentId, aspect, background })}
            className="rounded-md bg-action px-3 py-1.5 text-[12.5px] font-medium text-action-text hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Start it
          </button>
        </footer>
      </div>
    </div>
  )
}
