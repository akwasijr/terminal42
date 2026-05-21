// HTML lint: scans a generated design file for violations of the
// AI-default rules already in AI_RULE_PROMPT_LINES. When violations exist,
// the caller automatically fires a follow-up "fix" turn to the model.
//
// Each detector returns an array of short, concrete violation messages
// the model can act on ("found 4 ALL-CAPS spans: 'ACCESS', 'OVERVIEW'…").
// Messages are deliberately terse to keep the fix-prompt cheap.

import { FORBIDDEN_HEX_FOR_LINT } from './lintConstants'

export type LintRuleId =
  | 'noAllCaps'
  | 'noEmDashes'
  | 'noGradients'
  | 'noEmojiIcons'
  | 'noGenericHero'
  | 'noEyebrowPills'
  | 'noAccentLines'
  | 'noIconContainers'
  | 'noExcessOutlines'
  | 'noAiSparkleIcons'
  | 'noEmphasisColor'
  | 'noInter'
  | 'forbiddenColors'
  | 'inlineStyles'

export type LintViolation = {
  rule: LintRuleId
  message: string
  examples: string[] // short snippets the model can find/replace
}

const GENERIC_HERO_PHRASES = [
  'supercharge',
  'unlock the power',
  'empower your',
  'modern .{3,30} for modern',
  'the future of',
  'build better, faster, smarter',
  'everything you need to',
  'take your .{3,30} to the next level',
  'transform your',
  'revolutionize',
]

// Emoji ranges commonly misused as icons. Excludes plain text emoji that
// appear inside paragraphs. We catch them specifically when they're inside
// short structural elements (button, span with class containing icon, etc.).
const ICON_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2700}-\u{27BF}]/u

const ALL_CAPS_RE = /<(?:span|div|p|h[1-6]|button|a|li|td|th|small|strong|label)\b[^>]*>([A-Z][A-Z0-9 _\-]{4,})<\//g

function unique<T>(arr: T[]): T[] { return Array.from(new Set(arr)) }

function detectAllCaps(html: string, _enabled: Record<string, boolean> | null): LintViolation | null {
  const matches: string[] = []
  let m: RegExpExecArray | null
  ALL_CAPS_RE.lastIndex = 0
  while ((m = ALL_CAPS_RE.exec(html)) !== null) {
    const text = m[1].trim()
    if (text.length < 5) continue
    // Only tolerate truly tiny labels: single word <=6 chars (NEW, BETA, PRO, ALPHA).
    // Section headings like OVERVIEW/PROFILE/DASHBOARD must be flagged — that's
    // exactly the violation the user keeps seeing.
    const words = text.split(/\s+/).filter(Boolean)
    if (words.length === 1 && text.length <= 6) continue
    matches.push(text)
  }
  // Also catch tracking + uppercase Tailwind class combos
  const trackUpper = html.match(/class="[^"]*\b(?:uppercase|tracking-(?:wider|widest))\b[^"]*\b(?:uppercase|tracking-(?:wider|widest))\b[^"]*"/g)
  if (trackUpper) for (const t of trackUpper.slice(0, 5)) matches.push(t.slice(0, 80))
  // text-transform inline style
  const css = html.match(/text-transform\s*:\s*uppercase/g)
  if (css) matches.push(`text-transform: uppercase (${css.length} occurrences)`)
  if (!matches.length) return null
  return {
    rule: 'noAllCaps',
    message: `${matches.length} ALL-CAPS labels/headings. Convert to Title Case (headings) or Sentence case (body). Remove uppercase + tracking-wider classes.`,
    examples: unique(matches).slice(0, 8),
  }
}

function detectEmDashes(html: string): LintViolation | null {
  const em = (html.match(/—/g) ?? []).length
  const en = (html.match(/–/g) ?? []).length
  if (!em && !en) return null
  return {
    rule: 'noEmDashes',
    message: `${em} em-dashes (—) and ${en} en-dashes (–). Replace with comma, period, colon, ASCII hyphen, or " · ".`,
    examples: [],
  }
}

function detectGradients(html: string): LintViolation | null {
  const gradients = html.match(/(?:linear|radial|conic)-gradient\s*\(/g)
  if (!gradients?.length) return null
  return {
    rule: 'noGradients',
    message: `${gradients.length} gradient fills found. Replace with solid brand colors.`,
    examples: unique(gradients).slice(0, 4),
  }
}

function detectEmojiIcons(html: string): LintViolation | null {
  // Only flag emoji inside short "icon-shaped" elements
  const re = /<(?:span|button|a|li|i)\b[^>]{0,200}>\s*([\p{Emoji_Presentation}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}])\s*<\//gu
  const matches: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    matches.push(m[1])
  }
  if (!matches.length && !ICON_EMOJI.test(html.slice(0, 50000))) return null
  if (!matches.length) return null
  return {
    rule: 'noEmojiIcons',
    message: `${matches.length} emoji used as icons. Replace with inline SVG line icons or remove.`,
    examples: unique(matches).slice(0, 6),
  }
}

