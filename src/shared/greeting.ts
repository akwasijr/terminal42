// Greeting copy for the empty chat state.
//
// Kept pure and separate from the platform lookup so the naming rules can be
// tested without shelling out. The rule that matters: a login shortname is not
// a name. "akwasifosuhene" capitalised reads worse than no greeting at all, so
// anything that doesn't look like a human name is dropped and the greeting
// falls back to an impersonal form.

/** Longest name we'll show before it stops being a greeting and starts being a paragraph. */
const MAX_NAME_LENGTH = 24

/**
 * Pull a display first name out of a full name, or null when the input isn't
 * plausibly a person's name.
 */
export function firstNameFrom(raw: string | null | undefined): string | null {
  if (!raw) return null
  const cleaned = raw.replace(/[,;].*$/, '').trim()
  if (!cleaned) return null
  // Email addresses and paths turn up in git config; they aren't names.
  if (/[@/\\]/.test(cleaned)) return null
  const first = cleaned.split(/\s+/)[0]
  if (!first || first.length > MAX_NAME_LENGTH) return null
  // Require letters only (allowing internal hyphens/apostrophes as in
  // "Anne-Marie" or "O'Neill"). Digits or underscores mean it's a handle.
  if (!/^\p{L}[\p{L}'’-]*$/u.test(first)) return null
  // A single all-lowercase token with no spaces in the source is almost always
  // a login shortname rather than a first name.
  if (first === cleaned && first === first.toLowerCase() && first.length > 2 && !/[-'’]/.test(first)) {
    return null
  }
  return first[0].toLocaleUpperCase() + first.slice(1)
}

/** Headline for the empty chat state. */
export function buildGreeting(firstName: string | null): string {
  return firstName
    ? `Hi ${firstName}, let's build something great together`
    : "Let's build something great together"
}
