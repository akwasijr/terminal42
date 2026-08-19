import { ipcMain, app, BrowserWindow, Notification } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { spawn } from 'child_process'
import * as os from 'os'
import { getDb, type InboxEntryRow, type RecipeScheduleRow } from './db'
import { stripAnsi } from './ansi'
import { resolveModel } from './models'
import { copilotEnvSync } from './copilotAuth'

export type RecipeStep = { prompt: string }
export type Recipe = {
  id: string
  name: string
  steps: RecipeStep[]
  model?: string
  cwd?: string
}

function recipesDir(): string {
  return join(app.getPath('userData'), 'skills', 'recipes')
}

async function listRecipes(): Promise<Recipe[]> {
  await fs.mkdir(recipesDir(), { recursive: true })
  const entries = await fs.readdir(recipesDir())
  const out: Recipe[] = []
  for (const e of entries) {
    if (!e.endsWith('.md')) continue
    const body = await fs.readFile(join(recipesDir(), e), 'utf8')
    out.push(parseRecipeMd(e.replace(/\.md$/, ''), body))
  }
  return out
}

// Markdown contract:
//   first line: # <name>
//   optional: > model: <id>
//   optional: > cwd: <path>
//   each step: ## Step N  followed by lines until next ##
function parseRecipeMd(id: string, body: string): Recipe {
  const lines = body.split(/\r?\n/)
  let name = id
  let model: string | undefined
  let cwd: string | undefined
  const steps: RecipeStep[] = []
  let buf: string[] | null = null
  for (const line of lines) {
    if (line.startsWith('# ') && !name.includes(line.slice(2))) {
      if (name === id) name = line.slice(2).trim() || id
      continue
    }
    if (line.startsWith('> model:')) {
      model = line.slice('> model:'.length).trim()
      continue
    }
    if (line.startsWith('> cwd:')) {
      cwd = line.slice('> cwd:'.length).trim()
      continue
    }
    if (/^##\s/.test(line)) {
      if (buf) steps.push({ prompt: buf.join('\n').trim() })
      buf = []
      continue
    }
    if (buf) buf.push(line)
  }
  if (buf) steps.push({ prompt: buf.join('\n').trim() })
  return { id, name, steps: steps.filter((s) => s.prompt), model, cwd }
}

const STEP_TIMEOUT_MS = 1000 * 60 * 5

function computeNextRun(
  kind: 'daily' | 'weekdays' | 'interval',
  hour: number | null,
  minute: number | null,
  intervalMinutes: number | null,
  fromMs: number
): number {
  if (kind === 'interval') {
    const m = Math.max(1, intervalMinutes ?? 60)
    return fromMs + m * 60_000
  }
  const h = Math.min(23, Math.max(0, hour ?? 9))
  const min = Math.min(59, Math.max(0, minute ?? 0))
  const d = new Date(fromMs)
  d.setSeconds(0, 0)
  d.setHours(h, min, 0, 0)
  if (d.getTime() <= fromMs) d.setDate(d.getDate() + 1)
  if (kind === 'weekdays') {
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  }
  return d.getTime()
}

function runStep(
  prompt: string,
  cwd: string,
  model: string | undefined
): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const args = ['-p', prompt, '--allow-all-tools']
    const resolved = resolveModel(model)
    if (resolved) args.push('--model', resolved)
    const child = spawn('copilot', args, {
      cwd,
      env: { ...copilotEnvSync(), COPILOT_ALLOW_ALL: '1' } as Record<string, string>
    })
    let out = ''
    let err = ''
    let done = false
    const timer = setTimeout(() => {
      if (done) return
      done = true
      try { child.kill('SIGTERM') } catch {}
      resolve({ ok: false, output: out + (err ? `\n[stderr]\n${err}` : '') + '\n[timed out]' })
    }, STEP_TIMEOUT_MS)
    child.stdout.on('data', (d) => { out += d.toString() })
    child.stderr.on('data', (d) => { err += d.toString() })
    child.on('error', (e) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve({ ok: false, output: `[spawn error] ${e.message}` })
    })
    child.on('exit', (code) => {
      if (done) return
      done = true
      clearTimeout(timer)
      const combined = out + (err ? `\n[stderr]\n${err}` : '')
      resolve({ ok: code === 0, output: combined })
    })
  })
}

