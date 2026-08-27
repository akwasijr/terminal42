// The full template library, opened from "More templates" on an empty chat.
//
// Pictogram-led like the tiles it expands: art plus a short label, no
// supporting sentence. The prompt itself is the tooltip, so the grid stays
// scannable and the wording is still there for anyone who wants it before
// clicking.
//
// Picking fills the composer rather than sending, matching the tiles: these
// are starting points to edit, not commands.

import { useEffect, useRef } from 'react'
import {
  STARTER_IDS,
  STARTER_POOL,
  STARTER_GROUP_LABELS,
  type StarterPromptText
} from './starterPrompts'
import { STARTER_ART } from './starterArt'

export function TemplatesModal({
  onPick,
  onClose
}: {
  onPick: (prompt: string) => void
  onClose: () => void
}): JSX.Element {
  const dialogRef = useRef<HTMLDivElement | null>(null)

  // Escape closes, and focus moves into the dialog so the keyboard lands
  // somewhere useful instead of staying on the button behind the overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    dialogRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="t42-scrim fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Templates"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-3xl flex-col gap-5 overflow-y-auto rounded-2xl bg-bg p-6 shadow-xl focus:outline-none"
      >
        <h2 className="text-[15px] font-medium text-text-primary">Templates</h2>
        {STARTER_IDS.map((kind) => (
          <section key={kind} className="flex flex-col gap-2.5">
            <h3 className="text-[12px] text-text-muted">{STARTER_GROUP_LABELS[kind]}</h3>
            <ul className="grid gap-3 sm:grid-cols-3">
              {STARTER_POOL[kind].map((t) => (
                <li key={t.title} className="contents">
                  <TemplateCard template={t} onPick={onPick} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

function TemplateCard({
  template,
  onPick
}: {
  template: StarterPromptText
  onPick: (prompt: string) => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onPick(template.prompt)}
      title={template.prompt}
      className="group flex h-full flex-col gap-2 rounded-xl bg-surface p-2.5 text-left transition-colors hover:bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className="grid w-full place-items-center overflow-hidden rounded-md bg-elevated/70 text-text-secondary transition-colors group-hover:text-accent">
        <svg viewBox="0 0 100 64" width="100%" height="56" aria-hidden="true">
          {STARTER_ART[template.id]}
        </svg>
      </span>
      <span className="px-1 pb-0.5 text-[12.5px] font-medium leading-snug text-text-primary">
        {template.title}
      </span>
    </button>
  )
}
