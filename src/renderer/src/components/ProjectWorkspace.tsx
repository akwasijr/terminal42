import { useEffect, useRef, useState } from 'react'
import type { Project, Session } from '../../../preload/index'
import { ChatView } from './ChatView'
import { RightPanel } from './RightPanel'
import { Composer } from './Composer'
import { ResizeHandle } from './ResizeHandle'
import { useSessionModel } from './ModelDropdown'
import { ApplyBrainPrompt } from './ApplyBrainPrompt'
import { TerminalActionsMenu } from './TerminalActionsMenu'
import { KickoffPromptButton } from './KickoffPromptViewer'
import { BrowserPane } from './BrowserPane'
import { IconPlus, IconTerminal, IconExternal, IconEdit } from './icons'
import { useSessions } from '../state/store'
import { classifyStatus, type AgentStatus } from '../lib/agentStatus'

const DEFAULT_MODEL = 'claude-sonnet-4.6'
const LS_BROWSER_WIDTH = 't42:browser:width'

export function ProjectWorkspace({
  project,
  theme,
  isActive = true,
  onActiveSessionChange,
  onNavigate,
  rightWidth = 320,
  setRightWidth
}: {
  project: Project | null
  theme: 'dark' | 'light'
  isActive?: boolean
  onActiveSessionChange?: (id: string | null) => void
  onNavigate?: (target: 'brain' | 'workbench' | 'activity') => void
  rightWidth?: number
  setRightWidth?: (n: number) => void
}) {
  const { sessions, loaded, create, remove, rename } = useSessions(project?.id ?? null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const creatingRef = useRef(false)

  useEffect(() => {
    if (!loaded || !project) return
    if (sessions.length > 0) return
    if (creatingRef.current) return
    creatingRef.current = true
    void create('New session').finally(() => { creatingRef.current = false })
  }, [project, loaded, sessions.length, create])

  // Track the last id we reported up so we never re-emit the same value
  // on every render. Without this, when this workspace is the active tab
  // the effect would fire onActiveSessionChange(activeId) every render,
  // and because the parent passes a fresh callback each render the effect
  // would loop forever ("Maximum update depth exceeded" in dev).
  const lastReportedIdRef = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (!sessions.find((s) => s.id === activeId)) {
      const first = sessions[0]?.id ?? null
      setActiveId(first)
      if (isActive && lastReportedIdRef.current !== first) {
        lastReportedIdRef.current = first
        onActiveSessionChange?.(first)
      }
    } else if (isActive && lastReportedIdRef.current !== activeId) {
      lastReportedIdRef.current = activeId
      onActiveSessionChange?.(activeId)
    }
    // onActiveSessionChange intentionally omitted: callers don't memoise it,
    // so including it would re-fire the effect on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, activeId, isActive])

  // Reset our "last reported" cache when this workspace stops being active,
  // so the next time it becomes active it re-emits the current id.
  useEffect(() => {
    if (!isActive) lastReportedIdRef.current = undefined
  }, [isActive])

  const active = sessions.find((s) => s.id === activeId) ?? null
  const { model, pending, pick, restart, pendingRestart } = useSessionModel(active?.id ?? null, DEFAULT_MODEL)
  const [busy, setBusy] = useState(false)

  // Reset busy when active session changes; ChatView will re-emit current state.
  useEffect(() => { setBusy(false) }, [active?.id])

  // Browser open is per-project, persisted in main (SQLite). The pane
  // starts closed; we hydrate from main asynchronously on project switch.
  // Persistence ONLY changes from a user-driven toggle. Auto-opens from
  // a detected preview do NOT persist, so closing the pane sticks.
  const [browserOpen, setBrowserOpenState] = useState<boolean>(false)
  const [browserWidth, setBrowserWidth] = useState<number>(() => {
    try { return Math.max(320, Math.min(1200, Number(localStorage.getItem(LS_BROWSER_WIDTH)) || 480)) } catch { return 480 }
  })
  const [browserNavTo, setBrowserNavTo] = useState<{ url: string; nonce: number } | null>(null)
  const seenPreviewUrlsRef = useRef<Set<string>>(new Set())
  // Race-guard: every project switch bumps this token. Async hydration
  // results are ignored if the token has changed by the time they resolve.
  const openTokenRef = useRef(0)

  // User-driven toggle: persists the explicit preference for this project.
  // Guarded against a stale preload bundle (electron-vite dev quirk).
  const setBrowserOpen = (next: boolean | ((prev: boolean) => boolean)) => {
    setBrowserOpenState((prev) => {
      const value = typeof next === 'function' ? (next as (p: boolean) => boolean)(prev) : next
      const pid = project?.id
      const b: any = (window as any).terminal42?.browser
      if (pid && b && typeof b.setOpen === 'function') {
        try { void b.setOpen(pid, value) } catch {}
      }
      return value
    })
  }
  // Auto-open from a detected preview URL: does NOT persist, so the user
  // can still close it and the next project visit won't auto-pop again.
  const autoOpenBrowser = (url: string) => {
    setBrowserOpenState(true)
    setBrowserNavTo({ url, nonce: Date.now() })
  }

  // On project switch: reset the seen-URLs cache and hydrate the saved
  // open preference for this project. Race-guarded so a slow IPC reply
  // can't override a newer project switch.
  useEffect(() => {
    const myToken = ++openTokenRef.current
    seenPreviewUrlsRef.current = new Set()
    if (!project?.id) { setBrowserOpenState(false); return }
    const pid = project.id
    const b: any = (window as any).terminal42?.browser
    if (!b || typeof b.getOpen !== 'function') {
      // Preload not yet rebuilt: keep pane closed; user can still toggle.
      setBrowserOpenState(false)
      return
    }
    try {
      void b.getOpen(pid)
        .then((s: { isOpen: boolean; hasPreference: boolean }) => {
          if (myToken !== openTokenRef.current) return
          setBrowserOpenState(s.hasPreference ? s.isOpen : false)
        })
        .catch(() => {
          if (myToken === openTokenRef.current) setBrowserOpenState(false)
        })
    } catch {
      setBrowserOpenState(false)
    }
  }, [project?.id])

  useEffect(() => { try { localStorage.setItem(LS_BROWSER_WIDTH, String(browserWidth)) } catch {} }, [browserWidth])

  // Auto-pop the browser pane whenever a NEW preview server becomes ready
  // for THIS project (it appears in `running` with a URL we hadn't seen
  // before). Previews from other projects are ignored: they belong to
  // their own ProjectWorkspace instance.
  useEffect(() => {
    if (!project?.id) return
    let alive = true
    const handle = async () => {
      try {
        const list = await window.terminal42.preview.running()
        if (!alive) return
        for (const r of list) {
          if (!r.url) continue
          if (r.projectId !== project.id) continue
          if (!seenPreviewUrlsRef.current.has(r.url)) {
            seenPreviewUrlsRef.current.add(r.url)
            autoOpenBrowser(r.url)
          }
        }
      } catch {}
    }
    void handle()
    const off = window.terminal42.preview.onReady(() => void handle())
    return () => { alive = false; off() }
  }, [project?.id])

  // Sniff terminal output across all sessions for local server URLs that
  // Copilot (or any tool) prints inline: e.g. "Server is running at
  // http://localhost:8000/". When we see one we haven't auto-loaded yet,
  // pop the browser open and navigate there.
  useEffect(() => {
    if (sessions.length === 0) return
    const buf = new Map<string, string>()
    const URL_RE = /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(?::\d+)?(?:\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#]*)?/gi
    const offs: Array<() => void> = []
    for (const s of sessions) {
      const id = s.id
      buf.set(id, '')
      const off = window.terminal42.pty.onData(id, (chunk) => {
        const stripped = chunk.replace(/\x1B\[[0-9;?]*[A-Za-z]/g, '').replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/g, '')
        let combined = (buf.get(id) || '') + stripped
        if (combined.length > 4000) combined = combined.slice(-4000)
        buf.set(id, combined)
        const matches = combined.match(URL_RE)
        if (!matches) return
        for (const raw of matches) {
          const url = raw.replace(/[).,;:'"`>\]]+$/, '')
          if (seenPreviewUrlsRef.current.has(url)) continue
          seenPreviewUrlsRef.current.add(url)
          autoOpenBrowser(url)
        }
      })
      offs.push(off)
    }
    return () => { offs.forEach((o) => o()) }
  }, [sessions.map((s) => s.id).join(',')])

  if (!project) return <NoProject />

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-bg">
      <div className="flex flex-1 overflow-hidden">
        <main className="flex flex-1 flex-col overflow-hidden bg-bg">
          <SessionTabs
            sessions={sessions}
            activeId={active?.id ?? null}
            onPick={(id) => {
              setActiveId(id)
              onActiveSessionChange?.(id)
            }}
            onNew={async () => {
              const s = await create('New session')
              if (s) {
                setActiveId(s.id)
                onActiveSessionChange?.(s.id)
              }
            }}
            onClose={(id) => void remove(id)}
            onRename={(id, title) => void rename(id, title)}
            modelControl={
              active ? (
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setBrowserOpen((v) => !v)}
                    aria-pressed={browserOpen}
                    aria-label={browserOpen ? 'Hide browser preview' : 'Show browser preview'}
                    className={[
                      'grid h-7 w-7 place-items-center rounded-md outline-none focus-visible:outline-none',
                      browserOpen
                        ? 'bg-elevated text-text-primary'
                        : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                    ].join(' ')}
                    title={browserOpen ? 'Hide browser preview' : 'Show browser preview'}
                  >
                    <IconExternal size={13} />
                  </button>
                  <KickoffPromptButton projectId={project.id} sessionId={active.id} />
                  <button
                    type="button"
                    onClick={() => {
                      const idea = `Use this project as context: "${project.name}" at ${project.path}. Read the README + key source files to understand what it does, then design accordingly.`
                      window.dispatchEvent(new CustomEvent('t42:open-design-wizard', { detail: { idea } }))
                    }}
                    title="Spin off as a design: opens the Design wizard pre-filled with this project as context"
                    className="grid h-7 w-7 place-items-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary"
                  >
                    <IconEdit size={12} />
                  </button>
                  <TerminalActionsMenu sessionId={active.id} />
                </div>
              ) : null
            }
          />
          <div className="flex flex-1 flex-col overflow-hidden">
            {active ? (
              <ApplyBrainPrompt sessionId={active.id} projectId={project.id} />
            ) : null}
            <div className="relative flex-1 overflow-hidden">
              {sessions.length === 0 ? (
                <div className="grid h-full place-items-center text-text-muted">
                  Creating your first session…
                </div>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    className="absolute inset-0"
                    style={{ visibility: s.id === active?.id && isActive ? 'visible' : 'hidden' }}
                    aria-hidden={s.id !== active?.id || !isActive}
                  >
                    <ChatView sessionId={s.id} onBusyChange={s.id === active?.id ? setBusy : undefined} />
                  </div>
                ))
              )}
            </div>
            {active && (
              <Composer
                key={active.id}
                sessionId={active.id}
                model={model}
                modelPending={pending}
                onModelPick={pick}
                onModelRestart={restart}
                modelPendingRestart={pendingRestart}
                busy={busy}
                onCancel={() => { void window.terminal42.chat.cancel(active.id) }}
                onSend={(text, agentMode) => { void window.terminal42.chat.send(active.id, text, model, null, agentMode) }}
              />
            )}
            {/* ChipsRow (folder · worktree · branch) removed: chips were
                non-functional. Branch + cwd are visible in the right panel. */}
          </div>
        </main>
        {browserOpen ? (
          <>
            <ResizeHandle side="right" currentWidth={browserWidth} onChange={setBrowserWidth} min={320} max={1200} />
            <BrowserPane
              projectId={project.id}
              width={browserWidth}
              onClose={() => setBrowserOpen(false)}
              navTo={browserNavTo}
              activeSessionId={active?.id ?? null}
            />
          </>
        ) : (
          <>
            {setRightWidth && (
              <ResizeHandle side="right" currentWidth={rightWidth} onChange={setRightWidth} min={260} max={520} />
            )}
            <RightPanel sessionId={active?.id ?? null} projectId={project.id} cwd={project.path} model={model} onNavigate={onNavigate} width={rightWidth} />
          </>
        )}
      </div>
    </div>
  )
}

