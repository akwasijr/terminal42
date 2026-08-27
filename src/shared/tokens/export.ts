// Getting tokens out of the app and into a codebase.
//
// Two formats, for two readers. `tokens.json` is the W3C draft format, which
// is what other tools read; `tokens.css` is custom properties, which is what a
// stylesheet reads. Both are written from the resolved theme, so what leaves
// the app is values rather than a puzzle for the reader to solve.
//
// Both must be idempotent: run the export twice with nothing changed and the
// bytes must match, or every flow that exports produces a diff and nobody
// trusts the diff any more. That means sorted keys and no timestamps.

import { exported, resolveAll } from './resolve'
import { SECTIONS, sectionOf, type SectionId } from './groups'
import type { TokenStudio, TokenType, TokenValue } from './types'

/**
 * A short, stable fingerprint of what a theme currently exports.
 *
 * The point is to be able to say "the library moved" about a design that was
 * generated against it, without keeping a copy of the library on every design.
 *
 * It hashes the three exported files rather than the studio, because the
 * question it answers is precisely "would re-exporting write different bytes
 * beside this design?" — which is the same question the Re-sync button
 * answers. All three, not just the stylesheet: tokens.json and tokens.md are
 * written into the folder too, so a change that only reaches those still
 * leaves the folder out of date. By the same token a change that reaches none
 * of them, such as an edit to a theme that is not the one this design uses,
 * correctly counts as no change at all. The exports are already sorted and
 * free of timestamps for exactly this reason.
 *
 * FNV-1a rather than a real digest because this must run in the renderer as
 * well as the main process, and node:crypto is not there. It guards against
 * drift going unnoticed, not against anyone forging a match.
 */
export function tokensHash(studio: TokenStudio, themeId: string | null): string {
  const sep = '\u0000'
  return fnv1a([toCSS(studio, themeId), toDTCG(studio, themeId), toMarkdown(studio, themeId)].join(sep))
}

