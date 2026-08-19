// The model catalog's static half, shared by the main process and the
// renderer so there is exactly one list to update.
//
// The live catalog is fetched from the Copilot CLI at runtime (see
// main/models.ts) and is always the source of truth once it arrives. What
// lives here is the baseline shown before that first fetch lands, and the
// permanent fallback for environments where the CLI path never works.
//
// This list previously existed twice — once in main/models.ts and once in
// ModelDropdown.tsx, kept in sync by hand. They drifted, which is how retired
// models (entitlements that no longer resolve) kept appearing in the picker.
// Import from here instead of re-declaring a list.

export type DisplayModel = { id: string; label: string; group: string }

/**
 * Mirrors the entitlement-filtered list the CLI currently returns. When the
 * live fetch reports models that are not here, update this list rather than
 * letting the two diverge again.
 */
export const FALLBACK_MODELS: DisplayModel[] = [
  { id: 'claude-opus-5', label: 'Claude Opus 5', group: 'Anthropic' },
  { id: 'claude-opus-4.8', label: 'Claude Opus 4.8', group: 'Anthropic' },
  { id: 'claude-opus-4.7', label: 'Claude Opus 4.7', group: 'Anthropic' },
  { id: 'claude-opus-4.6', label: 'Claude Opus 4.6', group: 'Anthropic' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', group: 'Anthropic' },
  { id: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6', group: 'Anthropic' },
  { id: 'claude-haiku-4.5', label: 'Claude Haiku 4.5', group: 'Anthropic' },
  { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', group: 'OpenAI' },
  { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', group: 'OpenAI' },
  { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', group: 'OpenAI' },
  { id: 'gpt-5.5', label: 'GPT-5.5', group: 'OpenAI' },
  { id: 'gpt-5.4', label: 'GPT-5.4', group: 'OpenAI' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini', group: 'OpenAI' },
  { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', group: 'OpenAI' },
  { id: 'gpt-5-mini', label: 'GPT-5 mini', group: 'OpenAI' },
  { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash', group: 'Google' },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', group: 'Google' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', group: 'Google' },
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', group: 'Google' },
  { id: 'grok-4.6', label: 'Grok 4.6', group: 'xAI' },
  { id: 'grok-4.5', label: 'Grok 4.5', group: 'xAI' },
  { id: 'mai-code-1.1-flash', label: 'MAI-Code-1.1-Flash', group: 'Microsoft' },
  { id: 'mai-code-1-flash-picker', label: 'MAI-Code-1-Flash', group: 'Microsoft' }
]

const KNOWN_PREFIXES: Array<{ test: RegExp; group: string }> = [
  { test: /^claude-/i, group: 'Anthropic' },
  { test: /^gpt-/i, group: 'OpenAI' },
  { test: /^o[0-9]/i, group: 'OpenAI' },
  { test: /^gemini-/i, group: 'Google' },
  { test: /^grok-/i, group: 'xAI' },
  { test: /^mai-/i, group: 'Microsoft' },
  { test: /^phi-/i, group: 'Microsoft' }
]

/** Groups a live model ID by provider so new IDs land in the right section. */
export function inferGroup(id: string): string {
  for (const { test, group } of KNOWN_PREFIXES) {
    if (test.test(id)) return group
  }
  return 'Other'
}

/** Provider section order in the picker; unknown providers sort last. */
export const GROUP_ORDER = ['Anthropic', 'OpenAI', 'Google', 'xAI', 'Microsoft', 'Other']

export function compareGroups(a: string, b: string): number {
  const ia = GROUP_ORDER.indexOf(a)
  const ib = GROUP_ORDER.indexOf(b)
  return (ia === -1 ? GROUP_ORDER.length : ia) - (ib === -1 ? GROUP_ORDER.length : ib)
}

/**
 * Maps a requested model onto one the given catalog will actually accept.
 *
 * Model IDs outlive the entitlements behind them: a session, design or recipe
 * saved months ago still carries whatever was selected at the time, and the
 * CLI emits internal IDs (`claude-opus-4.7-1m-internal`) that never appear in
 * the catalog at all. Passing a retired ID straight through to `--model`
 * fails the whole run, so resolve it first.
 *
 * Returns null when the flag should simply be omitted, letting the CLI pick
 * its own default — always better than failing on a name.
 */
export function resolveModelAgainst(
  catalog: DisplayModel[],
  requested: string | null | undefined
): string | null {
  if (!requested) return null
  // "auto" is the CLI's own router, not a catalog entry — pass it through.
  if (requested === 'auto') return 'auto'
  if (catalog.some((m) => m.id === requested)) return requested

  // Internal variants (`-1m-internal`, `-high`) decorate a real ID.
  const base = requested
    .replace(/-(?:\d+m-)?internal$/i, '')
    .replace(/-(?:high|low|1m)$/i, '')
  if (base !== requested && catalog.some((m) => m.id === base)) return base

  // Otherwise prefer another model from the same provider over something from
  // an unrelated family.
  const sameProvider = catalog.find((m) => m.group === inferGroup(requested))
  if (sameProvider) return sameProvider.id

  return null
}
