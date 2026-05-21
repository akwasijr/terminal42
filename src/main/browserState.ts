import { ipcMain } from 'electron'
import { getDb } from './db'
import { runningPreviewList } from './preview'

const SESSION_WILDCARD = '*'

/**
 * Strip control chars + stray glyphs that aren't valid in a real URL.
 * Mirrors the renderer-side sanitiser. Defensive: legacy DB rows may have
 * been written before this guard existed (e.g. ANSI escape sequences pasted
 * from terminal output).
 */
const URL_JUNK_RAW = /[\u0000-\u001F\u007F\u25C9\u25CE\u25CF\u25CB\u2022\u2023\u2219\u2299]/g
const URL_JUNK_PCT = /(%(?:0[0-9A-Fa-f]|1[0-9A-Fa-f]|7F)|%E2%80%A2|%E2%97%8[9BEF])/g
const URL_ANSI = /(?:\x1b|%1[Bb])\[[0-9;]*[A-Za-z]/g
function sanitiseUrl(s: string): string {
  return (s || '')
    .replace(URL_ANSI, '')
    .replace(URL_JUNK_PCT, '')
    .replace(URL_JUNK_RAW, '')
    .trim()
}

type ResolveSource = 'init' | 'scoped-session' | 'scoped-project' | 'live-preview' | 'none'

export type BrowserUrlResolution = {
  url: string | null
  source: ResolveSource
  /**
   * The project this URL belongs to. Always equals the projectId we were
   * asked about: included so the renderer can race-guard a stale promise
   * against a newer projectId switch.
   */
  projectId: string | null
}

export type BrowserOpenSnapshot = {
  isOpen: boolean
  /** True if main has a record (false means "never set"). */
  hasPreference: boolean
}

function projectExists(projectId: string): boolean {
  if (!projectId) return false
  const row = getDb().prepare('SELECT 1 FROM projects WHERE id = ? LIMIT 1').get(projectId) as
    | { 1: number }
    | undefined
  return !!row
}

function readScopedUrl(projectId: string, sessionId: string | null): string | null {
  const db = getDb()
  if (sessionId) {
    const row = db
      .prepare('SELECT url FROM browser_urls WHERE project_id = ? AND session_id = ?')
      .get(projectId, sessionId) as { url: string } | undefined
    if (row?.url) return sanitiseUrl(row.url) || null
  }
  const row = db
    .prepare('SELECT url FROM browser_urls WHERE project_id = ? AND session_id = ?')
    .get(projectId, SESSION_WILDCARD) as { url: string } | undefined
  const cleaned = row?.url ? sanitiseUrl(row.url) : null
  return cleaned || null
}

function writeScopedUrl(projectId: string, sessionId: string | null, url: string): void {
  const clean = sanitiseUrl(url)
  if (!projectId || !clean) return
  if (!projectExists(projectId)) return
  const now = Date.now()
  const db = getDb()
  const upsert = db.prepare(`
    INSERT INTO browser_urls (project_id, session_id, url, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(project_id, session_id) DO UPDATE SET url = excluded.url, updated_at = excluded.updated_at
  `)
  // Always update the project default + (optionally) the per-session URL.
  // The two writes happen in a transaction so a project never ends up with
  // a session-specific URL but no project default.
  db.transaction(() => {
    upsert.run(projectId, SESSION_WILDCARD, clean, now)
    if (sessionId) upsert.run(projectId, sessionId, clean, now)
  })()
}

function clearProjectUrls(projectId: string): void {
  getDb().prepare('DELETE FROM browser_urls WHERE project_id = ?').run(projectId)
}

function readOpenState(projectId: string): BrowserOpenSnapshot {
  const row = getDb()
    .prepare('SELECT is_open FROM browser_open_state WHERE project_id = ?')
    .get(projectId) as { is_open: number } | undefined
  if (!row) return { isOpen: false, hasPreference: false }
  return { isOpen: !!row.is_open, hasPreference: true }
}

function writeOpenState(projectId: string, isOpen: boolean): void {
  if (!projectExists(projectId)) return
  getDb()
    .prepare(`
      INSERT INTO browser_open_state (project_id, is_open, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET is_open = excluded.is_open, updated_at = excluded.updated_at
    `)
    .run(projectId, isOpen ? 1 : 0, Date.now())
}

function findLivePreview(projectId: string): string | null {
  const list = runningPreviewList()
  const mine = list.find((r) => r.projectId === projectId && r.url)
  return mine?.url ?? null
}

/**
 * Resolve which URL the BrowserPane should display for a given
 * (project, session). Order:
 *   1. Caller-supplied initialUrl wins (an explicit "open this in browser"
 *      action from a recipe, etc.): and we persist it as the new default.
 *   2. Per-(project, session) scoped URL.
 *   3. Per-project scoped URL (most recent across sessions).
 *   4. A running dev-server URL whose registry-recorded projectId matches.
 *   5. Otherwise: nothing. The pane renders its empty state. We never fall
 *      back to a global "last URL": that was the cross-project leak.
 */
function resolveUrl(args: {
  projectId: string | null
  sessionId: string | null
  initialUrl?: string | null
}): BrowserUrlResolution {
  const { projectId, sessionId, initialUrl } = args
  if (!projectId) return { url: null, source: 'none', projectId: null }
  if (initialUrl) {
    writeScopedUrl(projectId, sessionId, initialUrl)
    return { url: initialUrl, source: 'init', projectId }
  }
  const sessionUrl = sessionId
    ? (() => {
        const row = getDb()
          .prepare('SELECT url FROM browser_urls WHERE project_id = ? AND session_id = ?')
          .get(projectId, sessionId) as { url: string } | undefined
        return row?.url ?? null
      })()
    : null
  if (sessionUrl) return { url: sessionUrl, source: 'scoped-session', projectId }
  const projectUrl = readScopedUrl(projectId, null)
  if (projectUrl) return { url: projectUrl, source: 'scoped-project', projectId }
  const live = findLivePreview(projectId)
  if (live) {
    writeScopedUrl(projectId, sessionId, live)
    return { url: live, source: 'live-preview', projectId }
  }
  return { url: null, source: 'none', projectId }
}

/**
 * Drop URLs and open-state rows for projects that no longer exist. The FK
 * cascade handles project-deletion races, but we run this on boot to clean
 * up rows from very old builds that wrote without enforcing the FK.
 */
function pruneOrphans(): void {
  const db = getDb()
  db.exec(`
    DELETE FROM browser_urls
    WHERE project_id NOT IN (SELECT id FROM projects);
    DELETE FROM browser_open_state
    WHERE project_id NOT IN (SELECT id FROM projects);
  `)
}

/**
 * One-shot cleanup of historical browser_urls rows that contain control
 * characters or stray glyphs. Cheap to run on every boot: typical row
 * count is tiny and the LIKE filter narrows it further.
 */
function scrubLegacyJunkUrls(): void {
  const db = getDb()
  // Pull every row and run sanitiser locally: cheap (tiny table) and avoids
  // having to encode every junk pattern into SQL.
  const rows = db.prepare('SELECT rowid, url FROM browser_urls').all() as Array<{
    rowid: number
    url: string
  }>
  if (!rows.length) return
  const update = db.prepare('UPDATE browser_urls SET url = ? WHERE rowid = ?')
  const del = db.prepare('DELETE FROM browser_urls WHERE rowid = ?')
  db.transaction(() => {
    for (const r of rows) {
      const clean = sanitiseUrl(r.url)
      if (clean === r.url) continue
      if (clean) update.run(clean, r.rowid)
      else del.run(r.rowid)
    }
  })()
}

export function registerBrowserStateIpc(): void {
  pruneOrphans()
  scrubLegacyJunkUrls()

  ipcMain.handle(
    'browser:url:resolve',
    (_e, args: { projectId: string | null; sessionId: string | null; initialUrl?: string | null }) =>
      resolveUrl(args)
  )

  ipcMain.handle(
    'browser:url:set',
    (_e, args: { projectId: string; sessionId: string | null; url: string }) => {
      writeScopedUrl(args.projectId, args.sessionId, args.url)
      return { ok: true }
    }
  )

  ipcMain.handle('browser:url:clear', (_e, args: { projectId: string }) => {
    clearProjectUrls(args.projectId)
    return { ok: true }
  })

  ipcMain.handle('browser:open:get', (_e, args: { projectId: string }) => readOpenState(args.projectId))

  ipcMain.handle('browser:open:set', (_e, args: { projectId: string; isOpen: boolean }) => {
    writeOpenState(args.projectId, args.isOpen)
    return { ok: true }
  })
}
