/**
 * Getting the library out of the library screen.
 *
 * A shared source of truth that only exists on one screen is not shared, it is
 * a second place to look. The whole point of the library is that Form's
 * variables, Motion's swatches and a generated page all say the same blue, and
 * that only happens if the library can walk into those places rather than
 * waiting to be copied by hand.
 *
 * Each bridge is a pure function of a studio and a theme, so what arrives is
 * decided here and can be argued about in a test, rather than being decided
 * inside whichever screen happened to call it.
 *
 * Deliberately one-way. A round trip sounds better and is worse: two editors
 * that both write means two editors that can disagree, and then the question
 * "what is our blue" has two answers again.
 */

import type { Token, TokenStudio, TokenValue } from './types'
import { resolveAll } from './resolve'
import { sectionOf } from './groups'

/**
 * The swatches and families Motion should show.
 *
 * Semantic only. Motion's picker is a row of squares somebody chooses from by
 * eye, and offering the whole primitive ramp turns that into a paint shop:
 * fifty greys, none of which is the one the library actually uses for text.
 */
export function brandItems(
  studio: TokenStudio,
  themeId: string | null
): { colours: string[]; fonts: string[] } {
  const colours: string[] = []
  const fonts: string[] = []
  const family = (raw: unknown): void => {
    if (typeof raw !== 'string') return
    const first = raw.split(',')[0].trim().replace(/^["']|["']$/g, '')
    if (first && !fonts.includes(first)) fonts.push(first)
  }
  for (const [, hit] of sorted(studio, themeId)) {
    if (hit.token.tier === 'primitive') continue
    const v = hit.value
    if (hit.token.type === 'color' && typeof v === 'string' && !colours.includes(v)) colours.push(v)
    if (hit.token.type === 'fontFamily') family(v)
    // A library names its families inside its type styles rather than beside
    // them, so a bridge that only looked at fontFamily tokens would find the
    // three primitives it is meant to skip and nothing else.
    if (hit.token.type === 'typography' && v && typeof v === 'object') {
      family((v as Record<string, unknown>).fontFamily)
    }
  }
  return { colours, fonts }
}

/**
 * Whether a token can become a Form variable at all.
 *
 * Form holds colours, numbers, strings and booleans. A shadow, a border or a
 * curve is none of those, so it stays in the library rather than arriving as
 * a string nobody can bind to. Declared here rather than beside Form's
 * variables so the count somebody reads before pressing the button is
 * produced by the same rule as the thing that lands.
 */
export function formVarType(type: string): 'color' | 'string' | 'number' | null {
  if (type === 'color') return 'color'
  if (type === 'fontFamily') return 'string'
  if (
    type === 'dimension' || type === 'fontSize' || type === 'fontWeight'
    || type === 'lineHeight' || type === 'letterSpacing' || type === 'opacity' || type === 'number'
  ) return 'number'
  return null
}

/**
 * Whether a bridge would carry anything.
 *
 * Asked before the action is offered, because an action that does nothing is
 * worse than an absent one: it teaches people the feature is broken rather
 * than that their library has no colours in it yet.
 */
export function bridgeSummary(
  studio: TokenStudio,
  themeId: string | null
): { colours: number; fonts: number; variables: number } {
  const { colours, fonts } = brandItems(studio, themeId)
  let variables = 0
  for (const [, hit] of resolveAll(studio, themeId)) {
    if (hit.token.tier === 'primitive') continue
    if (formVarType(hit.token.type)) variables += 1
  }
  return { colours: colours.length, fonts: fonts.length, variables }
}

/**
 * Resolved tokens in the order the library screen shows them.
 *
 * Order is the whole value of a swatch row. Sorted alphabetically, `accent`
 * lands next to `border` and the row reads as a bag; grouped by section, it
 * reads as the palette somebody designed.
 */
function sorted(
  studio: TokenStudio,
  themeId: string | null
): Array<[string, { token: Token; value: TokenValue }]> {
  const rows = [...resolveAll(studio, themeId)]
  return rows.sort((a, b) => {
    const sa = sectionOf(a[1].token)
    const sb = sectionOf(b[1].token)
    if (sa !== sb) return sa.localeCompare(sb)
    return a[0].localeCompare(b[0])
  })
}
