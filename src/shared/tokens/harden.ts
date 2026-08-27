/**
 * Closing the gaps a coverage check found.
 *
 * Reporting a gap and leaving it there is only half an answer: "your library
 * has no focus ring" is true, unhelpful, and the person reading it now has to
 * decide what a focus ring is, which is exactly the decision the library was
 * meant to have made once. So the report comes with a way to fill it.
 *
 * Two rules govern everything here.
 *
 * It only ever adds. Nothing is renamed, retyped or overwritten, because a
 * library is somebody's work and an action that improves it by changing it is
 * an action nobody will press twice.
 *
 * It fills by alias wherever the library already holds the answer. A focus
 * ring that points at the library's own brand colour stays right when the
 * brand changes; a focus ring filled in with `#2563eb` is a second opinion
 * about the brand that will be wrong within the month. Only where there is
 * genuinely nothing to point at — a cubic bezier, a breakpoint — does a
 * literal go in.
 */

import type { Token, TokenStudio, TokenValue } from './types'
import { resolveAll } from './resolve'
import { coverageOf, type Coverage } from './coverage'

export type Filled = {
  studio: TokenStudio
  /** Paths added, in the order they were added. */
  added: string[]
  /** Checks that could not be filled, and the reason in plain words. */
  skipped: Array<{ id: string; reason: string }>
}

type Seed = {
  path: string
  type: Token['type']
  tier: Token['tier']
  value: TokenValue
}

let counter = 0
function id(): string {
  counter += 1
  return `tok_fill_${Date.now().toString(36)}_${counter.toString(36)}`
}

/**
 * A token in the library whose path reads like the thing we want to point at.
 *
 * Words are tried in order and the first that matches wins, so a caller can
 * say "the surface colour, or failing that the background" and get the better
 * answer when it exists without having to check twice.
 */
function findPath(tokens: Token[], type: Token['type'], patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const hit = tokens.find((t) => t.type === type && re.test(t.path))
    if (hit) return hit.path
  }
  return null
}

/**
 * What a library is missing, as tokens it could hold.
 *
 * Each block is guarded by its own check, so a library that already has icon
 * colours under some other name is left alone rather than given a second set
 * beside the first.
 */
