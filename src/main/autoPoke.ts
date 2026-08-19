import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import { snapshotSessions, writeAgentPoke } from './pty'
import { readTodoCounts, SESSION_STATE_DIR } from './tasks'
import { getSettings } from './settings'
import { classifyStatus } from '../shared/agentStatus'
import { classifyCliError } from '../shared/cliErrors'
import { shouldPoke, describeSkip, type PokeRecord, type PokeDecision } from '../shared/pokePolicy'

// Resumes agent sessions that stopped with work still on their todo list.
//
// Agents fail by quitting early far more often than by being wrong: the model
// decides it is done while items remain open. The CLI's own todo list is a
// better judge of "finished" than the model's claim, so this watches for a
// session that has gone quiet with outstanding items and nudges it.
//
// All of the judgement lives in shared/pokePolicy so it can be tested without
// a PTY. This file is only plumbing: gather signals, ask, act.

// Polling rather than reacting to output, because the signal we care about is
// the ABSENCE of output. An event-driven version would still need a timer to
// notice silence, so a plain interval is simpler and no less responsive.
const POLL_MS = 5000

// Errors are judged on a much shorter window than the status tail. An
// authentication failure from an hour ago that the user has since fixed must
// not pin the session as fatal for the rest of its life, so only the end of
// the most recent turn is considered.
const ERROR_WINDOW_CHARS = 2000

type SessionHistory = { history: PokeRecord[]; lastReason: string | null }

const state = new Map<string, SessionHistory>()
let timer: NodeJS.Timeout | null = null

function safeSend(win: BrowserWindow | null, channel: string, payload: unknown): void {
  if (!win || win.isDestroyed()) return
  try {
    win.webContents.send(channel, payload)
  } catch {}
}

/** Exposed for tests and for a future "why didn't it continue?" affordance. */
export function evaluateSession(
  session: ReturnType<typeof snapshotSessions>[number],
  now: number,
  enabled: boolean
): PokeDecision {
  const counts = session.copilotSessionId
    ? readTodoCounts(join(SESSION_STATE_DIR, session.copilotSessionId, 'session.db'))
    : { in_progress: 0, pending: 0, done: 0, blocked: 0, total: 0 }

  return shouldPoke({
    now,
    enabled,
    lastOutputAt: session.lastOutputAt,
    lastUserInputAt: session.lastInputAt,
    status: classifyStatus(session.scrollbackTail),
    errorKind: classifyCliError(session.scrollbackTail.slice(-ERROR_WINDOW_CHARS)),
    counts,
    history: state.get(session.id)?.history ?? []
  })
}

/**
 * What auto-continue is currently doing, for display.
 *
 * A feature that silently declines to act is indistinguishable from one that
 * is broken, so the reason it last stood down has to be observable.
 */
export function getAutoPokeStatus(sessionId: string): { pokes: number; lastReason: string | null } {
  const entry = state.get(sessionId)
  return { pokes: entry?.history.length ?? 0, lastReason: entry?.lastReason ?? null }
}

/** Exported so the wiring can be tested without a real PTY or timers. */
export function runAutoPokeTick(getWindow: () => BrowserWindow | null): void {
  const settings = getSettings()
  const enabled = settings.autoContinueEnabled === true
  const now = Date.now()

  const live = snapshotSessions()
  // Drop history for sessions that have gone away, so a long-running app
  // doesn't accumulate an entry per terminal ever opened.
  const liveIds = new Set(live.map((s) => s.id))
  for (const id of state.keys()) {
    if (!liveIds.has(id)) state.delete(id)
  }

  for (const session of live) {
    // A session with no linked Copilot session has no todo list to reason
    // about, so there is nothing to decide.
    if (!session.copilotSessionId) continue

    let decision: PokeDecision
    try {
      decision = evaluateSession(session, now, enabled)
    } catch {
      // A locked or half-written session.db must never take down the loop.
      continue
    }
    if (!decision.poke) {
      // Remember why, so the UI can explain a quiet auto-continue instead of
      // leaving the user to guess whether it is working.
      const entry = state.get(session.id)
      if (entry) entry.lastReason = describeSkip(decision.reason)
      else state.set(session.id, { history: [], lastReason: describeSkip(decision.reason) })
      continue
    }

    const counts = readTodoCounts(join(SESSION_STATE_DIR, session.copilotSessionId, 'session.db'))
    // Send the text and the newline separately: some prompts submit on the
    // first Enter they see, and this way the message is fully in the input
    // line before anything is committed.
    if (!writeAgentPoke(session.id, decision.message)) continue
    writeAgentPoke(session.id, '\r')

    const entry = state.get(session.id) ?? { history: [], lastReason: null }
    entry.history.push({ at: now, doneAtPoke: counts.done })
    entry.lastReason = null
    // Only the recent tail informs the progress check; unbounded growth would
    // leak for long-lived sessions.
    if (entry.history.length > 10) entry.history.shift()
    state.set(session.id, entry)

    safeSend(getWindow(), 'autopoke:poked', {
      id: session.id,
      remaining: decision.remaining,
      at: now
    })
  }
}

export function startAutoPoke(getWindow: () => BrowserWindow | null): void {
  if (timer) return
  timer = setInterval(() => {
    try {
      runAutoPokeTick(getWindow)
    } catch {
      // Never let a polling failure kill the interval; the next tick may work.
    }
  }, POLL_MS)
}

export function stopAutoPoke(): void {
  if (timer) clearInterval(timer)
  timer = null
  state.clear()
}
