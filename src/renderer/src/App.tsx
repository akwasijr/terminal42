import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import {
  IconTerminal, IconFolder, IconSparkle, IconCode,
  IconSearch, IconGear, IconTheme, IconPlus, IconBell, IconBrain, IconEdit, IconTrash, IconClock,
  IconChevronRight, IconWorkflow, IconChat
} from './components/icons'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { ProjectWorkspace } from './components/ProjectWorkspace'
import { TerminalPane } from './components/TerminalPane'
import { AgentStatusWatcher } from './components/AgentStatusWatcher'
import { playAttentionChime } from './lib/notifySound'
import { ResizeHandle, useResizableWidth } from './components/ResizeHandle'
import { buildKickoffPrompt } from './lib/brief'
import type { Design, InboxEntry } from '../../preload/index'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useProjects } from './state/store'
import type { Project } from '../../preload/index'

// Route-level views are code-split so the initial bundle (and first paint of
// the default terminal view) stays small. Each pulls in heavy dependencies
// (markmap, xlsx, react-markdown, cmdk) that aren't needed until the user
// navigates to that view.
const BrainView = lazy(() => import('./components/BrainView').then((m) => ({ default: m.BrainView })))
const WorkbenchView = lazy(() =>
  import('./components/WorkbenchView').then((m) => ({ default: m.WorkbenchView }))
)
const BriefWizard = lazy(() =>
  import('./components/BriefWizard').then((m) => ({ default: m.BriefWizard }))
)
const ActivityView = lazy(() =>
  import('./components/ActivityView').then((m) => ({ default: m.ActivityView }))
)
const SettingsView = lazy(() =>
  import('./components/SettingsView').then((m) => ({ default: m.SettingsView }))
)
const FindAnything = lazy(() =>
  import('./components/FindAnything').then((m) => ({ default: m.FindAnything }))
)
const DesignsListView = lazy(() =>
  import('./components/DesignsListView').then((m) => ({ default: m.DesignsListView }))
)
const DesignWorkspace = lazy(() =>
  import('./components/DesignWorkspace').then((m) => ({ default: m.DesignWorkspace }))
)

type NavId = 'terminal' | 'rawterm' | 'designs' | 'projects' | 'workbench' | 'brain' | 'activity' | 'settings'

const UI_STATE_KEY = 't42:ui:state:v1'

type PersistedUIState = {
  active: NavId
  activeProjectId: string | null
  openedProjectIds: string[]
  activeSessionByProject: Record<string, string | null>
  activeDesignId: string | null
}

