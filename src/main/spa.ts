/**
 * Serving a design preview over a loopback origin.
 *
 * `looksLikeSpa` -- which decides whether a preview needs one at all, and why
 * -- lives in src/shared/spa.ts, because the canvas asks the question and the
 * server answers it.
 *
 * These live apart from the server so they can be tested without Electron.
 */

const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  mp4: 'video/mp4',
  webm: 'video/webm',
  txt: 'text/plain; charset=utf-8',
  map: 'application/json; charset=utf-8'
}

/** What to send back as the type. Unknown means "bytes", not "guess". */
export function contentType(pathname: string): string {
  const ext = /\.([a-z0-9]+)$/i.exec(pathname)?.[1]?.toLowerCase()
  return (ext && TYPES[ext]) || 'application/octet-stream'
}

/**
 * The path within the design directory a request is asking for, or null.
 *
 * The server hands out whatever is under one directory, so a request that
 * climbs out of it -- `../../.ssh/id_rsa`, or an absolute path, or one
 * smuggled in percent-encoded -- has to come back as nothing at all rather
 * than as a file.
 */
export function requestPath(url: string): string | null {
  let pathname: string
  try { pathname = new URL(url, 'http://127.0.0.1').pathname } catch { return null }
  let decoded: string
  try { decoded = decodeURIComponent(pathname) } catch { return null }
  if (decoded.includes('\0')) return null
  const parts = decoded.split('/').filter((p) => p !== '' && p !== '.')
  // A `..` is refused rather than resolved: resolving it quietly turns a
  // request for something outside into a request for something inside, and
  // no honest asset path contains one.
  if (parts.some((p) => p === '..' || p.includes('\\'))) return null
  return parts.join('/')
}

/**
 * Whether this request wants the app itself rather than one of its files.
 *
 * A router's route -- "/", "/pricing", "/projects/42" -- has no extension.
 * Asking the disk for it gives a 404 and a blank page, so it is answered
 * with the document instead, which is what a server with SPA fallback does.
 */
export function isRoute(path: string): boolean {
  if (path === '') return true
  const last = path.split('/').pop() ?? ''
  return !/\.[a-z0-9]+$/i.test(last)
}
