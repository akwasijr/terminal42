/**
 * Reading a page back against the library it was supposed to use.
 *
 * The prompt asks a model to build from the library, and mostly it does, but
 * "mostly" is exactly the failure this whole feature exists to stop. One page
 * quietly ships #4f46e5 where the library says --colour-accent, the next page
 * copies it, and six weeks later nobody can say which blue is the real one.
 *
 * So this reads the finished page and says two different things, because they
 * are two different mistakes:
 *
 *   - A literal that IS in the library is a missed reference. The value is
 *     right; the page just froze it instead of pointing at it, and it will not
 *     move when the library moves.
 *   - A literal that is NOT in the library is a drift. Somebody invented a
 *     value. Naming the closest token turns "this is wrong" into "you probably
 *     meant this", which is the difference between a warning people fix and a
 *     warning people mute.
 *
 * Only declared CSS is read, never prose, and only properties whose meaning is
 * unambiguous. A false positive here costs more than a miss: the report sits
 * beside the AI-rule violations that already auto-fix, and a linter that cries
 * wolf gets turned off, at which point it protects nothing.
 */

import type { TokenStudio, TokenValue } from './types'
import { resolveAll } from './resolve'

export type TokensFinding = {
  /** What kind of value this is, in the words a person would use. */
  kind: 'colour' | 'radius' | 'spacing' | 'text size' | 'typeface'
  /** The literal exactly as it appears in the page. */
  literal: string
  /** How many declarations use it. */
  count: number
  /** True when the library holds this exact value under a name. */
  exact: boolean
  /** The token that should have been used, as a custom property name. */
  nearest: string | null
  /** That token's value, so the gap is visible without a lookup. */
  nearestValue: string | null
}

type Entry = { name: string; value: string; num: number | null; rgb: RGB | null }
type RGB = { r: number; g: number; b: number }

const SAFE = new Set([
  '0', 'auto', 'none', 'inherit', 'initial', 'unset', 'currentcolor',
  'transparent', 'revert', 'inherit'
])

/** Properties whose value is a colour, and nothing else. */
const COLOUR_PROPS = new Set([
  'color', 'background', 'background-color', 'border-color', 'border-top-color',
  'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color',
  'fill', 'stroke', 'caret-color', 'text-decoration-color', 'accent-color'
])

const RADIUS_PROPS = new Set([
  'border-radius', 'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-left-radius', 'border-bottom-right-radius'
])

const SPACING_PROPS = new Set([
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'padding-block', 'padding-inline', 'margin', 'margin-top', 'margin-right',
  'margin-bottom', 'margin-left', 'margin-block', 'margin-inline', 'gap',
  'row-gap', 'column-gap'
])

/**
 * The library, flattened into the five lists a page can be measured against.
 *
 * Split by what the value MEANS rather than by its declared type, because a
 * radius and a gap are both dimensions and offering a gap as the nearest match
 * for a corner is worse than offering nothing.
 */
function shelves(studio: TokenStudio, themeId: string | null): Record<TokensFinding['kind'], Entry[]> {
  const out: Record<TokensFinding['kind'], Entry[]> = {
    colour: [], radius: [], spacing: [], 'text size': [], typeface: []
  }
  for (const [path, hit] of resolveAll(studio, themeId)) {
    const name = `--${cssName(path)}`
    const v = hit.value
    const type = hit.token.type
    if (type === 'color' && typeof v === 'string') {
      out.colour.push({ name, value: v, num: null, rgb: toRGB(v) })
    } else if (type === 'fontFamily' && typeof v === 'string') {
      out.typeface.push({ name, value: v, num: null, rgb: null })
    } else if (type === 'fontSize') {
      const n = numeric(v)
      if (n !== null) out['text size'].push({ name, value: `${n}px`, num: n, rgb: null })
    } else if (type === 'dimension') {
      const n = numeric(v)
      if (n === null) continue
      const shelf = /radius|corner|round/i.test(path) ? out.radius : out.spacing
      shelf.push({ name, value: `${n}px`, num: n, rgb: null })
    }
  }
  return out
}

function cssName(path: string): string {
  return path.replace(/\./g, '-').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

function numeric(v: TokenValue): number | null {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const m = v.match(/^(-?\d+(?:\.\d+)?)(px)?$/)
    if (m) return parseFloat(m[1])
  }
  return null
}

/**
 * Every CSS declaration in the page, wherever it lives.
 *
 * Both <style> blocks and style="" attributes, because a value hidden in an
 * inline attribute drifts exactly as far as one in a stylesheet, and inline is
 * where a hurried model puts things.
 */
function declarations(html: string): Array<[string, string]> {
  const out: Array<[string, string]> = []
  const push = (css: string): void => {
    for (const chunk of css.split(/[;{}]/)) {
      const i = chunk.indexOf(':')
      if (i < 0) continue
      const prop = chunk.slice(0, i).trim().toLowerCase()
      const value = chunk.slice(i + 1).trim()
      if (prop && value && !prop.startsWith('--')) out.push([prop, value])
    }
  }
  const style = /<style[^>]*>([\s\S]*?)<\/style>/gi
  let m: RegExpExecArray | null
  while ((m = style.exec(html))) push(m[1])
  const inline = /\sstyle\s*=\s*"([^"]*)"/gi
  while ((m = inline.exec(html))) push(m[1])
  return out
}

const COLOUR_LITERAL = /#[0-9a-f]{3,8}\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\)/gi

