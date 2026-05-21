import { ipcMain } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import * as os from 'os'
import { getDb } from './db'

const SESSION_STATE_DIR = join(os.homedir(), '.copilot', 'session-state')

export type ActivityProjectCard = {
  projectId: string | null
  projectName: string
  projectPath: string | null
  sessionCount: number
  lastActivityAt: number
  totalTokens: number
  lastModel: string | null
  lastTaskTitle: string | null
}

export type ActivityTimelineItem = {
  at: number
  copilotSessionId: string
  projectName: string
  role: 'user' | 'assistant'
  snippet: string
  model: string | null
}

export type ActivityBackground = {
  sessions: Array<{
    sessionId: string
    pid: number
    cwd: string
    projectId: string | null
    projectName: string
    copilotSessionId: string | null
    startedAt: number
    lastActivity: string
  }>
  previews: Array<{
    id: string
    name: string
    projectId: string
    projectName: string
    url: string | null
    port: number | null
    startedAt: number
  }>
  schedules: Array<{
    id: string
    recipeId: string
    recipeName: string
    description: string
    nextRunAt: number | null
  }>
}

export type ActivitySummary = {
  metrics: {
    tokensUsedToday: number
    sessionsActiveToday: number
    premiumRequestsToday: number
    activePreviewCount: number
  }
  sparkline: { date: string; tokens: number }[]
  background: ActivityBackground
  projects: ActivityProjectCard[]
  timeline: ActivityTimelineItem[]
}

function startOfTodayMs(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

async function tail(file: string, bytes = 65536): Promise<string> {
  const stat = await fs.stat(file)
  const start = Math.max(0, stat.size - bytes)
  const fd = await fs.open(file, 'r')
  const buf = Buffer.alloc(stat.size - start)
  await fd.read(buf, 0, buf.length, start)
  await fd.close()
  return buf.toString('utf8')
}

type SessionState = {
  copilotId: string
  cwd: string | null
  updatedAt: number
  currentTokens: number
  currentModel: string | null
  todayTokens: number
  todayCumulativeTokens: number  // actual cumulative input+output from turns
  todayPremiumRequests: number
  todayActive: boolean
  recentTimeline: ActivityTimelineItem[]
  lastTaskTitle: string | null
  // Last currentTokens seen per UTC-local day (yyyy-mm-dd): for 7d sparkline
  dailyMaxTokens: Map<string, number>
  dailyCumulativeTokens: Map<string, number>  // cumulative per-turn tokens per day
}

async function readSessionState(copilotId: string): Promise<SessionState | null> {
  const dir = join(SESSION_STATE_DIR, copilotId)
  try {
    const eventsPath = join(dir, 'events.jsonl')
    const stat = await fs.stat(eventsPath).catch(() => null)
    if (!stat) return null
    // Read up to 256KB tail for richer timeline + today counts
    const text = await tail(eventsPath, 262144)
    const lines = text.split('\n').filter(Boolean)
    const todayStart = startOfTodayMs()
    const sevenDayStart = todayStart - 6 * 86_400_000
    let cwd: string | null = null
    let currentTokens = 0
    let currentModel: string | null = null
    let todayTokens = 0
    let todayCumulativeTokens = 0
    let todayPremiumRequests = 0
    let todayActive = false
    let updatedAt = stat.mtimeMs
    const timeline: ActivityTimelineItem[] = []
    let lastTaskTitle: string | null = null
    const dailyMaxTokens = new Map<string, number>()
    const dailyCumulativeTokens = new Map<string, number>()

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]
      // Parse timestamp first (cheap regex, before JSON.parse)
      const tsMatch = line.match(/"timestamp":"([^"]+)"/)
      const ts = tsMatch ? Date.parse(tsMatch[1]) : 0
      if (ts > updatedAt) updatedAt = ts

      if (line.includes('"currentTokens"')) {
        const ct = line.match(/"currentTokens":(\d+)/)
        const cm = line.match(/"currentModel":"([^"]+)"/)
        const pr = line.match(/"totalPremiumRequests":(\d+)/)
        if (ct && currentTokens === 0) currentTokens = Number(ct[1])
        if (cm && !currentModel) currentModel = cm[1]
        if (ts >= sevenDayStart && ct) {
          const dayKey = dateKey(ts)
          const prev = dailyMaxTokens.get(dayKey) ?? 0
          dailyMaxTokens.set(dayKey, Math.max(prev, Number(ct[1])))
        }
        if (ts >= todayStart) {
          if (ct) todayTokens = Math.max(todayTokens, Number(ct[1]))
          if (pr) todayPremiumRequests = Math.max(todayPremiumRequests, Number(pr[1]))
          todayActive = true
        }
      }
      if (!cwd && line.includes('"cwd"')) {
        const c = line.match(/"cwd":"([^"]+)"/)
        if (c) cwd = c[1]
      }
      if (timeline.length < 8 && (line.includes('"assistant.message"') || line.includes('"user.message"'))) {
        try {
          const obj = JSON.parse(line) as { type: string; data: { content?: string }; timestamp: string }
          const role: 'user' | 'assistant' = obj.type === 'user.message' ? 'user' : 'assistant'
          const content = (obj.data?.content ?? '').replace(/\s+/g, ' ').trim()
          if (content) {
            const at = Date.parse(obj.timestamp) || ts
            timeline.push({
              at,
              copilotSessionId: copilotId,
              projectName: '',
              role,
              snippet: content.slice(0, 240),
              model: currentModel
            })
            if (role === 'user' && !lastTaskTitle) lastTaskTitle = content.slice(0, 80)
            if (at >= todayStart) todayActive = true
          }
        } catch {
          /* skip */
        }
      }
      if (currentTokens > 0 && currentModel && cwd && timeline.length >= 8) break
    }

    // Forward scan for cumulative per-turn token usage from assistant.message
    // events. These contain "input_tokens" and "output_tokens" in the usage block.
    // This gives actual consumption rather than context window size.
    for (const line of lines) {
      if (!line.includes('"assistant.message"')) continue
      const tsMatch2 = line.match(/"timestamp":"([^"]+)"/)
      const ts2 = tsMatch2 ? Date.parse(tsMatch2[1]) : 0
      if (ts2 < sevenDayStart) continue
      const itMatch = line.match(/"input_tokens":(\d+)/)
      const otMatch = line.match(/"output_tokens":(\d+)/)
      const turnTokens = (itMatch ? Number(itMatch[1]) : 0) + (otMatch ? Number(otMatch[1]) : 0)
      if (turnTokens <= 0) continue
      if (ts2 >= sevenDayStart) {
        const dayKey2 = dateKey(ts2)
        dailyCumulativeTokens.set(dayKey2, (dailyCumulativeTokens.get(dayKey2) ?? 0) + turnTokens)
      }
      if (ts2 >= todayStart) {
        todayCumulativeTokens += turnTokens
        todayActive = true
      }
    }

    // Fallback cwd from workspace.yaml
    if (!cwd) {
      try {
        const ws = await fs.readFile(join(dir, 'workspace.yaml'), 'utf8')
        const m = ws.match(/^cwd:\s*(.+)$/m)
        if (m) cwd = m[1].replace(/^["']|["']$/g, '').trim()
      } catch { /* skip */ }
    }

    return {
      copilotId,
      cwd,
      updatedAt,
      currentTokens,
      currentModel,
      todayTokens,
      todayCumulativeTokens,
      todayPremiumRequests,
      todayActive,
      recentTimeline: timeline,
      lastTaskTitle,
      dailyMaxTokens,
      dailyCumulativeTokens
    }
  } catch {
    return null
  }
}

function dateKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function buildSummary(
  activePreviewCount: number,
  background: ActivityBackground
): Promise<ActivitySummary> {
  let dirs: string[] = []
  try { dirs = await fs.readdir(SESSION_STATE_DIR) } catch { dirs = [] }

  const states: SessionState[] = []
  for (const d of dirs) {
    const s = await readSessionState(d)
    if (s) states.push(s)
  }

  // Map cwd -> project from app db
  const db = getDb()
  const projects = db.prepare('SELECT id, name, path FROM projects').all() as Array<{ id: string; name: string; path: string }>
  const byPath = new Map(projects.map((p) => [p.path, p]))

  // Group session states by project
  type Bucket = { p: { id: string | null; name: string; path: string | null }; states: SessionState[] }
  const buckets = new Map<string, Bucket>()
  for (const s of states) {
    let key: string
    let meta: Bucket['p']
    const matched = s.cwd ? byPath.get(s.cwd) : null
    if (matched) {
      key = `p:${matched.id}`
      meta = { id: matched.id, name: matched.name, path: matched.path }
    } else if (s.cwd) {
      key = `c:${s.cwd}`
      const name = s.cwd.split('/').filter(Boolean).pop() ?? s.cwd
      meta = { id: null, name, path: s.cwd }
    } else {
      key = 'unknown'
      meta = { id: null, name: 'Unlinked sessions', path: null }
    }
    let b = buckets.get(key)
    if (!b) { b = { p: meta, states: [] }; buckets.set(key, b) }
    b.states.push(s)
  }

  const projectCards: ActivityProjectCard[] = Array.from(buckets.values()).map((b) => {
    const sorted = [...b.states].sort((a, b2) => b2.updatedAt - a.updatedAt)
    // Sum cumulative tokens across all sessions in this project; fall back to
    // peak context tokens if no per-turn usage data is available.
    const cumulative = b.states.reduce((sum, s) => sum + s.todayCumulativeTokens, 0)
    const peak = sorted[0]?.currentTokens ?? 0
    return {
      projectId: b.p.id,
      projectName: b.p.name,
      projectPath: b.p.path,
      sessionCount: b.states.length,
      lastActivityAt: sorted[0]?.updatedAt ?? 0,
      totalTokens: cumulative > 0 ? cumulative : peak,
      lastModel: sorted[0]?.currentModel ?? null,
      lastTaskTitle: sorted.find((s) => s.lastTaskTitle)?.lastTaskTitle ?? null
    }
  }).sort((a, b) => b.lastActivityAt - a.lastActivityAt)

  // Aggregate metrics — prefer cumulative per-turn data when available.
  let tokensUsedToday = 0
  let sessionsActiveToday = 0
  let premiumRequestsToday = 0
  for (const s of states) {
    if (s.todayActive) sessionsActiveToday++
    // Use real cumulative tokens when available, else fall back to peak context
    tokensUsedToday += s.todayCumulativeTokens > 0 ? s.todayCumulativeTokens : s.todayTokens
    premiumRequestsToday += s.todayPremiumRequests
  }

  // 7-day token sparkline: prefer cumulative per-turn tokens per day;
  // fall back to peak context window size if no usage data.
  const today = startOfTodayMs()
  const sparkline: { date: string; tokens: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const dayMs = today - i * 86_400_000
    const key = dateKey(dayMs)
    let cumTotal = 0
    let peakTotal = 0
    for (const s of states) {
      cumTotal += s.dailyCumulativeTokens.get(key) ?? 0
      peakTotal += s.dailyMaxTokens.get(key) ?? 0
    }
    sparkline.push({ date: key, tokens: cumTotal > 0 ? cumTotal : peakTotal })
  }

  // Build cross-session timeline (last 30, by recency)
  const allTimeline: ActivityTimelineItem[] = []
  for (const s of states) {
    const matched = s.cwd ? byPath.get(s.cwd) : null
    const projectName = matched?.name ?? (s.cwd ? s.cwd.split('/').pop() ?? '' : 'Unlinked')
    for (const t of s.recentTimeline) {
      allTimeline.push({ ...t, projectName })
    }
  }
  allTimeline.sort((a, b) => b.at - a.at)
  const timeline = allTimeline.slice(0, 30)

  return {
    metrics: {
      tokensUsedToday,
      sessionsActiveToday,
      premiumRequestsToday,
      activePreviewCount
    },
    sparkline,
    background,
    projects: projectCards,
    timeline
  }
}

