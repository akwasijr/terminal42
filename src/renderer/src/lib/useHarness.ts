// Live harness readings for a session, shared by every view that shows them.
//
// Extracted from the right-hand panel so the terminal can show the same
// numbers. Two views polling independently would drift apart — one refreshing
// a second after the other, briefly disagreeing about the same session — and
// the whole complaint that started this was readouts that did not correspond
// to anything.
//
// Polled rather than pushed: the numbers come from three independent
// subsystems (the CLI's todo database, auto-continue's in-memory state, and the
// last message's memory recall) and none of them share a change event.

import { useEffect, useState } from 'react'
import type { ContextUsage } from '../../../preload/index'
import { EMPTY_INSIGHTS, type SessionInsights } from '../../../shared/sessionInsights'

const POLL_MS = 5000

export type Harness = {
  insights: SessionInsights
  usage: ContextUsage | null
  /** The CLI's own session id, once the PTY has been linked to one. */
  copilotId: string | null
}

export function useHarness(sessionId: string | null): Harness {
  const [copilotId, setCopilotId] = useState<string | null>(null)
  const [insights, setInsights] = useState<SessionInsights>(EMPTY_INSIGHTS)
  const [usage, setUsage] = useState<ContextUsage | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setCopilotId(null)
      setInsights(EMPTY_INSIGHTS)
      setUsage(null)
      return
    }
    void window.terminal42.sessions.get(sessionId).then((s) => setCopilotId(s?.copilot_session_id ?? null))
    const off = window.terminal42.pty.onLinked((p) => {
      if (p.id === sessionId) setCopilotId(p.copilotSessionId)
    })
    return off
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    const load = (): void => {
      void window.terminal42.sessionInsights
        .get(copilotId, sessionId)
        .then((next) => { if (!cancelled) setInsights(next) })
        .catch(() => {})
      void window.terminal42.copilot
        .contextUsage(copilotId)
        .then((u) => { if (!cancelled) setUsage(u) })
        .catch(() => {})
    }
    load()
    const t = setInterval(load, POLL_MS)
    return () => { cancelled = true; clearInterval(t) }
  }, [copilotId, sessionId])

  return { insights, usage, copilotId }
}
