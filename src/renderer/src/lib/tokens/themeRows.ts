// What the Theme tab shows, worked out away from the screen.
//
// The rows are the tokens a design can actually reach for, so raw values are
// left out: a file binding to `neutral/900` has reached past the library into
// its workings.

import type { Tier, Token, TokenStudio, TokenType, TokenValue } from '../../../../shared/tokens/types'
import { resolveAll } from '../../../../shared/tokens/resolve'

export type ThemeRow = {
  path: string
  name: string
  group: string
  type: TokenType
  tier: Tier
  value: string
  /** Set when the value can be shown as a colour. */
  swatch: string | null
  setId: string
}

function display(value: TokenValue): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return Object.entries(value).map(([k, v]) => `${k} ${v}`).join(', ')
}

/** The last segment of a path, which is what a token is called. */
function leaf(path: string): string {
  const at = path.lastIndexOf('.')
  return at < 0 ? path : path.slice(at + 1)
}

/** The first segment, which is what it sorts under. */
function head(path: string): string {
  const at = path.indexOf('.')
  return at < 0 ? path : path.slice(0, at)
}

export function themeRows(studio: TokenStudio | null, themeId: string | null, query = ''): ThemeRow[] {
  if (!studio) return []
  const q = query.trim().toLowerCase()
  const rows: ThemeRow[] = []
  for (const [path, hit] of resolveAll(studio, themeId)) {
    if (hit.token.tier === 'primitive') continue
    if (q && !path.toLowerCase().includes(q)) continue
    const value = display(hit.value)
    rows.push({
      path,
      name: leaf(path),
      group: head(path),
      type: hit.token.type,
      tier: hit.token.tier,
      value,
      swatch: hit.token.type === 'color' && typeof hit.value === 'string' ? hit.value : null,
      setId: hit.setId
    })
  }
  return rows.sort((a, b) => a.path.localeCompare(b.path))
}

/** Rows under their first path segment, in the order the rows came in. */
export function groupRows(rows: ThemeRow[]): { group: string; rows: ThemeRow[] }[] {
  const out: { group: string; rows: ThemeRow[] }[] = []
  for (const row of rows) {
    const last = out[out.length - 1]
    if (last && last.group === row.group) last.rows.push(row)
    else out.push({ group: row.group, rows: [row] })
  }
  return out
}

/** What the Create token menu offers, in the order it offers it. */
export type TokenKind = {
  label: string
  type: TokenType
  tier: Token['tier']
  /** Where a new one of these lands. */
  path: string
  /** Rows are separated from the group before them. */
  sep?: boolean
}

export const CREATE_TOKEN_KINDS: TokenKind[] = [
  { label: 'Color', type: 'color', tier: 'semantic', path: 'color.new' },
  { label: 'Radius', type: 'dimension', tier: 'semantic', path: 'radius.new' },
  { label: 'Spacing', type: 'dimension', tier: 'semantic', path: 'spacing.new', sep: true },
  { label: 'Container', type: 'dimension', tier: 'semantic', path: 'container.new' },
  { label: 'Breakpoint', type: 'dimension', tier: 'semantic', path: 'breakpoint.new' },
  { label: 'Font family', type: 'fontFamily', tier: 'semantic', path: 'font.family.new', sep: true },
  { label: 'Font weight', type: 'fontWeight', tier: 'semantic', path: 'font.weight.new' },
  { label: 'Font size', type: 'fontSize', tier: 'semantic', path: 'font.size.new' },
  { label: 'Line height', type: 'lineHeight', tier: 'semantic', path: 'font.lineHeight.new' },
  { label: 'Letter spacing', type: 'letterSpacing', tier: 'semantic', path: 'font.letterSpacing.new' }
]
