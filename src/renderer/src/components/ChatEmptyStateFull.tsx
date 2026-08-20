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
import { starterTrio, STARTER_ROTATION_LENGTH, type StarterPromptText, type StarterId } from './starterPrompts'
import { readAndAdvanceRotation } from './starterRotation'


// Same palette the design wizard's thumbnails use, redeclared rather than
// imported: DesignWizard is a large lazy-loaded chunk, and importing it here
// would pull the whole wizard into the chat bundle for three colours.
const COL = {
  paper: '#e7e5e4',
  ink: '#374151',
  muted: 'rgba(120,120,120,0.5)'
}

type StarterPrompt = StarterPromptText & { art: ReactNode }

/** Artwork keyed by prompt id; the text itself lives in starterPrompts.ts. */
const ART: Record<StarterId, ReactNode> = {
  tool: (
      <>
        <rect x="8" y="6" width="30" height="52" rx="2" fill={COL.ink} opacity="0.85" />
        <rect x="12" y="12" width="16" height="2" rx="0.5" fill={COL.paper} opacity="0.6" />
        <rect x="15" y="18" width="13" height="2" rx="0.5" fill={COL.paper} opacity="0.4" />
        <rect x="15" y="24" width="15" height="2" rx="0.5" fill={COL.paper} opacity="0.4" />
        <rect x="12" y="30" width="18" height="2" rx="0.5" fill={COL.paper} opacity="0.6" />
        <rect x="15" y="36" width="12" height="2" rx="0.5" fill={COL.paper} opacity="0.4" />
        <rect x="42" y="6" width="50" height="52" rx="2" fill={COL.paper} />
        <rect x="48" y="14" width="24" height="3" rx="1" fill={COL.ink} />
        <rect x="48" y="24" width="38" height="2" rx="1" fill={COL.muted} />
        <rect x="48" y="30" width="38" height="2" rx="1" fill={COL.muted} />
        <rect x="48" y="36" width="30" height="2" rx="1" fill={COL.muted} />
        <rect x="48" y="46" width="20" height="4" rx="1" fill="currentColor" />
      </>
  ),
  dashboard: (
      <>
        <rect x="6" y="8" width="88" height="48" rx="3" fill={COL.paper} />
        <line x1="16" y1="48" x2="86" y2="48" stroke={COL.muted} strokeWidth="0.5" />
        <rect x="22" y="34" width="9" height="14" rx="1" fill={COL.muted} />
        <rect x="35" y="28" width="9" height="20" rx="1" fill={COL.muted} />
        <rect x="48" y="30" width="9" height="18" rx="1" fill={COL.muted} />
        <rect x="61" y="20" width="9" height="28" rx="1" fill="currentColor" />
        <line x1="16" y1="18" x2="86" y2="18" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" />
        <circle cx="80" cy="18" r="3" fill="currentColor" />
      </>
  ),
  site: (
      <>
        <rect x="8" y="6" width="84" height="52" rx="3" fill={COL.paper} />
        <line x1="8" y1="14" x2="92" y2="14" stroke={COL.muted} strokeWidth="0.5" />
        <circle cx="14" cy="10" r="1" fill={COL.muted} />
        <circle cx="18" cy="10" r="1" fill={COL.muted} />
        <circle cx="22" cy="10" r="1" fill={COL.muted} />
        <rect x="14" y="22" width="22" height="3" rx="1" fill={COL.ink} />
        <rect x="14" y="30" width="34" height="2" rx="1" fill={COL.muted} />
        <rect x="14" y="42" width="14" height="6" rx="2" fill="currentColor" />
        <rect x="56" y="22" width="32" height="26" rx="2" fill="currentColor" opacity="0.45" />
      </>
  ),
}

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

export function ChatEmptyStateFull({ onPick }: { onPick: (prompt: string) => void }): JSX.Element {
  const name = useGreetingName()
  const rotation = useStarterRotation()
  const starters: StarterPrompt[] = starterTrio(rotation).map((t) => ({ ...t, art: ART[t.id] }))

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
      </div>
    </section>
  )
}

function StarterCard({
  prompt,
  onPick
}: {
  prompt: StarterPrompt
  onPick: (prompt: string) => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onPick(prompt.prompt)}
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
