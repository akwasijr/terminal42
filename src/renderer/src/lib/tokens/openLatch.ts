/**
 * "Show me the library" when the library screen is not on screen yet.
 *
 * The request and the arrival happen in that order: the tab switches, and only
 * then does the list mount and start listening. An event fired in between is
 * heard by nobody, which is exactly what happened the first time this was
 * wired with an event alone.
 *
 * So the request is left somewhere the list can find it whenever it turns up,
 * and taken rather than read, because a request that survives being answered
 * would drag somebody back to the library every time they left it.
 */

let pending = false
/**
 * "…and start a new one when you get there."
 *
 * Separate from the request above because arriving at the library and arriving
 * at the library with the setup open are different intents, and the New menu
 * is the only caller that means the second one.
 */
let pendingNew = false
/**
 * "…starting from this feel."
 *
 * A template card knows which of the nine feels you pressed. The wizard is
 * the thing that can act on it, and it does not exist yet at that moment, so
 * the answer waits here with the request it belongs to.
 */
let pendingFeel: string | null = null

export function requestTokens(): void {
  pending = true
}

/** True once per request. */
export function takeTokensRequest(): boolean {
  const was = pending
  pending = false
  return was
}

export function requestNewTokens(feel?: string): void {
  pending = true
  pendingNew = true
  pendingFeel = feel ?? null
}

/** The feel the new library should start on, if a template named one. */
export function takeNewTokensFeel(): string | null {
  const was = pendingFeel
  pendingFeel = null
  return was
}

/** True once per request. */
export function takeNewTokensRequest(): boolean {
  const was = pendingNew
  pendingNew = false
  return was
}
