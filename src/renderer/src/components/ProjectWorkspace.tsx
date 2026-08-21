import { useEffect, useRef, useState } from 'react'
import type { Project, Session } from '../../../preload/index'
import { ChatView } from './ChatView'
import { ChipsRow } from './ChipsRow'
import { RightPanel } from './RightPanel'
import { Composer } from './Composer'
import { ResizeHandle } from './ResizeHandle'
import { useSessionModel } from './ModelDropdown'
import { ApplyBrainPrompt } from './ApplyBrainPrompt'
import { TerminalActionsMenu } from './TerminalActionsMenu'
import { KickoffPromptButton } from './KickoffPromptViewer'
import { ArtifactPane, type CodeTarget } from './ArtifactPane'
import { COMPOSER_FILL_EVENT } from './composerFill'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { IconPlus, IconTerminal, IconExternal, IconChevronRight } from './icons'
import { useSessions } from '../state/store'
import { classifyStatus, type AgentStatus } from '../../../shared/agentStatus'
import { fileUrlFor, shouldShowPreview } from '../../../shared/previewArtifact'
import { resolveServerUrl } from '../../../shared/localServer'
import { clampChatWidth, CHAT_DEFAULT_WIDTH, CHAT_MIN_WIDTH, CHAT_MAX_WIDTH } from './paneWidth'

const DEFAULT_MODEL = 'claude-sonnet-4.6'
const LS_CHAT_WIDTH = 't42:chat:width'

