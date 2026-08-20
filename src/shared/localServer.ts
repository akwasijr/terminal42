// Finding the local server a turn started.
//
// A page written to disk is not always viewable from disk. When the agent
// builds something with a backend — a status page that polls its own
// `/api/status`, a form that posts to itself — the file:// copy loads but
// every request it makes fails, and the user sees a broken page next to a
// message saying it works. That is the same page, served two different ways,
// and only one of them is real.
//
// The agent tells us which: it announces the address it started
// ("Status page is live at http://localhost:3131"), and its own tool calls
// run against that address. So we read the URL out of the turn rather than
// guessing a port or probing the machine.

const LOCAL_URL_RE = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::(\d{2,5}))?(?:\/[^\s"'`<>)\]}]*)?/gi

/**
 * Every distinct local server URL mentioned in a turn, in the order seen,
 * normalised to an origin (`http://localhost:3131`).
 *
 * Paths are dropped on purpose: the origin is what tells us a server exists,
 * and the page to open is decided separately from the file the turn wrote.
 * `0.0.0.0` is rewritten to `localhost` because a server binding all
 * interfaces is not reachable at that address from a browser.
 */
export function localServerOrigins(text: string): string[] {
  if (!text) return []
  const out: string[] = []
  for (const m of text.matchAll(LOCAL_URL_RE)) {
    const port = m[1]
    // A bare host with no port is the default port, which is almost never
    // what a scratch server uses; without one we cannot address it.
    if (!port) continue
    const n = Number(port)
    if (!Number.isInteger(n) || n < 1 || n > 65535) continue
    const origin = `http://localhost:${n}`
    if (!out.includes(origin)) out.push(origin)
  }
  return out
}

/**
 * The single origin to prefer, or null.
 *
 * The last one mentioned wins: when a turn retries on a new port after a
 * collision, the address it settled on is the one it printed last.
 */
export function pickLocalServerOrigin(text: string): string | null {
  const all = localServerOrigins(text)
  return all.length > 0 ? all[all.length - 1] : null
}

/**
 * The candidate URLs for a page, best guess first.
 *
 * Where the server's root sits is genuinely ambiguous: a server started in
 * `statuspage/` serves that page at `/`, while one started in the project
 * root serves it at `/statuspage/index.html`. Both are plausible from what a
 * turn tells us, so instead of guessing once we hand the caller an ordered
 * list to try. `resolveServerUrl` walks it against the running server, which
 * settles the question by asking rather than assuming.
 */
export function serverUrlCandidates(origin: string, cwd: string, path: string): string[] {
  const base = origin.replace(/\/+$/, '')
  const rel = relativeTo(cwd, path)
  const out: string[] = []
  if (rel && !/^index\.html?$/i.test(rel)) {
    out.push(`${base}/${rel.split('/').map(encodeURIComponent).join('/')}`)
  }
  // The root is the fallback because a scratch server almost always serves
  // its app there, and it is the one request a server is certain to answer.
  out.push(`${base}/`)
  return out
}

/**
 * The first candidate the server actually serves, or null if it serves none.
 *
 * Returning null matters: it means the origin we read out of the turn is
 * stale or wrong, and the caller should fall back to the file on disk rather
 * than show a connection error.
 */
export async function resolveServerUrl(
  origin: string,
  cwd: string,
  path: string,
  reachable: (url: string) => Promise<boolean>
): Promise<string | null> {
  for (const url of serverUrlCandidates(origin, cwd, path)) {
    try {
      if (await reachable(url)) return url
    } catch {
      // An unreachable candidate is just a candidate that lost; a dead server
      // must not take the preview down with it.
    }
  }
  return null
}

function relativeTo(cwd: string, path: string): string {
  if (!path.startsWith('/')) return path.replace(/^\.\//, '')
  const base = cwd.replace(/\/+$/, '')
  if (base && path.startsWith(`${base}/`)) return path.slice(base.length + 1)
  // Absolute path outside the working directory: we have no idea how the
  // server maps it, so only the root is worth trying.
  return ''
}
