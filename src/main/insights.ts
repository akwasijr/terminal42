import { ipcMain, app, BrowserWindow, Notification } from 'electron'
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import { join } from 'path'
import { getDb } from './db'
import { getSettings } from './settings'
import { stripAnsi } from './ansi'
import { readMemory, writeMemory } from './memory'
import { resolveModel } from './models'

export type InsightsCadence = 'off' | 'daily' | '3d' | 'weekly'

type InsightsState = {
  cadence: InsightsCadence
  lastRunAt: number
  lastStatus: 'idle' | 'running' | 'ok' | 'error'
  lastSummary: string
  lastError: string
}

const DEFAULT_STATE: InsightsState = {
  cadence: '3d',
  lastRunAt: 0,
  lastStatus: 'idle',
  lastSummary: '',
  lastError: ''
}

function statePath(): string {
  return join(app.getPath('userData'), 'insights.json')
}

async function readState(): Promise<InsightsState> {
  try {
    const raw = await fs.readFile(statePath(), 'utf8')
    return { ...DEFAULT_STATE, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

async function writeState(s: InsightsState): Promise<void> {
  await fs.writeFile(statePath(), JSON.stringify(s, null, 2), 'utf8')
}

function cadenceMs(c: InsightsCadence): number {
  switch (c) {
    case 'daily': return 24 * 60 * 60 * 1000
    case '3d': return 3 * 24 * 60 * 60 * 1000
    case 'weekly': return 7 * 24 * 60 * 60 * 1000
    default: return 0
  }
}

export async function gatherEvidence(): Promise<string> {
  const parts: string[] = []
  // Recent session activity (last 14 days, cap)
  try {
    const rows = getDb()
      .prepare(
        `SELECT body FROM session_log
         WHERE created_at > ?
         ORDER BY id DESC LIMIT 80`
      )
      .all(Date.now() - 14 * 24 * 60 * 60 * 1000) as { body: string }[]
    if (rows.length > 0) {
      const joined = rows.map((r) => r.body).join('\n')
      // strip control chars, cap to ~12kb
      const clean = stripAnsi(joined).replace(/[^\x09\x0A\x20-\x7E]/g, '').slice(0, 12000)
      if (clean.trim()) parts.push('## Recent terminal activity (excerpts)\n' + clean)
    }
  } catch {}

  // Skills inventory
  try {
    const skillsRoot = join(app.getPath('userData'), 'skills')
    const lines: string[] = []
    for (const kind of ['prompts', 'personas', 'clips', 'recipes']) {
      try {
        const files = await fs.readdir(join(skillsRoot, kind))
        for (const f of files) {
          if (!f.endsWith('.md')) continue
          lines.push(`- [${kind}] ${f.replace(/\.md$/, '')}`)
        }
      } catch {}
    }
    if (lines.length > 0) parts.push('## My Skills inventory\n' + lines.join('\n'))
  } catch {}

  // Current Brain (so the agent doesn't repeat itself)
  try {
    const cur = await readMemory()
    parts.push('## Current Brain (memory.md)\n' + cur.slice(0, 6000))
  } catch {}

  return parts.join('\n\n')
}

const AUTO_HEADING = '## Insights (auto)'

async function applyInsightBullets(bullets: string[]): Promise<void> {
  if (bullets.length === 0) return
  const cur = await readMemory()
  const stamp = new Date().toISOString().slice(0, 10)
  const block =
    `### ${stamp}\n` +
    bullets.map((b) => `- ${b.replace(/^[-*]\s*/, '').trim()}`).join('\n') +
    '\n'
  let next: string
  const idx = cur.indexOf(AUTO_HEADING)
  if (idx === -1) {
    next = cur.trimEnd() + `\n\n${AUTO_HEADING}\n_Generated automatically: feel free to edit, move, or delete._\n\n${block}`
  } else {
    const headingEnd = cur.indexOf('\n', idx) + 1
    // Insert after first explanatory line if present
    let insertAt = headingEnd
    const after = cur.slice(headingEnd)
    if (after.startsWith('_')) {
      const nlAfter = cur.indexOf('\n', headingEnd) + 1
      const blank = cur.indexOf('\n', nlAfter) + 1
      insertAt = blank > 0 ? blank : nlAfter
    }
    next = cur.slice(0, insertAt) + '\n' + block + cur.slice(insertAt)
  }
  await writeMemory(next)
}

function parseBulletsFromOutput(out: string): string[] {
  const clean = stripAnsi(out)
  const lines = clean.split('\n')
  const bullets: string[] = []
  for (const lineRaw of lines) {
    const line = lineRaw.trim()
    if (/^[-*]\s+/.test(line)) {
      const text = line.replace(/^[-*]\s+/, '').trim()
      if (text.length >= 6 && text.length <= 240) bullets.push(text)
    }
  }
  // Dedup, keep first 8
  const seen = new Set<string>()
  const out2: string[] = []
  for (const b of bullets) {
    const k = b.toLowerCase().slice(0, 80)
    if (seen.has(k)) continue
    seen.add(k)
    out2.push(b)
    if (out2.length >= 8) break
  }
  return out2
}

let running = false

const afterRunHooks: Array<() => Promise<void> | void> = []
export function onInsightsRunComplete(hook: () => Promise<void> | void): void {
  afterRunHooks.push(hook)
}

async function runOnce(getWindow: () => BrowserWindow | null, opts: { manual?: boolean } = {}): Promise<{ ok: boolean; summary?: string; error?: string }> {
  if (running) return { ok: false, error: 'already running' }
  running = true
  const state = await readState()
  state.lastStatus = 'running'
  state.lastError = ''
  await writeState(state)
  notifyState(getWindow, state)

  try {
    const evidence = await gatherEvidence()
    const settings = getSettings()
    const model = settings.defaultModel
    const prompt = `You are reviewing the user's recent terminal activity, their saved Skills, and their personal knowledge file (Brain).

Identify 3-6 NEW, concrete insights about how they work, what they care about, recurring tasks, or general preferences that would be useful to add to their Brain.

Rules:
- Output ONLY a markdown bulleted list (lines starting with "- "). No preamble, no explanation, no code fences.
- Each bullet 1 short sentence, factual, in the user's voice ("I prefer…", "I'm working on…").
- Skip anything already present in the current Brain.
- Skip secrets, file paths, command-specific details.
- DO NOT generalize project-specific tooling into a global preference. If the user is working on an Electron app, that does NOT mean they prefer Electron for all apps. Mention specific projects by name ("I'm working on X, an Electron app") instead of declaring a stack preference.
- DO NOT invent stack preferences they haven't actually expressed. Only capture preferences they've stated in their own words or repeatedly demonstrated across DIFFERENT projects.
- If you can't find anything new, output a single bullet: "- (nothing new)".

EVIDENCE:
${evidence}`

    const args = ['-p', prompt, '--allow-all-tools', '--no-color']
    const resolved = resolveModel(model)
    if (resolved) args.push('--model', resolved)
    const child = spawn('copilot', args, {
      cwd: app.getPath('home'),
      env: { ...process.env, NO_COLOR: '1', TERM: 'dumb' },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let out = ''
    let err = ''
    child.stdout.on('data', (d) => { out += d.toString() })
    child.stderr.on('data', (d) => { err += d.toString() })

    const exitCode: number = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        try { child.kill('SIGTERM') } catch {}
        resolve(124)
      }, 4 * 60 * 1000)
      child.on('exit', (code) => {
        clearTimeout(timer)
        resolve(code ?? 0)
      })
      child.on('error', () => {
        clearTimeout(timer)
        resolve(1)
      })
    })

    if (exitCode !== 0) {
      throw new Error(`copilot exited ${exitCode}: ${err.trim().slice(0, 300) || out.trim().slice(0, 300)}`)
    }

    const bullets = parseBulletsFromOutput(out)
    const meaningful = bullets.filter((b) => !/^\(?nothing new\)?$/i.test(b))
    if (meaningful.length > 0) {
      await applyInsightBullets(meaningful)
    }

    state.lastRunAt = Date.now()
    state.lastStatus = 'ok'
    state.lastSummary = meaningful.length > 0
      ? `Added ${meaningful.length} insight${meaningful.length === 1 ? '' : 's'}`
      : 'No new insights'
    state.lastError = ''
    await writeState(state)
    notifyState(getWindow, state)

    // Fire post-run hooks (best-effort, e.g. skill proposals)
    for (const hook of afterRunHooks) {
      try { await hook() } catch {}
    }

    if (opts.manual !== false && Notification.isSupported() && getSettings().notificationsEnabled) {
      new Notification({ title: 'Brain insights updated', body: state.lastSummary, silent: true }).show()
    }

    return { ok: true, summary: state.lastSummary }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    state.lastStatus = 'error'
    state.lastError = msg
    state.lastRunAt = Date.now()
    await writeState(state)
    notifyState(getWindow, state)
    return { ok: false, error: msg }
  } finally {
    running = false
  }
}

function notifyState(getWindow: () => BrowserWindow | null, state: InsightsState): void {
  const w = getWindow()
  if (w && !w.isDestroyed()) {
    try { w.webContents.send('insights:state', state) } catch {}
  }
}

let scheduleTimer: NodeJS.Timeout | null = null

async function scheduleNext(getWindow: () => BrowserWindow | null): Promise<void> {
  if (scheduleTimer) { clearTimeout(scheduleTimer); scheduleTimer = null }
  const state = await readState()
  if (state.cadence === 'off') return
  const interval = cadenceMs(state.cadence)
  if (!interval) return
  const since = Date.now() - state.lastRunAt
  // first run delay: wait at least 5min after app start so we don't tax startup
  const remaining = state.lastRunAt === 0 ? 5 * 60 * 1000 : Math.max(60 * 1000, interval - since)
  scheduleTimer = setTimeout(async () => {
    await runOnce(getWindow, { manual: false })
    void scheduleNext(getWindow)
  }, remaining)
}

export function stopInsightsScheduler(): void {
  if (scheduleTimer) { clearTimeout(scheduleTimer); scheduleTimer = null }
}

export function registerInsightsIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('insights:state', () => readState())
  ipcMain.handle('insights:set-cadence', async (_e, cadence: InsightsCadence) => {
    const s = await readState()
    s.cadence = cadence
    await writeState(s)
    void scheduleNext(getWindow)
    return s
  })
  ipcMain.handle('insights:run-now', async () => {
    return runOnce(getWindow, { manual: true })
  })
  void scheduleNext(getWindow)
}