function loadUIState(): Partial<PersistedUIState> {
  if (typeof window === 'undefined') return {}
  // Safe-mode: main reloads with ?safe=1 after repeated renderer crashes.
  // Drop the persisted UI state so we don't immediately reopen whatever
  // view was crashing (typically the active design).
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('safe') === '1') {
      try { localStorage.removeItem(UI_STATE_KEY) } catch {}
      return {}
    }
  } catch {}
  try {
    const raw = localStorage.getItem(UI_STATE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<PersistedUIState>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveUIState(state: PersistedUIState): void {
  try { localStorage.setItem(UI_STATE_KEY, JSON.stringify(state)) } catch {}
}

const PRIMARY_NAV: { id: NavId; label: string; Icon: typeof IconTerminal }[] = [
  { id: 'terminal', label: 'Chat',     Icon: IconChat },
  { id: 'rawterm',  label: 'Terminal', Icon: IconTerminal },
  { id: 'designs',  label: 'Design',   Icon: IconSparkle },
]
const SECONDARY_NAV: { id: NavId; label: string; Icon: typeof IconTerminal }[] = [
  { id: 'workbench', label: 'Automations', Icon: IconCode },
  { id: 'brain',     label: 'Brain',       Icon: IconBrain },
  { id: 'activity',  label: 'Activity',    Icon: IconClock }
]

export function App() {
  const initialUI = loadUIState()
  const validNav: NavId[] = ['terminal', 'rawterm', 'designs', 'projects', 'workbench', 'brain', 'activity', 'settings']
  const [active, setActive] = useState<NavId>(
    initialUI.active && validNav.includes(initialUI.active) ? initialUI.active : 'terminal'
  )
  const [theme, setTheme] = useState<'dark' | 'light'>(
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  )
  const { projects, add, touch, refresh: refreshProjects } = useProjects()
  const [activeProjectId, setActiveProjectId] = useState<string | null>(initialUI.activeProjectId ?? null)
  const [openedProjectIds, setOpenedProjectIds] = useState<string[]>(
    Array.isArray(initialUI.openedProjectIds) ? initialUI.openedProjectIds : []
  )
  const [activeSessionByProject, setActiveSessionByProject] = useState<Record<string, string | null>>(
    initialUI.activeSessionByProject && typeof initialUI.activeSessionByProject === 'object'
      ? initialUI.activeSessionByProject
      : {}
  )
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [pendingProject, setPendingProject] = useState<Project | null>(null)
  const [unread, setUnread] = useState(0)
  const [renameTarget, setRenameTarget] = useState<Project | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Project | null>(null)
  const [sidebarWidth, setSidebarWidth] = useResizableWidth('t42.sidebar.width', 240, 200, 420)
  const [sidebarHidden, setSidebarHidden] = useState<boolean>(() => {
    try { return localStorage.getItem('t42:sidebar:hidden') === '1' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem('t42:sidebar:hidden', sidebarHidden ? '1' : '0') } catch {}
  }, [sidebarHidden])
  // On really wide screens there's plenty of room — keep the sidebar
  // pinned open and ignore any collapse state (manual or auto-hide on
  // design open). Threshold tuned so 1440px laptops still respect the
  // user's preference; only true wide displays force-open.
  const [wideScreen, setWideScreen] = useState<boolean>(() => {
    try { return window.innerWidth >= 1600 } catch { return false }
  })
  useEffect(() => {
    const onResize = (): void => setWideScreen(window.innerWidth >= 1600)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  useEffect(() => {
    if (wideScreen && sidebarHidden) setSidebarHidden(false)
  }, [wideScreen, sidebarHidden])
  const [rightWidth, setRightWidth] = useResizableWidth('t42.rightpanel.width', 320, 260, 520)
  // Persisted active design intentionally NOT restored on load. If a
  // previously-opened design has bad HTML (or anything else that crashes
  // the renderer), restoring it would re-crash the app on every launch.
  // The user clicks back into a design from the Designs list when they
  // want to open it. We still write the field so the rest of the
  // saveUIState shape stays stable, but it's never read on init.
  const [activeDesignId, setActiveDesignId] = useState<string | null>(null)
  const [designWizardSeed, setDesignWizardSeed] = useState<{ idea: string } | null>(null)

  // Cross-tab trigger: any other view can dispatch a CustomEvent
  // 't42:open-design-wizard' with detail {idea} to switch into the
  // Designs tab and pop the wizard pre-filled. Used by ProjectWorkspace
  // ("Spin off as design") and any future caller.
  useEffect(() => {
    const onOpen = (e: Event): void => {
      const ce = e as CustomEvent<{ idea?: string }>
      setDesignWizardSeed({ idea: String(ce.detail?.idea ?? '') })
      setActive('designs')
      setActiveDesignId(null)
    }
    window.addEventListener('t42:open-design-wizard', onOpen as EventListener)
    return () => window.removeEventListener('t42:open-design-wizard', onOpen as EventListener)
  }, [])

  // Cross-tab trigger: open a specific existing design by id (used by the
  // Inbox in the Activity tab when "Open" is clicked on a finished design).
  useEffect(() => {
    const onOpen = (e: Event): void => {
      const ce = e as CustomEvent<{ designId?: string }>
      const id = String(ce.detail?.designId ?? '')
      if (!id) return
      setActive('designs')
      setActiveDesignId(id)
    }
    window.addEventListener('t42:open-design', onOpen as EventListener)
    return () => window.removeEventListener('t42:open-design', onOpen as EventListener)
  }, [])

  // Cross-tab trigger: jump to the terminal tab (used by Quick Actions
  // "Connect to GitHub" after it writes a prompt into the active PTY).
  useEffect(() => {
    const onJump = (): void => { setActive('terminal') }
    window.addEventListener('t42:jump-to-terminal', onJump)
    return () => window.removeEventListener('t42:jump-to-terminal', onJump)
  }, [])

  // When a Design is opened, hide the app sidebar entirely; restore on close.
  // We only auto-modify when designs view is active so user-controlled state
  // for other tabs is preserved.
  const sidebarBeforeDesignRef = useRef<boolean | null>(null)
  useEffect(() => {
    const enteringDesign = active === 'designs' && activeDesignId !== null
    if (enteringDesign && sidebarBeforeDesignRef.current === null) {
      sidebarBeforeDesignRef.current = sidebarHidden
      if (!wideScreen) setSidebarHidden(true)
    } else if (!enteringDesign && sidebarBeforeDesignRef.current !== null) {
      setSidebarHidden(sidebarBeforeDesignRef.current)
      sidebarBeforeDesignRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, activeDesignId])

  const activeSessionId = activeProjectId ? activeSessionByProject[activeProjectId] ?? null : null
  const setActiveSessionId = (id: string | null) => {
    if (!activeProjectId) return
    setActiveSessionByProject((prev) => ({ ...prev, [activeProjectId]: id }))
  }

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('t42-theme', theme)
  }, [theme])

  useEffect(() => {
    if (projects.length === 0) return
    if (activeProjectId && projects.some((p) => p.id === activeProjectId)) return
    setActiveProjectId(projects[0].id)
  }, [projects, activeProjectId])

  useEffect(() => {
    if (activeProjectId && !openedProjectIds.includes(activeProjectId)) {
      setOpenedProjectIds((prev) => [...prev, activeProjectId])
    }
  }, [activeProjectId, openedProjectIds])

  useEffect(() => {
    setOpenedProjectIds((prev) => prev.filter((id) => projects.some((p) => p.id === id)))
    setActiveSessionByProject((prev) => {
      const next: Record<string, string | null> = {}
      for (const p of projects) if (p.id in prev) next[p.id] = prev[p.id]
      return next
    })
  }, [projects])

  useEffect(() => {
    saveUIState({ active, activeProjectId, openedProjectIds, activeSessionByProject, activeDesignId })
  }, [active, activeProjectId, openedProjectIds, activeSessionByProject, activeDesignId])

  useEffect(() => {
    const refresh = () => void window.terminal42.inbox.unreadCount().then(setUnread)
    refresh()
    const off = window.terminal42.inbox.onNew(refresh)
    return off
  }, [])

  // Chime when a design run finishes — but only if the user isn't actively
  // looking at that design (otherwise the visual update is feedback enough).
  useEffect(() => {
    const off = window.terminal42.designs.onDone((d) => {
      const lookingHere = active === 'designs' && activeDesignId === d.designId && document.hasFocus()
      if (lookingHere) return
      playAttentionChime()
    })
    return () => { off() }
  }, [active, activeDesignId])

  useEffect(() => {
    const hexToTriplet = (hex: string): string | null => {
      const m = /^#?([a-f\d]{6})$/i.exec(hex.trim())
      if (!m) return null
      const n = parseInt(m[1], 16)
      return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
    }
    const apply = (s: { accentColor?: string; translucentSidebar?: boolean } | null): void => {
      if (!s) return
      const root = document.documentElement
      if (s.accentColor) {
        const rgb = hexToTriplet(s.accentColor)
        if (rgb) root.style.setProperty('--accent', rgb)
        else root.style.removeProperty('--accent')
      } else {
        root.style.removeProperty('--accent')
      }
      root.dataset.translucent = s.translucentSidebar ? 'true' : 'false'
    }
    void window.terminal42.settings.get().then(apply)
    const onChange = (e: Event): void => apply((e as CustomEvent).detail)
    window.addEventListener('t42:settings-changed', onChange)
    return () => window.removeEventListener('t42:settings-changed', onChange)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }
      // Cmd/Ctrl + Shift + A toggles the Activity (agent view).
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setActive((cur) => cur === 'activity' ? 'terminal' : 'activity')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null

  const handlePickProject = async (p: Project) => {
    setActiveProjectId(p.id)
    setActive('terminal')
    await touch(p.id)
  }

  const handleAddProject = async () => {
    const p = await add()
    if (p) setPendingProject(p)
  }

  const handleOpenFolder = async () => {
    const p = await add()
    if (!p) return
    setActiveProjectId(p.id)
    setActive('terminal')
  }

  const handleBriefComplete = async (brief: import('../../preload/index').ProjectBrief, startWithCopilot: boolean) => {
    if (!pendingProject) return
    try {
      await window.terminal42.brief.save(pendingProject.id, brief)
    } catch (err) {
      console.error('brief save failed', err)
    }
    if (startWithCopilot && brief.type !== 'blank') {
      let inspirationBaseDir: string | undefined
      try { inspirationBaseDir = await window.terminal42.brief.inspirationDir(pendingProject.id) } catch {}
      let brandBaseDir: string | undefined
      try { brandBaseDir = await window.terminal42.brief.brandDir(pendingProject.id) } catch {}
      const prompt = buildKickoffPrompt(brief, { inspirationBaseDir, brandBaseDir })
      if (prompt) {
        try { localStorage.setItem(`t42:kickoff:${pendingProject.id}`, prompt) } catch {}
      }
    }
    setActiveProjectId(pendingProject.id)
    setActive('terminal')
    setPendingProject(null)
  }

  const handleBriefCancel = () => {
    if (!pendingProject) return
    setActiveProjectId(pendingProject.id)
    setActive('terminal')
    setPendingProject(null)
  }

  const handlePaletteModel = async (id: string) => {
    if (!activeSessionId) return
    await window.terminal42.pty.write(activeSessionId, `/model ${id}\r`)
    await window.terminal42.sessions.setModel(activeSessionId, id)
  }

  const handleRemoveProject = (p: Project) => {
    setRemoveTarget(p)
  }

  const confirmRemoveProject = async () => {
    const p = removeTarget
    if (!p) return
    setRemoveTarget(null)

    // Clean local state synchronously BEFORE the IPC + refresh so we don't
    // momentarily render the deleted project as "active" (which can trigger
    // tab-creation effects, kickoff prompts, or empty-home auto-flows).
    setActiveProjectId((cur) => (cur === p.id ? null : cur))
    setOpenedProjectIds((prev) => prev.filter((id) => id !== p.id))
    setActiveSessionByProject((prev) => {
      if (!(p.id in prev)) return prev
      const next = { ...prev }
      delete next[p.id]
      return next
    })

    // Drop any pending kickoff prompt and inbox state for this project.
    try { localStorage.removeItem(`t42:kickoff:${p.id}`) } catch {}

    try {
      await window.terminal42.projects.remove(p.id)
    } catch (err) {
      console.error('project remove failed', err)
    }
    await refreshProjects()
  }

  return (
    <div className="flex h-full flex-col bg-bg text-text-primary">
      <AgentStatusWatcher activeNav={active} activeProjectId={activeProjectId} />
      <TopBar
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        projectName={activeProject?.name}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenSettings={() => setActive('settings')}
        unread={unread}
      />
      <div className="flex flex-1 overflow-hidden">
        {sidebarHidden ? (
          <button
            type="button"
            onClick={() => setSidebarHidden(false)}
            aria-label="Show sidebar"
            title="Show sidebar"
            className="group grid h-full w-3 shrink-0 place-items-center border-r border-border bg-surface text-text-muted hover:w-4 hover:bg-elevated hover:text-text-primary"
          >
            <IconChevronRight size={11} />
          </button>
        ) : (
          <>
            <Sidebar
              active={active}
              onSelect={setActive}
              projects={projects}
              activeProjectId={activeProjectId}
              onPickProject={handlePickProject}
              onAddProject={handleAddProject}
              onRenameProject={setRenameTarget}
              onRemoveProject={handleRemoveProject}
              unread={unread}
              width={sidebarWidth}
              onCollapse={wideScreen ? undefined : () => setSidebarHidden(true)}
              theme={theme}
              onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            />
            <ResizeHandle side="left" currentWidth={sidebarWidth} onChange={setSidebarWidth} min={200} max={420} />
          </>
        )}
        <Main
          active={active}
          setActive={setActive}
          activeProject={activeProject}
          openedProjects={projects.filter((p) => openedProjectIds.includes(p.id))}
          activeSessionId={activeSessionId}
          onActiveSessionChange={setActiveSessionId}
          theme={theme}
          onAddProject={handleAddProject}
          onOpenFolder={handleOpenFolder}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          rightWidth={rightWidth}
          setRightWidth={setRightWidth}
          activeDesignId={activeDesignId}
          onOpenDesign={(d) => setActiveDesignId(d.id)}
          onCloseDesign={() => setActiveDesignId(null)}
          designWizardSeed={designWizardSeed}
          onClearDesignWizardSeed={() => setDesignWizardSeed(null)}
        />
      </div>
      {paletteOpen && (
        <Suspense fallback={null}>
          <FindAnything
            open={paletteOpen}
            onOpenChange={setPaletteOpen}
            projects={projects}
            onPickProject={handlePickProject}
            onSetView={setActive}
            onPickModel={handlePaletteModel}
            onAddProject={handleAddProject}
          />
        </Suspense>
      )}
      <RenameDialog
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        onSubmit={async (name) => {
          if (renameTarget) {
            await window.terminal42.projects.rename(renameTarget.id, name)
            await refreshProjects()
          }
          setRenameTarget(null)
        }}
      />
      {pendingProject && (
        <Suspense fallback={null}>
          <BriefWizard
            folderPath={pendingProject.path}
            projectId={pendingProject.id}
            onCancel={handleBriefCancel}
            onComplete={handleBriefComplete}
          />
        </Suspense>
      )}
      <ConfirmDialog
        target={removeTarget}
        title="Remove project from list?"
        message={removeTarget
          ? `“${removeTarget.name}” will be removed from your sidebar. The folder on disk and any files inside it stay where they are.`
          : ''}
        confirmLabel="Remove"
        destructive
        onCancel={() => setRemoveTarget(null)}
        onConfirm={confirmRemoveProject}
      />
    </div>
  )
}

function RenameDialog({
  target, onClose, onSubmit
}: { target: Project | null; onClose: () => void; onSubmit: (name: string) => void }) {
  const [value, setValue] = useState('')
  useEffect(() => { if (target) setValue(target.name) }, [target])
  if (!target) return null
  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-[360px] rounded-lg border border-border bg-surface p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-title"
      >
        <h2 id="rename-title" className="text-[14px] font-semibold">Rename project</h2>
        <p className="mt-1 text-[12px] text-text-muted truncate" title={target.path}>{target.path}</p>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) onSubmit(value.trim())
            if (e.key === 'Escape') onClose()
          }}
          className="mt-3 w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-[13px] text-text-primary focus:border-accent focus:outline-none"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2.5 py-1.5 text-[12px] text-text-secondary hover:bg-elevated hover:text-text-primary"
          >Cancel</button>
          <button
            type="button"
            disabled={!value.trim()}
            onClick={() => onSubmit(value.trim())}
            className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-text disabled:opacity-40"
          >Rename</button>
        </div>
      </div>
    </div>
  )
}

