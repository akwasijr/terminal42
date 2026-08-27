// What a token studio is made of.
//
// A token is a named value with a type. Its name is a dot path, because the
// path is the only structure there is: `colour.action.rest` is not a colour
// inside an action inside a colour, it is one token that happens to sort next
// to its siblings. Folders would be a second structure to keep in step with
// the first.
//
// Tokens live in sets, sets stack, and a theme says which sets are stacked.
// Later sets win, so a "dark" set that names only what changes is a complete
// dark theme. This is the whole idea, and it is borrowed wholesale from
// Tokens Studio because it is right.
//
// Three tiers, and the rule that makes them worth having: a primitive holds a
// value, a semantic points at a primitive, a component points at a semantic.
// A semantic token holding a literal is a hard-coded value wearing a name.

/** The kinds of value a token can hold. Named as the DTCG draft names them. */
export const TOKEN_TYPES = [
  'color',
  'dimension',
  'fontFamily',
  'fontWeight',
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'number',
  'duration',
  'cubicBezier',
  'shadow',
  'border',
  'typography',
  'opacity',
  // The rest are what Tokens Studio writes and the draft does not name. They
  // earn their place because there is no honest way to hold them otherwise: a
  // label, a flag, an image, a gradient and the two typographic switches are
  // all things teams do decide once and share, and forcing them into `number`
  // or `color` would be a lie told in the data.
  'text',
  'boolean',
  'asset',
  'textCase',
  'textDecoration',
  'gradient'
] as const

export type TokenType = (typeof TOKEN_TYPES)[number]

/** The three tiers, coarsest first. */
export const TIERS = ['primitive', 'semantic', 'component'] as const
export type Tier = (typeof TIERS)[number]

/**
 * A token's value.
 *
 * A string beginning `{` and ending `}` names another token, e.g.
 * `{colour.blue.500}`. Everything else is a literal. Composite types like
 * shadow and typography hold an object whose fields may themselves be
 * aliases, which is how "the shadow, but in dark" stays one token.
 */
export type TokenValue = string | number | Record<string, string | number>

/**
 * A token that still works but should stop being reached for.
 *
 * Deleting it would break every design that already names it, so the honest
 * move is to leave it standing and say so. The message is the whole point:
 * "don't use this" without "use that instead" is a dead end.
 */
export type Deprecation = {
  severity: 'warning' | 'error'
  message?: string
}

export type Token = {
  id: string
  /** Dot path. The path is the name. */
  path: string
  type: TokenType
  value: TokenValue
  description?: string
  tier: Tier
  deprecated?: Deprecation
  /**
   * Anything another tool hung on this token. Carried in and back out
   * untouched, because a field we do not understand is still somebody's
   * Figma mapping and dropping it on a round trip loses their work.
   */
  extensions?: Record<string, unknown>
}

export type TokenSet = {
  id: string
  name: string
  /** Where in the stack this set sits. Later wins. */
  order: number
  tokens: Token[]
}

/**
 * How a theme treats one set.
 *
 * `source` is Tokens Studio's distinction and it earns its keep: a set of raw
 * palette values should be resolvable by everything without being exported to
 * the codebase, because nobody wants `blue-500` in their stylesheet.
 */
export type SetState = 'off' | 'source' | 'enabled'

export type Theme = {
  id: string
  name: string
  sets: Record<string, SetState>
}

/**
 * How hard a library leans on a design that is bound to it.
 *
 * There is no way to constrain what a language model emits, so "enforce"
 * cannot mean guarantee. It means three escalating amounts of insistence, and
 * a team picks which one it wants:
 *
 * - `advise`  — the names go into the prompt and that is all. The model is
 *               told, and usually complies.
 * - `check`   — after generating, the linter runs and what came out off-library
 *               is counted and named on the design. It still saves.
 * - `block`   — the same check, but the design is not left alone with it: a
 *               follow-up turn is sent asking for the off-library values to be
 *               replaced with the tokens they should have been.
 */
export type Enforcement = 'advise' | 'check' | 'block'

export type TokenStudio = {
  id: string
  name: string
  sets: TokenSet[]
  themes: Theme[]
  activeTheme: string | null
  /**
   * Absent on a library made before the ladder existed, which is read as
   * `block` — that is what the app already did to every bound design, and
   * quietly relaxing it while nobody was looking would be a worse surprise
   * than the setting appearing already switched on. New libraries start at
   * `advise`, which is where a team should be asked to opt up from.
   */
  enforcement?: Enforcement
}

const ALIAS = /^\{([^{}]+)\}$/

/** The path an alias names, or null if the value is a literal. */
export function aliasTarget(value: TokenValue): string | null {
  if (typeof value !== 'string') return null
  const m = ALIAS.exec(value.trim())
  return m ? m[1].trim() : null
}

