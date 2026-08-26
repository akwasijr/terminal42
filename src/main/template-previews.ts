// Generates real screenshots for each Studio42 starter template.
//
// Strategy: lazy, user-initiated. When the renderer requests a preview that
// isn't already cached on disk, we:
//   1. `npm install` inside the cached template directory if node_modules is missing
//   2. spawn `npx next dev -p <free-port>` and wait for the "ready" line
//   3. open a hidden BrowserWindow at http://localhost:<port>, wait briefly
//   4. capturePage() → write PNG to userData/template-previews/<id>.png
//   5. kill the dev server
//
// Concurrency is gated to one job at a time — running two Next.js installs
// in parallel on the user's machine would melt their fans. Progress events
// are pushed to the renderer via 'templates:preview:progress'.

import { ipcMain, BrowserWindow, app } from 'electron'
import { spawn, type ChildProcess } from 'child_process'
import { promises as fs } from 'fs'
import { existsSync } from 'fs'
import { join } from 'path'
import { createServer } from 'net'

const PREVIEW_W = 1280
const PREVIEW_H = 800
const REPO_CACHE_SUBDIR = 'template-cache/Studio42Starkit/starters'

function previewsDir(): string {
  return join(app.getPath('userData'), 'template-previews')
}
function previewPath(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9._-]/g, '_')
  return join(previewsDir(), `${safe}.png`)
}
function templateSourceDir(id: string): string {
  return join(app.getPath('userData'), REPO_CACHE_SUBDIR, id)
}

async function existsAsync(p: string): Promise<boolean> {
  try { await fs.access(p); return true } catch { return false }
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.listen(0, () => {
      const addr = srv.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      srv.close(() => port ? resolve(port) : reject(new Error('no port')))
    })
    srv.on('error', reject)
  })
}

type ProgressFn = (msg: string, pct?: number) => void

async function runStreamed(cmd: string, args: string[], cwd: string, onProgress: ProgressFn, label: string): Promise<{ code: number; lastErr: string }> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd, env: { ...process.env, npm_config_audit: 'false', npm_config_fund: 'false' } })
    let lastEmit = 0
    let lastErr = ''
    const emit = (line: string) => {
      const now = Date.now()
      if (now - lastEmit < 200) return
      lastEmit = now
      const trimmed = line.trim().slice(0, 120)
      if (trimmed) onProgress(`${label}: ${trimmed}`)
    }
    p.stdout?.on('data', (d) => emit(d.toString()))
    p.stderr?.on('data', (d) => { const s = d.toString(); lastErr += s; emit(s) })
    p.on('close', (code) => resolve({ code: code ?? 1, lastErr: lastErr.slice(-300) }))
    p.on('error', (err) => resolve({ code: 1, lastErr: String(err) }))
  })
}

type Framework = 'next' | 'vite' | 'unknown'
async function detectFramework(cwd: string): Promise<Framework> {
  try {
    const pkg = JSON.parse(await fs.readFile(join(cwd, 'package.json'), 'utf8'))
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
    if (deps.next) return 'next'
    if (deps.vite) return 'vite'
  } catch {}
  return 'unknown'
}

function spawnDevServer(cwd: string, framework: Framework, port: number): { proc: ChildProcess; ready: Promise<string>; killed: { value: boolean } } {
  const env = { ...process.env, NODE_ENV: 'development', PORT: String(port), BROWSER: 'none' }
  const cmd = 'npx'
  const args = framework === 'vite'
    ? ['--yes', 'vite', '--port', String(port), '--strictPort']
    : ['--yes', 'next', 'dev', '-p', String(port)]
  const proc = spawn(cmd, args, { cwd, env })
  const killed = { value: false }
  const ready = new Promise<string>((resolve, reject) => {
    let buf = ''
    const onData = (d: Buffer): void => {
      buf += d.toString()
      // Vite: "Local:   http://localhost:5173/" — Next: "started server on 0.0.0.0:3000"
      const m = buf.match(/Local:\s+(https?:\/\/[^\s]+)/i)
        || buf.match(/started server on .*?(https?:\/\/[^\s]+)/i)
      if (m) {
        let url = m[1]
        if (!/:\d+/.test(url)) url = `http://localhost:${port}`
        resolve(url)
      } else if (/ready in \d/i.test(buf) || /compiled successfully/i.test(buf) || /VITE\s+v?\d/.test(buf)) {
        resolve(`http://localhost:${port}`)
      }
    }
    proc.stdout?.on('data', onData)
    proc.stderr?.on('data', onData)
    proc.on('exit', (code) => {
      if (!killed.value) reject(new Error(`dev server exited (${code}) before ready: ${buf.slice(-200)}`))
    })
    setTimeout(() => reject(new Error('timeout waiting for dev server to be ready')), 180_000)
  })
  return { proc, ready, killed }
}