function detectGenericHero(html: string): LintViolation | null {
  const text = html.replace(/<[^>]+>/g, ' ').toLowerCase()
  const hits: string[] = []
  for (const phrase of GENERIC_HERO_PHRASES) {
    if (new RegExp(phrase).test(text)) hits.push(phrase)
  }
  if (!hits.length) return null
  return {
    rule: 'noGenericHero',
    message: `Generic AI marketing copy found. Rewrite with specific, product-true language.`,
    examples: hits,
  }
}

function detectAccentLines(html: string): LintViolation | null {
  const matches: string[] = []
  // border-l-4 alerts (Tailwind)
  const borderL = html.match(/class="[^"]*\bborder-l-(?:2|4|8)\b[^"]*"/g)
  if (borderL) matches.push(...borderL.slice(0, 4).map((s) => s.slice(0, 70)))
  // glowing strokes / box-shadow with high opacity colored glow
  const glow = html.match(/box-shadow:\s*0\s+0\s+\d+px\s+(?:rgba|#)/g)
  if (glow && glow.length > 2) matches.push(`${glow.length} glow box-shadows`)
  if (!matches.length) return null
  return {
    rule: 'noAccentLines',
    message: `Decorative accent bars/glows found (border-l-N alerts, glowing strokes). Use tinted bg + icon + text only.`,
    examples: unique(matches).slice(0, 6),
  }
}

function detectIconContainers(html: string): LintViolation | null {
  // bg-{color}-{50,100,200} rounded-full|rounded-2xl wrapping an svg (icon halo)
  const re = /class="[^"]*\bbg-(?:blue|indigo|purple|green|emerald|amber|orange|pink|red|teal|cyan)-(?:50|100|200)\b[^"]*\brounded-(?:full|xl|2xl|3xl)\b[^"]*"/g
  const matches = html.match(re)
  if (!matches?.length) return null
  return {
    rule: 'noIconContainers',
    message: `${matches.length} icon halo containers (pastel disc/tile around an icon). Remove the wrapper; icon stands alone.`,
    examples: unique(matches).slice(0, 4).map((s) => s.slice(0, 80)),
  }
}

function detectExcessOutlines(html: string): LintViolation | null {
  // Find elements with both border AND shadow AND bg-elevated-style — too many separators
  // Simpler heuristic: count how many .border + .shadow combo classes exist
  const combo = html.match(/class="[^"]*\bborder\b[^"]*\bshadow(?:-\w+)?\b[^"]*"/g)
  if (!combo || combo.length < 6) return null
  return {
    rule: 'noExcessOutlines',
    message: `${combo.length} elements combine \`border\` + \`shadow\`. Use ONE separator per surface.`,
    examples: combo.slice(0, 3).map((s) => s.slice(0, 80)),
  }
}

function detectSparkleIcons(html: string): LintViolation | null {
  // Lucide / Heroicons sparkles or AI badge SVGs are usually imported by name
  // or have "sparkle"/"wand"/"magic" in the SVG class or path id.
  const re = /\b(?:sparkle|sparkles|wand|magic|ai-badge|stars-icon)\b/gi
  const matches = html.match(re)
  if (!matches || matches.length <= 1) return null // one is fine (the AI trigger button)
  return {
    rule: 'noAiSparkleIcons',
    message: `${matches.length} sparkle/wand/AI icons found across the UI. Keep only on the actual AI trigger button.`,
    examples: unique(matches).slice(0, 4),
  }
}

function detectEmphasisColor(html: string): LintViolation | null {
  // Headings with a child span colored differently — "Mid-heading colour shift"
  const re = /<h[1-6][^>]*>[^<]*<span\s+class="[^"]*\btext-(?:blue|indigo|purple|green|emerald|amber|orange|pink|red|teal|cyan)-\d{3}\b[^"]*"/g
  const matches = html.match(re)
  if (!matches?.length) return null
  return {
    rule: 'noEmphasisColor',
    message: `${matches.length} headings with mid-heading color emphasis. Use weight or sub-line for emphasis instead.`,
    examples: matches.slice(0, 3).map((s) => s.slice(0, 90)),
  }
}

function detectInter(html: string): LintViolation | null {
  const re = /\bInter\b(?![\w-])/g
  const matches = html.match(re)
  if (!matches?.length) return null
  return {
    rule: 'noInter',
    message: `Inter font referenced ${matches.length} time(s). Switch to DM Sans, Plus Jakarta, Geist, Satoshi, Space Grotesk, IBM Plex, or Fraunces.`,
    examples: [],
  }
}

function detectForbiddenColors(html: string): LintViolation | null {
  const found: string[] = []
  for (const hex of FORBIDDEN_HEX_FOR_LINT) {
    if (html.toLowerCase().includes(hex.toLowerCase())) found.push(hex)
  }
  if (!found.length) return null
  return {
    rule: 'forbiddenColors',
    message: `Forbidden AI-default purple/indigo/blue hex values used: ${found.join(', ')}. Replace with brand palette.`,
    examples: found,
  }
}

function detectInlineStyles(html: string): LintViolation | null {
  // Allow style="" with only CSS variable references or width/height percentages (dynamic)
  const re = /style="([^"]+)"/g
  const offenders: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const v = m[1].trim()
    if (!v) continue
    // Skip dynamic-looking ones
    if (/^(?:--[\w-]+:|width:\s*\d|height:\s*\d|grid-(?:column|row)|transform:\s*translate)/i.test(v)) continue
    offenders.push(v.slice(0, 60))
  }
  if (offenders.length < 4) return null // tolerate a few
  return {
    rule: 'inlineStyles',
    message: `${offenders.length} inline \`style="…"\` attributes for static styling. Move to CSS / utility classes (inline styles can't use :hover/:focus/media queries).`,
    examples: unique(offenders).slice(0, 4),
  }
}