export function lintAgainstTokens(
  html: string,
  studio: TokenStudio,
  themeId: string | null
): TokensFinding[] {
  if (!html) return []
  const shelf = shelves(studio, themeId)
  const seen = new Map<string, TokensFinding>()

  const note = (kind: TokensFinding['kind'], literal: string): void => {
    const key = `${kind}|${literal.toLowerCase()}`
    const already = seen.get(key)
    if (already) { already.count += 1; return }
    const near = nearest(kind, literal, shelf[kind])
    seen.set(key, {
      kind,
      literal,
      count: 1,
      exact: near?.exact ?? false,
      nearest: near?.entry.name ?? null,
      nearestValue: near?.entry.value ?? null
    })
  }

  for (const [prop, rawValue] of declarations(html)) {
    const value = rawValue.trim()
    if (!value || value.includes('var(')) continue
    const lower = value.toLowerCase()
    if (SAFE.has(lower)) continue

    // Colours are read out of the value rather than off the property, because
    // the ones that matter most hide inside box-shadow and gradient stops.
    if (COLOUR_PROPS.has(prop) || prop === 'box-shadow' || prop === 'border' || prop === 'outline') {
      const hits = value.match(COLOUR_LITERAL)
      if (hits) for (const h of hits) note('colour', h)
      if (COLOUR_PROPS.has(prop) && !hits && /^[a-z]+$/.test(lower) && !SAFE.has(lower)) {
        note('colour', lower)
      }
    }

    if (RADIUS_PROPS.has(prop)) for (const n of pxParts(value)) note('radius', n)
    if (SPACING_PROPS.has(prop)) for (const n of pxParts(value)) note('spacing', n)
    if (prop === 'font-size') for (const n of pxParts(value)) note('text size', n)
    if (prop === 'font-family' || prop === 'font') {
      const first = value.split(',')[0].trim().replace(/^["']|["']$/g, '')
      if (first && !/^\d/.test(first) && shelf.typeface.length) note('typeface', first)
    }
  }

  // Loudest first: a drift is a decision somebody made by accident, a missed
  // reference is only a value that will not move. Then by how often it happens.
  return [...seen.values()].sort((a, b) =>
    (Number(a.exact) - Number(b.exact)) || (b.count - a.count) || a.literal.localeCompare(b.literal)
  )
}

/** Every px length in a shorthand, so `padding: 16px 24px` reports both. */
function pxParts(value: string): string[] {
  const out: string[] = []
  for (const m of value.matchAll(/(-?\d+(?:\.\d+)?)px\b/g)) {
    if (parseFloat(m[1]) === 0) continue
    out.push(m[0])
  }
  return out
}

function nearest(
  kind: TokensFinding['kind'],
  literal: string,
  entries: Entry[]
): { entry: Entry; exact: boolean } | null {
  if (!entries.length) return null
  if (kind === 'typeface') {
    const want = literal.toLowerCase()
    const hit = entries.find((e) => e.value.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase() === want)
    return hit ? { entry: hit, exact: true } : { entry: entries[0], exact: false }
  }
  if (kind === 'colour') {
    const rgb = toRGB(literal)
    if (!rgb) return null
    let best: Entry | null = null
    let bestD = Infinity
    for (const e of entries) {
      if (!e.rgb) continue
      const d = (e.rgb.r - rgb.r) ** 2 + (e.rgb.g - rgb.g) ** 2 + (e.rgb.b - rgb.b) ** 2
      if (d < bestD) { bestD = d; best = e }
    }
    if (!best) return null
    return { entry: best, exact: bestD === 0 }
  }
  const n = parseFloat(literal)
  if (!Number.isFinite(n)) return null
  let best: Entry | null = null
  let bestD = Infinity
  for (const e of entries) {
    if (e.num === null) continue
    const d = Math.abs(e.num - n)
    if (d < bestD) { bestD = d; best = e }
  }
  if (!best) return null
  return { entry: best, exact: bestD === 0 }
}

/** Hex, rgb() and the handful of bare names worth understanding. */
export function toRGB(input: string): RGB | null {
  const s = input.trim().toLowerCase()
  const named: Record<string, string> = {
    black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000',
    blue: '#0000ff', grey: '#808080', gray: '#808080'
  }
  const hexish = named[s] ?? s
  if (hexish.startsWith('#')) {
    let h = hexish.slice(1)
    if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join('')
    if (h.length === 8) h = h.slice(0, 6)
    if (h.length !== 6 || /[^0-9a-f]/.test(h)) return null
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
  }
  const m = hexish.match(/^rgba?\(([^)]*)\)$/)
  if (m) {
    const parts = m[1].split(/[,/\s]+/).filter(Boolean).map((p) => parseFloat(p))
    if (parts.length < 3 || parts.some((p) => !Number.isFinite(p))) return null
    return { r: parts[0], g: parts[1], b: parts[2] }
  }
  return null
}

/**
 * The findings as the sentences a person reads in chat.
 *
 * Deliberately not one line per finding: a page with forty hardcoded greys
 * produces a wall nobody reads. The count carries the weight instead.
 */
export function describeTokensFindings(findings: TokensFinding[], libraryName: string): string[] {
  return findings.map((f) => {
    const times = f.count === 1 ? '' : ` (${f.count} times)`
    if (f.exact && f.nearest) {
      return `${f.literal} is ${libraryName}'s ${f.nearest}, written out by hand${times}. Use var(${f.nearest}) so it moves when the library does.`
    }
    if (f.nearest) {
      return `${f.literal} is not a ${libraryName} ${f.kind}${times}. The closest is ${f.nearest} (${f.nearestValue}).`
    }
    return `${f.literal} is not a ${libraryName} ${f.kind}${times}.`
  })
}
