/**
 * What a library is missing, and why it will hurt.
 *
 * A library screen can only show what is in it, which means the one thing it
 * never shows is the gap. Somebody builds thirty colours, sees thirty
 * swatches, and concludes they are done — and then a month later there is no
 * focus ring, so every focus ring in the product is whatever blue the person
 * writing that screen happened to like. The absence never announced itself.
 *
 * These checks are the announcement. Each one names a thing a mature library
 * has, says in a sentence what breaks without it, and can be answered by
 * looking at the tokens rather than by asking anybody. They come from the
 * IBM Carbon elements documentation (docs/research/carbon-elements.md), which
 * is the most complete public account of what a design library actually needs
 * to hold, minus the parts that are only true of IBM.
 *
 * A check is deliberately loose about naming. It asks "is there a focus
 * colour", not "is there `colour.focus.ring`", because a library imported
 * from somewhere else will have its own names and a checklist that only
 * recognised ours would report every one of them as empty.
 */

import type { Token, TokenStudio } from './types'
import type { SectionId } from './groups'
import { resolveAll } from './resolve'

export type Check = {
  id: string
  /** What is missing, named as the thing rather than as its absence. */
  label: string
  /** One sentence: what goes wrong in the product without it. */
  why: string
  section: SectionId
  /** How many tokens have to answer before the check is met. */
  need: number
  holds: (token: Token) => boolean
}

export type Coverage = {
  check: Check
  found: string[]
  met: boolean
}

/** Does any segment of the path equal one of these words. */
function says(token: Token, ...words: string[]): boolean {
  const parts = token.path.toLowerCase().split('.')
  return words.some((w) => parts.includes(w))
}

const colour = (t: Token): boolean => t.type === 'color'