async function captureUrl(url: string, dest: string): Promise<void> {
  const win = new BrowserWindow({
    show: false,
    width: PREVIEW_W,
    height: PREVIEW_H,
    webPreferences: { offscreen: false, contextIsolation: true, nodeIntegration: false, sandbox: true }
  })
  try {
    await win.loadURL(url)
    // Wait for the page to settle (animations, fonts, hydration).
    await new Promise((r) => setTimeout(r, 3500))
    const img = await win.webContents.capturePage()
    await fs.mkdir(previewsDir(), { recursive: true })
    await fs.writeFile(dest, img.toPNG())
  } finally {
    win.destroy()
  }
}

let queue: Promise<void> = Promise.resolve()
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn)
  queue = next.then(() => undefined, () => undefined)
  return next
}

const inflight = new Set<string>()

async function generateOne(id: string, broadcast: (msg: string, pct?: number) => void): Promise<{ ok: true } | { ok: false; error: string }> {
  const dest = previewPath(id)
  if (await existsAsync(dest)) return { ok: true }
  if (inflight.has(id)) {
    // Wait for the in-flight job to finish, then return its result.
    while (inflight.has(id)) await new Promise((r) => setTimeout(r, 250))
    return (await existsAsync(dest)) ? { ok: true } : { ok: false, error: 'previous attempt failed' }
  }
  inflight.add(id)
  try {
    const src = templateSourceDir(id)
    if (!existsSync(src)) return { ok: false, error: `Template "${id}" not in cache. Open Templates once to clone the repo.` }

    const onProgress: ProgressFn = (msg) => broadcast(msg)

    if (!existsSync(join(src, 'node_modules'))) {
      onProgress('Installing dependencies (first run only, this can take a few minutes)…')
      const ins = await runStreamed('npm', ['install', '--no-audit', '--no-fund', '--legacy-peer-deps', '--loglevel=error'], src, onProgress, 'install')
      if (ins.code !== 0) return { ok: false, error: `npm install failed: ${ins.lastErr || 'see logs'}` }
    }

    onProgress('Detecting framework…')
    const framework = await detectFramework(src)
    if (framework === 'unknown') return { ok: false, error: 'Could not detect Next.js or Vite in package.json' }

    onProgress(`Starting ${framework} dev server…`)
    const port = await getFreePort()
    const dev = spawnDevServer(src, framework, port)
    let url: string
    try {
      url = await dev.ready
    } catch (e) {
      dev.killed.value = true
      try { dev.proc.kill('SIGTERM') } catch {}
      return { ok: false, error: String((e as Error).message || e) }
    }

    onProgress('Capturing screenshot…')
    try {
      await captureUrl(url, dest)
    } catch (e) {
      return { ok: false, error: `capture failed: ${String((e as Error).message || e)}` }
    } finally {
      dev.killed.value = true
      try { dev.proc.kill('SIGTERM') } catch {}
      // Give it a moment to exit, else SIGKILL.
      setTimeout(() => { try { dev.proc.kill('SIGKILL') } catch {} }, 4000)
    }

    onProgress('Done')
    return { ok: true }
  } finally {
    inflight.delete(id)
  }
}

async function previewToDataUrl(id: string): Promise<string | null> {
  const p = previewPath(id)
  try {
    const buf = await fs.readFile(p)
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

export function registerTemplatePreviewsIpc(getWindow: () => BrowserWindow | null): void {
  const broadcastFor = (id: string) => (msg: string, pct?: number) => {
    const w = getWindow()
    if (!w || w.isDestroyed()) return
    w.webContents.send('templates:preview:progress', { id, msg, pct: pct ?? null })
  }

  ipcMain.handle('templates:preview:get', async (_e, args: { id: string }) => {
    return await previewToDataUrl(args.id)
  })

  ipcMain.handle('templates:preview:status', async (_e, args: { id: string }) => {
    return {
      hasPreview: await existsAsync(previewPath(args.id)),
      generating: inflight.has(args.id)
    }
  })

  ipcMain.handle('templates:preview:generate', async (_e, args: { id: string }) => {
    const broadcast = broadcastFor(args.id)
    const r = await enqueue(() => generateOne(args.id, broadcast))
    if (!r.ok) {
      broadcast(`Error: ${r.error}`)
      return { ok: false, error: r.error }
    }
    const dataUrl = await previewToDataUrl(args.id)
    return { ok: true, dataUrl }
  })

  ipcMain.handle('templates:preview:regenerate', async (_e, args: { id: string }) => {
    try { await fs.unlink(previewPath(args.id)) } catch {}
    const broadcast = broadcastFor(args.id)
    const r = await enqueue(() => generateOne(args.id, broadcast))
    if (!r.ok) return { ok: false, error: r.error }
    return { ok: true, dataUrl: await previewToDataUrl(args.id) }
  })
}
