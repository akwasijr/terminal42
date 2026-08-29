// Setting up a new piece, the way the token library sets one up.
//
// This used to be one page with everything on it: every arrangement, five
// frames and seven backgrounds all competing at once, which is a lot to hand
// somebody whose only actual thought was "I want to make something move".
// It now asks the three questions one at a time, and shows the frame being
// built on the left so the answers are visible as they are given.

import { useState } from 'react'
import { MOTION_COMPONENTS } from '../../../../shared/motion/registry'
import type { FrameAspect, MotionDoc } from '../../../../shared/motion/types'
import { Modal, ModalAside, ModalHeader, ModalBody, ModalFooter, ModalSteps, ModalButton } from '../Modal'

export type MotionSetupChoice = {
  componentId: MotionDoc['componentId']
  aspect: FrameAspect
  background: string
}

const SIZES: ReadonlyArray<{ aspect: FrameAspect; name: string; w: number; h: number; use: string }> = [
  { aspect: '16:9', name: 'Widescreen', w: 1920, h: 1080, use: 'Video, slides, sites' },
  { aspect: '4:3', name: 'Classic', w: 1440, h: 1080, use: 'Screen recordings' },
  { aspect: '1:1', name: 'Square', w: 1080, h: 1080, use: 'Feeds' },
  { aspect: '4:5', name: 'Portrait', w: 1080, h: 1350, use: 'Feeds, taller' },
  { aspect: '9:16', name: 'Story', w: 1080, h: 1920, use: 'Stories, reels' }
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

const STEPS = [
  { id: 'shape', question: 'What shape does it play in?' },
  { id: 'ground', question: 'What does it play on?' },
  { id: 'arrangement', question: 'What is moving?' }
] as const

/** A rectangle in the size's own proportion, so the list reads at a glance. */
function SizeGlyph({ w, h }: { w: number; h: number }): React.JSX.Element {
  const box = 18
  const width = w >= h ? box : Math.round((w / h) * box)
  const height = h >= w ? box : Math.round((h / w) * box)
  return (
    <span className="grid h-[18px] w-[18px] shrink-0 place-items-center" aria-hidden="true">
      <span style={{ width, height }} className="rounded-[2px] border border-current opacity-60" />
    </span>
  )
}

function tile(selected: boolean): string {
  return [
    'w-full rounded-md px-2.5 py-2 text-left text-[12.5px] transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
    selected ? 'bg-raised text-text-primary' : 'text-text-secondary hover:bg-raised hover:text-text-primary'
  ].join(' ')
}

export function MotionSetup({
  onCancel,
  onCreate
}: {
  onCancel: () => void
  onCreate: (choice: MotionSetupChoice) => void
}): React.JSX.Element {
  const [stepIdx, setStepIdx] = useState(0)
  const [componentId, setComponentId] = useState<MotionDoc['componentId']>(MOTION_COMPONENTS[0].id)
  const [aspect, setAspect] = useState<FrameAspect>('16:9')
  const [background, setBackground] = useState('#111113')

  const step = STEPS[stepIdx]
  const size = SIZES.find((s) => s.aspect === aspect)!
  const arrangement = MOTION_COMPONENTS.find((c) => c.id === componentId)!
  const last = stepIdx === STEPS.length - 1

  // The preview frame is drawn at the chosen proportion inside a fixed box, so
  // a Story and a Widescreen occupy the same space rather than shoving the
  // rest of the pane about as the answer changes.
  const scale = Math.min(176 / size.w, 132 / size.h)

  return (
    <Modal title="New motion" onClose={onCancel} size="large" closeOnBackdrop={false}>
      <div className="flex min-h-0 flex-1">
        <ModalAside>
          <span className="text-[11px] text-text-muted">Making</span>
          <p className="mt-0.5 truncate text-[13px] text-text-primary">{arrangement.label}</p>
          <div className="mt-4 grid h-[132px] place-items-center">
            <span
              style={{
                width: Math.round(size.w * scale),
                height: Math.round(size.h * scale),
                background
              }}
              className="rounded-sm"
              aria-hidden="true"
            />
          </div>
          <dl className="mt-4 space-y-1.5 text-[11.5px]">
            <div className="flex justify-between gap-2">
              <dt className="text-text-muted">Frame</dt>
              <dd className="text-text-primary">{size.name}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-text-muted">Pixels</dt>
              <dd className="tabular-nums text-text-primary">{size.w} × {size.h}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-text-muted">Ground</dt>
              <dd className="text-text-primary">
                {BACKGROUNDS.find((b) => b.value === background)?.label ?? background}
              </dd>
            </div>
          </dl>
        </ModalAside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="px-5 pt-5">
            <ModalSteps count={STEPS.length} at={stepIdx} />
            <p className="mt-3 text-[11px] text-text-muted">Step {stepIdx + 1} of {STEPS.length}</p>
          </div>
          <ModalHeader title={step.question} />

          <ModalBody height={260}>
            {step.id === 'shape' && (
              <ul className="space-y-0.5">
                {SIZES.map((s) => (
                  <li key={s.aspect}>
                    <button
                      type="button"
                      onClick={() => setAspect(s.aspect)}
                      aria-pressed={aspect === s.aspect}
                      className={`${tile(aspect === s.aspect)} flex items-center justify-between`}
                    >
                      <span className="flex items-center gap-2.5">
                        <SizeGlyph w={s.w} h={s.h} />
                        <span>
                          {s.name}
                          <span className="ml-2 text-[11px] text-text-muted">{s.use}</span>
                        </span>
                      </span>
                      <span className="text-[11px] tabular-nums text-text-muted">{s.w} × {s.h}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {step.id === 'ground' && (
              <ul className="grid grid-cols-4 gap-2">
                {BACKGROUNDS.map((b) => (
                  <li key={b.value}>
                    <button
                      type="button"
                      onClick={() => setBackground(b.value)}
                      aria-pressed={background === b.value}
                      className={tile(background === b.value)}
                    >
                      <span style={{ background: b.value }} className="block h-12 w-full rounded-sm" />
                      <span className="mt-1.5 block truncate text-[12px]">{b.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {step.id === 'arrangement' && (
              <ul className="grid grid-cols-3 gap-1">
                {MOTION_COMPONENTS.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setComponentId(c.id)}
                      aria-pressed={componentId === c.id}
                      className={tile(componentId === c.id)}
                    >
                      {c.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ModalBody>

          <ModalFooter>
            <ModalButton tone="plain" onClick={() => (stepIdx === 0 ? onCancel() : setStepIdx(stepIdx - 1))}>
              {stepIdx === 0 ? 'Cancel' : 'Back'}
            </ModalButton>
            <ModalButton
              tone="primary"
              onClick={() => (last ? onCreate({ componentId, aspect, background }) : setStepIdx(stepIdx + 1))}
            >
              {last ? 'Start it' : 'Next'}
            </ModalButton>
          </ModalFooter>
        </div>
      </div>
    </Modal>
  )
}
