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
import { formatTokensForPrompt } from '../../../../shared/tokens/export'
import { useTokenLibraries, type TokenLibrary } from './useTokenLibraries'

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

