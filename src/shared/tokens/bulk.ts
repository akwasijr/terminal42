// Doing one thing to many tokens.
//
// A library that has grown past a few dozen tokens is edited in sweeps, not
// one token at a time: a whole ramp gets renamed, a stray group gets moved
// into the set it always belonged in, a generation of tokens gets retired
// together. Doing that by hand is where libraries go wrong, because the
// twentieth token is done with less care than the first.
//
// Every operation here takes the same shape: a studio, a list of picks, and
// whatever the operation needs. Every one reports what it could not do
// rather than doing it badly, so a sweep that half worked can be seen.

import { blankValue, deleteToken, renameToken, setDeprecated } from './edit'
import { aliasTarget, type Deprecation, type Token, type TokenStudio, type TokenType } from './types'

/** One token, named by the set it sits in as well as its path. */
export type Pick = { setId: string; path: string }

/**
 * What a sweep did.
 *
 * `skipped` names the tokens that were left alone and why, in the token's own
 * words, so the line shown afterwards can be read without looking anything up.
 */
export type BulkResult = {
  studio: TokenStudio
  changed: number
  skipped: { path: string; because: string }[]
}

function find(studio: TokenStudio, pick: Pick): Token | null {
  const set = studio.sets.find((s) => s.id === pick.setId)
  return set?.tokens.find((t) => t.path === pick.path) ?? null
}

/**
 * Remove every picked token.
 *
 * As with a single delete, aliases pointing at them are left pointing at
 * them. They show as broken, which is the truth, and the alternative is
 * guessing at a replacement on the user's behalf twenty times over.
 */
export function bulkDelete(studio: TokenStudio, picks: Pick[]): BulkResult {
  let out = studio
  let changed = 0
  const skipped: BulkResult['skipped'] = []
  for (const pick of picks) {
    if (!find(out, pick)) {
      skipped.push({ path: pick.path, because: 'it is not there any more' })
      continue
    }
    out = deleteToken(out, pick.setId, pick.path)
    changed++
  }
  return { studio: out, changed, skipped }
}

/** Mark every picked token as one to stop reaching for, or take the mark off. */
export function bulkRetire(
  studio: TokenStudio,
  picks: Pick[],
  deprecated: Deprecation | null
): BulkResult {
  let out = studio
  let changed = 0
  const skipped: BulkResult['skipped'] = []
  for (const pick of picks) {
    if (!find(out, pick)) {
      skipped.push({ path: pick.path, because: 'it is not there any more' })
      continue
    }
    out = setDeprecated(out, pick.setId, pick.path, deprecated)
    changed++
  }
  return { studio: out, changed, skipped }
}

/**
 * Change what type every picked token is.
 *
 * A value only survives the change if the new type could plausibly have held
 * it: a number stays a number across the numeric types, a string stays a
 * string across the string ones. Anything else is replaced with a blank of
 * the new type, because a colour left in a duration is not a value, it is a
 * mess waiting to be found later. An alias is always kept, since what it
 * points at decides the value anyway.
 */
const SHAPE: Record<string, 'number' | 'text' | 'other'> = {
  dimension: 'number',
  fontSize: 'number',
  fontWeight: 'number',
  lineHeight: 'number',
  letterSpacing: 'number',
  number: 'number',
  duration: 'number',
  opacity: 'number',
  color: 'text',
  fontFamily: 'text',
  cubicBezier: 'text',
  text: 'text',
  boolean: 'text',
  asset: 'text',
  textCase: 'text',
  textDecoration: 'text',
  gradient: 'text'
}

export function bulkRetype(studio: TokenStudio, picks: Pick[], type: TokenType): BulkResult {
  const want = SHAPE[type] ?? 'other'
  let changed = 0
  const skipped: BulkResult['skipped'] = []
  const wanted = new Map(picks.map((p) => [`${p.setId}\u0000${p.path}`, true]))
  const sets = studio.sets.map((s) => ({
    ...s,
    tokens: s.tokens.map((t) => {
      if (!wanted.has(`${s.id}\u0000${t.path}`)) return t
      if (t.type === type) {
        skipped.push({ path: t.path, because: `it is already ${type}` })
        return t
      }
      changed++
      if (aliasTarget(t.value) !== null) return { ...t, type }
      const held = typeof t.value === 'number' ? 'number' : typeof t.value === 'string' ? 'text' : 'other'
      return { ...t, type, value: held === want ? t.value : blankValue(type) }
    })
  }))
  for (const pick of picks) {
    if (!find(studio, pick)) skipped.push({ path: pick.path, because: 'it is not there any more' })
  }
  return { studio: { ...studio, sets }, changed, skipped }
}

