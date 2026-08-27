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

export function requestTokens(): void {
  pending = true
}

/** True once per request. */
export function takeTokensRequest(): boolean {
  const was = pending
  pending = false
  return was
}
