// AI rule definitions: the studio's anti-AI-default design rules, learned from
// building the Studio Ark sites. These power three things at once:
//   1. the toggles a user sees in the design wizard (label + hint),
//   2. the directives injected into the generation prompt (description),
//   3. the post-generation HTML linter (matched by id in lintHtml.ts).
// Keep ids stable: they are persisted in briefs and referenced by the linter.

export type AiRuleId = string

export type AiRule = {
  id: AiRuleId
  label: string
  description: string
  hint?: string
  group?: string
  default: boolean
}

export type AiRuleGroup = { id: string; label: string }

/** Toggle map: rule-id → enabled */
export type AiRules = Record<AiRuleId, boolean>

export const AI_RULE_GROUPS: AiRuleGroup[] = [
  { id: 'surfaces', label: 'Surfaces & color' },
  { id: 'icons', label: 'Icons & imagery' },
  { id: 'type', label: 'Typography' },
  { id: 'copy', label: 'Copywriting' },
  { id: 'restraint', label: 'Restraint' },
  { id: 'layout', label: 'Layout & structure' },
  { id: 'motion', label: 'Motion' },
  { id: 'access', label: 'Accessibility & responsive' },
]

export const AI_RULES: AiRule[] = [
  // Surfaces & color
  {
    id: 'no-gradients',
    label: 'No gradients',
    hint: 'Solid colors only, no aurora or mesh backgrounds',
    description:
      'Use solid colors only. No linear, radial or conic gradients, and no aurora / gradient-mesh background washes.',
    group: 'surfaces',
    default: true,
  },
  {
    id: 'flat-surfaces',
    label: 'Flat surfaces, no heavy shadows',
    hint: 'Separate with whitespace, a hairline or a flat tint',
    description:
      'Keep surfaces flat. Separate sections with whitespace, a hairline border or a flat tint rather than elevation. If a shadow is unavoidable keep it barely-there (opacity under 0.12, blur under 12px, y-offset under 4px).',
    group: 'surfaces',
    default: true,
  },
  {
    id: 'no-card-outlines',
    label: 'No boxed card outlines',
    hint: 'Group with whitespace or a flat tint, not borders',
    description:
      'Do not wrap cards or content blocks in visible borders / outlines. Group them with whitespace or a soft flat tint. The one allowed bordered element is an outlined-pill button.',
    group: 'surfaces',
    default: true,
  },
  {
    id: 'one-dominant-color',
    label: 'One dominant brand color',
    hint: 'One brand color plus neutrals, no color soup',
    description:
      'Use one dominant brand color plus neutrals and plenty of whitespace. No rainbow of accent colors competing for attention.',
    group: 'surfaces',
    default: true,
  },
  {
    id: 'no-default-palette',
    label: 'Avoid AI-default colors',
    hint: 'No default indigo / violet / purple',
    description:
      'Avoid the over-used AI-default indigo, violet and purple palette. Choose a considered, brand-specific color instead.',
    group: 'surfaces',
    default: true,
  },
  {
    id: 'no-header-blur',
    label: 'No blurred header',
    hint: 'Solid header, no frosted-glass blur',
    description:
      'The header / nav uses a solid background. Never give it a translucent frosted-glass look with backdrop-filter: blur (or -webkit-backdrop-filter).',
    group: 'surfaces',
    default: true,
  },

  // Icons & imagery
  {
    id: 'no-emoji-icons',
    label: 'No emoji as icons',
    hint: 'Use real inline SVG line icons',
    description:
      'Never use emoji characters as icons. Use real inline SVG line icons (single stroke, about 1.5px, round caps).',
    group: 'icons',
    default: true,
  },
  {
    id: 'no-icon-containers',
    label: 'No boxes behind icons',
    hint: 'Icons are plain glyphs, no circle or chip',
    description:
      'Icons sit on their own as plain glyphs. Never put a circle, square, chip or colored background behind an icon.',
    group: 'icons',
    default: true,
  },
  {
    id: 'real-imagery',
    label: 'Cinematic, real imagery',
    hint: 'No abstract blobs, no tilted dashboard shots',
    description:
      'Use cinematic, warm, real photography with natural light and muted tones. No stocky or over-saturated images, no abstract blobs / waves, and no tilted floating dashboard screenshots.',
    group: 'icons',
    default: true,
  },

  // Typography
  {
    id: 'no-all-caps',
    label: 'No all-caps titles',
    hint: 'Sentence or title case, no uppercase transform',
    description:
      'Use sentence or title case for headings and labels. Never apply text-transform: uppercase to titles or body labels.',
    group: 'type',
    default: true,
  },
  {
    id: 'no-kickers',
    label: 'No decorative kickers',
    hint: 'Drop the small-caps eyebrow labels',
    description:
      'Do not add decorative small-caps "kicker" / eyebrow labels above section headings. They are filler.',
    group: 'type',
    default: true,
  },
  {
    id: 'distinct-fonts',
    label: 'Distinct font pairing',
    hint: 'One display + one body, avoid Inter / Roboto',
    description:
      'Pick one distinctive display font and one body font (3 families maximum). Avoid the AI-default faces (Inter, Roboto, generic system stacks). When the user has chosen fonts, use exactly those.',
    group: 'type',
    default: true,
  },
  {
    id: 'avoid-default-serif',
    label: 'Avoid default serif',
    hint: 'Do not reach for serif by default',
    description:
      'Do not reflexively default to a serif typeface. Use a modern sans or grotesque unless the user asked for a serif or the brand clearly calls for one.',
    group: 'type',
    default: true,
  },

  // Copywriting
  {
    id: 'no-em-dash',
    label: 'No em dashes',
    hint: 'Use commas or periods instead',
    description:
      'Never use em dashes (the long dash) anywhere in the copy. Use commas, periods or parentheses instead.',
    group: 'copy',
    default: true,
  },
  {
    id: 'specific-copy',
    label: 'Specific, real copy',
    hint: 'No generic AI hero lines or lorem ipsum',
    description:
      'Write specific, concrete copy. No generic AI hero lines ("Supercharge your workflow"), no lorem ipsum, no fake testimonials or invented stats. Mark unknowns as placeholders.',
    group: 'copy',
    default: true,
  },
  {
    id: 'action-buttons',
    label: 'Action button labels',
    hint: 'Verb + noun, never "Submit" or "Click here"',
    description:
      'Label buttons with a verb plus a noun ("Create project", "Book a visit"). Never "Submit", "OK" or "Click here".',
    group: 'copy',
    default: true,
  },

  // Restraint: do not add things that were not asked for
  {
    id: 'no-unsolicited-subtext',
    label: 'No unsolicited subtext',
    hint: 'No subtitle under a heading unless asked',
    description:
      'Do not add a supporting subtitle or sentence beneath a heading unless the brief asks for it. A heading is allowed to stand on its own.',
    group: 'restraint',
    default: true,
  },
  {
    id: 'only-requested-sections',
    label: 'Only requested sections',
    hint: 'Do not invent sections that were not asked for',
    description:
      'Build only the sections the brief calls for or that real content exists for. Do not invent testimonials, stats, logo walls, newsletters, FAQ or "features" sections that were not requested.',
    group: 'restraint',
    default: true,
  },
  {
    id: 'icons-on-purpose',
    label: 'Icons only when they help',
    hint: 'No decorative icon sprinkling',
    description:
      'Use icons only where they carry real meaning or were requested. Do not sprinkle decorative icons across headings, list items, buttons or feature rows.',
    group: 'restraint',
    default: true,
  },
  {
    id: 'add-nothing-gratuitous',
    label: 'Add nothing gratuitous',
    hint: 'Build what is asked, nothing more',
    description:
      'Default to restraint. Build what is asked and nothing more: no filler blocks, no padding sections and no decorative flourishes added just to fill space.',
    group: 'restraint',
    default: true,
  },
  {
    id: 'no-progress-bar',
    label: 'No scroll progress bar',
    hint: 'No thin reading-progress bar at the top',
    description:
      'Do not add a reading or scroll progress bar (the thin bar that fills across the top of the page as you scroll). It is an unsolicited AI default.',
    group: 'restraint',
    default: true,
  },

  // Layout & structure
  {
    id: 'generous-whitespace',
    label: 'Generous whitespace',
    hint: 'Whitespace is the primary separator',
    description:
      'Use generous whitespace as the primary separator. Keep the layout calm and uncluttered; when in doubt, remove decoration.',
    group: 'layout',
    default: true,
  },
  {
    id: 'no-saas-template',
    label: 'No generic AI-SaaS layout',
    hint: 'Skip the navbar -> hero -> 3 cards cliche',
    description:
      'Do not produce the default AI-SaaS template (navbar, gradient hero, three feature cards with emoji, testimonials, CTA, footer). Design around the real content and user flow.',
    group: 'layout',
    default: true,
  },
  {
    id: 'semantic-html',
    label: 'Semantic HTML',
    hint: 'Real landmarks, one h1, ordered headings',
    description:
      'Use semantic HTML: header, nav, main, section, article, footer, and real buttons / links. One h1 per page, headings in order, no div soup.',
    group: 'layout',
    default: true,
  },

  // Motion
  {
    id: 'subtle-motion',
    label: 'Subtle, tasteful motion',
    hint: 'Animate transform and opacity only',
    description:
      'Motion is subtle and understated. Animate only transform and opacity, 150-400ms, ease-out. No bounce-on-load, no autoplaying carousels, no parallax overload.',
    group: 'motion',
    default: true,
  },
  {
    id: 'reduced-motion',
    label: 'Respect reduced motion',
    hint: 'Honor prefers-reduced-motion',
    description:
      'Always respect prefers-reduced-motion: reduce by disabling non-essential animation.',
    group: 'motion',
    default: true,
  },

  // Accessibility & responsive
  {
    id: 'responsive',
    label: 'Mobile-first & responsive',
    hint: 'Clean at 320, 768 and 1280+, no h-scroll',
    description:
      'Build mobile-first. The layout must be clean at 320px, tablet and 1280px+ with no horizontal scroll and tap targets of at least 44px.',
    group: 'access',
    default: true,
  },
  {
    id: 'a11y-contrast',
    label: 'Accessible contrast & focus',
    hint: 'WCAG AA, visible focus, alt text',
    description:
      'Meet WCAG AA contrast (4.5:1 text, 3:1 large / UI). Keep visible focus-visible rings, never remove outlines without a replacement, and give every image alt text.',
    group: 'access',
    default: true,
  },
]

