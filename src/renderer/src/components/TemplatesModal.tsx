// The full template library, opened from "More templates" on an empty chat.
//
// Pictogram-led like the tiles it expands: art plus a short label, no
// supporting sentence. The prompt itself is the tooltip, so the grid stays
// scannable and the wording is still there for anyone who wants it before
// clicking.
//
// Picking fills the composer rather than sending, matching the tiles: these
// are starting points to edit, not commands.

import {
  STARTER_IDS,
  STARTER_POOL,
  STARTER_GROUP_LABELS,
  type StarterPromptText
} from './starterPrompts'
import { STARTER_ART } from './starterArt'
import { Modal, ModalHeader, ModalBody } from './Modal'

export function TemplatesModal({
  onPick,
  onClose
}: {
  onPick: (prompt: string, slot?: string) => void
  onClose: () => void
}): JSX.Element {
  return (
    <Modal title="Templates" onClose={onClose} size="large">
      <ModalHeader title="Templates" />
      <ModalBody>
        <div className="flex flex-col gap-5">
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
      </ModalBody>
    </Modal>
  )
}

function TemplateCard({
  template,
  onPick
}: {
  template: StarterPromptText
  onPick: (prompt: string, slot?: string) => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onPick(template.prompt, template.slot)}
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
