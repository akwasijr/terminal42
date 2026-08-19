// Distinguishes a hiccup from a wall.
//
// Auto-continue's whole job is to restart work that stopped early, but the
// reason it stopped decides whether restarting is helpful or harmful. A
// dropped connection is worth another go. An expired token, an exhausted
// quota or a model the account cannot reach will fail identically every time,
// and poking through that burns real money to reproduce the same error.
//
// So the classifier is asymmetric on purpose: 'fatal' has to be recognised
// explicitly, and anything unrecognised is 'unknown' rather than retryable.
// Guessing "probably transient" is exactly how a poke loop runs away.

export type CliErrorKind = 'transient' | 'fatal' | 'unknown'

type Rule = { kind: CliErrorKind; test: RegExp }

// Ordered: fatal wins over transient, because a message like "429 quota
// exceeded for the month" contains both a retryable-looking status code and a
// permanent condition.
const RULES: Rule[] = [
  // --- Fatal: state a human has to change ---
  { kind: 'fatal', test: /\b(401|403)\b|\bunauthor(ized|ised)\b|\bforbidden\b/i },
  { kind: 'fatal', test: /\b(authentication|auth|token|credential)s?\s+(failed|expired|invalid|revoked)\b/i },
  { kind: 'fatal', test: /\bplease (re-?)?(login|log in|authenticate|sign in)\b/i },
  { kind: 'fatal', test: /\b(quota|credit|balance|allowance)s?\s+(exceeded|exhausted|depleted|insufficient)\b/i },
  { kind: 'fatal', test: /\binsufficient\s+(quota|credits?|funds|balance)\b/i },
  { kind: 'fatal', test: /\bmonthly (limit|quota) (reached|exceeded)\b/i },
  { kind: 'fatal', test: /\b(model|endpoint) .{0,40}\b(not found|unavailable to|not supported|does not exist)\b/i },
  { kind: 'fatal', test: /\bpermission denied\b|\bEACCES\b/i },
  { kind: 'fatal', test: /\bno such file or directory\b|\bENOENT\b/i },
  { kind: 'fatal', test: /\bcommand not found\b/i },

  // --- Transient: the same request may well succeed next time ---
  { kind: 'transient', test: /\b(429|500|502|503|504)\b/ },
  { kind: 'transient', test: /\brate.?limit(ed|ing)?\b/i },
  { kind: 'transient', test: /\b(ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|EAI_AGAIN|ENOTFOUND)\b/ },
  { kind: 'transient', test: /\b(network|connection|socket)\b.{0,30}\b(error|failed|reset|closed|refused|lost)\b/i },
  { kind: 'transient', test: /\btimed? ?out\b|\btimeout\b/i },
  { kind: 'transient', test: /\b(temporar(y|ily)|try again|retry(ing)?)\b/i },
  { kind: 'transient', test: /\b(service|server) (unavailable|overloaded|busy)\b/i },
  { kind: 'transient', test: /\bupstream (error|failure)\b/i }
]

/**
 * Classifies the tail of a session's output.
 *
 * Only the tail is considered by the caller: an authentication failure from
 * an hour ago that the user has since fixed must not pin the session as fatal
 * forever.
 */
export function classifyCliError(text: string): CliErrorKind {
  if (!text) return 'unknown'

  let sawTransient = false
  for (const rule of RULES) {
    if (!rule.test.test(text)) continue
    // Fatal short-circuits; a permanent condition is not made retryable by
    // also mentioning a timeout.
    if (rule.kind === 'fatal') return 'fatal'
    sawTransient = true
  }
  return sawTransient ? 'transient' : 'unknown'
}

/**
 * Whether auto-continue may poke given what the output looks like.
 *
 * 'unknown' is allowed through: most turns end with no error text at all, and
 * refusing to continue whenever we cannot prove things are fine would make the
 * feature useless. What must never be allowed is a recognised fatal error.
 */
export function pokeAllowedForError(kind: CliErrorKind): boolean {
  return kind !== 'fatal'
}

export function describeCliError(kind: CliErrorKind): string {
  switch (kind) {
    case 'fatal':
      return 'stopped: the session reported an error that will not resolve on its own'
    case 'transient':
      return 'a transient failure was reported, so continuing is worth trying'
    default:
      return 'no error detected'
  }
}
