// The design guidelines, as data.
//
// resources/design-guidelines.md is the prose the rules come from, and it
// stays the source of truth for a person reading them. This file is what the
// check runs on: the same rules, but with something machine-checkable
// attached, so a report can say "7 inline styles, here is the first" instead
// of a paragraph of advice.
//
// Only rules that can be judged honestly from source are here. "Use clear
// copy" is a real guideline and is deliberately absent, because a checker
// that guesses at it would be noise.

export type GuidelineGroupId =
  | 'anti-ai' | 'structure' | 'css' | 'layout'
  | 'components' | 'media' | 'a11y' | 'performance' | 'theme'

export type GuidelineGroup = {
  id: GuidelineGroupId
  /** Two or three words. The report is read at a glance. */
  label: string
  /** A shape drawn in the report, so the eye finds the group before the text. */
  pictogram: 'blocks' | 'tree' | 'braces' | 'grid' | 'component' | 'image' | 'access' | 'gauge' | 'contrast'
}

export const GUIDELINE_GROUPS: GuidelineGroup[] = [
  { id: 'anti-ai',     label: 'AI defaults',   pictogram: 'blocks' },
  { id: 'structure',   label: 'HTML',          pictogram: 'tree' },
  { id: 'css',         label: 'CSS',           pictogram: 'braces' },
  { id: 'layout',      label: 'Layout',        pictogram: 'grid' },
  { id: 'components',  label: 'Components',    pictogram: 'component' },
  { id: 'media',       label: 'Images',        pictogram: 'image' },
  { id: 'a11y',        label: 'Accessibility', pictogram: 'access' },
  { id: 'performance', label: 'Performance',   pictogram: 'gauge' },
  { id: 'theme',       label: 'Dark mode',     pictogram: 'contrast' }
]

export type Guideline = {
  id: string
  group: GuidelineGroupId
  /** What is wrong, in a handful of words. Shown as the row. */
  label: string
  /** What to do instead. One line, shown only when the row is opened. */
  fix: string
  /** Which files the rule can be judged from. */
  applies: Array<'html' | 'css' | 'jsx'>
}

