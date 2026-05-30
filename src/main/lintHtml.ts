// HTML lint rules — stripped for public release.
// Add your own post-generation lint rules here.

import type { AiRuleId } from '../renderer/src/lib/aiRules'

export type LintViolation = {
  rule: string
  message: string
  selector?: string
}

export function lintHtml(_html: string, _aiRules: AiRuleId[] | null): LintViolation[] {
  return []
}

export function buildFixPrompt(_violations: LintViolation[], _previousFile: string, _nextFile: string): string {
  return ''
}
