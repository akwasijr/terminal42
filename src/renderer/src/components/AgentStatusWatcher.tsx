import { useEffect, useRef } from 'react'
import type { LiveSession } from '../../../preload/index'
import { classifyStatus, type AgentStatus } from '../lib/agentStatus'
import { playAttentionChime } from '../lib/notifySound'

// Watches every live PTY session and fires a system notification the
// moment one flips from non-waiting into 'waiting' AND the user is not
// currently looking at that session's project on the Chat tab.
export function AgentStatusWatcher({
  activeNav,
  activeProjectId
}: {
  activeNav: string
  activeProjectId: string | null
}) {
  const lastStatus = useRef<Record<string, AgentStatus>>({})
  const lastNotifyAt = useRef<Record<string, number>>({})

  useEffect(() => {
    let cancelled = false

    const tick = async (): Promise<void> => {
      let sessions: LiveSession[] = []
      try { sessions = await window.terminal42.pty.list() } catch { return }
      if (cancelled || sessions.length === 0) return

      // Update each session's status; notify on flip → waiting.
      const next: Record<string, AgentStatus> = {}
      await Promise.all(sessions.map(async (s) => {
        try {
          const sb = await window.terminal42.pty.scrollback(s.id)
          next[s.id] = classifyStatus(sb)
        } catch {
          next[s.id] = 'idle'
        }
      }))
      if (cancelled) return

      for (const s of sessions) {
        const prev = lastStatus.current[s.id]
        const cur = next[s.id]
        if (cur !== 'waiting' || prev === 'waiting') continue

        // Suppress notifications when the user is plainly looking at this
        // session's project in the Chat tab AND the window is focused.
        const lookingHere =
          activeNav === 'terminal' &&
          activeProjectId === s.copilotSessionId &&
          document.hasFocus()
        if (lookingHere) continue

        // Throttle: at most one notification per session per 30s.
        const now = Date.now()
        const cooldown = lastNotifyAt.current[s.id] ?? 0
        if (now - cooldown < 30_000) continue
        lastNotifyAt.current[s.id] = now

        try {
          await window.terminal42.notify.show(
            'Session waiting for you',
            `${s.cwd.split('/').filter(Boolean).pop() || 'A session'} needs a response.`
          )
          playAttentionChime()
        } catch { /* ignore */ }
      }
      lastStatus.current = next
    }

    void tick()
    const t = setInterval(tick, 5000)
    return () => { cancelled = true; clearInterval(t) }
  }, [activeNav, activeProjectId])

  return null
}
