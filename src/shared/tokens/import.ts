// Getting tokens in.
//
// Export existed from the first day and import did not, which made a library
// a place work goes to die: you could send tokens to a codebase but you could
// not bring a codebase's tokens back, and a team that already had tokens had
// no way in at all. This is the way in.
//
// Two dialects, one reader. The W3C draft nests objects and marks a leaf with
// `$value`; the Tokens Studio plugin file nests the same way but writes
// `value`/`type` without the dollar, and puts its sets at the top level with
// `$themes` and `$metadata` beside them. Both are recognised from the shape of
// the file rather than asked about, because a person with a JSON file should
// not have to know which tool wrote it.
//
// Nothing is rejected. A token with a type we do not have is carried in under
// the nearest type we do, and every such decision is reported, because an
// import that silently drops half a file is worse than one that says what it
// did. This follows Tokens Studio, which imports tokens with validation
// errors on purpose and lets you fix them afterwards.

import { emptyStudio } from './scaffold'
import { aliasTarget, TOKEN_TYPES, type Theme, type Token, type TokenSet, type TokenStudio, type TokenType, type TokenValue } from './types'

export type ImportResult = { studio: TokenStudio; notes: string[] }

/**
 * What each dialect's type names mean in ours.
 *
 * The left side is everything the Tokens Studio plugin and the older DTCG
 * drafts write. Where we have no type of our own the nearest one is used and
 * the caller is told; `dimension` swallows most of them because a spacing, a
 * radius and a size are all a length whatever a file calls them.
 */
const TYPE_ALIASES: Record<string, TokenType> = {
  colour: 'color',
  color: 'color',
  sizing: 'dimension',
  size: 'dimension',
  spacing: 'dimension',
  space: 'dimension',
  borderradius: 'dimension',
  borderwidth: 'dimension',
  paragraphspacing: 'dimension',
  paragraphindent: 'dimension',
  dimension: 'dimension',
  fontfamilies: 'fontFamily',
  fontfamily: 'fontFamily',
  fontweights: 'fontWeight',
  fontweight: 'fontWeight',
  fontsizes: 'fontSize',
  fontsize: 'fontSize',
  lineheights: 'lineHeight',
  lineheight: 'lineHeight',
  letterspacing: 'letterSpacing',
  boxshadow: 'shadow',
  shadow: 'shadow',
  border: 'border',
  typography: 'typography',
  opacity: 'opacity',
  duration: 'duration',
  transition: 'duration',
  cubicbezier: 'cubicBezier',
  number: 'number',
  other: 'text',
  text: 'text',
  string: 'text',
  boolean: 'boolean',
  asset: 'asset',
  textcase: 'textCase',
  textdecoration: 'textDecoration',
  gradient: 'gradient'
}

/** The types we carry in under a different name, so the note can say so. */
const NOT_OURS = new Set(['other', 'string', 'transition', 'sizing', 'spacing', 'borderradius', 'borderwidth', 'paragraphspacing', 'paragraphindent', 'boxshadow', 'fontfamilies', 'fontweights', 'fontsizes', 'lineheights', 'colour', 'size', 'space'])

type Leaf = {
  type: string | null
  value: TokenValue
  description?: string
  deprecated?: { severity: 'warning' | 'error'; message?: string }
  extensions?: Record<string, unknown>
}

/** Whether an object is a token rather than a group of tokens. */
function leafOf(node: Record<string, unknown>): Leaf | null {
  const has = (k: string): boolean => Object.prototype.hasOwnProperty.call(node, k)
  const value = has('$value') ? node.$value : has('value') ? node.value : undefined
  if (value === undefined) return null
  const rawType = has('$type') ? node.$type : has('type') ? node.type : null
  const desc = has('$description') ? node.$description : has('description') ? node.description : undefined
  const dep = has('$deprecated') ? node.$deprecated : has('deprecated') ? node.deprecated : undefined
  const ext = has('$extensions') ? node.$extensions : has('extensions') ? node.extensions : undefined
  return {
    type: typeof rawType === 'string' ? rawType : null,
    value: value as TokenValue,
    description: typeof desc === 'string' && desc.length > 0 ? desc : undefined,
    deprecated: deprecationOf(dep),
    extensions: typeof ext === 'object' && ext !== null ? (ext as Record<string, unknown>) : undefined
  }
}

