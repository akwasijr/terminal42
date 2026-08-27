// Putting tokens where a person would look for them.
//
// A token has two axes that compete: what kind of thing it is (a colour, a
// size, a curve) and how abstract it is (primitive, semantic, component). The
// old screen chose neither and sorted the lot alphabetically, so a badge's
// corner radius sat next to a font family because "ba" comes before "fo".
//
// Category leads here, and tier is a lens over it. Nobody arrives at a design
// library thinking "show me the semantic tier"; they arrive thinking "I need
// a colour" or "what is our body font". Category is the noun, tier is only
// how abstract a version of that noun you want.
//
// Within a category, tokens gather into families by their path: every
// `palette.brand.*` is one family, and one family is drawn once rather than
// eleven times, which is what stops a ramp from eating the screen.

import type { Token, TokenType } from './types'

export const SECTIONS = [
  { id: 'colour', label: 'Colour' },
  { id: 'type', label: 'Type' },
  { id: 'space', label: 'Space' },
  { id: 'shape', label: 'Shape' },
  { id: 'elevation', label: 'Elevation' },
  { id: 'motion', label: 'Motion' },
  { id: 'grid', label: 'Grid' },
  { id: 'other', label: 'Other' }
] as const

export type SectionId = (typeof SECTIONS)[number]['id']

const BY_TYPE: Partial<Record<TokenType, SectionId>> = {
  color: 'colour',
  fontFamily: 'type',
  fontSize: 'type',
  fontWeight: 'type',
  lineHeight: 'type',
  letterSpacing: 'type',
  typography: 'type',
  shadow: 'elevation',
  duration: 'motion',
  cubicBezier: 'motion',
  textCase: 'type',
  textDecoration: 'type',
  gradient: 'colour',
  text: 'other',
  boolean: 'other',
  asset: 'other'
}

/** Dimensions that are about an edge rather than a distance between things. */
const SHAPE_STEMS = ['radius', 'corner', 'stroke', 'border']

/**
 * Dimensions that describe the page rather than anything on it.
 *
 * A breakpoint and a gutter are both numbers in pixels, and filed under Space
 * they sit among the paddings and read as one more gap somebody could reach
 * for. They are not: nothing is ever `padding: 672px`. They belong to the
 * grid, and the grid is a topic of its own.
 */
const GRID_STEMS = ['breakpoint', 'grid', 'column', 'gutter']

/**
 * Which section a token belongs in.
 *
 * Type decides it wherever type is enough. It is not enough for `dimension`,
 * which covers a gap, a corner and a border width alike, so for those the
 * first segment of the path breaks the tie: that segment is the only place
 * the author said what the number was for.
 */
export function sectionOf(token: Pick<Token, 'path' | 'type'>): SectionId {
  const byType = BY_TYPE[token.type]
  if (byType) return byType
  if (token.type === 'dimension') {
    // Both ends of the path are asked, because a primitive says what it is
    // first (`radius.lg`) and a component token says it last
    // (`badge.radius`). Checking only the stem filed every component's corner
    // under Space, which is exactly the muddle this is meant to end.
    const parts = token.path.split('.')
    const said = [parts[0], parts[parts.length - 1]]
    if (said.some((w) => GRID_STEMS.includes(w))) return 'grid'
    return said.some((w) => SHAPE_STEMS.includes(w)) ? 'shape' : 'space'
  }
  if (token.type === 'number') {
    // A column count is a number rather than a dimension, and it belongs
    // beside the widths it divides.
    const parts = token.path.split('.')
    if ([parts[0], parts[parts.length - 1]].some((w) => GRID_STEMS.includes(w))) return 'grid'
  }
  return 'other'
}

/** Everything but the last segment: the tokens that belong together. */
export function familyOf(path: string): string {
  const parts = path.split('.')
  return parts.length > 1 ? parts.slice(0, -1).join('.') : path
}

/** The last segment: what tells one member of a family from another. */
export function leafOf(path: string): string {
  const parts = path.split('.')
  return parts[parts.length - 1]
}

export type Family = {
  /** The shared path stem, e.g. `palette.brand`. */
  id: string
  /** What to call it on screen. */
  label: string
  /** Sorted so a ramp reads 50 to 950 rather than 100, 1000, 200. */
  paths: string[]
  /** True when every member is a colour named by a number: draw it as a ramp. */
  ramp: boolean
}

/**
 * The families of one section, in the order they should be read.
 *
 * Primitives sink to the bottom within a section, because the raw shelf is
 * the thing you go looking for, not the thing you arrive at.
 */