async function runRecipeOnce(recipe: Recipe): Promise<{ ok: boolean; transcript: string }> {
  const cwd = recipe.cwd || os.homedir()
  let transcript = ''
  let allOk = true
  for (let i = 0; i < recipe.steps.length; i++) {
    const step = recipe.steps[i]
    transcript += `\n: Step ${i + 1} :\n${step.prompt}\n\n`
    const r = await runStep(step.prompt, cwd, recipe.model)
    transcript += stripAnsi(r.output).trim() + '\n'
    if (!r.ok) {
      allOk = false
      transcript += `\n[step ${i + 1} failed: stopping]\n`
      break
    }
  }
  return { ok: allOk, transcript: transcript.trim() }
}

export function registerRecipesIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('recipes:list', async () => listRecipes())

  const runRecipeById = async (id: string): Promise<{ ok: boolean; entryId?: string; error?: string }> => {
    const all = await listRecipes()
    const r = all.find((x) => x.id === id)
    if (!r) return { ok: false, error: 'Recipe not found' }
    const result = await runRecipeOnce(r)
    const entryId = randomUUID()
    getDb()
      .prepare(
        'INSERT INTO inbox_entries (id, title, body, kind, read, created_at) VALUES (?, ?, ?, ?, 0, ?)'
      )
      .run(entryId, `Recipe: ${r.name}`, result.transcript || '(no output)', 'recipe', Date.now())
    const win = getWindow()
    if (win && !win.isDestroyed()) win.webContents.send('inbox:new', { id: entryId })
    return { ok: result.ok, entryId }
  }

  ipcMain.handle('recipes:run', async (_e, id: string) => runRecipeById(id))

  // ---- Schedules ----
  ipcMain.handle('schedules:list', (_e, recipeId?: string | null) => {
    const db = getDb()
    if (recipeId) {
      return db
        .prepare('SELECT * FROM recipe_schedules WHERE recipe_id = ? ORDER BY created_at DESC')
        .all(recipeId) as RecipeScheduleRow[]
    }
    return db
      .prepare('SELECT * FROM recipe_schedules ORDER BY created_at DESC')
      .all() as RecipeScheduleRow[]
  })

  ipcMain.handle(
    'schedules:upsert',
    (
      _e,
      payload: {
        id?: string
        recipeId: string
        kind: 'daily' | 'weekdays' | 'interval'
        hour?: number | null
        minute?: number | null
        intervalMinutes?: number | null
        enabled?: boolean
      }
    ) => {
      const db = getDb()
      const id = payload.id || randomUUID()
      const enabled = payload.enabled === false ? 0 : 1
      const nextRun = computeNextRun(
        payload.kind,
        payload.hour ?? null,
        payload.minute ?? null,
        payload.intervalMinutes ?? null,
        Date.now()
      )
      const exists = db.prepare('SELECT id FROM recipe_schedules WHERE id = ?').get(id)
      if (exists) {
        db.prepare(
          `UPDATE recipe_schedules
             SET recipe_id = ?, kind = ?, hour = ?, minute = ?, interval_minutes = ?, enabled = ?, next_run_at = ?
           WHERE id = ?`
        ).run(
          payload.recipeId,
          payload.kind,
          payload.hour ?? null,
          payload.minute ?? null,
          payload.intervalMinutes ?? null,
          enabled,
          nextRun,
          id
        )
      } else {
        db.prepare(
          `INSERT INTO recipe_schedules
             (id, recipe_id, kind, hour, minute, interval_minutes, enabled, last_run_at, next_run_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
        ).run(
          id,
          payload.recipeId,
          payload.kind,
          payload.hour ?? null,
          payload.minute ?? null,
          payload.intervalMinutes ?? null,
          enabled,
          nextRun,
          Date.now()
        )
      }
      return { id, nextRunAt: nextRun }
    }
  )

  ipcMain.handle('schedules:remove', (_e, id: string) => {
    getDb().prepare('DELETE FROM recipe_schedules WHERE id = ?').run(id)
    return { ok: true }
  })

  ipcMain.handle('schedules:toggle', (_e, payload: { id: string; enabled: boolean }) => {
    const db = getDb()
    const row = db
      .prepare('SELECT * FROM recipe_schedules WHERE id = ?')
      .get(payload.id) as RecipeScheduleRow | undefined
    if (!row) return { ok: false }
    const enabled = payload.enabled ? 1 : 0
    let nextRun = row.next_run_at
    if (payload.enabled) {
      nextRun = computeNextRun(row.kind, row.hour, row.minute, row.interval_minutes, Date.now())
    }
    db.prepare('UPDATE recipe_schedules SET enabled = ?, next_run_at = ? WHERE id = ?').run(
      enabled,
      nextRun,
      payload.id
    )
    return { ok: true, nextRunAt: nextRun }
  })

  // ---- In-process scheduler ----
  let running = false
  const tick = async (): Promise<void> => {
    if (running) return
    const db = getDb()
    const now = Date.now()
    const due = db
      .prepare('SELECT * FROM recipe_schedules WHERE enabled = 1 AND next_run_at <= ?')
      .all(now) as RecipeScheduleRow[]
    if (due.length === 0) return
    running = true
    try {
      for (const sched of due) {
        try {
          const result = await runRecipeById(sched.recipe_id)
          const next = computeNextRun(
            sched.kind,
            sched.hour,
            sched.minute,
            sched.interval_minutes,
            Date.now()
          )
          db.prepare(
            'UPDATE recipe_schedules SET last_run_at = ?, next_run_at = ? WHERE id = ?'
          ).run(Date.now(), next, sched.id)
          if (Notification.isSupported()) {
            new Notification({
              title: 'Scheduled recipe finished',
              body: result.ok ? 'See result in Inbox.' : `Failed: ${result.error || 'unknown'}`
            }).show()
          }
        } catch (err) {
          console.error('[schedule] run error', sched.id, err)
          // bump next_run_at forward to avoid tight retry loops
          const next = computeNextRun(
            sched.kind,
            sched.hour,
            sched.minute,
            sched.interval_minutes,
            Date.now() + 60_000
          )
          db.prepare('UPDATE recipe_schedules SET next_run_at = ? WHERE id = ?').run(next, sched.id)
        }
      }
    } finally {
      running = false
    }
  }
  setInterval(() => void tick(), 30_000)
  // initial check after 5s so any past-due fires soon after launch
  setTimeout(() => void tick(), 5_000)

  ipcMain.handle('inbox:list', () => {
    return getDb()
      .prepare('SELECT * FROM inbox_entries ORDER BY created_at DESC LIMIT 100')
      .all() as InboxEntryRow[]
  })

  ipcMain.handle('inbox:mark-read', (_e, id: string) => {
    getDb().prepare('UPDATE inbox_entries SET read = 1 WHERE id = ?').run(id)
    return { ok: true }
  })

  ipcMain.handle('inbox:remove', (_e, id: string) => {
    getDb().prepare('DELETE FROM inbox_entries WHERE id = ?').run(id)
    return { ok: true }
  })

  ipcMain.handle('inbox:unread-count', () => {
    const r = getDb().prepare('SELECT COUNT(*) as n FROM inbox_entries WHERE read = 0').get() as { n: number }
    return r.n
  })
}
