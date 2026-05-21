import { ipcMain, BrowserWindow } from 'electron'
import * as chokidar from 'chokidar'
import { promises as fs } from 'fs'
import { join } from 'path'
import * as os from 'os'
import Database from 'better-sqlite3'

const SESSION_STATE_DIR = join(os.homedir(), '.copilot', 'session-state')

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked'
export type Task = {
  source: string
  text: string
  done: boolean
  status?: TaskStatus
  description?: string | null
  id?: string
}

// Tasks are tracked strictly per linked Copilot session.
// We also expose a listing of ALL Copilot sessions so the UI can browse them.

export type CopilotSessionInfo = {
  id: string
  name: string
  cwd: string | null
  updatedAt: number
  counts: { in_progress: number; pending: number; done: number; blocked: number; total: number }
}

function parseWorkspaceYaml(body: string): { name?: string; cwd?: string; updated_at?: string } {
  const out: { name?: string; cwd?: string; updated_at?: string } = {}
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^(name|cwd|updated_at):\s*(.+?)\s*$/)
    if (!m) continue
    const k = m[1] as 'name' | 'cwd' | 'updated_at'
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    out[k] = v
  }
  return out
}

function readTodoCounts(dbPath: string): CopilotSessionInfo['counts'] {
  const empty = { in_progress: 0, pending: 0, done: 0, blocked: 0, total: 0 }
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true })
    try {
      const rows = db.prepare("SELECT status, COUNT(*) AS n FROM todos GROUP BY status").all() as Array<{
        status: TaskStatus
        n: number
      }>
      const counts = { ...empty }
      for (const r of rows) {
        if (r.status in counts) counts[r.status] = r.n
        counts.total += r.n
      }
      return counts
    } finally {
      db.close()
    }
  } catch {
    return empty
  }
}

async function listAllSessions(): Promise<CopilotSessionInfo[]> {
  try {
    const dirs = await fs.readdir(SESSION_STATE_DIR)
    const out: CopilotSessionInfo[] = []
    for (const id of dirs) {
      const dir = join(SESSION_STATE_DIR, id)
      try {
        const st = await fs.stat(dir)
        if (!st.isDirectory()) continue
        const dbPath = join(dir, 'session.db')
        const dbSt = await fs.stat(dbPath).catch(() => null)
        if (!dbSt) continue
        const counts = readTodoCounts(dbPath)
        if (counts.total === 0) continue // skip sessions with no todos
        let name = id.slice(0, 8)
        let cwd: string | null = null
        let updatedAt = dbSt.mtimeMs
        try {
          const wsBody = await fs.readFile(join(dir, 'workspace.yaml'), 'utf8')
          const ws = parseWorkspaceYaml(wsBody)
          if (ws.name) name = ws.name
          if (ws.cwd) cwd = ws.cwd
          if (ws.updated_at) {
            const t = Date.parse(ws.updated_at)
            if (!Number.isNaN(t)) updatedAt = t
          }
        } catch {
          /* no workspace.yaml */
        }
        out.push({ id, name, cwd, updatedAt, counts })
      } catch {
        /* ignore */
      }
    }
    out.sort((a, b) => b.updatedAt - a.updatedAt)
    return out
  } catch {
    return []
  }
}

function parsePlanMarkdown(body: string): Task[] {
  const tasks: Task[] = []
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.+?)\s*$/)
    if (m) {
      const done = m[1].toLowerCase() === 'x'
      tasks.push({
        source: 'plan.md',
        text: m[2],
        done,
        status: done ? 'done' : 'pending'
      })
    }
  }
  return tasks
}

function readTasksFromDB(dbPath: string): Task[] {
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true })
    try {
      const rows = db
        .prepare(
          `SELECT id, title, description, status,
                  CASE status WHEN 'in_progress' THEN 0 WHEN 'pending' THEN 1 WHEN 'blocked' THEN 2 ELSE 3 END AS sortKey
           FROM todos ORDER BY sortKey ASC, updated_at DESC`
        )
        .all() as Array<{ id: string; title: string; description: string | null; status: TaskStatus }>
      return rows.map((r) => ({
        source: 'session.db',
        id: r.id,
        text: r.title,
        description: r.description,
        status: r.status,
        done: r.status === 'done'
      }))
    } finally {
      db.close()
    }
  } catch {
    return []
  }
}