function fnv1a(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    // The usual FNV prime multiply, spelled out in shifts. A plain `h * 16777619`
    // overflows the 53 bits a double can hold exactly and starts losing the low
    // end, which would make the hash depend on rounding rather than on the input.
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/** What the draft calls each of our types. Ours are already its names. */
function dtcgType(type: TokenType): string {
  return type
}

type Node = { [k: string]: Node | { $type: string; $value: TokenValue; $description?: string } }

/**
 * The theme as a DTCG document.
 *
 * Only `enabled` sets are written. A `source` set exists so that the palette
 * can be pointed at without ending up in the output, which is the whole reason
 * the distinction is there.
 */
export function toDTCG(studio: TokenStudio, themeId: string | null): string {
  const theme = studio.themes.find((t) => t.id === themeId) ?? null
  const root: Node = {}
  for (const path of sortedPaths(studio, themeId)) {
    const hit = resolveAll(studio, themeId).get(path)
    if (!hit || !exported(theme, hit.setId)) continue
    place(root, path.split('.'), {
      $type: dtcgType(hit.token.type),
      $value: hit.value,
      ...(hit.token.description ? { $description: hit.token.description } : {})
    })
  }
  return `${JSON.stringify(root, null, 2)}\n`
}

function place(node: Node, parts: string[], leaf: Node[string]): void {
  const [head, ...rest] = parts
  if (rest.length === 0) { node[head] = leaf; return }
  const next = node[head]
  // A path that is both a token and a group cannot be represented, so the
  // group wins and the token is dropped: a group holds other people's work.
  if (!next || typeof next !== 'object' || '$value' in next) node[head] = {}
  place(node[head] as Node, rest, leaf)
}

/**
 * The theme as custom properties.
 *
 * Dots become dashes, which is the convention everywhere, and a composite is
 * written as the one string CSS would want rather than as its parts, because
 * a `--shadow-card-blur` nobody can use is not worth the line.
 */
export function toCSS(studio: TokenStudio, themeId: string | null, selector = ':root'): string {
  const theme = studio.themes.find((t) => t.id === themeId) ?? null
  const all = resolveAll(studio, themeId)
  const lines: string[] = []
  for (const path of sortedPaths(studio, themeId)) {
    const hit = all.get(path)
    if (!hit || !exported(theme, hit.setId)) continue
    lines.push(`  --${cssName(path)}: ${cssValue(hit.token.type, hit.value)};`)
  }
  return `${selector} {\n${lines.join('\n')}\n}\n`
}

/**
 * A dot path as a custom property name.
 *
 * Kebab throughout, including inside a segment, because a file that mixes
 * `--colour-text-primary` with `--button-backgroundHover` reads as an
 * accident even though both work.
 */
function cssName(path: string): string {
  return path
    .replace(/\./g, '-')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

function cssValue(type: TokenType, value: TokenValue): string {
  if (typeof value === 'number') {
    if (type === 'dimension' || type === 'fontSize') return `${value}px`
    // A duration is a time, and CSS will not read a bare number as one: a
    // `transition: 200` is simply ignored, which is the worst kind of wrong
    // because the page still renders.
    if (type === 'duration') return `${value}ms`
    return String(value)
  }
  // An asset is a path in the library and a `url()` in a stylesheet; written
  // bare it silently does nothing wherever it is used.
  if (type === 'asset' && typeof value === 'string' && value.length > 0) {
    return /^url\(/i.test(value) ? value : `url("${value}")`
  }
  if (typeof value === 'string') return value
  if (type === 'shadow') {
    const s = value as Record<string, string | number>
    return `${px(s.x ?? 0)} ${px(s.y ?? 0)} ${px(s.blur ?? 0)} ${px(s.spread ?? 0)} ${s.color ?? 'transparent'}`
  }
  if (type === 'border') {
    const b = value as Record<string, string | number>
    return `${px(b.width ?? 1)} ${b.style ?? 'solid'} ${b.color ?? 'currentColor'}`
  }
  if (type === 'cubicBezier') {
    const c = value as Record<string, string | number>
    return `cubic-bezier(${c.x1 ?? 0}, ${c.y1 ?? 0}, ${c.x2 ?? 1}, ${c.y2 ?? 1})`
  }
  if (type === 'typography') {
    const t = value as Record<string, string | number>
    return `${t.fontWeight ?? 400} ${px(t.fontSize ?? 16)}/${t.lineHeight ?? 1.5} ${t.fontFamily ?? 'sans-serif'}`
  }
  return JSON.stringify(value)
}

function px(v: string | number): string {
  return typeof v === 'number' ? `${v}px` : v
}

/** Sorted, so two exports of the same studio are the same bytes. */
function sortedPaths(studio: TokenStudio, themeId: string | null): string[] {
  return [...resolveAll(studio, themeId).keys()].sort()
}

/**
 * The library as something a person, or a model, can read straight through.
 *
 * `tokens.json` is for other tools and `tokens.css` is for the browser; both
 * are lists of values with no argument in them about which name to reach for.
 * That argument is the whole point of a shared library, so it gets its own
 * file: names grouped the way the screen groups them, each with the value it
 * currently resolves to and the variable to write.
 *
 * Primitives are left out. They are the shelf the semantics are built from,
 * and a page that reaches past `--text-primary` for `--neutral-900` has
 * stopped using the library and started copying from it. Naming them here
 * would be an invitation to do exactly that.
 *
 * Sorted and free of dates, like the other two, so a re-export of an unchanged
 * library is a no-op in a diff.
 */
export function toMarkdown(studio: TokenStudio, themeId: string | null): string {
  const theme = studio.themes.find((t) => t.id === themeId) ?? null
  const all = resolveAll(studio, themeId)
  const rows = new Map<SectionId, string[]>()

  for (const path of sortedPaths(studio, themeId)) {
    const hit = all.get(path)
    if (!hit || !exported(theme, hit.setId)) continue
    if (hit.token.tier === 'primitive') continue
    const section = sectionOf(hit.token)
    const line = `| \`--${cssName(path)}\` | ${escapeCell(cssValue(hit.token.type, hit.value))} | ${
      escapeCell(hit.token.description ?? '')
    } |`
    const list = rows.get(section)
    if (list) list.push(line)
    else rows.set(section, [line])
  }

  const name = studio.name || 'Library'
  const themeName = theme?.name ?? 'no theme'
  const out: string[] = [
    `# ${name} \u2014 ${themeName}`,
    '',
    'The shared library for this project. Use these custom properties; do not write',
    'a raw colour, size or duration. If what you need is not here, take the closest',
    'name rather than inventing a value.',
    '',
    '`tokens.css` defines every property below. Link it, then reference them.',
    ''
  ]
  for (const section of SECTIONS) {
    const list = rows.get(section.id)
    if (!list || list.length === 0) continue
    out.push(`## ${section.label}`, '', '| Variable | Value | Use for |', '| --- | --- | --- |', ...list, '')
  }
  return `${out.join('\n')}`
}

/** A pipe inside a cell would end the cell, and a newline would end the row. */
function escapeCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim()
}

/**
 * The library as a paragraph to put in front of a model.
 *
 * The digest above is a table, which is the right shape for a file and the
 * wrong shape for a prompt: a model reading a hundred rows of markdown spends
 * its attention on the pipes. This is the same content as prose, capped, and
 * only the names anyone should be typing.
 *
 * Empty string when there is nothing to say, so the caller can drop it into a
 * prefix without checking.
 */
export function formatTokensForPrompt(studio: TokenStudio, themeId: string | null): string {
  const theme = studio.themes.find((t) => t.id === themeId) ?? null
  const all = resolveAll(studio, themeId)
  const groups = new Map<SectionId, string[]>()
  for (const path of sortedPaths(studio, themeId)) {
    const hit = all.get(path)
    if (!hit || !exported(theme, hit.setId)) continue
    if (hit.token.tier === 'primitive') continue
    const section = sectionOf(hit.token)
    const entry = `--${cssName(path)} (${cssValue(hit.token.type, hit.value)})`
    const list = groups.get(section)
    if (list) list.push(entry)
    else groups.set(section, [entry])
  }
  if (groups.size === 0) return ''

  const lines = [
    `Design tokens \u2014 ${studio.name || 'the shared library'}${theme ? `, ${theme.name}` : ''}.`,
    'Use only these, as CSS custom properties from tokens.css. Never write a raw',
    'hex, rgb, px size, radius or duration in the markup or the stylesheet. If a',
    'value you want is missing, use the nearest token rather than inventing one.'
  ]
  for (const section of SECTIONS) {
    const list = groups.get(section.id)
    if (!list || list.length === 0) continue
    lines.push(`${section.label}: ${list.join(', ')}`)
  }
  return lines.join('\n')
}