/** Return the number of rules the user has turned OFF. */
export function disabledCount(rules: AiRules): number {
  return AI_RULES.filter((r) => rules[r.id] === false).length
}

/** Build a default AiRules map (every rule enabled). */
export function defaultAiRules(): AiRules {
  const map: AiRules = {}
  for (const r of AI_RULES) map[r.id] = r.default
  return map
}

const STORAGE_KEY = 'terminal42:ai-rules'

/** Persist the current rule toggles to localStorage. */
export function saveGlobalAiRules(rules: AiRules): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
  } catch {
    // storage unavailable — silently ignore
  }
}

/** Load persisted rule toggles, falling back to defaults. */
export function loadGlobalAiRules(): AiRules {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...defaultAiRules(), ...JSON.parse(raw) }
  } catch {
    // ignore
  }
  return defaultAiRules()
}

/**
 * Turn the set of enabled rule ids into a directive block for the generation
 * prompt. Rules keep their catalog order so the output is stable. Safe to call
 * from the main process (no browser APIs touched).
 */
export function formatRulesForPrompt(activeIds: string[]): string {
  const active = new Set(activeIds)
  const lines = AI_RULES.filter((r) => active.has(r.id)).map((r) => `- ${r.description}`)
  if (!lines.length) return ''
  return ['Non-negotiable design rules (the user has these enforced):', ...lines].join('\n')
}
