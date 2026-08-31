// Empty state for a fresh chat session.
//
// Pictogram-led rather than text-led: a wireframe thumbnail says "landing
// page" faster than a sentence does, so each tile carries art and a single
// label with no supporting copy underneath.
//
// The starter prompts themselves are not decoration. The harness scores every
// goal for how measurably it can be improved against and pushes back on vague
// ones, so these deliberately model the shape it rewards: a named surface, a
// concrete artefact, and a stated way to check the result. A suggestion like
// "improve my app" would be marked down by our own harness the moment the user
// clicked it.
//
// Clicking fills the composer rather than sending: the value is in the user
// editing the specifics before it runs.

import { useEffect, useState, type ReactNode } from 'react'
import { buildGreeting } from '../../../shared/greeting'
import { starterTrio, STARTER_ROTATION_LENGTH, type StarterPromptText } from './starterPrompts'
import { STARTER_ART } from './starterArt'
import { TemplatesModal } from './TemplatesModal'
import { readAndAdvanceRotation } from './starterRotation'

type StarterPrompt = StarterPromptText & { art: ReactNode }

/**
 * The rotation counter, advanced once per mounted empty state so a user who
 * opens several chats sees different suggestions. Read once on mount:
 * advancing on every render would swap the tiles under the cursor.
 */
function useStarterRotation(): number {
  const [rotation] = useState<number>(() =>
    readAndAdvanceRotation(localStorage, STARTER_ROTATION_LENGTH)
  )
  return rotation
}

export function ChatEmptyStateFull({
  onPick
}: {
  onPick: (prompt: string, slot?: string) => void
}): JSX.Element {
  const name = useGreetingName()
  const rotation = useStarterRotation()
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const starters: StarterPrompt[] = starterTrio(rotation).map((t) => ({ ...t, art: STARTER_ART[t.id] }))

  return (
    <section className="flex h-full w-full flex-col items-center justify-center px-6 py-10">
      <div className="flex w-full max-w-2xl flex-col gap-7">
        <h1 className="text-balance text-center text-[22px] font-medium tracking-[-0.01em] text-text-primary">
          {buildGreeting(name)}
        </h1>
        <ul className="grid gap-3 sm:grid-cols-3">
          {starters.map((p) => (
            <li key={p.id} className="contents">
              <StarterCard prompt={p} onPick={onPick} />
            </li>
          ))}
        </ul>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setTemplatesOpen(true)}
            className="rounded-full bg-surface px-3.5 py-1.5 text-[12.5px] text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            More templates
          </button>
        </div>
      </div>
      {templatesOpen && (
        <TemplatesModal
          onClose={() => setTemplatesOpen(false)}
          onPick={(prompt, slot) => { setTemplatesOpen(false); onPick(prompt, slot) }}
        />
      )}
    </section>
  )
}

function StarterCard({
  prompt,
  onPick
}: {
  prompt: StarterPrompt
  onPick: (prompt: string, slot?: string) => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onPick(prompt.prompt, prompt.slot)}
      title={prompt.prompt}
      className="group flex h-full flex-col gap-2 rounded-xl bg-surface p-2.5 text-left transition-colors hover:bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className="grid w-full place-items-center overflow-hidden rounded-md bg-elevated/70 text-text-secondary transition-colors group-hover:text-accent">
        <svg viewBox="0 0 100 64" width="100%" height="64" aria-hidden="true">
          {prompt.art}
        </svg>
      </span>
      <span className="px-1 pb-0.5 text-[13px] font-medium leading-snug text-text-primary">
        {prompt.title}
      </span>
    </button>
  )
}

/**
 * The greeting name, or null while loading and whenever the platform can't
 * give us a real one. Resolved in main and cached there, so this costs a
 * single IPC per mount.
 */
function useGreetingName(): string | null {
  const [name, setName] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    const api = (window as unknown as { terminal42?: { identity?: { greetingName?: () => Promise<string | null> } } }).terminal42
    const fn = api?.identity?.greetingName
    if (typeof fn !== 'function') return
    void fn()
      .then((n) => { if (!cancelled) setName(n) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  return name
}
