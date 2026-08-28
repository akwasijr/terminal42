/**
 * The library's colours, wherever a colour is being chosen.
 *
 * A token library that can only be seen on the library screen is not a source
 * of truth, it is a document about one. The value of naming a colour once is
 * only collected at the moment somebody sets a colour somewhere else — so the
 * names have to be present there, in the picker, next to the eyedropper.
 *
 * Read-only on purpose. Choosing `colour.text.muted` here copies its value in;
 * it does not bind, and it does not edit the library. Binding belongs to Form's
 * variables, which already have somewhere to record the link. Editing belongs
 * to the library screen, because a swatch changed from inside one design would
 * change in that design and nowhere else — which is the drift the library was
 * built to stop.
 */

import { useEffect, useState } from 'react'
import { hydrateStudio } from '../../../../shared/tokens/types'
import { colourSwatches } from '../../../../shared/tokens/bridges'
import { onTokenLibrariesChanged } from './useTokenLibraries'

export type TokenSwatch = {
  /** Unique across libraries, so it can key a list. */
  id: string
  /** What the picker shows. The token's path, prefixed by its library when
   *  there is more than one, because `colour.text.muted` is ambiguous the
   *  moment a second library defines it too. */
  name: string
  hex: string
}

/**
 * Every library's semantic colours, for the theme each library is currently on.
 *
 * The active theme rather than all of them: a piece is being designed against
 * one theme, and offering the dark and light value of the same token as two
 * unlabelled entries is a choice nobody can make correctly.
 */
export function useTokenSwatches(): TokenSwatch[] {
  const [swatches, setSwatches] = useState<TokenSwatch[]>([])
  const [nonce, setNonce] = useState(0)

  useEffect(() => onTokenLibrariesChanged(() => setNonce((n) => n + 1)), [])

  useEffect(() => {
    let alive = true
    void window.terminal42.tokens
      .list()
      .then((rows) => {
        if (!alive) return
        const many = rows.length > 1
        const out: TokenSwatch[] = []
        for (const row of rows) {
          const studio = hydrateStudio(row.studio)
          for (const s of colourSwatches(studio, studio.activeTheme)) {
            out.push({
              id: `${row.id}:${s.path}`,
              name: many ? `${row.name} / ${s.path}` : s.path,
              hex: s.hex
            })
          }
        }
        setSwatches(out)
      })
      // A library that will not load should cost the picker its library
      // section, not its ability to pick a colour.
      .catch(() => {
        if (alive) setSwatches([])
      })
    return () => {
      alive = false
    }
  }, [nonce])

  return swatches
}
