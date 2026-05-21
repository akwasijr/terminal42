// AI defaults: the rules that fight the model's marketing-template instincts.
// Toggleable per-design (in the wizard) and globally (persisted to localStorage).
// Folded into every prompt by `src/main/design.ts`.

export type AiRuleId =
  | 'noFakeMeta'           // no invented version pills, breadcrumbs, "v0.1", BETA tags
  | 'noFakeTestimonials'   // no invented quotes, names, headshots
  | 'noFakeStats'          // no invented "10x faster", "trusted by 10k+" numbers
  | 'noEmojiIcons'         // no emoji used as icons (🚀 ⚡ 💡 ✨ 🎯 🔥)
  | 'noAllCaps'            // no spaced-out ALL-CAPS labels
  | 'noGradients'          // no purple/blue gradients (no gradients at all)
  | 'noHeavyShadow'        // shadows stay subtle (no glows, no neon)
  | 'noBlobs'              // no SVG blobs / aurora bg / squiggly decorations
  | 'noFloatingDashboard'  // no tilted/perspective dashboard hero shots
  | 'noEmojiFeatureGrid'   // no 3-col 🚀⚡💡 feature grid with lorem
  | 'noGenericHero'        // no "Supercharge your X" / "Modern X for modern Y"
  | 'noOversizedHero'      // no 100vh heroes, no 80px+ marketing headlines
  | 'noInter'              // do not default to Inter as the font
  | 'noEyebrowPills'       // no eyebrow/kicker pill above hero ("● Tagline")
  | 'noEmphasisColor'      // no color-shifted word in middle of heading for emphasis
  | 'noEmDashes'           // no em-dashes (U+2014) or en-dashes (U+2013) in copy
  | 'noAccentLines'        // no decorative thin accent lines / glowing dividers / underline strokes
  | 'noVerboseText'        // no descriptive subtitles under titles, no chatty body, no filler subtext
  | 'noIconContainers'     // no circle / rounded-rect background tiles wrapped around icons
  | 'noExcessOutlines'     // 1px hairline only when needed; no double borders, no outlined toasts
  | 'noAiSparkleIcons'     // do not sprinkle wand / sparkle / "AI" star icons across the design

export type AiRules = Record<AiRuleId, boolean>

export type AiRuleDef = {
  id: AiRuleId
  label: string
  /** What this rule prevents: short user-facing line. */
  hint: string
  /** Sentence appended to the prompt when the rule is ON (enforced). */
  promptLine: string
  /** Optional category for grouping in the UI. */
  group: 'content' | 'visual' | 'copy' | 'layout'
}

