// AI rule definitions — stripped for public release.
// Add your own rules to fight AI default patterns.

export type AiRuleId = string

export type AiRule = {
  id: AiRuleId
  label: string
  description: string
  default: boolean
}

export const AI_RULES: AiRule[] = []

export function formatRulesForPrompt(activeIds: string[]): string {
  return ''
}