async function readTasksFor(copilotSessionId?: string | null): Promise<Task[]> {
  // Strict per-session: only return tasks for the CURRENT linked Copilot session.
  // No global "freshest" fallback: that leaked tasks from unrelated sessions and confused users.
  if (!copilotSessionId) return []
  const dir = join(SESSION_STATE_DIR, copilotSessionId)
  try {
    const st = await fs.stat(dir)
    if (!st.isDirectory()) return []
  } catch {
    return []
  }

  const dbPath = join(dir, 'session.db')
  const planPath = join(dir, 'plan.md')

  const dbTasks = readTasksFromDB(dbPath)
  if (dbTasks.length > 0) return dbTasks

  // Fall back to plan.md checkboxes only if DB has no rows
  try {
    const body = await fs.readFile(planPath, 'utf8')
    return parsePlanMarkdown(body)
  } catch {
    return []
  }
}

let watcher: chokidar.FSWatcher | null = null
const debounceTimers = new Map<string, NodeJS.Timeout>()

// Send to the renderer ONLY if the window + webContents are still alive at
// the moment of sending. The original code re-used an `isDestroyed()` guard
// taken BEFORE an await / `.then`, which races with renderer crashes and
// auto-reloads: by the time the callback fires the underlying native object
// can be gone, and `webContents.send` throws `Object has been destroyed`.
// Chokidar then fires those callbacks dozens of times per file change,
// flooding the main process with unhandled rejections until it stops
// responding. Re-checking at send time + try/catch makes this safe.
function safeSend(win: BrowserWindow | null, channel: string, payload: unknown): void {
  if (!win || win.isDestroyed()) return
  const wc = win.webContents
  if (!wc || wc.isDestroyed()) return
  try {
    wc.send(channel, payload)
  } catch {
    /* webContents was torn down between the check and the send (e.g. mid-
       reload after a renderer crash). Safe to drop — the renderer will
       re-request fresh data once it's back. */
  }
}

function debouncedNotify(getWindow: () => BrowserWindow | null, copilotId: string): void {
  const existing = debounceTimers.get(copilotId)
  if (existing) clearTimeout(existing)
  debounceTimers.set(
    copilotId,
    setTimeout(async () => {
      debounceTimers.delete(copilotId)
      // Note: we re-fetch `win` AFTER the await so we don't capture a stale
      // reference that became invalid while we were reading files.
      const tasks = await readTasksFor(copilotId)
      const win = getWindow()
      safeSend(win, `tasks:update:${copilotId}`, tasks)
      // Also broadcast on the global channel so any UI listening without a known copilotId refreshes.
      safeSend(win, 'tasks:update', tasks)
    }, 250)
  )
}

function startWatcher(getWindow: () => BrowserWindow | null): void {
  if (watcher) return
  void fs.mkdir(SESSION_STATE_DIR, { recursive: true })
  watcher = chokidar.watch(
    [
      SESSION_STATE_DIR + '/*/plan.md',
      SESSION_STATE_DIR + '/*/session.db',
      SESSION_STATE_DIR + '/*/session.db-wal',
      SESSION_STATE_DIR + '/*/events.jsonl'
    ],
    {
      ignoreInitial: false,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 250, pollInterval: 100 }
    }
  )
  const onChange = (path: string): void => {
    const parts = path.split('/')
    const cid = parts[parts.length - 2]
    const isEvents = path.endsWith('events.jsonl')
    if (cid && !isEvents) debouncedNotify(getWindow, cid)
    if (cid && isEvents) {
      void readContextUsage(cid)
        .then((u) => { if (u) safeSend(getWindow(), `copilot:contextUsage:${cid}`, u) })
        .catch(() => { /* readContextUsage already swallows, defensive */ })
    }
    // Also broadcast that the global session list may have changed.
    void listAllSessions()
      .then((s) => safeSend(getWindow(), 'tasks:sessionsChanged', s))
      .catch(() => { /* listAllSessions already swallows, defensive */ })
  }
  watcher.on('add', onChange)
  watcher.on('change', onChange)
  watcher.on('unlink', onChange)
}