export const CHECKS: Check[] = [
  {
    id: 'layers',
    label: 'A layer for each depth',
    why: 'Without layers a card inside a panel inside a page is one colour three times, and the nesting a person is meant to read simply is not there.',
    section: 'colour',
    need: 2,
    holds: (t) => colour(t) && says(t, 'layer')
  },
  {
    id: 'field',
    label: 'A field colour of its own',
    why: 'An input has to stay legible as somewhere you can type on whichever surface it lands on; borrowing the surface colour makes it vanish on half of them.',
    section: 'colour',
    need: 1,
    holds: (t) => colour(t) && says(t, 'field', 'input')
  },
  {
    id: 'focus',
    label: 'A focus ring',
    why: 'Keyboard focus is the one state that cannot be left to each screen to invent, because an invisible focus ring makes the product unusable without a mouse.',
    section: 'colour',
    need: 1,
    holds: (t) => colour(t) && says(t, 'focus')
  },
  {
    id: 'focusInset',
    label: 'A focus inset',
    why: 'A ring drawn on a surface its own colour disappears; the inset is the hairline that keeps it visible everywhere.',
    section: 'colour',
    need: 1,
    holds: (t) => colour(t) && (says(t, 'inset') || /focus\.(inset|inverse)/i.test(t.path))
  },
  {
    id: 'icon',
    label: 'Icon colours',
    why: 'An icon at 16px reads lighter than text at 16px, so icons that reuse the text colours come out faint everywhere.',
    section: 'colour',
    need: 2,
    holds: (t) => colour(t) && says(t, 'icon')
  },
  {
    id: 'link',
    label: 'Link colours, including visited',
    why: 'A link with no visited colour tells a reader nothing about where they have already been.',
    section: 'colour',
    need: 2,
    holds: (t) => colour(t) && says(t, 'link')
  },
  {
    id: 'inverse',
    label: 'An inverse surface',
    why: 'A tooltip or a toast is meant to read as being on top of the page rather than in it, which only works if there is a deliberate opposite to sit on.',
    section: 'colour',
    need: 2,
    holds: (t) => colour(t) && says(t, 'inverse')
  },
  {
    id: 'skeleton',
    label: 'Skeleton colours',
    why: 'Loading states get invented per screen otherwise, and the product flickers through three different greys on its way to the same page.',
    section: 'colour',
    need: 1,
    holds: (t) => colour(t) && says(t, 'skeleton', 'placeholder')
  },
  {
    id: 'states',
    label: 'Hover and active colours',
    why: 'If the library stops at the resting colour, every interactive state in the product is somebody darkening a hex by eye.',
    section: 'colour',
    need: 2,
    holds: (t) => colour(t) && says(t, 'hover', 'active', 'pressed', 'selected')
  },
  {
    id: 'disabled',
    label: 'A disabled colour',
    why: 'Disabled is the one state allowed to fail contrast, so it has to be chosen once on purpose rather than approximated with opacity.',
    section: 'colour',
    need: 1,
    holds: (t) => colour(t) && says(t, 'disabled')
  },
  {
    id: 'status',
    label: 'Colours for success, warning and error',
    why: 'Status colours invented at the call site are how one product ends up with three different reds.',
    section: 'colour',
    need: 3,
    holds: (t) => colour(t) && says(t, 'success', 'warning', 'danger', 'error', 'info')
  },
  {
    id: 'typeStyles',
    label: 'Whole type styles, not loose numbers',
    why: 'A size and a weight in separate tokens is six numbers to reassemble in your head; a style is one thing to point at.',
    section: 'type',
    need: 4,
    holds: (t) => t.type === 'typography'
  },
  {
    id: 'typeCompact',
    label: 'A compact body style',
    why: 'Prose wants air between lines and a label inside a control wants none; one body style asked to do both makes tall buttons and tight paragraphs.',
    section: 'type',
    need: 1,
    holds: (t) => t.type === 'typography' && says(t, 'compact', 'bodycompact', 'dense')
  },
  {
    id: 'tracking',
    label: 'Letter spacing',
    why: 'Small text needs slightly more tracking and large text slightly less; a library without it renders both very slightly wrong forever.',
    section: 'type',
    need: 1,
    holds: (t) => t.type === 'letterSpacing'
  },
  {
    id: 'mono',
    label: 'A monospace family',
    why: 'Code, numbers in a table and anything meant to line up need a family that does; without one they get the body font and jitter.',
    section: 'type',
    need: 1,
    holds: (t) => t.type === 'fontFamily' && says(t, 'mono', 'code')
  },
  {
    id: 'spacing',
    label: 'A spacing scale worth the name',
    why: 'Fewer than about eight steps and people start writing numbers that are not in the scale, which is the end of the scale.',
    section: 'space',
    need: 8,
    holds: (t) => t.type === 'dimension' && says(t, 'space', 'spacing', 'gap', 'pad', 'padding')
  },
  {
    id: 'layout',
    label: 'A layout scale for space between sections',
    why: 'Space between sections is not space inside a card, and one scale asked to do both either cramps the page or bloats the card.',
    section: 'space',
    need: 3,
    holds: (t) => t.type === 'dimension' && says(t, 'layout', 'section', 'stack')
  },
  {
    id: 'radius',
    label: 'A corner scale',
    why: 'Corners chosen per component are the fastest way to make a product look like it was built by four people who never met.',
    section: 'shape',
    need: 3,
    holds: (t) => t.type === 'dimension' && says(t, 'radius', 'corner')
  },
  {
    id: 'stroke',
    label: 'Border widths',
    why: 'A hairline and a focus ring are different thicknesses, and both get typed as 1px and 2px by hand until they are tokens.',
    section: 'shape',
    need: 2,
    holds: (t) => t.type === 'dimension' && says(t, 'stroke', 'border')
  },
  {
    id: 'elevation',
    label: 'An elevation scale',
    why: 'Shadow is how the product says what is on top of what; three ad hoc shadows say it three different ways.',
    section: 'elevation',
    need: 3,
    holds: (t) => t.type === 'shadow'
  },
  {
    id: 'durations',
    label: 'Durations across the range',
    why: 'A button acknowledging a press and a panel arriving are not the same length, and a scale with three steps gives both the middle one.',
    section: 'motion',
    need: 5,
    holds: (t) => t.type === 'duration'
  },
  {
    id: 'easings',
    label: 'Entrance, exit and standard curves',
    why: 'Something arriving, something leaving and something moving in place need different curves; one ease-in-out cannot tell them apart.',
    section: 'motion',
    need: 3,
    holds: (t) => t.type === 'cubicBezier'
  },
  {
    id: 'expressive',
    label: 'An expressive set of curves',
    why: 'Reserving a slower, more visible curve for the few moments that matter is what stops every transition competing for attention.',
    section: 'motion',
    need: 2,
    holds: (t) => t.type === 'cubicBezier' && says(t, 'expressive', 'emphasised', 'emphasized')
  },
  {
    id: 'breakpoints',
    label: 'Breakpoints',
    why: 'Breakpoints written into each stylesheet by hand are how one product comes to change shape at four different widths.',
    section: 'grid',
    need: 3,
    holds: (t) => says(t, 'breakpoint', 'screen')
  },
  {
    id: 'gutters',
    label: 'Columns and gutters',
    why: 'Without them the grid lives in whoever last built a page, and nothing lines up between two screens built a week apart.',
    section: 'grid',
    need: 2,
    holds: (t) => says(t, 'column', 'columns', 'gutter', 'grid')
  }
]

/**
 * Every check answered against a library.
 *
 * Resolved rather than raw, so a token that only exists as an alias into a
 * set that is switched off does not count as coverage somebody has.
 */
export function coverageOf(studio: TokenStudio, themeId: string | null): Coverage[] {
  const tokens = [...resolveAll(studio, themeId)].map(([, hit]) => hit.token)
  return CHECKS.map((check) => {
    const found = tokens.filter((t) => check.holds(t)).map((t) => t.path).sort()
    return { check, found, met: found.length >= check.need }
  })
}

/** How much of the checklist a library answers, as a fraction and a count. */
export function coverageScore(rows: Coverage[]): { met: number; total: number; percent: number } {
  const met = rows.filter((r) => r.met).length
  const total = rows.length
  return { met, total, percent: total === 0 ? 100 : Math.round((met / total) * 100) }
}

/** The gaps, worst section first, for a screen that has to lead with something. */
export function gapsBySection(rows: Coverage[]): Array<{ section: SectionId; missing: Coverage[] }> {
  const by = new Map<SectionId, Coverage[]>()
  for (const row of rows) {
    if (row.met) continue
    const list = by.get(row.check.section) ?? []
    list.push(row)
    by.set(row.check.section, list)
  }
  return [...by.entries()]
    .map(([section, missing]) => ({ section, missing }))
    .sort((a, b) => b.missing.length - a.missing.length)
}