/**
 * A deprecation, however the file spelled it.
 *
 * `true` is the short form some files use, and it means the same thing at the
 * lower severity; anything unreadable is dropped rather than guessed at.
 */
function deprecationOf(raw: unknown): { severity: 'warning' | 'error'; message?: string } | undefined {
  if (raw === true) return { severity: 'warning' }
  if (typeof raw !== 'object' || raw === null) return undefined
  const d = raw as Record<string, unknown>
  const message = typeof d.message === 'string' && d.message.length > 0 ? d.message : undefined
  return { severity: d.severity === 'error' ? 'error' : 'warning', ...(message ? { message } : {}) }
}

/** Our type for a file's type name, and whether the name was one of ours. */
function typeFor(name: string | null, value: TokenValue): { type: TokenType; exact: boolean } {
  if (name) {
    const key = name.toLowerCase()
    const hit = TYPE_ALIASES[key]
    if (hit) return { type: hit, exact: !NOT_OURS.has(key) && (TOKEN_TYPES as readonly string[]).includes(name) }
  }
  // Untyped files exist. Guess from the value rather than refuse the token.
  if (typeof value === 'string' && /^#|^rgb|^hsl/i.test(value.trim())) return { type: 'color', exact: false }
  if (typeof value === 'number') return { type: 'number', exact: false }
  if (typeof value === 'boolean') return { type: 'boolean', exact: false }
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value)
    if (keys.includes('fontSize') || keys.includes('fontFamily')) return { type: 'typography', exact: false }
    if (keys.includes('blur') || keys.includes('spread')) return { type: 'shadow', exact: false }
  }
  if (typeof value === 'string' && /gradient\(/i.test(value)) return { type: 'gradient', exact: false }
  return { type: typeof value === 'string' ? 'text' : 'number', exact: false }
}

/**
 * The tier a token lands in.
 *
 * A literal is a primitive by definition. An alias is at least a semantic, and
 * a component if what it points at is itself an alias — which is the tier rule
 * read backwards, and the closest an import can get without being told.
 */
function tierFor(value: TokenValue, aliasIsAlias: (path: string) => boolean): Token['tier'] {
  const target = aliasTarget(value)
  if (!target) return 'primitive'
  return aliasIsAlias(target) ? 'component' : 'semantic'
}

/** Every leaf under a node, keyed by dot path. */
function walk(node: unknown, prefix: string[], out: Map<string, Leaf>): void {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) return
  const rec = node as Record<string, unknown>
  const leaf = leafOf(rec)
  if (leaf) {
    if (prefix.length > 0) out.set(prefix.join('.'), leaf)
    return
  }
  for (const [k, v] of Object.entries(rec)) {
    if (k.startsWith('$')) continue
    walk(v, [...prefix, k], out)
  }
}