function seedsFor(rows: Coverage[], tokens: Token[]): { seeds: Seed[]; skipped: Filled['skipped'] } {
  const seeds: Seed[] = []
  const skipped: Filled['skipped'] = []
  const gap = (id: string): boolean => rows.some((r) => r.check.id === id && !r.met)
  const has = (path: string): boolean => tokens.some((t) => t.path === path)
  const ref = (path: string): string => `{${path}}`

  const surface = findPath(tokens, 'color', [/surface/i, /\bbg\b|background/i, /canvas/i])
  const sunken = findPath(tokens, 'color', [/sunken|subtle/i, /surface/i])
  const raised = findPath(tokens, 'color', [/raised|elevated/i, /surface/i])
  const textPrimary = findPath(tokens, 'color', [/text\.primary|\bprimary\b/i, /text/i])
  const textSecondary = findPath(tokens, 'color', [/text\.secondary|secondary/i, /text/i])
  const textDisabled = findPath(tokens, 'color', [/disabled/i])
  const brand = findPath(tokens, 'color', [/brand\.rest|brand\.default/i, /brand/i, /accent/i])
  const focus = findPath(tokens, 'color', [/focus/i, /brand/i])
  const onBrand = findPath(tokens, 'color', [/brand\.on|\.on$/i, /text\.primary/i])

  const add = (path: string, type: Token['type'], tier: Token['tier'], value: TokenValue): void => {
    if (has(path)) return
    seeds.push({ path, type, tier, value })
  }

  if (gap('layers')) {
    if (surface && sunken && raised) {
      add('colour.layer.01', 'color', 'semantic', ref(surface))
      add('colour.layer.02', 'color', 'semantic', ref(raised))
      add('colour.layer.03', 'color', 'semantic', ref(sunken))
      add('colour.layer.hover', 'color', 'semantic', ref(sunken))
    } else {
      skipped.push({ id: 'layers', reason: 'The library has no surface colours to build the layers out of.' })
    }
  }

  if (gap('field')) {
    if (surface) {
      add('colour.field.01', 'color', 'semantic', ref(sunken ?? surface))
      add('colour.field.02', 'color', 'semantic', ref(surface))
    } else {
      skipped.push({ id: 'field', reason: 'The library has no surface colour a field could sit on.' })
    }
  }

  if (gap('focusInset')) {
    if (surface) add('colour.focus.inset', 'color', 'semantic', ref(surface))
    else skipped.push({ id: 'focusInset', reason: 'The library has no surface colour to draw the inset in.' })
  }

  if (gap('focus')) {
    if (brand) add('colour.focus.ring', 'color', 'semantic', ref(focus ?? brand))
    else skipped.push({ id: 'focus', reason: 'The library has no brand colour to make a ring out of.' })
  }

  if (gap('icon')) {
    if (textPrimary && textSecondary) {
      add('colour.icon.primary', 'color', 'semantic', ref(textPrimary))
      add('colour.icon.secondary', 'color', 'semantic', ref(textSecondary))
      if (textDisabled) add('colour.icon.disabled', 'color', 'semantic', ref(textDisabled))
      if (onBrand) add('colour.icon.on', 'color', 'semantic', ref(onBrand))
    } else {
      skipped.push({ id: 'icon', reason: 'The library has no text colours for the icons to follow.' })
    }
  }

  if (gap('link')) {
    const link = findPath(tokens, 'color', [/link/i])
    if (brand) {
      add('colour.link.rest', 'color', 'semantic', ref(link ?? brand))
      add('colour.link.hover', 'color', 'semantic', ref(brand))
      // Visited has to differ from rest or it says nothing, so it takes the
      // accent when there is one rather than quietly repeating the brand.
      const accent = findPath(tokens, 'color', [/accent/i])
      add('colour.link.visited', 'color', 'semantic', ref(accent ?? brand))
    } else {
      skipped.push({ id: 'link', reason: 'The library has no brand colour for a link to take.' })
    }
  }

  if (gap('inverse')) {
    if (textPrimary && surface) {
      // The inverse surface is not a new colour: it is the two the library
      // already has, swapped. That is what keeps it inverse when they change.
      add('colour.inverse.bg', 'color', 'semantic', ref(textPrimary))
      add('colour.inverse.text', 'color', 'semantic', ref(surface))
    } else {
      skipped.push({ id: 'inverse', reason: 'The library has no text and surface pair to swap.' })
    }
  }

  if (gap('skeleton')) {
    if (sunken) {
      add('colour.skeleton.bg', 'color', 'semantic', ref(sunken))
      add('colour.skeleton.element', 'color', 'semantic', ref(sunken))
    } else {
      skipped.push({ id: 'skeleton', reason: 'The library has no quiet surface for a skeleton to sit on.' })
    }
  }

  if (gap('typeCompact')) {
    const body = tokens.find((t) => t.type === 'typography' && /body/i.test(t.path))
    const tight = findPath(tokens, 'lineHeight', [/snug/i, /tight/i, /normal/i])
    if (body && typeof body.value === 'object') {
      add('type.bodyCompact', 'typography', 'semantic', {
        ...(body.value as Record<string, string | number>),
        ...(tight ? { lineHeight: ref(tight) } : { lineHeight: 1.35 })
      })
    } else {
      skipped.push({ id: 'typeCompact', reason: 'The library has no body style to make a compact one from.' })
    }
  }

  if (gap('layout')) {
    // A layout scale wants the big end of the spacing scale, so the steps are
    // picked from the largest the library actually has rather than invented.
    const spaces = tokens
      .filter((t) => t.type === 'dimension' && /^space|^spacing/i.test(t.path) && typeof t.value === 'number')
      .sort((a, b) => (a.value as number) - (b.value as number))
    if (spaces.length >= 4) {
      const pick = [0.4, 0.6, 0.8, 1].map((f) => spaces[Math.min(spaces.length - 1, Math.round(f * (spaces.length - 1)))])
      const names = ['sm', 'md', 'lg', 'xl']
      pick.forEach((t, i) => add(`layout.${names[i]}`, 'dimension', 'semantic', ref(t.path)))
    } else {
      skipped.push({ id: 'layout', reason: 'The library has too few spacing steps to draw a layout scale from.' })
    }
  }

  if (gap('expressive')) {
    // No alias is possible: nothing in a library implies a curve.
    add('ease.expressive.standard', 'cubicBezier', 'primitive', { x1: 0.4, y1: 0.14, x2: 0.3, y2: 1 })
    add('ease.expressive.entrance', 'cubicBezier', 'primitive', { x1: 0, y1: 0, x2: 0.3, y2: 1 })
    add('ease.expressive.exit', 'cubicBezier', 'primitive', { x1: 0.4, y1: 0.14, x2: 1, y2: 1 })
  }

  if (gap('easings')) {
    add('ease.standard', 'cubicBezier', 'primitive', { x1: 0.2, y1: 0, x2: 0.38, y2: 0.9 })
    add('ease.entrance', 'cubicBezier', 'primitive', { x1: 0, y1: 0, x2: 0.38, y2: 0.9 })
    add('ease.exit', 'cubicBezier', 'primitive', { x1: 0.2, y1: 0, x2: 1, y2: 0.9 })
  }

  if (gap('durations')) {
    for (const [name, ms] of [['fast', 70], ['quick', 110], ['normal', 150], ['moderate', 240], ['slow', 400], ['deliberate', 700]] as const) {
      add(`time.${name}`, 'duration', 'primitive', ms)
    }
  }

  if (gap('breakpoints')) {
    for (const [name, px] of [['sm', 320], ['md', 672], ['lg', 1056], ['xl', 1312], ['2xl', 1584]] as const) {
      add(`breakpoint.${name}`, 'dimension', 'primitive', px)
    }
  }

  if (gap('gutters')) {
    for (const [name, cols] of [['sm', 4], ['md', 8], ['lg', 16]] as const) {
      add(`column.${name}`, 'number', 'primitive', cols)
    }
    const gutter = findPath(tokens, 'dimension', [/^space\.4$|^spacing/i, /^space/i])
    add('gutter.wide', 'dimension', gutter ? 'semantic' : 'primitive', gutter ? ref(gutter) : 16)
    add('gutter.narrow', 'dimension', 'primitive', 8)
    add('gutter.condensed', 'dimension', 'primitive', 0)
  }

  return { seeds, skipped }
}

