import { useCallback, useEffect, useMemo, useState } from 'react'
import { activityLabel } from '../lib/activityLabel'
import { gitErrorMessage } from '../lib/gitErrorMessage'
import { useCopilotSessionId } from '../lib/useCopilotSessionId'
import type { Task, ContextUsage } from '../../../preload/index'
import { IconExternal } from './icons'
import { InfoRail } from './InfoRail'
import { contextDisplay } from '../../../shared/contextUsage'
import { useHarness } from '../lib/useHarness'

/** "just now" / "4m ago" — only used in a tooltip, so it stays coarse. */
function formatAge(ms: number): string {
  if (!Number.isFinite(ms)) return 'at an unknown time'
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  return `${mins}m ago`
}

function shortPath(p: string | null | undefined): string {
  if (!p) return ':'
  const m = p.match(/^\/Users\/[^/]+/)
  return m ? '~' + p.slice(m[0].length) : p
}

function shortModel(m: string | null | undefined): string {
  if (!m) return ':'
  return m
    .replace(/^claude-/, '')
    .replace(/^gpt-/, 'GPT-')
    .replace(/-internal$/, '')
}

type RightTab = 'status' | 'actions' | 'activity' | 'harness'
const LS_RIGHT_TAB = 't42:rightpanel:tab'

export function RightPanel({
  sessionId,
  projectId,
  cwd,
  model,
  onNavigate,
  width = 320
}: {
  sessionId: string | null
  projectId: string | null
  cwd: string | null
  model?: string | null
  onNavigate?: (target: 'brain' | 'workbench' | 'activity') => void
  width?: number
}) {
  const [viewedSessionId, setViewedSessionId] = useState<string | null>(sessionId)
  useEffect(() => { setViewedSessionId(sessionId) }, [sessionId])

  const [tab, setTab] = useState<RightTab>(() => {
    try {
      const v = localStorage.getItem(LS_RIGHT_TAB)
      if (v === 'status' || v === 'actions' || v === 'activity' || v === 'harness') return v
    } catch {}
    return 'status'
  })
  useEffect(() => { try { localStorage.setItem(LS_RIGHT_TAB, tab) } catch {} }, [tab])

  return (
    <aside
      className="flex shrink-0 flex-col overflow-hidden rounded-panel bg-surface"
      style={{ width }}
    >
      <RightTabs tab={tab} onChange={setTab} />
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {tab === 'status' && (
          <StatusBlock
            sessionId={sessionId}
            projectId={projectId}
            cwd={cwd}
            model={model ?? null}
            onNavigate={onNavigate}
          />
        )}
        {tab === 'actions' && (
          <div className="flex flex-col gap-4">
            <QuickActions sessionId={sessionId} cwd={cwd} />
            <TasksBlock
              sessionId={sessionId}
              projectId={projectId}
              onViewSession={setViewedSessionId}
              onNavigate={onNavigate}
            />
          </div>
        )}
        {tab === 'activity' && (
          <ActivityBlock sessionId={viewedSessionId} isOtherSession={viewedSessionId !== sessionId} />
        )}
        {tab === 'harness' && <SessionInsightsBlock sessionId={sessionId} />}
      </div>
    </aside>
  )
}

