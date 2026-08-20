import { useEffect, useRef, useState } from 'react'

/**
 * The Copilot session id for one of our sessions, or null until it exists.
 *
 * A session only gets an id once its first turn runs, and the id arrives as a
 * `pty:linked` event. Anything that mounts mid-turn misses that event and would
 * otherwise show nothing — no context reading, no tasks, no insights — for the
 * rest of the session, so we keep re-reading until we have one.
 */
export function useCopilotSessionId(sessionId: string | null): string | null {
  const [copilotId, setCopilotId] = useState<string | null>(null)
  const known = useRef<string | null>(null)
  known.current = copilotId

  useEffect(() => {
    known.current = null
    if (!sessionId) {
      setCopilotId(null)
      return
    }
    const read = (): void => {
      void window.terminal42.sessions
        .get(sessionId)
        .then((s) => setCopilotId(s?.copilot_session_id ?? null))
        .catch(() => {})
    }
    read()
    const off = window.terminal42.pty.onLinked((p) => {
      if (p.id === sessionId) setCopilotId(p.copilotSessionId)
    })
    const t = setInterval(() => {
      if (!known.current) read()
    }, 4000)
    return () => {
      off()
      clearInterval(t)
    }
  }, [sessionId])

  return copilotId
}