const DETECTORS: Array<{ id: string; gate?: string; fn: (html: string, rules: Record<string, boolean> | null) => LintViolation | null }> = [
  { id: 'noAllCaps', gate: 'noAllCaps', fn: detectAllCaps },
  { id: 'noEmDashes', gate: 'noEmDashes', fn: (h) => detectEmDashes(h) },
  { id: 'noGradients', gate: 'noGradients', fn: (h) => detectGradients(h) },
  { id: 'noEmojiIcons', gate: 'noEmojiIcons', fn: (h) => detectEmojiIcons(h) },
  { id: 'noGenericHero', gate: 'noGenericHero', fn: (h) => detectGenericHero(h) },
  { id: 'noAccentLines', gate: 'noAccentLines', fn: (h) => detectAccentLines(h) },
  { id: 'noIconContainers', gate: 'noIconContainers', fn: (h) => detectIconContainers(h) },
  { id: 'noExcessOutlines', gate: 'noExcessOutlines', fn: (h) => detectExcessOutlines(h) },
  { id: 'noAiSparkleIcons', gate: 'noAiSparkleIcons', fn: (h) => detectSparkleIcons(h) },
  { id: 'noEmphasisColor', gate: 'noEmphasisColor', fn: (h) => detectEmphasisColor(h) },
  { id: 'noInter', gate: 'noInter', fn: (h) => detectInter(h) },
  { id: 'forbiddenColors', fn: (h) => detectForbiddenColors(h) },
  { id: 'inlineStyles', fn: (h) => detectInlineStyles(h) },
]

// Run all enabled detectors. A rule is enabled when it isn't explicitly
// disabled in the brief's per-design aiRules map. forbiddenColors and
// inlineStyles always run (they aren't user-toggleable).
export function lintHtml(html: string, aiRules: Record<string, boolean> | null | undefined): LintViolation[] {
  const out: LintViolation[] = []
  for (const d of DETECTORS) {
    if (d.gate) {
      const enabled = aiRules == null || aiRules[d.gate] !== false
      if (!enabled) continue
    }
    try {
      const v = d.fn(html, aiRules ?? null)
      if (v) out.push(v)
    } catch {
      // Swallow detector errors — never block the run on a regex bug.
    }
  }
  return out
}

// Build a terse fix prompt the model can act on. Keeps token budget tight:
// one line per violation + up to 3 examples per rule.
export function buildFixPrompt(violations: LintViolation[], previousFile: string, nextFile: string): string {
  const lines: string[] = []
  lines.push(`The previous version (./${previousFile}) violated style rules. Fix these and save as ./${nextFile}. Keep all layout, copy, sections, and palette otherwise identical — minimum diff.`)
  lines.push('')
  lines.push('Violations:')
  for (const v of violations) {
    lines.push(`- ${v.message}`)
    if (v.examples.length) {
      lines.push(`  e.g. ${v.examples.slice(0, 3).map((s) => JSON.stringify(s)).join(', ')}`)
    }
  }
  return lines.join('\n')
}
