import { getDb } from './db'
import { stripAnsi } from './ansi'

const FLUSH_INTERVAL_MS = 2000
const MAX_BUFFER_BYTES = 32 * 1024
const RETAIN_MS = 1000 * 60 * 60 * 24 * 14 // 14 days

type Buf = { raw: string; lastFlush: number }
const buffers = new Map<string, Buf>()
let timer: NodeJS.Timeout | null = null

export function appendLog(sessionId: string, raw: string): void {
  if (!raw) return
  let b = buffers.get(sessionId)
  if (!b) {
    b = { raw: '', lastFlush: Date.now() }
    buffers.set(sessionId, b)
  }
  b.raw += raw
  if (b.raw.length >= MAX_BUFFER_BYTES) flushOne(sessionId)
  if (!timer) timer = setInterval(flushAll, FLUSH_INTERVAL_MS)
}

function flushOne(sessionId: string): void {
  const b = buffers.get(sessionId)
  if (!b || b.raw.length === 0) return
  // Hold back any trailing partial CSI/OSC sequence so we don't split an escape.
  let raw = b.raw
  let carry = ''
  const lastEsc = raw.lastIndexOf('\x1b')
  if (lastEsc >= 0) {
    const tail = raw.slice(lastEsc)
    // If the tail does NOT contain a terminator, it's an in-progress sequence: carry it.
    const hasTerminator =
      /\x1b\[[0-?]*[ -/]*[@-~]/.test(tail) ||  // CSI
      /\x1b\][^\x07\x1b]*(\x07|\x1b\\)/.test(tail) || // OSC
      /\x1b[()][A-Z0-9]/.test(tail) // SGR designator
    if (!hasTerminator) {
      carry = tail
      raw = raw.slice(0, lastEsc)
    }
  }
  const cleaned = stripAnsi(raw)
  b.raw = carry
  b.lastFlush = Date.now()
  if (!cleaned) return
  try {
    getDb()
      .prepare('INSERT INTO session_log (session_id, body, created_at) VALUES (?, ?, ?)')
      .run(sessionId, cleaned, Date.now())
  } catch {
    // session may have been deleted; drop log silently
  }
}

function flushAll(): void {
  for (const id of buffers.keys()) flushOne(id)
}

const BOUNDARY_MARKER = '\u0001T42-SPAWN\u0001'

export function markSessionBoundary(sessionId: string): void {
  // Force any pending buffer out first so the boundary lands cleanly between epochs.
  flushOne(sessionId)
  try {
    getDb()
      .prepare('INSERT INTO session_log (session_id, body, created_at) VALUES (?, ?, ?)')
      .run(sessionId, BOUNDARY_MARKER, Date.now())
  } catch {}
}

export function dropSessionLog(sessionId: string): void {
  buffers.delete(sessionId)
  try {
    getDb().prepare('DELETE FROM session_log WHERE session_id = ?').run(sessionId)
  } catch {}
}

export function purgeOldLogs(): void {
  try {
    getDb()
      .prepare('DELETE FROM session_log WHERE created_at < ?')
      .run(Date.now() - RETAIN_MS)
  } catch {}
}

// One-time cleanup: drop legacy log rows from sessions that have never had a
// boundary marker written (i.e., logs created before the chunk-fix landed).
// Such rows may contain leaked CSI/OSC fragments and would corrupt any future
// replay if a boundary is later inserted above them.
export function purgeLegacyLogs(): void {
  try {
    getDb()
      .prepare(
        `DELETE FROM session_log
         WHERE session_id IN (
           SELECT DISTINCT session_id FROM session_log
           WHERE session_id NOT IN (
             SELECT DISTINCT session_id FROM session_log WHERE body = ?
           )
         )`
      )
      .run(BOUNDARY_MARKER)
  } catch {}
}

export function searchLog(query: string, limit = 50): { session_id: string; body: string; created_at: number }[] {
  const q = `%${query.replace(/[%_]/g, (m) => '\\' + m)}%`
  return getDb()
    .prepare(
      `SELECT session_id, body, created_at FROM session_log
       WHERE body LIKE ? ESCAPE '\\' AND body != ?
       ORDER BY id DESC LIMIT ?`
    )
    .all(q, BOUNDARY_MARKER, limit) as { session_id: string; body: string; created_at: number }[]
}

export function tailLog(sessionId: string, maxBytes = 200_000): { body: string; lastAt: number | null } {
  flushOne(sessionId)
  const rows = getDb()
    .prepare(
      `SELECT body, created_at FROM session_log
       WHERE session_id = ?
       ORDER BY id DESC`
    )
    .all(sessionId) as { body: string; created_at: number }[]
  if (rows.length === 0) return { body: '', lastAt: null }
  const parts: string[] = []
  let total = 0
  let pastMostRecentBoundary = false
  let lastAt: number | null = null
  for (const r of rows) {
    if (r.body === BOUNDARY_MARKER) {
      if (pastMostRecentBoundary) break // hit the previous-epoch boundary; stop
      pastMostRecentBoundary = true     // skip past the most recent boundary
      continue
    }
    if (!pastMostRecentBoundary) continue // ignore current-epoch live content
    if (lastAt === null) lastAt = r.created_at
    if (total >= maxBytes) break
    parts.push(r.body)
    total += r.body.length
  }
  if (!pastMostRecentBoundary) {
    // No boundary yet: likely legacy corrupt data; suppress replay.
    return { body: '', lastAt: null }
  }
  parts.reverse()
  let body = parts.join('')
  if (body.length > maxBytes) body = body.slice(body.length - maxBytes)
  return { body, lastAt }
}

export function shutdownLog(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  flushAll()
}
