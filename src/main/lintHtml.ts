// HTML lint rules: high-confidence, regex-based detection of AI-default design
// violations in generated single-file designs. Each detector is gated by its
// AI rule id (see aiRules.ts), so a rule the user turned off is not enforced.
// When a brief carries no rule map (aiRules === null) every detector runs.

import type { AiRuleId } from '../renderer/src/lib/aiRules'
import { FORBIDDEN_HEX_FOR_LINT } from './lintConstants'

export type LintViolation = {
  rule: string
  message: string
  selector?: string
}

const EMOJI_RE = /\p{Extended_Pictographic}/u
const GRADIENT_RE = /(linear|radial|conic)-gradient\s*\(/i
const UPPERCASE_RE = /text-transform\s*:\s*uppercase/i
const AI_FONT_RE = /font-family\s*:[^;{}]*\b(Inter|Roboto)\b/i
const EM_DASH_RE = /\u2014/
const BLUR_RE = /(?:-webkit-)?backdrop-filter\s*:\s*[^;{}]*blur/i
const PROGRESS_RE =
  /data-scroll-progress|(?:class|id)\s*=\s*["'][^"']*(?:scroll-progress|reading-progress|progress-bar)[^"']*["']/i

function heavyShadow(html: string): boolean {
  const re = /box-shadow\s*:\s*([^;{}]+)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const val = m[1].trim()
    if (/^none$/i.test(val)) continue
    // Flag if any length in the value reaches 24px or more (heavy blur/offset).
    const nums = val.match(/(\d+(?:\.\d+)?)px/g)
    if (nums && nums.some((n) => parseFloat(n) >= 24)) return true
  }
  return false
}

export function lintHtml(html: string, aiRules: AiRuleId[] | null): LintViolation[] {
  if (!html) return []
  const on = (id: string): boolean => !aiRules || aiRules.includes(id)
  const out: LintViolation[] = []

  if (on('no-gradients') && GRADIENT_RE.test(html)) {
    out.push({
      rule: 'no-gradients',
      message: 'A CSS gradient is used. Replace it with a solid color.',
    })
  }

  if (on('no-default-palette')) {
    const lower = html.toLowerCase()
    const hits = FORBIDDEN_HEX_FOR_LINT.filter((hex) => lower.includes(hex))
    if (hits.length) {
      out.push({
        rule: 'no-default-palette',
        message: `AI-default indigo/violet/purple colors are used (${hits.join(', ')}). Swap them for a brand-specific palette.`,
      })
    }
  }

  if (on('no-emoji-icons') && EMOJI_RE.test(html)) {
    out.push({
      rule: 'no-emoji-icons',
      message: 'Emoji are present. Replace any emoji used as icons with inline SVG line icons.',
    })
  }

  if (on('no-all-caps') && UPPERCASE_RE.test(html)) {
    out.push({
      rule: 'no-all-caps',
      message: 'text-transform: uppercase is used. Use sentence or title case instead.',
    })
  }

  if (on('flat-surfaces') && heavyShadow(html)) {
    out.push({
      rule: 'flat-surfaces',
      message: 'A heavy box-shadow is used. Keep surfaces flat (separate with whitespace, a hairline or a flat tint).',
    })
  }

  if (on('distinct-fonts') && AI_FONT_RE.test(html)) {
    out.push({
      rule: 'distinct-fonts',
      message: 'An AI-default font (Inter or Roboto) is used. Choose a more distinctive display + body pairing.',
    })
  }

  if (on('no-em-dash') && EM_DASH_RE.test(html)) {
    out.push({
      rule: 'no-em-dash',
      message: 'An em dash is used in the copy. Replace it with a comma, period or parentheses.',
    })
  }

  if (on('no-header-blur') && BLUR_RE.test(html)) {
    out.push({
      rule: 'no-header-blur',
      message: 'A backdrop-filter blur (frosted-glass) is used. Give the header a solid background instead.',
    })
  }

  if (on('no-progress-bar') && PROGRESS_RE.test(html)) {
    out.push({
      rule: 'no-progress-bar',
      message: 'A scroll / reading progress bar is present. Remove it.',
    })
  }

  return out
}

export function buildFixPrompt(
  violations: LintViolation[],
  previousFile: string,
  nextFile: string,
): string {
  if (!violations.length) return ''
  const bullets = violations.map((v) => `- ${v.message}`).join('\n')
  return [
    `The current design in ${previousFile} breaks some of the enforced design rules:`,
    bullets,
    '',
    `Fix every issue above while keeping the layout, content and intent unchanged, then save the corrected design as ${nextFile}. Do not introduce new gradients, emoji, all-caps, heavy shadows or AI-default colors.`,
  ].join('\n')
}
