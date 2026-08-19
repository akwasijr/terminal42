import { ipcMain, BrowserWindow, Notification, app } from 'electron'
import * as pty from 'node-pty'
import { spawn as cpSpawn } from 'child_process'
import * as os from 'os'
import * as chokidar from 'chokidar'
import { basename, join } from 'path'
import { prepareShellIntegration } from './shellIntegration'
import { promises as fs, readdirSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs'
import { appendLog, dropSessionLog, markSessionBoundary } from './sessionLog'
import { getSettings } from './settings'
import { getDb } from './db'
import { stripAnsi } from './ansi'
import { copilotEnvSync } from './copilotAuth'

type Session = {
  id: string
  proc: pty.IPty
  cwd: string
  command: string
  startedAt: number
  lastInputAt: number
  lastOutputAt: number
  lastNotifiedAt: number
  label: string
  copilotSessionId: string | null
  copilotLinkPending: boolean
  lastActivity: string
  lastActivityAt: number
  activityHistory: { line: string; at: number }[]
}
const sessions = new Map<string, Session>()

function safeSend(win: BrowserWindow | null, channel: string, payload: unknown): void {
  if (!win || win.isDestroyed()) return
  const wc = win.webContents
  if (!wc || wc.isDestroyed() || wc.isCrashed?.()) return
  try {
    wc.send(channel, payload)
  } catch {
    // Renderer is gone or being recreated; PTY scrollback is persisted and
    // will be re-read when the UI comes back, so dropping live IPC is safe.
  }
}

// Raw PTY scrollback (with ANSI escapes intact) per session: used to
// repaint xterm whenever the renderer re-attaches (HMR, app restart, tab
// switch). Capped per session to keep memory bounded.
const SCROLLBACK_MAX_BYTES = 256 * 1024
const scrollback = new Map<string, string>()
function appendScrollback(id: string, data: string): void {
  const prev = scrollback.get(id) || ''
  let next = prev + data
  if (next.length > SCROLLBACK_MAX_BYTES) next = next.slice(next.length - SCROLLBACK_MAX_BYTES)
  scrollback.set(id, next)
  scheduleScrollbackPersist(id)
}

// Persist raw scrollback to disk so a full app quit/relaunch can repaint
// xterm with the actual prior screen (cursor escapes intact) instead of
// dumping a stripped, frame-flattened tail log.
let scrollbackDir: string | null = null
function getScrollbackDir(): string {
  if (scrollbackDir) return scrollbackDir
  scrollbackDir = join(app.getPath('userData'), 'scrollback')
  try { mkdirSync(scrollbackDir, { recursive: true }) } catch {}
  return scrollbackDir
}
function scrollbackFileFor(id: string): string {
  // Sanitise: ids are uuids in practice, but be defensive.
  const safe = id.replace(/[^a-zA-Z0-9_.-]/g, '_')
  return join(getScrollbackDir(), `${safe}.bin`)
}
const persistTimers = new Map<string, NodeJS.Timeout>()
function scheduleScrollbackPersist(id: string): void {
  if (persistTimers.has(id)) return
  const t = setTimeout(() => {
    persistTimers.delete(id)
    flushScrollback(id)
  }, 1500)
  persistTimers.set(id, t)
}
function flushScrollback(id: string): void {
  const data = scrollback.get(id)
  if (data === undefined) return
  try { writeFileSync(scrollbackFileFor(id), data, 'utf8') } catch {}
}
function flushAllScrollback(): void {
  for (const [id, t] of persistTimers) { clearTimeout(t); persistTimers.delete(id) }
  for (const id of scrollback.keys()) flushScrollback(id)
}
function deleteScrollbackFile(id: string): void {
  try { unlinkSync(scrollbackFileFor(id)) } catch {}
}
// Eagerly rehydrate any saved scrollback on module load so the very first
// `pty:scrollback` call after a relaunch returns the prior bytes.
function rehydrateScrollback(): void {
  try {
    const dir = getScrollbackDir()
    const files = readdirSync(dir)
    for (const f of files) {
      if (!f.endsWith('.bin')) continue
      const id = f.slice(0, -4)
      try {
        const body = readFileSync(join(dir, f), 'utf8')
        if (body) scrollback.set(id, body)
      } catch {}
    }
  } catch {}
}
rehydrateScrollback()

const SESSION_STATE_DIR = join(os.homedir(), '.copilot', 'session-state')
const LINK_WINDOW_MS = 90_000

const defaultShell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/zsh'

let copilotDirWatcher: chokidar.FSWatcher | null = null

function startCopilotLinker(getWindow: () => BrowserWindow | null): void {
  if (copilotDirWatcher) return
  void fs.mkdir(SESSION_STATE_DIR, { recursive: true }).catch(() => {})
  copilotDirWatcher = chokidar.watch(SESSION_STATE_DIR, {
    depth: 0,
    ignoreInitial: true,
    persistent: true
  })
  copilotDirWatcher.on('addDir', (path) => {
    const dirName = basename(path)
    if (dirName === basename(SESSION_STATE_DIR)) return
    const now = Date.now()
    let chosen: Session | null = null
    let earliest = Infinity
    for (const s of sessions.values()) {
      if (!s.copilotLinkPending) continue
      if (now - s.startedAt > LINK_WINDOW_MS) continue
      if (s.startedAt < earliest) {
        earliest = s.startedAt
        chosen = s
      }
    }
    if (!chosen) return
    chosen.copilotLinkPending = false
    chosen.copilotSessionId = dirName
    try {
      getDb()
        .prepare('UPDATE sessions SET copilot_session_id = ? WHERE id = ?')
        .run(dirName, chosen.id)
    } catch {}
    safeSend(getWindow(), 'pty:linked', { id: chosen.id, copilotSessionId: dirName })
  })
}

export function listLiveSessions(): {
  id: string
  pid: number
  cwd: string
  command: string
  startedAt: number
  copilotSessionId: string | null
  lastActivity: string
}[] {
  return Array.from(sessions.values()).map((s) => ({
    id: s.id,
    pid: s.proc.pid,
    cwd: s.cwd,
    command: s.command,
    startedAt: s.startedAt,
    copilotSessionId: s.copilotSessionId,
    lastActivity: s.lastActivity
  }))
}

export function getSessionStatus(id: string): { copilotSessionId: string | null; lastActivity: string } | null {
  const s = sessions.get(id)
  if (!s) return null
  return { copilotSessionId: s.copilotSessionId, lastActivity: s.lastActivity }
}

export function killSession(id: string): boolean {
  const s = sessions.get(id)
  if (!s) return false
  sessions.delete(id)
  try { s.proc.kill() } catch {}
  return true
}

export function writeToSession(id: string, data: string): boolean {
  const s = sessions.get(id)
  if (!s) return false
  s.lastInputAt = Date.now()
  s.proc.write(data)
  return true
}

/**
 * Everything the auto-continue policy needs about a live session.
 *
 * Exposed as one snapshot rather than a set of getters so the policy always
 * sees a self-consistent view: sampling `lastOutputAt` and the scrollback at
 * different moments could report a session as quiet while its own tail shows
 * it mid-turn.
 */
export function snapshotSessions(): {
  id: string
  copilotSessionId: string | null
  lastInputAt: number
  lastOutputAt: number
  scrollbackTail: string
}[] {
  const out: ReturnType<typeof snapshotSessions> = []
  for (const s of sessions.values()) {
    out.push({
      id: s.id,
      copilotSessionId: s.copilotSessionId,
      lastInputAt: s.lastInputAt,
      lastOutputAt: s.lastOutputAt,
      // Only the tail matters and the buffer can be megabytes, so avoid
      // copying it all on every poll.
      scrollbackTail: (scrollback.get(s.id) || '').slice(-8000)
    })
  }
  return out
}

/**
 * Writes on behalf of the auto-continue policy.
 *
 * Deliberately separate from writeToSession: this must NOT count as user
 * input. Treating our own nudge as the user typing would suppress the very
 * "user is active" guard that stops us typing over someone's work.
 */
export function writeAgentPoke(id: string, data: string): boolean {
  const s = sessions.get(id)
  if (!s) return false
  try {
    s.proc.write(data)
    return true
  } catch {
    return false
  }
}

function maybeNotify(s: Session, getWindow: () => BrowserWindow | null): void {
  const settings = getSettings()
  if (!settings.notificationsEnabled) return
  if (settings.completionNotifyMode === 'off') return
  if (!Notification.isSupported()) return
  const now = Date.now()
  const idleMs = now - s.lastInputAt
  const cooldownMs = now - s.lastNotifiedAt
  if (idleMs < settings.notifyAfterSeconds * 1000) return
  if (cooldownMs < settings.notifyCooldownSeconds * 1000) return
  const win = getWindow()
  const focused = !!(win && !win.isDestroyed() && win.isFocused())
  if (settings.completionNotifyMode === 'unfocused' && focused) return
  s.lastNotifiedAt = now
  try {
    const n = new Notification({
      title: 'Terminal42',
      body: `${s.label} has new output`,
      silent: false
    })
    n.on('click', () => {
      const w = getWindow()
      if (w && !w.isDestroyed()) {
        if (w.isMinimized()) w.restore()
        w.focus()
      }
    })
    n.show()
  } catch {}
}

function pickLastActivity(buf: string): string {
  const clean = stripAnsi(buf).replace(/\r/g, '')
  const lines = clean.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
  if (lines.length === 0) return ''
  const last = lines[lines.length - 1]
  return last.length > 80 ? last.slice(0, 77) + '…' : last
}

export function registerPtyIpc(getWindow: () => BrowserWindow | null): void {
  startCopilotLinker(getWindow)
  ipcMain.handle('pty:spawn', (_evt, args: { id: string; cwd?: string; cols?: number; rows?: number; command?: string; commandArgs?: string[]; label?: string }) => {
    if (sessions.has(args.id)) return { ok: true, existing: true }
    const cmd = args.command || defaultShell
    const cmdArgs = args.commandArgs || []
    const cwd = args.cwd || os.homedir()
    // Terminal sessions run the CLI too, so they hit the same keychain prompt
    // unless a token is already in the environment.
    const env = { ...copilotEnvSync(), TERM: 'xterm-256color', COLORTERM: 'truecolor' } as Record<string, string>
    // Shell integration has to be appended after the user's own rc file rather
    // than injected before it; otherwise prompt frameworks can overwrite our
    // hooks, or our setup can perturb aliases and startup state. The helper
    // writes tiny per-shell rc wrappers under userData and silently falls back
    // to the unmodified shell if anything about that setup fails.
    const launch = prepareShellIntegration({
      shellPath: cmd,
      shellArgs: cmdArgs,
      env,
      integrationDir: join(app.getPath('userData'), 'shell-integration'),
      homeDir: os.homedir()
    })
    const proc = pty.spawn(launch.command, launch.args, {
      name: 'xterm-256color',
      cols: args.cols ?? 100,
      rows: args.rows ?? 30,
      cwd,
      env: launch.env
    })
    const now = Date.now()
    const session: Session = {
      id: args.id,
      proc,
      cwd,
      command: cmd,
      startedAt: now,
      lastInputAt: now,
      lastOutputAt: now,
      lastNotifiedAt: 0,
      label: args.label || 'Session',
      copilotSessionId: null,
      copilotLinkPending: true,
      lastActivity: '',
      lastActivityAt: now,
      activityHistory: []
    }
    sessions.set(args.id, session)
    markSessionBoundary(args.id)
    let activityBuf = ''
    let activityTimer: NodeJS.Timeout | null = null
    const flushActivity = () => {
      activityTimer = null
      const next = pickLastActivity(activityBuf)
      activityBuf = ''
      if (!next || next === session.lastActivity) return
      session.lastActivity = next
      session.lastActivityAt = Date.now()
      session.activityHistory.push({ line: next, at: session.lastActivityAt })
      if (session.activityHistory.length > 8) session.activityHistory.shift()
      const win = getWindow()
      safeSend(win, `pty:activity:${args.id}`, next)
      safeSend(win, `pty:activityHistory:${args.id}`, session.activityHistory)
    }
    proc.onData((data) => {
      session.lastOutputAt = Date.now()
      appendLog(args.id, data)
      appendScrollback(args.id, data)
      safeSend(getWindow(), `pty:data:${args.id}`, data)
      activityBuf += data
      if (activityBuf.length > 8000) activityBuf = activityBuf.slice(-4000)
      if (!activityTimer) activityTimer = setTimeout(flushActivity, 500)
      maybeNotify(session, getWindow)
    })
    proc.onExit(({ exitCode }) => {
      if (activityTimer) clearTimeout(activityTimer)
      safeSend(getWindow(), `pty:exit:${args.id}`, exitCode)
      sessions.delete(args.id)
      scrollback.delete(args.id)
    })
    return {
      ok: true,
      existing: false,
      pid: proc.pid,
      copilotSessionId: session.copilotSessionId
    }
  })

  ipcMain.handle('pty:write', (_evt, args: { id: string; data: string }) => {
    return { ok: writeToSession(args.id, args.data) }
  })

  ipcMain.handle('pty:resize', (_evt, args: { id: string; cols: number; rows: number }) => {
    const s = sessions.get(args.id)
    if (s) {
      try { s.proc.resize(args.cols, args.rows) } catch {}
    }
    return { ok: !!s }
  })

  ipcMain.handle('pty:kill', (_evt, args: { id: string }) => {
    const ok = killSession(args.id)
    dropSessionLog(args.id)
    scrollback.delete(args.id)
    deleteScrollbackFile(args.id)
    return { ok }
  })

  ipcMain.handle('pty:scrollback', (_evt, id: string) => {
    return scrollback.get(id) || ''
  })

  // Same as pty:scrollback but explicitly returns the on-disk persisted bytes
  // for sessions whose PTY isn't running yet (cold-start replay).
  ipcMain.handle('pty:savedScrollback', (_evt, id: string) => {
    return scrollback.get(id) || ''
  })

  ipcMain.handle('pty:list', () => listLiveSessions())

  ipcMain.handle('pty:listExternal', async () => listExternalCopilotProcesses())

  ipcMain.handle('pty:status', (_evt, id: string) => getSessionStatus(id))

  ipcMain.handle('pty:activityHistory', (_evt, id: string) => {
    const s = sessions.get(id)
    return s ? s.activityHistory : []
  })
}

export type ExternalCopilotProc = {
  pid: number
  command: string
  cwd: string | null
  startedAt: number | null
}

async function listExternalCopilotProcesses(): Promise<ExternalCopilotProc[]> {
  // Find Copilot CLI processes that aren't running inside one of our PTYs.
  // Use `ps` and look for a line that includes "copilot" but exclude our managed PIDs.
  return new Promise((resolve) => {
    const ourPids = new Set<number>()
    for (const [, s] of sessions) ourPids.add(s.proc.pid)
    const ps = cpSpawn('ps', ['-axo', 'pid=,lstart=,command='])
    let buf = ''
    ps.stdout.on('data', (d) => {
      buf += d.toString()
    })
    ps.on('close', () => {
      const out: ExternalCopilotProc[] = []
      for (const line of buf.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        // pid + lstart (5 tokens like "Wed Apr 30 22:12:34 2026") + command
        const m = trimmed.match(/^(\d+)\s+(\S+\s+\S+\s+\S+\s+\S+\s+\S+)\s+(.+)$/)
        if (!m) continue
        const pid = parseInt(m[1], 10)
        const command = m[3]
        if (ourPids.has(pid)) continue
        // Heuristic: process command line includes "copilot" but isn't our search itself or grep
        if (!/(^|\/)copilot(\s|$)/.test(command)) continue
        if (/grep|terminal42|node_modules\/electron\b/.test(command)) continue
        const startedAt = Date.parse(m[2])
        out.push({
          pid,
          command,
          cwd: null,
          startedAt: Number.isNaN(startedAt) ? null : startedAt
        })
      }
      resolve(out)
    })
    ps.on('error', () => resolve([]))
  })
}

export function killAllSessions(): void {
  flushAllScrollback()
  for (const [, s] of sessions) {
    try { s.proc.kill() } catch {}
  }
  sessions.clear()
  if (copilotDirWatcher) {
    void copilotDirWatcher.close()
    copilotDirWatcher = null
  }
}