function ConfirmDialog({
  target, title, message, confirmLabel, destructive, onCancel, onConfirm
}: {
  target: unknown
  title: string
  message: string
  confirmLabel: string
  destructive?: boolean
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}) {
  if (!target) return null
  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/40"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="w-[400px] rounded-lg border border-border bg-surface p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel()
          if (e.key === 'Enter') void onConfirm()
        }}
        tabIndex={-1}
      >
        <h2 id="confirm-title" className="text-[14px] font-semibold">{title}</h2>
        <p className="mt-2 text-[12.5px] leading-relaxed text-text-secondary">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-2.5 py-1.5 text-[12px] text-text-secondary hover:bg-elevated hover:text-text-primary"
          >Cancel</button>
          <button
            type="button"
            autoFocus
            onClick={() => void onConfirm()}
            className={[
              'rounded-md px-3 py-1.5 text-[12px] font-medium',
              destructive
                ? 'bg-red-600 text-white hover:bg-red-500'
                : 'bg-accent text-accent-text hover:opacity-90'
            ].join(' ')}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

function TopBar({
  theme, onToggleTheme, projectName, onOpenPalette, onOpenSettings, unread
}: {
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  projectName?: string
  onOpenPalette: () => void
  onOpenSettings: () => void
  unread: number
}) {
  void onOpenSettings
  return (
    <header className="titlebar-drag flex h-12 items-center justify-between border-b border-border bg-bg px-4">
      <div className="titlebar-no-drag flex items-center gap-2.5 pl-16">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-accent text-[10px] font-bold leading-none text-accent-text">42</div>
        <span className="text-[13px] font-semibold">Terminal42</span>
        {projectName && (
          <>
            <span className="text-text-muted">·</span>
            <span className="text-[13px] text-text-secondary">{projectName}</span>
          </>
        )}
      </div>
      <div className="titlebar-no-drag flex items-center gap-3">
        <InboxBell unread={unread} />
        <button
          type="button"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={onToggleTheme}
          className="grid h-6 w-6 place-items-center rounded-sm text-text-secondary hover:text-text-primary"
        >
          <IconTheme />
        </button>
      </div>
    </header>
  )
}

