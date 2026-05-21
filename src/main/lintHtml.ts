// HTML lint rules — stripped for public release.
// Add your own post-generation lint rules here.

import type { AiRuleId } from '../renderer/src/lib/aiRules'

export type LintViolation = {
  rule: string
  message: string
  selector?: string
}

export function lintHtml(html: string, aiRules: AiRuleId[] | null): LintViolation[] {
  return []
}

export function buildFixPrompt(violations: LintViolation[], previousFile: string, nextFile: string): string {
  return ''
}
