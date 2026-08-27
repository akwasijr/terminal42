// Changing a studio.
//
// Every edit is a whole new studio rather than a mutation, because the view
// is driven straight off the object and a mutated one would not redraw. They
// live here rather than in the component so the awkward cases, renaming a
// token that other tokens point at being the worst of them, can be tested
// without a screen.

import { aliasTarget, type Deprecation, type Token, type TokenStudio, type TokenType, type TokenValue } from './types'

function mapSet(
  studio: TokenStudio,
  setId: string,
  fn: (tokens: Token[]) => Token[]
): TokenStudio {
  return {
    ...studio,
    sets: studio.sets.map((s) => (s.id === setId ? { ...s, tokens: fn(s.tokens) } : s))
  }
}

/** Change what a token holds, leaving everything else alone. */
export function setTokenValue(
  studio: TokenStudio,
  setId: string,
  path: string,
  value: TokenValue
): TokenStudio {
  return mapSet(studio, setId, (tokens) =>
    tokens.map((t) => (t.path === path ? { ...t, value } : t))
  )
}

/**
 * Rename a token, and repoint everything that named it.
 *
 * A rename that leaves dangling aliases behind is not a rename, it is a
 * delete and an insert. So every alias in the whole studio is rewritten,
 * including in sets that are switched off, because they will be switched on
 * again one day.
 */
export function renameToken(studio: TokenStudio, setId: string, from: string, to: string): TokenStudio {
  const clean = to.trim().replace(/^\{|\}$/g, '')
  if (clean.length === 0 || clean === from) return studio
  return {
    ...studio,
    sets: studio.sets.map((s) => ({
      ...s,
      tokens: s.tokens.map((t) => {
        const renamed = s.id === setId && t.path === from ? { ...t, path: clean, id: clean } : t
        return aliasTarget(renamed.value) === from ? { ...renamed, value: `{${clean}}` } : renamed
      })
    }))
  }
}

/**
 * Remove a token.
 *
 * Anything pointing at it is left pointing at it. Rewriting those aliases to
 * some other token would be a guess, and a dangling alias is at least honest:
 * it is counted on the problem line and shown as broken where it sits.
 */
export function deleteToken(studio: TokenStudio, setId: string, path: string): TokenStudio {
  return mapSet(studio, setId, (tokens) => tokens.filter((t) => t.path !== path))
}

/** A path not already used in this set, so adding twice does not collide. */
export function freePath(studio: TokenStudio, setId: string, wanted: string): string {
  const taken = new Set(
    (studio.sets.find((s) => s.id === setId)?.tokens ?? []).map((t) => t.path)
  )
  if (!taken.has(wanted)) return wanted
  for (let n = 2; n < 999; n++) {
    const candidate = `${wanted}${n}`
    if (!taken.has(candidate)) return candidate
  }
  return `${wanted}${Date.now()}`
}

const BLANK: Record<string, TokenValue> = {
  color: '#7c7c85',
  dimension: 8,
  fontSize: 16,
  fontFamily: 'Geist',
  fontWeight: 400,
  lineHeight: 1.5,
  letterSpacing: 0,
  number: 0,
  duration: 200,
  opacity: 1,
  cubicBezier: '0.4, 0, 0.2, 1',
  shadow: { x: 0, y: 1, blur: 3, spread: 0, color: 'rgba(9,9,11,0.06)' },
  border: { width: 1, style: 'solid', color: '#e4e4e7' },
  typography: { fontFamily: 'Geist', fontSize: 16, fontWeight: 400, lineHeight: 1.5 },
  text: '',
  boolean: 'false',
  asset: '',
  textCase: 'none',
  textDecoration: 'none',
  gradient: 'linear-gradient(180deg, #7c7c85 0%, #e4e4e7 100%)'
}

/** A sensible starting value for a type, so a new token is never empty. */
export function blankValue(type: TokenType): TokenValue {
  return BLANK[type] ?? ''
}

export function addToken(
  studio: TokenStudio,
  setId: string,
  type: TokenType,
  tier: Token['tier'],
  wantedPath: string
): { studio: TokenStudio; path: string } {
  const path = freePath(studio, setId, wantedPath)
  const token: Token = { id: path, path, type, tier, value: blankValue(type) }
  return { studio: mapSet(studio, setId, (tokens) => [...tokens, token]), path }
}

/** Mark a token as one to stop reaching for, or take the mark off again. */
export function setDeprecated(
  studio: TokenStudio,
  setId: string,
  path: string,
  deprecated: Deprecation | null
): TokenStudio {
  return mapSet(studio, setId, (tokens) =>
    tokens.map((t) => {
      if (t.path !== path) return t
      if (!deprecated) {
        const { deprecated: _gone, ...rest } = t
        return rest
      }
      return { ...t, deprecated }
    })
  )
}

/** Point a token at another one, or cut it loose with a literal of its own. */
export function setAlias(
  studio: TokenStudio,
  setId: string,
  path: string,
  target: string | null,
  literal: TokenValue
): TokenStudio {
  return setTokenValue(studio, setId, path, target ? `{${target}}` : literal)
}

/**
 * Everything a token could point at.
 *
 * The same type, never itself, and never anything that already reaches it,
 * because that is how a cycle gets made and there is no reason to offer one.
 */
export function aliasCandidates(
  studio: TokenStudio,
  path: string,
  type: TokenType
): string[] {
  const byPath = new Map<string, Token>()
  for (const s of studio.sets) for (const t of s.tokens) byPath.set(t.path, t)

  const reaches = (from: string): boolean => {
    let at = from
    for (let i = 0; i < 32; i++) {
      const t = byPath.get(at)
      if (!t) return false
      const next = aliasTarget(t.value)
      if (!next) return false
      if (next === path) return true
      at = next
    }
    return false
  }

  return [...byPath.values()]
    .filter((t) => t.type === type && t.path !== path && !reaches(t.path))
    .map((t) => t.path)
    .sort()
}