function InboxBell({ unread }: { unread: number }) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<InboxEntry[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    void window.terminal42.inbox.list().then(setEntries)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const markRead = async (id: string): Promise<void> => {
    await window.terminal42.inbox.markRead(id)
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, read: 1 } : e)))
  }
  const remove = async (id: string): Promise<void> => {
    await window.terminal42.inbox.remove(id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }
  const markAllRead = async (): Promise<void> => {
    const unreadEntries = entries.filter((e) => !e.read)
    await Promise.all(unreadEntries.map((e) => window.terminal42.inbox.markRead(e.id)))
    setEntries((prev) => prev.map((e) => ({ ...e, read: 1 })))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
        className="relative grid h-7 w-7 place-items-center rounded-sm text-text-secondary hover:text-text-primary"
      >
        <IconBell size={14} />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 grid h-3.5 min-w-[14px] place-items-center rounded-full bg-accent px-1 text-[9.5px] font-semibold leading-none text-accent-text">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-30 flex w-[360px] flex-col overflow-hidden rounded-lg bg-elevated/95 shadow-2xl ring-1 ring-white/5">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-[12.5px] font-medium text-text-primary">Notifications</span>
            {entries.some((e) => !e.read) && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-[11.5px] text-text-secondary hover:text-text-primary"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {entries.length === 0 ? (
              <div className="px-4 py-8 text-center text-[12px] text-text-muted">No notifications.</div>
            ) : (
              <ul>
                {entries.map((e) => (
                  <li
                    key={e.id}
                    className={[
                      'group flex items-start gap-2 px-3 py-2.5 hover:bg-bg/40',
                      e.read ? 'opacity-70' : ''
                    ].join(' ')}
                  >
                    {!e.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-medium text-text-primary">{e.title}</div>
                      {e.body && <p className="line-clamp-2 text-[11.5px] text-text-secondary">{e.body}</p>}
                      <div className="mt-0.5 text-[10.5px] text-text-muted">{relTime(e.created_at)} · {e.kind}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {!e.read && (
                        <button
                          type="button"
                          onClick={() => void markRead(e.id)}
                          aria-label="Mark read"
                          title="Mark read"
                          className="grid h-6 w-6 place-items-center rounded-sm text-text-muted hover:bg-bg/60 hover:text-text-primary"
                        >
                          ✓
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void remove(e.id)}
                        aria-label="Delete"
                        title="Delete"
                        className="grid h-6 w-6 place-items-center rounded-sm text-text-muted hover:bg-bg/60 hover:text-text-primary"
                      >
                        <IconTrash size={11} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function relTime(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}

function IconButton({
  children, onClick, ariaLabel
}: { children: React.ReactNode; onClick?: () => void; ariaLabel: string }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-sm text-text-secondary hover:text-text-primary"
    >
      {children}
    </button>
  )
}
// eslint reference (kept exported for potential reuse)
void IconButton

function Sidebar({
  active, onSelect, projects, activeProjectId, onPickProject, onAddProject, onRenameProject, onRemoveProject, unread, width, onCollapse, theme, onToggleTheme
}: {
  active: NavId
  onSelect: (id: NavId) => void
  projects: Project[]
  activeProjectId: string | null
  onPickProject: (p: Project) => void
  onAddProject: () => void
  onRenameProject: (p: Project) => void
  onRemoveProject: (p: Project) => void
  unread: number
  width: number
  onCollapse?: () => void
  theme?: 'dark' | 'light'
  onToggleTheme?: () => void
}) {
  void unread
  const inSecondary = SECONDARY_NAV.some((n) => n.id === active)
  return (
    <nav
      className="t42-sidebar relative flex shrink-0 flex-col bg-surface px-2 py-2.5"
      style={{ width }}
    >
      {/* Primary nav */}
      <ul className="flex flex-col gap-0.5">
        {PRIMARY_NAV.map(({ id, label, Icon }) => {
          const isActive = id === active
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelect(id)}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[13px] transition-colors',
                  isActive
                    ? 'bg-elevated font-medium text-text-primary'
                    : 'text-text-secondary hover:bg-elevated/60 hover:text-text-primary'
                ].join(' ')}
              >
                <Icon size={15} className={isActive ? 'text-text-primary' : ''} />
                <span className="truncate">{label}</span>
              </button>
            </li>
          )
        })}

        {/* Secondary tools: collapsed under a single "More" dropdown */}
        <li>
          <Dropdown.Root>
            <Dropdown.Trigger asChild>
              <button
                type="button"
                aria-current={inSecondary ? 'page' : undefined}
                className={[
                  'flex w-full items-center gap-3 rounded-md py-2 pl-3 pr-2.5 text-left text-[13px] transition-colors',
                  inSecondary
                    ? 'bg-elevated font-medium text-text-primary'
                    : 'text-text-secondary hover:bg-elevated/60 hover:text-text-primary'
                ].join(' ')}
              >
                <IconWorkflow size={15} />
                <span className="truncate">{inSecondary ? SECONDARY_NAV.find((n) => n.id === active)!.label : 'More'}</span>
                <span
                  className="ml-auto grid h-5 w-5 place-items-center rounded-sm text-text-muted group-hover:text-text-secondary"
                  aria-hidden="true"
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                    <circle cx="8" cy="3.5" r="1.3" />
                    <circle cx="8" cy="8" r="1.3" />
                    <circle cx="8" cy="12.5" r="1.3" />
                  </svg>
                </span>
              </button>
            </Dropdown.Trigger>
            <Dropdown.Portal>
              <Dropdown.Content
                side="right"
                align="start"
                sideOffset={6}
                className="z-50 min-w-[160px] rounded-md bg-surface p-1 text-[13px] shadow-xl"
              >
                {SECONDARY_NAV.map(({ id, label, Icon }) => (
                  <Dropdown.Item
                    key={id}
                    onSelect={() => onSelect(id)}
                    className={[
                      'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 outline-none',
                      id === active ? 'bg-elevated font-medium text-text-primary' : 'text-text-secondary hover:bg-elevated hover:text-text-primary'
                    ].join(' ')}
                  >
                    <Icon size={13} />
                    <span>{label}</span>
                  </Dropdown.Item>
                ))}
              </Dropdown.Content>
            </Dropdown.Portal>
          </Dropdown.Root>
        </li>
      </ul>

      {/* Projects */}
      <div className="mt-4 flex flex-1 flex-col overflow-hidden">
        <div className="mb-1 flex items-center justify-between px-2.5">
          <span className="text-[11.5px] text-text-muted">Projects</span>
          <button
            type="button"
            onClick={onAddProject}
            aria-label="Add project"
            title="Add a project folder"
            className="grid h-5 w-5 place-items-center rounded-sm text-text-muted hover:bg-elevated hover:text-text-primary"
          >
            <IconPlus size={11} />
          </button>
        </div>
        <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto pr-0.5">
          {projects.length === 0 ? (
            <li className="px-2.5 py-2 text-[12px] text-text-muted">
              No projects yet. Click + to add a folder.
            </li>
          ) : (
            projects.map((p) => {
              const isActive = p.id === activeProjectId
              return (
                <li key={p.id}>
                  <ProjectRow
                    project={p}
                    isActive={isActive}
                    onPick={() => onPickProject(p)}
                    onRename={() => onRenameProject(p)}
                    onRemove={() => onRemoveProject(p)}
                  />
                </li>
              )
            })
          )}
        </ul>
      </div>

      {/* Footer toolbar: Settings · Theme · Hide-sidebar (right) */}
      <div className="mt-2 flex items-center gap-1 px-1 pt-1">
        <button
          type="button"
          onClick={() => onSelect('settings')}
          aria-current={active === 'settings' ? 'page' : undefined}
          title="Settings"
          className={[
            'grid h-7 w-7 place-items-center rounded-md',
            active === 'settings'
              ? 'bg-elevated text-text-primary'
              : 'text-text-muted hover:bg-elevated/60 hover:text-text-primary'
          ].join(' ')}
        >
          <IconGear size={14} />
        </button>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Hide sidebar"
            title="Hide sidebar"
            className="ml-auto grid h-7 w-7 place-items-center rounded-md text-text-muted hover:bg-elevated/60 hover:text-text-primary"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
              <line x1="6.5" y1="3.5" x2="6.5" y2="12.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        )}
      </div>
    </nav>
  )
}

function ProjectRow({
  project, isActive, onPick, onRename, onRemove
}: { project: Project; isActive: boolean; onPick: () => void; onRename: () => void; onRemove: () => void }) {
  return (
    <div
      className={[
        'group flex items-center gap-1 rounded-md pr-1 transition-colors',
        isActive ? 'bg-elevated' : 'hover:bg-elevated/60'
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onPick}
        className={[
          'flex flex-1 items-center gap-3 rounded-md px-2.5 py-2 text-left text-[12.5px]',
          isActive ? 'font-medium text-text-primary' : 'text-text-secondary group-hover:text-text-primary'
        ].join(' ')}
        title={project.path}
      >
        <IconFolder size={14} />
        <span className="truncate">{project.name}</span>
      </button>
      <Dropdown.Root>
        <Dropdown.Trigger asChild>
          <button
            type="button"
            aria-label={`Options for ${project.name}`}
            className="grid h-5 w-5 place-items-center rounded-sm text-text-muted opacity-0 group-hover:opacity-100 hover:text-text-primary focus-visible:opacity-100"
          >
            <span aria-hidden="true">⋯</span>
          </button>
        </Dropdown.Trigger>
        <Dropdown.Portal>
          <Dropdown.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-[160px] rounded-md border border-border bg-surface p-1 text-[12px] text-text-primary shadow-sm"
          >
            <Dropdown.Item
              onSelect={onRename}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 outline-none hover:bg-elevated"
            >
              <IconEdit size={12} /> Rename
            </Dropdown.Item>
            <Dropdown.Item
              onSelect={onRemove}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-text-secondary outline-none hover:bg-elevated hover:text-text-primary"
            >
              <IconTrash size={12} /> Remove from list
            </Dropdown.Item>
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>
    </div>
  )
}

function Main({
  active, setActive, activeProject, openedProjects, activeSessionId, onActiveSessionChange, theme, onAddProject, onOpenFolder, onToggleTheme, rightWidth, setRightWidth, activeDesignId, onOpenDesign, onCloseDesign, designWizardSeed, onClearDesignWizardSeed
}: {
  active: NavId
  setActive: (id: NavId) => void
  activeProject: Project | null
  openedProjects: Project[]
  activeSessionId: string | null
  onActiveSessionChange: (id: string | null) => void
  theme: 'dark' | 'light'
  onAddProject: () => void
  onOpenFolder: () => void
  onToggleTheme: () => void
  rightWidth: number
  setRightWidth: (n: number) => void
  activeDesignId: string | null
  onOpenDesign: (d: Design) => void
  onCloseDesign: () => void
  designWizardSeed: { idea: string } | null
  onClearDesignWizardSeed: () => void
}) {
  const showTerminal = active === 'terminal'
  const [openedDesignTitle, setOpenedDesignTitle] = useState<string>('')

  // Whenever the design id changes, refresh the title for the header.
  useEffect(() => {
    let cancelled = false
    if (!activeDesignId) { setOpenedDesignTitle(''); return }
    void window.terminal42.designs.get(activeDesignId).then((d) => {
      if (!cancelled && d) setOpenedDesignTitle(d.title)
    })
    return () => { cancelled = true }
  }, [activeDesignId])

  const overlay =
    active === 'rawterm' ? (
      activeProject ? <RawTerminalView project={activeProject} theme={theme} /> : <EmptyHome onAddProject={onAddProject} onOpenFolder={onOpenFolder} />
    ) :
    active === 'brain' ? <BrainView activeProject={activeProject} activeSessionId={activeSessionId} onJumpToTerminal={() => setActive('terminal')} /> :
    active === 'workbench' ? <WorkbenchView activeSessionId={activeSessionId} onJumpToTerminal={() => setActive('terminal')} activeProjectId={activeProject?.id ?? null} /> :
    active === 'activity' ? <ActivityView onJumpToTerminal={(id) => { void window.terminal42.projects.touch(id).then(() => setActive('terminal')) }} /> :
    active === 'settings' ? <SettingsView theme={theme} onToggleTheme={onToggleTheme} /> :
    active === 'designs' ? (
      activeDesignId ? (
        <ErrorBoundary>
          <DesignWorkspace
            designId={activeDesignId}
            title={openedDesignTitle || 'Untitled design'}
            onRename={async (newTitle) => {
              await window.terminal42.designs.rename(activeDesignId, newTitle)
              setOpenedDesignTitle(newTitle)
            }}
            onClose={onCloseDesign}
          />
        </ErrorBoundary>
      ) : (
        <ErrorBoundary>
          <DesignsListView onOpen={onOpenDesign} seed={designWizardSeed} onSeedConsumed={onClearDesignWizardSeed} />
        </ErrorBoundary>
      )
    ) : null

  return (
    <div className="relative flex flex-1 overflow-hidden">
      {/* Terminal layer: always mounted so PTY scrollback persists across tab switches. */}
      {activeProject ? (
        <div
          className="absolute inset-0 flex"
          style={{ visibility: showTerminal ? 'visible' : 'hidden' }}
          aria-hidden={!showTerminal}
        >
          {openedProjects.map((p) => (
            <div
              key={p.id}
              className="absolute inset-0 flex"
              style={{ visibility: showTerminal && p.id === activeProject.id ? 'visible' : 'hidden' }}
              aria-hidden={!(showTerminal && p.id === activeProject.id)}
            >
              <ProjectWorkspace
                project={p}
                theme={theme}
                isActive={showTerminal && p.id === activeProject.id}
                onActiveSessionChange={p.id === activeProject.id ? onActiveSessionChange : undefined}
                onNavigate={p.id === activeProject.id ? setActive : undefined}
                rightWidth={rightWidth}
                setRightWidth={setRightWidth}
              />
            </div>
          ))}
        </div>
      ) : showTerminal ? (
        <EmptyHome onAddProject={onAddProject} onOpenFolder={onOpenFolder} />
      ) : null}

      {/* Overlay panes: render on top of the (hidden) terminal so it stays mounted. */}
      {overlay && <div className="relative z-10 flex flex-1 overflow-hidden bg-bg"><Suspense fallback={<ViewLoading />}>{overlay}</Suspense></div>}
      {!overlay && !activeProject && !showTerminal && <EmptyHome onAddProject={onAddProject} onOpenFolder={onOpenFolder} />}
    </div>
  )
}

function ViewLoading(): JSX.Element {
  return (
    <div className="grid h-full w-full place-items-center bg-bg text-text-secondary">
      <span className="text-[13px]">Loading…</span>
    </div>
  )
}

function RawTerminalView({ project, theme }: { project: Project; theme: 'dark' | 'light' }) {
  const LS_KEY = `t42:rawterm:tabs:${project.id}`
  type Tab = { id: string; label: string }
  const [tabs, setTabs] = useState<Tab[]>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Tab[]
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    return [{ id: `rawterm:${project.id}:1`, label: 'shell' }]
  })
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0]?.id)

  // Persist tab list per project so reopening the tab keeps your shells.
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(tabs)) } catch {}
  }, [tabs, LS_KEY])

  const addTab = (): void => {
    const next: Tab = { id: `rawterm:${project.id}:${Date.now()}`, label: `shell ${tabs.length + 1}` }
    setTabs((cur) => [...cur, next])
    setActiveTabId(next.id)
  }

  const closeTab = (id: string): void => {
    if (tabs.length === 1) return
    void window.terminal42.pty.kill(id).catch(() => {})
    setTabs((cur) => {
      const next = cur.filter((t) => t.id !== id)
      if (id === activeTabId) setActiveTabId(next[next.length - 1]?.id ?? next[0]?.id)
      return next
    })
  }

  const renameTab = (id: string, label: string): void => {
    setTabs((cur) => cur.map((t) => t.id === id ? { ...t, label: label.trim() || t.label } : t))
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-bg">
      <RawTerminalTabs
        tabs={tabs}
        activeId={activeTabId}
        onPick={setActiveTabId}
        onAdd={addTab}
        onClose={closeTab}
        onRename={renameTab}
      />
      {/* Mount every tab once and toggle visibility so PTY scrollback persists across switches. */}
      <div className="relative flex-1 overflow-hidden">
        {tabs.map((t) => (
          <div
            key={t.id}
            className="absolute inset-0 flex"
            style={{ visibility: t.id === activeTabId ? 'visible' : 'hidden' }}
            aria-hidden={t.id !== activeTabId}
          >
            <TerminalPane
              sessionId={t.id}
              cwd={project.path}
              theme={theme}
              isActive={t.id === activeTabId}
              autoLaunchCopilot={false}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function RawTerminalTabs({
  tabs, activeId, onPick, onAdd, onClose, onRename
}: {
  tabs: { id: string; label: string }[]
  activeId: string
  onPick: (id: string) => void
  onAdd: () => void
  onClose: (id: string) => void
  onRename: (id: string, label: string) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  return (
    <div className="flex h-9 shrink-0 items-stretch bg-bg px-2">
      {tabs.map((t) => {
        const isActive = t.id === activeId
        const isEditing = editingId === t.id
        return (
          <div
            key={t.id}
            className={[
              'group my-1 flex items-center gap-2 rounded-md px-3 text-[12px] transition-colors',
              isActive
                ? 'bg-elevated/70 font-medium text-text-primary'
                : 'text-text-muted hover:text-text-secondary'
            ].join(' ')}
          >
            {isEditing ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => { onRename(t.id, draft); setEditingId(null) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { onRename(t.id, draft); setEditingId(null) }
                  if (e.key === 'Escape') setEditingId(null)
                }}
                className="w-[120px] rounded-sm border border-border bg-bg px-1 py-0.5 text-[12px] text-text-primary focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => onPick(t.id)}
                onDoubleClick={() => { setDraft(t.label); setEditingId(t.id) }}
                className="truncate max-w-[160px] text-left"
                title="Click to switch · Double-click to rename"
              >
                {t.label}
              </button>
            )}
            {tabs.length > 1 && !isEditing && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClose(t.id) }}
                aria-label={`Close ${t.label}`}
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
        aria-label="New terminal"
        onClick={onAdd}
        title="New terminal (Cmd+T)"
        className="ml-1 grid w-8 place-items-center text-text-muted hover:text-text-primary"
      >
        <IconPlus size={14} />
      </button>
    </div>
  )
}

function EmptyHome({ onAddProject, onOpenFolder }: { onAddProject: () => void; onOpenFolder: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
      <div>
        <h1 className="text-[18px] font-semibold text-text-primary">Add your first project</h1>
        <p className="mt-1 max-w-sm text-[13px] text-text-secondary">
          A project is just a folder on your computer. Terminal42 keeps each project's sessions and history together.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onAddProject}
          className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-text hover:opacity-90"
        >
          New project
        </button>
        <button
          type="button"
          onClick={onOpenFolder}
          className="rounded-md bg-surface px-3 py-1.5 text-[13px] font-medium text-text-primary hover:bg-surface/80"
        >
          Open existing folder
        </button>
      </div>
    </main>
  )
}
