// One rule for whether a context-usage reading is worth showing, and how.
//
// This exists because the Status tab and the Harness tab were each deciding
// for themselves. Status hid a reading once it went stale; Harness kept
// rendering it. The same session could therefore show a context percentage in
// one tab and nothing in the other, which is exactly what makes a number look
// invented even when it isn't.
//
// The token count itself is real: it comes from the Copilot CLI's own
// accounting in its events log, not from a character-count estimate. But the
// CLI only emits it at discrete lifecycle events, so between them the figure
// is frozen. A frozen number presented as live is a lie by omission, hence the
// staleness cutoff and the explicit "as of" wording.

export type ContextUsageLike = {
  inputTokens: number
  contextLimit: number
  percent: number
  sourceTimestamp: string | null
}

/**
 * How old a reading may be before we stop showing it.
 *
 * Five minutes is long enough to survive a quiet spell mid-turn, short enough
 * that a number left over from a session that has since moved on disappears
 * instead of misleading.
 */
export const CONTEXT_STALE_MS = 5 * 60 * 1000

export type ContextDisplay = {
  percent: number
  usedTokens: number
  limitTokens: number
  /** e.g. "69k / 200k" */
  usedOfLimit: string
  /** Age of the underlying CLI reading, in ms. */
  ageMs: number
  tone: 'normal' | 'warning' | 'critical'
}

/**
 * Present a reading, or null when it should not be shown at all.
 *
 * Returns null when there is no session, no reading, a zero token count (the
 * CLI has not reported yet), an unknown context limit, or a reading old enough
 * to be untrustworthy. Callers render nothing in that case rather than
 * substituting a placeholder number.
 */
export function contextDisplay(
  usage: ContextUsageLike | null | undefined,
  opts: { hasSession: boolean; now?: number } = { hasSession: true }
): ContextDisplay | null {
  if (!opts.hasSession) return null
  if (!usage) return null
  if (usage.inputTokens <= 0) return null
  if (usage.contextLimit <= 0) return null

  const now = opts.now ?? Date.now()
  const ageMs = contextAgeMs(usage.sourceTimestamp, now)
  if (ageMs > CONTEXT_STALE_MS) return null

  const percent = clampPercent(usage.percent)
  return {
    percent,
    usedTokens: usage.inputTokens,
    limitTokens: usage.contextLimit,
    usedOfLimit: `${formatTokens(usage.inputTokens)} / ${formatTokens(usage.contextLimit)}`,
    ageMs,
    tone: percent >= 90 ? 'critical' : percent >= 75 ? 'warning' : 'normal'
  }
}

/**
 * Age of a reading. An absent or unparseable timestamp is treated as
 * infinitely old, so an undated reading is hidden rather than trusted.
 */
export function contextAgeMs(sourceTimestamp: string | null | undefined, now: number = Date.now()): number {
  if (!sourceTimestamp) return Infinity
  const t = new Date(sourceTimestamp).getTime()
  if (!Number.isFinite(t)) return Infinity
  return Math.max(0, now - t)
}

function clampPercent(p: number): number {
  if (!Number.isFinite(p)) return 0
  return Math.max(0, Math.min(100, Math.round(p)))
}

/** 1234 -> "1.2k", 69300 -> "69k", 900 -> "900". */
export function formatTokens(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0'
  if (n < 1000) return String(Math.round(n))
  const k = n / 1000
  return k >= 10 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`
}
