/**
 * Every token library, hydrated once.
 *
 * Separate from the picker so a screen can ask what libraries exist without
 * rendering one, and so the picker file exports only components.
 */

import { useEffect, useState } from 'react'
import { hydrateStudio, type TokenStudio } from '../../../../shared/tokens/types'
import { brandItems } from '../../../../shared/tokens/bridges'

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
  }, [])
  return { libraries, loading }
}

