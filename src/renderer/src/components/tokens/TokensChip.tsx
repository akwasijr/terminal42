// Attaching a token library to a chat turn.
//
// Chat is where the loose work happens — a page sketched in a session, a
// component asked for in passing — and it is exactly the work that drifts off
// the library, because nothing in a chat knows the library exists. So the
// composer gets one chip: pick a library, and every turn from then on carries
// its names and values ahead of what you typed.
//
// It rides in as the turn's prefix rather than in the message body, so the
// transcript still shows the sentence you wrote rather than eighty variable
// declarations you did not.
//
// Which library is attached is a property of the conversation, not of the
// project, so it is kept per session and survives a restart.

import { useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { formatTokensForPrompt } from '../../../../shared/tokens/export'
import { useTokenLibraries, type TokenLibrary } from '../../lib/tokens/useTokenLibraries'

export type ChatTokens = { id: string; themeId: string | null }

function key(sessionId: string): string {
  return `t42.chat.tokens:${sessionId}`
}

function read(sessionId: string): ChatTokens | null {
  try {
    const raw = localStorage.getItem(key(sessionId))
    if (!raw) return null
    const v = JSON.parse(raw) as ChatTokens
    return typeof v?.id === 'string' ? v : null
  } catch {
    return null
  }
}

/**
 * What a bound library adds to a turn.
 *
 * Empty when nothing is bound and when the library has since been deleted,
 * because a prefix saying nothing is worse than no prefix: it spends context
 * and teaches the model that these blocks can be ignored.
 */
export function tokensPrefix(libraries: TokenLibrary[], chosen: ChatTokens | null): string | null {
  if (!chosen) return null
  const lib = libraries.find((l) => l.id === chosen.id)
  if (!lib) return null
  const themeId = chosen.themeId ?? lib.studio.activeTheme
  const block = formatTokensForPrompt(lib.studio, themeId)
  if (!block) return null
  return `${block}\nThis is the shared library for this work. Use these names and values; do not invent colours, sizes or typefaces that are not here. If something you need is missing, say so rather than inventing it.`
}

/**
 * The chip, and what it currently means for a turn.
 *
 * Returned together because a caller that shows the chip is always the caller
 * that has to send the prefix, and splitting them invites one to be wired up
 * without the other.
 */
export function useChatTokens(sessionId: string): {
  chosen: ChatTokens | null
  choose: (next: ChatTokens | null) => void
  libraries: TokenLibrary[]
  prefix: string | null
} {
  const { libraries } = useTokenLibraries()
  const [chosen, setChosen] = useState<ChatTokens | null>(() => read(sessionId))

  useEffect(() => { setChosen(read(sessionId)) }, [sessionId])

  const choose = useCallback((next: ChatTokens | null): void => {
    setChosen(next)
    try {
      if (next) localStorage.setItem(key(sessionId), JSON.stringify(next))
      else localStorage.removeItem(key(sessionId))
    } catch { /* private mode */ }
  }, [sessionId])

  return { chosen, choose, libraries, prefix: tokensPrefix(libraries, chosen) }
}

export function TokensChip({
  libraries,
  chosen,
  onChoose
}: {
  libraries: TokenLibrary[]
  chosen: ChatTokens | null
  onChoose: (next: ChatTokens | null) => void
}): JSX.Element | null {
  // Nothing to offer, so nothing to explain. The chip appears the moment a
  // first library exists.
  if (libraries.length === 0) return null
  const active = chosen ? libraries.find((l) => l.id === chosen.id) ?? null : null
  const theme = active
    ? active.themes.find((t) => t.id === (chosen?.themeId ?? active.studio.activeTheme)) ?? null
    : null

  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button
          type="button"
          title={active ? `Every turn follows ${active.name}` : 'Follow a token library in this chat'}
          className={`flex h-6 items-center gap-1.5 rounded-full px-2 text-[11.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
            active
              ? 'bg-accent/12 text-text-primary'
              : 'text-text-muted hover:bg-raised hover:text-text-primary'
          }`}
        >
          {active ? (
            <span className="flex items-center gap-[2px]">
              {active.swatches.slice(0, 4).map((c, i) => (
                <span
                  key={`${c}-${i}`}
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-black/10"
                  style={{ backgroundColor: c }}
                />
              ))}
            </span>
          ) : null}
          <span className="max-w-[9rem] truncate">
            {active ? (theme ? `${active.name} · ${theme.name}` : active.name) : 'Tokens'}
          </span>
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align="start"
          sideOffset={6}
          className="z-50 min-w-[13rem] rounded-lg border border-border bg-elevated p-1 shadow-lg"
        >
          <Dropdown.Item
            onSelect={() => onChoose(null)}
            className="cursor-default rounded-md px-2 py-1.5 text-[12px] text-text-secondary outline-none data-[highlighted]:bg-raised data-[highlighted]:text-text-primary"
          >
            Follow nothing
          </Dropdown.Item>
          {libraries.map((lib) => (
            <Dropdown.Sub key={lib.id}>
              <Dropdown.SubTrigger className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-text-primary outline-none data-[highlighted]:bg-raised">
                <span className="flex items-center gap-[2px]">
                  {lib.swatches.slice(0, 4).map((c, i) => (
                    <span
                      key={`${c}-${i}`}
                      className="h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-black/10"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </span>
                <span className="min-w-0 flex-1 truncate">{lib.name}</span>
              </Dropdown.SubTrigger>
              <Dropdown.Portal>
                <Dropdown.SubContent
                  sideOffset={4}
                  className="z-50 min-w-[9rem] rounded-lg border border-border bg-elevated p-1 shadow-lg"
                >
                  {lib.themes.map((t) => (
                    <Dropdown.Item
                      key={t.id}
                      onSelect={() => onChoose({ id: lib.id, themeId: t.id })}
                      className="cursor-default rounded-md px-2 py-1.5 text-[12px] text-text-primary outline-none data-[highlighted]:bg-raised"
                    >
                      {t.name}
                    </Dropdown.Item>
                  ))}
                </Dropdown.SubContent>
              </Dropdown.Portal>
            </Dropdown.Sub>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}
