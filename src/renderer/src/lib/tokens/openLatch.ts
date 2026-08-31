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

/**
 * "…and open this one when you get there."
 *
 * A design system stands on a library and can now send somebody to it. Same
 * ordering problem as the request above: the tab switches first, so the id
 * waits here until the library screen turns up to take it.
 */
let pendingOpenId: string | null = null

export function requestTokens(): void {
  pending = true
}

/** Ask for the library list, already opened on one library. */
export function requestLibrary(id: string): void {
  pending = true
  pendingOpenId = id
}

/** The library to open on arrival, once per request. */
export function takeLibraryRequest(): string | null {
  const was = pendingOpenId
  pendingOpenId = null
  return was
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
