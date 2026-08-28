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
    why: 'Without layers, a card in a panel in a page is one colour three times.',
    section: 'colour',
    need: 2,
    holds: (t) => colour(t) && says(t, 'layer')
  },
  {
    id: 'field',
    label: 'A field colour of its own',
    why: 'A field has to stay legible on whichever surface it lands on.',
    section: 'colour',
    need: 1,
    holds: (t) => colour(t) && says(t, 'field', 'input')
  },
  {
    id: 'focus',
    label: 'A focus ring',
    why: 'An invisible focus ring makes the product unusable without a mouse.',
    section: 'colour',
    need: 1,
    holds: (t) => colour(t) && says(t, 'focus')
  },
  {
    id: 'focusInset',
    label: 'A focus inset',
    why: 'A ring the colour of its surface disappears; the inset keeps it visible.',
    section: 'colour',
    need: 1,
    holds: (t) => colour(t) && (says(t, 'inset') || /focus\.(inset|inverse)/i.test(t.path))
  },
  {
    id: 'icon',
    label: 'Icon colours',
    why: 'Icons read lighter than text, so text colours leave them faint.',
    section: 'colour',
    need: 2,
    holds: (t) => colour(t) && says(t, 'icon')
  },
  {
    id: 'link',
    label: 'Link colours, including visited',
    why: 'Without a visited colour, a reader cannot tell where they have been.',
    section: 'colour',
    need: 2,
    holds: (t) => colour(t) && says(t, 'link')
  },
  {
    id: 'inverse',
    label: 'An inverse surface',
    why: 'A toast should read as on top of the page rather than in it.',
    section: 'colour',
    need: 2,
    holds: (t) => colour(t) && says(t, 'inverse')
  },
  {
    id: 'skeleton',
    label: 'Skeleton colours',
    why: 'Otherwise every screen invents its own grey to load with.',
    section: 'colour',
    need: 1,
    holds: (t) => colour(t) && says(t, 'skeleton', 'placeholder')
  },
  {
    id: 'states',
    label: 'Hover and active colours',
    why: 'Without them, each interactive state is a hex somebody darkened by eye.',
    section: 'colour',
    need: 2,
    holds: (t) => colour(t) && says(t, 'hover', 'active', 'pressed', 'selected')
  },
  {
    id: 'disabled',
    label: 'A disabled colour',
    why: 'Disabled may fail contrast, so it has to be chosen once on purpose.',
    section: 'colour',
    need: 1,
    holds: (t) => colour(t) && says(t, 'disabled')
  },
  {
    id: 'status',
    label: 'Colours for success, warning and error',
    why: 'Invented per screen, this is how a product ends up with three reds.',
    section: 'colour',
    need: 3,
    holds: (t) => colour(t) && says(t, 'success', 'warning', 'danger', 'error', 'info')
  },
  {
    id: 'typeStyles',
    label: 'Whole type styles, not loose numbers',
    why: 'A style is one thing to point at; a size and a weight are six numbers.',
    section: 'type',
    need: 4,
    holds: (t) => t.type === 'typography'
  },
  {
    id: 'typeCompact',
    label: 'A compact body style',
    why: 'Prose wants air between lines; a label inside a control wants none.',
    section: 'type',
    need: 1,
    holds: (t) => t.type === 'typography' && says(t, 'compact', 'bodycompact', 'dense')
  },
  {
    id: 'tracking',
    label: 'Letter spacing',
    why: 'Small text needs a little more tracking, and large text a little less.',
    section: 'type',
    need: 1,
    holds: (t) => t.type === 'letterSpacing'
  },
  {
    id: 'mono',
    label: 'A monospace family',
    why: 'Code and numbers in a table need a family that lines them up.',
    section: 'type',
    need: 1,
    holds: (t) => t.type === 'fontFamily' && says(t, 'mono', 'code')
  },
  {
    id: 'spacing',
    label: 'A spacing scale worth the name',
    why: 'Under about eight steps, people start writing numbers off the scale.',
    section: 'space',
    need: 8,
    holds: (t) => t.type === 'dimension' && says(t, 'space', 'spacing', 'gap', 'pad', 'padding')
  },
  {
    id: 'layout',
    label: 'A scale for space between sections',
    why: 'Space between sections is not the same as space inside a card.',
    section: 'space',
    need: 3,
    holds: (t) => t.type === 'dimension' && says(t, 'layout', 'section', 'stack')
  },
  {
    id: 'radius',
    label: 'A corner scale',
    why: 'Corners chosen per component make a product look built by strangers.',
    section: 'shape',
    need: 3,
    holds: (t) => t.type === 'dimension' && says(t, 'radius', 'corner')
  },
  {
    id: 'stroke',
    label: 'Border widths',
    why: 'A hairline and a focus ring are not the same thickness.',
    section: 'shape',
    need: 2,
    holds: (t) => t.type === 'dimension' && says(t, 'stroke', 'border')
  },
  {
    id: 'elevation',
    label: 'An elevation scale',
    why: 'Shadow says what sits on top; ad hoc shadows say it three ways.',
    section: 'elevation',
    need: 3,
    holds: (t) => t.type === 'shadow'
  },
  {
    id: 'durations',
    label: 'Durations across the range',
    why: 'A button acknowledging a press is not as long as a panel arriving.',
    section: 'motion',
    need: 5,
    holds: (t) => t.type === 'duration'
  },
  {
    id: 'easings',
    label: 'Entrance, exit and standard curves',
    why: 'Arriving, leaving and moving in place each want a different curve.',
    section: 'motion',
    need: 3,
    holds: (t) => t.type === 'cubicBezier'
  },
  {
    id: 'expressive',
    label: 'An expressive set of curves',
    why: 'Reserve the slow curve, or every transition competes for attention.',
    section: 'motion',
    need: 2,
    holds: (t) => t.type === 'cubicBezier' && says(t, 'expressive', 'emphasised', 'emphasized')
  },
  {
    id: 'breakpoints',
    label: 'Breakpoints',
    why: 'Hand-typed breakpoints make a product change shape at four widths.',
    section: 'grid',
    need: 3,
    holds: (t) => says(t, 'breakpoint', 'screen')
  },
  {
    id: 'gutters',
    label: 'Columns and gutters',
    why: 'Without them, nothing lines up across screens built a week apart.',
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

/**
 * Every check answered against a library, across all of its themes.
 *
 * A check has to be met in every theme to count. Judged only against the
 * theme on screen, a library that has layers in Light and none in Dark
 * reports itself complete, and the gap stays hidden until somebody switches
 * theme and finds half the product unstyled. The tokens listed are the ones
 * from the weakest theme, since those are the ones a person would go and look
 * at.
 */
export function coverageAcross(studio: TokenStudio): Coverage[] {
  const themes = studio.themes.length > 0 ? studio.themes.map((t) => t.id) : [null]
  const perTheme = themes.map((id) => coverageOf(studio, id))
  return CHECKS.map((check, i) => {
    let worst = perTheme[0][i]
    for (const rows of perTheme) {
      if (rows[i].found.length < worst.found.length) worst = rows[i]
    }
    return { check, found: worst.found, met: perTheme.every((rows) => rows[i].met) }
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