export function isAlias(value: TokenValue): boolean {
  return aliasTarget(value) !== null
}

export function emptyStudio(name: string): TokenStudio {
  const setId = `s${Math.random().toString(36).slice(2, 9)}`
  const themeId = `t${Math.random().toString(36).slice(2, 9)}`
  return {
    id: `ts${Math.random().toString(36).slice(2, 9)}`,
    name,
    sets: [{ id: setId, name: 'Core', order: 0, tokens: [] }],
    themes: [{ id: themeId, name: 'Default', sets: { [setId]: 'enabled' } }],
    activeTheme: themeId,
    enforcement: 'advise'
  }
}

/** What a library asks of its designs, defaulting the way an old one behaved. */
export function enforcementOf(studio: Pick<TokenStudio, 'enforcement'> | null | undefined): Enforcement {
  const e = studio?.enforcement
  return e === 'advise' || e === 'check' || e === 'block' ? e : 'block'
}

/**
 * The theme a caller asked for, or the library's own if that one has gone.
 *
 * A design remembers which theme it was bound to by id, and a library can be
 * regenerated underneath it — the AI rebuilding one hands back new sets and
 * new themes. Resolving against an id that no longer exists switches every set
 * off, so the design would silently be prompted, linted and exported against
 * an empty library rather than told that its theme had gone.
 */
export function themeIdFor(studio: TokenStudio, wanted: string | null | undefined): string | null {
  if (wanted && studio.themes.some((t) => t.id === wanted)) return wanted
  return studio.activeTheme
}

/**
 * Fill in anything a stored studio is missing.
 *
 * A studio is written to the database as one JSON blob, so an old row can
 * arrive without a field a later build expects. Opening it must never throw:
 * a studio that loses a malformed token is worth more than one that will not
 * open at all.
 */
export function hydrateStudio(raw: unknown): TokenStudio {
  const r = (raw ?? {}) as Partial<TokenStudio>
  const sets: TokenSet[] = Array.isArray(r.sets)
    ? r.sets.map((s, i) => ({
        id: String((s as TokenSet)?.id ?? `s${i}`),
        name: String((s as TokenSet)?.name ?? `Set ${i + 1}`),
        order: Number.isFinite((s as TokenSet)?.order) ? Number((s as TokenSet).order) : i,
        tokens: Array.isArray((s as TokenSet)?.tokens)
          ? (s as TokenSet).tokens.filter(isToken)
          : []
      }))
    : []
  const themes: Theme[] = Array.isArray(r.themes)
    ? r.themes.map((t, i) => ({
        id: String((t as Theme)?.id ?? `t${i}`),
        name: String((t as Theme)?.name ?? `Theme ${i + 1}`),
        sets: normaliseSetStates((t as Theme)?.sets)
      }))
    : []
  const activeTheme =
    typeof r.activeTheme === 'string' && themes.some((t) => t.id === r.activeTheme)
      ? r.activeTheme
      : (themes[0]?.id ?? null)
  const blank = emptyStudio(typeof r.name === 'string' ? r.name : 'Tokens')
  // A studio with real sets and no theme cannot borrow the blank one. The blank
  // theme switches on the blank set, which is not one of these, so every real
  // set would resolve to off and the library would open, export and prompt with
  // nothing in it — while still showing its sets in the sidebar. A theme made
  // here has to name the sets that are actually present.
  const filled: Theme[] =
    themes.length > 0
      ? themes
      : sets.length > 0
        ? [{
            id: blank.themes[0].id,
            name: blank.themes[0].name,
            sets: Object.fromEntries(sets.map((s) => [s.id, 'enabled' as SetState]))
          }]
        : blank.themes
  return {
    id: typeof r.id === 'string' ? r.id : blank.id,
    name: typeof r.name === 'string' ? r.name : blank.name,
    sets: sets.length > 0 ? sets : blank.sets,
    themes: filled,
    activeTheme: themes.length > 0 ? activeTheme : filled[0].id,
    enforcement: enforcementOf(r)
  }
}

function normaliseSetStates(raw: unknown): Record<string, SetState> {
  const out: Record<string, SetState> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    out[k] = v === 'enabled' || v === 'source' ? v : 'off'
  }
  return out
}

function isToken(t: unknown): t is Token {
  const c = t as Token
  return (
    !!c &&
    typeof c.id === 'string' &&
    typeof c.path === 'string' &&
    c.path.length > 0 &&
    (TOKEN_TYPES as readonly string[]).includes(c.type) &&
    (TIERS as readonly string[]).includes(c.tier) &&
    (typeof c.value === 'string' || typeof c.value === 'number' || (!!c.value && typeof c.value === 'object'))
  )
}
