// AI rule definitions — stripped for public release.
// Add your own rules to fight AI default patterns.

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

export const AI_RULES: AiRule[] = []

export const AI_RULE_GROUPS: AiRuleGroup[] = []

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

export function formatRulesForPrompt(_activeIds: string[]): string {
  return ''
}
