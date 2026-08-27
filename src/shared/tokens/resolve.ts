// Working out what a token actually is, once the sets are stacked.
//
// Nothing here touches React, IPC or the database. A studio goes in, a flat
// answer comes out, and the same input always gives the same output, so the
// interesting parts can be tested without an app around them.
//
// The order of business is always the same: stack the theme's sets into one
// flat map, then follow aliases. Keeping those apart matters, because "which
// token wins" and "what does this token point at" are different questions and
// answering them together is how you get a resolver nobody can reason about.

import {
  aliasTarget,
  type Theme,
  type Token,
  type TokenStudio,
  type TokenValue,
  type Tier
} from './types'

/** A token, plus the set it came from, so the UI can say where a value lives. */
export type Resolved = {
  token: Token
  setId: string
}

/**
 * Stack a theme's sets into one map, later sets winning.
 *
 * `source` sets are included: their whole purpose is to be resolvable without
 * being exported, and leaving them out here would break every alias that
 * points into the palette.
 */
export function flatten(studio: TokenStudio, themeId: string | null): Map<string, Resolved> {
  const theme = studio.themes.find((t) => t.id === themeId) ?? null
  const out = new Map<string, Resolved>()
  for (const set of ordered(studio, theme)) {
    for (const token of set.tokens) out.set(token.path, { token, setId: set.id })
  }
  return out
}

/** The sets a theme uses, in stacking order. Everything if there is no theme. */
function ordered(studio: TokenStudio, theme: Theme | null): TokenStudio['sets'] {
  const on = studio.sets.filter((s) => (theme ? theme.sets[s.id] !== 'off' && theme.sets[s.id] !== undefined : true))
  return [...on].sort((a, b) => a.order - b.order)
}

/** Whether a set's tokens leave the app when the studio is exported. */
export function exported(theme: Theme | null, setId: string): boolean {
  if (!theme) return true
  return theme.sets[setId] === 'enabled'
}

export type ResolveResult =
  | { ok: true; value: TokenValue; through: string[] }
  | { ok: false; reason: 'missing' | 'cycle'; at: string; through: string[] }

/**
 * Follow a token's aliases down to a literal.
 *
 * `through` is every path walked, in order, so the UI can draw the chain and
 * an error can say where it went wrong rather than only that it did.
 */
export function resolve(map: Map<string, Resolved>, path: string): ResolveResult {
  const through: string[] = []
  const seen = new Set<string>()
  let at = path
  for (;;) {
    if (seen.has(at)) return { ok: false, reason: 'cycle', at, through }
    seen.add(at)
    through.push(at)
    const hit = map.get(at)
    if (!hit) return { ok: false, reason: 'missing', at, through }
    const next = aliasTarget(hit.token.value)
    if (next === null) return { ok: true, value: resolveFields(map, hit.token.value), through }
    at = next
  }
}

/**
 * A composite's fields may each be an alias, so a shadow can change colour
 * between themes without being written out twice. A field that cannot be
 * resolved is left as it was written, which reads as the mistake it is.
 */
function resolveFields(map: Map<string, Resolved>, value: TokenValue): TokenValue {
  if (typeof value !== 'object' || value === null) return value
  const out: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(value)) {
    const target = aliasTarget(v)
    if (target === null) { out[k] = v; continue }
    const r = resolve(map, target)
    out[k] = r.ok && typeof r.value !== 'object' ? r.value : v
  }
  return out
}

export type Problem = {
  path: string
  kind: 'missing' | 'cycle' | 'literal-semantic' | 'type-mismatch'
  /** What to say about it, in one line, without jargon. */
  note: string
}

/**
 * Everything wrong with a theme, in the order a person would want to fix it.
 *
 * This is the same list the UI shows and the list a generated studio is
 * checked against before it is saved, so the model is held to exactly the
 * standard a person is.
 */
export function problems(studio: TokenStudio, themeId: string | null): Problem[] {
  const map = flatten(studio, themeId)
  const out: Problem[] = []
  for (const [path, { token }] of map) {
    const target = aliasTarget(token.value)

    if (target !== null) {
      const r = resolve(map, path)
      if (!r.ok) {
        out.push({
          path,
          kind: r.reason,
          note: r.reason === 'missing'
            ? `Points at ${r.at}, which is not in this theme.`
            : `Points back at itself, through ${r.through.join(' to ')}.`
        })
        continue
      }
      const to = map.get(target)
      if (to && to.token.type !== token.type) {
        out.push({
          path,
          kind: 'type-mismatch',
          note: `A ${token.type} pointing at ${target}, which is a ${to.token.type}.`
        })
      }
      if (to && !allowedTierStep(token.tier, to.token.tier)) {
        out.push({
          path,
          kind: 'type-mismatch',
          note: `A ${token.tier} token pointing at a ${to.token.tier} one.`
        })
      }
      continue
    }

    // A composite is a literal only if none of its fields points anywhere. A
    // `type.body` that names a family, a size and a weight by their token
    // names is doing exactly what a semantic token should, even though its
    // value happens to be an object rather than a string.
    if (typeof token.value === 'object' && token.value !== null) {
      let anyAlias = false
      for (const [field, v] of Object.entries(token.value)) {
        const t = aliasTarget(v)
        if (t === null) continue
        anyAlias = true
        const to = map.get(t)
        if (!to) {
          out.push({
            path,
            kind: 'missing',
            note: `Its ${field} points at ${t}, which is not in this theme.`
          })
        }
      }
      if (anyAlias) continue
    }

    if (token.tier !== 'primitive') {
      out.push({
        path,
        kind: 'literal-semantic',
        note: `Holds a value of its own. A ${token.tier} token should point at another one.`
      })
    }
  }
  return out
}

/** Semantic may reach primitive, component may reach semantic or primitive. */
function allowedTierStep(from: Tier, to: Tier): boolean {
  if (from === 'primitive') return false
  if (from === 'semantic') return to === 'primitive' || to === 'semantic'
  return true
}

/**
 * Every token of a theme, resolved, keyed by path.
 *
 * Unresolvable tokens are left out rather than exported as their alias text,
 * because a stylesheet containing `{colour.missing}` is worse than one missing
 * a rule: the first fails silently at runtime, the second fails loudly at
 * review.
 */
export function resolveAll(
  studio: TokenStudio,
  themeId: string | null
): Map<string, { token: Token; value: TokenValue; setId: string }> {
  const map = flatten(studio, themeId)
  const out = new Map<string, { token: Token; value: TokenValue; setId: string }>()
  for (const [path, hit] of map) {
    const r = resolve(map, path)
    if (r.ok) out.set(path, { token: hit.token, value: r.value, setId: hit.setId })
  }
  return out
}