export const GUIDELINES: Guideline[] = [
  // ── Anti-AI defaults ────────────────────────────────────────────────────
  { id: 'div-soup', group: 'anti-ai', applies: ['html', 'jsx'],
    label: 'Divs where an element exists',
    fix: 'Use main, nav, header, footer, section, article or aside.' },
  { id: 'inline-styles', group: 'anti-ai', applies: ['html', 'jsx'],
    label: 'Inline styles',
    fix: 'Move to a class. Inline styles cannot hold hover, focus or media queries.' },
  { id: 'div-button', group: 'anti-ai', applies: ['html', 'jsx'],
    label: 'A div used as a button',
    fix: 'Use a button. It is focusable and announced without any help.' },
  { id: 'fixed-width', group: 'anti-ai', applies: ['css'],
    label: 'Fixed pixel widths on containers',
    fix: 'Use max-width with width 100% so the box can still shrink.' },
  { id: 'float-layout', group: 'anti-ai', applies: ['css'],
    label: 'Float used for layout',
    fix: 'Use flex or grid.' },
  { id: 'hardcoded-colour', group: 'anti-ai', applies: ['css', 'jsx'],
    label: 'Colours written out in full',
    fix: 'Reference a token: var(--color-primary).' },
  { id: 'off-grid-spacing', group: 'anti-ai', applies: ['css'],
    label: 'Spacing off the 4px grid',
    fix: 'Round to a multiple of 4, or use a spacing token.' },
  { id: 'emoji-icons', group: 'anti-ai', applies: ['html', 'jsx'],
    label: 'Emoji standing in for icons',
    fix: 'Use an icon component. An emoji renders differently on every machine.' },
  { id: 'pure-black', group: 'anti-ai', applies: ['css'],
    label: 'Pure black text',
    fix: 'Use a very dark neutral instead of #000.' },
  { id: 'viewport-hero', group: 'anti-ai', applies: ['css'],
    label: 'A hero locked to the viewport height',
    fix: 'Let the content set the height, or use min-height.' },

  // ── HTML structure ──────────────────────────────────────────────────────
  { id: 'no-landmarks', group: 'structure', applies: ['html'],
    label: 'No main landmark',
    fix: 'Wrap the page content in main, one per page.' },
  { id: 'heading-skip', group: 'structure', applies: ['html'],
    label: 'A heading level skipped',
    fix: 'Go h1 to h2 to h3 in order. Style with a class, not a level.' },
  { id: 'multiple-h1', group: 'structure', applies: ['html'],
    label: 'More than one h1',
    fix: 'Keep one h1 and demote the rest.' },
  { id: 'unlabelled-input', group: 'structure', applies: ['html'],
    label: 'An input with no label',
    fix: 'Pair it with a label. A placeholder disappears as soon as typing starts.' },
  { id: 'href-less-link', group: 'structure', applies: ['html'],
    label: 'A link with no href',
    fix: 'Give it an href, or make it a button if it performs an action.' },

  // ── CSS ─────────────────────────────────────────────────────────────────
  { id: 'no-tokens', group: 'css', applies: ['css'],
    label: 'No design tokens',
    fix: 'Declare custom properties on :root and reference them.' },
  { id: 'important', group: 'css', applies: ['css'],
    label: '!important',
    fix: 'Lower the specificity instead, or use a cascade layer.' },
  { id: 'deep-selector', group: 'css', applies: ['css'],
    label: 'Very deep selectors',
    fix: 'Name the thing and select it directly.' },

  // ── Layout ──────────────────────────────────────────────────────────────
  { id: 'margin-spacing', group: 'layout', applies: ['css'],
    label: 'Children spaced with margins',
    fix: 'Put gap on the flex or grid parent.' },
  { id: 'no-responsive', group: 'layout', applies: ['css'],
    label: 'No breakpoints',
    fix: 'Start from the small screen and add min-width queries.' },
  { id: 'absolute-layout', group: 'layout', applies: ['css'],
    label: 'Absolute positioning for layout',
    fix: 'Keep position for overlays. Lay the page out with flex or grid.' },

  // ── Components ──────────────────────────────────────────────────────────
  { id: 'no-hover', group: 'components', applies: ['css'],
    label: 'Interactive elements with no hover',
    fix: 'Give every control a hover, focus, active and disabled state.' },
  { id: 'no-focus', group: 'components', applies: ['css'],
    label: 'No focus styles',
    fix: 'Style :focus-visible. Never remove the outline without replacing it.' },
  { id: 'outline-none', group: 'components', applies: ['css'],
    label: 'The focus outline removed',
    fix: 'Put something visible in its place.' },
  { id: 'small-target', group: 'components', applies: ['css'],
    label: 'Targets under 44px',
    fix: 'Grow the hit area with padding even if the visual stays small.' },

  // ── Images and media ────────────────────────────────────────────────────
  { id: 'missing-alt', group: 'media', applies: ['html', 'jsx'],
    label: 'Images with no alt',
    fix: 'Describe it, or use alt="" if it is decoration.' },
  { id: 'no-dimensions', group: 'media', applies: ['html'],
    label: 'Images with no width and height',
    fix: 'Set both so the page does not jump as they load.' },
  { id: 'no-lazy', group: 'media', applies: ['html'],
    label: 'No lazy loading',
    fix: 'Add loading="lazy" below the fold.' },
  { id: 'legacy-format', group: 'media', applies: ['html'],
    label: 'Only PNG and JPEG',
    fix: 'Offer AVIF or WebP first with picture.' },

  // ── Accessibility ───────────────────────────────────────────────────────
  { id: 'no-skip-link', group: 'a11y', applies: ['html'],
    label: 'No skip link',
    fix: 'Put a link to the main content first in the tab order.' },
  { id: 'no-lang', group: 'a11y', applies: ['html'],
    label: 'No lang on html',
    fix: 'Set it so the page is read in the right voice.' },
  { id: 'redundant-role', group: 'a11y', applies: ['html', 'jsx'],
    label: 'A role an element already has',
    fix: 'Drop it. A button is already a button.' },
  { id: 'positive-tabindex', group: 'a11y', applies: ['html', 'jsx'],
    label: 'A positive tabindex',
    fix: 'Use 0, and let the document order decide.' },

  // ── Performance ─────────────────────────────────────────────────────────
  { id: 'no-font-display', group: 'performance', applies: ['css'],
    label: 'Fonts with no display strategy',
    fix: 'Add font-display: swap so text shows immediately.' },
  { id: 'render-blocking', group: 'performance', applies: ['html'],
    label: 'Scripts blocking the render',
    fix: 'Add defer, or type="module".' },

  // ── Dark mode ───────────────────────────────────────────────────────────
  { id: 'no-dark-mode', group: 'theme', applies: ['css'],
    label: 'No dark mode',
    fix: 'Swap the token values under prefers-color-scheme: dark.' },
  { id: 'no-colour-scheme', group: 'theme', applies: ['css'],
    label: 'No color-scheme',
    fix: 'Set it on :root so form controls and scrollbars follow.' },
  { id: 'no-reduced-motion', group: 'theme', applies: ['css'],
    label: 'Motion not made optional',
    fix: 'Shorten or drop animation under prefers-reduced-motion.' }
]

export function guidelinesFor(kind: 'html' | 'css' | 'jsx'): Guideline[] {
  return GUIDELINES.filter((g) => g.applies.includes(kind))
}

export function guideline(id: string): Guideline | undefined {
  return GUIDELINES.find((g) => g.id === id)
}

export function groupOf(id: GuidelineGroupId): GuidelineGroup | undefined {
  return GUIDELINE_GROUPS.find((g) => g.id === id)
}
