/**
 * Every token library, hydrated once.
 *
 * Separate from the picker so a screen can ask what libraries exist without
 * rendering one, and so the picker file exports only components.
 */

import { useEffect, useState } from 'react'
import { hydrateStudio, type TokenStudio } from '../../../../shared/tokens/types'
import { brandItems } from '../../../../shared/tokens/bridges'

// Screens that list libraries and screens that create them are far apart: the
// chat composer mounts once for a whole session, while a library is made over
// in Tokens minutes later. Without a nudge the composer would go on showing
// the list it read on the day it mounted, and a library the user had just
// finished building would be missing from the picker with no way to tell why.
const listeners = new Set<() => void>()

/** Listen for library changes. Returns the function that stops listening. */
export function onTokenLibrariesChanged(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Tell every mounted list that the set of libraries has changed. */
export function tokenLibrariesChanged(): void {
  // Copied before iterating: a listener is free to unsubscribe as it runs,
  // which is what a screen unmounting in response to this would do.
  for (const fn of [...listeners]) fn()
}

export type TokenLibrary = {
  id: string
  name: string
  studio: TokenStudio
  themes: Array<{ id: string; name: string }>
  /** The colours this library would bring, in the order the library shows them. */
  swatches: string[]
}

/**
 * Every library, hydrated once.
 *
 * Hydration is not free and every caller wants the same answer, so it happens
 * here rather than in each screen's own effect.
 */
export function useTokenLibraries(): { libraries: TokenLibrary[]; loading: boolean } {
  const [libraries, setLibraries] = useState<TokenLibrary[]>([])
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    return onTokenLibrariesChanged(() => setNonce((n) => n + 1))
  }, [])
  useEffect(() => {
    let alive = true
    void window.terminal42.tokens
      .list()
      .then((rows) => {
        if (!alive) return
        setLibraries(
          rows.map((r) => {
            const studio = hydrateStudio(r.studio)
            return {
              id: r.id,
              name: r.name,
              studio,
              themes: studio.themes.map((t) => ({ id: t.id, name: t.name })),
              swatches: brandItems(studio, studio.activeTheme).colours.slice(0, 6)
            }
          })
        )
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [nonce])
  return { libraries, loading }
}