function SessionTabs({
  sessions,
  activeId,
  onPick,
  onNew,
  onClose,
  onRename,
  modelControl
}: {
  sessions: Session[]
  activeId: string | null
  onPick: (id: string) => void
  onNew: () => void
  onClose: (id: string) => void
  onRename: (id: string, title: string) => void
  modelControl: React.ReactNode
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const status = useSessionStatuses(sessions.map((s) => s.id))
  return (
    <div className="flex h-9 items-stretch bg-bg px-2">
      {sessions.map((s) => {
        const isActive = s.id === activeId
        const isEditing = editingId === s.id
        const st = status[s.id] ?? 'idle'
        return (
          <div
            key={s.id}
            className={[
              'group my-1 flex items-center gap-2 rounded-md px-3 text-[12px] transition-colors',
              isActive
                ? 'bg-elevated/70 font-medium text-text-primary'
                : 'text-text-muted hover:text-text-secondary'
            ].join(' ')}
          >
            <SessionStatusDot status={st} />
            {isEditing ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                  if (draft.trim() && draft.trim() !== s.title) onRename(s.id, draft.trim())
                  setEditingId(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (draft.trim() && draft.trim() !== s.title) onRename(s.id, draft.trim())
                    setEditingId(null)
                  }
                  if (e.key === 'Escape') setEditingId(null)
                }}
                className="w-[140px] rounded-sm border border-border bg-bg px-1 py-0.5 text-[12px] text-text-primary focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => onPick(s.id)}
                onDoubleClick={() => { setDraft(s.title); setEditingId(s.id) }}
                className="truncate max-w-[160px] text-left"
                title="Click to switch · Double-click to rename"
              >
                {s.title}
              </button>
            )}
            {sessions.length > 1 && !isEditing && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClose(s.id) }}
                aria-label={`Close ${s.title}`}
                className="ml-1 text-text-muted opacity-0 transition group-hover:opacity-100 hover:text-text-primary"
              >
                ×
              </button>
            )}
          </div>
        )
      })}
      <button
        type="button"
        aria-label="New session"
        onClick={onNew}
        className="ml-1 grid w-8 place-items-center text-text-muted hover:text-text-primary"
      >
        <IconPlus size={14} />
      </button>
      <div className="ml-auto flex shrink-0 items-center whitespace-nowrap pr-1">{modelControl}</div>
    </div>
  )
}

