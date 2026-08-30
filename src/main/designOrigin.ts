/**
 * A loopback origin for design previews that need an address.
 *
 * See spa.ts for why: an app built around a router cannot work inside
 * srcDoc, because about:srcdoc gives it a pathname of "srcdoc" and no route
 * matches that. Served from here it sits at "/", where its index route is.
 *
 * The document served at "/" is the one the canvas has already prepared --
 * annotator, editor and tweak runner injected -- rather than the file on
 * disk, so serving a design changes where the preview lives without changing
 * what is in it. Everything else comes from the design's own directory, so
 * its images, fonts and chunks resolve the way they would anywhere else.
 *
 * One server per design directory, kept for as long as the app runs: a
 * preview reloads on every edit, and standing a server up and tearing it
 * down each time would change the port each time and reload the iframe from
 * scratch.
 */

import { createServer, type Server } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { contentType, isRoute, requestPath } from './spa'
import { withAgent } from '../shared/frameAgent'

type Origin = { server: Server; url: string; root: string; html: string }

const origins = new Map<string, Origin>()

function listen(server: Server): Promise<number> {
  return new Promise((ok, fail) => {
    server.once('error', fail)
    // Loopback only. This serves a directory the user has not asked anyone
    // else to see, and binding it to every interface would put it on the
    // network for whoever is sharing the café's wifi.
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') ok(addr.port)
      else fail(new Error('no port'))
    })
  })
}

/**
 * Serve `html` at the root of an origin backed by `root`, and return its URL.
 *
 * Calling again for the same directory replaces the document and hands back
 * the same URL, so a reload is a reload rather than a new origin.
 */
export async function serveDesign(root: string, html: string): Promise<string> {
  const key = resolve(root)
  const existing = origins.get(key)
  if (existing) {
    existing.html = html
    return existing.url
  }

  const state: Origin = { server: null as unknown as Server, url: '', root: key, html }

  const server = createServer((req, res) => {
    const path = requestPath(req.url ?? '/')
    if (path === null) {
      res.writeHead(400).end('Bad request')
      return
    }
    if (isRoute(path)) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        // The document changes on every edit and is only ever a few
        // kilobytes; a cached copy would show yesterday's design.
        'Cache-Control': 'no-store'
      // The page is on its own origin, so the canvas cannot reach into it.
      // The agent goes in here, on the way out, because this is the last
      // point at which anything of ours touches the document.
      }).end(withAgent(state.html))
      return
    }
    const file = join(state.root, path)
    // join() has already flattened the path, so this is the belt to
    // requestPath's braces: anything that ended up outside is not ours.
    if (file !== state.root && !file.startsWith(state.root + sep)) {
      res.writeHead(403).end('Forbidden')
      return
    }
    void stat(file)
      .then((s) => {
        if (!s.isFile()) throw new Error('not a file')
        res.writeHead(200, { 'Content-Type': contentType(path), 'Cache-Control': 'no-store' })
        createReadStream(file).pipe(res)
      })
      .catch(() => { res.writeHead(404).end('Not found') })
  })

  const port = await listen(server)
  state.server = server
  state.url = `http://127.0.0.1:${port}/`
  origins.set(key, state)
  return state.url
}

/** Shut every origin down. Called when the app quits. */
export function stopDesignOrigins(): void {
  for (const o of origins.values()) {
    try { o.server.close() } catch { /* already gone */ }
  }
  origins.clear()
}