export function familiesOf(
  tokens: Array<Pick<Token, 'path' | 'type' | 'tier'>>
): Family[] {
  const groups = new Map<string, Array<Pick<Token, 'path' | 'type' | 'tier'>>>()
  for (const t of tokens) {
    const id = familyOf(t.path)
    const list = groups.get(id)
    if (list) list.push(t)
    else groups.set(id, [t])
  }

  const out: Family[] = []
  for (const [id, members] of groups) {
    const ramp =
      members.length > 2 &&
      members.every((m) => m.type === 'color' && /^\d+$/.test(leafOf(m.path)))
    out.push({
      id,
      label: label(id),
      ramp,
      paths: members.map((m) => m.path).sort((a, b) => {
        if (ramp) return Number(leafOf(a)) - Number(leafOf(b))
        const ra = LEAF_ORDER.indexOf(leafOf(a))
        const rb = LEAF_ORDER.indexOf(leafOf(b))
        if (ra !== rb) return (ra === -1 ? 999 : ra) - (rb === -1 ? 999 : rb)
        return a.localeCompare(b)
      })
    })
  }

  const tierRank = (f: Family): number => {
    const tier = tokens.find((t) => familyOf(t.path) === f.id)?.tier
    return tier === 'component' ? 1 : tier === 'primitive' ? 2 : 0
  }
  const nameRank = (f: Family): number => {
    const i = ORDER.indexOf(leafOf(f.id))
    return i === -1 ? ORDER.length : i
  }
  // A section's own tokens go first, before any named family inside it.
  // Their family repeats the section's title, so the screen draws them
  // without a heading; sitting after `Brand`, a headless row reads as more
  // Brand. Sitting at the top, it reads as what the section is.
  const bareRank = (f: Family): number => (f.id.includes('.') ? 1 : 0)
  return out.sort(
    (a, b) =>
      tierRank(a) - tierRank(b)
      || bareRank(a) - bareRank(b)
      || nameRank(a) - nameRank(b)
      || a.id.localeCompare(b.id)
  )
}

/**
 * The order families are read in, where there is an obvious one.
 *
 * Alphabetical put Accent above Bg above Border above Brand, which is four
 * unrelated things in a row chosen by their first letter. A person looking at
 * a colour library wants the surfaces, then the text on them, then the edges,
 * then the brand, and the statuses together at the end. Anything not named
 * here keeps its alphabetical place after these.
 */
const ORDER = [
  'bg',
  'text',
  'border',
  'brand',
  'accent',
  'success',
  'warning',
  'danger',
  'info',
  'neutral',
  'white',
  'black',
  'type',
  'family',
  'size',
  'weight',
  'leading',
  'tracking',
  'gap',
  'pad',
  'space',
  'corner',
  'radius',
  'stroke',
  'lift',
  'shade',
  'motion',
  'time',
  'ease'
]

/** `palette.brand` reads as "Brand"; a one-segment path reads as itself. */
function label(id: string): string {
  const last = leafOf(id)
  const spaced = last.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * The order the members of a family are read in.
 *
 * A type scale sorted alphabetically runs body, bodyStrong, caption, code,
 * display, which is not a scale at all: it is five names in dictionary order.
 * The same is true of a size ramp (2xl before md before xs) and of the states
 * of a colour (active before hover before rest). Wherever the names carry an
 * obvious sequence, that sequence wins; anything unrecognised keeps its
 * alphabetical place after them.
 */
const LEAF_ORDER = [
  // Type roles, largest first.
  'display', 'title', 'heading', 'subheading', 'body', 'bodyStrong', 'caption', 'code',
  // Sizes, smallest first.
  'none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', 'full',
  // Weights and leadings.
  'regular', 'medium', 'semibold', 'bold',
  'tight', 'snug', 'normal', 'relaxed', 'loose', 'wide',
  // Surfaces, deepest first.
  'canvas', 'surface', 'raised', 'sunken', 'overlay',
  // The states of one colour.
  'rest', 'hover', 'active', 'fill', 'subtle', 'strong', 'default', 'focus', 'on',
  // Text strengths.
  'primary', 'secondary', 'muted', 'disabled', 'link',
  // Durations and shapes.
  'instant', 'fast', 'slow', 'hairline', 'thick',
  'resting', 'enter', 'exit', 'move', 'standard', 'in', 'out', 'emphasized',
  'control', 'pill'
]
