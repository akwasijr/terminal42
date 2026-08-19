// Empty state for a fresh chat session.
//
// The starter prompts are not decoration. The harness scores every goal for
// how measurably it can be improved against, and pushes back on vague ones, so
// these deliberately model the shape it rewards: a named surface, a concrete
// artefact, and a stated way to check the result. Suggestions that read like
// "improve my app" would be scored badly by our own harness the moment the
// user clicked one.
//
// Clicking fills the composer rather than sending: the value is in the user
// editing the specifics before it runs.

import { useEffect, useState } from 'react'
import { buildGreeting } from '../../../shared/greeting'
import { IconBriefing, IconCode, IconLayout } from './icons'

export const COMPOSER_FILL_EVENT = 't42:composer-fill'

export type StarterPrompt = {
  id: string
  title: string
  body: string
  prompt: string
  icon: 'brief' | 'code' | 'layout'
}

export const STARTER_PROMPTS: StarterPrompt[] = [
  {
    id: 'orient',
    title: 'Map this codebase',
    body: 'Get a written tour before changing anything',
    icon: 'brief',
    prompt:
      'Read the README and the main entry points of this project, then write me a short tour: what it does, how the pieces fit together, and the three files I should read first. Cite real file paths.'
  },
  {
    id: 'measure',
    title: 'Set a target to beat',
    body: 'Turn a vague goal into a number',
    icon: 'code',
    prompt:
      'Find the slowest part of this project that I could realistically improve. Measure it, tell me the current number and how you measured it, then propose a specific target to beat.'
  },
  {
    id: 'ship',
    title: 'Build a page from a brief',
    body: 'Real markup, wired to the design rules',
    icon: 'layout',
    prompt:
      'Build a landing page for this project using semantic HTML and CSS custom properties for every colour and spacing value. Follow my design rules, then list what you would check before shipping it.'
  }
]

export function ChatEmptyStateFull({
  onPick,
  onExploreTemplates
}: {
  onPick: (prompt: string) => void
  onExploreTemplates?: () => void
}): JSX.Element {
  const name = useGreetingName()

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-8 py-12">
      <h1 className="text-balance text-center text-[22px] font-medium tracking-[-0.01em] text-text-primary">
        {buildGreeting(name)}
      </h1>

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[12.5px] font-medium text-text-secondary">Try these first</h2>
          {onExploreTemplates && (
            <button
              type="button"
              onClick={onExploreTemplates}
              className="rounded text-[12.5px] text-text-muted hover:text-text-primary"
            >
              Explore templates
            </button>
          )}
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {STARTER_PROMPTS.map((p) => (
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
  const Icon = prompt.icon === 'brief' ? IconBriefing : prompt.icon === 'code' ? IconCode : IconLayout
  return (
    <button
      type="button"
      onClick={() => onPick(prompt.prompt)}
      title={prompt.prompt}
      className="flex h-full flex-col items-start gap-2 rounded-xl bg-surface p-3.5 text-left transition-colors hover:bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <Icon size={17} className="text-text-secondary" />
      <span className="text-[13px] font-medium leading-snug text-text-primary">{prompt.title}</span>
      <span className="text-[12px] leading-snug text-text-muted">{prompt.body}</span>
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