export function ProjectWorkspace({
  project,
  theme: _theme,
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
  const [hasMessages, setHasMessages] = useState(false)
  // Which file the code pane is showing, and which turn's snapshot to diff it
  // against. Cleared when the pane closes.
  const [codeFile, setCodeFile] = useState<CodeTarget | null>(null)
  // Which half of the artifact pane is showing, and whether it has taken the
  // whole window. Preview and Code are the same pane now, so opening a file
  // switches the tab instead of replacing what is on screen.
  const [paneTab, setPaneTab] = useState<'preview' | 'code'>('preview')
  const [paneExpanded, setPaneExpanded] = useState(false)

  /**
   * Attach files by appending their paths to the draft.
   *
   * The agent runs as a CLI with filesystem access, so a path is the whole
   * payload — there is nothing to upload. Appending rather than replacing
   * keeps whatever the user already typed.
   */
  const attach = async (sessionId: string, images: boolean): Promise<void> => {
    try {
      const paths = await window.terminal42.files.pick({ multi: true, images })
      if (!paths?.length) return
      window.dispatchEvent(new CustomEvent(COMPOSER_FILL_EVENT, {
        detail: { sessionId, mode: 'append', text: paths.map((p) => JSON.stringify(p)).join(' ') }
      }))
    } catch {}
  }

  // Reset busy when active session changes; ChatView will re-emit current state.
  useEffect(() => { setBusy(false) }, [active?.id])

  // Browser open is per-project, persisted in main (SQLite). The pane
  // starts closed; we hydrate from main asynchronously on project switch.
  // Persistence ONLY changes from a user-driven toggle. Auto-opens from
  // a detected preview do NOT persist, so closing the pane sticks.
  const [browserOpen, setBrowserOpenState] = useState<boolean>(false)
  // With a pane open the chat is the fixed column and the pane fills the
  // rest, so this is the width the resize handle now drives.
  const [chatWidth, setChatWidth] = useState<number>(() => {
    try { return clampChatWidth(Number(localStorage.getItem(LS_CHAT_WIDTH)) || CHAT_DEFAULT_WIDTH) } catch { return CHAT_DEFAULT_WIDTH }
  })
  const [browserNavTo, setBrowserNavTo] = useState<{ url: string; nonce: number } | null>(null)
  const seenPreviewUrlsRef = useRef<Set<string>>(new Set())
  // Read inside the artifact listener, which is registered once and would
  // otherwise close over the value of `browserOpen` at registration time.
  const browserOpenRef = useRef(false)
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
    // A page just appeared, so show the page. Landing on the Code half
    // because that is where the user was last would hide the thing the
    // auto-open exists to reveal.
    setPaneTab('preview')
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

  useEffect(() => { try { localStorage.setItem(LS_CHAT_WIDTH, String(chatWidth)) } catch {} }, [chatWidth])
  useEffect(() => { browserOpenRef.current = browserOpen }, [browserOpen])

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

  // Show a page the turn just wrote, instead of telling the user where it
  // landed. The path comes from the turn's own tool calls, so it arrives with
  // the answer; deriving it from the worktree diff meant waiting on a tree
  // hash that, in a large folder, never finished.
  //
  // Only fires for a page it hasn't shown before, and never while a dev server
  // is serving this project: that server is the real preview, and a file://
  // copy of one of its pages would load without the assets it serves. Uses the
  // non-persisting open so closing the pane still sticks.
  useEffect(() => {
    if (!project?.id) return
    let alive = true
    const off = window.terminal42.chat.onArtifact(({ path, cwd, serverOrigin }) => {
      const base = cwd || project.path
      const url = fileUrlFor(base, path)
      // A page we have shown before is not necessarily a page to ignore: when
      // a later turn edits the page currently on screen, the pane has to be
      // told again or it keeps rendering the previous version. Only skip when
      // the pane is closed, which means the user closed it and should not
      // have it reopened under them.
      if (!shouldShowPreview({ seen: seenPreviewUrlsRef.current.has(url), paneOpen: browserOpenRef.current })) return
      void window.terminal42.preview
        .running()
        .then(async (list) => {
          if (!alive) return
          if (list.some((r) => r.projectId === project.id && r.url)) return
          if (!shouldShowPreview({ seen: seenPreviewUrlsRef.current.has(url), paneOpen: browserOpenRef.current })) return
          // If the turn started a server for this page, that server is the
          // real page: opening the file instead gives the user a broken copy
          // next to a message saying it works.
          const served = serverOrigin
            ? await resolveServerUrl(serverOrigin, base, path, isReachable)
            : null
          if (!alive) return
          const target = served ?? url
          if (!shouldShowPreview({ seen: seenPreviewUrlsRef.current.has(target), paneOpen: browserOpenRef.current })) return
          seenPreviewUrlsRef.current.add(url)
          seenPreviewUrlsRef.current.add(target)
          // Same URL as last time re-fires with a fresh nonce on purpose:
          // that is what the pane treats as "reload what you are showing".
          autoOpenBrowser(target)
        })
        .catch(() => {})
    })
    return () => { alive = false; off() }
  }, [project?.id, project?.path])

  // Sniff terminal output across all sessions for local server URLs that  // Copilot (or any tool) prints inline: e.g. "Server is running at
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

  // One pane at a time. When either is up the chat goes compact: tabs collapse
  // into a dropdown and the column stops growing with the window.
  const paneOpen = Boolean(codeFile) || browserOpen

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-1 gap-[var(--gutter)] overflow-hidden p-[var(--gutter)]">
        <main
          className={[
            'flex-col overflow-hidden rounded-panel bg-bg',
            paneExpanded ? 'hidden' : 'flex',
            paneOpen ? 'shrink-0' : 'flex-1'
          ].join(' ')}
          style={paneOpen && !paneExpanded ? { width: `${chatWidth}px` } : undefined}
        >
          <SessionTabs
            compact={paneOpen}
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
                    onClick={() => { setBrowserOpen((v) => !v); setPaneTab('preview') }}
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
                    <ChatView
                      sessionId={s.id}
                      onBusyChange={s.id === active?.id ? setBusy : undefined}
                      onHasMessagesChange={s.id === active?.id ? setHasMessages : undefined}
                      onOpenFile={(messageId, path) => { setCodeFile({ messageId, path }); setPaneTab('code') }}
                    />
                  </div>
                ))
              )}
            </div>
            {active && (
              <>
                <ChipsRow
                  cwd={project.path}
                  onOpenFolder={() => { void window.terminal42.system.revealFolder(project.path) }}
                />
                <Composer
                key={active.id}
                sessionId={active.id}
                model={model}
                modelPending={pending}
                onModelPick={pick}
                onModelRestart={restart}
                modelPendingRestart={pendingRestart}
                busy={busy}
                hasMessages={hasMessages}
                onCancel={() => { void window.terminal42.chat.cancel(active.id) }}
                onSend={(text, agentMode) => { void window.terminal42.chat.send(active.id, text, model, null, agentMode) }}
                onAttachFile={() => void attach(active.id, false)}
                onAttachImage={() => void attach(active.id, true)}
              />
              </>
            )}
            {/* ChipsRow sits above the composer: only chips wired to real
                actions are shown, which is why the old "New worktree"
                placeholder is gone rather than restored. */}
          </div>
        </main>
        {paneOpen ? (
          <>
            {!paneExpanded && (
              <ResizeHandle side="left" currentWidth={chatWidth} onChange={(w) => setChatWidth(clampChatWidth(w))} min={CHAT_MIN_WIDTH} max={CHAT_MAX_WIDTH} />
            )}
            <ArtifactPane
              projectId={project.id}
              projectPath={project.path}
              activeSessionId={active?.id ?? null}
              codeTarget={codeFile}
              onCodeTargetChange={setCodeFile}
              tab={paneTab}
              onTabChange={setPaneTab}
              navTo={browserNavTo}
              expanded={paneExpanded}
              onToggleExpanded={() => setPaneExpanded((v) => !v)}
              onClose={() => {
                setCodeFile(null)
                setBrowserOpen(false)
                setPaneExpanded(false)
                setPaneTab('preview')
              }}
              width={0}
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
  modelControl,
  compact = false
}: {
  sessions: Session[]
  activeId: string | null
  onPick: (id: string) => void
  onNew: () => void
  onClose: (id: string) => void
  onRename: (id: string, title: string) => void
  modelControl: React.ReactNode
  compact?: boolean
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const status = useSessionStatuses(sessions.map((s) => s.id))

  // Narrow column: a row of tabs plus a new-session button does not fit
  // without truncating every title to nothing, so they collapse into one
  // dropdown that names the session you are actually in.
  if (compact) {
    return (
      <div className="flex h-9 items-center gap-1 bg-bg px-2">
        <SessionMenu
          sessions={sessions}
          activeId={activeId}
          status={status}
          onPick={onPick}
          onNew={onNew}
          onClose={onClose}
        />
        <div className="ml-auto flex shrink-0 items-center whitespace-nowrap pr-1">{modelControl}</div>
      </div>
    )
  }

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
                className="w-[140px] rounded-sm bg-bg px-1 py-0.5 text-[12px] text-text-primary focus:outline-none"
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

/**
 * Whether a local server answers for this URL.
 *
 * The status is read rather than probed with `no-cors`, because a `no-cors`
 * request resolves for a 404 too — which would make the first candidate
 * always win and defeat the point of having an ordered list. The renderer
 * runs with web security off, so the real status is available here.
 *
 * A short timeout stops a hung server holding the preview back, and any
 * failure falls back to the file on disk, which is the older behaviour.
 */
async function isReachable(url: string): Promise<boolean> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 1500)
  try {
    const res = await fetch(url, { method: 'GET', signal: ctrl.signal, cache: 'no-store' })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

function SessionMenu({
  sessions,
  activeId,
  status,
  onPick,
  onNew,
  onClose
}: {
  sessions: Session[]
  activeId: string | null
  status: Record<string, AgentStatus>
  onPick: (id: string) => void
  onNew: () => void
  onClose: (id: string) => void
}) {
  const active = sessions.find((s) => s.id === activeId) ?? sessions[0]
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button
          type="button"
          className="flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-text-primary outline-none transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          title="Switch session"
        >
          <SessionStatusDot status={(active && status[active.id]) ?? 'idle'} />
          <span className="truncate">{active?.title ?? 'Session'}</span>
          <span className="rotate-90 text-text-muted"><IconChevronRight size={11} /></span>
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align="start"
          sideOffset={4}
          className="z-50 min-w-[200px] rounded-lg bg-elevated p-1 shadow-lg"
        >
          {sessions.map((s) => (
            <Dropdown.Item
              key={s.id}
              onSelect={() => onPick(s.id)}
              className="group flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-text-secondary outline-none data-[highlighted]:bg-surface data-[highlighted]:text-text-primary"
            >
              <SessionStatusDot status={status[s.id] ?? 'idle'} />
              <span className="truncate">{s.title}</span>
              {sessions.length > 1 && (
                <button
                  type="button"
                  aria-label={`Close ${s.title}`}
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClose(s.id) }}
                  className="ml-auto text-text-muted opacity-0 transition group-data-[highlighted]:opacity-100 hover:text-text-primary"
                >
                  ×
                </button>
              )}
            </Dropdown.Item>
          ))}
          <Dropdown.Separator className="my-1 h-px bg-surface" />
          <Dropdown.Item
            onSelect={onNew}
            className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-text-secondary outline-none data-[highlighted]:bg-surface data-[highlighted]:text-text-primary"
          >
            <IconPlus size={12} />
            New session
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}

function NoProject() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-bg text-center">
      <div className="grid h-12 w-12 place-items-center rounded-md bg-surface text-text-secondary">
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