export function registerTasksIpc(getWindow: () => BrowserWindow | null): void {
  startWatcher(getWindow)
  ipcMain.handle('tasks:read', async (_e, copilotSessionId?: string | null) => readTasksFor(copilotSessionId))
  ipcMain.handle('tasks:listSessions', async () => listAllSessions())
  ipcMain.handle('copilot:contextUsage', async (_e, copilotSessionId: string | null) =>
    readContextUsage(copilotSessionId)
  )
}

// Per-model context-window sizes (tokens). Keep this list EXACT — Copilot CLI
// emits internal IDs like "claude-opus-4.7-1m-internal" that don't match the
// label shown in the model picker. An exact entry beats a prefix guess.
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  // Anthropic — extended 1M context variants
  'claude-opus-4.7-1m-internal': 1_000_000,
  'claude-opus-4.6-1m':          1_000_000,
  // Anthropic — standard 200K
  'claude-opus-4.7-high':        200_000,
  'claude-opus-4.7':             200_000,
  'claude-opus-4.6':             200_000,
  'claude-opus-4.5':             200_000,
  'claude-sonnet-4.6':           200_000,
  'claude-sonnet-4.5':           200_000,
  'claude-haiku-4.5':            200_000,
  // OpenAI
  'gpt-4.1':           1_000_000,
  'gpt-5.5':             272_000,
  'gpt-5.4':             272_000,
  'gpt-5.4-mini':        272_000,
  'gpt-5.3-codex':       272_000,
  'gpt-5.2':             272_000,
  'gpt-5.2-codex':       272_000,
  'gpt-5.1-codex-max':   400_000,
  'gpt-5-mini':          272_000,
  'gpt-4o':              128_000,
  // Google
  'gemini-3-pro-preview': 1_000_000
}

function contextLimitForModel(model: string | null): number | null {
  if (!model || model === 'auto') return null
  if (MODEL_CONTEXT_LIMITS[model] != null) return MODEL_CONTEXT_LIMITS[model]
  // Heuristic: any "-1m" variant uses the 1M extended context window.
  if (/-1m(?:-|$)/i.test(model)) return 1_000_000
  // Family prefix fallbacks for unknown future IDs.
  const families: Array<[string, number]> = [
    ['claude-opus',   200_000],
    ['claude-sonnet', 200_000],
    ['claude-haiku', 200_000],
    ['gpt-4.1',     1_000_000],
    ['gpt-5',         272_000],
    ['gpt-4o',        128_000],
    ['gemini',      1_000_000]
  ]
  for (const [p, lim] of families) {
    if (model.startsWith(p)) return lim
  }
  return null
}

export type ContextSource = 'shutdown' | 'truncation' | 'compaction' | null

export type ContextUsage = {
  // Total tokens currently held in the model context (system + conversation + tool defs).
  // Field name kept for back-compat with existing UI; despite the name it is NOT
  // just input tokens, it is the full in-context total.
  inputTokens: number
  // Output tokens from the latest assistant turn. Informational; not used in percent.
  outputTokens: number
  model: string | null
  contextLimit: number
  percent: number
  // Where the figures came from, so the UI can convey staleness.
  source: ContextSource
  sourceTimestamp: string | null
}