let seq = 0
function id(prefix: string): string {
  seq += 1
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}`
}

function tokensFrom(leaves: Map<string, Leaf>, notes: Set<string>): Token[] {
  const isAliasPath = (path: string): boolean => {
    const hit = leaves.get(path)
    return hit ? aliasTarget(hit.value) !== null : false
  }
  const out: Token[] = []
  for (const [path, leaf] of leaves) {
    const { type, exact } = typeFor(leaf.type, leaf.value)
    if (!exact && leaf.type) notes.add(`${leaf.type} came in as ${type}`)
    out.push({
      id: id('t'),
      path,
      type,
      value: leaf.value,
      tier: tierFor(leaf.value, isAliasPath),
      ...(leaf.description ? { description: leaf.description } : {}),
      ...(leaf.deprecated ? { deprecated: leaf.deprecated } : {}),
      ...(leaf.extensions ? { extensions: leaf.extensions } : {})
    })
  }
  return out.sort((a, b) => a.path.localeCompare(b.path))
}

/**
 * Whether the file is a Tokens Studio plugin export rather than one document.
 *
 * Only `$themes` or `$metadata` decide it. A plugin file always carries at
 * least one of them, and without one there is nothing to tell a file of sets
 * apart from a document whose top level happens to hold several groups —
 * guessing there cost every token its first path segment.
 */
function isPluginFile(doc: Record<string, unknown>): boolean {
  return '$themes' in doc || '$metadata' in doc
}

type PluginTheme = { id?: string; name?: string; selectedTokenSets?: Record<string, string> }

/**
 * A studio from a parsed JSON document.
 *
 * A single DTCG document becomes one set and one theme, because that is all
 * the file says; a plugin file keeps its sets, their order and its themes,
 * because it said all three.
 */
export function fromTokensJson(doc: unknown, name: string): ImportResult {
  const notes = new Set<string>()
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    return { studio: emptyStudio(name), notes: ['That file was not a token document.'] }
  }
  const rec = doc as Record<string, unknown>

  const sets: TokenSet[] = []
  if (isPluginFile(rec)) {
    const meta = (rec.$metadata ?? {}) as { tokenSetOrder?: string[] }
    const names = Object.keys(rec).filter((k) => !k.startsWith('$'))
    const order = (meta.tokenSetOrder ?? []).filter((n) => names.includes(n))
    const ordered = [...order, ...names.filter((n) => !order.includes(n))]
    ordered.forEach((setName, i) => {
      const leaves = new Map<string, Leaf>()
      walk(rec[setName], [], leaves)
      sets.push({ id: id('s'), name: setName, order: i, tokens: tokensFrom(leaves, notes) })
    })
  } else {
    const leaves = new Map<string, Leaf>()
    walk(rec, [], leaves)
    sets.push({ id: id('s'), name: 'Tokens', order: 0, tokens: tokensFrom(leaves, notes) })
  }

  const byName = new Map(sets.map((s) => [s.name, s.id]))
  const declared = Array.isArray(rec.$themes) ? (rec.$themes as PluginTheme[]) : []
  const themes: Theme[] = declared
    .map((t, i) => {
      const picked: Record<string, 'off' | 'source' | 'enabled'> = {}
      for (const s of sets) picked[s.id] = 'off'
      for (const [setName, state] of Object.entries(t.selectedTokenSets ?? {})) {
        const setId = byName.get(setName)
        if (setId) picked[setId] = state === 'source' ? 'source' : state === 'enabled' ? 'enabled' : 'off'
      }
      return { id: t.id ?? `theme-${i}`, name: t.name ?? `Theme ${i + 1}`, sets: picked }
    })
    .filter((t) => Object.values(t.sets).some((s) => s !== 'off'))

  if (themes.length === 0) {
    const all: Record<string, 'enabled'> = {}
    for (const s of sets) all[s.id] = 'enabled'
    themes.push({ id: 'default', name: 'Default', sets: all })
    if (declared.length > 0) notes.add('No theme named a set we could find, so everything is on in one theme.')
  }

  const count = sets.reduce((n, s) => n + s.tokens.length, 0)
  if (count === 0) notes.add('Nothing in that file looked like a token.')

  return {
    studio: {
      id: id('ts'),
      name,
      sets,
      themes,
      activeTheme: themes[0]?.id ?? null,
      // Imported tokens are somebody else's decisions until this team has read
      // them, so the library starts by advising rather than blocking.
      enforcement: 'advise'
    },
    notes: [...notes]
  }
}

/** Parse then import, so a bad file is a note rather than a thrown error. */
export function fromTokensText(text: string, name: string): ImportResult {
  try {
    return fromTokensJson(JSON.parse(text), name)
  } catch {
    return { studio: emptyStudio(name), notes: ['That file was not valid JSON.'] }
  }
}
