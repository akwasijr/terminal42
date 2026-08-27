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
import type { TokenStudio, TokenType, TokenValue } from './types'

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
  if (typeof value === 'number') return type === 'dimension' || type === 'fontSize' ? `${value}px` : String(value)
  if (typeof value === 'string') return value
  if (type === 'shadow') {
    const s = value as Record<string, string | number>
    return `${px(s.x ?? 0)} ${px(s.y ?? 0)} ${px(s.blur ?? 0)} ${px(s.spread ?? 0)} ${s.color ?? 'transparent'}`
  }
  if (type === 'border') {
    const b = value as Record<string, string | number>
    return `${px(b.width ?? 1)} ${b.style ?? 'solid'} ${b.color ?? 'currentColor'}`
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