function RightTabs({ tab, onChange }: { tab: RightTab; onChange: (t: RightTab) => void }) {
  const tabs: { id: RightTab; label: string }[] = [
    { id: 'status', label: 'Status' },
    { id: 'actions', label: 'Actions' },
    { id: 'activity', label: 'Activity' },
    { id: 'harness', label: 'Harness' }
  ]
  return (
    <div className="shrink-0 px-3 pt-3 pb-2">
      <div className="t42-seg w-full">
        {tabs.map((t) => {
          const isActive = t.id === tab
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              aria-pressed={isActive}
              data-active={isActive}
              className="flex-1 text-[11.5px]"
            >
              {t.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- Status ---------- */

function StatusBlock({
  sessionId, projectId, cwd, model, onNavigate
}: {
  sessionId: string | null
  projectId: string | null
  cwd: string | null
  model: string | null
  onNavigate?: (target: 'brain' | 'workbench' | 'activity') => void
}) {
  const [brainCount, setBrainCount] = useState<number>(0)
  const [persona, setPersona] = useState<string>('Default')
  const copilotId = useCopilotSessionId(sessionId)
  const [usage, setUsage] = useState<ContextUsage | null>(null)

  useEffect(() => {
    let alive = true
    void window.terminal42.brain
      .merged(projectId, sessionId)
      .then((m) => alive && setBrainCount(m.ruleCount))
      .catch(() => {})
    return () => { alive = false }
  }, [projectId, sessionId])

  useEffect(() => {
    if (!projectId) { setPersona('Default'); return }
    void window.terminal42.skills.applicable(projectId)
      .then((items) => {
        const personas = items.filter((s) => s.format === 'persona')
        setPersona(personas.length > 0 ? personas[0].name : 'Default')
      })
      .catch(() => setPersona('Default'))
  }, [projectId, sessionId])

  useEffect(() => {
    if (!copilotId) { setUsage(null); return }
    void window.terminal42.copilot.contextUsage(copilotId).then(setUsage).catch(() => {})
    const off = window.terminal42.copilot.onContextUsage(copilotId, setUsage)
    const t = setInterval(() => {
      void window.terminal42.copilot.contextUsage(copilotId).then(setUsage).catch(() => {})
    }, 8000)
    return () => { off(); clearInterval(t) }
  }, [copilotId])

  return (
    <div className="flex flex-col">
      <Row label="Model">
        <span className="truncate text-text-primary" title={model ?? ''}>
          {shortModel(model)}
        </span>
      </Row>
      <Row label="Persona">
        <RowAction onClick={() => onNavigate?.('workbench')} title="Open the Skills library">
          {persona}
        </RowAction>
      </Row>
      <Row label="Brain">
        <RowAction onClick={() => onNavigate?.('brain')} title="Open the Brain editor">
          {brainCount} {brainCount === 1 ? 'rule' : 'rules'}
        </RowAction>
      </Row>
      <Row label="Folder">
        <RowAction
          onClick={() => cwd && void window.terminal42.system.revealFolder(cwd)}
          disabled={!cwd}
          title={cwd ? `Show ${cwd} in Finder` : 'No folder for this session'}
        >
          {shortPath(cwd)}
        </RowAction>
      </Row>
      <ContextRow usage={usage} hasSession={!!copilotId} />
    </div>
  )
}

function ContextRow({ usage, hasSession }: { usage: ContextUsage | null; hasSession: boolean }) {
  // Shown only when the shared rule says the reading is trustworthy, so this
  // and the Harness tab hide at exactly the same moment.
  const d = contextDisplay(usage, { hasSession })
  if (!d) return null
  const tone = d.tone === 'critical' ? 'bg-error' : d.tone === 'warning' ? 'bg-warning' : 'bg-text-muted'
  return (
    <div className="flex flex-col gap-1.5 px-1 pt-3 pb-1 text-[12px]">
      <div className="flex items-center justify-between">
        <span className="text-text-muted">Context</span>
        <span
          className="text-text-primary tabular-nums"
          title={`${d.usedTokens.toLocaleString()} of ${d.limitTokens.toLocaleString()} tokens, as last reported by the CLI ${formatAge(d.ageMs)}`}
        >
          {d.percent}% · {d.usedOfLimit}
        </span>
      </div>
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-elevated" aria-label={`${d.percent}% of context window used`}>
        <div className={['h-full rounded-full transition-all', tone].join(' ')} style={{ width: `${Math.max(2, d.percent)}%` }} />
      </div>
    </div>
  )
}


/**
 * A value in the status list that does something when clicked.
 *
 * These rows read as plain text, so people assumed they were inert labels and
 * never tried them. The dotted underline is the standing hint that the value is
 * a control; hover and focus promote it to a solid one.
 */
function RowAction({
  onClick, title, disabled, children
}: {
  onClick: () => void
  title: string
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        'max-w-full truncate rounded-sm text-text-primary underline decoration-dotted decoration-text-muted underline-offset-[3px]',
        'transition-colors hover:decoration-text-primary hover:decoration-solid',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'active:opacity-80 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50'
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-1 py-2 text-[12px]">
      <span className="text-text-muted">{label}</span>
      <span className="min-w-0 flex-1 text-right">{children}</span>
    </div>
  )
}

/* ---------- Quick actions ---------- */

type GitStatus = {
  isRepo: boolean
  branch: string | null
  hasRemote: boolean
  remoteUrl: string | null
  hasUpstream: boolean
  ahead: number
  behind: number
  dirty: boolean
  lastPushAt: number | null
  error?: string
}

function relativeTime(ts: number | null | undefined): string {
  if (!ts) return 'never'
  const diff = Date.now() - ts
  if (diff < 0) return 'just now'
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

function gitWebUrl(remote: string | null): string | null {
  if (!remote) return null
  const trimmed = remote.trim().replace(/\.git$/i, '')
  let m = trimmed.match(/^git@([^:]+):(.+)$/)
  if (m) return `https://${m[1]}/${m[2]}`
  m = trimmed.match(/^ssh:\/\/git@([^/]+)\/(.+)$/)
  if (m) return `https://${m[1]}/${m[2]}`
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return null
}

function QuickActions({ sessionId, cwd }: { sessionId: string | null; cwd: string | null }) {
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [busy, setBusy] = useState<null | 'init' | 'push' | 'pull' | 'remote' | 'commit'>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null)
  const [showRemoteForm, setShowRemoteForm] = useState(false)
  const [remoteUrl, setRemoteUrl] = useState('')
  const [, setNow] = useState(Date.now())

  const refresh = useCallback(async () => {
    if (!cwd) { setStatus(null); return }
    try { setStatus(await window.terminal42.git.status(cwd)) } catch {}
  }, [cwd])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  const flash = (kind: 'ok' | 'err' | 'info', text: string, ms = 6000) => {
    setMsg({ kind, text })
    setTimeout(() => setMsg(null), ms)
  }

  const initRepo = async () => {
    if (!cwd) return
    setBusy('init')
    try {
      const res = await window.terminal42.git.init(cwd)
      if (res.ok) flash('ok', `Version control is on. You are on branch ${res.branch ?? 'main'}.`)
      else flash('err', gitErrorMessage('init', `${res.stderr}\n${res.stdout}`), 10000)
    } finally { setBusy(null); void refresh() }
  }

  const addRemote = async () => {
    if (!cwd) return
    if (!remoteUrl.trim()) { flash('err', 'Paste a remote URL first.'); return }
    setBusy('remote')
    try {
      const res = await window.terminal42.git.addRemote(cwd, remoteUrl.trim())
      if (res.ok) {
        flash('ok', 'Remote added.')
        setShowRemoteForm(false)
        setRemoteUrl('')
      } else flash('err', gitErrorMessage('remote', `${res.stderr}\n${res.stdout}`), 10000)
    } finally { setBusy(null); void refresh() }
  }

  const commitAll = async () => {
    if (!cwd) return
    setBusy('commit')
    try {
      const res = await window.terminal42.git.commitAll(cwd, 'Update from Terminal42')
      if (res.ok) flash('ok', 'Saved all your changes.')
      else flash('err', gitErrorMessage('commit', `${res.stderr}\n${res.stdout}`), 10000)
    } finally { setBusy(null); void refresh() }
  }

  const push = async () => {
    if (!cwd || !status) return
    setBusy('push')
    try {
      const opts = !status.hasUpstream ? { setUpstream: true, branch: status.branch } : undefined
      const res = await window.terminal42.git.push(cwd, opts)
      if (res.ok) {
        flash('ok', `Sent your changes to GitHub${status.branch ? ` on ${status.branch}` : ''}.`)
        void window.terminal42.notify.show('Sent to GitHub', 'Your changes are now on GitHub.')
      } else {
        const detail = gitErrorMessage('push', `${res.stderr}\n${res.stdout}`)
        flash('err', detail, 12000)
        void window.terminal42.notify.show('Could not send to GitHub', detail)
      }
    } finally { setBusy(null); void refresh() }
  }

  const pull = async () => {
    if (!cwd) return
    setBusy('pull')
    try {
      const res = await window.terminal42.git.pull(cwd)
      if (res.ok) {
        flash('ok', 'Got the latest from GitHub.')
      } else {
        flash('err', gitErrorMessage('pull', `${res.stderr}\n${res.stdout}`), 12000)
      }
    } finally { setBusy(null); void refresh() }
  }

  const renderBody = (): JSX.Element => {
    if (!cwd) return <Empty>Open a project.</Empty>
    if (!status) return <Empty>Checking…</Empty>

    if (!status.isRepo) {
      return (
        <button
          type="button"
          onClick={() => void initRepo()}
          disabled={busy !== null}
          className="rounded-md bg-bg px-2 py-1.5 text-[12px] hover:bg-elevated disabled:opacity-50"
        >
          {busy === 'init' ? 'Setting up…' : 'Set up version control'}
        </button>
      )
    }

    if (!status.hasRemote) {
      // Hand the job to the agent.
      //
      // This used to write the git commands into a PTY belonging to this
      // session and tell the user to check their terminal. Chat sessions have
      // no PTY: `pty.write` answered `{ok: false}` and the message was a lie —
      // verified live against three real sessions. Sending it as a turn is
      // what the app is for, and the user can watch it happen.
      const connectViaChat = async () => {
        if (!sessionId) {
          flash('err', 'Open a session first.')
          return
        }
        setBusy('remote')
        try {
          const folderName = (cwd?.split('/').filter(Boolean).pop() ?? 'my-project')
            .replace(/['"\\$`!#&|;()\s]/g, '_')
          const res = await window.terminal42.chat.send(
            sessionId,
            `Publish this folder to GitHub as a new private repository named "${folderName}". Initialise git if needed, commit everything, create the repo with gh and push. Tell me the repository URL when it is done.`
          )
          if (!res?.ok) throw new Error(res?.error ?? 'The session would not accept it.')
          flash('ok', 'Asked the agent. Watch the chat.')
        } catch (err) {
          flash('err', `Couldn't send: ${String(err)}`)
        } finally {
          setBusy(null)
          setTimeout(() => void refresh(), 10000)
        }
      }

      return showRemoteForm ? (
        <div className="flex flex-col gap-1.5">
          <input
            type="text"
            placeholder="git@github.com:you/repo.git"
            value={remoteUrl}
            onChange={(e) => setRemoteUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void addRemote() }}
            className="rounded-md bg-bg px-2 py-1.5 font-mono text-[11px] outline-none focus:border-accent"
            autoFocus
          />
          <div className="flex gap-1.5">
            <button
              onClick={() => void addRemote()}
              disabled={busy !== null}
              className="flex-1 rounded-md bg-action px-2 py-1 text-[11px] text-action-text hover:opacity-90 disabled:opacity-50"
            >
              {busy === 'remote' ? 'Connecting…' : 'Connect'}
            </button>
            <button
              onClick={() => { setShowRemoteForm(false); setRemoteUrl('') }}
              className="rounded-md px-2 py-1 text-[11px] hover:bg-elevated"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => void connectViaChat()}
            disabled={busy !== null}
            className="rounded-md bg-bg px-2 py-1.5 text-[12px] hover:bg-elevated disabled:opacity-50"
          >
            {busy === 'remote' ? 'Setting up…' : 'Connect this project to GitHub'}
          </button>
          <button
            type="button"
            onClick={() => setShowRemoteForm(true)}
            className="text-[10.5px] text-text-muted hover:text-text-primary"
          >
            Or paste a remote URL manually
          </button>
        </div>
      )
    }

    const isPullMode = status.hasUpstream && status.behind > 0 && status.ahead === 0
    const primaryLabel = !status.hasUpstream
      ? `Publish ${status.branch} to GitHub`
      : status.ahead > 0 && status.behind > 0
      ? `Sync ${status.ahead} up / ${status.behind} down with GitHub`
      : status.ahead > 0
      ? `Push ${status.ahead} change${status.ahead === 1 ? '' : 's'} to GitHub`
      : status.behind > 0
      ? `Pull ${status.behind} change${status.behind === 1 ? '' : 's'} from GitHub`
      : 'Everything is up to date'

    const disabled = busy !== null || (status.hasUpstream && status.ahead === 0 && status.behind === 0 && !status.dirty)
    const onPrimary = isPullMode ? () => void pull() : () => void push()
    const busyIcon = busy === 'push' || busy === 'pull' ? '…' : isPullMode ? '↓' : '↑'

    return (
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={onPrimary}
          disabled={disabled}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-bg px-2 py-1.5 text-[12px] hover:bg-elevated disabled:opacity-50"
          title={`origin: ${status.remoteUrl ?? '?'}`}
        >
          {busyIcon} {primaryLabel}
        </button>

        {status.dirty && (
          <button
            type="button"
            onClick={() => void commitAll()}
            disabled={busy !== null}
            className="rounded-md border border-dashed px-2 py-1 text-[11px] text-text-secondary hover:bg-elevated disabled:opacity-50"
          >
            {busy === 'commit' ? 'Saving your changes…' : 'Save all changes (commit)'}
          </button>
        )}

        {(() => {
          const web = gitWebUrl(status.remoteUrl)
          if (!web) return null
          const isGithub = /github\.com/.test(web)
          return (
            <button
              type="button"
              onClick={() => void window.terminal42.shell?.openExternal?.(web)}
              className="flex items-center justify-center gap-1.5 rounded-md bg-bg px-2 py-1 text-[11px] text-text-secondary hover:bg-elevated hover:text-text-primary"
              title={web}
            >
              <IconExternal size={11} />
              Open on {isGithub ? 'GitHub' : 'remote'}
            </button>
          )
        })()}

        <div className="flex items-center justify-between text-[10.5px] text-text-muted">
          <span title={status.remoteUrl ?? ''}>{status.branch ?? '?'}</span>
          <span>{relativeTime(status.lastPushAt)}</span>
        </div>
      </div>
    )
  }

  return (
    <Section
      title="Quick actions"
      action={
        cwd ? (
          <button
            onClick={() => void refresh()}
            className="text-[10.5px] text-text-muted hover:text-text-primary"
            title="Refresh git status"
          >
            Refresh
          </button>
        ) : null
      }
    >
      {renderBody()}
      {msg && (
        <div
          className={[
            'mt-2 text-[11px] leading-snug',
            msg.kind === 'err' ? 'text-error' : msg.kind === 'ok' ? 'text-success' : 'text-text-muted'
          ].join(' ')}
        >
          {msg.text}
        </div>
      )}
    </Section>
  )
}




/* ---------- What Copilot is doing ---------- */

// What the agent has actually been doing.
//
// This used to read `pty.activityHistory`, which only ever has content for a
// terminal session. Chat sessions have no PTY, so for every session in this
// workspace the tab said "Idle" forever — verified live against three real
// linked sessions, all returning zero entries.
//
// The activity does exist, just somewhere else: every tool the agent runs is
// emitted as `chat:tool` and persisted on the message that made the call. So
// the list is seeded from history and then kept live from the same event the
// transcript uses.
type ActivityEntry = { id: string; label: string; at: number; status: 'running' | 'done' | 'error' }

function ActivityBlock({ sessionId, isOtherSession }: { sessionId: string | null; isOtherSession?: boolean }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  // Only the setter is used: relative timestamps are computed at render, so the
  // tick exists to schedule a re-render, not to carry a value.
  const [, setNow] = useState(Date.now())

  useEffect(() => {
    if (!sessionId) { setEntries([]); return }
    let cancelled = false

    // Seed from what the session already did, so opening the tab mid-way
    // through a session is not an empty panel.
    void window.terminal42.chat.history(sessionId).then((msgs) => {
      if (cancelled) return
      const seeded: ActivityEntry[] = []
      for (const m of msgs) {
        for (const t of m.toolCalls ?? []) {
          seeded.push({ id: t.id, label: activityLabel(t), at: m.createdAt, status: t.status })
        }
      }
      setEntries(seeded)
    }).catch(() => {})

    // Then follow along. A tool is emitted twice, once running and once
    // finished, so entries are keyed by id and updated in place rather than
    // appended — otherwise every command would appear as two rows.
    const off = window.terminal42.chat.onTool(({ sessionId: sid, tool }) => {
      if (sid !== sessionId) return
      setEntries((prev) => {
        const i = prev.findIndex((e) => e.id === tool.id)
        const next: ActivityEntry = { id: tool.id, label: activityLabel(tool), at: Date.now(), status: tool.status }
        if (i === -1) return [...prev, next]
        const copy = prev.slice()
        copy[i] = { ...next, at: prev[i].at }
        return copy
      })
    })
    return () => { cancelled = true; off() }
  }, [sessionId])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(t)
  }, [])

  // Six edits to the same file is one thing happening, not six. Collapsing
  // runs of the same label keeps the panel readable without hiding work: the
  // count says how many times, and the row still carries the latest state.
  const recent = useMemo(() => {
    const collapsed: (ActivityEntry & { count: number })[] = []
    for (const e of entries) {
      const last = collapsed[collapsed.length - 1]
      if (last && last.label === e.label) {
        last.count += 1
        last.at = e.at
        last.status = e.status
        continue
      }
      collapsed.push({ ...e, count: 1 })
    }
    return collapsed.slice(-12)
  }, [entries])

  if (!sessionId) {
    return <p className="px-1 py-1 text-[12px] text-text-muted">No session selected.</p>
  }

  if (recent.length === 0) {
    return <p className="px-1 py-1 text-[12px] text-text-muted">Nothing yet. Commands and file edits appear here as the agent works.</p>
  }

  return (
    <div className="flex flex-col">
      {isOtherSession && (
        <div className="mb-2 px-1 text-[10.5px] text-text-muted">Showing activity from another session.</div>
      )}
      <ul className="flex flex-col">
        {recent.map((h) => {
          const running = h.status === 'running'
          return (
            <li key={h.id} className="flex items-baseline gap-2 px-1 py-2 text-[12px]">
              <span
                className={[
                  'mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full',
                  running ? 'bg-text-primary animate-pulse' : h.status === 'error' ? 'bg-danger' : 'bg-text-muted'
                ].join(' ')}
                aria-hidden="true"
              />
              <span
                className={['min-w-0 flex-1 truncate', running ? 'text-text-primary' : 'text-text-secondary'].join(' ')}
                title={h.label}
              >
                {h.label}
              </span>
              {h.count > 1 && (
                <span className="shrink-0 text-[10.5px] tabular-nums text-text-muted">×{h.count}</span>
              )}
              <span className="shrink-0 text-[10.5px] tabular-nums text-text-muted">{relativeTime(h.at)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
/* ---------- Tasks (compact snippet for current session only) ---------- */

function TasksBlock({ sessionId, projectId, onViewSession, onNavigate }: {
  sessionId: string | null
  projectId: string | null
  onViewSession?: (ptySessionId: string | null) => void
  onNavigate?: (target: 'brain' | 'workbench' | 'activity') => void
}) {
  void onViewSession; void projectId
  const [tasks, setTasks] = useState<Task[]>([])
  const copilotId = useCopilotSessionId(sessionId)

  useEffect(() => {
    if (!copilotId) { setTasks([]); return }
    void window.terminal42.tasks.read(copilotId).then(setTasks)
    return window.terminal42.tasks.onUpdateFor(copilotId, setTasks)
  }, [copilotId])

  const active = tasks.filter((t) => {
    const s = t.status ?? (t.done ? 'done' : 'pending')
    return s === 'in_progress' || s === 'pending'
  })
  const doneCount = tasks.filter((t) => (t.status ?? (t.done ? 'done' : 'pending')) === 'done').length

  if (!copilotId || tasks.length === 0) return null

  return (
    <Section
      title="Tasks"
      action={
        <button
          type="button"
          onClick={() => onNavigate?.('activity')}
          className="text-[10.5px] text-text-muted hover:text-text-primary"
        >
          View all
        </button>
      }
    >
      <div className="mb-1 flex gap-3 text-[10.5px] text-text-muted">
        {active.length > 0 && <span>{active.length} active</span>}
        {doneCount > 0 && <span>{doneCount} done</span>}
      </div>
      <ul className="flex flex-col gap-0.5">
        {active.slice(0, 5).map((t, i) => {
          const status = (t.status ?? 'pending') as 'pending' | 'in_progress'
          const id = t.id ?? `${t.source}-${i}`
          return (
            <li key={id} className="flex items-center gap-2 rounded-md bg-bg px-2 py-1.5 text-[12px]">
              <span className={[
                'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
                status === 'in_progress' ? 'animate-pulse bg-accent' : ''
              ].join(' ')} />
              <span className="min-w-0 flex-1 truncate text-text-primary">{t.text}</span>
            </li>
          )
        })}
        {active.length > 5 && (
          <li className="px-2 text-[10.5px] text-text-muted">+{active.length - 5} more</li>
        )}
      </ul>
    </Section>
  )
}

/* ---------- Shared ---------- */

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[12px] font-medium text-text-secondary">{title}</span>
        {action}
      </div>
      {children}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-dashed px-3 py-3 text-center text-[12px] text-text-muted">{children}</div>
}


/**
 * Live view of the agent harness for the active session.
 *
 * Polled rather than pushed: the underlying numbers come from three
 * independent subsystems (the CLI's todo database, auto-continue's in-memory
 * state, and the last message's memory recall), and none of them share a
 * change event. A short interval is simpler than inventing one.
 */
function SessionInsightsBlock({ sessionId }: { sessionId: string | null }): JSX.Element {
  const { insights, usage } = useHarness(sessionId)

  if (!sessionId) {
    return <p className="px-1 py-2 text-[12px] text-text-muted">Open a session to see its harness.</p>
  }

  return (
    <InfoRail
      insights={insights}
      contextUsage={usage}
    />
  )
}