export const AI_RULES: AiRuleDef[] = [
  {
    id: 'noFakeMeta',
    label: 'No fake metadata pills',
    hint: 'Stops invented "v0.1" / "BETA" / breadcrumb badges',
    promptLine:
      'Do not invent metadata pills, version badges (e.g. "v0.1", "v2"), tag chips ("BETA", "NEW", "PRO"), breadcrumbs, "Last updated" stamps, page counters, or author bylines. The design has no real version, no real author, no real status. Use plain headings instead: only render content the user actually provided.',
    group: 'content'
  },
  {
    id: 'noFakeTestimonials',
    label: 'No fake testimonials',
    hint: 'Stops invented quotes, names, headshots',
    promptLine:
      'Do not invent testimonials. No fictional names ("Sarah J., CEO"), no AI-generated avatar headshots, no quotes the user did not give you. If a testimonial slot is structurally needed, render it as a placeholder block labelled "[testimonial]".',
    group: 'content'
  },
  {
    id: 'noFakeStats',
    label: 'No fake stats',
    hint: 'Stops invented "10x faster", "trusted by 10,000+" numbers',
    promptLine:
      'Do not invent statistics, customer counts, percentages, ratings, or benchmark claims. No "10x faster", "trusted by 10,000+ teams", "4.9/5 stars". If a stat slot is structurally needed, render "[stat]" as a placeholder.',
    group: 'content'
  },
  {
    id: 'noEmojiIcons',
    label: 'No emoji icons',
    hint: 'Use real SVG icons, not 🚀⚡💡',
    promptLine:
      'Do not use emoji as icons (🚀 ⚡ 💡 ✨ 🎯 🔥 🎨 🛡 ⭐). Use small inline SVG line icons or remove the icon entirely.',
    group: 'visual'
  },
  {
    id: 'noAllCaps',
    label: 'No ALL-CAPS labels',
    hint: 'Sentence case for body, Title Case for headings',
    promptLine:
      'Do not use spaced-out ALL-CAPS labels. Sentence case for body text, Title Case for headings. ALL CAPS is only acceptable on tiny meta labels of two words or fewer (e.g. "NEW").',
    group: 'copy'
  },
  {
    id: 'noGradients',
    label: 'No saturated gradients',
    hint: 'Solid fills only: no purple/blue/pink gradients',
    promptLine:
      'Do not use gradients of any kind unless the user explicitly asked. No purple→blue, indigo→violet, pink→orange, green→teal: none. Use solid fills from the brand palette only.',
    group: 'visual'
  },
  {
    id: 'noHeavyShadow',
    label: 'No heavy shadows',
    hint: 'Shadows stay subtle: no glows, no neon',
    promptLine:
      'Keep shadows extremely subtle (offset 0 1px, blur 2-4px, 4-8% opacity). No glows, no neon, no stacked shadows, no coloured shadows.',
    group: 'visual'
  },
  {
    id: 'noBlobs',
    label: 'No decorative blobs',
    hint: 'No SVG blobs, aurora backgrounds, squiggles',
    promptLine:
      'Do not add decorative SVG blobs, aurora/mesh gradient backgrounds, floating circles, squiggly lines, or wavy dividers as filler. Use whitespace, subtle borders, or background colour shifts instead.',
    group: 'visual'
  },
  {
    id: 'noFloatingDashboard',
    label: 'No floating dashboard hero',
    hint: 'No tilted "fake product screenshot" hero',
    promptLine:
      'Do not add a tilted/perspective-transformed fake dashboard or app screenshot as a hero image. If no real screenshot exists, omit the image entirely or use a flat illustration.',
    group: 'layout'
  },
  {
    id: 'noEmojiFeatureGrid',
    label: 'No emoji feature grid',
    hint: 'No 3-col 🚀⚡💡 grids with lorem ipsum',
    promptLine:
      'Do not generate a three-column feature grid where each card has an emoji icon, a generic heading, and lorem-ipsum body. Either use real feature copy with proper SVG icons, or omit the section.',
    group: 'layout'
  },
  {
    id: 'noGenericHero',
    label: 'No generic hero copy',
    hint: 'No "Supercharge your X" / "Modern X for modern Y"',
    promptLine:
      'Do not write generic AI marketing copy. Banned headlines include: "Supercharge your workflow", "Modern solutions for modern teams", "The future of X starts here", "Empower your X with AI", "Build better, faster, smarter", "Unlock the power of X", "Everything you need to X". Write specific, concrete copy describing the actual product, or use a clearly labelled placeholder.',
    group: 'copy'
  },
  {
    id: 'noOversizedHero',
    label: 'No oversized hero',
    hint: 'No 100vh hero or 80px+ marketing headlines',
    promptLine:
      'Heroes are sized to fit their content. Do not default to 100vh; do not use 80px+ headlines unless explicitly requested. Use min-height when needed, never height: 100vh.',
    group: 'layout'
  },
  {
    id: 'noInter',
    label: 'Do not default to Inter',
    hint: 'Prefer DM Sans, Plus Jakarta, Geist, Space Grotesk',
    promptLine:
      'Do not default to Inter. If no font is specified by the brief, prefer DM Sans, Plus Jakarta Sans, Geist, Satoshi, Space Grotesk, IBM Plex Sans, or Fraunces (display).',
    group: 'visual'
  },
  {
    id: 'noEyebrowPills',
    label: 'No eyebrow / kicker pills',
    hint: 'No "● Tagline" pills above the hero headline',
    promptLine:
      'Do not add eyebrow / kicker pills above hero headlines (a pill-shaped chip with a small dot or icon followed by a short tagline like "● Operations OS for studios"). This is the most overused AI marketing pattern. Start the hero with the headline directly. If a label is structurally needed, use a small uppercase eyebrow text WITHOUT the pill chrome.',
    group: 'layout'
  },
  {
    id: 'noEmphasisColor',
    label: 'No color-shift emphasis',
    hint: 'Don\'t color one word in the middle of a heading',
    promptLine:
      'Do not change the color of one or two words in the middle of a heading for "emphasis" (the AI default of writing "Run the studio, not the spreadsheet: quietly, all in one place" with "quietly" in a brighter accent colour). Headlines use a single colour. If emphasis is needed, use weight (semibold/bold) or a separate sub-line, never a colour shift mid-sentence.',
    group: 'copy'
  },
  {
    id: 'noEmDashes',
    label: 'No em-dashes / en-dashes',
    hint: 'Anywhere: including layer names, titles, chat replies',
    promptLine:
      'Do not use em-dashes (Unicode U+2014) or en-dashes (U+2013) ANYWHERE: not in user-facing copy, not in chat replies, not in Figma layer / page names, not in HTML titles. They are the strongest tell of AI-generated text. Use commas, periods, colons, parentheses, hyphens (the regular ASCII "-"), or " \u00b7 " instead. Search your draft for the characters at code points U+2014 and U+2013 and rewrite each occurrence.',
    group: 'copy'
  },
  {
    id: 'noAccentLines',
    label: 'No decorative accent lines',
    hint: 'No glowing dividers, gradient underlines, neon strokes',
    promptLine:
      'Do not add decorative accent lines or bars. CONCRETE BANS: no thin gradient or coloured underline strokes beneath hero headlines (a 2-4px wide bar in the brand colour under an h1 is the AI tell), no glowing horizontal rules between sections, no neon stroke borders around hero text, no coloured "ticker" stripes spanning the full width of the page, no animated gradient bars; AND no vertical coloured "edge stripe" on the left (or right) side of alert / banner / notification / callout / advisory boxes. Alerts express severity through tinted background + icon colour + text colour only, never through a 3-6px coloured edge bar. Section dividers, when needed, are a single 1px hairline in the border colour at low opacity. Underlines belong on links only.',
    group: 'visual'
  },
  {
    id: 'noVerboseText',
    label: 'No verbose text',
    hint: 'Cut subtext under titles. Tight, scannable copy only',
    promptLine:
      'Cut every word that does not earn its place. Specifically: NO descriptive sub-text directly underneath a heading (a card titled "Revenue" does NOT need "Track your revenue over time" underneath it; a section called "Recent activity" does NOT need "Here is what happened recently"). NO chatty introductory sentences before lists or tables ("Below you can see..."). NO restating the page name in the page header subtitle. NO "Here you can..." / "This is where you..." / "Use this section to...". Body copy is short and concrete: a value plus its label, a number plus its delta, a row plus its action. If a piece of text only exists to make the layout feel "complete", delete it. Numbers, table rows, charts, and labels carry the meaning.',
    group: 'copy'
  },
  {
    id: 'noIconContainers',
    label: 'No icon containers',
    hint: 'No circle / rounded square tints behind icons',
    promptLine:
      'Do NOT wrap icons in coloured background tiles. No `bg-blue-100 rounded-full` discs behind every list icon, no rounded-square coloured chips behind nav icons, no circular `bg-accent/10` halos behind feature icons, no soft pastel "icon backgrounds" in dashboard sidebars or stat cards. The icon stands alone in the brand colour (or text-muted at rest, brand on hover). The exception is a real avatar (a user photo or initial bubble) which is a circular content surface, not decoration. If you find yourself reaching for `rounded-full bg-{color}-100` around a 16px icon, stop.',
    group: 'visual'
  },
  {
    id: 'noExcessOutlines',
    label: 'No excess outlines',
    hint: 'One hairline only. No outlined toasts. No double borders.',
    promptLine:
      'Outlines are the strongest AI tell of all. The model defaults to wrapping every card, stat, panel, alert, search box, table, sidebar item, and section in a 1px ring for "clarity": stop. Use an outline ONLY when separation cannot come from background colour or whitespace. Concretely: cards on a page background use ONE of {1px hairline border, subtle shadow, slightly elevated background} and NEVER a combination; when multiple cards share a row, prefer slightly-elevated-background with NO border. NEVER outline floating surfaces (toasts, snackbars, banners, popovers, tooltips, alerts, callouts) - they use opaque tinted fill + maybe a shadow, never a 1px ring AND never a left-edge accent stripe. Form inputs have one border at rest + a focus ring, never an additional fieldset border. Zebra-striped tables drop per-row borders. NEVER `border-t` plus `border-b` on adjacent siblings (they compound). Sidebar nav items get background-tint-on-active, never outline-on-active. Default to NO border.',
    group: 'visual'
  },
  {
    id: 'noAiSparkleIcons',
    label: 'No AI sparkle icons',
    hint: 'Stop sprinkling wand / star / sparkle icons everywhere',
    promptLine:
      'Do NOT scatter "AI sparkle" iconography (the four-point star, magic wand, sparkles cluster, gradient orb, AI badge) across the design. These have become the defining tell of AI-built UI. Use them ONLY when the user explicitly asked for an AI feature and only on the one button or surface that triggers it. Never put a sparkle icon next to "Recent activity", "Insights", "Suggestions", "Recommendations", section headings, sidebar items, empty states, or hero headlines. Use the section\'s real semantic icon (chart, list, search, user, etc.) or no icon at all.',
    group: 'visual'
  }
]

export const AI_RULE_GROUPS: Array<{ id: AiRuleDef['group']; label: string }> = [
  { id: 'content', label: 'Fake content' },
  { id: 'visual',  label: 'Visual defaults' },
  { id: 'copy',    label: 'Copy defaults' },
  { id: 'layout',  label: 'Layout defaults' }
]

/** Default state: every rule is enforced. */
export function defaultAiRules(): AiRules {
  const out = {} as AiRules
  for (const r of AI_RULES) out[r.id] = true
  return out
}

const STORAGE_KEY = 't42:aiRules:global'

export function loadGlobalAiRules(): AiRules {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultAiRules()
    const parsed = JSON.parse(raw) as Partial<AiRules>
    return { ...defaultAiRules(), ...parsed }
  } catch {
    return defaultAiRules()
  }
}

export function saveGlobalAiRules(rules: AiRules): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rules)) } catch {}
}

/** Count how many of the 21 rules are currently disabled. */
export function disabledCount(rules: AiRules): number {
  return AI_RULES.reduce((n, r) => n + (rules[r.id] ? 0 : 1), 0)
}