export function registerActivityIpc(deps: {
  getRunningPreviewCount: () => number
  getRunningPreviews: () => Array<{
    id: string; commandId: string; projectId: string; name: string
    port: number | null; url: string | null; cwd: string; startedAt: number
  }>
  getLiveSessions: () => Array<{
    id: string; pid: number; cwd: string; command: string
    startedAt: number; copilotSessionId: string | null; lastActivity: string
  }>
}): void {
  ipcMain.handle('activity:summary', async () => {
    const db = getDb()
    const projects = db.prepare('SELECT id, name, path FROM projects').all() as Array<{ id: string; name: string; path: string }>
    const byPath = new Map(projects.map((p) => [p.path, p]))
    const byId = new Map(projects.map((p) => [p.id, p]))

    const sessions = deps.getLiveSessions().map((s) => {
      const matched = byPath.get(s.cwd)
      return {
        sessionId: s.id,
        pid: s.pid,
        cwd: s.cwd,
        projectId: matched?.id ?? null,
        projectName: matched?.name ?? (s.cwd.split('/').pop() || s.cwd),
        copilotSessionId: s.copilotSessionId,
        startedAt: s.startedAt,
        lastActivity: s.lastActivity
      }
    })

    const previews = deps.getRunningPreviews().map((p) => {
      const proj = byId.get(p.projectId)
      return {
        id: p.id,
        name: p.name,
        projectId: p.projectId,
        projectName: proj?.name ?? p.projectId,
        url: p.url,
        port: p.port,
        startedAt: p.startedAt
      }
    })

    type ScheduleRow = {
      id: string; recipe_id: string; kind: string
      hour: number | null; minute: number | null; interval_minutes: number | null
      enabled: number; next_run_at: number | null
    }
    const scheduleRows = db
      .prepare('SELECT id, recipe_id, kind, hour, minute, interval_minutes, enabled, next_run_at FROM recipe_schedules WHERE enabled = 1')
      .all() as ScheduleRow[]
    const schedules = scheduleRows.map((s) => {
      const desc = describeSchedule(s)
      const recipeName = s.recipe_id.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      return {
        id: s.id,
        recipeId: s.recipe_id,
        recipeName,
        description: desc,
        nextRunAt: s.next_run_at
      }
    })

    return buildSummary(deps.getRunningPreviewCount(), { sessions, previews, schedules })
  })
}

function describeSchedule(s: {
  kind: string; hour: number | null; minute: number | null; interval_minutes: number | null
}): string {
  const time = `${String(s.hour ?? 0).padStart(2, '0')}:${String(s.minute ?? 0).padStart(2, '0')}`
  switch (s.kind) {
    case 'daily': return `Daily at ${time}`
    case 'weekdays': return `Weekdays at ${time}`
    case 'interval': return `Every ${s.interval_minutes ?? 0}m`
    default: return s.kind
  }
}
