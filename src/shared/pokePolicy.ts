// Decides whether an idle agent session should be nudged back to work.
//
// Most agent failures are not wrong answers but early exits: the model
// declares victory with items still outstanding. The todo list the CLI keeps
// is a better judge of "finished" than the model's own claim, so when a
// session goes quiet with work still on the list, resuming it is usually the
// right move.
//
// The reason this is a policy module rather than a couple of `if`s at the
// call site is that poking is not a safe default. Writing into a live PTY can
// answer a permission prompt, interrupt a running command, or corrupt what the
// user is halfway through typing. Worse, a poke loop that never terminates
// burns real money. Every rule below exists to prevent one of those, so the
// logic is kept pure and heavily tested rather than tangled up with IPC.
//
// The design is fail-closed: anything ambiguous resolves to "do not poke".
// A missed poke costs the user one keystroke; a wrong poke can approve
// something they never saw.

import type { AgentStatus } from './agentStatus'

export type TodoCounts = {
  in_progress: number
  pending: number
  done: number
  blocked: number
  total: number
}

/** What a previous poke looked like, so we can tell if it achieved anything. */
export type PokeRecord = {
  at: number
  doneAtPoke: number
}

export type PokeSignals = {
  now: number
  /** Whether the user has opted in. Off by default; see shouldPoke. */
  enabled: boolean
  /** Last time the PTY produced any output. */
  lastOutputAt: number
  /** Last time the user typed into this session. */
  lastUserInputAt: number
  /** Derived from the session's visible output. */
  status: AgentStatus
  counts: TodoCounts
  history: PokeRecord[]
}

export type PokeDecision =
  | { poke: false; reason: PokeSkipReason }
  | { poke: true; message: string; remaining: number }

export type PokeSkipReason =
  | 'disabled'
  | 'no-todos'
  | 'nothing-actionable'
  | 'still-working'
  | 'awaiting-user'
  | 'user-active'
  | 'cooldown'
  | 'no-progress'

// A turn's output can pause while the model thinks or a tool runs, so the
// quiet period has to be long enough not to mistake a pause for an ending.
export const QUIESCENCE_MS = 12_000

// Never type into a session the user is working in; their cursor is there.
export const USER_ACTIVE_MS = 20_000

// Enough that a poke has time to produce a turn before we consider another.
export const COOLDOWN_MS = 45_000

// If this many pokes in a row complete nothing, the session is stuck in a way
// poking cannot fix and continuing would just burn tokens.
export const MAX_POKES_WITHOUT_PROGRESS = 2

export const POKE_MESSAGE =
  'Some todo items are still open. Please continue with the remaining work, or mark items blocked if you cannot proceed.'

/**
 * Counts pokes since the last one that was followed by a completed todo.
 *
 * Progress is measured against the `done` count captured at poke time rather
 * than a simple counter, because a poke that produced real work should reset
 * the budget — the loop is only futile when nothing comes of it.
 */
export function pokesWithoutProgress(history: PokeRecord[], doneNow: number): number {
  let n = 0
  for (let i = history.length - 1; i >= 0; i--) {
    if (doneNow > history[i].doneAtPoke) break
    n++
  }
  return n
}

/**
 * The single decision point. Rules are ordered cheapest and safest first, and
 * each returns a distinct reason so the UI can explain itself instead of
 * silently doing nothing.
 */
export function shouldPoke(signals: PokeSignals): PokeDecision {
  const { counts, now } = signals

  if (!signals.enabled) return { poke: false, reason: 'disabled' }

  // With no todo list there is no evidence of unfinished work, and a poke
  // would just be nagging.
  if (counts.total === 0) return { poke: false, reason: 'no-todos' }

  // Blocked items are explicitly not actionable; poking cannot unblock them
  // and would loop for ever if we treated them as outstanding.
  const actionable = counts.pending + counts.in_progress
  if (actionable === 0) return { poke: false, reason: 'nothing-actionable' }

  // The two rules that make this safe at all. `waiting` means a permission or
  // choice prompt is on screen, where injected text becomes an answer to a
  // question the user never saw.
  if (signals.status === 'waiting') return { poke: false, reason: 'awaiting-user' }
  if (signals.status === 'working') return { poke: false, reason: 'still-working' }

  if (now - signals.lastOutputAt < QUIESCENCE_MS) return { poke: false, reason: 'still-working' }

  // Typing into a session the user is using would corrupt their input line.
  if (now - signals.lastUserInputAt < USER_ACTIVE_MS) return { poke: false, reason: 'user-active' }

  const last = signals.history[signals.history.length - 1]
  if (last && now - last.at < COOLDOWN_MS) return { poke: false, reason: 'cooldown' }

  if (pokesWithoutProgress(signals.history, counts.done) >= MAX_POKES_WITHOUT_PROGRESS) {
    return { poke: false, reason: 'no-progress' }
  }

  return { poke: true, message: POKE_MESSAGE, remaining: actionable }
}

/** Human-readable explanation, so the UI never has to duplicate this logic. */
export function describeSkip(reason: PokeSkipReason): string {
  switch (reason) {
    case 'disabled': return 'Auto-continue is off'
    case 'no-todos': return 'No todo list to finish'
    case 'nothing-actionable': return 'Nothing left to do'
    case 'still-working': return 'Agent is still working'
    case 'awaiting-user': return 'Agent is waiting for you'
    case 'user-active': return 'You are using this session'
    case 'cooldown': return 'Waiting after the last nudge'
    case 'no-progress': return 'Nudging stopped: no progress was made'
  }
}
