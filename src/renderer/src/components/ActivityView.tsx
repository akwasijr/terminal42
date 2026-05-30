import { useEffect, useMemo, useState } from 'react'
import type { ActivitySummary, CopilotSessionInfo, Design, Task } from '../../../preload/index'
import { IconRefresh, IconArrowUp, IconStop, IconSparkle } from './icons'
import { classifyStatus, lastAssistantLine, tailLines, type AgentStatus } from '../lib/agentStatus'

type ContentTab = 'sessions' | 'designs' | 'tasks' | 'usage'

const CONTENT_TABS: { id: ContentTab; label: string }[] = [
  { id: 'sessions', label: 'Sessions' },
  { id: 'designs',  label: 'Designs'  },
  { id: 'tasks',    label: 'Tasks'    },
  { id: 'usage',    label: 'Usage'    },
]

const LS_CONTENT_TAB = 't42.activity.contentTab'

export function ActivityView({
  onJumpToTerminal
}: {
  onJumpToTerminal?: (projectId: string) => void
}) {
  const [data, setData] = useState<ActivitySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [contentTab, setContentTab] = useState<ContentTab>(() => {
    try {
      const stored = localStorage.getItem(LS_CONTENT_TAB) as ContentTab | null
      if (stored && CONTENT_TABS.some((t) => t.id === stored)) return stored
    } catch { /* ignore */ }
    return 'sessions'
  })
  useEffect(() => {
    try { localStorage.setItem(LS_CONTENT_TAB, contentTab) } catch { /* ignore */ }
  }, [contentTab])

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const refresh = async (): Promise<void> => {
    setLoading(true)
    try {
      setData(await window.terminal42.activity.summary())
      setLastUpdated(new Date())
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void refresh()
    const t = setInterval(refresh, 15000)
    return () => clearInterval(t)
  }, [])

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-bg">
      {/* Header */}
      <header className="shrink-0 bg-bg">
        <div className="flex h-[56px] items-center justify-between gap-4 px-6">
          <div className="flex items-baseline gap-3">
            <h1 className="text-[16px] font-semibold leading-tight text-text-primary">Activity</h1>
            <SummaryLine data={data} />
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-[11px] text-text-muted">Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            )}
            <button
              type="button"
              onClick={() => void refresh()}
              aria-label="Refresh"
              title="Refresh"
              className="grid h-7 w-7 place-items-center rounded-sm text-text-secondary hover:text-text-primary"
            >
              <IconRefresh size={13} />
            </button>
          </div>
        </div>

        {/* Top-level content tabs — pill style matching Design home */}
        <div className="px-6 pb-3">
          <div className="inline-flex items-center gap-1 rounded-lg bg-elevated p-1">
            {CONTENT_TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={contentTab === t.id}
                type="button"
                onClick={() => setContentTab(t.id)}
                className={[
                  'rounded-md px-3 py-1.5 text-[13px] font-medium outline-none transition-colors',
                  contentTab === t.id
                    ? 'bg-bg text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex max-w-[900px] flex-col gap-6">
            {contentTab === 'sessions' && (
              <SessionsPanel data={data} loading={loading} onJump={onJumpToTerminal} onRefresh={refresh} />
            )}
            {contentTab === 'designs' && (
              <DesignsPanel />
            )}
            {contentTab === 'tasks' && (
              <TasksSection />
            )}
            {contentTab === 'usage' && (
              <>
                <TokenUsageSection data={data} />
                <SchedulesBlock data={data} loading={loading} />
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

function SummaryLine({ data }: { data: ActivitySummary | null }) {
  if (!data) return null
  const { metrics } = data
  const parts = [
    `${formatTokens(metrics.tokensUsedToday)} tokens today`,
    `${metrics.sessionsActiveToday} active`,
    metrics.premiumRequestsToday > 0 ? `${metrics.premiumRequestsToday} premium` : null,
    metrics.activePreviewCount > 0 ? `${metrics.activePreviewCount} preview${metrics.activePreviewCount === 1 ? '' : 's'}` : null
  ].filter(Boolean)
  return <span className="text-[12px] text-text-muted">{parts.join(' · ')}</span>
}

// ─── Sessions row (shared by Inbox + per-project rollup) ──────────────────

type SessionMeta = {
  status: AgentStatus
  lastLine: string
}

// React hook: tail every session's scrollback every 5s and classify the
// status (waiting / working / idle) + capture the last assistant line.
// Cheap because pty.scrollback is an in-memory ring buffer.
function useSessionMeta(sessions: ActivitySummary['background']['sessions']): Record<string, SessionMeta> {
  const [meta, setMeta] = useState<Record<string, SessionMeta>>({})
  useEffect(() => {
    if (!sessions.length) { setMeta({}); return }
    let cancelled = false
    const load = async (): Promise<void> => {
      const next: Record<string, SessionMeta> = {}
      await Promise.all(sessions.map(async (s) => {
        try {
          const sb = await window.terminal42.pty.scrollback(s.sessionId)
          next[s.sessionId] = { status: classifyStatus(sb), lastLine: lastAssistantLine(sb) }
        } catch {
          next[s.sessionId] = { status: 'idle', lastLine: '' }
        }
      }))
      if (!cancelled) setMeta(next)
    }
    void load()
    const t = setInterval(load, 5000)
    return () => { cancelled = true; clearInterval(t) }
  }, [sessions.map((s) => s.sessionId).join('|')])
  return meta
}

// ─── Tasks Section ────────────────────────────────────────────────────────
// Full task list across all Copilot sessions. Grouped by session name so
// the user can see what each agent is working on.

function TasksSection() {
  const [sessions, setSessions] = useState<CopilotSessionInfo[]>([])
  const [tasksBySession, setTasksBySession] = useState<Record<string, Task[]>>({})
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    void window.terminal42.tasks.listSessions().then(setSessions)
    return window.terminal42.tasks.onSessionsChanged(setSessions)
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      const map: Record<string, Task[]> = {}
      await Promise.all(sessions.map(async (s) => {
        try { map[s.id] = await window.terminal42.tasks.read(s.id) } catch { map[s.id] = [] }
      }))
      if (!cancelled) setTasksBySession(map)
    }
    void load()
    return () => { cancelled = true }
  }, [sessions])

  const totalActive = Object.values(tasksBySession).flat().filter((t) => {
    const s = t.status ?? (t.done ? 'done' : 'pending')
    return s === 'in_progress' || s === 'pending'
  }).length
  const totalDone = Object.values(tasksBySession).flat().filter((t) => (t.status ?? (t.done ? 'done' : 'pending')) === 'done').length

  if (sessions.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[13px] font-medium text-text-primary">Tasks</h2>
        <span className="text-[11px] text-text-muted">
          {totalActive > 0 ? `${totalActive} active` : ''}{totalActive > 0 && totalDone > 0 ? ' · ' : ''}{totalDone > 0 ? `${totalDone} done` : ''}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {sessions.map((s) => {
          const tasks = tasksBySession[s.id] ?? []
          if (tasks.length === 0) return null
          const isOpen = expanded === s.id
          const active = tasks.filter((t) => (t.status ?? (t.done ? 'done' : 'pending')) === 'in_progress').length
          const done = tasks.filter((t) => (t.status ?? (t.done ? 'done' : 'pending')) === 'done').length
          return (
            <div key={s.id} className="rounded-md bg-elevated/30">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : s.id)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-elevated/50"
              >
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-text-primary">{s.name}</span>
                <span className="shrink-0 text-[10.5px] text-text-muted">
                  {active > 0 && `${active} active`}{active > 0 && done > 0 && ' · '}{done > 0 && `${done} done`}{active === 0 && done === 0 && `${tasks.length} tasks`}
                </span>
                <span className="text-[10px] text-text-muted">{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && (
                <ul className="flex flex-col gap-0.5 px-3 pb-2">
                  {tasks.map((t, i) => {
                    const status = (t.status ?? (t.done ? 'done' : 'pending')) as string
                    return (
                      <li key={t.id ?? i} className="flex items-start gap-2 py-1 text-[12px]">
                        <span className={[
                          'mt-1 inline-block h-2 w-2 shrink-0 rounded-full',
                          status === 'done' ? 'bg-success' : status === 'in_progress' ? 'animate-pulse bg-accent' : status === 'blocked' ? 'bg-error' : 'border border-border'
                        ].join(' ')} />
                        <span className={status === 'done' ? 'text-text-muted line-through' : 'text-text-primary'}>{t.text}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// (RecentDesignsSection removed — replaced by DesignsPanel above)

// ─── Sessions Panel (top-level tab) ───────────────────────────────────────
// Combines live agent rows (with time sub-filter) and a flat session-history
// list showing only project-level summaries — no individual messages.

function SessionsPanel({
  data, loading, onJump, onRefresh
}: {
  data: ActivitySummary | null
  loading: boolean
  onJump?: (projectId: string) => void
  onRefresh: () => Promise<void>
}) {
  const [tab, setTab] = useState<AgentWindow>(() => {
    try {
      const stored = localStorage.getItem(LS_AGENT_WINDOW) as AgentWindow | null
      if (stored && WINDOW_TABS.some((t) => t.id === stored)) return stored
    } catch { /* ignore */ }
    return 'live'
  })
  useEffect(() => {
    try { localStorage.setItem(LS_AGENT_WINDOW, tab) } catch { /* ignore */ }
  }, [tab])

  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  const sessions = data?.background.sessions ?? []
  const meta = useSessionMeta(sessions)
  const projects = data?.projects ?? []

  const windowMs = tab === '1h' ? 60 * 60_000 : tab === 'today' ? 24 * 60 * 60_000 : tab === '7d' ? 7 * 24 * 60 * 60_000 : 0

  const stopSession = async (sessionId: string): Promise<void> => {
    await window.terminal42.activity.stopSession(sessionId)
    if (expandedKey === `s:${sessionId}`) setExpandedKey(null)
    void onRefresh()
  }

  const rows: AgentRow[] = useMemo(() => {
    const now = Date.now()
    const out: AgentRow[] = []
    for (const s of sessions) {
      const m = meta[s.sessionId]
      const status: AgentStatus = m?.status ?? 'idle'
      const within = tab === 'live' ? true : (now - s.startedAt) < windowMs
      if (!within) continue
      out.push({
        key: `s:${s.sessionId}`,
        marker: status,
        project: cleanProjectName(s.projectName, s.cwd),
        doing: m?.lastLine || (status === 'waiting' ? 'Waiting on input' : status === 'working' ? 'Working' : shortPath(s.cwd)),
        at: s.startedAt,
        sessionId: s.sessionId,
        cwd: s.cwd,
        open: s.projectId ? () => onJump?.(s.projectId as string) : undefined,
        stop: () => void stopSession(s.sessionId)
      })
    }
    const rank = (m: AgentRow['marker']): number =>
      m === 'waiting' ? 0 : m === 'working' ? 1 : m === 'design-done' ? 2 : 3
    return out.sort((a, b) => {
      const r = rank(a.marker) - rank(b.marker)
      if (r !== 0) return r
      return b.at - a.at
    })
  }, [sessions, meta, tab, windowMs])

  if (loading && !data) return null

  const counts = (() => {
    let waiting = 0, working = 0, idle = 0
    for (const r of rows) {
      if (r.marker === 'waiting') waiting++
      else if (r.marker === 'working') working++
      else idle++
    }
    const parts = [
      waiting > 0 ? `${waiting} waiting` : null,
      working > 0 ? `${working} working` : null,
      idle > 0 ? `${idle} idle` : null,
    ].filter(Boolean)
    return parts.join(' · ') || (tab === 'live' ? 'No agents running' : 'Nothing in this window')
  })()

  return (
    <>
      {/* Date sub-filter — chip style matching Design home filters */}
      <div className="sticky -top-4 z-10 -mx-6 flex items-center justify-between gap-3 bg-bg px-6 py-3">
        <div role="tablist" aria-label="Time window" className="flex flex-wrap items-center gap-1">
          {WINDOW_TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={[
                'inline-flex items-center rounded-md px-2.5 py-1 text-[11.5px] outline-none transition-colors',
                tab === t.id
                  ? 'bg-accent/15 text-accent'
                  : 'bg-elevated/60 text-text-secondary hover:bg-elevated hover:text-text-primary'
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-text-muted">{counts}</span>
      </div>

      {/* Live / recent agent rows */}
      {rows.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-[11.5px] font-medium text-text-muted">Active</h3>
          <ul className="flex flex-col gap-0.5">
            {rows.map((r) => {
              const isOpen = expandedKey === r.key
              return (
                <li key={r.key} className={isOpen ? 'rounded-md bg-elevated/30' : ''}>
                  <AgentRowView row={r} isOpen={isOpen} onToggle={() => setExpandedKey(isOpen ? null : r.key)} />
                  {isOpen && r.sessionId && (
                    <ExpandedSession sessionId={r.sessionId} cwd={r.cwd ?? ''} startedAt={r.at} onJump={r.open} />
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ) : (
        <Empty>{tab === 'live' ? 'No agents running.' : 'Nothing in this window.'}</Empty>
      )}

      {/* Project-level session history (flat, no individual messages) */}
      {projects.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-[11.5px] font-medium text-text-muted">History</h3>
          <div className="flex flex-col gap-0.5">
            {projects.map((p) => (
              <div
                key={p.projectId ?? p.projectName}
                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-elevated/30"
              >
                <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-text-muted/30" />
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-text-primary">{p.projectName}</span>
                <span className="shrink-0 text-[10.5px] tabular-nums text-text-muted">
                  {p.sessionCount} session{p.sessionCount !== 1 ? 's' : ''}
                </span>
                <span className="shrink-0 text-[10.5px] tabular-nums text-text-muted">{formatTokens(p.totalTokens)} tokens</span>
                {p.lastModel && (
                  <span className="shrink-0 rounded bg-elevated px-1.5 py-0.5 text-[10px] text-text-muted">{shortModel(p.lastModel)}</span>
                )}
                {p.projectId && onJump && (
                  <button
                    type="button"
                    onClick={() => onJump(p.projectId!)}
                    className="shrink-0 rounded px-1.5 py-0.5 text-[10.5px] text-text-secondary hover:bg-elevated hover:text-text-primary"
                  >
                    Open
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

// ─── Designs Panel (top-level tab) ────────────────────────────────────────

function DesignsPanel() {
  const [designs, setDesigns] = useState<Design[]>([])
  useEffect(() => {
    let cancelled = false
    void window.terminal42.designs.list().then((all) => {
      if (cancelled) return
      setDesigns(all.sort((a, b) => b.lastActiveAt - a.lastActiveAt))
    })
    return () => { cancelled = true }
  }, [])

  if (designs.length === 0) {
    return <Empty>No designs yet.</Empty>
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {designs.map((d) => (
        <li key={d.id}>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('t42:open-design', { detail: { designId: d.id } }))}
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-elevated/40"
          >
            <IconSparkle size={12} className="shrink-0 text-accent" />
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-text-primary">{d.title}</span>
            {d.currentVersion && <span className="shrink-0 text-[10.5px] text-text-muted">{d.currentVersion}</span>}
            <span className="shrink-0 text-[10.5px] tabular-nums text-text-muted">{relativeTime(d.lastActiveAt)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

// ─── Token Usage ──────────────────────────────────────────────────────────

function TokenUsageSection({ data }: { data: ActivitySummary | null }) {
  const sparkline = data?.sparkline ?? []
  if (sparkline.length === 0) return null

  const total = sparkline.reduce((s, d) => s + d.tokens, 0)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[13px] font-medium text-text-primary">Token usage (7 days)</h2>
        <span className="text-[11px] text-text-muted">{formatTokens(total)} total</span>
      </div>
      <div className="overflow-hidden rounded-md bg-elevated/30">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-[10.5px] text-text-muted">
              <th className="px-3 py-1.5 font-medium">Day</th>
              <th className="px-3 py-1.5 font-medium text-right">Tokens</th>
              <th className="px-3 py-1.5 font-medium">Bar</th>
            </tr>
          </thead>
          <tbody>
            {sparkline.map((d) => {
              const max = Math.max(1, ...sparkline.map((x) => x.tokens))
              const pct = Math.round((d.tokens / max) * 100)
              return (
                <tr key={d.date} className="border-t border-border/30">
                  <td className="px-3 py-1.5 text-text-primary">{shortDay(d.date)} {d.date.slice(5)}</td>
                  <td className="px-3 py-1.5 tabular-nums text-right text-text-secondary">{formatTokens(d.tokens)}</td>
                  <td className="px-3 py-1.5">
                    <div className="h-1.5 rounded-full bg-bg" style={{ width: '100%' }}>
                      <div className="h-1.5 rounded-full bg-accent/60" style={{ width: `${pct}%` }} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ─── Previews + Schedules (kept, simplified) ──────────────────────────────

function SchedulesBlock({ data, loading }: { data: ActivitySummary | null; loading: boolean }) {
  const schedules = data?.background.schedules ?? []
  if (loading && !data) return null
  if (schedules.length === 0) return null
  // Sort by soonest next-run so the most-imminent loop sits at the top.
  const sorted = [...schedules].sort((a, b) => (a.nextRunAt ?? Infinity) - (b.nextRunAt ?? Infinity))
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[13px] font-medium text-text-primary">Scheduled</h2>
        <span className="text-[11px] text-text-muted">{schedules.length} job{schedules.length === 1 ? '' : 's'}</span>
      </div>
      <ul className="flex flex-col gap-px">
        {sorted.map((s) => (
          <li key={s.id}>
            <div className="flex items-baseline gap-3 rounded-md px-2 py-1.5">
              <span className="w-3 shrink-0 text-center text-[12px] leading-none text-text-muted" aria-hidden="true">·</span>
              <span className="w-[200px] shrink-0 truncate text-[12.5px] font-medium text-text-primary">{s.recipeName}</span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-text-secondary">{s.description}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-text-muted">
                {s.nextRunAt ? `next run ${relativeTime(s.nextRunAt)}` : 'paused'}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}


// Removed: MetricsStrip, MetricsRow, Metric, TabButton, ProjectsBlock,
// TimelineBlock, SkeletonRows. The Activity tab is now focused on live
// agent state (sessions / previews / schedules); historical browsing lives
// in the Chat tab's session list per project.

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-6 text-center text-[12px] text-text-muted">
      {children}
    </div>
  )
}

function formatTokens(n: number): string {
  if (n <= 0) return '0'
  if (n < 1000) return String(n)
  return `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k`
}

function shortPath(p: string): string {
  if (!p) return ''
  const home = '/Users/'
  let s = p.startsWith(home) ? '~/' + p.split('/').slice(3).join('/') : p
  // Collapse Terminal42's internal design workdirs into a short label so
  // the row doesn't show a 60-char Application Support path + UUID.
  s = s.replace(/^~\/Library\/Application Support\/terminal42\/designs\/[a-f0-9-]+/i, 'Design workspace')
  return s
}

function shortModel(m: string): string {
  return m.replace(/^claude-/, '').replace(/^gpt-/, 'GPT-')
}

function cleanProjectName(name: string, cwd: string): string {
  // Suppress raw UUIDs (the Terminal42 design workdirs are named that way).
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(name)) {
    if (cwd && /\/terminal42\/designs\//i.test(cwd)) return 'Design'
    return name.slice(0, 8) + '…'
  }
  return name
}

function relativeTime(at: number): string {
  if (!at) return ':'
  const diff = Date.now() - at
  const future = diff < 0
  const abs = Math.abs(diff)
  const s = Math.round(abs / 1000)
  if (s < 60) return future ? 'in <1m' : 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return future ? `in ${m}m` : `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return future ? `in ${h}h` : `${h}h ago`
  const d = Math.round(h / 24)
  return future ? `in ${d}d` : `${d}d ago`
}

function shortDay(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)
}

// ─── New agent launcher ─────────────────────────────────────────────────
// Spawns a fresh PTY in a chosen project's cwd and auto-runs Copilot with
// the given task. The session shows up in the Sessions list immediately.

// ─── Agents (tabbed by time window) ───────────────────────────────────────
//
// One simple list of "what's happening with my agents", filtered by a
// time window picked from a tab strip. Each row is a single line so the
// view stays high-level: status marker · project · what it's doing · time.

type AgentWindow = 'live' | '1h' | 'today' | '7d'

const WINDOW_TABS: { id: AgentWindow; label: string }[] = [
  { id: 'live',  label: 'Live'  },
  { id: '1h',    label: '1h'    },
  { id: 'today', label: 'Today' },
  { id: '7d',    label: '7d'    }
]

const LS_AGENT_WINDOW = 't42.activity.agents.window'

// (useRecentDesigns removed — DesignsPanel loads designs directly)

type AgentRow = {
  key: string
  marker: AgentStatus | 'design-done'
  project: string
  doing: string
  at: number
  // Backing data — used by the inline expansion to fetch tail / reply.
  sessionId?: string
  designId?: string
  cwd?: string
  // Actions
  open?: () => void
  reply?: () => void
  stop?: () => void
}

// (AgentsTabbed removed — replaced by SessionsPanel above)

function AgentRowView({ row, isOpen, onToggle }: { row: AgentRow; isOpen: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className={[
        'group flex w-full items-baseline gap-3 rounded-md px-2 py-1.5 text-left transition-colors',
        isOpen ? '' : 'hover:bg-elevated/40'
      ].join(' ')}
    >
      <AgentMarker kind={row.marker} />
      <span className="w-[180px] shrink-0 truncate text-[12.5px] font-medium text-text-primary">{row.project}</span>
      <span className="min-w-0 flex-1 truncate text-[12px] text-text-secondary">{row.doing}</span>
      <span className="shrink-0 text-[10.5px] tabular-nums text-text-muted">{relativeTime(row.at)}</span>
      {row.open && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); row.open?.() }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); row.open?.() } }}
          className="shrink-0 rounded px-1.5 py-0.5 text-[10.5px] text-text-secondary opacity-0 transition group-hover:opacity-100 hover:bg-elevated hover:text-text-primary"
        >
          Open
        </span>
      )}
      {row.stop && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); row.stop?.() }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); row.stop?.() } }}
          title="Stop"
          aria-label="Stop"
          className="grid h-5 w-5 shrink-0 place-items-center rounded text-text-muted opacity-0 transition group-hover:opacity-100 hover:bg-elevated hover:text-error"
        >
          <IconStop size={9} />
        </span>
      )}
    </button>
  )
}

function AgentMarker({ kind }: { kind: AgentRow['marker'] }) {
  if (kind === 'waiting')  return <span className="w-3 shrink-0 text-center text-[12px] leading-none text-warning" aria-hidden="true">*</span>
  if (kind === 'working')  return <span className="w-3 shrink-0 text-center text-[12px] leading-none text-accent animate-pulse" aria-hidden="true">*</span>
  if (kind === 'design-done') return <span className="w-3 shrink-0 text-center text-[11px] leading-none text-success" aria-hidden="true">✓</span>
  return <span className="w-3 shrink-0 text-center text-[12px] leading-none text-text-muted" aria-hidden="true">·</span>
}

// Inline detail panel for a PTY session — last ~32 lines of output and a
// quick reply box when the session is waiting on input.
function ExpandedSession({
  sessionId, cwd, startedAt, onJump
}: {
  sessionId: string
  cwd: string
  startedAt: number
  onJump?: () => void
}) {
  const [tail, setTail] = useState('')
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let cancelled = false
    const pull = async (): Promise<void> => {
      try {
        const sb = await window.terminal42.pty.scrollback(sessionId)
        if (!cancelled) setTail(tailLines(sb, 24))
      } catch { /* ignore */ }
    }
    void pull()
    const off = window.terminal42.pty.onData(sessionId, () => { void pull() })
    const t = setInterval(pull, 4000)
    return () => { cancelled = true; off(); clearInterval(t) }
  }, [sessionId])

  const send = async (): Promise<void> => {
    const text = reply.trim()
    if (!text || sending) return
    setSending(true)
    try {
      await window.terminal42.pty.write(sessionId, text + '\r')
      setReply('')
    } finally {
      setSending(false)
    }
  }

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() }
  }

  return (
    <div className="flex flex-col gap-2 px-2 pb-2">
      <pre className="max-h-[220px] select-text overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-bg/60 px-3 py-2 font-mono text-[11.5px] leading-relaxed text-text-secondary">
        {tail || 'No output yet.'}
      </pre>
      <div className="rounded-lg bg-elevated/50 px-3 pt-2 pb-2 transition-colors focus-within:bg-elevated">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={onKey}
          rows={2}
          placeholder="Reply to this session…"
          className="block w-full resize-none bg-transparent text-[12.5px] leading-relaxed text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-text-muted">
          <span className="truncate">{shortPath(cwd)} · started {relativeTime(startedAt)}</span>
          <div className="flex items-center gap-1.5">
            {onJump && (
              <button
                type="button"
                onClick={onJump}
                className="rounded px-1.5 py-0.5 text-text-secondary hover:bg-elevated hover:text-text-primary"
              >
                Open in Chat
              </button>
            )}
            <button
              type="button"
              onClick={() => void send()}
              disabled={!reply.trim() || sending}
              aria-label="Send reply"
              title="Send (↵)"
              className="grid h-7 w-7 place-items-center rounded-full bg-accent text-accent-text transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconArrowUp size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