async function readContextUsage(copilotSessionId: string | null): Promise<ContextUsage | null> {
  if (!copilotSessionId) return null
  const file = join(SESSION_STATE_DIR, copilotSessionId, 'events.jsonl')
  try {
    // Read tail (~128KB). Token-bearing events (compaction/truncation/shutdown)
    // are rare so we need a wide window to find the most recent one.
    const stat = await fs.stat(file)
    const start = Math.max(0, stat.size - 131072)
    const fd = await fs.open(file, 'r')
    const buf = Buffer.alloc(stat.size - start)
    await fd.read(buf, 0, buf.length, start)
    await fd.close()
    const text = buf.toString('utf8')
    const lines = text.split('\n')

    let totalTokens = 0
    let runtimeLimit: number | null = null
    let model: string | null = null
    let source: ContextSource = null
    let sourceTimestamp: string | null = null
    // Track the most recent message timestamp to detect stale token data.
    let latestMessageTs: string | null = null

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]
      if (!line || line[0] !== '{') continue
      let e: { type?: string; data?: Record<string, unknown>; timestamp?: string } | null = null
      try { e = JSON.parse(line) } catch { continue }
      if (!e) continue
      const t = e.type
      const d = e.data
      if (!t || typeof d !== 'object' || d === null) continue

      // Capture the most recent user/assistant message timestamp.
      if (!latestMessageTs && (t === 'user.message' || t === 'assistant.message')) {
        if (typeof e.timestamp === 'string') latestMessageTs = e.timestamp
      }

      if (totalTokens === 0) {
        if (t === 'session.shutdown') {
          const ct = Number((d as { currentTokens?: number }).currentTokens) || 0
          if (ct > 0) {
            totalTokens = ct
            const cm = (d as { currentModel?: string }).currentModel
            if (!model && typeof cm === 'string') model = cm
            source = 'shutdown'
            if (typeof e.timestamp === 'string') sourceTimestamp = e.timestamp
          }
        } else if (t === 'session.truncation') {
          const post = Number((d as { postTruncationTokensInMessages?: number }).postTruncationTokensInMessages) || 0
          const tools = Number((d as { toolDefinitionsTokenCount?: number }).toolDefinitionsTokenCount) || 0
          if (post > 0) {
            totalTokens = post + tools
            const lim = Number((d as { tokenLimit?: number }).tokenLimit) || 0
            if (lim > 0) runtimeLimit = lim
            source = 'truncation'
            if (typeof e.timestamp === 'string') sourceTimestamp = e.timestamp
          }
        } else if (t === 'session.compaction_start') {
          const sys = Number((d as { systemTokens?: number }).systemTokens) || 0
          const conv = Number((d as { conversationTokens?: number }).conversationTokens) || 0
          const tools = Number((d as { toolDefinitionsTokens?: number }).toolDefinitionsTokens) || 0
          const sum = sys + conv + tools
          if (sum > 0) {
            totalTokens = sum
            source = 'compaction'
            if (typeof e.timestamp === 'string') sourceTimestamp = e.timestamp
          }
        }
      }

      if (!model) {
        if (t === 'assistant.message') {
          const m = (d as { model?: string }).model
          if (typeof m === 'string') model = m
        } else if (t === 'session.model_change') {
          const dd = d as { newModel?: string; model?: string }
          if (typeof dd.newModel === 'string') model = dd.newModel
          else if (typeof dd.model === 'string') model = dd.model
        }
      }

      if (totalTokens > 0 && model && latestMessageTs) break
    }

    // Final fallback for the model: scan the whole tail for any mention.
    if (!model) {
      const m = text.match(/"(?:newModel|currentModel|model)":"([^"]+)"/)
      if (m) model = m[1]
    }

    // No reliable token data → hide the ring entirely rather than show
    // 0% or a stale frozen value from a finished session.
    if (totalTokens <= 0) return null

    // Freshness check: if the token source event is significantly older than
    // the most recent message, the data is stale (e.g. from a previous session
    // lifecycle in the same events file). Hide the ring.
    if (sourceTimestamp && latestMessageTs) {
      const sourceMs = Date.parse(sourceTimestamp)
      const msgMs = Date.parse(latestMessageTs)
      // If the latest message is >5 min newer than the source, the token data
      // predates the current conversation and would be misleading.
      if (Number.isFinite(sourceMs) && Number.isFinite(msgMs) && msgMs - sourceMs > 5 * 60_000) {
        return null
      }
    }

    const contextLimit = runtimeLimit ?? contextLimitForModel(model) ?? 0
    if (contextLimit <= 0) return null

    const percent = Math.min(100, Math.round((totalTokens / contextLimit) * 100))

    return {
      inputTokens: totalTokens,
      outputTokens: 0,
      model,
      contextLimit,
      percent,
      source,
      sourceTimestamp
    }
  } catch {
    return null
  }
}

export function stopTasksWatcher(): void {
  if (watcher) {
    void watcher.close()
    watcher = null
  }
}