/**
 * Which set a new token should land in.
 *
 * The set that already holds most of what this token is like, because a
 * colour dropped into the type set is technically fine and practically lost.
 * Falling back to the largest set keeps a one-set library working.
 */
function setFor(studio: TokenStudio, seed: Seed): string {
  let best: { id: string; score: number } | null = null
  for (const set of studio.sets) {
    const stem = seed.path.split('.')[0]
    let score = set.tokens.filter((t) => t.type === seed.type).length
    score += set.tokens.filter((t) => t.path.split('.')[0] === stem).length * 10
    if (!best || score > best.score) best = { id: set.id, score }
  }
  return best?.id ?? studio.sets[0]?.id ?? ''
}

/**
 * Add everything the checks found missing that the library can support.
 *
 * The studio comes back new rather than mutated, so a screen can show what
 * would happen before committing to it.
 */
export function fillGaps(studio: TokenStudio, themeId: string | null): Filled {
  const rows = coverageOf(studio, themeId)
  const tokens = [...resolveAll(studio, themeId)].map(([, hit]) => hit.token)
  const { seeds, skipped } = seedsFor(rows, tokens)

  if (seeds.length === 0) return { studio, added: [], skipped }

  const sets = studio.sets.map((s) => ({ ...s, tokens: [...s.tokens] }))
  const byId = new Map(sets.map((s) => [s.id, s]))
  const added: string[] = []

  for (const seed of seeds) {
    const target = byId.get(setFor(studio, seed))
    if (!target) continue
    if (target.tokens.some((t) => t.path === seed.path)) continue
    target.tokens.push({ id: id(), path: seed.path, type: seed.type, tier: seed.tier, value: seed.value })
    added.push(seed.path)
  }

  return { studio: { ...studio, sets }, added, skipped }
}

/** What the button should say it will do, before anybody presses it. */
export function fillNote(result: Filled): string {
  if (result.added.length === 0) return 'Nothing to add: the library already covers everything checked.'
  const one = result.added.length === 1
  const head = `${one ? 'Adds 1 token' : `Adds ${result.added.length} tokens`}.`
  if (result.skipped.length === 0) return head
  return `${head} ${result.skipped.length} gap${result.skipped.length === 1 ? '' : 's'} need${result.skipped.length === 1 ? 's' : ''} a decision first.`
}
