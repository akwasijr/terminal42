import { useEffect, useState } from 'react'
import { MODELS } from './ModelDropdown'
import { IconChevronRight } from './icons'

const LS_STATUSBAR_HIDDEN = 't42:statusbar:hidden'

export function StatusBar({
  cwd,
  model,
  sessionId,
  projectId
}: {
  cwd: string | null
  model: string | null
  sessionId: string | null
  projectId: string | null
}) {
  const [brainCount, setBrainCount] = useState(0)
  const [unread, setUnread] = useState(0)
  const [taskCount, setTaskCount] = useState<{ open: number; total: number }>({ open: 0, total: 0 })
  const [running, setRunning] = useState<{ pty: number; previews: number }>({ pty: 0, previews: 0 })
  const [activity, setActivity] = useState<string>('')

  useEffect(() => {
    setActivity('')
    if (!sessionId) return
    void window.terminal42.pty.status(sessionId).then((s) => {
      if (s?.lastActivity) setActivity(s.lastActivity)
    })
    return window.terminal42.pty.onActivity(sessionId, (line) => setActivity(line))
  }, [sessionId])

  useEffect(() => {
    void window.terminal42.brain.merged(projectId, sessionId).then((m) => setBrainCount(m.ruleCount))
  }, [projectId, sessionId])

  useEffect(() => {
    const refreshInbox = () => void window.terminal42.inbox.unreadCount().then(setUnread)
    refreshInbox()
    const off = window.terminal42.inbox.onNew(refreshInbox)
    return off
  }, [])

  useEffect(() => {
    const apply = (tasks: { done: boolean }[]) =>
      setTaskCount({ open: tasks.filter((t) => !t.done).length, total: tasks.length })
    void window.terminal42.tasks.read().then(apply)
    return window.terminal42.tasks.onUpdate(apply)
  }, [])

  useEffect(() => {
    const refresh = async () => {
      const [pty, previews] = await Promise.all([
        window.terminal42.pty.list(),
        window.terminal42.preview.running()
      ])
      setRunning({ pty: pty.length, previews: previews.length })
    }
    void refresh()
    const t = setInterval(refresh, 3000)
    return () => clearInterval(t)
  }, [])

  const modelLabel = MODELS.find((m) => m.id === model)?.label ?? model ?? ':'
  const folder = cwd ? cwd.split('/').slice(-2).join('/') : ':'

  const [hidden, setHidden] = useState<boolean>(() => {
    try { return localStorage.getItem(LS_STATUSBAR_HIDDEN) === '1' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem(LS_STATUSBAR_HIDDEN, hidden ? '1' : '0') } catch {}
  }, [hidden])

  if (hidden) {
    return (
      <footer className="flex h-2 items-center justify-end bg-surface px-2">
        <button
          type="button"
          onClick={() => setHidden(false)}
          aria-label="Show status bar"
          title="Show status bar"
          className="grid h-4 w-5 -translate-y-1 place-items-center rounded-md bg-surface text-text-muted hover:text-text-primary"
        >
          <span className="-rotate-90"><IconChevronRight size={10} /></span>
        </button>
      </footer>
    )
  }

  return (
    <footer className="flex h-7 items-center gap-4 bg-surface px-4 text-[11px] text-text-muted">
      <span>Model: <span className="text-text-secondary">{modelLabel}</span></span>
      <span>Folder: <span className="text-text-secondary">{folder}</span></span>
      <span>Brain: <span className="text-text-secondary">{brainCount} rule{brainCount === 1 ? '' : 's'}</span></span>
      {taskCount.total > 0 && (
        <span>
          Tasks: <span className="text-text-secondary">{taskCount.open}/{taskCount.total} open</span>
        </span>
      )}
      {activity && (
        <span className="truncate max-w-[40%]" title={activity}>
          Doing: <span className="text-text-secondary">{activity}</span>
        </span>
      )}
      <div className="ml-auto flex items-center gap-4">
        {running.pty > 0 && (
          <span>Terminals: <span className="text-text-secondary">{running.pty}</span></span>
        )}
        {running.previews > 0 && (
          <span>Previews: <span className="text-text-secondary">{running.previews}</span></span>
        )}
        {unread > 0 && (
          <span>Inbox: <span className="text-text-primary">{unread} new</span></span>
        )}
        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label="Hide status bar"
          title="Hide status bar"
          className="grid h-4 w-5 place-items-center rounded-md text-text-muted hover:text-text-primary"
        >
          <span className="rotate-90"><IconChevronRight size={10} /></span>
        </button>
      </div>
    </footer>
  )
}