/**
 * Move every picked token into another set.
 *
 * The path does not change, so nothing pointing at these tokens breaks: an
 * alias names a path and the sets are flattened into one map before it is
 * followed. A token whose path is already taken in the target set stays
 * where it is, because the only ways through are renaming it, which is not
 * what was asked for, or overwriting something, which is worse.
 */
export function bulkMove(studio: TokenStudio, picks: Pick[], toSetId: string): BulkResult {
  const target = studio.sets.find((s) => s.id === toSetId)
  if (!target) return { studio, changed: 0, skipped: picks.map((p) => ({ path: p.path, because: 'that set is gone' })) }

  const taken = new Set(target.tokens.map((t) => t.path))
  const skipped: BulkResult['skipped'] = []
  const moving: Token[] = []
  const leaving = new Set<string>()

  for (const pick of picks) {
    const token = find(studio, pick)
    if (!token) {
      skipped.push({ path: pick.path, because: 'it is not there any more' })
      continue
    }
    if (pick.setId === toSetId) {
      skipped.push({ path: pick.path, because: `it is already in ${target.name}` })
      continue
    }
    if (taken.has(token.path)) {
      skipped.push({ path: token.path, because: `${target.name} already has that name` })
      continue
    }
    taken.add(token.path)
    moving.push(token)
    leaving.add(`${pick.setId}\u0000${token.path}`)
  }

  const sets = studio.sets.map((s) => {
    if (s.id === toSetId) return { ...s, tokens: [...s.tokens, ...moving] }
    return { ...s, tokens: s.tokens.filter((t) => !leaving.has(`${s.id}\u0000${t.path}`)) }
  })
  return { studio: { ...studio, sets }, changed: moving.length, skipped }
}

/**
 * Rewrite part of every picked token's path.
 *
 * This is the sweep that earns the whole file: renaming `brand.` to
 * `accent.` across forty tokens is a morning's careful work by hand and a
 * single mistake ruins it silently. `find` is matched as plain text, not a
 * pattern, because the paths are plain text and a user typing a dot means a
 * dot. Aliases are repointed as each token goes, so the library is never
 * left in a half-renamed state.
 */
export function bulkRename(
  studio: TokenStudio,
  picks: Pick[],
  from: string,
  to: string
): BulkResult {
  if (from.length === 0) return { studio, changed: 0, skipped: [] }
  let out = studio
  let changed = 0
  const skipped: BulkResult['skipped'] = []

  for (const pick of picks) {
    const token = find(out, pick)
    if (!token) {
      skipped.push({ path: pick.path, because: 'it is not there any more' })
      continue
    }
    if (!token.path.includes(from)) {
      skipped.push({ path: token.path, because: `it does not contain "${from}"` })
      continue
    }
    const wanted = token.path.split(from).join(to).trim()
    if (wanted.length === 0) {
      skipped.push({ path: token.path, because: 'that would leave it with no name' })
      continue
    }
    if (wanted === token.path) {
      skipped.push({ path: token.path, because: 'the name would not change' })
      continue
    }
    const set = out.sets.find((s) => s.id === pick.setId)
    if (set?.tokens.some((t) => t.path === wanted)) {
      skipped.push({ path: token.path, because: `${wanted} is taken` })
      continue
    }
    out = renameToken(out, pick.setId, token.path, wanted)
    changed++
  }
  return { studio: out, changed, skipped }
}

/** A line to show after a sweep, in the shape a person would say it. */
export function sweepNote(result: BulkResult, verb: string): string {
  const { changed, skipped } = result
  const did = changed === 1 ? `${verb} 1 token` : `${verb} ${changed} tokens`
  if (skipped.length === 0) return `${did}.`
  const first = skipped[0]
  if (skipped.length === 1) return `${did}. Left ${first.path} alone, ${first.because}.`
  return `${did}. Left ${skipped.length} alone, starting with ${first.path}, ${first.because}.`
}