function NoProject() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-bg text-center">
      <div className="grid h-12 w-12 place-items-center rounded-md border border-border bg-surface text-text-secondary">
        <IconTerminal size={20} />
      </div>
      <h1 className="text-[16px] font-semibold text-text-primary">No project open</h1>
      <p className="max-w-sm text-[13px] text-text-secondary">
        Add a folder from the sidebar to start a session. Each project keeps its own sessions and history.
      </p>
    </main>
  )
}

// ─── Per-session status (for tab dots) ────────────────────────────────────
// Polls pty.scrollback for each session every 5s, classifies to
// waiting/working/idle. Cheap: scrollback is in-memory, no PTY fan-out.
function useSessionStatuses(sessionIds: string[]): Record<string, AgentStatus> {
  const [map, setMap] = useState<Record<string, AgentStatus>>({})
  const key = sessionIds.join('|')
  useEffect(() => {
    if (!sessionIds.length) { setMap({}); return }
    let cancelled = false
    const tick = async () => {
      const next: Record<string, AgentStatus> = {}
      await Promise.all(sessionIds.map(async (id) => {
        try {
          const sb = await window.terminal42.pty.scrollback(id)
          next[id] = classifyStatus(sb)
        } catch {
          next[id] = 'idle'
        }
      }))
      if (!cancelled) setMap(next)
    }
    void tick()
    const t = setInterval(tick, 5000)
    return () => { cancelled = true; clearInterval(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return map
}

function SessionStatusDot({ status }: { status: AgentStatus }) {
  const cfg = status === 'waiting'
    ? { cls: 'bg-warning', title: 'Waiting on you' }
    : status === 'working'
      ? { cls: 'bg-accent animate-pulse', title: 'Working' }
      : { cls: 'bg-text-muted', title: 'Idle' }
  return (
    <span
      className={['h-1.5 w-1.5 rounded-full', cfg.cls].join(' ')}
      aria-label={cfg.title}
      title={cfg.title}
    />
  )
}
